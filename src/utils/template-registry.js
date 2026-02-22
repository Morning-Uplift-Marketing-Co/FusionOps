/**
 * Template Registry Bridge
 * Unified interface for template metadata from both the new module
 * and legacy definitions.
 */

import { generateLP, generateAstrodeckLoanPreview, generateLanderCorePreview } from './lp-generator.js';
import { generateAstroProject as generateAstrodeckAstro, generateLanderCore as generateLanderCoreAstro } from './astro-generator.jsx';
import { api } from '../services/api';

// Dynamic imports for module templates
let getModuleTemplates = null;
let getModuleTemplate = null;
let moduleLoaded = false;

async function loadModule() {
  if (moduleLoaded) return;
  try {
    const module = await import('#lp-template-generator/core/template-registry.js');
    getModuleTemplates = module.getTemplates;
    getModuleTemplate = module.getTemplate;
    moduleLoaded = true;
  } catch (e) {
    console.warn('Module templates not available:', e.message);
    moduleLoaded = true;
  }
}

// Initialize module loading
loadModule();

// Legacy templates not yet in the module
const LEGACY_TEMPLATES = [
  {
    id: 'astrodeck-loan',
    name: 'AstroDeck Loan',
    badge: 'New',
    description: 'New AstroDeck-style loan template architecture',
    category: 'legacy',
    source: 'legacy',
    // Generator functions for different output types
    generators: {
      html: generateAstrodeckLoanPreview,
      astro: generateAstrodeckAstro,
    },
  },
  {
    id: 'lander-core',
    name: 'PDL Loans V2',
    badge: 'Advanced',
    description: 'High-conversion bear-style template with interactive form',
    category: 'legacy',
    source: 'legacy',
    generators: {
      html: generateLanderCorePreview,
      astro: generateLanderCoreAstro,
    },
  },
];

// Module templates (fallback when module not loaded)
const MODULE_TEMPLATES_FALLBACK = [
  {
    id: 'classic',
    name: 'Classic LP',
    badge: 'Stable',
    description: 'Current production LP flow (HTML + Astro generator)',
    category: 'general',
    source: 'module',
  },
  {
    id: 'pdl-loans-v1',
    name: 'PDL Loans V1',
    badge: 'Popular',
    description: 'Payday/PDL loan template with hero form, trust badges, calculator, FAQ',
    category: 'pdl',
    source: 'module',
  },
  {
    id: 'pdl-loans-v3',
    name: 'PDL Loans V3',
    badge: 'New',
    description: 'Enhanced PDL template with modern design, dark mode, and improved UX',
    category: 'pdl',
    source: 'module',
  },
  {
    id: 'simple-lp',
    name: 'Simple LP',
    badge: 'Simple',
    description: 'Minimal landing page with full tracking support',
    category: 'general',
    source: 'module',
  },
];

// Template ID aliases for backward compatibility
const TEMPLATE_ALIASES = {
  'pdl-loansv1': 'pdl-loans-v1',
};

// Cache for custom templates from API
let customTemplatesCache = null;
let customTemplatesLoading = false;

/**
 * Fetch custom templates from API
 * @param {boolean} force - Force refetch even if cache exists
 */
export async function fetchCustomTemplates(force = false) {
  if (customTemplatesCache && !force) return customTemplatesCache;
  if (customTemplatesLoading) return [];

  customTemplatesLoading = true;
  try {
    const response = await api.get('/templates');
    if (response && Array.isArray(response)) {
      customTemplatesCache = response.map(t => ({
        id: t.template_id,
        dbId: t.id,
        name: t.name,
        description: t.description,
        badge: t.badge || 'Custom',
        category: t.category || 'custom',
        source: 'api',
        sourceCode: t.source_code,
        files: t.files ? JSON.parse(t.files) : {},
      }));
      return customTemplatesCache;
    }
  } catch (e) {
    console.warn('Failed to fetch custom templates:', e.message);
  } finally {
    customTemplatesLoading = false;
  }
  return [];
}

/**
 * Clear custom templates cache (call after saving new template)
 */
export function clearCustomTemplatesCache() {
  customTemplatesCache = null;
  customTemplatesLoading = false;
}

/**
 * Get all available templates (module + legacy + custom API)
 */
export async function getAllTemplatesAsync() {
  const [builtin, custom] = await Promise.all([
    Promise.resolve(getAllTemplates()),
    fetchCustomTemplates()
  ]);
  return [...builtin, ...custom];
}

/**
 * Get all available templates (module + legacy) - synchronous version
 */
export function getAllTemplates() {
  let moduleTemplates = MODULE_TEMPLATES_FALLBACK;

  if (getModuleTemplates) {
    try {
      moduleTemplates = getModuleTemplates().map(t => ({
        ...t,
        source: 'module',
        badge: t.badge || (t.id === 'classic' ? 'Stable' : ''),
      }));
    } catch (e) {
      console.warn('Module templates error, using fallback');
    }
  }

  return [...moduleTemplates, ...LEGACY_TEMPLATES];
}

/**
 * Get template by ID (resolves aliases)
 */
export function getTemplateById(id) {
  const resolvedId = TEMPLATE_ALIASES[id] || id;

  // Check legacy templates first (more reliable)
  const legacy = LEGACY_TEMPLATES.find(t => t.id === resolvedId);
  if (legacy) return legacy;

  // Check module templates
  if (getModuleTemplate) {
    try {
      const moduleTemplate = getModuleTemplate(resolvedId);
      if (moduleTemplate) {
        return {
          id: moduleTemplate.id,
          name: moduleTemplate.name,
          description: moduleTemplate.description,
          badge: moduleTemplate.badge || (resolvedId === 'classic' ? 'Stable' : ''),
          category: moduleTemplate.category,
          source: 'module',
        };
      }
    } catch (e) {
      console.warn('Module template lookup error');
    }
  }

  // Fallback to static list
  return MODULE_TEMPLATES_FALLBACK.find(t => t.id === resolvedId) || null;
}

/**
 * Check if template exists
 */
export function hasTemplate(id) {
  const resolvedId = TEMPLATE_ALIASES[id] || id;
  return !!MODULE_TEMPLATES_FALLBACK.find(t => t.id === resolvedId) || LEGACY_TEMPLATES.some(t => t.id === resolvedId);
}

/**
 * Get generator function for a template
 */
export function getTemplateGenerator(id, type = 'astro') {
  const resolvedId = TEMPLATE_ALIASES[id] || id;

  // Check if it's a known module template
  if (MODULE_TEMPLATES_FALLBACK.find(t => t.id === resolvedId)) {
    return { type: 'module', id: resolvedId };
  }

  // Legacy templates have explicit generators
  const legacy = LEGACY_TEMPLATES.find(t => t.id === resolvedId);
  if (legacy) {
    return { type: 'legacy', generator: legacy.generators[type] };
  }

  return null;
}

/**
 * Resolve template ID (handle aliases)
 */
export function resolveTemplateId(id) {
  if (!id) return id; // Return as-is for undefined/null
  return TEMPLATE_ALIASES[id] || id;
}
