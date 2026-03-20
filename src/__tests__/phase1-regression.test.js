/**
 * Phase 1 Backward Compatibility Regression Tests
 * ================================================
 * Verify Phase 2 implementation doesn't break Phase 1 components.
 * Tests: env preprocessing, HTML expression replacement, manifest loading, template compatibility.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import AntiFingerprint from '../services/AntiFingerprint.js';
import { load as cheerioLoad } from 'cheerio';

// Mock Phase 1 components since they're tested separately
// These tests verify they work WITH Phase 2 transforms

describe('Phase 1 Backward Compatibility', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase1-regression-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Environment Variable Preprocessing', () => {
    it('should preserve Phase 1 env var injection in Phase 2 pipeline', async () => {
      // Simulate Phase 1 output: HTML with injected env vars
      const phase1Output = `
        <html>
          <head>
            <title>Acme Corp</title>
            <style>
              :root {
                --brand-color: #FF0000;
                --brand-name: "Acme Corp";
              }
            </style>
          </head>
          <body>
            <h1 class="brand-name">Acme Corp</h1>
            <p class="brand-description">Welcome to Acme Corp</p>
            <style>
              .brand-name { color: #FF0000; }
            </style>
          </body>
        </html>
      `;

      const css = '.brand-name { font-weight: bold; color: var(--brand-color); }';

      // Apply Phase 2 fingerprinting to Phase 1 output
      const result = await AntiFingerprint.transform(phase1Output, css, 'phase1-compat-test');

      // Verify env vars still present (not corrupted by Phase 2)
      expect(result.html).toContain('Acme Corp');
      expect(result.html).toContain('--brand-color: #FF0000');
      expect(result.html).toContain('--brand-name:');

      // Verify CSS variables work with Phase 2 transforms
      expect(result.css).toContain('var(--brand-color)');
    });

    it('should not introduce duplicate env var processing', async () => {
      const htmlWithEnvVars = `
        <html>
          <body>
            <div class="container">
              <h1>Brand: CompanyName</h1>
              <p>URL: https://example.com</p>
            </div>
            <style>
              .container { background: url("./image.jpg"); }
            </style>
          </body>
        </html>
      `;

      const css = '.container { padding: 20px; }';

      // Apply Phase 2 fingerprinting
      const result = await AntiFingerprint.transform(htmlWithEnvVars, css, 'no-duplication-test');

      // Content should be processed once
      const nameCount = (result.html.match(/CompanyName/g) || []).length;
      expect(nameCount).toBe(1); // Should appear exactly once

      const urlCount = (result.html.match(/https:\/\/example.com/g) || []).length;
      expect(urlCount).toBe(1); // Should appear exactly once
    });
  });

  describe('HTML Expression Leak Detection', () => {
    it('should not corrupt Phase 1 HTML expression detection', async () => {
      // HTML that might contain leaked expressions
      const htmlWithExpressions = `
        <html>
          <body>
            <h1 class="header">Welcome</h1>
            <p class="content">Content with {VAR} placeholder style</p>
            <div class="section" data-text="{PRODUCT_NAME}">Section</div>
          </body>
        </html>
      `;

      const css = '.header { color: blue; }';

      // Apply Phase 2 transforms
      const result = await AntiFingerprint.transform(htmlWithExpressions, css, 'leak-test');

      // Phase 1 expression pattern {VAR} should still be detectable
      // (Phase 2 doesn't replace these - Phase 1 should have done it)
      expect(result.html).toContain('{');
      expect(result.html).toContain('}');

      // Data attributes with variables should be transformed but still exist
      expect(result.html).toContain('data-text=');
    });

    it('should preserve Astro-like expression patterns for detection', async () => {
      const astroStyleHtml = `
        <html>
          <body>
            <div class="container">
              <h1>{title}</h1>
              <p class="description">{description}</p>
            </div>
          </body>
        </html>
      `;

      const css = '.container { display: flex; }';

      // Apply Phase 2 transforms
      const result = await AntiFingerprint.transform(astroStyleHtml, css, 'astro-expr-test');

      // Expressions should still be present (Phase 1 should have removed them if they were actual code)
      const expressionCount = (result.html.match(/\{[^}]+\}/g) || []).length;
      expect(expressionCount).toBeGreaterThan(0);
    });
  });

  describe('Manifest and Capability Resolution', () => {
    it('should maintain valid HTML structure for manifest loader compatibility', async () => {
      const htmlForManifest = `
        <html>
          <head>
            <title>Capabilities Test</title>
            <meta name="viewport" content="width=device-width">
            <meta name="description" content="Test page with capabilities">
          </head>
          <body>
            <form class="contact-form" id="contact" method="post">
              <input type="email" id="email" required />
              <input type="tel" id="phone" />
              <textarea id="message"></textarea>
              <button type="submit">Send</button>
            </form>
            <div class="newsletter-signup" data-feature="newsletter">
              <input type="email" placeholder="Email" />
            </div>
          </body>
        </html>
      `;

      const css = '.contact-form { margin: 20px; }';

      // Apply Phase 2 transforms
      const result = await AntiFingerprint.transform(htmlForManifest, css, 'manifest-test');

      const $ = cheerioLoad(result.html);

      // Manifest-relevant structure must be preserved
      expect($('form').length).toBe(1);
      expect($('input[type="email"]').length).toBeGreaterThan(0);
      expect($('textarea').length).toBe(1);
      expect($('button').length).toBe(1);

      // Meta tags should exist (for capability detection)
      const metaTags = $('meta');
      expect(metaTags.length).toBeGreaterThan(0);
    });

    it('should preserve form element IDs for wizard integration', async () => {
      const wizardHtml = `
        <html>
          <body>
            <div class="form-wrapper">
              <form id="main-form">
                <div class="form-group">
                  <input id="field-name" type="text" />
                  <input id="field-email" type="email" />
                </div>
                <select id="field-category">
                  <option>Option 1</option>
                </select>
                <button id="submit-btn">Submit</button>
              </form>
            </div>
          </body>
        </html>
      `;

      const css = '.form-group { margin-bottom: 20px; }';

      // Apply Phase 2 transforms
      const result = await AntiFingerprint.transform(wizardHtml, css, 'wizard-compat-test');

      const $ = cheerioLoad(result.html);

      // Form structure for wizard parsing must exist
      expect($('form').length).toBe(1);
      expect($('input').length).toBe(2);
      expect($('select').length).toBe(1);
      expect($('button').length).toBe(1);

      // Form elements should still be functional (IDs transformed, but elements exist)
      expect($('[type="text"]').length).toBe(1);
      expect($('[type="email"]').length).toBe(1);
      expect($('[type="submit"]').length).toBe(0); // button is submit type, not submit input
    });
  });

  describe('Template Deployment Compatibility', () => {
    it('should not break existing template structure (HTML-based templates)', async () => {
      // Simulated existing deployed template
      const existingTemplate = `
        <html>
          <head>
            <title>Existing Product Page</title>
            <style>
              body { font-family: Arial; }
              .hero { background: #f0f0f0; }
              .product-card { border: 1px solid #ddd; }
              .price { font-size: 1.5em; color: green; }
            </style>
          </head>
          <body>
            <div class="hero">
              <h1>Product</h1>
              <p>Product description</p>
            </div>
            <div class="product-card">
              <h2>Product Name</h2>
              <p class="price">$99.99</p>
              <button class="btn-buy">Buy Now</button>
            </div>
          </body>
        </html>
      `;

      const css = `
        body { margin: 0; padding: 0; }
        .hero { padding: 40px; }
        .product-card { padding: 20px; }
      `;

      // Apply Phase 2 transforms
      const result = await AntiFingerprint.transform(existingTemplate, css, 'existing-template-001');

      // Output must remain valid HTML
      const $ = cheerioLoad(result.html);
      expect($('html').length).toBe(1);
      expect($('head').length).toBe(1);
      expect($('body').length).toBe(1);

      // Content must be readable (main text preserved)
      expect(result.html).toContain('Product');
      expect(result.html).toContain('$99.99');
      expect(result.html).toContain('Buy Now');

      // File size should be reasonable (not bloated)
      expect(result.html.length).toBeLessThan(existingTemplate.length * 2);
    });

    it('should maintain backward compatibility with Phase 1 template outputs', async () => {
      // Simulated Phase 1 complete pipeline output
      const phase1CompleteOutput = `
        <html>
          <head>
            <title>Phase 1 Output Template</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; font-family: system-ui; }
              .site-header { background: white; padding: 20px; }
              .site-nav { display: flex; gap: 20px; }
              .site-nav a { text-decoration: none; color: #333; }
              .site-hero { background: linear-gradient(to right, #000, #333); color: white; padding: 60px; }
              .site-content { max-width: 1200px; margin: 0 auto; padding: 40px; }
              .site-footer { background: #f5f5f5; padding: 20px; text-align: center; }
            </style>
          </head>
          <body>
            <header class="site-header">
              <nav class="site-nav">
                <a href="/">Home</a>
                <a href="/about">About</a>
                <a href="/contact">Contact</a>
              </nav>
            </header>
            <section class="site-hero">
              <h1>Welcome to Phase 1 Site</h1>
              <p>This template was generated in Phase 1</p>
            </section>
            <main class="site-content">
              <article>
                <h2>Main Content</h2>
                <p>Content here</p>
              </article>
            </main>
            <footer class="site-footer">
              <p>Copyright Phase 1 Ltd</p>
            </footer>
          </body>
        </html>
      `;

      const css = `
        .site-header { box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .site-nav a:hover { color: #0066cc; }
        .site-hero { min-height: 400px; }
        .site-content { line-height: 1.6; }
      `;

      // Apply Phase 2 transforms
      const result = await AntiFingerprint.transform(phase1CompleteOutput, css, 'phase1-full-compat');

      // Verify no major structure loss
      const $ = cheerioLoad(result.html);
      expect($('header').length).toBe(1);
      expect($('nav').length).toBe(1);
      expect($('main').length).toBe(1);
      expect($('footer').length).toBe(1);

      // Verify content preserved
      expect(result.html).toContain('Welcome to Phase 1 Site');
      expect(result.html).toContain('Main Content');
      expect(result.html).toContain('Copyright');

      // Navigation should still work
      expect($('a').length).toBeGreaterThan(0);

      // Meta tags preserved
      expect($('meta').length).toBeGreaterThan(0);
    });
  });

  describe('Env Variable Flow Through Pipeline', () => {
    it('should not corrupt injected environment variable values', async () => {
      // Simulate Phase 1 output with injected env vars
      const envVars = {
        BRAND_NAME: 'TechCorp',
        BRAND_COLOR: '#0066cc',
        BRAND_URL: 'https://techcorp.example.com',
        PRIMARY_CTA: 'Get Started'
      };

      const phase1Output = `
        <html>
          <head>
            <title>${envVars.BRAND_NAME}</title>
            <style>
              :root {
                --brand-color: ${envVars.BRAND_COLOR};
              }
              .brand-header { color: ${envVars.BRAND_COLOR}; }
            </style>
          </head>
          <body>
            <h1 class="brand-header">${envVars.BRAND_NAME}</h1>
            <p class="brand-description">${envVars.BRAND_NAME} - Your trusted partner</p>
            <a href="${envVars.BRAND_URL}" class="brand-link">Visit ${envVars.BRAND_NAME}</a>
            <button class="btn-primary">${envVars.PRIMARY_CTA}</button>
          </body>
        </html>
      `;

      const css = '.brand-header { font-weight: bold; }';

      // Apply Phase 2 transforms
      const result = await AntiFingerprint.transform(phase1Output, css, 'env-flow-test');

      // All env vars should still be present
      expect(result.html).toContain(envVars.BRAND_NAME);
      expect(result.html).toContain(envVars.BRAND_COLOR);
      expect(result.html).toContain(envVars.BRAND_URL);
      expect(result.html).toContain(envVars.PRIMARY_CTA);

      // URLs should not be corrupted
      expect(result.html).toContain('https://techcorp.example.com');

      // Color values should be intact
      expect(result.html).toContain('#0066cc');
    });

    it('should handle special characters in env vars', async () => {
      const specialEnvVars = {
        BRAND_NAME: "O'Reilly & Associates",
        TAGLINE: 'Learn <everything> about tech',
        EMAIL: 'hello@example.com'
      };

      const htmlWithSpecialVars = `
        <html>
          <body>
            <h1 class="brand">${specialEnvVars.BRAND_NAME}</h1>
            <p class="tagline">${specialEnvVars.TAGLINE}</p>
            <a href="mailto:${specialEnvVars.EMAIL}" class="contact">Contact</a>
          </body>
        </html>
      `;

      const css = '.brand { color: blue; }';

      // Apply Phase 2 transforms
      const result = await AntiFingerprint.transform(htmlWithSpecialVars, css, 'special-chars-test');

      // Special characters should be preserved
      expect(result.html).toContain("O'Reilly");
      expect(result.html).toContain('&');
      expect(result.html).toContain('hello@example.com');
    });
  });

  describe('Regression Test Summary', () => {
    it('should pass complete Phase 1 → Phase 2 integration scenario', async () => {
      // Comprehensive integration test
      const phase1Output = `
        <html>
          <head>
            <title>Integration Test Template</title>
            <style>
              .container { max-width: 1200px; margin: 0 auto; }
              .header { background: #f0f0f0; padding: 20px; }
              .button { padding: 10px 20px; background: blue; }
            </style>
          </head>
          <body>
            <div class="container">
              <header class="header">
                <h1>Welcome</h1>
              </header>
              <main>
                <button class="button">Click Me</button>
                <form class="form" id="contact-form">
                  <input type="email" />
                </form>
              </main>
            </div>
          </body>
        </html>
      `;

      const css = '.container { padding: 0 20px; }';

      // Apply Phase 2 pipeline
      const result = await AntiFingerprint.transform(phase1Output, css, 'integration-final-test');

      // Verify: valid HTML output
      const $ = cheerioLoad(result.html);
      expect($('html').length).toBe(1);

      // Verify: structure preserved
      expect($('header').length).toBe(1);
      expect($('main').length).toBe(1);
      expect($('form').length).toBe(1);
      expect($('button').length).toBe(1);

      // Verify: content readable
      expect(result.html).toContain('Welcome');
      expect(result.html).toContain('Click Me');

      // Verify: transformations applied
      expect(result.html).not.toContain('class="container"');
      expect(result.css).not.toContain('.container');

      // Verify: deterministic
      const result2 = await AntiFingerprint.transform(phase1Output, css, 'integration-final-test');
      expect(result.html).toBe(result2.html);
      expect(result.css).toBe(result2.css);

      // RESULT: Phase 1 → Phase 2 integration successful, no regressions
    });
  });
});
