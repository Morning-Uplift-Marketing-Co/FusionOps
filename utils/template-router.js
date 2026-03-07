import { generateLP, generateAstrodeckLoanPreview, generateApplyPage, generatePDLLoansV1Preview, generateLanderCorePreview, generateWorkerSafeLoanPreview } from "./lp-generator.js";
import { generateAstroProject } from "./astro-generator.jsx";
import { getTemplateGenerator, resolveTemplateId as resolveId, clearCustomTemplatesCache, fetchCustomTemplates, getCustomTemplatesCache } from "./template-registry.js";

// Ensure templates are registered (side-effect import)
import "#lp-template-generator/templates";

// Eagerly import the module generator for synchronous use
import { generateTemplate as generateFromModule } from "#lp-template-generator/core/generator.js";

// Import colors for template variable substitution
import { COLORS as ALL_COLORS } from "../constants/index.js";
import { api } from "../services/api";

export const DEFAULT_TEMPLATE_ID = "classic";

function resolveTemplateId(site) {
  const rawId = site?.templateId || DEFAULT_TEMPLATE_ID;
  return resolveId(rawId);
}

// Module template IDs for quick lookup
const MODULE_TEMPLATE_IDS = ['classic', 'pdl-loans-v1', 'pdl-loans-v3', 'simple-lp', 'pet-care-loans', 'elastic-credits-v3', 'scratchpay-bridge', 'pet-loans-v1', 'installment-loans-v1'];

// Get color object for template substitution
function getColorObj(colorId) {
  return ALL_COLORS.find(c => c.id === colorId) || ALL_COLORS[3] || ALL_COLORS[0];
}

// Check if a template ID is a module template
function isModuleTemplate(templateId) {
  return MODULE_TEMPLATE_IDS.includes(templateId) ||
    templateId === 'pdl-loansv1'; // alias
}

