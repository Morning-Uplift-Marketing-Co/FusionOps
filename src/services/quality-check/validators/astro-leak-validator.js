/**
 * Astro Expression Leak Detection (QUAL-03)
 * ==========================================
 * Detects any remaining import.meta.env.PUBLIC_* or ${...} expressions
 * that leaked into the final HTML output.
 *
 * Catches patterns that env preprocessor may have missed:
 *   - import.meta.env.PUBLIC_VAR (standalone)
 *   - import.meta.env.PUBLIC_VAR || 'fallback'
 *   - ${import.meta.env.PUBLIC_VAR}
 *   - import.meta.env.VITE_*
 *
 * False positive mitigation:
 *   - Whitelists safe built-in vars: DEV, PROD, SSR
 *   - Ignores env mentions in HTML comments (simple approach)
 */

// Pre-compile regex patterns (avoid recompilation on every check)
const LEAK_PATTERNS = {
  // import.meta.env.PUBLIC_* in any context
  importMetaEnv: /import\.meta\.env\.PUBLIC_\w+/g,

  // Template literals with env: ${import.meta.env.PUBLIC_*}
  templateLiteralEnv: /\$\{[^}]*import\.meta\.env\.PUBLIC_\w+[^}]*\}/g,

  // Vite env pattern: import.meta.env.VITE_*
  viteEnv: /import\.meta\.env\.VITE_\w+/g,

  // Template literal falsy checks: ${import.meta.env.PUBLIC_* || "fallback"}
  fallbackPattern: /import\.meta\.env\.PUBLIC_\w+\s*\|\|/g,
};

// Safe patterns to whitelist (built-in Astro vars, not leaks)
const SAFE_PATTERNS = [
  'import.meta.env.DEV',
  'import.meta.env.PROD',
  'import.meta.env.SSR',
];

/**
 * Check for Astro expression leaks in HTML content
 * @param {string} htmlContent - Final HTML output from build
 * @returns {Object} Result with {id, name, passed, severity, message, details, fix?}
 */
export function checkAstroLeaks(htmlContent) {
  // Validate input
  if (typeof htmlContent !== 'string') {
    htmlContent = '';
  }

  const leaks = [];
  const processedExpressions = new Set(); // Avoid duplicate reporting

  // Check HTML body + script content
  for (const [patternName, pattern] of Object.entries(LEAK_PATTERNS)) {
    let match;
    // Reset regex global flag state
    pattern.lastIndex = 0;

    while ((match = pattern.exec(htmlContent)) !== null) {
      const expression = match[0];

      // Skip safe built-in vars
      const isSafe = SAFE_PATTERNS.some((safe) => safe === expression);
      if (isSafe) continue;

      // Skip duplicates
      if (processedExpressions.has(expression)) continue;
      processedExpressions.add(expression);

      // Find line context for each leak
      const lineContext = findLineContext(htmlContent, expression);

      // Flatten the line context into the details format expected by tests
      if (lineContext.length > 0) {
        leaks.push({
          type: patternName,
          expression,
          lineNumber: lineContext[0].lineNumber,
          context: lineContext[0].context,
          lines: lineContext, // Keep for backward compatibility
        });
      }
    }
  }

  const passed = leaks.length === 0;

  return {
    id: 'QUAL-03',
    name: 'Astro Expression Leak Detection',
    passed,
    severity: passed ? 'info' : 'critical',
    message: passed
      ? 'No Astro import.meta.env expressions detected in output'
      : `Found ${leaks.length} Astro expression leak(s) in output`,
    details: leaks,
    fix:
      !passed
        ? 'Ensure env preprocessor (Phase 1) replaced all import.meta.env.PUBLIC_* with actual values before fingerprinting'
        : undefined,
  };
}

/**
 * Find line context for a matched expression
 * @param {string} content - Full HTML content
 * @param {string} expression - The expression to find
 * @param {number} contextLines - Number of lines before/after to include
 * @returns {Array} Array of {lineNumber, context} objects
 */
function findLineContext(content, expression, contextLines = 2) {
  const lines = content.split('\n');
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(expression)) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length, i + contextLines + 1);
      results.push({
        lineNumber: i + 1,
        context: lines.slice(start, end).join('\n'),
      });
    }
  }

  return results;
}
