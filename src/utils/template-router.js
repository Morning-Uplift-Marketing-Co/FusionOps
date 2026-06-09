import { generateApplyPage } from "./lp-generator.js";
import { generateAstroProject } from "./astro-generator.jsx";
import { getTemplateGenerator, resolveTemplateId as resolveId, clearCustomTemplatesCache, fetchCustomTemplates, getCustomTemplatesCache, registry } from "./template-registry.js";
import { detectTemplateFormat, resolveTemplateEntry } from "./template-standard.js";
import { getTemplateFileContent, identifyFramework } from "./template-analyzer.js";
import { buildPreviewHtml, stripTypeScriptFromScript, substituteSiteVariables } from "./template-preview-runtime.js";
import { injectDistPreviewBase } from "./template-thumbnail-preview.js";
import { generatePhone } from "./phone-gen.js";
import { generateBusinessAddress } from "./contact-gen.js";
import { ADAPTER_RUNTIME_VERSION } from "../adapters/runtime-version.ts";
import { TemplateRuntimeError } from "../adapters/template-runtime-error.ts";
import { emitTemplateRuntimeEvent } from "../adapters/template-runtime-events.ts";

// ─── Anti-fingerprinting: multi-framework generators ───
import { generatePlainHtml } from "./generators/plain-html-generator.js";
import { randomizeHtmlStructure } from "./generators/html-structure-randomizer.js";
import { autoAssignDeployTarget } from "./deployers/deploy-target-auto.js";
import { parameterizeHtmlString } from "./generators/template-parameterizer.js";

// Ensure templates are registered (side-effect import)
import "#lp-template-generator/templates";

// Eagerly import the module generator for synchronous use
import { generate as _generateRaw } from "#lp-template-generator/core/generator.js";

// Wrapper: generate() returns { ok, files, meta, errors } — we need just the files map
function generateFromModule(templateId, siteConfig) {
  const result = _generateRaw(templateId, siteConfig);
  if (!result?.files) {
    console.error('[Router] Module generate failed:', result?.errors);
    return null;
  }
  return result.files;
}

// Import colors for template variable substitution
import { COLORS as ALL_COLORS } from "../constants/index.js";
import { api } from "../services/api";

export const DEFAULT_TEMPLATE_ID = "classic";

// Plain HTML template IDs — use framework-free generator (anti-fingerprinting)
const PLAIN_HTML_TEMPLATE_IDS = new Set(['plain-html', 'vanilla', 'no-framework']);

/**
 * Check if a template should use the plain HTML generator.
 * Also auto-assigns plain HTML when site has no explicit templateId
 * and its hash maps to the 'plain' bucket (~20% of sites).
 */
export function shouldUsePlainHtml(site) {
  const tid = site?.templateId;
  if (tid && PLAIN_HTML_TEMPLATE_IDS.has(tid)) return true;
  return false;
}

function resolveTemplateId(site) {
  const rawId = site?.templateId || DEFAULT_TEMPLATE_ID;
  return resolveId(rawId);
}

// Module template IDs for quick lookup
const MODULE_TEMPLATE_IDS = ['classic', 'pdl-loans-v1', 'pdl-loans-v3', 'simple-lp', 'pet-care-loans', 'elastic-credits-v3', 'scratchpay-bridge', 'pet-loans-v1', 'installment-loans-v1', 'installment-loans-v2', 'pet-care-v2', 'installment-golden', 'pet-care-golden', 'leadgen-golden', 'flowbite-loan', 'hyperui-loan'];

// Export new generators for external use
export { generatePlainHtml } from "./generators/plain-html-generator.js";
export { randomizeHtmlStructure } from "./generators/html-structure-randomizer.js";
export { autoAssignDeployTarget } from "./deployers/deploy-target-auto.js";

// Check if a template ID is a module template (used by wizard + build pipeline)
export function isModuleTemplate(templateId) {
  if (!templateId || typeof templateId !== 'string') return false;
  return MODULE_TEMPLATE_IDS.includes(templateId) ||
    templateId === 'pdl-loansv1'; // alias
}

/** Built-in legacy entries that behave like module templates for wizard capabilities */
export const LEGACY_MODULE_LIKE_TEMPLATE_IDS = ['astro-test002'];

export function isLegacyModuleLikeTemplate(templateId) {
  return LEGACY_MODULE_LIKE_TEMPLATE_IDS.includes(templateId);
}

// Get color object for template substitution
function getColorObj(colorId) {
  return ALL_COLORS.find(c => c.id === colorId) || ALL_COLORS[3] || ALL_COLORS[0];
}

