import { generateLP, generateAstrodeckLoanPreview, generateApplyPage, generatePDLLoansV1Preview, generateLanderCorePreview } from "./lp-generator.js";
import { generateAstroProject } from "./astro-generator.jsx";
import { getTemplateGenerator, resolveTemplateId as resolveId, clearCustomTemplatesCache, fetchCustomTemplates, getCustomTemplatesCache } from "./template-registry.js";

// Ensure templates are registered (side-effect import)
import "#lp-template-generator/templates";

// Eagerly import the module generator for synchronous use
import { generateTemplate as generateFromModule } from "#lp-template-generator/core/generator.js";

// Import colors for template variable substitution
import { COLORS as ALL_COLORS } from "../constants";
import { api } from "../services/api";

export const DEFAULT_TEMPLATE_ID = "classic";

function resolveTemplateId(site) {
  const rawId = site?.templateId || DEFAULT_TEMPLATE_ID;
  return resolveId(rawId);
}

// Module template IDs for quick lookup
const MODULE_TEMPLATE_IDS = ['classic', 'pdl-loans-v1', 'pdl-loans-v3', 'simple-lp', 'pet-care-loans', 'elastic-credits-v3', 'scratchpay-bridge', 'pet-loans-v1', 'installment-loans-v1'];

// Check if a template ID is a module template
function isModuleTemplate(templateId) {
  return MODULE_TEMPLATE_IDS.includes(templateId) ||
    templateId === 'pdl-loansv1'; // alias
}

// Get color object for template substitution
function getColorObj(colorId) {
  return ALL_COLORS.find(c => c.id === colorId) || ALL_COLORS[3] || ALL_COLORS[0];
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

  // Replace template literals with actual site data for preview
  html = html.replace(/\$\{[^}]+\}/g, (match) => {
    const expr = match.slice(2, -1).trim();

    // Brand and text content
    if (expr === 'brand' || expr === 'site.brand') return site.brand || 'Your Brand';
    if (expr === 'h1' || expr === 'site.h1') return site.h1 || 'Your Headline';
    if (expr === 'sub' || expr === 'site.sub') return site.sub || 'Your subheadline here';
    if (expr === 'cta' || expr === 'site.cta') return site.cta || 'Get Started';
    if (expr === 'badge' || expr === 'site.badge') return site.badge || 'Featured';

    // Color variables - c.primary, c.bg, etc.
    if (expr.includes('c.primary') || expr === 'c?.primary') return colorObj.p ? `hsl(${colorObj.p[0]} ${colorObj.p[1]}% ${colorObj.p[2]}%)` : '#3b82f6';
    if (expr.includes('c.bg') || expr === 'c?.bg') return colorObj.bg || '#ffffff';
    if (expr.includes('c.text') || expr === 'c?.text') return colorObj.text || '#1a1a1a';
    if (expr.includes('c.muted') || expr === 'c?.muted') return colorObj.muted || '#6b7280';
    if (expr.includes('c.border') || expr === 'c?.border') return colorObj.border || '#e5e7eb';

    // Fallback for other c. references
    if (expr.startsWith('c.') || expr.startsWith('c?.')) return '#3b82f6';

    // Domain
    if (expr === 'domain' || expr === 'site.domain') return site.domain || 'example.com';

    // Keep original if no match
    return match;
  });

  // Clean up Astro-specific attributes that cause browser errors
  html = html.replace(/<!doctype html>/gi, '<!DOCTYPE html>');
  html = html.replace(/\s+is:global/g, '');
  html = html.replace(/\s+is:inline/g, '');
  // Strip define:vars={{ ... }} — handles single and multi-variable, single/multi-line
  html = html.replace(/\s+define:vars=\{\{[^}]*(?:\}[^}][^}]*)*\}\}/g, '');
  html = html.replace(/<style[^>]*>/gi, '<style type="text/tailwindcss">');
  html = html.replace(/<\/style>/gi, '</style>');

  // Inject fallback variable definitions before </head> to prevent ReferenceErrors
  const fallbackVars = `<script>var conversionId='';var formStartLabel='';var formSubmitLabel='';var voluumDomain='';var id='preview';var defaultValue=0;var leadsGateFormId='';</script>`;

  // Inject Tailwind CDN for custom templates that rely on Tailwind
  // which won't be compiled by our simple previewer.
  const tailwindCdn = `<script src="https://cdn.tailwindcss.com"></script>\n<script>tailwind.config = {theme: {extend: {colors: {primary: '${colorObj.p ? `hsl(${colorObj.p[0]} ${colorObj.p[1]}% ${colorObj.p[2]}%)` : '#2563EB'}', accent: '${colorObj.a ? `hsl(${colorObj.a[0]} ${colorObj.a[1]}% ${colorObj.a[2]}%)` : '#F97316'}', secondary: '${colorObj.s ? `hsl(${colorObj.s[0]} ${colorObj.s[1]}% ${colorObj.s[2]}%)` : '#10B981'}' } } } }</script>`;

  const headInjections = fallbackVars + '\n' + tailwindCdn;

  if (html.includes('</head>')) {
    html = html.replace('</head>', headInjections + '\n</head>');
  } else {
    html = headInjections + '\n' + html;
  }

  return html;
}

export function renderTemplateToAssets(template, site) {
  const assets = {};
  const files = template.files || {};

  // 1. Compile index.html
  const html = astroToHtmlPreview(files, site);
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
      const styleInjection = `<style type="text/tailwindcss">\n/* Injected from custom template CSS */\n${combinedCss}</style>\n</head>`;
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
