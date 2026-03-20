/**
 * Integration tests for env injection pipeline
 * Tests end-to-end flow: preprocess → build → replace leaked expressions → verify
 */

import { describe, it, expect } from 'vitest';
import { preprocessAstroEnvVars } from '../env-preprocessor.js';
import { replaceLeakedExpressions } from '../html-expression-replacer.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

/**
 * Simulates the build process by extracting script content from .astro
 * In reality, `astro build` would compile everything to HTML, but for testing
 * we focus on extracting the JavaScript code that contains env vars
 */
function mockAstroBuild(preprocessedFiles) {
  // Find the .astro entry point and extract the frontmatter (JavaScript code)
  let html = '<!DOCTYPE html>\n<html><head><title></title>\n<script>\n';

  for (const [path, content] of Object.entries(preprocessedFiles)) {
    if (path.endsWith('.astro')) {
      // Extract content between --- markers (the frontmatter)
      const parts = content.split('---');
      if (parts.length >= 2) {
        // Parts[1] is the frontmatter (JS code that gets executed)
        const frontmatter = parts[1];
        html += frontmatter + '\n';
      }
    }
  }

  html += '</script>\n</head><body></body></html>';
  return html;
}

// ─── Test Cases ──────────────────────────────────────────────────────────────

describe('env-injection integration', () => {
  // Case 1: Loan calculator template with brand and conversion ID
  it('should inject env vars in loan calculator template (Case 1)', () => {
    const loanTemplateFiles = {
      'src/pages/index.astro': '---\n' +
        'const brand = import.meta.env.PUBLIC_BRAND || "LoanCorp";\n' +
        'const conversionId = import.meta.env.PUBLIC_CONVERSION_ID || "0";\n' +
        'const minAmount = 5000;\n' +
        'const maxAmount = 50000;\n' +
        '---\n' +
        '<html>\n' +
        '<head>\n' +
        '  <title>{brand} - Personal Loans</title>\n' +
        '  <script>\n' +
        '    window.conversionId = import.meta.env.PUBLIC_CONVERSION_ID || "0";\n' +
        '    window.minLoan = 5000;\n' +
        '    window.maxLoan = 50000;\n' +
        '  </script>\n' +
        '</head>\n' +
        '<body>\n' +
        '  <h1>Welcome to {brand}</h1>\n' +
        '  <p>Apply for a loan from 5000 to 50000</p>\n' +
        '  <button onclick="submitLoan(window.conversionId)">Apply Now</button>\n' +
        '</body>\n' +
        '</html>',
      'package.json': JSON.stringify({ dependencies: { astro: '^5.0' } }),
    };

    const envVars = {
      PUBLIC_BRAND: 'FastLoan Inc',
      PUBLIC_CONVERSION_ID: 'conv_abc123_fast',
    };

    // Stage 1: Preprocess
    const preprocessed = preprocessAstroEnvVars(loanTemplateFiles, envVars);

    // Verify preprocessing worked
    expect(preprocessed['src/pages/index.astro']).toContain(`const brand = "FastLoan Inc";`);
    expect(preprocessed['src/pages/index.astro']).toContain(`const conversionId = "conv_abc123_fast";`);
    expect(preprocessed['src/pages/index.astro']).not.toContain('import.meta.env.PUBLIC_BRAND');

    // Stage 2: Mock build (converts .astro to HTML)
    const builtHtml = mockAstroBuild(preprocessed);

    // Stage 3: Replace any leaked expressions
    const finalHtml = replaceLeakedExpressions(builtHtml, envVars);

    // Verify final output
    expect(finalHtml).toContain('FastLoan Inc');
    expect(finalHtml).toContain('conv_abc123_fast');
    expect(finalHtml).not.toContain('import.meta.env');
  });

  // Case 2: Template with missing env var (fallback behavior)
  it('should use fallback when env var missing (Case 2)', () => {
    const templateFiles = {
      'src/pages/index.astro': `---
const brand = import.meta.env.PUBLIC_BRAND || "DefaultBrand";
const tracking = import.meta.env.PUBLIC_TRACKING_DOMAIN || "track.example.com";
---
<html>
<head>
  <title>{brand}</title>
  <img src="https://{tracking}/pixel.gif" width="1" height="1" />
</head>
</html>`,
      'package.json': JSON.stringify({ dependencies: { astro: '^5.0' } }),
    };

    // Only provide BRAND, not TRACKING_DOMAIN
    const envVars = {
      PUBLIC_BRAND: 'MyBrand',
    };

    // Preprocess
    const preprocessed = preprocessAstroEnvVars(templateFiles, envVars);

    // Verify fallbacks are used
    expect(preprocessed['src/pages/index.astro']).toContain(`const brand = "MyBrand";`);
    expect(preprocessed['src/pages/index.astro']).toContain(`const tracking = "track.example.com";`);

    // Build and replace
    const builtHtml = mockAstroBuild(preprocessed);
    const finalHtml = replaceLeakedExpressions(builtHtml, envVars);

    // Verify
    expect(finalHtml).toContain('MyBrand');
    expect(finalHtml).toContain('track.example.com');
    expect(finalHtml).not.toContain('import.meta.env');
  });

  // Case 3: Template with special characters in values
  it('should escape special characters in env values (Case 3)', () => {
    const templateFiles = {
      'src/pages/index.astro': '---\n' +
        'const companyName = import.meta.env.PUBLIC_COMPANY_NAME || "Company";\n' +
        'const tagline = import.meta.env.PUBLIC_TAGLINE || "Welcome";\n' +
        '---\n' +
        '<html>\n' +
        '<head>\n' +
        '  <title>{companyName}</title>\n' +
        '  <meta name="description" content="{tagline}" />\n' +
        '</head>\n' +
        '<body>\n' +
        '  <h1>{companyName}</h1>\n' +
        '</body>\n' +
        '</html>',
      'package.json': JSON.stringify({ dependencies: { astro: '^5.0' } }),
    };

    // Values with special characters
    const envVars = {
      PUBLIC_COMPANY_NAME: "O'Reilly's \"Loans\" Corp",
      PUBLIC_TAGLINE: "Get your loan\nnow!",
    };

    // Preprocess
    const preprocessed = preprocessAstroEnvVars(templateFiles, envVars);

    // Verify escaping - the function should escape these characters
    const astroContent = preprocessed['src/pages/index.astro'];
    expect(astroContent).toContain("O\\'Reilly\\'s \\\"Loans\\\" Corp");
    expect(astroContent).toContain("Get your loan\\n");

    // Build and replace
    const builtHtml = mockAstroBuild(preprocessed);
    const finalHtml = replaceLeakedExpressions(builtHtml, envVars);

    // Final HTML should have escaped values
    expect(finalHtml).not.toContain('import.meta.env');
  });

  // Case 4: Real-world loan template with multiple env vars
  it('should handle real-world loan template with all required vars (Case 4)', () => {
    const loanTemplate = {
      'src/pages/index.astro': '---\n' +
        'const siteConfig = {\n' +
        '  brand: import.meta.env.PUBLIC_BRAND || "LoanCorp",\n' +
        '  convId: import.meta.env.PUBLIC_CONVERSION_ID || "0",\n' +
        '  domain: import.meta.env.PUBLIC_TRACKING_DOMAIN || "track.local",\n' +
        '  loanMin: 1000,\n' +
        '  loanMax: 100000,\n' +
        '};\n' +
        '---\n' +
        '<html>\n' +
        '<head>\n' +
        '  <title>{siteConfig.brand} - Personal Loans</title>\n' +
        '  <script>\n' +
        '    window.config = {\n' +
        '      brand: import.meta.env.PUBLIC_BRAND || "LoanCorp",\n' +
        '      conversionId: import.meta.env.PUBLIC_CONVERSION_ID,\n' +
        '      trackingDomain: import.meta.env.PUBLIC_TRACKING_DOMAIN\n' +
        '    };\n' +
        '\n' +
        '    function trackConversion() {\n' +
        '      const pixel = new Image();\n' +
        '      pixel.src = "https://" + window.config.trackingDomain + "/pixel.gif?id=" + window.config.conversionId;\n' +
        '      document.body.appendChild(pixel);\n' +
        '    }\n' +
        '  </script>\n' +
        '</head>\n' +
        '<body>\n' +
        '  <h1>Welcome to {siteConfig.brand}</h1>\n' +
        '  <p>Borrow from 1000 to 100000</p>\n' +
        '  <form onsubmit="trackConversion()">\n' +
        '    <input type="range" min="1000" max="100000" />\n' +
        '    <button type="submit">Get Approved</button>\n' +
        '  </form>\n' +
        '</body>\n' +
        '</html>',
      'package.json': JSON.stringify({
        name: 'loan-template',
        dependencies: { astro: '^5.0' },
      }),
    };

    const realWorldEnv = {
      PUBLIC_BRAND: 'ScratchPay Easy',
      PUBLIC_CONVERSION_ID: 'gads_conversion_id_abc123xyz789',
      PUBLIC_TRACKING_DOMAIN: 'analytics.scratchpayeasy.com',
    };

    // Preprocess
    const preprocessed = preprocessAstroEnvVars(loanTemplate, realWorldEnv);

    // Verify all three vars replaced in both locations
    const astroContent = preprocessed['src/pages/index.astro'];
    const brandMatches = (astroContent.match(/"ScratchPay Easy"/g) || []).length;
    const convMatches = (astroContent.match(/"gads_conversion_id_abc123xyz789"/g) || []).length;
    const domainMatches = (astroContent.match(/"analytics\.scratchpayeasy\.com"/g) || []).length;

    expect(brandMatches).toBeGreaterThanOrEqual(2); // At least in config and in fallback
    expect(convMatches).toBeGreaterThanOrEqual(1);
    expect(domainMatches).toBeGreaterThanOrEqual(1);
    expect(astroContent).not.toContain('import.meta.env.PUBLIC_BRAND');
    expect(astroContent).not.toContain('import.meta.env.PUBLIC_CONVERSION_ID');
    expect(astroContent).not.toContain('import.meta.env.PUBLIC_TRACKING_DOMAIN');

    // Build and final replace
    const builtHtml = mockAstroBuild(preprocessed);
    const finalHtml = replaceLeakedExpressions(builtHtml, realWorldEnv);

    // Comprehensive verification
    expect(finalHtml).toContain('ScratchPay Easy');
    expect(finalHtml).toContain('gads_conversion_id_abc123xyz789');
    expect(finalHtml).toContain('analytics.scratchpayeasy.com');
    expect(finalHtml).not.toContain('import.meta.env');
  });

  // Case 5: Empty env vars object (all fallbacks used)
  it('should use fallbacks when env vars empty (Case 5)', () => {
    const templateFiles = {
      'src/pages/index.astro': `---
const brand = import.meta.env.PUBLIC_BRAND || "DefaultCorp";
const id = import.meta.env.PUBLIC_CONVERSION_ID || "none";
---
<h1>{brand}</h1>
<p>ID: {id}</p>`,
      'package.json': JSON.stringify({ dependencies: { astro: '^5.0' } }),
    };

    const emptyEnv = {};

    // Preprocess with empty env
    const preprocessed = preprocessAstroEnvVars(templateFiles, emptyEnv);

    // Verify fallbacks used
    expect(preprocessed['src/pages/index.astro']).toContain(`const brand = "DefaultCorp";`);
    expect(preprocessed['src/pages/index.astro']).toContain(`const id = "none";`);

    // Build and verify no env expressions remain
    const builtHtml = mockAstroBuild(preprocessed);
    const finalHtml = replaceLeakedExpressions(builtHtml, emptyEnv);

    expect(finalHtml).not.toContain('import.meta.env');
  });
});
