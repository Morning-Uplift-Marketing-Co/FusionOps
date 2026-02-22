import { generateLP, generateAstrodeckLoanPreview, generateApplyPage, generatePDLLoansV1Preview, generateLanderCorePreview } from "./lp-generator.js";
import { generateAstroProject } from "./astro-generator.jsx";
import { getTemplateGenerator, resolveTemplateId as resolveId } from "./template-registry.js";

// Ensure templates are registered (side-effect import)
import "#lp-template-generator/templates";

// Eagerly import the module generator for synchronous use
import { generateTemplate as generateFromModule } from "#lp-template-generator/core/generator.js";

// Import colors for template variable substitution
import { COLORS as ALL_COLORS } from "../constants";
import { api } from "../services/api";

export const DEFAULT_TEMPLATE_ID = "classic";

// Cache for custom templates from API
let customTemplatesCache = null;
let customTemplatesLoading = false;

// Start loading custom templates immediately
function loadCustomTemplates() {
  if (customTemplatesLoading || customTemplatesCache) return;
  customTemplatesLoading = true;
  api.get('/templates').then(response => {
    if (response && Array.isArray(response)) {
      customTemplatesCache = response.map(t => ({
        id: t.template_id,
        name: t.name,
        description: t.description,
        badge: t.badge || 'Custom',
        category: t.category || 'custom',
        source: 'api',
        files: t.files ? JSON.parse(t.files) : {},
      }));
    }
  }).catch(e => {
    console.warn('Failed to load custom templates:', e);
  }).finally(() => {
    customTemplatesLoading = false;
  });
}

// Start loading on module import
loadCustomTemplates();

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
  const indexContent = files['src/pages/index.astro'];
  if (!indexContent) {
    return '<div style="padding:20px;text-align:center;">No index.astro file found</div>';
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

  // Remove frontmatter if present (code between ---)
  html = html.replace(/---[\s\S]*?---/g, '');

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
  html = html.replace(/<style[^>]*>/gi, '<style>');
  html = html.replace(/<\/style>/gi, '</style>');

  // Inject fallback variable definitions before </head> to prevent ReferenceErrors
  const fallbackVars = `<script>var conversionId='';var formStartLabel='';var formSubmitLabel='';var voluumDomain='';var id='preview';var defaultValue=0;var leadsGateFormId='';</script>`;
  if (html.includes('</head>')) {
    html = html.replace('</head>', fallbackVars + '\n</head>');
  } else {
    html = fallbackVars + html;
  }

  return html;
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
    default:
      // Check if it's a custom API template (synchronously from cache)
      if (customTemplatesCache) {
        const customTemplate = customTemplatesCache.find(t => t.id === templateId || t.template_id === templateId);
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

// Export a function to refresh custom templates cache
export function refreshCustomTemplates() {
  customTemplatesCache = null;
  customTemplatesLoading = false;
  loadCustomTemplates();
}

export function generateAstroProjectByTemplate(site) {
  const templateId = resolveTemplateId(site);

  // Check custom API templates first — return raw Astro source files
  if (customTemplatesCache) {
    const customTemplate = customTemplatesCache.find(t => t.id === templateId || t.template_id === templateId);
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
