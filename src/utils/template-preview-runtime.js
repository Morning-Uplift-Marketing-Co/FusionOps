/**
 * Template Preview Runtime
 * ========================
 * Builds a self-contained HTML document that can render AI-generated templates
 * inside an <iframe> without leaking styles or breaking the host app.
 *
 * Strategy:
 *   1. Detect what the template needs (Tailwind, Lucide, fonts, CSS vars)
 *   2. Build a <head> that injects those dependencies via CDN
 *   3. Override CSS variables via a cascading <style> block (not string replacement)
 *   4. Inject tracking stubs so forms/CTAs don't throw ReferenceErrors
 *   5. Return complete HTML string ready for `srcDoc` or `Blob` URL
 *
 * This replaces the brittle regex-based `${site.brand}` replacement in template-router.js
 * for imported templates that don't use our variable syntax.
 */

import {
  detectDependencies,
  extractCssVariables,
  getTemplateFileContent,
  identifyFramework,
  resolveEntryPoint,
} from './template-analyzer.js';
import { parameterizeHtmlString } from './generators/template-parameterizer.js';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a preview-ready HTML document from a template file map + site config.
 *
 * @param {Record<string, string>} files — Template files
 * @param {object} site — Site/brand config from the wizard
 * @param {object} [colors] — Color object { p: [h,s,l], a: [h,s,l], s: [h,s,l] }
 * @param {string} [basePath] — Optional base URL for relative assets
 * @returns {string} Complete HTML document
 */
export function buildPreviewHtml(files, site = {}, colors = null, basePath = '') {
  const framework = identifyFramework(files);
  const deps = detectDependencies(files);
  const entry = resolveEntryPoint(files);
  const { variables: existingVars, hasShadcnVars } = extractCssVariables(files);

  // ─── 1. Get the raw HTML content ────────────────────
  let html = extractRawHtml(files, entry, framework);
  if (!html) {
    return buildErrorHtml('No renderable entry point found. Expected index.html or index.astro.');
  }

  // ─── 2. If Astro, strip frontmatter + inline components ─
  if (entry.type === 'astro') {
    html = stripAstroFrontmatter(html);
    html = inlineAstroComponents(html, files);
    // Wizard Gen Reviews live on site.reviews; cleanAstroSyntax strips `{reviews.map(...)}` — inject static HTML first
    html = replaceTestimonialsSectionForPreview(html, site);
    html = cleanAstroSyntax(html);
  }

  // ─── 2b. Strip TypeScript from <script> blocks ──────
  // Astro compiles TS at build-time; for browser preview we need plain JS.
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
    // Skip external scripts (src=) and JSON-LD
    if (/\bsrc\s*=/.test(attrs)) return m;
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) return m;
    return `<script${attrs}>${stripTypeScriptFromScript(body)}</script>`;
  });

  // ─── 2c. Auto-parameterize hard-coded text (fallback for pre-parameterized templates) ───
  // If the HTML still has hard-coded brand/domain but no ${variable} placeholders,
  // convert them so substituteSiteVariables() can replace them.
  const hasPlaceholders = /\$\{[a-zA-Z]+\}/.test(html);
  if (!hasPlaceholders) {
    html = parameterizeHtmlString(html);
  }

  // ─── 2d. Substitute ${varName} placeholders ─────────
  // Replaces ${brand}, ${h1}, ${sub}, ${cta}, ${title2}, ${amountMax}, etc.
  // with live wizard values so Bolt/HTML-static templates update in preview.
  html = substituteSiteVariables(html, site);

  // ─── 3. Build injection blocks ──────────────────────
  const headInjections = [];
  const bodyInjections = [];

  // Tracking stubs (prevent ReferenceError in preview)
  headInjections.push(buildTrackingStubs(site));
  
  // Base path for relative assets (images, fonts, linked CSS)
  if (basePath) {
    headInjections.push(`<base href="${basePath.endsWith('/') ? basePath : basePath + '/'}">`);
  }

  // Tailwind CDN (only if template uses it AND doesn't already include it)
  const needsTailwind = deps.some(d => d.id === 'tailwindcss');
  const hasTailwindCdn = /cdn\.tailwindcss\.com/.test(html);
  if (needsTailwind && !hasTailwindCdn) {
    headInjections.push(buildTailwindInjection(site, colors));
  }

  // CSS variable overrides (theme injection via cascade, not string replacement)
  if (hasShadcnVars || Object.keys(existingVars).length > 0) {
    headInjections.push(buildCssVariableOverride(site, colors, existingVars, hasShadcnVars));
  }

  // Lucide icons (UMD bundle for HTML-static templates)
  const needsLucide = deps.some(d => d.id === 'lucide');
  if (needsLucide && framework.id === 'html-static') {
    bodyInjections.push(buildLucideInjection());
  }

  // Google Fonts (preserve if already in the HTML)
  const fontDep = deps.find(d => d.id === 'google-fonts');
  if (fontDep && !html.includes('fonts.googleapis.com')) {
    headInjections.push(`<link rel="preconnect" href="https://fonts.googleapis.com">`);
    headInjections.push(`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`);
  }

  // Inline all CSS files from the template into <style> blocks
  headInjections.push(buildInlineCss(files, needsTailwind));

  // ─── 4. Inject everything into the HTML ─────────────
  const headBlock = headInjections.filter(Boolean).join('\n');
  const bodyBlock = bodyInjections.filter(Boolean).join('\n');

  if (html.includes('</head>')) {
    html = html.replace('</head>', headBlock + '\n</head>');
  } else {
    // No <head> tag — wrap the content
    html = `<!DOCTYPE html><html><head>${headBlock}</head><body>${html}</body></html>`;
  }

  if (bodyBlock && html.includes('</body>')) {
    html = html.replace('</body>', bodyBlock + '\n</body>');
  }

  return html;
}


