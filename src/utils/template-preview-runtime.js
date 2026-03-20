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

import { detectDependencies, extractCssVariables, identifyFramework, resolveEntryPoint } from './template-analyzer.js';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a preview-ready HTML document from a template file map + site config.
 *
 * @param {Record<string, string>} files — Template files
 * @param {object} site — Site/brand config from the wizard
 * @param {object} [colors] — Color object { p: [h,s,l], a: [h,s,l], s: [h,s,l] }
 * @returns {string} Complete HTML document
 */
export function buildPreviewHtml(files, site = {}, colors = null) {
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
    html = cleanAstroSyntax(html);
  }

  // ─── 3. Build injection blocks ──────────────────────
  const headInjections = [];
  const bodyInjections = [];

  // Tracking stubs (prevent ReferenceError in preview)
  headInjections.push(buildTrackingStubs(site));

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
  if (!entry.path) {
    // Last resort: try to find any HTML file
    const htmlKey = Object.keys(files).find(k => k.endsWith('.html'));
    return htmlKey ? files[htmlKey] : null;
  }

  const content = files[entry.path];
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
