/**
 * Quality Checker Service
 * =======================
 * Orchestrator for all quality validation gates (QUAL-01 through QUAL-06)
 * Runs AFTER AntiFingerprint.transform(), BEFORE Cloudflare deploy
 */

import { checkViewportMeta } from './validators/viewport-validator.js';
import { checkTrackingPixels } from './validators/pixel-validator.js';

/**
 * QualityChecker orchestrator service
 * Chains all validators and aggregates results
 */
export class QualityChecker {
  /**
   * Run all quality validation gates post-fingerprint
   * @param {string} htmlContent - Final HTML output from AntiFingerprint.transform()
   * @param {string} cssContent - Final CSS output
   * @param {Object} config - Quality check configuration
   * @param {Object} config.trackingConfig - Tracking validation config
   * @param {boolean} config.trackingConfig.required - If true, missing pixels are critical
   * @returns {Promise<{
   *   passed: boolean,
   *   checks: Array<Object>,
   *   criticalFailures: Array<Object>,
   *   warnings: Array<Object>,
   *   summary: {total: number, passed: number, failed: number}
   * }>} Aggregated validation results
   */
  static async validatePreDeploy(htmlContent, cssContent, config = {}) {
    const results = {
      checks: [],
      criticalFailures: [],
      warnings: [],
    };

    // Gate 1: Viewport meta tag (QUAL-01)
    const viewportResult = checkViewportMeta(htmlContent);
    if (!viewportResult.passed) {
      results.criticalFailures.push(viewportResult);
    } else {
      results.checks.push(viewportResult);
    }

    // Gate 2: Tracking pixel marker (QUAL-02)
    const pixelResult = checkTrackingPixels(htmlContent, config.trackingConfig || {});
    if (!pixelResult.passed && config.trackingConfig?.required) {
      results.criticalFailures.push(pixelResult);
    } else {
      results.checks.push(pixelResult);
    }

    // Aggregate results
    results.passed = results.criticalFailures.length === 0;
    results.summary = {
      total: results.checks.length + results.criticalFailures.length,
      passed: results.checks.length,
      failed: results.criticalFailures.length,
    };

    return results;
  }
}

// Export validators for direct use and testing
export { checkViewportMeta, checkTrackingPixels };