// ─── Raw HTML Extraction ─────────────────────────────────────────────────────

function extractRawHtml(files, entry, framework) {
  // Prefer dist/index.html if it exists (pre-built by user/CI); keys may use `\` on Windows
  const distHtmlPaths = ['dist/index.html', 'out/index.html', 'build/index.html'];
  for (const path of distHtmlPaths) {
    const c = getTemplateFileContent(files, path);
    if (typeof c === 'string' && c.trim()) return c;
  }

  if (!entry.path) {
    // Last resort: try to find any HTML file
    const htmlKey = Object.keys(files).find((k) => /\.html$/i.test(k.replace(/\\/g, '/')));
    return htmlKey ? files[htmlKey] : null;
  }

  const content = getTemplateFileContent(files, entry.path);
  if (!content) return null;

  // HTML files can be returned as-is
  if (entry.type === 'html') return content;

  // Astro files need frontmatter stripped (component inlining happens in caller)
  if (entry.type === 'astro') return content;

  // TSX/JSX — can't render directly, return a placeholder
  if (entry.type === 'tsx' || entry.type === 'jsx') {
    return buildBuildRequiredHtml(framework);
  }

  return content;
}


// ─── TypeScript → JavaScript for Preview ─────────────────────────────────────
// Astro compiles TypeScript in <script> blocks at build time.
// For in-browser preview we need plain JS — strip the most common TS syntax.
// This handles templates generated by Bolt/Lovable that use TypeScript scripts.

