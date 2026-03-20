/**
 * Viewport Meta Tag Validator
 * ===========================
 * QUAL-01: Detects and validates <meta name="viewport"> with width=device-width
 */

import { load as cheerioLoad } from 'cheerio';

/**
 * Validate viewport meta tag presence and configuration
 * @param {string} htmlContent - HTML content to validate
 * @returns {{
 *   id: string,
 *   name: string,
 *   passed: boolean,
 *   severity: 'critical' | 'info',
 *   message: string,
 *   details?: string,
 *   fix?: string,
 *   expected?: string
 * }} Validation result object (immutable)
 */
export function checkViewportMeta(htmlContent) {
  const $ = cheerioLoad(htmlContent);
  const viewportMeta = $('meta[name="viewport"]');

  // Check 1: Missing viewport meta tag
  if (viewportMeta.length === 0) {
    return {
      id: 'QUAL-01',
      name: 'Viewport Meta Tag',
      passed: false,
      severity: 'critical',
      message: 'Missing viewport meta tag',
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>',
      details: 'Viewport meta tag is required for responsive mobile design',
    };
  }

  const content = viewportMeta.attr('content') || '';

  // Check 2: Missing width=device-width (critical)
  if (!content.includes('width=device-width')) {
    return {
      id: 'QUAL-01',
      name: 'Viewport Meta Tag',
      passed: false,
      severity: 'critical',
      message: 'Viewport meta tag missing width=device-width',
      fix: 'Update content attribute to include width=device-width',
      details: `Current: <meta name="viewport" content="${content}">`,
      expected: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    };
  }

  // Check 3: Has width=device-width - pass
  return {
    id: 'QUAL-01',
    name: 'Viewport Meta Tag',
    passed: true,
    severity: 'info',
    message: 'Viewport meta tag correctly configured',
    details: `Found: <meta name="viewport" content="${content}">`,
  };
}
