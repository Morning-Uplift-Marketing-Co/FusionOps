/**
 * Astro Builder
 * =============
 * Format-specific builder for Astro templates.
 *
 * Handles:
 * 1. Environment variable preprocessing (Phase 1 integration)
 * 2. Isolated npm ci install
 * 3. Astro build command execution
 * 4. Output directory detection (dist/)
 */

import { FormatBuilder } from './FormatBuilder.js';
import { preprocessAstroEnvVars } from '../../utils/env-preprocessor.js';
import path from 'node:path';

export class AstroBuilder extends FormatBuilder {
  /**
   * Check if template is an Astro project
   * @param {Record<string, string>} files
   * @param {Object} framework - from template-analyzer
   * @returns {boolean}
   */
  static canHandle(files, framework) {
    return framework?.id === 'astro';
  }

  /**
   * Build Astro template
   *
   * Process:
   * 1. Preprocess .astro files with env vars (Phase 1 output)
   * 2. Write files to workDir
   * 3. Run npm ci for deterministic dependencies
   * 4. Run npm run build (or astro build)
   * 5. Return dist/ output directory
   *
   * @param {Record<string, string>} files
   * @param {Record<string, string>} envVars
   * @param {string} workDir
   * @returns {Promise<{outputDir: string, success: boolean, error?: string}>}
   */
  async build(files, envVars, workDir) {
    try {
      // Step 1: Preprocess .astro files with env vars
      const preprocessed = preprocessAstroEnvVars(files, envVars);

      // Step 2: Write all files to workDir
      await FormatBuilder.writeFilesSync(workDir, preprocessed);

      // Step 3: Install dependencies (deterministic from package-lock.json)
      console.log(`[AstroBuilder] Installing dependencies in ${workDir}`);
      await FormatBuilder.execAsync('npm ci --prefer-offline', { cwd: workDir });

      // Step 4: Build
      console.log('[AstroBuilder] Running npm run build');
      await FormatBuilder.execAsync('npm run build', { cwd: workDir });

      // Step 5: Return output directory
      const outputDir = path.join(workDir, 'dist');
      return {
        outputDir,
        success: true
      };
    } catch (error) {
      const message = error.message || String(error);
      console.error('[AstroBuilder] Build failed:', message);
      return {
        outputDir: null,
        success: false,
        error: message
      };
    }
  }
}