export function stripTypeScriptFromScript(content) {
  // Generic type params on DOM query methods: querySelectorAll<T>() → querySelectorAll()
  content = content.replace(/(querySelector(?:All)?)\s*<[^>()]+>/g, '$1');

  // TypeScript non-null assertions: getElementById('x')! → getElementById('x')
  // Only safe to strip when ! immediately follows ) or ] and is not logical-NOT
  content = content.replace(/([\w)\]])\s*!(?=\s*[;,)\]\n.])/g, '$1');

  // TypeScript type casts: "expr as TypeName" or "expr as T1 | T2"
  content = content.replace(/\s+as\s+[A-Z][A-Za-z0-9_<>,\s|]+?(?=\s*[;,)\]\n])/g, '');

  // Function parameter type annotations: (param: number) → (param)
  // Conservative: only strip built-in JS/TS primitive types and common DOM types
  const SAFE_TYPES = 'number|string|boolean|void|null|undefined|unknown|any|HTMLElement|HTMLInputElement|HTMLButtonElement|HTMLAnchorElement|HTMLTextAreaElement|HTMLSelectElement|Event|MouseEvent|KeyboardEvent|FocusEvent|EventTarget|Element|Node';
  content = content.replace(
    new RegExp(`(\\b\\w+)\\s*:\\s*(?:${SAFE_TYPES})(?:\\[\\])?(?=\\s*[,)])`, 'g'),
    '$1'
  );

  // Function return type: ): ReturnType { → ) {
  content = content.replace(
    new RegExp(`\\)\\s*:\\s*(?:${SAFE_TYPES})(?:\\[\\])?\\s*\\{`, 'g'),
    ') {'
  );

  return content;
}


// ─── Site Variable Substitution ──────────────────────────────────────────────
// Replaces ${varName} template-literal-style placeholders with live wizard values.
// Works for ALL template types (HTML-static from Bolt, Astro, etc.).
// <style> and <script> blocks are protected from substitution.

export function substituteSiteVariables(html, site) {
  if (!site || !html) return html;

  const toNum = (v, fallback) =>
    String(Math.round(Number(String(v || fallback).replace(/[^0-9.]/g, '')) || fallback));

  const domain = String(site.domain || 'example.com');
  const vars = {
    domain,
    brand:        String(site.brand        || ''),
    h1:           String(site.h1           || ''),
    sub:          String(site.sub          || ''),
    cta:          String(site.cta          || ''),
    title2:       String(site.title2       || ''),
    phone:        String(site.phone        || ''),
    email:        String(site.email        || ''),
    address:      String(site.address      || ''),
    amountMax:    String(site.amountMax    || '5,000'),
    amountMin:    String(site.amountMin    || '100'),
    amountMaxRaw: toNum(site.amountMax, 5000),
    amountMinRaw: toNum(site.amountMin, 100),
    aprMin:       String(site.aprMin       || '5.99'),
    aprMax:       String(site.aprMax       || '35.99'),
    loanLabel:    String(site.loanLabel    || site.loanType || ''),
    redirectUrl:  String(site.voluumClickUrl || site.redirectUrl || '#apply'),
    network:      String(site.network      || ''),
    // Tracking / SEO vars — prevent literal ${conversionId} / ${siteUrl} in deployed HTML
    conversionId: String(site.conversionId || ''),
    siteUrl:      String(site.siteUrl      || ('https://' + domain)),
    primaryColor: String(site.primaryColor || '#3b5bdb'),
    accentColor:  String(site.accentColor  || '#f97316'),
    // Design variables
    fontFamily:   String(site.fontFamily   || '"DM Sans", sans-serif'),
    borderRadius: String(site.borderRadius  || '0.75rem'),
    layout:       String(site.layout       || 'hero-left'),
    secondaryColor: String(site.secondaryColor || '#64748b'),
    bgColor:      String(site.bgColor      || '#f8fafc'),
    textColor:    String(site.textColor    || '#1e293b'),
  };

  // Protect <style> blocks entirely and <script> BODIES (not attributes like src=)
  // so that ${conversionId} in <script src="...?id=${conversionId}"> still gets substituted,
  // but JS code inside <script> blocks isn't accidentally broken by ${varName} replacement.
  const styleBlocks = [];
  const scriptBodies = [];
  let safe = html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (m) => {
      const token = `\x00STYLE${styleBlocks.length}\x00`;
      styleBlocks.push(m);
      return token;
    })
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_m, open, body, close) => {
      const token = `\x00SCRIPTBODY${scriptBodies.length}\x00`;
      scriptBodies.push(body);
      return open + token + close;
    });

  for (const [key, val] of Object.entries(vars)) {
    if (!val) continue;
    safe = safe.replace(new RegExp('\\$\\{' + key + '\\}', 'g'), val);
  }

  // Restore protected blocks
  styleBlocks.forEach((b, i) => { safe = safe.replace(`\x00STYLE${i}\x00`, b); });
  scriptBodies.forEach((b, i) => { safe = safe.replace(`\x00SCRIPTBODY${i}\x00`, b); });

  return safe;
}


