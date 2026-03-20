/**
 * Google Ads Tracking Marker Validation (QUAL-04)
 * ==============================================
 * Validates that Google Ads conversion tracking is properly configured:
 *   1. gtag.js script tag present (https://www.googletagmanager.com/gtag/js?id=...)
 *   2. Conversion ID valid format (G-[A-Z0-9]{10,})
 *   3. GCLID parameter detected (URL param, form field, or data attribute)
 *
 * All three components required for complete setup.
 */

import { load as cheerioLoad } from 'cheerio';

// Patterns for validation
const CONVERSION_ID_PATTERN = /G-[A-Z0-9]{10,}/;
const GCLID_PATTERN = /[?&]gclid=[A-Za-z0-9_-]+/;

/**
 * Check for Google Ads markers in HTML content
 * @param {string} htmlContent - Final HTML output from build
 * @param {Object} config - Optional configuration object
 * @returns {Object} Result with {id, name, passed, severity, message, details, checklist, fix?}
 */
export function checkGoogleAdMarkers(htmlContent, config = {}) {
  // Validate input
  if (typeof htmlContent !== 'string') {
    htmlContent = '';
  }

  const $ = cheerioLoad(htmlContent);
  const findings = {
    gtagScriptPresent: false,
    conversionIdValid: false,
    gclIdPresent: false,
    gtag: null,
  };

  // Find gtag.js script
  let gtagScript = null;
  $('script').each((i, el) => {
    const src = $(el).attr('src') || '';
    const content = $(el).html() || '';

    // Check for gtag.js script tag
    if (
      src.includes('googletagmanager.com') &&
      src.includes('gtag')
    ) {
      findings.gtagScriptPresent = true;
      gtagScript = { type: 'script-tag', src };
      findings.gtag = gtagScript;
    }

    // Check for inline gtag() configuration
    if (
      content.includes("gtag('config'") ||
      content.includes("gtag('event'")
    ) {
      findings.gtagScriptPresent = true;

      // Extract conversion ID from gtag config
      const match = content.match(CONVERSION_ID_PATTERN);
      if (match) {
        findings.conversionIdValid = true;
        if (!gtagScript) {
          gtagScript = { type: 'inline-config', id: match[0] };
          findings.gtag = gtagScript;
        }
      }
    }
  });

  // Check for GCLID in URL parameter or form
  const gclIdMatch = htmlContent.match(GCLID_PATTERN);
  if (gclIdMatch) {
    findings.gclIdPresent = true;
  }

  // Alternative: check for GCLID parameter in forms
  const gclIdInput = $('input[name="gclid"], input[name="GCLID"]');
  if (gclIdInput.length > 0) {
    findings.gclIdPresent = true;
  }

  // Check for GCLID as data attribute
  if (htmlContent.includes('gclid=') || htmlContent.includes('GCLID=')) {
    findings.gclIdPresent = true;
  }

  const passed =
    findings.gtagScriptPresent &&
    findings.conversionIdValid &&
    findings.gclIdPresent;

  return {
    id: 'QUAL-04',
    name: 'Google Ads Tracking Markers',
    passed,
    severity: passed ? 'info' : 'critical',
    message: passed
      ? 'Google Ads conversion tracking properly configured'
      : 'Google Ads tracking incomplete',
    details: findings,
    checklist: {
      '✓ gtag.js script present': findings.gtagScriptPresent,
      '✓ Conversion ID valid format (G-*)': findings.conversionIdValid,
      '✓ GCLID parameter detected': findings.gclIdPresent,
    },
    fix:
      !passed
        ? `Missing: ${[
            !findings.gtagScriptPresent && 'gtag.js script tag',
            !findings.conversionIdValid && 'valid conversion ID (G-XXXXXXXXXX format)',
            !findings.gclIdPresent && 'GCLID parameter in URL or hidden input',
          ]
            .filter(Boolean)
            .join(', ')}`
        : undefined,
  };
}
