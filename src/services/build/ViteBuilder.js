/**
 * Vite Builder
 * ============
 * Format-specific builder for Vite/React templates.
 *
 * Handles:
 * 1. .env file creation with environment variables
 * 2. Isolated npm ci install
 * 3. Vite build command execution
 * 4. Output directory detection (dist/)
 */

import { FormatBuilder } from './FormatBuilder.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export class ViteBuilder extends FormatBuilder {
  /**
   * Check if template is a Vite/React project
   * @param {Record<string, string>} files
   * @param {Object} framework - from template-analyzer
   * @returns {boolean}
   */
  static canHandle(files, framework) {
    return framework?.id === 'vite-react' || framework?.id === 'vite';
  }

  /**
   * Build Vite template
   *
   * Process:
   * 1. Write template files to workDir
   * 2. Create .env file with environment variables
   * 3. Run npm ci for deterministic dependencies
   * 4. Run npm run build (or vite build)
   * 5. Return dist/ output directory
   *
   * Note: Vite uses .env file at build time (no preprocessing of source needed).
   *
   * @param {Record<string, string>} files
   * @param {Record<string, string>} envVars
   * @param {string} workDir
   * @returns {Promise<{outputDir: string, success: boolean, error?: string}>}
   */
  async build(files, envVars, workDir) {
    try {
      // Step 1: Write template files to workDir
      await FormatBuilder.writeFilesSync(workDir, files);

      // Step 2: Create .env file for Vite
      const envContent = Object.entries(envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const envPath = path.join(workDir, '.env');
      await fs.writeFile(envPath, envContent, 'utf8');
      console.log(`[ViteBuilder] Created .env file with ${Object.keys(envVars).length} variables`);

      // Step 3: Install dependencies (deterministic from package-lock.json)
      console.log(`[ViteBuilder] Installing dependencies in ${workDir}`);
      await FormatBuilder.execAsync('npm ci --prefer-offline', { cwd: workDir });

      // Step 4: Build
      console.log('[ViteBuilder] Running npm run build');
      await FormatBuilder.execAsync('npm run build', { cwd: workDir });

      // Step 5: Return output directory
      const outputDir = path.join(workDir, 'dist');
      return {
        outputDir,
        success: true
      };
    } catch (error) {
      const message = error.message || String(error);
      console.error('[ViteBuilder] Build failed:', message);
      return {
        outputDir: null,
        success: false,
        error: message
      };
    }
  }
}