// ─── Astro Processing ────────────────────────────────────────────────────────

function stripAstroFrontmatter(html) {
  return html.replace(/^---[\s\S]*?---/m, '');
}

function inlineAstroComponents(html, files) {
  const compFiles = Object.keys(files)
    .filter(k => k.endsWith('.astro') && !k.endsWith('index.astro'))
    .map(cf => ({
      name: cf.split('/').pop().replace('.astro', ''),
      content: files[cf],
    }))
    .sort((a, b) => b.name.length - a.name.length); // Longer names first

  let result = html;
  // Resolve up to 5 levels of nesting
  for (let i = 0; i < 5; i++) {
    const prev = result;
    for (const comp of compFiles) {
      if (!comp.name || !comp.content) continue;
      const compBody = comp.content.replace(/^---[\s\S]*?---/m, '').trim();

      // <Comp>children</Comp>
      const wrapRe = new RegExp(`<${comp.name}[^>]*>([\\s\\S]*?)<\\/${comp.name}>`, 'g');
      result = result.replace(wrapRe, (_m, children) => {
        return compBody.replace(/<slot\s*\/?>|<slot>[\s\S]*?<\/slot>/g, () => children);
      });

      // <Comp /> or <Comp>
      const selfRe = new RegExp(`<${comp.name}\\s*\\/?>`, 'g');
      result = result.replace(selfRe, () => compBody);
    }
    if (prev === result) break;
  }

  return result;
}

/**
 * Replace `<section id="testimonials">...</section>` when site.reviews has Gen Reviews data.
 * Inlined Astro leaves `{reviews.map(...)}` which cleanAstroSyntax removes entirely.
 */
function replaceTestimonialsSectionForPreview(html, site) {
  if (site?.showReviews === false) return html;
  const reviews = site?.reviews;
  if (!Array.isArray(reviews) || reviews.length === 0) return html;
  const start = html.indexOf('<section id="testimonials"');
  if (start === -1) return html;

  const end = findMatchingSectionEnd(html, start);
  if (end === -1) return html;

  const sectionHtml = buildTestimonialsPreviewSection(site, reviews);
  return html.slice(0, start) + sectionHtml + html.slice(end);
}

function findMatchingSectionEnd(html, sectionStart) {
  let depth = 0;
  let pos = sectionStart;
  while (pos < html.length) {
    const openAt = html.indexOf('<section', pos);
    const closeAt = html.indexOf('</section>', pos);
    if (closeAt === -1) return -1;
    if (openAt !== -1 && openAt < closeAt) {
      depth++;
      pos = openAt + 8;
    } else {
      depth--;
      if (depth === 0) return closeAt + 10;
      pos = closeAt + 10;
    }
  }
  return -1;
}

function normalizePreviewReview(r, i, palette) {
  const quote = String(r.text || r.quote || '').trim();
  if (!quote) return null;
  const name = r.name || 'Customer';
  const initials = (() => {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase() || '?';
  })();
  const rating = Math.min(5, Math.max(1, Number(r.rating) || 5));
  return {
    name,
    location: r.location || '',
    amount: r.amount || '—',
    purpose: r.purpose || 'Verified borrower',
    rating,
    quote,
    avatar: r.avatar || initials,
    color: r.color || palette[i % palette.length],
  };
}