// Generate a static preview placeholder for Vite/React templates (Loveable)
// These templates need a build step and can't render live in an iframe
function generateVitePreviewPlaceholder(customTemplate, site) {
  const brand = site.brand || customTemplate.name || 'Brand';
  const h1 = site.h1 || 'Your Headline Here';
  const sub = site.sub || 'Your subheadline goes here';
  const cta = site.cta || 'Apply Now';
  const badge = customTemplate.badge || 'Vite';
  const amountMax = site.amountMax ? `$${Number(String(site.amountMax).replace(/[^0-9]/g, '')).toLocaleString()}` : '$5,000';
  const colorObj = getColorObj(site.colorId);
  const primary = `hsl(${colorObj.p[0]}, ${colorObj.p[1]}%, ${colorObj.p[2]}%)`;
  const accent = (site.colorId === 'custom' && site.primaryColor) ? site.primaryColor : primary;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; }
    .badge { display: inline-block; background: ${accent}18; color: ${accent}; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-bottom: 12px; border: 1px solid ${accent}30; }
    .hero { padding: 32px 20px; text-align: center; background: linear-gradient(180deg, #fff 0%, #f1f5f9 100%); }
    .h1 { font-size: 22px; font-weight: 800; line-height: 1.2; margin-bottom: 10px; color: #0f172a; }
    .sub { font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px; }
    .cta-btn { display: inline-block; background: ${accent}; color: #fff; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 14px ${accent}40; }
    .trust { display: flex; justify-content: center; gap: 16px; margin-top: 24px; }
    .trust-item { text-align: center; }
    .trust-icon { font-size: 20px; margin-bottom: 4px; }
    .trust-label { font-size: 9px; color: #94a3b8; font-weight: 600; }
    .form-card { margin: 20px; padding: 24px; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .form-title { font-size: 15px; font-weight: 700; text-align: center; margin-bottom: 6px; }
    .form-sub { font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 16px; }
    .input { width: 100%; padding: 12px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; margin-bottom: 10px; background: #f8fafc; }
    .vite-tag { position: fixed; bottom: 8px; right: 8px; background: #1e293b; color: #94a3b8; font-size: 9px; padding: 3px 8px; border-radius: 4px; font-weight: 600; }
    .howit { padding: 24px 20px; text-align: center; }
    .howit h2 { font-size: 16px; font-weight: 800; margin-bottom: 16px; }
    .steps { display: flex; flex-direction: column; gap: 12px; }
    .step-item { display: flex; align-items: center; gap: 12px; text-align: left; padding: 12px; background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: ${accent}15; color: ${accent}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; flex-shrink: 0; }
    .step-text { font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="hero">
    <div class="badge">${badge} Template</div>
    <div class="h1">${h1}</div>
    <div class="sub">${sub}</div>
    <a class="cta-btn" href="#">${cta}</a>
    <div class="trust">
      <div class="trust-item"><div class="trust-icon">🔒</div><div class="trust-label">256-bit SSL</div></div>
      <div class="trust-item"><div class="trust-icon">⚡</div><div class="trust-label">2-Min Process</div></div>
      <div class="trust-item"><div class="trust-icon">✅</div><div class="trust-label">No Credit Impact</div></div>
    </div>
  </div>
  <div class="form-card">
    <div class="form-title">Check Your Eligibility</div>
    <div class="form-sub">Takes less than 3 minutes — no credit impact</div>
    <input class="input" placeholder="ZIP Code" readonly>
    <a class="cta-btn" href="#" style="display:block;text-align:center">${cta}</a>
  </div>
  <div class="howit">
    <h2>How It Works</h2>
    <div class="steps">
      <div class="step-item"><div class="step-num">1</div><div class="step-text">Fill out the simple form</div></div>
      <div class="step-item"><div class="step-num">2</div><div class="step-text">Get matched with lenders</div></div>
      <div class="step-item"><div class="step-num">3</div><div class="step-text">Receive funds up to ${amountMax}</div></div>
    </div>
  </div>
  <div class="vite-tag">⚡ ${badge} · Preview</div>
</body>
</html>`;
}

/**
 * Finalize HTML: randomize structure (anti-fingerprinting) then inject tracking.
 * Applied to ALL template outputs — bolt.new, Lovable, Astro, plain HTML.
 * Order matters: randomize BEFORE tracking so tracking scripts stay intact.
 */
function finalizeHtml(html, site) {
  const randomized = randomizeHtmlStructure(html, site?.id);
  return ensureTrackingBaselineHtml(randomized, site);
}

function ensureTrackingBaselineHtml(html, site) {
  let content = String(html || '');
  if (!content) return content;

  // Strip hsl(var(--...)) CSS variable references from window.tailwind.config script.
  // Tailwind CDN cannot parse CSS variables in config and throws "Unexpected token '}'".
  content = content.replace(
    /(<script[^>]*>)(window\.tailwind\s*=[\s\S]*?<\/script>)/gi,
    (match, open, body) => {
      const cleaned = body.replace(/hsl\(var\([^)]+\)\)/g, '#000000');
      return open + cleaned;
    }
  );

  const domain = String(site?.domain || '').trim();
  const conversionId = String(site?.conversionId || site?.gtagId || '').trim();
  const hasPixel = /sendBeacon|__fusionopsTrack|window\.__pixel/i.test(content);
  const hasEventMarkers = /form_start|form_submit|gtag\(/i.test(content);

  let next = content;
  const pixelScript = !hasPixel ? `
<script>
(function(){
  try {
    var endpoint = '/e';
    window.__fusionopsTrack = window.__fusionopsTrack || function(eventName, extra){
      var payload = Object.assign({ e: eventName, d: ${domain ? `'${domain}'` : "window.location.hostname"}, ts: Date.now() }, extra || {});
      try { navigator.sendBeacon(endpoint, JSON.stringify(payload)); } catch (_e) {}
    };
    if (!window.__fusionopsPageTracked) {
      window.__fusionopsPageTracked = true;
      window.__fusionopsTrack('pv');
    }
  } catch (_e) {}
})();
</script>` : '';

  const gtagScript = !hasEventMarkers ? `
<script>
(function(){
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  if (${conversionId ? "true" : "false"}) {
    try { gtag('js', new Date()); gtag('config', '${conversionId}'); } catch (_e) {}
  }
  window.__fusionopsTrackStart = function(){
    try { gtag('event', 'form_start'); } catch (_e) {}
    try { window.__fusionopsTrack && window.__fusionopsTrack('form_start'); } catch (_e) {}
  };
  window.__fusionopsTrackSubmit = function(){
    try { gtag('event', 'form_submit'); } catch (_e) {}
    try { window.__fusionopsTrack && window.__fusionopsTrack('form_submit'); } catch (_e) {}
  };
})();
</script>` : '';

  const injection = `${pixelScript}${gtagScript}`;
  if (!injection.trim()) return next;
  if (next.includes('</body>')) return next.replace('</body>', `${injection}\n</body>`);
  return `${next}\n${injection}`;
}

// Format loan amount — return plain number string (no $ prefix)
// Templates that want $ should write $${amountMax} in their HTML
function formatAmount(val, fallback) {
  if (val === undefined || val === null || val === '') return Number(fallback).toLocaleString();
  if (typeof val === 'number') return val.toLocaleString();
  const s = String(val).trim();
  if (s.startsWith('$')) return s.slice(1); // strip existing $ if present
  const n = Number(s.replace(/[^0-9.]/g, ''));
  if (!isNaN(n) && s !== '') return n.toLocaleString();
  return s;
}

// Convert Astro files to HTML preview with actual site data
function astroToHtmlPreview(files, site, options = {}) {
  const entryCandidates = options.entryCandidates || ['src/pages/index.astro', 'index.astro'];
  const htmlFallbackCandidates = options.htmlFallbackCandidates || ['index.html'];

  let indexContent = null;
  const resolvedEntry = resolveTemplateEntry(files);
  const preferredEntryCandidates = resolvedEntry.entry
    ? [resolvedEntry.entry, ...entryCandidates.filter(candidate => candidate !== resolvedEntry.entry)]
    : entryCandidates;
  for (const candidate of preferredEntryCandidates) {
    const direct = files[candidate];
    if (direct) {
      indexContent = direct;
      break;
    }
    const key = Object.keys(files).find(k => k.endsWith(`/${candidate}`) || k.endsWith(candidate));
    if (key && files[key]) {
      indexContent = files[key];
      break;
    }
  }

  if (!indexContent) {
    for (const candidate of htmlFallbackCandidates) {
      const direct = files[candidate];
      if (direct) return String(direct);
      const key = Object.keys(files).find(k => k.endsWith(`/${candidate}`) || k.endsWith(candidate));
      if (key && files[key]) return String(files[key]);
    }
  }

  if (!indexContent) {
    console.warn("[Router] No index.astro found in files keys:", Object.keys(files));
    return '<div style="padding:20px;text-align:center;color:#ef4444;background:#ef444410;border-radius:12px;border:1px solid #ef444430;"><b>Preview Error:</b> No index.astro found in template project</div>';
  }

  // If the file is plain HTML (no Astro frontmatter), return it directly
  // to avoid corrupting JS template literals in script blocks
  const hasAstroFrontmatter = /^---[\s\S]*?---/m.test(indexContent.trimStart());
  if (!hasAstroFrontmatter) {
    const fallbackVars = `<script>var conversionId='';var formStartLabel='';var formSubmitLabel='';var voluumDomain='';var id='preview';var defaultValue=0;var leadsGateFormId='';</script>`;
    if (indexContent.includes('</head>')) {
      return indexContent.replace('</head>', fallbackVars + '\n</head>');
    }
    return indexContent;
  }

  // Get color object for this site
  const colorObj = getColorObj(site.colorId);

  // Build normalized site object with all expected properties
  // Map wizard fields to template variable names
  //
  // phone: auto-generated from domain+brand — display only, no tel: href
  // Same domain always generates the same number (deterministic)
  const autoPhone = generatePhone(site.domain || '', site.brand || '');
  const normalizedSite = {
    brand: site.brand || '',
    title: site.h1 || site.brand || 'Your Title',
    description: site.sub || site.tagline || 'Your description',
    domain: site.domain || 'example.com',
    h1: site.h1 || site.brand || 'Your Headline',
    h1span: site.h1span || 'Get Started',
    sub: site.sub || 'Your subheadline here',
    cta: site.cta || 'Get Started',
    title2: site.title2 || 'Featured',
    email: site.email || `support@${site.domain || 'example.com'}`,
    phone: site.phone || autoPhone,
    conversionId: site.conversionId || '',
    formStartLabel: site.formStartLabel || '',
    formSubmitLabel: site.formSubmitLabel || '',
    aid: site.aid || '',
    voluumDomain: site.voluumDomain || '',
    amountMin: formatAmount(site.amountMin, 100),
    amountMax: formatAmount(site.amountMax, 5000),
    amountMinRaw: String(Math.round(Number(String(site.amountMin || 100).replace(/[^0-9.]/g, '')) || 100)),
    amountMaxRaw: String(Math.round(Number(String(site.amountMax || 5000).replace(/[^0-9.]/g, '')) || 5000)),
    aprMin: site.aprMin || 5.99,
    aprMax: site.aprMax || 35.99,
    loanLabel: site.loanLabel || site.loanType || 'Personal Finance',
    address: site.address || generateBusinessAddress(site.domain || '', site.brand || ''),
    network: site.network || 'LeadsGate',
    redirectUrl: site.voluumClickUrl || site.redirectUrl || '#',
  };

  const localVars = {
    title: normalizedSite.title,
    description: normalizedSite.description,
    canonicalUrl: `https://${normalizedSite.domain}`,
    canonical: `https://${normalizedSite.domain}`,
  };

  // ── Build frontmatter var map from ALL .astro files in the template ──────────
  // Parses:  const varName = import.meta.env.PUBLIC_XXX || 'default'
  // Maps each varName → the wizard's live value from normalizedSite (or the default
  // fallback when wizard has no value), so {varName} expressions in the HTML body
  // are correctly substituted rather than wiped by the generic expression stripper.
  const PUBLIC_VAR_KEY_MAP = {
    PUBLIC_BRAND:          'brand',
    PUBLIC_DOMAIN:         'domain',
    PUBLIC_H1:             'h1',
    PUBLIC_SUB:            'sub',
    PUBLIC_CTA:            'cta',
    PUBLIC_TITLE2:         'title2',
    PUBLIC_PHONE:          'phone',
    PUBLIC_EMAIL:          'email',
    PUBLIC_ADDRESS:        'address',
    PUBLIC_AID:            'aid',
    PUBLIC_AMOUNTMIN:      'amountMin',
    PUBLIC_AMOUNTMAX:      'amountMax',
    PUBLIC_APRMIN:         'aprMin',
    PUBLIC_APRMAX:         'aprMax',
    PUBLIC_VOLUUMDOMAIN:   'voluumDomain',
    PUBLIC_VOLUUM_CLICK_URL: 'redirectUrl',
    PUBLIC_CONVERSIONID:   'conversionId',
    PUBLIC_FORMSTARTLABEL: 'formStartLabel',
    PUBLIC_FORMSUBMITLABEL:'formSubmitLabel',
  };

  // Collect all frontmatter blocks from all .astro files
  const frontmatterVarMap = {};
  for (const [fpath, fcontent] of Object.entries(files)) {
    if (!fpath.endsWith('.astro')) continue;
    const fmMatch = String(fcontent).match(/^---\n?([\s\S]*?)\n?---/m);
    if (!fmMatch) continue;
    const fmBlock = fmMatch[1];
    // Match: const varName = import.meta.env.PUBLIC_XXX || 'default'
    const declRe = /(?:const|let|var)\s+(\w+)\s*=\s*import\.meta\.env\.(PUBLIC_[A-Z0-9_]+)\s*(?:\|\|\s*(?:'([^']*)'|"([^"]*)"|\`([^`]*)\`|([^\n;,]+)))?/g;
    let dm;
    while ((dm = declRe.exec(fmBlock)) !== null) {
      const localVar  = dm[1];
      const envKey    = dm[2];
      const defVal    = dm[3] ?? dm[4] ?? dm[5] ?? dm[6] ?? '';
      const siteKey   = PUBLIC_VAR_KEY_MAP[envKey];
      const liveValue = siteKey ? String(normalizedSite[siteKey] ?? defVal) : defVal;
      frontmatterVarMap[localVar] = liveValue;
    }
    // Also handle: const ctaHref = voluumClickUrl || '#apply'  (derived var, no import.meta.env)
    const derivedRe = /(?:const|let|var)\s+(ctaHref)\s*=\s*(\w+)\s*\|\|\s*(?:'([^']*)'|"([^"]*)")/g;
    let dv;
    while ((dv = derivedRe.exec(fmBlock)) !== null) {
      const derivedVar  = dv[1];
      const sourceVar   = dv[2];
      const fallback    = dv[3] ?? dv[4] ?? '#apply';
      frontmatterVarMap[derivedVar] = frontmatterVarMap[sourceVar] || normalizedSite.redirectUrl || fallback;
    }
  }

  // Also inject amountMinRaw / amountMaxRaw (computed in frontmatter, not from env)
  frontmatterVarMap['amountMinRaw'] = normalizedSite.amountMinRaw;
  frontmatterVarMap['amountMaxRaw'] = normalizedSite.amountMaxRaw;

  // Basic Astro to HTML conversion for preview
  let html = indexContent;

  // Remove frontmatter if present from index content
  html = html.replace(/^---[\s\S]*?---/m, '');

  // Early strip: if source HTML has substantial inline CSS, remove any Tailwind CDN tags now
  // before any other processing — prevents CDN from conflicting with inline styles
  const earlyStyleMatch = html.match(/<style[\s\S]*?>([\s\S]*?)<\/style>/gi) || [];
  const earlyStyleContent = earlyStyleMatch.join('');
  if (earlyStyleContent.length > 200) {
    html = html.replace(/<script\b[^>]*src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*><\/script>/gi, '');
    html = html.replace(/<script\b[^>]*>\s*window\.tailwind\s*=[\s\S]*?<\/script>/g, '');
  }

  // Collect <style> blocks from component files to merge into index later
  const componentStyles = [];

  const resolveComponents = (content, filesMap) => {
    let resolved = content;
    const compFiles = Object.keys(filesMap).filter(k => k.endsWith('.astro') && !k.endsWith('index.astro'));

    // Sort so longer component names are matched first to prevent substring matching issues 
    const comps = compFiles.map(cf => ({
      name: cf.split('/').pop().replace('.astro', ''),
      content: filesMap[cf]
    })).sort((a, b) => b.name.length - a.name.length);

    for (const comp of comps) {
      if (!comp.name || !comp.content) continue;

      let compRaw = comp.content.replace(/^---[\s\S]*?---/m, '').trim();

      // Extract <style> blocks from component and collect them
      compRaw = compRaw.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (styleMatch, styleContent) => {
        if (styleContent.trim()) componentStyles.push(styleContent);
        return '';
      });

      let compBody = compRaw;

      // Handling <Comp>children</Comp> first
      const wrapRegex = new RegExp(`<${comp.name}[^>]*>([\\s\\S]*?)<\\/${comp.name}>`, 'g');
      resolved = resolved.replace(wrapRegex, (match, children) => {
        const slotRegex = new RegExp('<slot\\s*\\/?>|<slot>[\\s\\S]*?<\\/slot>', 'g');
        return compBody.replace(slotRegex, () => children);
      });

      // Handling <Comp /> or <Comp>
      const selfClosingRegex = new RegExp(`<${comp.name}\\s*\\/?>`, 'g');
      resolved = resolved.replace(selfClosingRegex, () => compBody);
    }
    return resolved;
  };

  for (let i = 0; i < 5; i++) {
    const prev = html;
    html = resolveComponents(html, files);
    if (prev === html) break;
  }

  // Pre-process ${} variables inside <style> blocks before protecting them
  // This ensures CSS custom properties like --color-primary: ${primaryColor} get resolved
  const colorObj2 = getColorObj(site.colorId);
  const _primaryColor = colorObj2.p ? `hsl(${colorObj2.p[0]}, ${colorObj2.p[1]}%, ${colorObj2.p[2]}%)` : '#3b82f6';
  const _accentColor = colorObj2.a ? `hsl(${colorObj2.a[0]}, ${colorObj2.a[1]}%, ${colorObj2.a[2]}%)` : '#f97316';
  const _bgColor = colorObj2.bg || '#ffffff';
  html = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, body, close) => {
    const resolved = body.replace(/\$\{primaryColor\}/g, _primaryColor)
                         .replace(/\$\{accentColor\}/g, _accentColor)
                         .replace(/\$\{bgColor\}/g, _bgColor);
    return open + resolved + close;
  });

  // Protect <style> blocks from Astro expression stripper — must happen before ${} replacement
  const styleBlocks = [];
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (m) => {
    const token = `__LP_STYLE_BLOCK_${styleBlocks.length}__`;
    styleBlocks.push(m);
    return token;
  });

  // Protect script blocks (except JSON-LD) from our string transforms
  // Also strip TypeScript syntax so Astro templates with TS scripts run in the browser.
  const scriptBlocks = [];
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
    // Keep JSON-LD scripts editable so ${...} interpolation can be resolved.
    // If left untouched, JSON-LD may contain template syntax and break parsing.
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) {
      return m;
    }
    // Skip external scripts — nothing to strip
    if (/\bsrc\s*=/.test(attrs)) {
      const token = `__LP_SCRIPT_BLOCK_${scriptBlocks.length}__`;
      scriptBlocks.push(m);
      return token;
    }
    const strippedBody = stripTypeScriptFromScript(body);
    const token = `__LP_SCRIPT_BLOCK_${scriptBlocks.length}__`;
    scriptBlocks.push(`<script${attrs}>${strippedBody}</script>`);
    return token;
  });

  // Replace template literals with actual site data for preview
  // Use a more robust regex that handles nested braces and complex expressions
  const templateLiteralRegex = /\$\{([^{}]+|\{[^{}]*\})*\}/g;

  html = html.replace(templateLiteralRegex, (match) => {
    // Extract the expression inside ${}
    const expr = match.slice(2, -1).trim();

    // Helper: evaluate simple expressions like site.xxx || "default"
    const evaluateSiteProp = (prop, defaultValue = '') => {
      // Direct access: site.brand
      if (expr === `site.${prop}` || expr === prop) {
        return normalizedSite[prop] || defaultValue;
      }
      // With fallback: site.brand || "Default"
      if (expr.startsWith(`site.${prop} ||`)) {
        const fallback = expr.slice(expr.indexOf('||') + 2).trim().replace(/^["']|["']$/g, '');
        return normalizedSite[prop] || fallback;
      }
      // With fallback using parens: (site.brand || "Default")
      if (expr.startsWith(`(site.${prop}`) && expr.includes('||')) {
        const fallback = expr.slice(expr.indexOf('||') + 2).trim().replace(/^["']|["']\)?$/g, '');
        return normalizedSite[prop] || fallback;
      }
      return null;
    };

    // Brand and text content
    const brand = evaluateSiteProp('brand', 'Your Brand');
    if (brand !== null) return brand;

    const title = evaluateSiteProp('title', 'Your Title');
    if (title !== null) return title;

    const description = evaluateSiteProp('description', 'Your description');
    if (description !== null) return description;

    const h1 = evaluateSiteProp('h1', 'Your Headline');
    if (h1 !== null) return h1;

    const h1span = evaluateSiteProp('h1span', 'Get Started');
    if (h1span !== null) return h1span;

    const sub = evaluateSiteProp('sub', 'Your subheadline here');
    if (sub !== null) return sub;

    const cta = evaluateSiteProp('cta', 'Get Started');
    if (cta !== null) return cta;

    const title2 = evaluateSiteProp('title2', 'Featured');
    if (title2 !== null) return title2;

    const domain = evaluateSiteProp('domain', 'example.com');
    if (domain !== null) return domain;

    const email = evaluateSiteProp('email', 'support@example.com');
    if (email !== null) return email;

    const phone = evaluateSiteProp('phone', '');
    if (phone !== null) return phone;

    // Numeric / amount variables
    const amountMin = evaluateSiteProp('amountMin', '100');
    if (amountMin !== null) return String(amountMin);

    const amountMax = evaluateSiteProp('amountMax', '5000');
    if (amountMax !== null) return String(amountMax);

    const amountMinRaw = evaluateSiteProp('amountMinRaw', '100');
    if (amountMinRaw !== null) return String(amountMinRaw);

    const amountMaxRaw = evaluateSiteProp('amountMaxRaw', '5000');
    if (amountMaxRaw !== null) return String(amountMaxRaw);

    const aprMin = evaluateSiteProp('aprMin', '5.99');
    if (aprMin !== null) return String(aprMin);

    const aprMax = evaluateSiteProp('aprMax', '35.99');
    if (aprMax !== null) return String(aprMax);

    const loanLabel = evaluateSiteProp('loanLabel', 'Personal Finance');
    if (loanLabel !== null) return loanLabel;

    const address = evaluateSiteProp('address', '');
    if (address !== null) return address;

    const network = evaluateSiteProp('network', 'LeadsGate');
    if (network !== null) return network;

    const redirectUrl = evaluateSiteProp('redirectUrl', '#');
    if (redirectUrl !== null) return redirectUrl;

    const primaryColor = evaluateSiteProp('primaryColor', '#3b82f6');
    if (primaryColor !== null) return primaryColor;

    const accentColor = evaluateSiteProp('accentColor', '#f97316');
    if (accentColor !== null) return accentColor;

    // Color variables - c.primary, c.bg, etc.
    if (expr.includes('c.primary') || expr === 'c?.primary') return colorObj.p ? `hsl(${colorObj.p[0]} ${colorObj.p[1]}% ${colorObj.p[2]}%)` : '#3b82f6';
    if (expr.includes('c.bg') || expr === 'c?.bg') return colorObj.bg || '#ffffff';
    if (expr.includes('c.text') || expr === 'c?.text') return colorObj.text || '#1a1a1a';
    if (expr.includes('c.muted') || expr === 'c?.muted') return colorObj.muted || '#6b7280';
    if (expr.includes('c.border') || expr === 'c?.border') return colorObj.border || '#e5e7eb';

    // Fallback for other c. references
    if (expr.startsWith('c.') || expr.startsWith('c?.')) return '#3b82f6';

    // For any other expression, try to extract site.xxx pattern
    const sitePropMatch = expr.match(/site\.(\w+)/);
    if (sitePropMatch) {
      const propName = sitePropMatch[1];
      return String(normalizedSite[propName] ?? '');
    }

    // Log unmatched expressions for debugging
    if (!expr.startsWith('site.') && !expr.startsWith('c.')) {
      console.debug('[Router] Unmatched template literal:', expr);
    }

    // Keep original if no match
    return match;
  });

  // Replace/strip Astro expression blocks like {year}, {t.name}, {faqs.map(...)}
  // We do this AFTER ${...} replacements, and only outside <script> blocks.
  const year = String(new Date().getFullYear());
  html = html.replace(/\{\s*year\s*\}/g, year);
  // Replace bare local variables commonly used in <head>.
  html = html.replace(/\{\s*(title|description|canonicalUrl|canonical)\s*\}/g, (_m, key) => localVars[key] || '');

  // ── Astro JSX array map evaluator ──────────────────────────────────────────
  // Handles: {items.map((item, i) => (<Tag ...>{item.prop}</Tag>))}
  // Strategy: extract the array literal from the frontmatter/component scope,
  // then render each item by substituting {item.X} / {i} placeholders.
  //
  // We scan all .astro files in the template for const/let array declarations,
  // build a lookup map, then evaluate each {varName.map(...)} block.
  const arrayScope = {};
  for (const [fpath, fcontent] of Object.entries(files)) {
    if (!fpath.endsWith('.astro') && !fpath.endsWith('.ts') && !fpath.endsWith('.js')) continue;
    // Match: const steps = [ ... ] or const steps = [\n...\n];
    const arrRe = /(?:const|let|var)\s+(\w+)\s*=\s*(\[(?:[\s\S]*?)\]);/g;
    let m;
    while ((m = arrRe.exec(fcontent)) !== null) {
      const varName = m[1];
      const arrText = m[2];
      try {
        // Safe eval using Function with no global access — only parses object literals
        // eslint-disable-next-line no-new-func
        const parsed = Function('"use strict"; return (' + arrText + ')')();
        if (Array.isArray(parsed)) arrayScope[varName] = parsed;
      } catch (_) { /* skip unparseable arrays */ }
    }
  }

  // Evaluate {varName.map((item[, idx]) => (JSX))} blocks
  // We use a bracket-depth counter to correctly extract the full map() call
  function extractMapBlock(src, startIdx) {
    let depth = 0, i = startIdx;
    while (i < src.length) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(startIdx, i + 1); }
      i++;
    }
    return null;
  }

  // Replace all {X.map(...)} occurrences
  let safeHtml = '';
  let cursor = 0;
  const mapTrigger = /\{\s*(\w+)\.map\s*\(/g;
  let mt;
  while ((mt = mapTrigger.exec(html)) !== null) {
    const varName = mt[1];
    const blockStart = mt.index;
    const block = extractMapBlock(html, blockStart);
    if (!block) continue;

    safeHtml += html.slice(cursor, blockStart);
    cursor = blockStart + block.length;

    const arr = arrayScope[varName];
    if (!arr || !Array.isArray(arr)) {
      // Array not found in scope — drop the block silently
      continue;
    }

    // Extract the arrow function body (the JSX template for each item)
    // Pattern: (item, i) => (JSX) or item => (JSX) or (item) => JSX
    const arrowMatch = block.match(/\.map\s*\(\s*(?:\(([^)]+)\)|([\w$]+))\s*=>\s*/);
    if (!arrowMatch) continue;

    const paramStr = (arrowMatch[1] || arrowMatch[2] || 'item').trim();
    const params = paramStr.split(',').map(p => p.trim());
    const itemParam = params[0] || 'item';
    const idxParam = params[1] || '__idx__';

    // Find JSX body after the =>
    const arrowPos = block.indexOf('=>');
    if (arrowPos === -1) continue;
    let jsxBody = block.slice(arrowPos + 2).trim();
    // Strip outer parens if present: ( ... ) or just start JSX directly
    if (jsxBody.startsWith('(')) {
      // Remove matching outer parens
      let pd = 0, end = 0;
      for (let ci = 0; ci < jsxBody.length; ci++) {
        if (jsxBody[ci] === '(') pd++;
        else if (jsxBody[ci] === ')') { pd--; if (pd === 0) { end = ci; break; } }
      }
      jsxBody = jsxBody.slice(1, end);
    }
    // Remove trailing }) that closes the .map() call
    jsxBody = jsxBody.replace(/\s*\)\s*\}?\s*$/, '').trim();

    // Render each array item
    let rendered = '';
    arr.forEach((item, idx) => {
      let itemHtml = jsxBody;
      // Replace {idx} / {i} / {index} style index references
      itemHtml = itemHtml.replace(new RegExp('\\{\\s*' + idxParam + '\\s*\\}', 'g'), String(idx));
      // Replace {item.prop} style access
      if (typeof item === 'object' && item !== null) {
        for (const [key, val] of Object.entries(item)) {
          const escaped = String(val ?? '');
          // {item.key}, {itemParam.key}
          itemHtml = itemHtml.replace(new RegExp('\\{\\s*' + itemParam + '\\.' + key + '\\s*\\}', 'g'), escaped);
          // {key} bare (sometimes templates omit the prefix inside JSX)
          itemHtml = itemHtml.replace(new RegExp('(?<!\\.)\\{\\s*' + key + '\\s*\\}', 'g'), escaped);
        }
        // {item} itself as a string
        itemHtml = itemHtml.replace(new RegExp('\\{\\s*' + itemParam + '\\s*\\}', 'g'), JSON.stringify(item));
      } else {
        // Primitive array
        itemHtml = itemHtml.replace(new RegExp('\\{\\s*' + itemParam + '\\s*\\}', 'g'), String(item ?? ''));
      }
      rendered += itemHtml + '\n';
    });
    safeHtml += rendered;
    // Reset lastIndex since we modified cursor manually
    mapTrigger.lastIndex = cursor;
  }
  safeHtml += html.slice(cursor);
  html = safeHtml;
  // ── end map evaluator ───────────────────────────────────────────────────────

  // ── Substitute frontmatter vars: {varName} → live wizard value ───────────────
  // Must run BEFORE the generic stripper so {h1}, {brand}, {cta}, {ctaHref}, etc.
  // declared via `const varName = import.meta.env.PUBLIC_XXX || '...'` get filled
  // with real data instead of being wiped as unknown expressions.
  if (Object.keys(frontmatterVarMap).length > 0) {
    // Sort by length descending so longer names match first (e.g. amountMinRaw > amountMin)
    const sortedVars = Object.keys(frontmatterVarMap).sort((a, b) => b.length - a.length);
    for (const varName of sortedVars) {
      const value = String(frontmatterVarMap[varName] ?? '');
      // Replace {varName} but NOT {varName.something} (those are handled by dot-prop stripper)
      const re = new RegExp('\\{\\s*' + varName + '\\s*\\}(?!\\.)', 'g');
      html = html.replace(re, value);
    }
  }

  // Remove simple interpolations like {t.name} or {f.a} (leftovers after map eval)
  html = html.replace(/\{\s*[a-zA-Z_$][\w$]*\.[\w$]+\s*\}/g, '');
  // Remove conditional expression blocks that cannot be rendered in plain HTML.
  html = html.replace(/\{\s*[a-zA-Z_$][\w$]*\s*&&\s*\([\s\S]*?\)\s*\}/g, '');
  html = html.replace(/\{\s*[a-zA-Z_$][\w$]*\s*\?[\s\S]*?:[\s\S]*?\}/g, '');
  // Final pass: strip any remaining non-placeholder Astro expression blocks.
  html = html.replace(/\{[^{}]+\}/g, (m) => (/^\{[A-Za-z0-9_$\s.-]+\}$/.test(m) ? m : ''));

  // Restore protected style blocks
  if (styleBlocks.length) {
    html = html.replace(/__LP_STYLE_BLOCK_(\d+)__/g, (_m, idx) => styleBlocks[Number(idx)] || '');
  }

  // Detect Tailwind usage early — needed by inline CSS stripping decision below
  const usesTailwindClassesEarly = /class="[^"]*\b(bg-(?:blue|red|green|gray|white|black|slate|zinc|orange|yellow|purple|pink|indigo|teal|cyan|lime|emerald|violet|fuchsia|rose|amber|sky|neutral|stone|warm|cool|dark|light)-\d|text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)|text-(?:blue|red|green|gray|white|black|slate)-\d|p-\d+\b|px-\d+\b|py-\d+\b|pt-\d+\b|pb-\d+\b|pl-\d+\b|pr-\d+\b|m-\d+\b|mx-\d+\b|my-\d+\b|mt-\d+\b|mb-\d+\b|ml-\d+\b|mr-\d+\b|gap-\d+\b|w-\d+\b|h-\d+\b|flex-col\b|flex-row\b|flex-wrap\b|grid-cols-|items-center\b|items-start\b|items-end\b|justify-center\b|justify-between\b|justify-start\b|rounded-(?:sm|md|lg|xl|full)\b|border-\d+\b|font-bold\b|font-semibold\b|font-medium\b|leading-\d|tracking-wide|space-x-|space-y-|overflow-hidden\b|overflow-auto\b|z-\d+\b|min-h-|max-w-)\b/.test(html);

  // If template has substantial inline CSS (> 200 chars) AND does NOT use Tailwind utility
  // classes, strip any Tailwind CDN — it overrides inline CSS and breaks layout.
  // But if template USES Tailwind utilities, keep the CDN — inline CSS is supplementary.
  const inlineStyleContent = styleBlocks.concat(componentStyles).join('');
  const hasSubstantialInlineCss = inlineStyleContent.length > 200 && !usesTailwindClassesEarly;
  if (hasSubstantialInlineCss) {
    // Remove <script> tags that load Tailwind CDN from the source HTML
    html = html.replace(/<script\b[^>]*src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*><\/script>/gi, '');
    // Remove tailwind config script that was injected previously
    html = html.replace(/<script>window\.tailwind\s*=[\s\S]*?<\/script>/g, '');
    // Restore scriptBlocks without Tailwind CDN
    for (let i = 0; i < scriptBlocks.length; i++) {
      if (scriptBlocks[i].includes('cdn.tailwindcss.com')) scriptBlocks[i] = '';
    }
  }

  // Clean up Astro-specific attributes that cause browser errors
  html = html.replace(/<!doctype html>/gi, '<!DOCTYPE html>');
  html = html.replace(/\s+is:global/g, '');
  html = html.replace(/\s+is:inline/g, '');
  // Strip define:vars={{ ... }} — handles single and multi-variable, single/multi-line
  html = html.replace(/\s+define:vars=\{\{[^}]*(?:\}[^}][^}]*)*\}\}/g, '');

  // Inject fallback variable definitions before </head> to prevent ReferenceErrors
  const fallbackVars = `<script>var conversionId='';var formStartLabel='';var formSubmitLabel='';var voluumDomain='';var id='preview';var defaultValue=0;var leadsGateFormId='';</script>`;

  // Inject Tailwind CDN only if template uses Tailwind utility classes AND has no substantial inline CSS.
  const hasTailwindCdn = !hasSubstantialInlineCss && (
    html.includes('cdn.tailwindcss.com') ||
    scriptBlocks.some(b => b.includes('cdn.tailwindcss.com'))
  );
  // Only inject Tailwind if HTML uses unambiguous Tailwind utility class patterns
  // e.g. bg-blue-500, text-xl, p-4, flex, gap-4 — NOT generic names like container/section/hero
  // Tailwind compound utility patterns only — standalone 'flex'/'grid'/'hidden' are too common
  // in vanilla CSS class names like "flex-wrapper", "grid-layout", "hero", "badges-grid"
  const usesTailwindClasses = /class="[^"]*\b(bg-(?:blue|red|green|gray|white|black|slate|zinc|orange|yellow|purple|pink|indigo|teal|cyan|lime|emerald|violet|fuchsia|rose|amber|sky|neutral|stone|warm|cool|dark|light)-\d|text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)|text-(?:blue|red|green|gray|white|black|slate)-\d|p-\d+\b|px-\d+\b|py-\d+\b|pt-\d+\b|pb-\d+\b|pl-\d+\b|pr-\d+\b|m-\d+\b|mx-\d+\b|my-\d+\b|mt-\d+\b|mb-\d+\b|ml-\d+\b|mr-\d+\b|gap-\d+\b|w-\d+\b|h-\d+\b|flex-col\b|flex-row\b|flex-wrap\b|grid-cols-|items-center\b|items-start\b|items-end\b|justify-center\b|justify-between\b|justify-start\b|rounded-(?:sm|md|lg|xl|full)\b|border-\d+\b|font-bold\b|font-semibold\b|font-medium\b|leading-\d|tracking-wide|space-x-|space-y-|overflow-hidden\b|overflow-auto\b|z-\d+\b|min-h-|max-w-)\b/.test(html);
  const needsTailwind = hasTailwindCdn || usesTailwindClasses;

  const primaryHsl = colorObj.p ? `hsl(${colorObj.p[0]} ${colorObj.p[1]}% ${colorObj.p[2]}%)` : '#2563EB';
  const accentHsl = colorObj.a ? `hsl(${colorObj.a[0]} ${colorObj.a[1]}% ${colorObj.a[2]}%)` : '#F97316';
  const secondaryHsl = colorObj.s ? `hsl(${colorObj.s[0]} ${colorObj.s[1]}% ${colorObj.s[2]}%)` : '#10B981';
  const backgroundHsl = colorObj.bg ? `hsl(${colorObj.bg[0]} ${colorObj.bg[1]}% ${colorObj.bg[2]}%)` : '#F8FAFC';
  const foregroundHsl = colorObj.fg ? `hsl(${colorObj.fg[0]} ${colorObj.fg[1]}% ${colorObj.fg[2]}%)` : '#0F172A';
  const tailwindConfigScript = `<script>window.tailwind = window.tailwind || {}; window.tailwind.config = {theme: {extend: {colors: {primary: {DEFAULT: '${primaryHsl}', foreground: '#ffffff'}, accent: {DEFAULT: '${accentHsl}'}, secondary: {DEFAULT: '${secondaryHsl}'}, background: '${backgroundHsl}', foreground: '${foregroundHsl}'}, boxShadow: {cta: '0 4px 14px 0 hsl(40 90% 55% / 0.4)', card: '0 10px 15px -3px hsl(350 75% 38% / 0.08), 0 4px 6px -4px hsl(350 75% 38% / 0.06)'}} } } };</script>`;
  const tailwindCdnScript = `<script src="https://cdn.tailwindcss.com"></script>`;
  const tailwindFallbackCss = `<style>\n.shadow-cta{box-shadow:0 4px 14px 0 hsl(40 90% 55% / 0.4)}\n.shadow-card{box-shadow:0 10px 15px -3px hsl(350 75% 38% / 0.08),0 4px 6px -4px hsl(350 75% 38% / 0.06)}\n</style>`;
  const tailwindCdn = needsTailwind && !hasTailwindCdn ? `${tailwindConfigScript}\n${tailwindCdnScript}\n${tailwindFallbackCss}` : '';

  // ── Design token CSS vars override ─────────────────────────────────────────
  // Injected as highest-specificity :root override so colorId/radius changes
  // from the wizard are reflected in the preview for templates that use
  // CSS custom properties like --primary, --accent, --background, --radius.
  // Values are in "H S% L%" space-separated format (matches shadcn/Tailwind convention).
  const hslVals = (arr) => arr ? `${arr[0]} ${arr[1]}% ${arr[2]}%` : null;
  const RADIUS_MAP_PREVIEW = { sharp: '0rem', subtle: '0.375rem', rounded: '0.75rem', pill: '1.5rem' };
  const radiusVal = RADIUS_MAP_PREVIEW[site.radius] || RADIUS_MAP_PREVIEW[site.radiusId] || '0.75rem';
  const FONT_IMPORTS_PREVIEW = {
    'dm-sans':       'DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700',
    'plus-jakarta':  'Plus+Jakarta+Sans:wght@400;600;700',
    'outfit':        'Outfit:wght@400;500;600;700',
    'manrope':       'Manrope:wght@400;500;600;700',
    'inter':         'Inter:wght@400;500;600;700',
    'space-grotesk': 'Space+Grotesk:wght@400;500;600;700',
    'sora':          'Sora:wght@400;600;700',
    'figtree':       'Figtree:wght@400;500;600;700',
  };
  const FONT_FAMILY_PREVIEW = {
    'dm-sans':       '"DM Sans", system-ui, sans-serif',
    'plus-jakarta':  '"Plus Jakarta Sans", system-ui, sans-serif',
    'outfit':        '"Outfit", system-ui, sans-serif',
    'manrope':       '"Manrope", system-ui, sans-serif',
    'inter':         '"Inter", system-ui, sans-serif',
    'space-grotesk': '"Space Grotesk", system-ui, sans-serif',
    'sora':          '"Sora", system-ui, sans-serif',
    'figtree':       '"Figtree", system-ui, sans-serif',
  };
  const fontId = site.fontId || 'dm-sans';
  const fontImport = FONT_IMPORTS_PREVIEW[fontId] || FONT_IMPORTS_PREVIEW['dm-sans'];
  const fontFamily = FONT_FAMILY_PREVIEW[fontId] || FONT_FAMILY_PREVIEW['dm-sans'];
  const fontLinkTag = `<link href="https://fonts.googleapis.com/css2?family=${fontImport}&display=swap" rel="stylesheet">`;
  const colorOverrideCss = [
    colorObj.p  ? `--primary:${hslVals(colorObj.p)};` : '',
    colorObj.s  ? `--secondary:${hslVals(colorObj.s)};` : '',
    colorObj.a  ? `--accent:${hslVals(colorObj.a)};` : '',
    colorObj.bg ? `--background:${hslVals(colorObj.bg)};` : '',
    colorObj.fg ? `--foreground:${hslVals(colorObj.fg)};` : '',
    `--radius:${radiusVal};`,
    `--ring:${colorObj.p ? hslVals(colorObj.p) : ''};`,
  ].filter(Boolean).join('');
  const designTokenOverride = `<style>
/* LP Factory: Design token override for preview */
:root{${colorOverrideCss}}
body{font-family:${fontFamily}!important;}
</style>
${fontLinkTag}`;

  // Merge component styles collected during resolveComponents
  const componentStylesBlock = componentStyles.length > 0
    ? `<style>\n/* Merged from component files */\n${componentStyles.join('\n')}\n</style>`
    : '';

  const headInjections = fallbackVars + '\n' + designTokenOverride + '\n' + tailwindCdn + (componentStylesBlock ? '\n' + componentStylesBlock : '');

  if (html.includes('</head>')) {
    html = html.replace('</head>', headInjections + '\n</head>');
  } else {
    html = headInjections + '\n' + html;
  }

  // Restore protected script blocks (strip Tailwind CDN scripts if template has inline CSS)
  if (scriptBlocks.length) {
    html = html.replace(/__LP_SCRIPT_BLOCK_(\d+)__/g, (_m, idx) => {
      let block = scriptBlocks[Number(idx)] || '';
      if (hasSubstantialInlineCss && block.includes('cdn.tailwindcss.com')) return '';
      return block;
    });
  }

  return html;
}


