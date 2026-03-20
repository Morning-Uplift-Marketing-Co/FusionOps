/**
 * Tests for html-expression-replacer.js
 * Tests: replaceLeakedExpressions function
 */

import { describe, it, expect } from 'vitest';
import { replaceLeakedExpressions } from '../html-expression-replacer.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const ENV_VARS = {
  PUBLIC_SITE_NAME: 'LoanCorp',
  PUBLIC_CONVERSION_ID: 'abc123xyz',
  PUBLIC_TRACKING_DOMAIN: 'track.loancorp.com',
};

// ─── Test Cases ──────────────────────────────────────────────────────────────

describe('replaceLeakedExpressions', () => {
  // Test 1: Replaces import.meta.env.PUBLIC_SITE_NAME || "default" in HTML
  it('should replace import.meta.env.PUBLIC_VAR with fallback in HTML', () => {
    const html = `
      <html>
        <head>
          <title>import.meta.env.PUBLIC_SITE_NAME || "Default Site"</title>
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `;
    const result = replaceLeakedExpressions(html, ENV_VARS);
    expect(result).toContain(`<title>"LoanCorp"</title>`);
    expect(result).not.toContain('import.meta.env');
  });

  // Test 2: Replaces ${import.meta.env.PUBLIC_CONVERSION_ID} in template literals
  it('should replace ${import.meta.env.PUBLIC_VAR} in template literals', () => {
    // Using backticks for the HTML to properly capture template literal syntax
    const html = '<script>\n' +
      '  const trackingPixel = new Image();\n' +
      '  trackingPixel.src = `/pixel.gif?cid=${import.meta.env.PUBLIC_CONVERSION_ID}`;\n' +
      '</script>';
    const result = replaceLeakedExpressions(html, ENV_VARS);
    expect(result).toContain(`trackingPixel.src = \`/pixel.gif?cid=abc123xyz\`;`);
    expect(result).not.toContain('import.meta.env');
  });

  // Test 3: Handles multiple expressions in same HTML
  it('should replace multiple expressions in same HTML', () => {
    const html = `
      <html>
        <head>
          <title>import.meta.env.PUBLIC_SITE_NAME || "Site"</title>
        </head>
        <body>
          <script>
            const siteId = import.meta.env.PUBLIC_CONVERSION_ID || "0";
            const url = "https://" + import.meta.env.PUBLIC_TRACKING_DOMAIN + "/pixel.gif";
          </script>
        </body>
      </html>
    `;
    const result = replaceLeakedExpressions(html, ENV_VARS);
    expect(result).toContain(`<title>"LoanCorp"</title>`);
    expect(result).toContain(`const siteId = "abc123xyz";`);
    expect(result).toContain(`"https://" + 'track.loancorp.com' + "/pixel.gif"`);
    expect(result).not.toContain('import.meta.env');
  });

  // Test 4: Escapes values with special characters
  it('should escape values with special chars', () => {
    const html = `<script>const msg = import.meta.env.PUBLIC_TEXT;</script>`;
    const specialEnv = { PUBLIC_TEXT: `John's "Amazing" Loan Co\\` };
    const result = replaceLeakedExpressions(html, specialEnv);
    expect(result).toContain(`John\\'s \\"Amazing\\" Loan Co\\\\`);
  });

  // Test 5: Does not modify HTML structure (non-env content unchanged)
  it('should not modify non-env HTML content', () => {
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <link rel="stylesheet" href="/styles.css" />
        </head>
        <body>
          <h1>Welcome</h1>
          <p>This is a <strong>loan</strong> site.</p>
          <img src="/logo.png" alt="Logo" />
          <script src="/app.js"></script>
        </body>
      </html>
    `;
    const result = replaceLeakedExpressions(html, ENV_VARS);
    expect(result).toContain(`<meta charset="utf-8" />`);
    expect(result).toContain(`<link rel="stylesheet" href="/styles.css" />`);
    expect(result).toContain(`<h1>Welcome</h1>`);
    expect(result).toContain(`<img src="/logo.png" alt="Logo" />`);
    expect(result).toContain(`<script src="/app.js"></script>`);
  });

  // Test 6: Returns empty string if env var missing
  it('should return empty string if env var missing', () => {
    const html = `
      <script>
        const missing = import.meta.env.PUBLIC_MISSING || "default";
        const noFallback = import.meta.env.PUBLIC_NOTFOUND;
      </script>
    `;
    const result = replaceLeakedExpressions(html, ENV_VARS);
    expect(result).toContain(`const missing = "default";`);
    expect(result).toContain(`const noFallback = '';`);
  });

  // Test 7: Handles newlines in values
  it('should escape newlines in env var values', () => {
    const html = `<script>const text = import.meta.env.PUBLIC_TEXT;</script>`;
    const envWithNewline = { PUBLIC_TEXT: 'Line 1\nLine 2' };
    const result = replaceLeakedExpressions(html, envWithNewline);
    expect(result).toContain(`const text = 'Line 1\\nLine 2';`);
  });

  // Test 8: Handles template literal with fallback
  it('should handle template literal with fallback pattern', () => {
    const html = `<script>const url = \`${import.meta.env.PUBLIC_DOMAIN || 'example.com'}/page\`;</script>`;
    const result = replaceLeakedExpressions(html, ENV_VARS);
    expect(result).toContain(`const url = \`example.com/page\`;`);
  });

  // Test 9: Handles values with backticks
  it('should handle env values with backticks', () => {
    const html = `<script>const x = import.meta.env.PUBLIC_TEMPLATE;</script>`;
    const envWithBacktick = { PUBLIC_TEMPLATE: '`template`' };
    const result = replaceLeakedExpressions(html, envWithBacktick);
    expect(result).toContain(`const x = '\`template\`';`);
  });

  // Test 10: Preserves script tag structure
  it('should preserve script tag structure', () => {
    const html = `
      <script type="module">
        console.log(import.meta.env.PUBLIC_SITE_NAME);
      </script>
      <script>
        var x = import.meta.env.PUBLIC_CONVERSION_ID || "0";
      </script>
    `;
    const result = replaceLeakedExpressions(html, ENV_VARS);
    expect(result).toContain(`<script type="module">`);
    expect(result).toContain(`console.log('LoanCorp');`);
    expect(result).toContain(`<script>`);
    expect(result).toContain(`var x = "abc123xyz";`);
    expect(result).toContain(`</script>`);
  });

  // Test 11: Handles single quotes around fallback
  it('should handle single quotes in fallback', () => {
    const html = `<script>const name = import.meta.env.PUBLIC_SITE_NAME || 'Default';</script>`;
    const result = replaceLeakedExpressions(html, ENV_VARS);
    expect(result).toContain(`const name = 'LoanCorp';`);
  });

  // Test 12: Returns empty string for invalid input
  it('should return empty string for null/undefined input', () => {
    expect(replaceLeakedExpressions(null, ENV_VARS)).toBe('');
    expect(replaceLeakedExpressions(undefined, ENV_VARS)).toBe('');
  });

  // Test 13: Complex real-world scenario
  it('should handle complex real-world HTML with multiple env vars', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>import.meta.env.PUBLIC_SITE_NAME || "Default"</title>
          <script>
            window.config = {
              siteName: import.meta.env.PUBLIC_SITE_NAME,
              conversionId: import.meta.env.PUBLIC_CONVERSION_ID || "0",
              trackingUrl: "https://" + import.meta.env.PUBLIC_TRACKING_DOMAIN
            };
          </script>
        </head>
        <body>
          <h1>Welcome to import.meta.env.PUBLIC_SITE_NAME</h1>
          <img src="https://import.meta.env.PUBLIC_TRACKING_DOMAIN/track.gif" width="1" height="1" />
        </body>
      </html>
    `;
    const result = replaceLeakedExpressions(html, ENV_VARS);
    expect(result).toContain(`<title>"LoanCorp"</title>`);
    expect(result).toContain(`siteName: 'LoanCorp',`);
    expect(result).toContain(`conversionId: "abc123xyz",`);
    expect(result).toContain(`trackingUrl: "https://" + 'track.loancorp.com'`);
    expect(result).toContain(`<h1>Welcome to 'LoanCorp'</h1>`);
    expect(result).not.toContain('import.meta.env');
  });

  // Test 14: Handles mixed quote types
  it('should handle mixed quote types in same HTML', () => {
    const html = `
      <script>
        var a = import.meta.env.PUBLIC_SITE_NAME || "double";
        var b = import.meta.env.PUBLIC_SITE_NAME || 'single';
        var c = import.meta.env.PUBLIC_SITE_NAME || \`backtick\`;
        var d = import.meta.env.PUBLIC_SITE_NAME;
      </script>
    `;
    const result = replaceLeakedExpressions(html, ENV_VARS);
    expect(result).toContain(`var a = "LoanCorp";`);
    expect(result).toContain(`var b = 'LoanCorp';`);
    expect(result).toContain(`var c = \`LoanCorp\`;`);
    expect(result).toContain(`var d = 'LoanCorp';`);
    expect(result).not.toContain('import.meta.env');
  });

  // Test 15: Handles HTML entities and special content
  it('should preserve HTML entities and special content', () => {
    const html = `
      <html>
        <head>
          <meta name="description" content="&copy; 2024 import.meta.env.PUBLIC_SITE_NAME || &quot;Company&quot;" />
        </head>
        <body>
          <p>Cost: &#36;100 for import.meta.env.PUBLIC_SITE_NAME</p>
        </body>
      </html>
    `;
    const result = replaceLeakedExpressions(html, ENV_VARS);
    expect(result).toContain(`&copy; 2024`);
    expect(result).toContain(`&quot;`);
    expect(result).toContain(`&#36;`);
  });
});