function buildTestimonialsPreviewSection(site, rawReviews) {
  const palette = ['hsl(38 68% 60%)', 'hsl(204 100% 62%)', 'hsl(142 60% 55%)'];
  const reviews = rawReviews.map((r, i) => normalizePreviewReview(r, i, palette)).filter(Boolean);
  if (reviews.length === 0) return '';

  const brand = escHtml(site.brand || 'Us');
  const star = (fill) =>
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="${fill}" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

  const cards = reviews
    .map(
      (r) => `
        <div class="premium-card p-6 flex flex-col gap-5 reveal hover:-translate-y-0.5 transition-transform duration-200">
          <div class="flex gap-0.5">${Array(r.rating).fill(0).map(() => star(r.color)).join('')}</div>
          <blockquote class="text-foreground/65 text-sm leading-relaxed flex-1">&ldquo;${escHtml(r.quote)}&rdquo;</blockquote>
          <div class="flex items-center justify-between border-t border-border pt-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0" style="background:${r.color}18;color:${r.color}">${escHtml(r.avatar)}</div>
              <div>
                <div class="text-foreground/80 text-sm font-semibold">${escHtml(r.name)}</div>
                <div class="text-foreground/35 text-xs">${escHtml(r.location)}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-mono font-bold text-sm" style="color:${r.color}">${escHtml(r.amount)}</div>
              <div class="text-foreground/30 text-xs">${escHtml(r.purpose)}</div>
            </div>
          </div>
        </div>`,
    )
    .join('');

  return `<section id="testimonials" class="py-20 md:py-28 px-6 overflow-hidden">
  <div class="max-w-6xl mx-auto">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
      <div>
        <span class="section-label">Customer Stories</span>
        <h2 class="section-title mb-2">Real People. Real Results.</h2>
        <p class="text-foreground/50 text-base max-w-md">Borrowers have trusted ${brand} with their financial goals.</p>
      </div>
      <div class="glass-card px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <div class="text-center">
          <div class="font-display font-bold text-3xl text-foreground mono-num">4.8</div>
          <div class="flex gap-0.5 justify-center mt-1">${Array(5).fill(0).map(() => star('hsl(38 68% 60%)')).join('')}</div>
        </div>
        <div class="h-10 w-px bg-border"></div>
        <div>
          <div class="text-foreground/70 text-sm font-semibold">${reviews.length}+ reviews</div>
          <div class="text-foreground/35 text-xs mt-0.5">From your wizard (preview)</div>
        </div>
      </div>
    </div>
    <div class="grid md:grid-cols-3 gap-4 mb-10">${cards}</div>
    <div class="grid grid-cols-3 gap-4">
      <div class="glass-card p-5 text-center">
        <div class="font-display font-bold text-2xl text-foreground mono-num mb-1">4.8<span class="text-base text-foreground/40">/ 5.0</span></div>
        <div class="text-foreground/40 text-xs leading-relaxed">Average from generated reviews</div>
      </div>
      <div class="glass-card p-5 text-center">
        <div class="font-display font-bold text-2xl text-foreground mono-num mb-1">96<span class="text-base text-foreground/40">%</span></div>
        <div class="text-foreground/40 text-xs leading-relaxed">Customers would recommend us</div>
      </div>
      <div class="glass-card p-5 text-center">
        <div class="font-display font-bold text-2xl text-foreground mono-num mb-1">24h</div>
        <div class="text-foreground/40 text-xs leading-relaxed">Average time from approval to funding</div>
      </div>
    </div>
  </div>
</section>`;
}

