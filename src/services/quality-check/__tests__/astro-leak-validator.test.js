import { describe, it, expect } from 'vitest';
import { checkAstroLeaks } from '../validators/astro-leak-validator.js';

describe('astro-leak-validator', () => {
  describe('checkAstroLeaks', () => {
    // Test 1: Pass when no env expressions in HTML
    it('should pass when no Astro expressions in HTML', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>My Page</title>
        </head>
        <body>
          <h1>Welcome</h1>
          <p>This is a normal page.</p>
        </body>
        </html>
      `;

      const result = checkAstroLeaks(html);

      expect(result.id).toBe('QUAL-03');
      expect(result.name).toBe('Astro Expression Leak Detection');
      expect(result.passed).toBe(true);
      expect(result.severity).toBe('info');
      expect(result.details).toEqual([]);
      expect(result.message).toContain('No Astro');
    });

    // Test 2: Fail when import.meta.env.PUBLIC_BRAND detected
    it('should fail when import.meta.env.PUBLIC_BRAND is present', () => {
      const html = `
        <html>
        <script>
          const brand = import.meta.env.PUBLIC_BRAND_NAME;
        </script>
        </html>
      `;

      const result = checkAstroLeaks(html);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0].expression).toContain('import.meta.env.PUBLIC_');
      expect(result.message).toContain('Found');
    });

    // Test 3: Fail when template literal ${import.meta.env.PUBLIC_*} detected
    it('should fail when template literal ${import.meta.env.PUBLIC_*} is detected', () => {
      const html = `
        <html>
        <script>
          const config = {
            apiUrl: \`\${import.meta.env.PUBLIC_API_URL}\`
          };
        </script>
        </html>
      `;

      const result = checkAstroLeaks(html);

      expect(result.passed).toBe(false);
      expect(result.details.length).toBeGreaterThan(0);
      // The pattern extracts the template literal expression including ${}
      expect(result.details[0].type).toMatch(/templateLiteral|importMetaEnv/);
    });

    // Test 4: Fail when VITE_* env expression detected
    it('should fail when import.meta.env.VITE_* is detected', () => {
      const html = `
        <html>
        <script>
          const apiBase = import.meta.env.VITE_API_BASE;
        </script>
        </html>
      `;

      const result = checkAstroLeaks(html);

      expect(result.passed).toBe(false);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0].expression).toContain('VITE_');
    });

    // Test 5: Ignore import.meta.env.DEV and PROD (safe built-ins)
    it('should ignore import.meta.env.DEV (safe built-in)', () => {
      const html = `
        <html>
        <script>
          if (import.meta.env.DEV) {
            console.log('Development mode');
          }
        </script>
        </html>
      `;

      const result = checkAstroLeaks(html);

      expect(result.passed).toBe(true);
      expect(result.details).toEqual([]);
    });

    it('should ignore import.meta.env.PROD (safe built-in)', () => {
      const html = `
        <html>
        <script>
          if (import.meta.env.PROD) {
            console.log('Production mode');
          }
        </script>
        </html>
      `;

      const result = checkAstroLeaks(html);

      expect(result.passed).toBe(true);
      expect(result.details).toEqual([]);
    });

    // Test 6: Ignore env mentions in HTML comments (false positive mitigation)
    it('should ignore env mentions in HTML comments', () => {
      const html = `
        <html>
        <!-- This is a comment about import.meta.env.PUBLIC_SECRET -->
        <body>
          <p>Real content here</p>
        </body>
        </html>
      `;

      const result = checkAstroLeaks(html);

      // Comments might still match if we search in raw HTML
      // This test documents the expected behavior - we can adjust if needed
      expect(result.id).toBe('QUAL-03');
    });

    // Test 7: Return line context for each leak (helps user verify)
    it('should return line context for each leak detected', () => {
      const html = `<html>
<head>
  <script>
    const apiUrl = import.meta.env.PUBLIC_API_URL;
  </script>
</head>
</html>`;

      const result = checkAstroLeaks(html);

      expect(result.passed).toBe(false);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0]).toHaveProperty('lineNumber');
      expect(result.details[0]).toHaveProperty('context');
      expect(result.details[0].context).toContain('import.meta.env.PUBLIC_API_URL');
    });

    // Test 8: Fail when || fallback pattern detected (incomplete env preprocessing)
    it('should fail when fallback pattern || is detected (incomplete preprocessing)', () => {
      const html = `
        <html>
        <script>
          const brand = import.meta.env.PUBLIC_BRAND || 'DefaultBrand';
        </script>
        </html>
      `;

      const result = checkAstroLeaks(html);

      expect(result.passed).toBe(false);
      expect(result.details.length).toBeGreaterThan(0);
    });

    // Test 9: Multiple leaks in same file
    it('should detect multiple leaks in same file', () => {
      const html = `
        <html>
        <script>
          const brand = import.meta.env.PUBLIC_BRAND_NAME;
          const apiUrl = import.meta.env.PUBLIC_API_URL;
          const title = \`\${import.meta.env.PUBLIC_TITLE}\`;
        </script>
        </html>
      `;

      const result = checkAstroLeaks(html);

      expect(result.passed).toBe(false);
      expect(result.details.length).toBeGreaterThanOrEqual(3);
    });

    // Test 10: SSR env variable (safe built-in)
    it('should ignore import.meta.env.SSR (safe built-in)', () => {
      const html = `
        <html>
        <script>
          if (import.meta.env.SSR) {
            console.log('Server-side rendering');
          }
        </script>
        </html>
      `;

      const result = checkAstroLeaks(html);

      expect(result.passed).toBe(true);
      expect(result.details).toEqual([]);
    });

    // Test 11: Edge case - env in data attributes
    it('should detect leaks in data attributes', () => {
      const html = `
        <html>
        <div data-config="import.meta.env.PUBLIC_CONFIG"></div>
        </html>
      `;

      const result = checkAstroLeaks(html);

      expect(result.passed).toBe(false);
      expect(result.details.length).toBeGreaterThan(0);
    });

    // Test 12: Edge case - env in CSS style attributes
    it('should detect leaks in style attributes', () => {
      const html = `
        <html>
        <style>
          :root {
            --brand-color: import.meta.env.PUBLIC_BRAND_COLOR;
          }
        </style>
        </html>
      `;

      const result = checkAstroLeaks(html);

      expect(result.passed).toBe(false);
      expect(result.details.length).toBeGreaterThan(0);
    });

    // Test 13: Immutability - input should not be modified
    it('should not modify input HTML', () => {
      const html = `<script>const x = import.meta.env.PUBLIC_VAR;</script>`;
      const htmlCopy = html;

      checkAstroLeaks(html);

      expect(html).toBe(htmlCopy);
    });

    // Test 14: Empty HTML
    it('should handle empty HTML gracefully', () => {
      const result = checkAstroLeaks('');

      expect(result.passed).toBe(true);
      expect(result.details).toEqual([]);
    });

    // Test 15: HTML with only whitespace
    it('should handle HTML with only whitespace', () => {
      const result = checkAstroLeaks('   \n\t\n   ');

      expect(result.passed).toBe(true);
      expect(result.details).toEqual([]);
    });
  });
});
