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
   * 5. Copy output to staging area
   * 6. Clean up temp directory
   *
   * @param {Record<string, string>} files - template file map
   * @param {Record<string, string>} envVars - environment variables
   * @param {string} siteId - unique site identifier
   * @returns {Promise<{success: boolean, outputPath: string, framework: string, error?: string}>}
   */
  static async buildTemplate(files, envVars, siteId) {
    // Step 1: Detect framework
    const framework = identifyFramework(files);
    if (!framework) {
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

      // Step 5: Copy output to staging area
      const stagingDir = path.join(tmpdir(), 'lp-factory-staging', siteId);
      await fs.mkdir(stagingDir, { recursive: true });

      // Copy entire output directory to staging
      await copyDir(buildResult.outputDir, stagingDir);
      console.log(`[TemplateBuilder] Staged output to ${stagingDir}`);

      return {
        success: true,
        outputPath: stagingDir,
        framework: framework.label
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
      // Step 6: Clean up temp directory
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