function cleanAstroSyntax(html) {
  let result = html;
  // Strip Astro directives
  result = result.replace(/\s+is:global/g, '');
  result = result.replace(/\s+is:inline/g, '');
  result = result.replace(/\s+define:vars=\{\{[^}]*(?:\}[^}][^}]*)*\}\}/g, '');

  // Replace {year} expression
  result = result.replace(/\{\s*year\s*\}/g, String(new Date().getFullYear()));

  // Strip .map() loops that would leak raw code
  result = result.replace(/\{[^{}]*?\.map\([^{}]*?\)\s*=>\s*\([\s\S]*?\)\s*\}\s*\}?/g, '');

  // Strip simple Astro interpolations like {t.name}
  result = result.replace(/\{\s*[a-zA-Z_$][\w$]*\.[\w$]+\s*\}/g, '');

  // Normalize doctype
  result = result.replace(/<!doctype html>/gi, '<!DOCTYPE html>');

  return result;
}


// ─── Injection Builders ──────────────────────────────────────────────────────

function buildTrackingStubs(site) {
  const conversionId = site.conversionId || '';
  const aid = site.aid || site.leadsGateFormId || '';
  return `<script>
/* Preview tracking stubs */
var conversionId='${escHtml(conversionId)}';
var formStartLabel='${escHtml(site.formStartLabel || '')}';
var formSubmitLabel='${escHtml(site.formSubmitLabel || '')}';
var voluumDomain='${escHtml(site.voluumDomain || '')}';
var leadsGateFormId='${escHtml(aid)}';
var id='preview';
var defaultValue=0;
window.dataLayer=window.dataLayer||[];
window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
window.__fusionopsTrack=window.__fusionopsTrack||function(){};
</script>`;
}

function buildTailwindInjection(site, colors) {
  const colorObj = colors || {};
  const primary = colorObj.p
    ? `hsl(${colorObj.p[0]} ${colorObj.p[1]}% ${colorObj.p[2]}%)`
    : (site.primaryColor || '#3b82f6');
  const accent = colorObj.a
    ? `hsl(${colorObj.a[0]} ${colorObj.a[1]}% ${colorObj.a[2]}%)`
    : (site.accentColor || '#f97316');
  const secondary = colorObj.s
    ? `hsl(${colorObj.s[0]} ${colorObj.s[1]}% ${colorObj.s[2]}%)`
    : '#10B981';

  return `<script>
window.tailwind = window.tailwind || {};
window.tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '${primary}', foreground: '#ffffff' },
        accent: { DEFAULT: '${accent}', foreground: '#ffffff' },
        secondary: { DEFAULT: '${secondary}', foreground: '#ffffff' },
      }
    }
  }
};
</script>
<script src="https://cdn.tailwindcss.com"></script>`;
}

/**
 * Build a <style> block that overrides CSS custom properties.
 *
 * This is the core theming mechanism for AI-generated templates.
 * Instead of doing string replacement on ${site.brand}, we inject CSS variables
 * that cascade over whatever the template defined.
 *
 * shadcn/ui templates use: --primary, --secondary, --accent, --background, etc.
 * Custom templates may use: --color-primary, --brand-color, etc.
 */
function buildCssVariableOverride(site, colors, existingVars, hasShadcnVars) {
  const colorObj = colors || {};
  const primary = colorObj.p || [217, 91, 60];    // Default: blue-500
  const accent  = colorObj.a || [25, 95, 53];     // Default: orange-500
  const secondary = colorObj.s || [160, 84, 39];  // Default: emerald-500

  const lines = [':root {'];

  if (hasShadcnVars) {
    // shadcn/ui convention: HSL values without hsl() wrapper
    // e.g. --primary: 217 91% 60%;
    lines.push(`  --primary: ${primary[0]} ${primary[1]}% ${primary[2]}%;`);
    lines.push(`  --primary-foreground: 0 0% 100%;`);
    lines.push(`  --secondary: ${secondary[0]} ${secondary[1]}% ${secondary[2]}%;`);
    lines.push(`  --secondary-foreground: 0 0% 100%;`);
    lines.push(`  --accent: ${accent[0]} ${accent[1]}% ${accent[2]}%;`);
    lines.push(`  --accent-foreground: 0 0% 100%;`);
    // Preserve existing vars that we don't override
    if (existingVars.background) lines.push(`  --background: ${existingVars.background};`);
    if (existingVars.foreground) lines.push(`  --foreground: ${existingVars.foreground};`);
    if (existingVars.radius)     lines.push(`  --radius: ${existingVars.radius};`);
  }

  // Generic CSS variable overrides for non-shadcn templates
  const primaryHsl = `hsl(${primary[0]}, ${primary[1]}%, ${primary[2]}%)`;
  const accentHsl  = `hsl(${accent[0]}, ${accent[1]}%, ${accent[2]}%)`;

  // Only override variables that already exist in the template
  const varMap = {
    'color-primary':  primaryHsl,
    'brand-color':    primaryHsl,
    'brand-primary':  primaryHsl,
    'color-accent':   accentHsl,
    'brand-accent':   accentHsl,
    'cta-color':      accentHsl,
  };

  for (const [varName, value] of Object.entries(varMap)) {
    if (existingVars[varName] !== undefined) {
      lines.push(`  --${varName}: ${value};`);
    }
  }

  lines.push('}');

  return `<style id="lp-theme-override">\n${lines.join('\n')}\n</style>`;
}

