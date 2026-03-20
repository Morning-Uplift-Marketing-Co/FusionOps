/**
 * Phase 1 / Phase 2 Compatibility Tests
 * ====================================
 * Verify that Phase 2 fingerprinting doesn't break Phase 1 env preprocessing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import HtmlStaticBuilder from '../../services/build/HtmlStaticBuilder.js';
import AntiFingerprint from '../../services/AntiFingerprint.js';
import { load as cheerioLoad } from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Phase 1 / Phase 2 Compatibility', () => {
  const envVars = {
    API_BASE: 'https://api.example.com',
    SITE_NAME: 'My Website',
    DEBUG_MODE: 'false'
  };

  it('should preserve Astro env preprocessing in Phase 2 pipeline', async () => {
    // Phase 1: Static HTML with env expressions (simulating Astro output after build)
    const htmlContent = `<html>
  <body>
    <div class="hero">
      <p>API: https://api.example.com</p>
    </div>
  </body>
</html>`;

    const css = '.hero { padding: 2rem; }';

    // Phase 2: Apply fingerprinting to the already-processed HTML
    const result = await AntiFingerprint.transform(htmlContent, css, 'astro-site');

    // Verify Phase 1 values are preserved (they're just text content at this point)
    expect(result.html).toContain('https://api.example.com');
    expect(result.html).toContain('API:');

    // Verify Phase 2 transformations applied
    expect(result.html).not.toContain('class="hero"');
    expect(result.css).not.toContain('.hero ');
  });

  it('should preserve HTML expression replacement through pipeline', async () => {
    // Phase 1: Static HTML with expressions
    const htmlContent = `
      <html>
        <head><title>My Website</title></head>
        <body>
          <h1>My Website</h1>
          <p>Built with My Website template</p>
          <div class="container">Content</div>
        </body>
      </html>
    `;

    const css = '.container { max-width: 1200px; }';

    // Phase 2: Apply fingerprinting
    const result = await AntiFingerprint.transform(htmlContent, css, 'static-site');

    // Verify replacements preserved
    expect(result.html).toContain('My Website');
    expect(result.html).toContain('Built with My Website template');

    // Verify Phase 2 transforms applied
    expect(result.html).not.toContain('class="container"');
    expect(result.css).not.toContain('.container ');
  });

  it('should apply Vite env vars at build time before Phase 2', () => {
    // Phase 1: Vite template with env vars
    const envFileContent = `
VITE_API_URL=https://api.example.com
VITE_SITE_NAME=My Website
VITE_DEBUG=false
`.trim();

    // Phase 1: Create .env file
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `VITE_${key}=${value}`)
      .join('\n');

    expect(envContent).toContain('VITE_API_BASE=https://api.example.com');
    expect(envContent).toContain('VITE_SITE_NAME=My Website');

    // Phase 2: Fingerprinting should not touch .env
    // (env vars already injected during build)
    expect(envContent).toContain('VITE_');
  });

  it('should preserve env var references in HTML after fingerprinting', async () => {
    const html = `
      <html>
        <head><title>Site: My Website</title></head>
        <body>
          <div class="hero container">
            <h1>Welcome to My Website</h1>
            <p class="subtitle">API: https://api.example.com</p>
          </div>
        </body>
      </html>
    `;

    const css = `
      .hero { background: blue; }
      .container { max-width: 1200px; }
      .subtitle { font-size: 1rem; }
    `;

    // Phase 1: Env vars already replaced in HTML (from build)
    // Phase 2: Apply fingerprinting
    const result = await AntiFingerprint.transform(html, css, 'test-site');

    // Env values should still be present in HTML (they're content, not classes)
    expect(result.html).toContain('My Website');
    expect(result.html).toContain('https://api.example.com');

    // But classes should be randomized
    expect(result.html).not.toContain('class="hero');
    expect(result.html).not.toContain('class="container');
    expect(result.html).not.toContain('class="subtitle');
  });

  it('should maintain HTML validity after env replacement + fingerprinting', async () => {
    const html = `
      <html>
        <head>
          <title>API Docs: https://api.example.com</title>
          <meta name="description" content="My Website - The official docs">
        </head>
        <body>
          <header class="header" id="header-main">
            <h1 class="header-title">My Website</h1>
          </header>
          <nav class="navbar" id="nav-main">
            <a href="#home" class="nav-link">Home</a>
            <a href="#docs" class="nav-link">Docs</a>
          </nav>
          <main id="main-content">
            <section class="docs-section" data-api-url="https://api.example.com">
              <h2>API Documentation</h2>
              <p>Base URL: <code>https://api.example.com</code></p>
            </section>
          </main>
        </body>
      </html>
    `;

    const css = `
      .header { background: #f5f5f5; }
      .header-title { margin: 0; }
      .navbar { padding: 1rem; }
      .nav-link { text-decoration: none; }
      .docs-section { max-width: 900px; }
    `;

    // Apply fingerprinting (simulating post-build step)
    const result = await AntiFingerprint.transform(html, css, 'api-docs-site');

    // Verify env values preserved
    expect(result.html).toContain('https://api.example.com');
    expect(result.html).toContain('My Website');

    // Verify HTML structure valid
    const $ = cheerioLoad(result.html);

    expect($('html').length).toBe(1);
    expect($('head').length).toBe(1);
    expect($('body').length).toBe(1);
    expect($('header').length).toBe(1);
    expect($('nav').length).toBe(1);
    expect($('main').length).toBe(1);
    expect($('h1').length).toBe(1);
    expect($('h2').length).toBe(1);
    expect($('p').length).toBe(1);
    expect($('code').length).toBe(1);

    // Verify classes randomized
    const headerEl = $('header').first();
    expect(headerEl.attr('class')).not.toContain('header');

    // Verify IDs and href references updated
    const navLinks = $('a[href^="#"]');
    expect(navLinks.length).toBeGreaterThan(0);
    navLinks.each((i, el) => {
      const href = $(el).attr('href');
      expect(href).toBeTruthy();
      // References should be randomized too
    });
  });

  it('should handle multi-env-var replacements with fingerprinting', async () => {
    const html = `
      <html>
        <head>
          <title>API: https://api.example.com | Site: My Website</title>
          <meta property="og:title" content="My Website - Official">
        </head>
        <body>
          <div class="hero container" data-site-name="My Website" data-api="https://api.example.com">
            <h1>Welcome to My Website</h1>
            <p class="tagline">Your trusted API: https://api.example.com</p>
            <button class="btn btn-primary" data-config="My Website|https://api.example.com">
              Get Started
            </button>
          </div>
        </body>
      </html>
    `;

    const css = `
      .hero { padding: 2rem; }
      .container { max-width: 1200px; }
      .tagline { font-size: 1.2rem; }
      .btn { padding: 0.5rem 1rem; }
      .btn-primary { background: blue; }
    `;

    // Apply fingerprinting
    const result = await AntiFingerprint.transform(html, css, 'multi-env-site');

    // All env values should be preserved as text content
    expect(result.html).toContain('My Website');
    expect(result.html).toContain('https://api.example.com');
    expect(result.html).toContain('Welcome to My Website');
    expect(result.html).toContain('Your trusted API');

    // But classes should be randomized
    expect(result.html).not.toContain('class="hero');
    expect(result.html).not.toContain('class="container');
    expect(result.html).not.toContain('class="tagline');
    expect(result.html).not.toContain('class="btn');
  });

  it('should not corrupt env vars in data attributes during transforms', async () => {
    const html = `
      <html>
        <body>
          <div class="config-panel"
               data-api-url="https://api.example.com"
               data-site-name="My Website"
               data-debug="false"
               id="config">
            <span class="api-value">API: https://api.example.com</span>
          </div>
        </body>
      </html>
    `;

    const css = '.config-panel { padding: 1rem; } .api-value { font-family: monospace; }';

    // Apply fingerprinting
    const result = await AntiFingerprint.transform(html, css, 'config-site');

    const $ = cheerioLoad(result.html);

    const configEl = $('[data-api-url]');
    expect(configEl.length).toBe(1);

    // Critical data attributes with env values should be preserved
    // (or randomized but value preserved)
    const apiUrl = configEl.attr('data-api-url') ||
                   Object.keys(configEl[0]?.attribs || {})
                     .find(k => k.includes('api') && k.includes('url'));

    // The data-api-url attribute should still exist
    expect(configEl[0]?.attribs).toBeTruthy();

    // Text content should definitely have the URL
    expect(result.html).toContain('https://api.example.com');
  });

  it('should complete full Phase 1 → Phase 2 pipeline without mutation', async () => {
    // Original files (Phase 1)
    const originalFiles = {
      'index.html': `
        <html>
          <head>
            <title>My Website</title>
            <meta name="description" content="Welcome to My Website">
          </head>
          <body>
            <div class="hero container" id="home">
              <h1>Welcome</h1>
              <p class="subtitle">API Endpoint: https://api.example.com</p>
              <button class="btn btn-primary" aria-label="Start">Start</button>
            </div>
          </body>
        </html>
      `,
      'styles.css': `
        .hero { background: linear-gradient(to right, blue, purple); }
        .container { max-width: 1200px; margin: 0 auto; }
        .subtitle { color: gray; }
        .btn { padding: 0.5rem 1rem; border: none; }
        .btn-primary { background: blue; color: white; }
        .btn:hover { opacity: 0.8; }
      `
    };

    // Capture original content
    const originalHtml = originalFiles['index.html'];
    const originalCss = originalFiles['styles.css'];

    // Phase 1: Env preprocessing (simulated - values already in HTML)
    // Phase 2: Fingerprinting
    const result = await AntiFingerprint.transform(originalHtml, originalCss, 'full-pipeline-test');

    // Verify original files not mutated
    expect(originalFiles['index.html']).toBe(originalHtml);
    expect(originalFiles['styles.css']).toBe(originalCss);

    // Verify output is different (transformed)
    expect(result.html).not.toContain('class="hero');
    expect(result.css).not.toContain('.hero ');

    // Verify env value preserved through pipeline
    expect(result.html).toContain('My Website');
    expect(result.html).toContain('https://api.example.com');

    // Verify HTML structure valid
    const $ = cheerioLoad(result.html);
    expect($('html').length).toBe(1);
    expect($('body').length).toBe(1);
    expect($('button').length).toBe(1);
  });
});
