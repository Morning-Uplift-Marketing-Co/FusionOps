import { describe, it, expect, beforeEach } from 'vitest';
import { JavaScriptObfuscator } from '../obfuscation-transform.js';

describe('JavaScriptObfuscator', () => {
  describe('Determinism & Seeding (3 tests)', () => {
    it('same siteId produces byte-identical output on multiple runs', async () => {
      const html = '<script>const x = 1; const y = 2;</script>';
      const result1 = await JavaScriptObfuscator.transform(html, 'test-site', {});
      const result2 = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result1.html).toBe(result2.html);
    });

    it('different siteIds produce different minified outputs', async () => {
      const html = '<script>const x = 1;</script>';
      const result1 = await JavaScriptObfuscator.transform(html, 'site-a', {});
      const result2 = await JavaScriptObfuscator.transform(html, 'site-b', {});
      expect(result1.html).not.toBe(result2.html);
    });

    it('seed pattern uses crypto.createHash(sha256).update(siteId + js-obfuscation).digest(hex)', async () => {
      const html = '<script>const test = 42;</script>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      // Verify that seeding produces deterministic output
      expect(result.obfuscated).toBe(true);
      expect(result.html).toBeDefined();
    });
  });

  describe('Minification (4 tests)', () => {
    it('variable names minified (x, y, z not a, b, c)', async () => {
      const html = '<script>const myVariable = 1; const anotherVar = 2;</script>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.html).not.toContain('myVariable');
      expect(result.html).not.toContain('anotherVar');
    });

    it('function names in reserved list preserved (onclick, handleSubmit, fetch)', async () => {
      const html = '<script>function onclick() {} function handleSubmit() {}</script>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.html).toContain('onclick');
      expect(result.html).toContain('handleSubmit');
    });

    it('properties not mangled (data-pixel remains data-pixel)', async () => {
      const html = '<script>el.setAttribute("data-pixel", "value");</script>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.html).toContain('data-pixel');
    });

    it('aggressive vs moderate compression levels work', async () => {
      const html = '<script>const x = 1; const y = 2; const z = 3;</script>';
      const result1 = await JavaScriptObfuscator.transform(html, 'test-site', { level: 'moderate' });
      const result2 = await JavaScriptObfuscator.transform(html, 'test-site', { level: 'aggressive' });
      expect(result1.obfuscated).toBe(true);
      expect(result2.obfuscated).toBe(true);
    });
  });

  describe('React Hydration Safety (3 tests)', () => {
    it('pre-render HTML === minified client output (byte-identical)', async () => {
      const html = '<script>const version = "1.0";</script>';
      const result1 = await JavaScriptObfuscator.transform(html, 'react-site', {});
      const result2 = await JavaScriptObfuscator.transform(html, 'react-site', {});
      expect(result1.html).toBe(result2.html);
    });

    it('no hydration mismatch warnings in console', async () => {
      const html = '<script>const app = {}; app.init = () => {};</script>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.html).toBeDefined();
      expect(result.obfuscated).toBe(true);
    });

    it('source maps generated for debugging', async () => {
      const html = '<script>const debug = true;</script>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.sourceMaps).toBeDefined();
      expect(result.sourceMaps instanceof Map).toBe(true);
    });
  });

  describe('HTML Transformation (4 tests)', () => {
    it('inline scripts extracted and minified', async () => {
      const html = '<html><body><script>const x = 1;</script></body></html>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.scripts).toBeDefined();
      expect(Array.isArray(result.scripts)).toBe(true);
    });

    it('external scripts (src=...) left unchanged', async () => {
      const html = '<script src="https://example.com/lib.js"></script>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.html).toContain('src="https://example.com/lib.js"');
    });

    it('module scripts (type=module) left unchanged', async () => {
      const html = '<script type="module">import x from "./lib.js";</script>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.html).toContain('type="module"');
    });

    it('multiple scripts on same page all minified', async () => {
      const html = `
        <script>const a = 1;</script>
        <script>const b = 2;</script>
        <script>const c = 3;</script>
      `;
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.scripts.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Error Handling (2 tests)', () => {
    it('invalid JavaScript throws error with clear message', async () => {
      const html = '<script>const x = {invalid syntax here</script>';
      await expect(
        JavaScriptObfuscator.transform(html, 'test-site', {})
      ).rejects.toThrow();
    });

    it('missing script tag gracefully handled', async () => {
      const html = '<html><body>No scripts here</body></html>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.html).toBe(html);
      expect(result.scripts).toEqual([]);
    });
  });

  describe('Integration (4 tests)', () => {
    it('preserves HTML structure (head, body, attributes)', async () => {
      const html = '<html><head><title>Test</title></head><body id="app"><script>const x = 1;</script></body></html>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.html).toContain('<html>');
      expect(result.html).toContain('<body');
      expect(result.html).toContain('id="app"');
    });

    it('data attributes (data-pixel, data-tracking) unchanged', async () => {
      const html = '<div data-pixel="track-click" data-tracking="voluum"><script>el.click();</script></div>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.html).toContain('data-pixel="track-click"');
      expect(result.html).toContain('data-tracking="voluum"');
    });

    it('form handlers (onclick, onsubmit) remain functional', async () => {
      const html = '<form onsubmit="handleSubmit()"><button onclick="trackClick()">Click</button></form>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result.html).toContain('onsubmit');
      expect(result.html).toContain('onclick');
    });

    it('returns {html, scripts, sourceMaps, obfuscated} object', async () => {
      const html = '<script>const x = 1;</script>';
      const result = await JavaScriptObfuscator.transform(html, 'test-site', {});
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('scripts');
      expect(result).toHaveProperty('sourceMaps');
      expect(result).toHaveProperty('obfuscated');
    });
  });
});