// Convert Astro files to HTML preview with actual site data
function astroToHtmlPreview(files, site) {
  let indexContent = files['src/pages/index.astro'];

  if (!indexContent) {
    // Robust discovery: look for any file ending with index.astro if standard path missing
    const key = Object.keys(files).find(k => k.endsWith('/src/pages/index.astro') || k.endsWith('src/pages/index.astro') || k.endsWith('index.astro'));
    if (key) indexContent = files[key];
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
  const normalizedSite = {
    brand: site.brand || '',
    title: site.h1 || site.brand || 'Your Title',
    description: site.sub || site.tagline || 'Your description',
    domain: site.domain || 'example.com',
    h1: site.h1 || site.brand || 'Your Headline',
    h1span: site.h1span || 'Get Started',
    sub: site.sub || 'Your subheadline here',
    cta: site.cta || 'Get Started',
    badge: site.badge || 'Featured',
    email: site.email || `support@${site.domain || 'example.com'}`,
    conversionId: site.conversionId || '',
    formStartLabel: site.formStartLabel || '',
    formSubmitLabel: site.formSubmitLabel || '',
    aid: site.aid || '',
    voluumDomain: site.voluumDomain || '',
    amountMin: String(Number(site.amountMin) || 100),
    amountMax: String(Number(site.amountMax) || 5000),
    aprMin: site.aprMin || 5.99,
    aprMax: site.aprMax || 35.99,
    loanLabel: site.loanType || 'Personal Loans',
    phone: site.phone || '',
    headline: site.h1 || site.brand || 'Your Headline',
    subheadline: site.sub || site.tagline || 'Your subheadline here',
    leadsGateFormId: site.leadsGateFormId || site.aid || ''
  };

  // Basic Astro to HTML conversion for preview
  let html = indexContent;

  // Remove frontmatter if present from index content
  html = html.replace(/^---[\s\S]*?---/m, '');

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

      let compBody = comp.content.replace(/^---[\s\S]*?---/m, '').trim();

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
  const _colorObj2 = getColorObj(site.colorId);
  const _primaryColor = _colorObj2.p ? `hsl(${_colorObj2.p[0]}, ${_colorObj2.p[1]}%, ${_colorObj2.p[2]}%)` : '#3b82f6';
  const _accentColor = _colorObj2.a ? `hsl(${_colorObj2.a[0]}, ${_colorObj2.a[1]}%, ${_colorObj2.a[2]}%)` : '#f97316';
  html = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, body, close) => {
    const resolved = body.replace(/\$\{primaryColor\}/g, _primaryColor)
                         .replace(/\$\{accentColor\}/g, _accentColor);
    return open + resolved + close;
  });

  // Protect script blocks (except JSON-LD) from our string transforms
  const scriptBlocks = [];
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => {
    // Keep JSON-LD scripts editable so ${...} interpolation can be resolved.
    // If left untouched, JSON-LD may contain template syntax and break parsing.
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(m)) {
      return m;
    }
    const token = `__LP_SCRIPT_BLOCK_${scriptBlocks.length}__`;
    scriptBlocks.push(m);
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

    const badge = evaluateSiteProp('badge', 'Featured');
    if (badge !== null) return badge;

    const domain = evaluateSiteProp('domain', 'example.com');
    if (domain !== null) return domain;

    const email = evaluateSiteProp('email', 'support@example.com');
    if (email !== null) return email;

    const phone = evaluateSiteProp('phone', '');
    if (phone !== null) return phone;

    const amountMin = evaluateSiteProp('amountMin', '100');
    if (amountMin !== null) return amountMin;

    const amountMax = evaluateSiteProp('amountMax', '5000');
    if (amountMax !== null) return amountMax;

    const aprMin = evaluateSiteProp('aprMin', '5.99');
    if (aprMin !== null) return String(aprMin);

    const aprMax = evaluateSiteProp('aprMax', '35.99');
    if (aprMax !== null) return String(aprMax);

    const loanLabel = evaluateSiteProp('loanLabel', 'Personal Loans');
    if (loanLabel !== null) return loanLabel;

    const leadsGateFormId = evaluateSiteProp('leadsGateFormId', '');
    if (leadsGateFormId !== null) return leadsGateFormId;

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
      return normalizedSite[propName] || '';
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
  // Remove map-based render loops that would otherwise leak raw code
  html = html.replace(/\{[^{}]*?\.map\([^{}]*?\)\s*=>\s*\([\s\S]*?\)\s*\}\s*\}?/g, '');
  // Remove simple interpolations like {t.name} or {f.a}
  html = html.replace(/\{\s*[a-zA-Z_$][\w$]*\.[\w$]+\s*\}/g, '');

  // Clean up Astro-specific attributes that cause browser errors
  html = html.replace(/<!doctype html>/gi, '<!DOCTYPE html>');
  html = html.replace(/\s+is:global/g, '');
  html = html.replace(/\s+is:inline/g, '');
  // Strip define:vars={{ ... }} — handles single and multi-variable, single/multi-line
  html = html.replace(/\s+define:vars=\{\{[^}]*(?:\}[^}][^}]*)*\}\}/g, '');

  // Inject fallback variable definitions before </head> to prevent ReferenceErrors
  const fallbackVars = `<script>var conversionId='';var formStartLabel='';var formSubmitLabel='';var voluumDomain='';var id='preview';var defaultValue=0;var leadsGateFormId='';</script>`;

  // Strip Tailwind CDN early if template has substantial inline CSS
  const earlyStyleMatch2 = html.match(/<style[\s\S]*?>([\s\S]*?)<\/style>/gi) || [];
  const earlyStyleContent2 = earlyStyleMatch2.join('');
  const hasSubstantialInlineCss2 = earlyStyleContent2.length > 200;
  if (hasSubstantialInlineCss2) {
    html = html.replace(/<script\b[^>]*src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*><\/script>/gi, '');
    html = html.replace(/<script\b[^>]*>\s*window\.tailwind\s*=[\s\S]*?<\/script>/g, '');
  }

  const _p = colorObj.p ? `hsl(${colorObj.p[0]} ${colorObj.p[1]}% ${colorObj.p[2]}%)` : '#2563EB';
  const _a = colorObj.a ? `hsl(${colorObj.a[0]} ${colorObj.a[1]}% ${colorObj.a[2]}%)` : '#F97316';
  const _s = colorObj.s ? `hsl(${colorObj.s[0]} ${colorObj.s[1]}% ${colorObj.s[2]}%)` : '#10B981';
  const tailwindConfigScript = `<script>window.tailwind = window.tailwind || {}; window.tailwind.config = {theme: {extend: {colors: {primary: '${_p}', accent: '${_a}', secondary: '${_s}'}, boxShadow: {cta: '0 4px 14px 0 hsl(40 90% 55% / 0.4)', card: '0 10px 15px -3px hsl(350 75% 38% / 0.08), 0 4px 6px -4px hsl(350 75% 38% / 0.06)'}} } } };</script>`;
  const tailwindCdnScript = `<script src="https://cdn.tailwindcss.com"></script>`;
  const tailwindFallbackCss = `<style>\n.shadow-cta{box-shadow:0 4px 14px 0 hsl(40 90% 55% / 0.4)}\n.shadow-card{box-shadow:0 10px 15px -3px hsl(350 75% 38% / 0.08),0 4px 6px -4px hsl(350 75% 38% / 0.06)}\n</style>`;

  // Only inject Tailwind CDN if template uses Tailwind classes (not when it has full inline CSS)
  const usesTailwindClasses2 = !hasSubstantialInlineCss2 && /class="[^"]*\b(bg-(?:blue|red|green|gray|slate|zinc)-\d|text-(?:xs|sm|base|lg|xl|2xl|3xl)|p-\d+\b|px-\d+\b|py-\d+\b|m-\d+\b|mx-\d+\b|my-\d+\b|gap-\d+\b|flex-col\b|flex-row\b|grid-cols-|items-center\b|justify-center\b|rounded-(?:sm|md|lg|xl|full)\b|font-bold\b|font-semibold\b)\b/.test(html);
  const tailwindCdn = usesTailwindClasses2 ? `${tailwindConfigScript}\n${tailwindCdnScript}\n${tailwindFallbackCss}` : '';

  const headInjections = fallbackVars + '\n' + tailwindCdn;

  if (html.includes('</head>')) {
    html = html.replace('</head>', headInjections + '\n</head>');
  } else {
    html = headInjections + '\n' + html;
  }

  // Restore protected script blocks
  if (scriptBlocks.length) {
    html = html.replace(/__LP_SCRIPT_BLOCK_(\d+)__/g, (_m, idx) => scriptBlocks[Number(idx)] || '');
  }

  // Strip CSS variable references from window.tailwind.config — Tailwind CDN cannot parse them
  html = stripTailwindCssVars(html);

  return html;
}

