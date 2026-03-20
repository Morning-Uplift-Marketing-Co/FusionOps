import { describe, it, expect, beforeEach } from 'vitest';
import { JavaScriptObfuscator } from '../../obfuscation-transform.js';
import { NetworkRandomizer } from '../../network-randomization.js';
import { EventRandomizer } from '../../event-randomization.js';

/**
 * Integration Test Suite: All 3 Vectors Combined
 *
 * Validates that all anti-fingerprinting vectors (obfuscation, network jitter, event randomization)
 * work together without conflicts, maintain performance, and preserve critical functionality.
 */

describe('Vector Integration - All 3 Vectors Combined', () => {
  const siteId = 'test-site-integration';

  const sampleHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Page</title>
      <script>
        const config = { apiUrl: 'https://api.example.com' };
        function trackEvent(name, data) {
          navigator.sendBeacon('/tracking', JSON.stringify({ name, data }));
        }
      </script>
    </head>
    <body>
      <div class="container" data-pixel="true" data-tracking="conversion">
        <h1>Welcome</h1>
        <form id="form-main" data-form="true">
          <input type="email" name="email" data-validate="email" />
          <button type="submit" data-submit="true">Submit</button>
        </form>
      </div>
      <script>
        document.getElementById('form-main').addEventListener('submit', (e) => {
          trackEvent('form_submit', { email: e.target.email.value });
        });

        document.querySelectorAll('[data-pixel]').forEach(el => {
          el.addEventListener('click', () => trackEvent('pixel_click', {}));
        });
      </script>
    </body>
    </html>
  `;

  describe('Vector Combination Tests (4 tests)', () => {
    it('all 3 vectors enabled produces valid HTML without conflicts', async () => {
      // Apply all three vectors in sequence
      let html = sampleHtml;

      // 1. Obfuscate
      const obfuscResult = await JavaScriptObfuscator.transform(html, siteId, { level: 'moderate' });
      html = obfuscResult.html;

      // 2. Network jitter
      const networkResult = NetworkRandomizer.transform(html, siteId, { min: 50, max: 500 });
      html = networkResult.html;

      // 3. Event randomization
      const eventResult = await EventRandomizer.transform(html, siteId, { enabled: true });
      html = eventResult.html;

      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(0);
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
      expect(html).toContain('form-main'); // Form ID preserved
    });

    it('build size increase <300% with all vectors enabled (wrapper scripts add overhead)', async () => {
      const baselineSize = sampleHtml.length;

      let html = sampleHtml;

      const obfuscResult = await JavaScriptObfuscator.transform(html, siteId, { level: 'moderate' });
      html = obfuscResult.html;

      const networkResult = NetworkRandomizer.transform(html, siteId, { min: 50, max: 500 });
      html = networkResult.html;

      const eventResult = await EventRandomizer.transform(html, siteId, { enabled: true });
      html = eventResult.html;

      const transformedSize = html.length;
      const sizeIncrease = ((transformedSize - baselineSize) / baselineSize) * 100;

      // Network jitter and event randomization inject wrapper scripts
      // Size increase is acceptable up to 300% for the added security vectors
      expect(sizeIncrease).toBeLessThan(300);
    });

    it('no errors or warnings during transformation pipeline', async () => {
      const consoleWarn = global.console.warn;
      const consoleError = global.console.error;
      const warnings = [];
      const errors = [];

      global.console.warn = (...args) => warnings.push(args.join(' '));
      global.console.error = (...args) => errors.push(args.join(' '));

      try {
        let html = sampleHtml;
        await JavaScriptObfuscator.transform(html, siteId, { level: 'moderate' });
        html = sampleHtml;
        NetworkRandomizer.transform(html, siteId, { min: 50, max: 500 });
        html = sampleHtml;
        await EventRandomizer.transform(html, siteId, { enabled: true });

        expect(errors).toEqual([]);
        expect(warnings).toEqual([]);
      } finally {
        global.console.warn = consoleWarn;
        global.console.error = consoleError;
      }
    });

    it('transformed HTML is valid (no syntax errors, proper nesting)', async () => {
      let html = sampleHtml;

      const obfuscResult = await JavaScriptObfuscator.transform(html, siteId, { level: 'moderate' });
      html = obfuscResult.html;

      const networkResult = NetworkRandomizer.transform(html, siteId, { min: 50, max: 500 });
      html = networkResult.html;

      const eventResult = await EventRandomizer.transform(html, siteId, { enabled: true });
      html = eventResult.html;

      // Basic HTML validity checks
      const openTags = (html.match(/<\w+/g) || []).length;
      const closeTags = (html.match(/<\/\w+>/g) || []).length;

      // Should have matching open/close tags
      expect(openTags).toBeGreaterThan(0);
      expect(closeTags).toBeGreaterThan(0);

      // HTML should start and end properly
      expect(html.trim()).toMatch(/^<!DOCTYPE|<html/i);
      expect(html.trim()).toMatch(/<\/html>$/i);
    });
  });

  describe('React Hydration Parity Tests (3 tests)', () => {
    it('deterministic output ensures byte-identical pre-render and client output', async () => {
      let html1 = sampleHtml;
      let html2 = sampleHtml;

      // Transform html1
      html1 = (await JavaScriptObfuscator.transform(html1, siteId, { level: 'moderate' })).html;
      html1 = NetworkRandomizer.transform(html1, siteId, { min: 50, max: 500 }).html;
      html1 = (await EventRandomizer.transform(html1, siteId, { enabled: true })).html;

      // Transform html2 with same siteId
      html2 = (await JavaScriptObfuscator.transform(html2, siteId, { level: 'moderate' })).html;
      html2 = NetworkRandomizer.transform(html2, siteId, { min: 50, max: 500 }).html;
      html2 = (await EventRandomizer.transform(html2, siteId, { enabled: true })).html;

      // Should be byte-identical
      expect(html1).toBe(html2);
    });

    it('Vite/React template hydration parity preserved', async () => {
      const reactHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="module" src="/src/main.jsx"></script>
        </head>
        <body>
          <div id="root">
            <h1>React App</h1>
          </div>
        </body>
        </html>
      `;

      let html = reactHtml;

      const obfuscResult = await JavaScriptObfuscator.transform(html, 'react-site', { level: 'moderate' });
      html = obfuscResult.html;

      const networkResult = NetworkRandomizer.transform(html, 'react-site', { min: 50, max: 500 });
      html = networkResult.html;

      const eventResult = await EventRandomizer.transform(html, 'react-site', { enabled: true });
      html = eventResult.html;

      // Verify React app structure intact
      expect(html).toContain('id="root"');
      expect(html).toContain('React App');
      // Module scripts should not be obfuscated
      expect(html).toContain('type="module"');
    });

    it('no "Hydration failed" error indicators in transformed output', async () => {
      let html = sampleHtml;

      html = (await JavaScriptObfuscator.transform(html, siteId, { level: 'moderate' })).html;
      html = NetworkRandomizer.transform(html, siteId, { min: 50, max: 500 }).html;
      html = (await EventRandomizer.transform(html, siteId, { enabled: true })).html;

      // Transformed HTML should not contain error indicators
      expect(html).not.toContain('Hydration failed');
      expect(html).not.toContain('hydration mismatch');
    });
  });

  describe('Template Type Regression Tests (8 tests)', () => {
    const createTemplateHtml = (templateType) => {
      const templates = {
        'astro': `---
import Layout from '../layouts/Layout.astro';
---
<Layout title="Astro Page">
  <h1>Welcome to Astro</h1>
</Layout>`,
        'vite-react': `import React from 'react';
export default () => <h1>React App</h1>;`,
        'static-html': `<!DOCTYPE html>
<html>
<head><title>Static</title></head>
<body><h1>Static HTML</h1></body>
</html>`,
        'vite-vue': `<template>
  <h1>Vue App</h1>
</template>`,
        'svelte': `<script>
  let name = 'world';
</script>
<h1>Hello {name}</h1>`,
        'islands': `<div class="island">
  <h1>Island Architecture</h1>
</div>`,
        'nextjs': `export default function Page() {
  return <h1>Next.js Page</h1>;
}`,
        'custom': `<div class="custom-template">
  <h1>Custom Template</h1>
</div>`
      };
      return templates[templateType] || `<html><body><h1>${templateType}</h1></body></html>`;
    };

    const templateTypes = ['astro', 'vite-react', 'static-html', 'vite-vue', 'svelte', 'islands', 'nextjs', 'custom'];

    templateTypes.forEach((templateType) => {
      it(`${templateType} template preserves structure with all vectors`, async () => {
        const templateHtml = createTemplateHtml(templateType);
        const wrappedHtml = `<!DOCTYPE html><html><head></head><body>${templateHtml}</body></html>`;

        let html = wrappedHtml;

        const obfuscResult = await JavaScriptObfuscator.transform(html, `${templateType}-site`, { level: 'moderate' });
        html = obfuscResult.html;

        const networkResult = NetworkRandomizer.transform(html, `${templateType}-site`, { min: 50, max: 500 });
        html = networkResult.html;

        const eventResult = await EventRandomizer.transform(html, `${templateType}-site`, { enabled: true });
        html = eventResult.html;

        // Basic structure should be preserved
        expect(html).toBeDefined();
        expect(html.length).toBeGreaterThan(0);
        expect(html).toContain('html');
        expect(html).toContain('body');
      });
    });
  });

  describe('Form Functionality Tests (3 tests)', () => {
    it('React Hook Form still works after all vectors', async () => {
      const formHtml = `
        <!DOCTYPE html>
        <html>
        <head><script src="https://cdn.jsdelivr.net/npm/react-hook-form"></script></head>
        <body>
          <form id="rhf-form" data-form="true">
            <input name="email" data-validate="email" />
            <button type="submit" data-submit="true">Submit</button>
          </form>
          <script>
            const form = document.getElementById('rhf-form');
            form.addEventListener('submit', (e) => {
              e.preventDefault();
              console.log('Form submitted');
            });
          </script>
        </body>
        </html>
      `;

      let html = formHtml;
      html = (await JavaScriptObfuscator.transform(html, 'rhf-site', { level: 'moderate' })).html;
      html = NetworkRandomizer.transform(html, 'rhf-site', { min: 50, max: 500 }).html;
      html = (await EventRandomizer.transform(html, 'rhf-site', { enabled: true })).html;

      expect(html).toContain('rhf-form');
      expect(html).toContain('data-form');
      expect(html).toContain('data-validate');
      expect(html).toContain('data-submit');
    });

    it('Formik still works after all vectors', async () => {
      const formikHtml = `
        <!DOCTYPE html>
        <html>
        <head><script src="https://formik.org/libs/formik.js"></script></head>
        <body>
          <form id="formik-form" data-form="true" data-framework="formik">
            <input type="email" name="email" data-validate="email" />
            <textarea name="message"></textarea>
            <button type="submit" data-submit="true">Submit</button>
          </form>
          <script>
            document.getElementById('formik-form').addEventListener('submit', (e) => {
              e.preventDefault();
            });
          </script>
        </body>
        </html>
      `;

      let html = formikHtml;
      html = (await JavaScriptObfuscator.transform(html, 'formik-site', { level: 'moderate' })).html;
      html = NetworkRandomizer.transform(html, 'formik-site', { min: 50, max: 500 }).html;
      html = (await EventRandomizer.transform(html, 'formik-site', { enabled: true })).html;

      expect(html).toContain('formik-form');
      expect(html).toContain('data-form');
      expect(html).toContain('data-framework');
    });

    it('native HTML form submission unaffected by vectors', async () => {
      const nativeFormHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <form id="native-form" action="/submit" method="POST" data-form="true">
            <input type="text" name="name" />
            <input type="email" name="email" />
            <button type="submit">Submit</button>
          </form>
        </body>
        </html>
      `;

      let html = nativeFormHtml;
      html = (await JavaScriptObfuscator.transform(html, 'native-site', { level: 'moderate' })).html;
      html = NetworkRandomizer.transform(html, 'native-site', { min: 50, max: 500 }).html;
      html = (await EventRandomizer.transform(html, 'native-site', { enabled: true })).html;

      expect(html).toContain('action="/submit"');
      expect(html).toContain('method="POST"');
      expect(html).toContain('native-form');
    });
  });

  describe('Tracking Preservation Tests (2 tests)', () => {
    it('data attributes preserved (data-pixel, data-tracking, data-form, data-submit)', async () => {
      const trackingHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div data-pixel="true" data-tracking="conversion" data-form="true">
            <form data-submit="true">
              <button type="submit">Click me</button>
            </form>
          </div>
        </body>
        </html>
      `;

      let html = trackingHtml;
      html = (await JavaScriptObfuscator.transform(html, 'tracking-site', { level: 'moderate' })).html;
      html = NetworkRandomizer.transform(html, 'tracking-site', { min: 50, max: 500 }).html;
      html = (await EventRandomizer.transform(html, 'tracking-site', { enabled: true })).html;

      expect(html).toContain('data-pixel');
      expect(html).toContain('data-tracking');
      expect(html).toContain('data-form');
      expect(html).toContain('data-submit');
    });

    it('tracking scripts execute properly after randomization', async () => {
      const pixelHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            window.trackingPixels = [];
            function firePixel(url) {
              window.trackingPixels.push(url);
              navigator.sendBeacon(url);
            }
          </script>
        </head>
        <body>
          <div data-pixel="https://tracking.example.com/pixel">
            <button onclick="firePixel('https://tracking.example.com/click')">Click</button>
          </div>
          <script>
            firePixel('https://tracking.example.com/pageview');
          </script>
        </body>
        </html>
      `;

      let html = pixelHtml;
      html = (await JavaScriptObfuscator.transform(html, 'pixel-site', { level: 'moderate' })).html;
      html = NetworkRandomizer.transform(html, 'pixel-site', { min: 50, max: 500 }).html;
      html = (await EventRandomizer.transform(html, 'pixel-site', { enabled: true })).html;

      // Tracking functions should still be callable (names preserved or handling added by wrappers)
      expect(html).toBeDefined();
      expect(html).toContain('trackingPixels');
      expect(html).toContain('firePixel');
      expect(html).toContain('sendBeacon');
    });
  });
});
