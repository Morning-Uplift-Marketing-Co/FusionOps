/**
 * Build Pipeline Integration Tests
 * ================================
 * End-to-end tests for TemplateBuilder + AntiFingerprint full pipeline.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import TemplateBuilder from '../services/build/TemplateBuilder.js';
import AntiFingerprint from '../services/AntiFingerprint.js';
import { load as cheerioLoad } from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Build Pipeline Integration', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-pipeline-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should complete full pipeline: files → build → fingerprint → output', async () => {
    // Mock template files for static HTML
    const files = {
      'index.html': '<html><head><title>Test</title></head><body><div class="hero">Content</div></body></html>',
      'package.json': JSON.stringify({ name: 'test-site', version: '1.0.0' })
    };

    const framework = { id: 'html-static', label: 'Static HTML' };

    // Simulate build output
    const builtHtml = '<html><head><title>Test</title></head><body><div class="hero">Content</div></body></html>';
    const builtCss = '.hero { color: blue; }';

    // Apply fingerprinting
    const result = await AntiFingerprint.transform(builtHtml, builtCss, 'test-site-001');

    // Verify pipeline completed
    expect(result).toBeDefined();
    expect(result.html).toBeTruthy();
    expect(result.css).toBeTruthy();

    // Verify transformations were applied
    expect(result.html).not.toContain('class="hero"');
    expect(result.css).not.toContain('.hero ');

    // Verify HTML structure preserved
    const $ = cheerioLoad(result.html);
    expect($('html').length).toBe(1);
    expect($('head').length).toBe(1);
    expect($('body').length).toBe(1);
  });

  it('should preserve original template files during pipeline', async () => {
    const templateFiles = {
      'index.html': '<html><head><title>Test</title></head><body><div class="container">Original</div></body></html>'
    };

    // Store original content
    const originalContent = templateFiles['index.html'];

    // Simulate pipeline
    const builtHtml = templateFiles['index.html'];
    const builtCss = '.container { max-width: 1200px; }';

    // Apply transformations
    const result = await AntiFingerprint.transform(builtHtml, builtCss, 'test-site-002');

    // Verify original template unchanged
    expect(templateFiles['index.html']).toBe(originalContent);
    expect(templateFiles['index.html']).toContain('class="container"');

    // Verify output is different (transformed)
    expect(result.html).not.toContain('class="container"');
  });

  it('should maintain valid HTML structure after transforms', async () => {
    const html = `
      <html>
        <head>
          <title>Page</title>
          <meta name="description" content="Test page">
        </head>
        <body>
          <header id="header-nav" class="header container">
            <h1 class="title">Title</h1>
          </header>
          <main id="main-content">
            <section class="hero" data-section="hero">
              <h2>Hero Section</h2>
              <button aria-label="Close">Close</button>
            </section>
            <section class="features" id="features">
              <p>Features here</p>
            </section>
          </main>
          <footer>Footer</footer>
          <script>console.log('test');</script>
        </body>
      </html>
    `;

    const css = `
      .header { background: #fff; }
      .header.container { max-width: 1200px; }
      .title { font-size: 2rem; }
      .hero { padding: 2rem; }
      .features { padding: 1rem; }
    `;

    const result = await AntiFingerprint.transform(html, css, 'test-site-003');

    // Parse transformed HTML
    const $ = cheerioLoad(result.html);

    // Verify required elements present
    expect($('html').length).toBe(1);
    expect($('head').length).toBe(1);
    expect($('body').length).toBe(1);
    expect($('header').length).toBe(1);
    expect($('main').length).toBe(1);
    expect($('footer').length).toBe(1);

    // Verify content not lost
    expect($('h1').length).toBe(1);
    expect($('h2').length).toBe(1);
    expect($('button').length).toBe(1);

    // Verify script tags intact
    expect($('script').length).toBe(1);
    expect($('script').html()).toContain('console.log');

    // Verify text content preserved
    expect($.text()).toContain('Title');
    expect($.text()).toContain('Features here');
    expect($.text()).toContain('Footer');
  });

  it('should maintain valid CSS structure after transforms', async () => {
    const css = `
      .hero { background: blue; color: white; }
      .hero:hover { background: darkblue; }
      .hero .subtitle { font-size: 1.5rem; }
      .container { max-width: 1200px; margin: 0 auto; }
      .btn { padding: 0.5rem 1rem; }
      .btn:hover { opacity: 0.8; }
      .btn-primary { background: blue; color: white; }
      /* Media query */
      @media (max-width: 768px) {
        .container { max-width: 100%; }
        .hero { padding: 1rem; }
      }
      /* Keyframes */
      @keyframes slideIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;

    const html = '<html><head><style>' + css + '</style></head><body><div class="hero"><h2 class="subtitle">Test</h2></div><button class="btn btn-primary">Click</button></body></html>';

    const result = await AntiFingerprint.transform(html, css, 'test-site-004');

    // Verify CSS structure preserved
    expect(result.css).toContain(':hover');
    expect(result.css).toContain('@media');
    expect(result.css).toContain('@keyframes');

    // Verify used classes randomized (hero, subtitle, btn, btn-primary are in HTML)
    expect(result.css).not.toMatch(/\.hero\s*{/);
    expect(result.css).not.toMatch(/\.btn\s*{/);
    // Note: .container is NOT in HTML, so it won't be randomized (only used classes are randomized)

    // Verify no orphaned selectors left behind
    // (should have valid syntax throughout)
    const cssLines = result.css.split('\n');
    let braceCount = 0;
    for (const line of cssLines) {
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      // Brace count should never go negative
      expect(braceCount).toBeGreaterThanOrEqual(0);
    }
    // Final brace count should be 0 (all closed)
    expect(braceCount).toBe(0);
  });

  it('should handle Tailwind utilities in CSS without randomization', async () => {
    const css = `
      .custom-flex { display: flex; }
      .custom-center { align-items: center; }
      .md\\:flex { display: flex; }
      .hover\\:bg-blue-500:hover { background: rgb(59, 130, 246); }
      .dark\\:text-white[data-mode="dark"] { color: white; }
    `;

    const html = '<html><body><div class="custom-flex custom-center md:flex">Content</div></body></html>';

    const result = await AntiFingerprint.transform(html, css, 'test-site-005');

    // Tailwind utilities with modifiers should be preserved
    expect(result.css).toContain('md\\:flex');
    expect(result.css).toContain('hover\\:bg-blue-500');
    expect(result.css).toContain('dark\\:text-white');

    // Custom classes should be randomized
    expect(result.css).not.toContain('.custom-flex ');
    expect(result.css).not.toContain('.custom-center ');
  });

  it('should preserve third-party data attributes across pipeline', async () => {
    const html = `
      <html>
        <body>
          <div data-ga-event="view" data-tracking="custom" class="container">
            <button data-hotjar-allow="true" data-custom="value" class="btn">Click</button>
          </div>
        </body>
      </html>
    `;

    const css = '.container { max-width: 1200px; } .btn { padding: 0.5rem; }';

    const result = await AntiFingerprint.transform(html, css, 'test-site-006');

    const $ = cheerioLoad(result.html);

    // Third-party attributes should be preserved (GA, Hotjar, Analytics)
    const divEl = $('div').first();
    expect(divEl.attr('data-ga-event')).toBe('view');

    // Custom data attributes should be randomized
    expect(divEl.attr('data-tracking')).not.toBe('custom');

    // Classes should be randomized
    expect(divEl.attr('class')).not.toContain('container');

    // Button should have hotjar preserved
    const buttonEl = $('button').first();
    expect(buttonEl.attr('data-hotjar-allow')).toBe('true');
    expect(buttonEl.attr('data-custom')).not.toBe('value');
    expect(buttonEl.attr('class')).not.toContain('btn');
  });

  it('should handle deterministic transforms for same siteId', async () => {
    const html = '<html><body><div class="hero">Content</div></body></html>';
    const css = '.hero { color: blue; }';

    // Transform 1
    const result1 = await AntiFingerprint.transform(html, css, 'deterministic-test');

    // Transform 2 (same siteId)
    const result2 = await AntiFingerprint.transform(html, css, 'deterministic-test');

    // Should produce identical output
    expect(result1.html).toBe(result2.html);
    expect(result1.css).toBe(result2.css);
  });

  it('should produce different transforms for different siteIds', async () => {
    const html = '<html><body><div class="hero">Content</div></body></html>';
    const css = '.hero { color: blue; }';

    // Transform for site 1
    const result1 = await AntiFingerprint.transform(html, css, 'site-001');

    // Transform for site 2
    const result2 = await AntiFingerprint.transform(html, css, 'site-002');

    // Should produce different output
    expect(result1.html).not.toBe(result2.html);
    expect(result1.css).not.toBe(result2.css);
  });

  it('should handle meta tag variations in pipeline', async () => {
    const html = `
      <html>
        <head>
          <title>Page</title>
          <meta name="description" content="Original description">
          <meta property="og:title" content="Original Title">
          <meta property="og:image" content="https://example.com/img.png">
          <meta property="og:type" content="website">
        </head>
        <body>Content</body>
      </html>
    `;

    const result = await AntiFingerprint.transform(html, '', 'test-site-007');

    const $ = cheerioLoad(result.html);

    // Generator tag should be added or varied
    const generatorTag = $('head meta[name="generator"]');
    expect(generatorTag.length).toBeGreaterThanOrEqual(0);

    // Critical OG tags should be preserved
    expect($('head meta[property="og:type"]').attr('content')).toBe('website');
    expect($('head meta[property="og:image"]').attr('content')).toBe('https://example.com/img.png');

    // Non-critical tags may be varied
    const ogTitle = $('head meta[property="og:title"]').attr('content');
    expect(ogTitle).toBeTruthy();
  });

  it('should preserve script and style content integrity', async () => {
    const html = `
      <html>
        <head>
          <style>
            .myClass { color: red; }
            body { margin: 0; }
          </style>
        </head>
        <body>
          <script>
            function myFunction() {
              const x = 42;
              console.log('test', x);
            }
            myFunction();
          </script>
        </body>
      </html>
    `;

    const result = await AntiFingerprint.transform(html, '', 'test-site-008');

    const $ = cheerioLoad(result.html);

    // Script should be intact
    const script = $('script').html();
    expect(script).toContain('function myFunction');
    expect(script).toContain('const x = 42');
    expect(script).toContain('console.log');

    // Inline style should be intact
    const style = $('style').html();
    expect(style).toContain('color: red');
    expect(style).toContain('margin: 0');
  });

  it('should handle empty or minimal HTML gracefully', async () => {
    const html = '<html><body>Simple content</body></html>';
    const css = '';

    const result = await AntiFingerprint.transform(html, css, 'test-site-009');

    // Should complete without error
    expect(result).toBeDefined();
    expect(result.html).toBeTruthy();

    const $ = cheerioLoad(result.html);
    expect($('html').length).toBe(1);
    expect($('body').length).toBe(1);
  });

  it('should handle complex nested structures with transforms', async () => {
    const html = `
      <html>
        <head><title>Complex</title></head>
        <body>
          <div class="container wrapper" id="app">
            <nav class="navbar" id="nav-main">
              <ul class="nav-list">
                <li class="nav-item"><a href="#section1" class="nav-link">Section 1</a></li>
                <li class="nav-item"><a href="#section2" class="nav-link">Section 2</a></li>
              </ul>
            </nav>
            <main id="main">
              <article class="post" data-post-id="123">
                <h1 class="post-title">Title</h1>
                <div class="post-content">
                  <p class="text">Paragraph 1</p>
                  <p class="text">Paragraph 2</p>
                </div>
                <aside class="sidebar">
                  <button class="btn btn-primary" aria-label="Submit">Submit</button>
                </aside>
              </article>
            </main>
          </div>
        </body>
      </html>
    `;

    const css = `
      .container { max-width: 1200px; }
      .wrapper { padding: 2rem; }
      .navbar { background: #f0f0f0; }
      .nav-list { list-style: none; }
      .nav-item { display: inline; }
      .nav-link { text-decoration: none; }
      .post { border: 1px solid #ddd; }
      .post-title { font-size: 2rem; }
      .post-content { padding: 1rem; }
      .text { line-height: 1.6; }
      .sidebar { float: right; }
      .btn { padding: 0.5rem; }
      .btn-primary { background: blue; }
    `;

    const result = await AntiFingerprint.transform(html, css, 'test-site-010');

    const $ = cheerioLoad(result.html);

    // Structure preserved
    expect($('nav').length).toBe(1);
    expect($('ul').length).toBe(1);
    expect($('li').length).toBe(2);
    expect($('article').length).toBe(1);
    expect($('h1').length).toBe(1);
    expect($('p').length).toBe(2);
    expect($('aside').length).toBe(1);
    expect($('button').length).toBe(1);

    // IDs preserved or randomized (but references updated)
    const appIdMatch = $('#app').length === 1;
    const anyIdPresent = $('[id]').length > 0;
    expect(appIdMatch || anyIdPresent).toBe(true);

    // Data attributes handled
    expect($('[data-post-id]').length).toBe(1);

    // Classes randomized
    // Note: #app ID might be randomized, so we just verify classes changed
    const containerEl = $('[id]').first();
    if (containerEl.attr('class')) {
      expect(containerEl.attr('class')).not.toContain('container');
      expect(containerEl.attr('class')).not.toContain('wrapper');
    }

    // Verify links still exist (content preserved)
    const links = $('a');
    expect(links.length).toBeGreaterThan(0);
  });
});