export function renderTemplateToAssets(template, site) {
  const assets = {};
  const files = template.files || {};

  console.log('[Router] renderTemplateToAssets - files keys:', Object.keys(files));
  console.log('[Router] renderTemplateToAssets - looking for index.astro');

  // 1. Compile index.html
  let html = astroToHtmlPreview(files, site, {
    entryCandidates: ['src/pages/index.astro', 'index.astro'],
    htmlFallbackCandidates: ['index.html'],
  });

  // Validate HTML was generated
  if (!html || html.length < 100 || html.includes('Preview Error') || html.includes('No index.astro found')) {
    console.error('[Router] Custom template entry invalid, fallback to classic HTML');
    html = generateLP(site);
  }

  // Debug: check if HTML was generated
  console.log('[Router] astroToHtmlPreview result length:', html?.length);

  const trackedIndexHtml = finalizeHtml(html, site);
  assets["/index.html"] = trackedIndexHtml;
  assets["/"] = trackedIndexHtml;

  // Compile optional apply page into /apply.html for one-flow runtime parity
  const applyHtml = astroToHtmlPreview(files, site, {
    entryCandidates: ['src/pages/apply.astro', 'apply.astro'],
    htmlFallbackCandidates: ['apply.html'],
  });
  if (
    applyHtml &&
    applyHtml.length > 80 &&
    !applyHtml.includes('Preview Error') &&
    !applyHtml.includes('No index.astro found')
  ) {
    const trackedApplyHtml = finalizeHtml(applyHtml, site);
    assets["/apply.html"] = trackedApplyHtml;
    assets["/apply"] = trackedApplyHtml;
  }

  // 2. Map all other files into assets
  Object.keys(files).forEach(path => {
    // If it's the index, we already handled it
    if (path.endsWith('index.astro') || path.endsWith('apply.astro') || path.endsWith('/index.html') || path.endsWith('/apply.html') || path === 'index.html' || path === 'apply.html' || path === 'package.json') return;

    // Normalize path for CF Workers/Pages mapping
    let deployPath = path;
    if (deployPath.startsWith('public/')) {
      deployPath = '/' + deployPath.slice(7);
    } else if (deployPath.startsWith('src/')) {
      // Typically src/ files shouldn't be served, but some custom templates
      // might link directly to them like src/styles/global.css
      deployPath = '/' + deployPath;
    } else {
      // Just prepend slash if needed
      deployPath = deployPath.startsWith('/') ? deployPath : '/' + deployPath;
    }

    // Add only if not already there (prefer root/public files if conflict)
    if (!assets[deployPath]) {
      assets[deployPath] = files[path];
    }
  });

  // Inject CSS directly into HTML if a global.css is found and it doesn't already have it linked 
  // (to help uncompiled Astro templates)
  const cssPaths = Object.keys(files).filter(k => k.endsWith('.css'));
  if (cssPaths.length > 0) {
    let combinedCss = '';
    for (const cp of cssPaths) {
      combinedCss += files[cp] + '\n';
    }
    if (combinedCss) {
      // If the imported CSS is Tailwind *source* (contains @tailwind/@apply),
      // the browser can't apply it directly. In that case, let the Tailwind CDN
      // compiler handle it via type="text/tailwindcss".
      const isTailwindSourceCss = /@tailwind\s+(base|components|utilities)\s*;|@apply\s+|@config\s+|@plugin\s+/m.test(combinedCss);

      if (isTailwindSourceCss) {
        const hasShadowCtaUsage = /(^|\s)shadow-cta(\s|;|$)/m.test(combinedCss);
        const hasShadowCardUsage = /(^|\s)shadow-card(\s|;|$)/m.test(combinedCss);
        const definesShadowCta = /\.shadow-cta\b/m.test(combinedCss);
        const definesShadowCard = /\.shadow-card\b/m.test(combinedCss);

        if ((hasShadowCtaUsage && !definesShadowCta) || (hasShadowCardUsage && !definesShadowCard)) {
          const shadowUtilities = `\n@layer utilities {\n` +
            `${hasShadowCtaUsage && !definesShadowCta ? `  .shadow-cta { box-shadow: 0 4px 14px 0 hsl(40 90% 55% / 0.4); }\n` : ''}` +
            `${hasShadowCardUsage && !definesShadowCard ? `  .shadow-card { box-shadow: 0 10px 15px -3px hsl(350 75% 38% / 0.08), 0 4px 6px -4px hsl(350 75% 38% / 0.06); }\n` : ''}` +
            `}\n`;
          combinedCss += shadowUtilities;
        }
      }

      const styleTagOpen = isTailwindSourceCss ? '<style type="text/tailwindcss">' : '<style>';
      const styleInjection = `${styleTagOpen}\n/* Injected from custom template CSS */\n${combinedCss}</style>\n</head>`;
      assets["/index.html"] = finalizeHtml(assets["/index.html"].replace('</head>', styleInjection), site);
      assets["/"] = assets["/index.html"];
    }
  }

  return assets;
}

