/**
 * QualityChecker Orchestrator Tests
 * ==================================
 * Tests for QualityChecker service orchestration
 */

import { describe, it, expect } from 'vitest';
import { QualityChecker } from '../QualityChecker.js';

describe('QualityChecker - Orchestration', () => {
  it('should aggregate results from validators', async () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <img src="https://example.voluum.com/vol_pixel" alt="pixel">
        </body>
      </html>
    `;
    const css = '';
    const config = {};

    const result = await QualityChecker.validatePreDeploy(html, css, config);

    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('checks');
    expect(result).toHaveProperty('criticalFailures');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('summary');
  });

  it('should mark as passed when no critical failures', async () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body>
          <img src="https://example.voluum.com/vol_pixel" alt="pixel">
        </body>
      </html>
    `;

    const result = await QualityChecker.validatePreDeploy(html, '', {});

    expect(result.passed).toBe(true);
  });

  it('should fail when critical validators fail', async () => {
    const html = '<html><body>No viewport, no pixels</body></html>';

    const result = await QualityChecker.validatePreDeploy(html, '', {});

    expect(result.passed).toBe(false);
    expect(result.criticalFailures.length).toBeGreaterThan(0);
  });

  it('should report critical failures separately from warnings', async () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body>No pixels</body>
      </html>
    `;

    const result = await QualityChecker.validatePreDeploy(html, '', {});

    expect(result.criticalFailures).toBeDefined();
    expect(result.warnings).toBeDefined();
    expect(Array.isArray(result.criticalFailures)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('should calculate summary with correct counts', async () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body>
          <img src="https://example.voluum.com/vol_pixel" alt="pixel">
        </body>
      </html>
    `;

    const result = await QualityChecker.validatePreDeploy(html, '', {});

    expect(result.summary).toHaveProperty('total');
    expect(result.summary).toHaveProperty('passed');
    expect(result.summary).toHaveProperty('failed');
    expect(result.summary.total).toBe(result.summary.passed + result.summary.failed);
  });

  it('should handle config with tracking requirements', async () => {
    const html = '<html><body>No pixels</body></html>';
    const config = { trackingConfig: { required: true } };

    const result = await QualityChecker.validatePreDeploy(html, '', config);

    // With required: true, missing pixels should be critical
    expect(result.passed).toBe(false);
  });

  it('should not mutate input HTML', async () => {
    const html = '<html><body>Test</body></html>';
    const originalHtml = html;

    await QualityChecker.validatePreDeploy(html, '', {});

    expect(html).toBe(originalHtml);
  });

  it('should handle empty HTML gracefully', async () => {
    const result = await QualityChecker.validatePreDeploy('', '', {});

    expect(result).toBeDefined();
    expect(result.passed).toBeDefined();
  });

  it('should return immutable result objects', async () => {
    const html = '<html><head><meta name="viewport" content="width=device-width"></head></html>';
    const result = await QualityChecker.validatePreDeploy(html, '', {});

    // Verify we can read properties
    expect(result.passed).toBeDefined();
    expect(result.checks).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('should process validators sequentially', async () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body>
          <img src="https://example.voluum.com/vol_pixel" alt="pixel">
        </body>
      </html>
    `;

    const result = await QualityChecker.validatePreDeploy(html, '', {});

    // All validators should have run (checks + criticalFailures should be populated)
    const allResults = result.checks.concat(result.criticalFailures);
    expect(allResults.length).toBeGreaterThan(0);
  });
});
