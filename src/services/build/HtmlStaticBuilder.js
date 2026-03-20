/**
 * HTML Static Builder
 * ===================
 * Format-specific builder for static HTML templates.
 *
 * Handles:
 * 1. File copying to workDir (no build step)
 * 2. Template expression replacement ({VAR}, ${VAR})
 * 3. No npm installation needed
 */

import { FormatBuilder } from './FormatBuilder.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export class HtmlStaticBuilder extends FormatBuilder {
  /**
   * Check if template is static HTML
   * @param {Record<string, string>} files
   * @param {Object} framework - from template-analyzer
   * @returns {boolean}
   */
  static canHandle(files, framework) {
    return framework?.id === 'html-static';
  }

  /**
   * Replace template expressions in HTML content
   *
   * Supports:
   * - {VAR_NAME}
   * - ${VAR_NAME}
   *
   * @param {string} content - HTML content
   * @param {Record<string, string>} envVars - Environment variables
   * @returns {string} - HTML with expressions replaced
   */
  static _replaceExpressions(content, envVars) {
    let updated = content;

    // Pattern 1: {VAR_NAME}
    updated = updated.replace(
      /\{\s*(\w+)\s*\}/g,
      (match, varName) => envVars[varName] !== undefined ? envVars[varName] : match
    );

    // Pattern 2: ${VAR_NAME}
    updated = updated.replace(
      /\$\{\s*(\w+)\s*\}/g,
      (match, varName) => envVars[varName] !== undefined ? envVars[varName] : match
    );

    return updated;
  }

  /**
   * Build static HTML template
   *
   * Process:
   * 1. Write template files to workDir
   * 2. Scan .html files for template expressions
   * 3. Replace {VAR} and ${VAR} with envVars values
   * 4. Return workDir as output (no dist/ subdirectory)
   *
   * @param {Record<string, string>} files
   * @param {Record<string, string>} envVars
   * @param {string} workDir
   * @returns {Promise<{outputDir: string, success: boolean, error?: string}>}
   */
  async build(files, envVars, workDir) {
    try {
      // Step 1: Write all files to workDir
      await FormatBuilder.writeFilesSync(workDir, files);

      // Step 2 & 3: Process .html files for variable replacement
      for (const [filePath, content] of Object.entries(files)) {
        if (!filePath.endsWith('.html')) {
          continue;
        }

        const updated = HtmlStaticBuilder._replaceExpressions(content, envVars);

        // Write updated content back if it changed
        if (updated !== content) {
          const fullPath = path.join(workDir, filePath);
          await fs.writeFile(fullPath, updated, 'utf8');
        }
      }

      console.log('[HtmlStaticBuilder] Processed template expressions');

      // Step 4: Return workDir as output (no dist/ subdirectory for static HTML)
      return {
        outputDir: workDir,
        success: true
      };
    } catch (error) {
      const message = error.message || String(error);
      console.error('[HtmlStaticBuilder] Build failed:', message);
      return {
        outputDir: null,
        success: false,
        error: message
      };
    }
  }
}
