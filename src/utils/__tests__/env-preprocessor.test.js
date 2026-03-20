/**
 * Tests for env-preprocessor.js
 * Tests: preprocessAstroEnvVars function
 */

import { describe, it, expect } from 'vitest';
import { preprocessAstroEnvVars } from '../env-preprocessor.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const ENV_VARS = {
  PUBLIC_BRAND: 'LoanCorp',
  PUBLIC_CONVERSION_ID: 'abc123xyz',
  PUBLIC_TRACKING_DOMAIN: 'track.loancorp.com',
};

// ─── Test Cases ──────────────────────────────────────────────────────────────

describe('preprocessAstroEnvVars', () => {
  // Test 1: Handles import.meta.env.PUBLIC_BRAND || "default"
  it('should replace import.meta.env.PUBLIC_VAR with fallback operator', () => {
    const files = {
      'src/pages/index.astro': `---
const brand = import.meta.env.PUBLIC_BRAND || "DefaultBrand";
---
<h1>{brand}</h1>`,
    };
    const result = preprocessAstroEnvVars(files, ENV_VARS);
    expect(result['src/pages/index.astro']).toContain(`const brand = "LoanCorp";`);
    expect(result['src/pages/index.astro']).not.toContain('import.meta.env');
  });

  // Test 2: Handles import.meta.env.PUBLIC_BRAND (no fallback)
  it('should replace import.meta.env.PUBLIC_VAR without fallback', () => {
    const files = {
      'src/pages/index.astro': `---
const site = import.meta.env.PUBLIC_BRAND;
---
<title>{site}</title>`,
    };
    const result = preprocessAstroEnvVars(files, ENV_VARS);
    expect(result['src/pages/index.astro']).toContain(`const site = 'LoanCorp';`);
    expect(result['src/pages/index.astro']).not.toContain('import.meta.env');
  });

  // Test 3: Escapes special characters in values (quotes, backslashes)
  it('should escape special characters in env var values', () => {
    const files = {
      'src/pages/index.astro': `---
const text = import.meta.env.PUBLIC_TEXT || "default";
---
<p>{text}</p>`,
    };
    const specialEnv = { PUBLIC_TEXT: `John's "Amazing" Loan Co\\` };
    const result = preprocessAstroEnvVars(files, specialEnv);
    expect(result['src/pages/index.astro']).toContain(`John\\'s \\"Amazing\\" Loan Co\\\\`);
  });

  // Test 4: Handles multiple replacements in same file
  it('should replace multiple env vars in same file', () => {
    const files = {
      'src/pages/index.astro': `---
const brand = import.meta.env.PUBLIC_BRAND || "Brand";
const convId = import.meta.env.PUBLIC_CONVERSION_ID;
const tracking = import.meta.env.PUBLIC_TRACKING_DOMAIN || "track.local";
---
<h1>{brand}</h1>
<img src="{tracking}/pixel.gif" />`,
    };
    const result = preprocessAstroEnvVars(files, ENV_VARS);
    const content = result['src/pages/index.astro'];
    expect(content).toContain(`const brand = "LoanCorp";`);
    expect(content).toContain(`const convId = 'abc123xyz';`);
    expect(content).toContain(`const tracking = "track.loancorp.com";`);
    expect(content).not.toContain('import.meta.env');
  });

  // Test 5: Does not modify non-.astro files
  it('should not modify non-.astro files', () => {
    const files = {
      'src/pages/index.astro': 'const x = import.meta.env.PUBLIC_BRAND;',
      'src/styles/global.css': '/* import.meta.env.PUBLIC_BRAND */',
      'package.json': JSON.stringify({ dependencies: { astro: '^5.0' } }),
    };
    const result = preprocessAstroEnvVars(files, ENV_VARS);
    expect(result['src/styles/global.css']).toBe('/* import.meta.env.PUBLIC_BRAND */');
    expect(result['package.json']).toBe(JSON.stringify({ dependencies: { astro: '^5.0' } }));
    expect(result['src/pages/index.astro']).not.toContain('import.meta.env');
  });

  // Test 6: Returns empty string if env var not in envVars object
  it('should return empty string if env var not found', () => {
    const files = {
      'src/pages/index.astro': `---
const missing = import.meta.env.PUBLIC_MISSING || "default";
const noFallback = import.meta.env.PUBLIC_NOTFOUND;
---`,
    };
    const result = preprocessAstroEnvVars(files, ENV_VARS);
    const content = result['src/pages/index.astro'];
    expect(content).toContain(`const missing = "default";`);
    expect(content).toContain(`const noFallback = '';`);
  });

  // Test 7: Handles single quotes
  it('should handle single quotes in fallback', () => {
    const files = {
      'src/pages/index.astro': `const x = import.meta.env.PUBLIC_BRAND || 'fallback';`,
    };
    const result = preprocessAstroEnvVars(files, ENV_VARS);
    expect(result['src/pages/index.astro']).toContain(`const x = 'LoanCorp';`);
  });

  // Test 8: Handles backticks
  it('should handle backticks in fallback', () => {
    const files = {
      'src/pages/index.astro': 'const x = import.meta.env.PUBLIC_BRAND || `fallback`;',
    };
    const result = preprocessAstroEnvVars(files, ENV_VARS);
    expect(result['src/pages/index.astro']).toContain(`const x = \`LoanCorp\`;`);
  });

  // Test 9: Handles newlines in values
  it('should escape newlines in env var values', () => {
    const files = {
      'src/pages/index.astro': `const text = import.meta.env.PUBLIC_TEXT;`,
    };
    const envWithNewline = { PUBLIC_TEXT: 'Line 1\nLine 2' };
    const result = preprocessAstroEnvVars(files, envWithNewline);
    expect(result['src/pages/index.astro']).toContain(`const text = 'Line 1\\nLine 2';`);
  });

  // Test 10: Returns empty object for invalid input
  it('should return empty object for null/undefined files', () => {
    expect(preprocessAstroEnvVars(null, ENV_VARS)).toEqual({});
    expect(preprocessAstroEnvVars(undefined, ENV_VARS)).toEqual({});
    expect(preprocessAstroEnvVars({}, null)).toEqual({});
  });

  // Test 11: Preserves non-env content
  it('should preserve all non-env content unchanged', () => {
    const files = {
      'src/pages/index.astro': `---
import Layout from '../layouts/Layout.astro';
const brand = import.meta.env.PUBLIC_BRAND || "Default";
export interface Props {
  title: string;
}
---
<Layout title={brand}>
  <h1>Content here</h1>
</Layout>`,
    };
    const result = preprocessAstroEnvVars(files, ENV_VARS);
    const content = result['src/pages/index.astro'];
    expect(content).toContain(`import Layout from '../layouts/Layout.astro';`);
    expect(content).toContain(`<h1>Content here</h1>`);
    expect(content).toContain(`export interface Props {`);
    expect(content).toContain(`const brand = "LoanCorp";`);
  });

  // Test 12: Handles multiple variables in template expressions
  it('should handle env vars in complex expressions', () => {
    const files = {
      'src/pages/index.astro': `---
const config = {
  brand: import.meta.env.PUBLIC_BRAND || "Default",
  tracking: import.meta.env.PUBLIC_TRACKING_DOMAIN,
  id: import.meta.env.PUBLIC_CONVERSION_ID || "0"
};
---`,
    };
    const result = preprocessAstroEnvVars(files, ENV_VARS);
    const content = result['src/pages/index.astro'];
    expect(content).toContain(`brand: "LoanCorp",`);
    expect(content).toContain(`tracking: 'track.loancorp.com',`);
    expect(content).toContain(`id: "abc123xyz"`);
    expect(content).not.toContain('import.meta.env');
  });
});
