/**
 * Template Builder Orchestrator
 * ==============================
 * Single entry point for building templates across all formats.
 *
 * Responsibilities:
 * 1. Detect framework using template-analyzer
 * 2. Find matching format-specific builder
 * 3. Create isolated temp directory
 * 4. Delegate to builder
 * 5. Stage output for fingerprinting
 * 6. Clean up temp directory
 */

import { identifyFramework } from '../../utils/template-analyzer.js';
import { AstroBuilder } from './AstroBuilder.js';
import { ViteBuilder } from './ViteBuilder.js';
import { HtmlStaticBuilder } from './HtmlStaticBuilder.js';
import { AntiFingerprint } from '../AntiFingerprint.js';
import { QualityChecker } from '../quality-check/QualityChecker.js';
import { JavaScriptObfuscator } from '../obfuscation-transform.js';
import { NetworkRandomizer } from '../network-randomization.js';
import { EventRandomizer } from '../event-randomization.js';
import { promises as fs } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

export class TemplateBuilder {
  /**
   * Build template for deployment
   *
   * Process:
   * 1. Detect framework from files
   * 2. Find matching builder adapter
   * 3. Create isolated temp directory
   * 4. Run builder
   * 5. Apply anti-fingerprinting transform
   * 6. Run quality checks (viewport, tracking, astro leaks, google ads, lighthouse)
   * 7. Copy output to staging area
   * 8. Clean up temp directory
   *
   * @param {Record<string, string>} files - template file map
   * @param {Record<string, string>} envVars - environment variables
   * @param {string} siteId - unique site identifier
   * @param {Object} config - build configuration
   * @param {Object} config.qualityConfig - quality check configuration
   * @returns {Promise<{success: boolean, outputPath: string, framework: string, error?: string, qualityResults?: Object}>}
   */
  static async buildTemplate(files, envVars, siteId, config = {}) {
    // Step 1: Detect framework
    const framework = identifyFramework(files);
    if (!framework || framework.id === 'unknown') {
      return {
        success: false,
        outputPath: null,
        framework: 'unknown',
        error: 'Unknown template format'
      };
    }

    console.log(`[TemplateBuilder] Detected framework: ${framework.label} (${framework.id})`);

    // Step 2: Find matching builder
    const builders = [AstroBuilder, ViteBuilder, HtmlStaticBuilder];
    const BuilderClass = builders.find(b => b.canHandle(files, framework));

    if (!BuilderClass) {
      return {
        success: false,
        outputPath: null,
        framework: framework.label,
        error: `No builder found for framework: ${framework.label}`
      };
    }

    // Step 3: Create isolated temp directory
    const workDir = mkdtempSync(path.join(tmpdir(), `build-${siteId}-`));
    console.log(`[TemplateBuilder] Created temp directory: ${workDir}`);

    try {
      // Step 4: Run builder
      const builder = new BuilderClass();
      const buildResult = await builder.build(files, envVars, workDir);

      if (!buildResult.success) {
        return {
          success: false,
          outputPath: null,
          framework: framework.label,
          error: buildResult.error || 'Build failed with unknown error'
        };
      }

      console.log(`[TemplateBuilder] Build completed successfully`);

      // Step 5: Read built HTML and CSS
      const indexPath = path.join(buildResult.outputDir, 'index.html');
      const cssPath = path.join(buildResult.outputDir, 'styles.css');

      let htmlContent = '';
      let cssContent = '';

      try {
        htmlContent = await fs.readFile(indexPath, 'utf-8');
      } catch (e) {
        console.warn(`[TemplateBuilder] index.html not found at ${indexPath}`);
      }

      try {
        cssContent = await fs.readFile(cssPath, 'utf-8');
      } catch (e) {
        console.warn(`[TemplateBuilder] styles.css not found at ${cssPath}`);
      }

      // Step 6: Apply anti-fingerprinting transform
      let transformedHtml = htmlContent;
      let transformedCss = cssContent;

      if (htmlContent) {
        try {
          const transformed = await AntiFingerprint.transform(htmlContent, cssContent, siteId);
          transformedHtml = transformed.html;
          transformedCss = transformed.css;
          console.log(`[TemplateBuilder] Applied anti-fingerprinting transform`);
        } catch (error) {
          console.error(`[TemplateBuilder] Anti-fingerprinting failed: ${error.message}`);
          return {
            success: false,
            outputPath: null,
            framework: framework.label,
            error: `Anti-fingerprinting failed: ${error.message}`
          };
        }
      }

      // Step 6b: Apply Phase 3 vector transforms (if enabled)
      if (config.vectors && transformedHtml) {
        try {
          if (config.vectors.obfuscate) {
            const obfuscResult = await JavaScriptObfuscator.transform(
              transformedHtml,
              siteId,
              { level: config.vectors.obfuscationLevel || 'moderate' }
            );
            transformedHtml = obfuscResult.html;
            console.log(`[TemplateBuilder] Applied JavaScript obfuscation`);
          }

          if (config.vectors.networkJitter) {
            const networkResult = NetworkRandomizer.transform(
              transformedHtml,
              siteId,
              {
                min: config.vectors.networkJitterMin || 50,
                max: config.vectors.networkJitterMax || 500
              }
            );
            transformedHtml = networkResult.html;
            console.log(`[TemplateBuilder] Applied network timing randomization`);
          }

          if (config.vectors.eventRandomization) {
            const eventResult = await EventRandomizer.transform(
              transformedHtml,
              siteId,
              { enabled: config.vectors.eventRandomizationEnabled !== false }
            );
            transformedHtml = eventResult.html;
            console.log(`[TemplateBuilder] Applied event listener randomization`);
          }
        } catch (error) {
          console.error(`[TemplateBuilder] Vector transform failed: ${error.message}`);
          return {
            success: false,
            outputPath: null,
            framework: framework.label,
            error: `Vector transform failed: ${error.message}`
          };
        }
      }

      // Step 7: Run quality checks (QUAL-06 integration point)
      let qualityResults = null;
      if (transformedHtml) {
        const qualityConfig = config.qualityConfig || {
          trackingConfig: {
            required: config.requireTracking ?? true,
          },
          googleAdsConfig: {
            required: config.requireGoogleAds ?? false,
          },
          lighthouseConfig: {
            thresholds: config.lighthouseThresholds || {
              performance: 95,
              accessibility: 95,
              best_practices: 95,
              seo: 95,
            },
            timeout: 120000,
          },
        };

        try {
          qualityResults = await QualityChecker.validatePreDeploy(
            transformedHtml,
            transformedCss,
            qualityConfig
          );

          console.log(`[TemplateBuilder] Quality checks completed: ${qualityResults.passed ? 'PASSED' : 'FAILED'}`);

          // Block deploy if critical failures
          if (!qualityResults.passed) {
            const failures = qualityResults.criticalFailures
              .map((f) => `${f.id}: ${f.message}`)
              .join('\n');
            return {
              success: false,
              outputPath: null,
              framework: framework.label,
              error: `Quality validation failed:\n${failures}\n\nDeploy blocked. Fix issues and rebuild.`,
              qualityResults
            };
          }

          // Log warnings if any
          if (qualityResults.warnings && qualityResults.warnings.length > 0) {
            console.warn('[TemplateBuilder] Quality check warnings:');
            qualityResults.warnings.forEach((w) => {
              console.warn(`  ${w.id}: ${w.message}`);
            });
          }
        } catch (error) {
          console.error(`[TemplateBuilder] Quality check error: ${error.message}`);
          return {
            success: false,
            outputPath: null,
            framework: framework.label,
            error: `Quality check failed: ${error.message}`,
            qualityResults
          };
        }
      }

      // Step 8: Copy output to staging area
      const stagingDir = path.join(tmpdir(), 'lp-factory-staging', siteId);
      await fs.mkdir(stagingDir, { recursive: true });

      // Copy entire output directory to staging
      await copyDir(buildResult.outputDir, stagingDir);

      // Also save transformed HTML/CSS to staging
      if (transformedHtml) {
        await fs.writeFile(path.join(stagingDir, 'index.html'), transformedHtml, 'utf-8');
      }
      if (transformedCss) {
        await fs.writeFile(path.join(stagingDir, 'styles.css'), transformedCss, 'utf-8');
      }

      console.log(`[TemplateBuilder] Staged output to ${stagingDir}`);

      return {
        success: true,
        outputPath: stagingDir,
        framework: framework.label,
        html: transformedHtml,
        css: transformedCss,
        qualityResults,
        deployReady: qualityResults?.passed ?? true
      };
    } catch (error) {
      const message = error.message || String(error);
      console.error('[TemplateBuilder] Unexpected error:', message);
      return {
        success: false,
        outputPath: null,
        framework: framework.label,
        error: message
      };
    } finally {
      // Step 9: Clean up temp directory
      try {
        rmSync(workDir, { recursive: true, force: true });
        console.log(`[TemplateBuilder] Cleaned up temp directory`);
      } catch (err) {
        console.warn(`[TemplateBuilder] Failed to clean up temp directory: ${err.message}`);
      }
    }
  }
}

/**
 * Recursively copy directory contents
 * @param {string} src - source directory
 * @param {string} dest - destination directory
 */
async function copyDir(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