export function generateHtmlByTemplate(site) {
  const templateId = resolveTemplateId(site);

  // ─── Anti-fingerprinting: Plain HTML generator (no framework) ───
  if (shouldUsePlainHtml(site)) {
    return finalizeHtml(generatePlainHtml(site), site);
  }

  const entry = registry[templateId];

  if (entry?.adapter) {
    emitTemplateRuntimeEvent('template_render_start', {
      templateId: site?.templateId,
      adapterId: entry.adapter.id,
      adapterVersion: entry.adapter.version,
    });

    if (entry.adapter.version !== ADAPTER_RUNTIME_VERSION) {
      emitTemplateRuntimeEvent('template_version_mismatch', {
        templateId: site?.templateId,
        adapterId: entry.adapter.id,
        expected: ADAPTER_RUNTIME_VERSION,
        received: entry.adapter.version,
      });

      throw new TemplateRuntimeError({
        code: 'TEMPLATE_ADAPTER_VERSION_MISMATCH',
        message: 'Adapter runtime version mismatch',
        templateId: site?.templateId,
        adapterId: entry.adapter.id,
        details: {
          expected: ADAPTER_RUNTIME_VERSION,
          received: entry.adapter.version,
        },
      });
    }

    const result = entry.adapter.validate(site);
    if (!result.valid) {
      emitTemplateRuntimeEvent('template_validation_failed', {
        templateId: site?.templateId,
        adapterId: entry.adapter.id,
        errors: result.errors,
      });

      throw new TemplateRuntimeError({
        code: 'TEMPLATE_VALIDATION_FAILED',
        message: 'Adapter validation failed',
        templateId: site?.templateId,
        adapterId: entry.adapter.id,
        details: result.errors,
      });
    }
    const rendered = entry.adapter.render(site);
    emitTemplateRuntimeEvent('template_render_success', {
      templateId: site?.templateId,
      adapterId: entry.adapter.id,
      adapterVersion: entry.adapter.version,
    });
    return finalizeHtml(rendered, site);
  }

  if (entry?.generate) {
    return finalizeHtml(entry.generate(site), site);
  }

  // Check if it's a custom API template (synchronously from primary registry cache)
  const customTemplatesCache = getCustomTemplatesCache();
  if (customTemplatesCache) {
    const customTemplate = customTemplatesCache.find(t => t.id === templateId || t.dbId === templateId);
    if (customTemplate && customTemplate.files) {
      // Prefer pre-built HTML (dist/index.html) — 100% accurate, no conversion needed
      const builtHtml = getTemplateFileContent(customTemplate.files, 'dist/index.html');
      if (builtHtml) {
        const withBase =
          customTemplate.dbId != null && String(customTemplate.dbId).trim()
            ? injectDistPreviewBase(builtHtml, String(customTemplate.dbId).trim())
            : builtHtml;
        // Substitute ${h1}, ${title2}, ${cta}, ${sub}, ${aprMin}, etc. with live wizard values.
        // Pre-built dist/index.html still contains raw placeholders that would otherwise
        // render literally in the preview iframe.
        // Auto-parameterize hard-coded text if no ${variable} placeholders found.
        const htmlToSub = /\$\{[a-zA-Z]+\}/.test(withBase) ? withBase : parameterizeHtmlString(withBase);
        const substituted = substituteSiteVariables(htmlToSub, site);
        return finalizeHtml(substituted, site);
      }

      // Use the smart analyzer to choose the right rendering path
      const framework = identifyFramework(customTemplate.files);
      const colorObj = getColorObj(site.colorId);

      // Non-Astro templates (HTML-static from Bolt, Vite+React from Lovable, Next.js):
      // Use the preview runtime with automatic CDN injection, CSS variable override,
      // and dependency resolution instead of the Astro-specific parser.
      if (framework.id !== 'astro' || framework.confidence < 0.3) {
        try {
          return finalizeHtml(buildPreviewHtml(customTemplate.files, site, colorObj), site);
        } catch (e) {
          console.warn('[Router] Preview runtime failed, falling back to astroToHtmlPreview:', e.message);
        }
      }

      // Astro templates: use the existing Astro-to-HTML compiler
      return finalizeHtml(astroToHtmlPreview(customTemplate.files, site), site);
    }
  }

  // For module templates (pdl-loans-v3, simple-lp, etc.)
  if (isModuleTemplate(templateId)) {
    try {
      const files = generateFromModule(templateId, site);
      if (files) {
        return finalizeHtml(astroToHtmlPreview(files, site), site);
      }
    } catch (e) {
      console.warn('Module template generation failed for', templateId, e.message);
    }
  }

  // Synchronous fallback HTML
  return finalizeHtml(astroToHtmlPreview(generateAstroProject(site), site), site);
}

