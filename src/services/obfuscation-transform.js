/**
 * JavaScript Obfuscator Service
 * =============================
 * Obfuscates inline JavaScript using terser with deterministic seeding
 *
 * Provides:
 * - Variable name mangling
 * - Dead code elimination
 * - Minification
 * - Source map generation
 * - React hydration safety via deterministic output
 *
 * Phase 3 Vector 1: Implements JavaScript behavior randomization
 */

import crypto from 'crypto';
import { minify } from 'terser';

/**
 * @class JavaScriptObfuscator
 * Transforms HTML by obfuscating inline scripts with deterministic seeding
 */
export class JavaScriptObfuscator {
  /**
   * Transform HTML by obfuscating inline scripts
   *
   * @param {string} htmlContent - Raw HTML document
   * @param {string} siteId - Unique site identifier (used for seeding)
   * @param {Object} options - Configuration options
   * @param {string} options.level - Compression level: 'moderate' (default) or 'aggressive'
   * @returns {Promise<{html: string, scripts: Array, sourceMaps: Map, obfuscated: boolean}>}
   */
  static async transform(htmlContent, siteId, options = {}) {
    const { level = 'moderate' } = options;

    // Deterministic seeding: same siteId always produces same output
    // terser is deterministic by default given the same config,
    // so we use the seed to vary the reserved list order / passes
    const seed = crypto.createHash('sha256')
      .update(siteId + 'js-obfuscation')
      .digest('hex');

    // Extract inline scripts from HTML (skip src= and type=module)
    const scriptRegex = /<script(?![^>]*\bsrc\s*=)(?![^>]*\btype\s*=\s*["']module["'])[^>]*>([\s\S]*?)<\/script>/gi;

    let transformedHtml = htmlContent;
    const scripts = [];
    const sourceMaps = new Map();
    const matches = [];

    // Collect all matches first (avoid regex state issues with replace)
    let match;
    while ((match = scriptRegex.exec(htmlContent)) !== null) {
      const originalCode = match[1].trim();
      if (!originalCode) continue;
      matches.push({
        fullMatch: match[0],
        code: originalCode,
        index: match.index
      });
    }

    if (matches.length === 0) {
      return {
        html: htmlContent,
        scripts: [],
        sourceMaps: new Map(),
        obfuscated: false
      };
    }

    // Generate a short seed marker from the siteId hash
    // This ensures different siteIds produce different output even for identical code
    const seedMarker = seed.substring(0, 8);

    // Process each script
    for (let i = 0; i < matches.length; i++) {
      const { fullMatch, code } = matches[i];

      // Prepend a seed-derived variable so terser output varies per siteId
      // This is a deterministic fingerprint that makes each site's JS unique
      const seededCode = `var _s="${seedMarker}";${code}`;

      const terserConfig = {
        compress: {
          drop_console: false,
          drop_debugger: true,
          passes: level === 'aggressive' ? 3 : 1,
          pure_getters: true,
          toplevel: true,
          unused: false // Keep seed variable
        },
        mangle: {
          toplevel: true,
          keep_fnames: true, // Preserve function names (onclick, handleSubmit, etc.)
          properties: false, // CRITICAL: preserve object properties for tracking data-*
          reserved: [
            'onclick', 'onsubmit', 'onchange', 'onload', 'onerror',
            'handleSubmit', 'handleClick', 'handleChange',
            'addEventListener', 'removeEventListener',
            'fetch', 'sendBeacon', 'XMLHttpRequest'
          ]
        },
        output: {
          comments: false,
          beautify: false
        },
        sourceMap: true
      };

      const result = await minify(seededCode, terserConfig);

      if (!result.code && result.code !== '') {
        throw new Error(`Terser produced no output for script ${i}`);
      }

      const obfuscatedCode = result.code;
      scripts.push({
        index: i,
        original: code,
        obfuscated: obfuscatedCode,
        level
      });

      if (result.map) {
        sourceMaps.set(i, result.map);
      }

      // Replace the script content in HTML
      const newScriptTag = fullMatch.replace(code, obfuscatedCode);
      transformedHtml = transformedHtml.replace(fullMatch, newScriptTag);
    }

    return {
      html: transformedHtml,
      scripts,
      sourceMaps,
      obfuscated: true
    };
  }
}
