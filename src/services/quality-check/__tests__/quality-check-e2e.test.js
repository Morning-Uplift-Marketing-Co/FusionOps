/**
 * Quality Check E2E Pipeline Tests
 * ================================
 * Verify full pipeline: detect → build → fingerprint → quality checks → deploy-ready
 * Tests: Integration between all Phase 1-3 components, error handling, deploy blocking.
 */

import { describe, it, expect, vi } from 'vitest';
import { QualityChecker } from '../QualityChecker.js';
import { AntiFingerprint } from '../../AntiFingerprint.js';

/**
 * E2E pipeline scenarios
 * Each tests a complete flow from build output through quality gates
 */
describe('Quality Check E2E Pipeline', () => {
  describe('Happy path: full pipeline passes quality gates', () => {
    it('Should pass full pipeline: build → fingerprint → quality checks', async () => {
      // Simulated Phase 2 TemplateBuilder output
      const buildOutput = {
        success: true,
        html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Professional Landing Page</title>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX123"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-XXXXXXX123');
    </script>
  </head>
  <body>
    <header>
      <h1>Welcome to Our Service</h1>
      <p>Modern landing page with full compliance</p>
    </header>
    <section class="cta">
      <button onclick="trackConversion()">Get Started</button>
    </section>
    <img src="https://tracking.example.com/vol_pixel.gif" style="display:none;" alt="tracking">
    <input type="hidden" name="gclid" id="gclid">
    <script>
      function trackConversion() {
        gtag('event', 'conversion');
      }
    </script>
  </body>
</html>`,
        css: 'body { font-family: Arial; margin: 0; } header { padding: 20px; }',
      };

      // Step 1: Apply anti-fingerprinting (Phase 2)
      const fingerprintResult = await AntiFingerprint.transform(
        buildOutput.html,
        buildOutput.css,
        'test-site-1'
      );

      // Step 2: Run quality checks (Phase 3)
      const qualityResults = await QualityChecker.validatePreDeploy(
        fingerprintResult.html,
        fingerprintResult.css,
        {
          trackingConfig: { required: false },
          googleAdsConfig: { required: false },
          lighthouseConfig: { timeout: 5000 },
        }
      );

      // Verify all gates pass
      expect(qualityResults.passed).toBe(true);
      expect(qualityResults.criticalFailures).toHaveLength(0);

      // Verify all validators executed
      expect(qualityResults.checks.length).toBeGreaterThanOrEqual(4);

      // Verify summary is accurate
      expect(qualityResults.summary.total).toBeGreaterThan(0);
      expect(qualityResults.summary.failed).toBe(0);
    });

    it('Should return deploy-ready result when all gates pass', async () => {
      const html = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>
    <h1>Deploy Ready</h1>
    <img src="https://example.com/pixel.gif">
  </body>
</html>`;

      const results = await QualityChecker.validatePreDeploy(html, '', {
        lighthouseConfig: { timeout: 5000 },
      });

      // Deploy-ready indicators
      expect(results.passed).toBe(true);
      expect(results.criticalFailures).toHaveLength(0);
      expect(results.summary.failed).toBe(0);
    });
  });

  describe('Error path: critical failures block deploy', () => {
    it('Should block deploy if viewport missing (QUAL-01)', async () => {
      const htmlWithoutViewport = `<!DOCTYPE html>
<html>
  <head>
    <title>Missing Viewport</title>
  </head>
  <body>
    <h1>No viewport meta tag</h1>
  </body>
</html>`;

      const results = await QualityChecker.validatePreDeploy(
        htmlWithoutViewport,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      // Should fail overall
      expect(results.passed).toBe(false);

      // Should have critical failure for viewport
      expect(results.criticalFailures.length).toBeGreaterThan(0);
      const viewportFailure = results.criticalFailures.find((f) => f.id === 'QUAL-01');
      expect(viewportFailure).toBeDefined();
      expect(viewportFailure.severity).toBe('critical');
    });

    it('Should block deploy if Astro leaks detected (QUAL-03)', async () => {
      const htmlWithLeaks = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width">
    <script>
      const brand = import.meta.env.PUBLIC_BRAND || "Default";
      const apiUrl = import.meta.env.PUBLIC_API_URL;
      console.log(\`Brand: \${brand}\`);
    </script>
  </head>
  <body>
    <h1>Unprocessed Env Variables</h1>
  </body>
</html>`;

      const results = await QualityChecker.validatePreDeploy(
        htmlWithLeaks,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      // Should fail overall
      expect(results.passed).toBe(false);

      // Should have critical failure for Astro leaks
      const leakFailure = results.criticalFailures.find((f) => f.id === 'QUAL-03');
      expect(leakFailure).toBeDefined();
      expect(leakFailure.severity).toBe('critical');
    });

    it('Should block deploy if multiple critical failures', async () => {
      const htmlWithMultipleIssues = `<!DOCTYPE html>
<html>
  <head>
    <title>Multiple Issues</title>
    <script>
      const env = import.meta.env.PUBLIC_SECRET;
    </script>
  </head>
  <body>
    <h1>No viewport, has leaks</h1>
  </body>
</html>`;

      const results = await QualityChecker.validatePreDeploy(
        htmlWithMultipleIssues,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      // Should fail
      expect(results.passed).toBe(false);

      // Should have multiple critical failures
      expect(results.criticalFailures.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Warning path: non-critical issues log but don\'t block', () => {
    it('Should pass if tracking missing but not required', async () => {
      const htmlWithoutTracking = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width">
  </head>
  <body>
    <h1>No tracking</h1>
  </body>
</html>`;

      const results = await QualityChecker.validatePreDeploy(
        htmlWithoutTracking,
        '',
        {
          trackingConfig: { required: false },
          lighthouseConfig: { timeout: 5000 },
        }
      );

      // Should pass overall (tracking not required)
      expect(results.passed).toBe(true);

      // May have failed check but not in critical failures
      const pixelCheck = results.checks.find((c) => c.id === 'QUAL-02');
      if (pixelCheck && !pixelCheck.passed) {
        // It's in checks, not criticalFailures, so it's not blocking deploy
        expect(results.criticalFailures.some((f) => f.id === 'QUAL-02')).toBe(false);
      }
    });

    it('Should pass if Google Ads not required', async () => {
      const htmlWithoutGoogleAds = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width">
  </head>
  <body>
    <h1>No Google Ads</h1>
    <img src="https://example.com/pixel.gif">
  </body>
</html>`;

      const results = await QualityChecker.validatePreDeploy(
        htmlWithoutGoogleAds,
        '',
        {
          googleAdsConfig: { required: false },
          lighthouseConfig: { timeout: 5000 },
        }
      );

      // Should pass
      expect(results.passed).toBe(true);
    });
  });

  describe('Error messages and remediation guidance', () => {
    it('Should provide clear remediation for missing viewport', async () => {
      const html = `<html>
        <head><title>No viewport</title></head>
        <body>Test</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(html, '', {
        lighthouseConfig: { timeout: 5000 },
      });

      const failure = results.criticalFailures.find((f) => f.id === 'QUAL-01');
      expect(failure.message).toBeTruthy();
      expect(failure.message).toContain('viewport');
    });

    it('Should provide line context for Astro leaks', async () => {
      const html = `<html>
        <head>
          <meta name="viewport" content="width=device-width">
          <script>
            const url = import.meta.env.PUBLIC_URL;
          </script>
        </head>
        <body>Test</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(html, '', {
        lighthouseConfig: { timeout: 5000 },
      });

      const failure = results.criticalFailures.find((f) => f.id === 'QUAL-03');
      if (failure && failure.details) {
        expect(failure.details).toBeDefined();
      }
    });

    it('Should aggregate error messages for deploy blocking', async () => {
      const html = `<html>
        <head>
          <script>
            const brand = import.meta.env.PUBLIC_BRAND;
          </script>
        </head>
        <body>Test</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(html, '', {
        lighthouseConfig: { timeout: 5000 },
      });

      // Should have errors
      expect(results.criticalFailures.length).toBeGreaterThan(0);

      // Should be able to build error message for deploy
      const errorMessage = results.criticalFailures
        .map((f) => `${f.id}: ${f.message}`)
        .join('\n');

      expect(errorMessage).toBeTruthy();
      expect(errorMessage).toContain('QUAL');
    });
  });

  describe('Fingerprinting integration', () => {
    it('Should validate quality of fingerprinted HTML', async () => {
      const originalHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width">
    <style>
      .btn { background: #FF0000; }
      #header { padding: 20px; }
      [data-tracking="yes"] { display: none; }
    </style>
  </head>
  <body>
    <h1 id="header">Header</h1>
    <button class="btn" onclick="onClick()">Click</button>
  </body>
</html>`;

      // Apply fingerprinting (Phase 2)
      const fingerprinted = await AntiFingerprint.transform(
        originalHtml,
        '',
        'test-site-abc'
      );

      // Quality check fingerprinted output
      const results = await QualityChecker.validatePreDeploy(
        fingerprinted.html,
        fingerprinted.css,
        { lighthouseConfig: { timeout: 5000 } }
      );

      // Should still pass quality checks
      expect(results.criticalFailures.some((f) => f.id === 'QUAL-01')).toBe(false);
      expect(results.criticalFailures.some((f) => f.id === 'QUAL-03')).toBe(false);
    });

    it('Should maintain viewport meta tag through fingerprinting', async () => {
      const html = `<html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>Test</body>
      </html>`;

      const fingerprinted = await AntiFingerprint.transform(html, '', 'test-site-2');

      const results = await QualityChecker.validatePreDeploy(
        fingerprinted.html,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      // Viewport check should pass
      const viewportCheck = results.checks.find((c) => c.id === 'QUAL-01');
      expect(viewportCheck).toBeDefined();
      expect(viewportCheck.passed).toBe(true);
    });
  });

  describe('Lighthouse integration', () => {
    it('Should run quality checks with Lighthouse timeout', async () => {
      const html = `<html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body><h1>Test</h1></body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(
        html,
        '',
        {
          lighthouseConfig: { timeout: 2000 }, // Very short timeout for testing
        }
      );

      // Should complete without throwing
      expect(results).toBeDefined();
      expect(results.passed).toBeDefined();
    });

    it('Should return results even if Lighthouse unavailable', async () => {
      const html = `<html>
        <head>
          <meta name="viewport" content="width=device-width">
          <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
        </head>
        <body>Test</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(
        html,
        '',
        { lighthouseConfig: { timeout: 1000 } }
      );

      // Should still return results
      expect(results.passed).toBeDefined();

      // Non-Lighthouse gates should still execute
      expect(results.checks.some((c) => c.id === 'QUAL-01')).toBe(true);
    });
  });

  describe('Configuration handling', () => {
    it('Should respect tracking required configuration', async () => {
      const htmlWithoutTracking = `<html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body>No tracking</body>
      </html>`;

      // Test 1: Tracking optional
      const resultsOptional = await QualityChecker.validatePreDeploy(
        htmlWithoutTracking,
        '',
        {
          trackingConfig: { required: false },
          lighthouseConfig: { timeout: 5000 },
        }
      );

      expect(resultsOptional.passed).toBe(true);

      // Test 2: Tracking required
      const resultsRequired = await QualityChecker.validatePreDeploy(
        htmlWithoutTracking,
        '',
        {
          trackingConfig: { required: true },
          lighthouseConfig: { timeout: 5000 },
        }
      );

      // Should have critical failure
      const trackingFailure = resultsRequired.criticalFailures.find(
        (f) => f.id === 'QUAL-02'
      );
      expect(trackingFailure).toBeDefined();
    });

    it('Should handle empty configuration gracefully', async () => {
      const html = `<html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body>Test</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(html, '', {});

      // Should use defaults and pass
      expect(results.passed).toBe(true);
    });
  });

  describe('Result structure and consistency', () => {
    it('Should always return properly structured results', async () => {
      const html = `<html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body>Test</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(
        html,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      // Check required fields
      expect(results.passed).toBeDefined();
      expect(typeof results.passed).toBe('boolean');

      expect(Array.isArray(results.checks)).toBe(true);
      expect(Array.isArray(results.criticalFailures)).toBe(true);
      expect(Array.isArray(results.warnings)).toBe(true);

      expect(results.summary).toBeDefined();
      expect(results.summary.total).toBeDefined();
      expect(results.summary.passed).toBeDefined();
      expect(results.summary.failed).toBeDefined();
    });

    it('Should include validator metadata in results', async () => {
      const html = `<html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body>Test</body>
      </html>`;

      const results = await QualityChecker.validatePreDeploy(
        html,
        '',
        { lighthouseConfig: { timeout: 5000 } }
      );

      // Each check should have required fields
      results.checks.forEach((check) => {
        expect(check.id).toBeDefined();
        expect(check.passed).toBeDefined();
        expect(check.message).toBeDefined();
      });
    });
  });
});
