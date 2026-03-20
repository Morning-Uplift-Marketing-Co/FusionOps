/**
 * Format Builder Base Class
 * =========================
 * Abstract base class for format-specific template builders (Astro, Vite, HTML).
 *
 * Each builder:
 * - Detects if this format matches a template (static canHandle method)
 * - Builds the template independently (async build method)
 * - Returns output directory path and success status
 *
 * Design: Adapter pattern with shared utilities for exec + file writing.
 */

import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Base class for format-specific builders.
 * Subclasses override canHandle() and build() methods.
 */
export class FormatBuilder {
  /**
   * Check if template matches this format
   * @param {Record<string, string>} files - template file map
   * @param {Object} framework - framework detection result from template-analyzer
   * @param {string} framework.id - framework ID ('astro', 'vite-react', 'html-static')
   * @param {string} framework.label - human-readable label
   * @returns {boolean} true if this builder can handle the template
   */
  static canHandle(files, framework) {
    throw new Error('Implement canHandle() in subclass');
  }

  /**
   * Build template to static output
   * @param {Record<string, string>} files - template files { "path/file.ext": "content" }
   * @param {Record<string, string>} envVars - environment variables
   * @param {string} workDir - temp directory for build (caller creates/cleans)
   * @returns {Promise<{outputDir: string, success: boolean, error?: string}>}
   */
  async build(files, envVars, workDir) {
    throw new Error('Implement build() in subclass');
  }

  /**
   * Execute shell command asynchronously
   * @param {string} command - shell command to execute
   * @param {Object} options - options to pass to exec (cwd, etc.)
   * @returns {Promise<string>} stdout
   * @throws {Error} if command fails
   */
  static async execAsync(command, options = {}) {
    const { stdout, stderr } = await execAsync(command, options);
    if (stderr && !stderr.includes('npm warn')) {
      console.warn('Command stderr:', stderr);
    }
    return stdout;
  }

  /**
   * Write files to a directory synchronously
   * @param {string} dir - target directory
   * @param {Record<string, string>} files - file map
   * @throws {Error} if file operations fail
   */
  static async writeFilesSync(dir, files) {
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(dir, filePath);
      const dirPath = path.dirname(fullPath);

      // Create directories recursively
      await fs.mkdir(dirPath, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, content, 'utf8');
    }
  }
}