// Export a function to refresh custom templates cache (both router and registry)
export function refreshCustomTemplates() {
  clearCustomTemplatesCache();
  fetchCustomTemplates(true);
}

export function generateAstroProjectByTemplate(site) {
  const templateId = resolveTemplateId(site);

  // Check custom API templates first — return raw Astro source files
  const customTemplatesCache = getCustomTemplatesCache();
  if (customTemplatesCache) {
    const customTemplate = customTemplatesCache.find(t => t.id === templateId || t.dbId === templateId);
    if (customTemplate && customTemplate.files && Object.keys(customTemplate.files).length > 0) {
      return customTemplate.files;
    }
  }

  // Get generator from registry
  const generatorInfo = getTemplateGenerator(templateId, 'astro');

  if (generatorInfo) {
    if (generatorInfo.type === 'module') {
      // Module template - use unified generator
      const files = generateFromModule(generatorInfo.id, site);
      return files || generateAstroProject(site);
    } else if (generatorInfo.type === 'legacy' && generatorInfo.generator) {
      // Legacy template - use specific generator
      return generatorInfo.generator(site);
    }
  }

  // Fallback to default
  return generateAstroProject(site);
}

export function generateApplyPageByTemplate(site) {
  return generateApplyPage(site);
}

// Generates the full asset map needed by Edge deployment targets 
// (Cloudflare Workers, Pages) instead of just single-file HTML preview.
export function generateDeployAssetsByTemplate(site) {
  const templateId = resolveTemplateId(site);

  // Custom Templates: Return the full asset map (HTML + CSS + logic)
  const customTemplatesCache = getCustomTemplatesCache();
  if (customTemplatesCache) {
    const customTemplate = customTemplatesCache.find(t => t.id === templateId || t.dbId === templateId);
    if (customTemplate && customTemplate.files) {
      const framework = identifyFramework(customTemplate.files);

      // HTML-static / Bolt / Lovable: deploy files as-is with preview runtime
      // for tracking injection and CSS variable theming
      if (framework.id === 'html-static' || (framework.id !== 'astro' && !framework.buildRequired)) {
        const assets = {};
        const colorObj = getColorObj(site.colorId);
        try {
          const html = buildPreviewHtml(customTemplate.files, site, colorObj);
          assets['/index.html'] = finalizeHtml(html, site);
          assets['/'] = assets['/index.html'];
        } catch (_e) {
          // Fallback: deploy index.html raw with tracking
          const htmlKey = Object.keys(customTemplate.files).find(k => k === 'index.html' || k.endsWith('/index.html'));
          if (htmlKey) {
            assets['/index.html'] = finalizeHtml(String(customTemplate.files[htmlKey]), site);
            assets['/'] = assets['/index.html'];
          }
        }
        // Include all non-entry files (CSS, JS, images)
        for (const [path, content] of Object.entries(customTemplate.files)) {
          if (path === 'index.html') continue;
          const deployPath = path.startsWith('/') ? path : '/' + path;
          if (!assets[deployPath]) assets[deployPath] = content;
        }
        return assets;
      }

      // Astro: use the full asset compiler with component resolution
      return renderTemplateToAssets(customTemplate, site);
    }
  }

  // Module Templates (which might be multi-file soon, but for now we preview them to single html)
  if (isModuleTemplate(templateId) || templateId === 'classic') {
    try {
      const mappedId = templateId === 'classic' ? 'classic' : templateId;
      const files = generateFromModule(mappedId, site);

      // We pass the files object wrapped in a dummy template object 
      // so it compiles the full asset map with global.css and other assets.
      return renderTemplateToAssets({ files }, site);
    } catch (e) {
      console.warn('Module asset generation failed', e);
    }
  }

  // Legacy fallback: return the raw HTML string
  return generateHtmlByTemplate(site);
}
