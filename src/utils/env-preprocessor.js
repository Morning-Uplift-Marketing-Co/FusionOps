/**
 * Environment Variable Preprocessor for Astro Templates
 * ======================================================
 * Replaces Astro `import.meta.env.PUBLIC_*` references with actual values
 * before build time, ensuring deployed pages show correct brand/tracking data.
 *
 * Handles both patterns:
 *   - With fallback: import.meta.env.PUBLIC_VAR || "fallback"
 *   - Without fallback: import.meta.env.PUBLIC_VAR
 *
 * Works on file maps (same format as JSZip output) and returns new object
 * with same keys but modified content.
 */

/**
 * Escape special characters in string values for safe insertion into code
 * @param {string} str - The value to escape
 * @returns {string} Escaped string safe for insertion into quoted strings
 */
function escapeString(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/'/g, "\\'")    // Escape single quotes
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\t/g, '\\t');  // Escape tabs
}

/**
 * Preprocess Astro template files to inject environment variables
 *
 * Iterates through files, finds .astro files, and replaces all
 * import.meta.env.PUBLIC_* references with actual values from envVars object.
 *
 * @param {Record<string, string>} files - File map { "path/file.ext": "content" }
 * @param {Record<string, string>} envVars - Environment variables { "PUBLIC_VAR": "value" }
 * @returns {Record<string, string>} New file map with .astro files preprocessed
 */
export function preprocessAstroEnvVars(files, envVars) {
  // Validate inputs
  if (!files || typeof files !== 'object') {
    return files || {};
  }
  if (!envVars || typeof envVars !== 'object') {
    envVars = {};
  }

  // Create copy to avoid mutating input
  const processed = { ...files };

  // Process each file
  for (const [path, content] of Object.entries(files)) {
    // Only process .astro files
    if (!path.endsWith('.astro')) {
      continue;
    }

    if (typeof content !== 'string') {
      continue;
    }

    let updated = content;

    // Pattern 1: import.meta.env.PUBLIC_VAR || 'fallback' or || "fallback"
    // This handles the fallback operator with various quote types
    updated = updated.replace(
      /import\.meta\.env\.(PUBLIC_\w+)\s*\|\|\s*(['"`])([^'">`]*)\2/g,
      (match, varName, quote, fallback) => {
        const value = envVars[varName] || fallback || '';
        const escaped = escapeString(value);
        return `${quote}${escaped}${quote}`;
      }
    );

    // Pattern 2: import.meta.env.PUBLIC_VAR (no fallback)
    // Must use negative lookahead to avoid matching already-replaced patterns
    updated = updated.replace(
      /import\.meta\.env\.(PUBLIC_\w+)(?!\s*\|\|)(?!['"a-zA-Z_])/g,
      (match, varName) => {
        const value = envVars[varName] || '';
        const escaped = escapeString(value);
        return `'${escaped}'`;
      }
    );

    processed[path] = updated;
  }

  return processed;
}
