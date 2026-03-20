/**
 * Tracking Pixel Validator
 * ========================
 * QUAL-02: Detects Voluum and Google conversion tracking pixels
 */

import { load as cheerioLoad } from 'cheerio';

/**
 * Validate presence of tracking pixels (Voluum, Google conversion)
 * @param {string} htmlContent - HTML content to validate
 * @param {Object} config - Configuration options
 * @param {boolean} config.requireVoluum - If true, Voluum pixel is required
 * @param {boolean} config.requireGoogle - If true, Google tracking is required
 * @returns {{
 *   id: string,
 *   name: string,
 *   passed: boolean,
 *   severity: 'critical' | 'info',
 *   message: string,
 *   details: {voluum: boolean, google: boolean, gclid: boolean},
 *   fix?: string
 * }} Validation result object (immutable)
 */
export function checkTrackingPixels(htmlContent, config = {}) {
  const $ = cheerioLoad(htmlContent);
  const detected = {
    voluum: false,
    google: false,
    gclid: false,
  };

  // Detect Voluum pixel: img src containing vol_pixel or conversion.gif
  $('img').each((i, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('vol_pixel') || src.includes('conversion.gif')) {
      detected.voluum = true;
    }
  });

  // Detect Google conversion tracking: gtag.js script
  $('script').each((i, el) => {
    const src = $(el).attr('src') || '';
    const content = $(el).html() || '';

    // Check for gtag.js external script or googletagmanager.com references
    if (src.includes('googletagmanager.com') || src.includes('gtag')) {
      detected.google = true;
    }

    // Check for gtag initialization with conversion ID (G-123456 pattern)
    if (content.includes("gtag('config'") && content.includes('G-')) {
      detected.google = true;
    }
  });

  // Detect GCLID parameter handling (URL parameter, cookie, or form hidden field)
  if (htmlContent.includes('gclid') || htmlContent.includes('GCLID')) {
    detected.gclid = true;
  }

  // Check for GCLID in form hidden fields
  const gclIdInput = $('input[name="gclid"], input[name="GCLID"]');
  if (gclIdInput.length > 0) {
    detected.gclid = true;
  }

  // Determine if check passed based on configuration
  let passed = false;

  // Default: at least one tracking method must exist
  const hasTracking = detected.voluum || (detected.google && detected.gclid);

  // Apply config requirements
  const isRequiredVoluum = config.requireVoluum ? detected.voluum : true;
  const isRequiredGoogle = config.requireGoogle ? (detected.google && detected.gclid) : true;

  passed = hasTracking && isRequiredVoluum && isRequiredGoogle;

  // Build message with detected pixels
  const detectedMethods = Object.entries(detected)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ');

  const message = passed
    ? `Tracking pixels detected: ${detectedMethods || 'at least one method'}`
    : 'No tracking pixels detected in final HTML';

  return {
    id: 'QUAL-02',
    name: 'Tracking Pixel Markers',
    passed,
    severity: passed ? 'info' : 'critical',
    message,
    details: detected,
    ...((!passed && { fix: 'Ensure Voluum pixel or Google conversion tracking (gtag + GCLID) is present in template' }) || {}),
  };
}