function buildLucideInjection() {
  // Lucide UMD auto-replaces <i data-lucide="icon-name"> elements
  return `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    if (window.lucide) window.lucide.createIcons();
  });
</script>`;
}

function buildInlineCss(files, hasTailwind) {
  const cssPaths = Object.keys(files).filter(k => k.endsWith('.css'));
  if (cssPaths.length === 0) return '';

  const blocks = [];
  for (const cp of cssPaths) {
    let css = files[cp] || '';
    if (!css.trim()) continue;

    // If this CSS uses @tailwind directives, use type="text/tailwindcss"
    // so the Tailwind CDN compiler processes it
    const isTwSource = /@tailwind\s+(base|components|utilities)\s*;|@apply\s+/.test(css);

    if (isTwSource && hasTailwind) {
      blocks.push(`<style type="text/tailwindcss">\n/* ${cp} */\n${css}\n</style>`);
    } else if (!isTwSource) {
      blocks.push(`<style>\n/* ${cp} */\n${css}\n</style>`);
    }
    // If it's Tailwind source CSS but no Tailwind CDN, skip it (can't process)
  }

  return blocks.join('\n');
}


// ─── Fallback HTML Builders ──────────────────────────────────────────────────

function buildErrorHtml(message) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
         min-height: 100vh; margin: 0; background: #fef2f2; color: #991b1b; }
  .card { text-align: center; padding: 32px; border-radius: 16px; border: 1px solid #fecaca;
          background: white; max-width: 480px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
  h2 { margin: 0 0 8px; font-size: 18px; }
  p { margin: 0; font-size: 14px; color: #dc2626; }
</style></head><body>
  <div class="card"><h2>Preview Error</h2><p>${escHtml(message)}</p></div>
</body></html>`;
}

function buildBuildRequiredHtml(framework) {
  const label = framework?.label || 'This template';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
         min-height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
  .card { text-align: center; padding: 40px; border-radius: 20px; border: 1px solid #e2e8f0;
          background: white; max-width: 480px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
  h2 { margin: 0 0 8px; font-size: 20px; font-weight: 800; }
  p { margin: 0 0 16px; font-size: 14px; color: #64748b; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700;
           background: #dbeafe; color: #2563eb; }
  .note { margin-top: 16px; font-size: 12px; color: #94a3b8; }
</style></head><body>
  <div class="card">
    <div style="font-size:48px;margin-bottom:16px">⚡</div>
    <h2>${escHtml(label)} Template</h2>
    <p>This template requires a build step (<code>npm run build</code>) before it can be previewed.</p>
    <div class="badge">${escHtml(framework?.id || 'build-required')}</div>
    <div class="note">The template will be deployed via GitHub Actions. Preview shows a placeholder.</div>
  </div>
</body></html>`;
}


// ─── Utilities ───────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
