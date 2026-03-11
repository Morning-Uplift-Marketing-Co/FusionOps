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
export function normalizeTemplateFiles(files = {}) {
  const normalized = {};
  for (const [rawPath, value] of Object.entries(files || {})) {
    const nextPath = String(rawPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!nextPath) continue;
    normalized[nextPath] = value;
  }
  return normalized;
}

function getNormalizedKeys(files = {}) {
  return Object.keys(normalizeTemplateFiles(files));
}

function findByCandidates(keys, candidates) {
  return candidates.find(p =>
    keys.includes(p) ||
    keys.some(k => k.endsWith('/' + p)) ||
    keys.some(k => k === p || k.endsWith(p))
  ) || null;
}

export function resolveTemplateEntry(files = {}) {
  const keys = getNormalizedKeys(files);
  console.log('[TemplateStandard] detectTemplateFormat normalized keys:', keys);

  const astroCandidates = [
    'src/pages/index.astro',
    'pages/index.astro',
    'index.astro',
  ];
  const htmlCandidates = [
    'index.html',
    'public/index.html',
  ];

  const astroEntry = findByCandidates(keys, astroCandidates)
    || keys.find(k => /(^|\/)(src\/)?pages\/index\.astro$/i.test(k))
    || keys.find(k => /(^|\/)index\.astro$/i.test(k))
    || null;

  if (astroEntry) {
    return { format: 'astro', entry: astroEntry };
  }

  const htmlEntry = findByCandidates(keys, htmlCandidates)
    || keys.find(k => /(^|\/)index\.html$/i.test(k))
    || null;

  if (htmlEntry) {
    return { format: 'html', entry: htmlEntry };
  }

  return { format: 'unknown', entry: null };
}

export function detectTemplateFormat(files = {}) {
  const { format, entry } = resolveTemplateEntry(files);
  if (format === 'unknown') {
    console.warn('[TemplateStandard] No entry point found in keys:', getNormalizedKeys(files));
  } else {
    console.log('[TemplateStandard] Detected format:', format, 'entry:', entry);
  }
  return format;
}

/**
 * Validate template files
 * @param {Record<string, string>} files
 * @returns {{ ok: boolean, format: string, errors: string[], warnings: string[], detected: object }}
 */
export function validateAstroStandard(files = {}) {
  const normalizedFiles = normalizeTemplateFiles(files);
  const keys = Object.keys(normalizedFiles);
  const { format, entry } = resolveTemplateEntry(normalizedFiles);

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
  const layoutContent = layoutKey ? String(normalizedFiles[layoutKey] || '') : '';
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
      entry,
      pageIndex: true,
      pageApply: hasApply,
      layout: hasLayout,
      tracking: hasTracking,
    },
  };
}
