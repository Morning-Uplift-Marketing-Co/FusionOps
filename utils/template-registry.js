/**
 * Template Registry Bridge
 * Unified interface for template metadata from both the new module
 * and legacy definitions.
 */

import { generateLP, generateAstrodeckLoanPreview, generateLanderCorePreview } from './lp-generator.js';
import { generateAstroProject as generateAstrodeckAstro, generateLanderCore as generateLanderCoreAstro } from './astro-generator.jsx';
import { api } from '../services/api';

import { getTemplates as getModuleTemplates, getTemplate as getModuleTemplate } from '#lp-template-generator/core/template-registry.js';

// Static import achieved, maintain variables
let moduleLoaded = true;

// Module natively loaded

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
  { id: 'worker-safe-loan', name: 'Worker-Safe Loan', badge: 'No-TW', description: 'Worker-safe HTML template (no Tailwind CDN/runtime). Use when deployed templates distort.', category: 'general', source: 'legacy' },
  { id: 'classic', name: 'Classic LP', badge: 'Stable', description: 'Current production LP flow (HTML + Astro generator)', category: 'general', source: 'module' },
  { id: 'pdl-loans-v1', name: 'PDL Loans V1', badge: 'Popular', description: 'Payday/PDL loan template with hero form, trust badges, calculator, FAQ', category: 'pdl', source: 'module' },
  { id: 'pdl-loans-v3', name: 'PDL Loans V3', badge: 'New', description: 'Enhanced PDL template with modern design, dark mode, and improved UX', category: 'pdl', source: 'module' },
  { id: 'simple-lp', name: 'Simple LP', badge: 'Simple', description: 'Minimal landing page with full tracking support', category: 'general', source: 'module' },
  { id: 'pet-care-loans', name: 'Pet Care Loans', badge: 'New', description: 'Pet care financing landing page based on PDL V3 architecture', category: 'general', source: 'module' },
  { id: 'elastic-credits-v3', name: 'Elastic Credits V3', badge: 'New', description: 'Custom credit template with tracking integration and modern design', category: 'pdl', source: 'module' },
  { id: 'scratchpay-bridge', name: 'Scratchpay Bridge', badge: 'New', description: 'Pet care financing bridge page with claymorphism design', category: 'general', source: 'module' },
  { id: 'pet-loans-v1', name: 'Pet Loans V1', badge: 'New', description: 'Pet care financing LP with hero form, calculator, FAQ', category: 'pet-care', source: 'module' },
  { id: 'installment-loans-v1', name: 'Installment Loans V1', badge: 'New', description: 'Standard installment loan LP with payment calculator', category: 'installment', source: 'module' },
];

// Template ID aliases for backward compatibility
const TEMPLATE_ALIASES = {
  'pdl-loansv1': 'pdl-loans-v1',
};

// Cache for custom templates from API
let customTemplatesCache = null;
let customTemplatesLoading = false;

let customTemplatesPromise = null;

/**
 * Fetch custom templates from API
 * @param {boolean} force - Force refetch even if cache exists
 */
export async function fetchCustomTemplates(force = false) {
  if (customTemplatesCache && !force) return customTemplatesCache;
  if (customTemplatesPromise && !force) return customTemplatesPromise;

  customTemplatesPromise = (async () => {
    customTemplatesLoading = true;
    try {
      const response = await api.get('/templates');
      console.log("[Registry] Custom Templates fetch complete:", response);
      if (response && Array.isArray(response)) {
        customTemplatesCache = response.map(t => ({
          id: t.template_id || t.id,
          dbId: t.id,
          name: t.name,
          description: t.description,
          badge: t.badge || 'Custom',
          category: t.category || 'custom',
          source: 'api',
          sourceCode: t.source_code,
          files: t.files ? (typeof t.files === 'string' ? JSON.parse(t.files) : t.files) : {},
          createdAt: t.created_at,
        }));
        return customTemplatesCache;
      }
      return [];
    } catch (e) {
      console.warn('Failed to fetch custom templates:', e.message);
      return [];
    } finally {
      customTemplatesLoading = false;
      customTemplatesPromise = null;
    }
  })();

  return customTemplatesPromise;
}

/**
 * Delete a template from the database
 * @param {string} dbId - The UUID of the template in the database
 */
export async function deleteTemplate(dbId) {
  try {
    const res = await api.del(`/templates/${dbId}`);
    if (res && res.success) {
      clearCustomTemplatesCache();
      await fetchCustomTemplates(true);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Delete template error:', e);
    throw e;
  }
}

/**
 * Clear custom templates cache (call after saving new template)
 */
export function clearCustomTemplatesCache() {
  customTemplatesCache = null;
  customTemplatesLoading = false;
}

/**
 * Manually set custom templates cache (for deploy scripts that fetch API externally)
 */
export function setCustomTemplatesCache(templates) {
  customTemplatesCache = templates;
}

/**
 * Get the current custom templates cache
 */
export function getCustomTemplatesCache() {
  return customTemplatesCache;
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
 * Includes custom templates from API when cache is populated
 */
export function getTemplateById(id) {
  if (!id) return null;
  const resolvedId = TEMPLATE_ALIASES[id] || id;

  // Check custom templates from API (when cache is populated)
  if (customTemplatesCache) {
    const custom = customTemplatesCache.find(t => t.id === resolvedId || t.dbId === resolvedId);
    if (custom) {
      return {
        id: custom.id,
        dbId: custom.dbId,
        name: custom.name,
        description: custom.description,
        badge: custom.badge || 'Custom',
        category: custom.category,
        source: 'api',
        files: custom.files,
      };
    }
  }

  // Check legacy templates
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
  if (!id) return false;
  const resolvedId = TEMPLATE_ALIASES[id] || id;
  if (customTemplatesCache?.some(t => t.id === resolvedId)) return true;
  return !!MODULE_TEMPLATES_FALLBACK.find(t => t.id === resolvedId) || LEGACY_TEMPLATES.some(t => t.id === resolvedId);
}

/**
 * Get generator function for a template
 */
export function getTemplateGenerator(id, type = 'astro') {
  const resolvedId = TEMPLATE_ALIASES[id] || id;

  // Custom API templates — template-router handles via customTemplatesCache
  if (customTemplatesCache?.some(t => t.id === resolvedId)) {
    return { type: 'api', id: resolvedId };
  }

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
