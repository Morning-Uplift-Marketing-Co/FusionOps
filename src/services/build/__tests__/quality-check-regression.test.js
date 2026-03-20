/**
 * Quality Check Regression Tests (Phase 1-2 Templates)
 * =====================================================
 * Verify Phase 3 quality gates don't break existing Phase 1-2 templates.
 * Tests: Template compatibility, validator accuracy, backward compatibility.
 */

import { describe, it, expect } from 'vitest';
import { QualityChecker } from '../../quality-check/QualityChecker.js';

/**
 * Sample templates simulating Phase 1-2 builds
 * Each template includes realistic HTML that would come from:
 * - Astro framework: with viewport, tracking, no leaks
 * - Vite/React framework: with viewport, Google Ads, no leaks
 * - Static HTML: with viewport, Voluum pixel
 */
const sampleTemplates = [
  {
    name: 'Astro template with viewport and Voluum pixel',
    html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Astro Landing Page</title>
    <meta name="description" content="Modern landing page">
  </head>
  <body>
    <header>
      <h1>Welcome to Astro</h1>
      <p>Build faster with less JavaScript</p>
    </header>
    <section>
      <button>Get Started</button>
    </section>
    <img src="https://example.com/vol_pixel.gif?token=xyz" alt="tracking" style="display:none;">
    <script>
      // Safe tracking code
      console.log('Page loaded');
    </script>
  </body>
</html>`,
    shouldPass: true,
    expectedCriticalFailures: 0,
    description: 'Valid Astro build with viewport and Voluum tracking'
  },

  {
    name: 'Vite/React template with Google Ads',
    html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>React SPA</title>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF456"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-ABC123DEF456');
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script src="/main.js"></script>
    <input type="hidden" name="gclid" value="">
  </body>
</html>`,
    shouldPass: true,
    expectedCriticalFailures: 0,
    description: 'Valid Vite/React build with viewport and Google Ads tracking'
  },

  {
    name: 'Static HTML with viewport meta',
    html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Static Landing Page</title>
    <style>
      body { font-family: Arial; margin: 0; }
      h1 { color: #333; }
    </style>
  </head>
  <body>
    <h1>Welcome</h1>
    <p>This is a simple HTML page</p>
    <a href="#contact">Contact Us</a>
    <img src="https://example.com/conversion.gif" alt="tracking" style="display:none;">
  </body>
</html>`,
    shouldPass: true,
    expectedCriticalFailures: 0,
    description: 'Valid static HTML with basic viewport'
  },

  {
    name: 'Astro with missing viewport (FAIL)',
    html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>No Viewport</title>
  </head>
  <body>
    <h1>Missing viewport meta tag</h1>
    <img src="https://example.com/pixel.gif" alt="tracking">
  </body>
</html>`,
    shouldPass: false,
    expectedCriticalFailures: 1,
    expectedFailureIds: ['QUAL-01'],
    description: 'Invalid build: missing viewport meta tag'
  },

  {
    name: 'Astro with env leak (FAIL)',
    html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width">
    <script>
      const brand = import.meta.env.PUBLIC_BRAND || "Default";
      const apiUrl = import.meta.env.PUBLIC_API_URL;
    </script>
  </head>
  <body>
    <h1>Env Leaks Found</h1>
  </body>
</html>`,
    shouldPass: false,
    expectedCriticalFailures: 1,
    expectedFailureIds: ['QUAL-03'],
    description: 'Invalid build: unprocessed Astro env variables'
  },

  {
    name: 'HTML with no tracking (advisory only)',
    html: `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>No Tracking</title>
  </head>
  <body>
    <h1>No tracking pixels</h1>
    <p>This template has no tracking</p>
  </body>
</html>`,
    shouldPass: true,
    expectedCriticalFailures: 0,
    description: 'Valid HTML with viewport but no tracking (advisory only, trackingConfig.required=false)'
  },

  {
    name: 'Vite with viewport variations',
    html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="initial-scale=1, width=device-width">
    <title>Viewport Variation</title>
  </head>
  <body>
    <h1>Different viewport format</h1>
    <img src="https://analytics.example.com/track.png?id=123" alt="tracking">
  </body>
</html>`,
    shouldPass: true,
    expectedCriticalFailures: 0,
    description: 'Valid with viewport attribute order variation'
  },

  {
    name: 'Astro with safe env.DEV usage',
    html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width">
    <script>
      if (import.meta.env.DEV) {
        console.log('Development mode');
      }
      const isProd = import.meta.env.PROD;
    </script>
  </head>
  <body>
    <h1>Safe built-in env vars</h1>
    <img src="https://example.com/pixel.gif">
  </body>
</html>`,
    shouldPass: true,
    expectedCriticalFailures: 0,
    description: 'Valid with safe Astro built-in env variables'
  },
];

describe('Quality Check Regression Tests (Phase 1-2 Templates)', () => {
  describe('Template compatibility', () => {
    sampleTemplates.forEach((template) => {
      it(`Should ${template.shouldPass ? 'PASS' : 'FAIL'}: ${template.name}`, async () => {
        const results = await QualityChecker.validatePreDeploy(
          template.html,
          '',
          {
            lighthouseConfig: { timeout: 5000 },
            trackingConfig: { required: false }, // Optional for regression tests
          }
        );

        // Verify pass/fail status
        expect(results.passed).toBe(template.shouldPass);

        // Verify critical failure count
        if (template.expectedCriticalFailures !== undefined) {
          expect(results.criticalFailures).toHaveLength(template.expectedCriticalFailures);
        }

        // Verify specific failure IDs if provided
        if (template.expectedFailureIds) {
          const failureIds = results.criticalFailures.map((f) => f.id);
          template.expectedFailureIds.forEach((id) => {
            expect(failureIds).toContain(id);
          });
        }
      });
    });
  });

  describe('Backward compatibility with Phase 1-2 builds', () => {
    it('Should accept templates with varying viewport format', async () => {
      const htmlWithVariation = `<html>
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Spaces variation</title>
        </head>
        <body>Content</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(
        htmlWithVariation,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      // Should pass viewport check despite spacing differences
      const viewportCheck = results.checks.find((c) => c.id === 'QUAL-01');
      expect(viewportCheck).toBeDefined();
      expect(viewportCheck.passed).toBe(true);
    });

    it('Should accept templates without Lighthouse scores (advisory fallback)', async () => {
      const html = `<html>
        <head>
          <meta name="viewport" content="width=device-width">
          <title>Test</title>
        </head>
        <body>Test body</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(
        html,
        '',
        {
          lighthouseConfig: { timeout: 1000 }, // Very short timeout
        }
      );

      // Should still pass if Lighthouse times out (advisory-only)
      expect(results.passed).toBe(true);
    });

    it('Should preserve all validator results for audit trail', async () => {
      const html = `<html>
        <head>
          <meta name="viewport" content="width=device-width">
          <title>Audit Trail Test</title>
        </head>
        <body>
          <img src="https://example.com/pixel.gif">
        </body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(
        html,
        '',
        {
          lighthouseConfig: { timeout: 5000 },
          trackingConfig: { required: false },
        }
      );

      // All checks should be present
      expect(results.checks.length).toBeGreaterThan(0);
      expect(results.summary.total).toBeGreaterThan(0);

      // Result should have proper structure
      expect(results.passed).toBeDefined();
      expect(results.criticalFailures).toBeDefined();
      expect(results.warnings).toBeDefined();
      expect(results.summary).toBeDefined();
    });
  });

  describe('No new regressions in Phase 1-2 templates', () => {
    it('Should not introduce false positives on valid Astro templates', async () => {
      const validAstroTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Valid Astro</title>
  </head>
  <body>
    <h1>Astro Template</h1>
    <img src="https://tracking.example.com/pixel.gif" style="display:none;">
  </body>
</html>`;

      const results = await QualityChecker.validatePreDeploy(
        validAstroTemplate,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      expect(results.passed).toBe(true);
      expect(results.criticalFailures).toHaveLength(0);
    });

    it('Should not reject templates with Google conversion tracking', async () => {
      const htmlWithGoogleTracking = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width">
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-1234567890"></script>
    <script>
      gtag('config', 'G-1234567890');
    </script>
  </head>
  <body>
    <input name="gclid" type="hidden">
  </body>
</html>`;

      const results = await QualityChecker.validatePreDeploy(
        htmlWithGoogleTracking,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      // Should recognize Google Ads tracking
      const googleAdsResult = results.checks.find((c) => c.id === 'QUAL-04');
      expect(googleAdsResult).toBeDefined();

      // Should still pass overall
      expect(results.criticalFailures).toHaveLength(0);
    });

    it('Should accept templates with minimal required tags', async () => {
      const minimalTemplate = `<html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body>
          <h1>Minimal HTML</h1>
        </body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(
        minimalTemplate,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      // Viewport should pass
      expect(results.criticalFailures.some((f) => f.id === 'QUAL-01')).toBe(false);
    });
  });

  describe('Quality gate integration', () => {
    it('Should aggregate all validator results', async () => {
      const html = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABCDEF1234"></script>
  </head>
  <body>
    <h1>Full Quality Check</h1>
    <img src="https://example.com/track.gif">
  </body>
</html>`;

      const results = await QualityChecker.validatePreDeploy(
        html,
        '',
        {
          lighthouseConfig: { timeout: 5000 },
          trackingConfig: { required: false },
          googleAdsConfig: { required: false },
        }
      );

      // Should have checks for all validators
      const checkIds = results.checks.map((c) => c.id);
      expect(checkIds.length).toBeGreaterThanOrEqual(4); // At least viewport, pixel, leak, ads

      // Summary should be populated
      expect(results.summary.total).toBeGreaterThan(0);
      expect(results.summary.passed).toBeGreaterThanOrEqual(0);
      expect(results.summary.failed).toBeGreaterThanOrEqual(0);
    });

    it('Should properly categorize critical vs warning failures', async () => {
      const htmlWithMissingViewport = `<html>
        <head>
          <title>No viewport</title>
        </head>
        <body>Test</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(
        htmlWithMissingViewport,
        '',
        {
          lighthouseConfig: { timeout: 5000 },
          trackingConfig: { required: false },
        }
      );

      // Missing viewport should be critical
      const viewportFailure = results.criticalFailures.find((f) => f.id === 'QUAL-01');
      expect(viewportFailure).toBeDefined();
      expect(viewportFailure.severity).toBe('critical');
    });
  });

  describe('Error reporting quality', () => {
    it('Should provide actionable error messages', async () => {
      const htmlNoViewport = `<html>
        <head><title>Test</title></head>
        <body>No viewport</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(
        htmlNoViewport,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      const viewportFailure = results.criticalFailures.find((f) => f.id === 'QUAL-01');
      expect(viewportFailure.message).toBeTruthy();
      expect(viewportFailure.message.length).toBeGreaterThan(0);
    });

    it('Should report line context for Astro leaks', async () => {
      const htmlWithLeak = `<html>
        <head>
          <meta name="viewport" content="width=device-width">
          <script>
            const apiUrl = import.meta.env.PUBLIC_API_URL;
          </script>
        </head>
        <body>Test</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(
        htmlWithLeak,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      const leakFailure = results.criticalFailures.find((f) => f.id === 'QUAL-03');
      expect(leakFailure).toBeDefined();
      expect(leakFailure.details).toBeDefined();
    });
  });
});
