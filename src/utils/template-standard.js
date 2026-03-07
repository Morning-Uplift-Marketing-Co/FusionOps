/**
 * Template Standard Validator
 * 
 * Supports two modes:
 * - "astro"  : Astro project (src/pages/index.astro required)
 * - "html"   : HTML-first / Bolt / Lovable (index.html required)
 * 
 * Only index page is mandatory. apply, layout, tracking are optional
 * but reported for diagnostic purposes.
 */

/**
 * Detect template format from file list
 * @param {Record<string, string>} files
 * @returns {"astro" | "html" | "unknown"}
 */
export function detectTemplateFormat(files = {}) {
  // Normalize keys: forward-slash only, strip leading slash
  const keys = Object.keys(files).map(k => k.replace(/\\/g, '/').replace(/^\/+/, ''));
  console.log('[TemplateStandard] detectTemplateFormat normalized keys:', keys);

  const has = (candidates) => candidates.some(p =>
    keys.includes(p) ||
    keys.some(k => k.endsWith('/' + p)) ||
    keys.some(k => k === p || k.endsWith(p))
  );

  if (has(['src/pages/index.astro', 'index.astro'])) return 'astro';
  if (has(['index.html'])) return 'html';
  console.warn('[TemplateStandard] No entry point found in keys:', keys);
  return 'unknown';
}

/**
 * Validate template files
 * @param {Record<string, string>} files
 * @returns {{ ok: boolean, format: string, errors: string[], warnings: string[], detected: object }}
 */
export function validateAstroStandard(files = {}) {
  const keys = Object.keys(files || {}).map(k => k.replace(/\\/g, '/').replace(/^\/+/, ''));
  const format = detectTemplateFormat(files);

  const has = (candidates) => candidates.some(p =>
    keys.includes(p) || keys.some(k => k.endsWith('/' + p))
  );

  const errors = [];
  const warnings = [];

  if (format === 'unknown') {
    errors.push('Missing entry point: need src/pages/index.astro, index.astro, or index.html');
    return { ok: false, format, errors, warnings, detected: {} };
  }

  // --- Astro mode checks ---
  const hasApply = has(['src/pages/apply.astro', 'apply.astro', 'apply.html']);
  const hasLayout = has(['src/layouts/Layout.astro', 'layouts/Layout.astro']);

  const trackingFiles = [
    'src/config/brands.ts', 'src/config/brands.js',
    'src/lib/tracking.ts', 'src/lib/tracking.js',
    'src/utils/track.ts', 'src/utils/track.js',
  ];
  const hasTrackingFile = has(trackingFiles);
  const layoutKey = keys.find(k => k.endsWith('Layout.astro'));
  const layoutContent = layoutKey ? String(files[layoutKey] || '') : '';
  const hasTrackingInLayout =
    layoutContent.includes('__trackingConfig') ||
    layoutContent.includes('gtag') ||
    layoutContent.includes('pixelUrl');
  const hasTracking = hasTrackingFile || hasTrackingInLayout;

  if (format === 'astro') {
    if (!hasApply) warnings.push('No apply page found (apply.astro/apply.html) — single-page mode');
    if (!hasLayout) warnings.push('No Layout.astro found — layout will be inlined');
    if (!hasTracking) warnings.push('No tracking config detected — tracking will be injected at deploy');
  }

  if (format === 'html') {
    // HTML mode: very permissive, just warn about extras
    if (!hasApply) warnings.push('No apply page found — single-page mode');
  }

  return {
    ok: errors.length === 0,
    format,
    errors,
    warnings,
    detected: {
      format,
      pageIndex: true,
      pageApply: hasApply,
      layout: hasLayout,
      tracking: hasTracking,
    },
  };
}