export function renderTemplateToAssets(template, site) {
  const assets = {};
  const files = template.files || {};

  console.log('[Router] renderTemplateToAssets - files keys:', Object.keys(files));
  console.log('[Router] renderTemplateToAssets - looking for index.astro');

  // 1. Compile index.html
  const html = astroToHtmlPreview(files, site);

  // Validate HTML was generated
  if (!html || html.length < 100) {
    console.error('[Router] Generated HTML is too short or empty!');
    console.error('[Router] HTML preview:', html?.substring(0, 500));
    throw new Error('Failed to generate valid HTML from template');
  }

  // Check for error indicators
  if (html.includes('Preview Error') || html.includes('No index.astro found')) {
    console.error('[Router] Template rendering produced error message');
    console.error('[Router] HTML content:', html.substring(0, 500));
    throw new Error('Template missing required index.astro file');
  }

  // Debug: check if HTML was generated
  console.log('[Router] astroToHtmlPreview result length:', html?.length);

  assets["/index.html"] = html;
  assets["/"] = html;

  // 2. Map all other files into assets
  Object.keys(files).forEach(path => {
    // If it's the index, we already handled it
    if (path.endsWith('index.astro') || path === 'package.json') return;

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
      assets["/index.html"] = assets["/index.html"].replace('</head>', styleInjection);
      assets["/"] = assets["/index.html"];
    }
  }

  return assets;
}

export function generateHtmlByTemplate(site) {
  const templateId = resolveTemplateId(site);

  // Check legacy templates first
  switch (templateId) {
    case "worker-safe-loan":
      return generateWorkerSafeLoanPreview(site);
    case "pdl-loansv1":
    case "pdl-loans-v1":
      return generatePDLLoansV1Preview(site);
    case "astrodeck-loan":
      return generateAstrodeckLoanPreview(site);
    case "lander-core":
      return generateLanderCorePreview(site);
    case "classic":
      // Classic is also a module template now - use it for consistency
      try {
        const files = generateFromModule('classic', site);
        return astroToHtmlPreview(files, site);
      } catch (e) {
        console.warn('Classic module template failed, using legacy:', e.message);
        return generateLP(site);
      }
    default: {
      // Check if it's a custom API template (synchronously from primary registry cache)
      const customTemplatesCache = getCustomTemplatesCache();
      if (customTemplatesCache) {
        const customTemplate = customTemplatesCache.find(t => t.id === templateId || t.dbId === templateId);
        if (customTemplate && customTemplate.files) {
          return astroToHtmlPreview(customTemplate.files, site);
        }
      }

      // For module templates (pdl-loans-v3, simple-lp, etc.)
      if (isModuleTemplate(templateId)) {
        try {
          const files = generateFromModule(templateId, site);
          return astroToHtmlPreview(files, site);
        } catch (e) {
          console.warn('Module template generation failed for', templateId, e.message);
        }
      }
      // Fallback to classic LP
      return generateLP(site);
    }
  }
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
      return generateFromModule(generatorInfo.id, site);
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

// Strip hsl(var(--...)) CSS variable references from window.tailwind.config scripts.
// Tailwind CDN cannot parse CSS variables in config and throws "Unexpected token '}'".
function stripTailwindCssVars(html) {
  if (!html || !html.includes('window.tailwind')) return html;
  return html.replace(
    /(<script[^>]*>)(window\.tailwind\s*=[\s\S]*?<\/script>)/gi,
    (match, open, body) => open + body.replace(/hsl\(var\([^)]+\)\)/g, '#000000')
  );
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
