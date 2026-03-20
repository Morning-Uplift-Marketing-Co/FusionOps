/**
 * HTML Expression Replacer for Post-Build Cleanup
 * ================================================
 * Replaces any remaining Astro `import.meta.env.PUBLIC_*` expressions
 * that leaked into the final HTML output after build.
 *
 * Catches patterns that the preprocessor may have missed:
 *   - In script tags: import.meta.env.PUBLIC_VAR || 'fallback'
 *   - In template literals: ${import.meta.env.PUBLIC_VAR}
 *   - In HTML content: import.meta.env.PUBLIC_VAR
 *
 * Works on HTML string and returns modified HTML with env vars replaced.
 */

/**
 * Escape special characters in string values for safe insertion into HTML/JS
 * @param {string} str - The value to escape
 * @returns {string} Escaped string safe for insertion
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
 * Replace leaked Astro environment variable expressions in HTML
 *
 * Scans HTML string for any remaining import.meta.env.PUBLIC_* patterns
 * and replaces them with actual values. Handles:
 *   - Quoted patterns: import.meta.env.PUBLIC_X || "fallback"
 *   - Unquoted patterns: import.meta.env.PUBLIC_X
 *   - Template literals: ${import.meta.env.PUBLIC_X}
 *
 * @param {string} html - HTML string to process
 * @param {Record<string, string>} envVars - Environment variables { "PUBLIC_VAR": "value" }
 * @returns {string} HTML with env vars replaced
 */
export function replaceLeakedExpressions(html, envVars) {
  // Validate inputs
  if (typeof html !== 'string') {
    return html || '';
  }
  if (!envVars || typeof envVars !== 'object') {
    envVars = {};
  }

  let result = html;

  // Pattern 1: ${import.meta.env.PUBLIC_VAR} or ${import.meta.env.PUBLIC_VAR || 'fallback'}
  // This catches template literal patterns - process FIRST to avoid interference
  result = result.replace(
    /\$\{import\.meta\.env\.(PUBLIC_\w+)(?:\s*\|\|\s*(['"`])([^'">`]*)\2)?\}/g,
    (match, varName, quote, fallback) => {
      const value = envVars[varName] || fallback || '';
      return value;
    }
  );

  // Pattern 2: import.meta.env.PUBLIC_VAR || 'fallback' or || "fallback"
  // This catches quoted patterns with fallback operator
  result = result.replace(
    /import\.meta\.env\.(PUBLIC_\w+)\s*\|\|\s*(['"`])([^'">`]*)\2/g,
    (match, varName, quote, fallback) => {
      const value = envVars[varName] || fallback || '';
      const escaped = escapeString(value);
      return `${quote}${escaped}${quote}`;
    }
  );

  // Pattern 3: import.meta.env.PUBLIC_VAR (no fallback, not in template literal)
  // This must not match if already replaced or in a template literal
  result = result.replace(
    /import\.meta\.env\.(PUBLIC_\w+)(?!\s*\|\|)(?!['"a-zA-Z_\$\{])/g,
    (match, varName) => {
      const value = envVars[varName] || '';
      const escaped = escapeString(value);
      return `'${escaped}'`;
    }
  );

  return result;
}
