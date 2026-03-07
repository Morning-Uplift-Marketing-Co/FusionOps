/**
 * Template Registry Bridge
 * Unified interface for template metadata from both the new module
 * and legacy definitions.
 */

import { generateAstrodeckLoanPreview, generateLanderCorePreview, generatePDLLoansV1Preview, generateWorkerSafeLoanPreview } from './lp-generator.js';
import { generateAstroProject as generateAstrodeckAstro, generateLanderCore as generateLanderCoreAstro, generateAstroProject as generateAstrodeckProject } from './astro-generator.jsx';
import { api } from '../services/api';
import astrodeckLoanAdapter from '../templates/astrodeck-loan/adapter.ts';
import workerSafeLoanAdapter from '../templates/worker-safe-loan/adapter.ts';
import pdlLoansV1Adapter from '../templates/pdl-loans-v1/adapter.ts';
import landerCoreAdapter from '../templates/lander-core/adapter.ts';

import { getTemplates as getModuleTemplates, getTemplate as getModuleTemplate } from '#lp-template-generator/core/template-registry.js';

// Static import achieved, maintain variables
let moduleLoaded = false;

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
      astro: generateAstrodeckProject,
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
  { id: 'installment-loans-v2', name: 'Installment Loans V2', badge: 'V2 Stable', description: 'V2 stable — inline CSS, shared compliance, guaranteed no white pages', category: 'installment', source: 'module' },
  { id: 'bear-loan-modern', name: 'Bear Loan Modern', badge: 'New', description: 'Modern dark fintech LP with social proof and payment calculator', category: 'installment', source: 'module' },
  { id: 'pet-care-v2', name: 'Pet Care V2', badge: 'V2 Stable', description: 'V2 stable pet financing LP with vet services grid', category: 'pet-care', source: 'module' },
  { id: 'installment-golden', name: 'Installment Golden', badge: 'Golden', description: 'Golden installment LP with production-safe tracking baseline', category: 'installment', source: 'module' },
  { id: 'pet-care-golden', name: 'Pet Care Golden', badge: 'Golden', description: 'Golden pet financing LP with mobile-first trust and FAQ flow', category: 'pet-care', source: 'module' },
  { id: 'leadgen-golden', name: 'LeadGen Golden', badge: 'Golden', description: 'Golden generic lead-gen LP for cross-vertical campaigns', category: 'general', source: 'module' },
  { id: 'template-green-01', name: 'Template Green 01', badge: 'Premium', description: 'Teal/green premium finance LP with amber CTAs. Mobile-first, clean design with calculator, FAQ, and trust elements.', category: 'installment', source: 'module' },
  { id: 'flowbite-loan', name: 'Flowbite Loan', badge: 'New', description: 'Modern loan LP — Flowbite CDN components, trust-heavy design, slider form, testimonials, FAQ. Mobile-first.', category: 'installment', source: 'module' },
  { id: 'hyperui-loan', name: 'HyperUI Loan', badge: 'New', description: 'Bold dark-hero loan LP — HyperUI style, green accents, stats strip, benefit grid, dark testimonials section.', category: 'installment', source: 'module' },
];

// ── HIDDEN BUILT-IN TEMPLATES ─────────────────────────────────────
// Built-in (module/legacy) templates cannot be deleted from DB,
// but users can hide them from the UI. Stored in localStorage.
const HIDDEN_BUILTIN_KEY = 'lp_hidden_builtin_templates';

function getHiddenBuiltinIds() {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_BUILTIN_KEY) || '[]')); } catch { return new Set(); }
}

export function hideBuiltinTemplate(id) {
  const set = getHiddenBuiltinIds();
  set.add(id);
  localStorage.setItem(HIDDEN_BUILTIN_KEY, JSON.stringify([...set]));
}

export function unhideBuiltinTemplate(id) {
  const set = getHiddenBuiltinIds();
  set.delete(id);
  localStorage.setItem(HIDDEN_BUILTIN_KEY, JSON.stringify([...set]));
}

export function isBuiltinHidden(id) {
  return getHiddenBuiltinIds().has(id);
}
// ──────────────────────────────────────────────────────────────────

// Template ID aliases for backward compatibility
const TEMPLATE_ALIASES = {
  'pdl-loansv1': 'pdl-loans-v1',
  'template-green-01': 'template-green-01',
  'green-01': 'template-green-01',
  'green-loan': 'template-green-01',
};

export const PAID_COMPONENT_SOURCE = Object.freeze({
  id: 'tailwind-ui',
  label: 'Tailwind UI',
  vendor: 'Tailwind Labs',
  tier: 'paid',
});

const PAID_SOURCE_TEMPLATE_IDS = new Set([
  'bear-loan-modern',
  'installment-golden',
  'pet-care-golden',
  'leadgen-golden',
]);

function resolveComponentSource(templateId, source) {
  const id = String(templateId || '').trim().toLowerCase();
  if (PAID_SOURCE_TEMPLATE_IDS.has(id)) return PAID_COMPONENT_SOURCE;
  if (source === 'api') {
    return Object.freeze({
      id: 'custom-import',
      label: 'Custom Import',
      vendor: 'Project',
      tier: 'mixed',
    });
  }
  return Object.freeze({
    id: 'internal',
    label: 'Internal',
    vendor: 'Project',
    tier: 'free',
  });
}

export function resolveWizardCategory(template) {
  const id = String(template?.id || '').toLowerCase();
  if (template?.source === 'api') return 'custom';
  const rawCategory = String(template?.category || '').toLowerCase();
  if (rawCategory === 'pet' || rawCategory === 'pet-care') return 'pet';
  if (rawCategory === 'custom') return 'custom';
  if (rawCategory === 'loan' || rawCategory === 'installment' || rawCategory === 'pdl' || rawCategory === 'general') return 'loan';
  return id.includes('pet') || id.includes('scratch') ? 'pet' : 'loan';
}

function normalizeTemplateRecord(template, { sourceHint = 'unknown', registryPath = 'unknown', collisionReason = '' } = {}) {
  const id = String(template?.id || '').trim();
  const source = String(template?.source || sourceHint || 'unknown');
  const componentSource = resolveComponentSource(id, source);
  return {
    ...template,
    id,
    source,
    componentSource,
    sourceResolved: source,
    registryPath,
    collisionReason: collisionReason || '',
    visibilityFlags: {
      hasHealthIssue: !!(template?.health && template.health.usable === false),
      hasCategory: !!template?.category,
      wizardCategory: resolveWizardCategory(template),
    },
  };
}

function mergeTemplateCollections(sources) {
  const byId = new Map();
  const collisions = [];

  for (const source of sources) {
    const templates = Array.isArray(source?.templates) ? source.templates : [];
    for (const raw of templates) {
      const normalized = normalizeTemplateRecord(raw, {
        sourceHint: source?.sourceHint,
        registryPath: source?.registryPath,
      });
      if (!normalized.id) continue;
      const key = normalized.id.toLowerCase();
      const existing = byId.get(key);
      if (existing) {
        collisions.push({
          id: normalized.id,
          kept: normalized.registryPath,
          replaced: existing.registryPath,
        });
        byId.set(key, {
          ...normalized,
          collisionReason: `override:${existing.registryPath}->${normalized.registryPath}`,
        });
      } else {
        byId.set(key, normalized);
      }
    }
  }

  return {
    templates: Array.from(byId.values()),
    collisions,
  };
}

/** @typedef {import('../adapters/template-registry-types').TemplateRegistryEntry} TemplateRegistryEntry */

/** @type {Record<string, TemplateRegistryEntry>} */
export const registry = Object.freeze({
  'worker-safe-loan': Object.freeze({
    id: 'worker-safe-loan',
    adapter: workerSafeLoanAdapter,
    generate: generateWorkerSafeLoanPreview,
    meta: Object.freeze({
      title: 'Worker-Safe Loan',
      category: 'general',
      tags: Object.freeze(['worker-safe', 'stable']),
      isPremium: false,
      isExperimental: false,
    }),
  }),
  'pdl-loansv1': Object.freeze({
    id: 'pdl-loansv1',
    adapter: pdlLoansV1Adapter,
    generate: generatePDLLoansV1Preview,
    meta: Object.freeze({
      title: 'PDL Loans V1',
      category: 'pdl',
      tags: Object.freeze(['payday', 'alias']),
      isPremium: false,
      isExperimental: false,
    }),
  }),
  'pdl-loans-v1': Object.freeze({
    id: 'pdl-loans-v1',
    adapter: pdlLoansV1Adapter,
    generate: generatePDLLoansV1Preview,
    meta: Object.freeze({
      title: 'PDL Loans V1',
      category: 'pdl',
      tags: Object.freeze(['payday']),
      isPremium: false,
      isExperimental: false,
    }),
  }),
  'astrodeck-loan': Object.freeze({
    id: 'astrodeck-loan',
    adapter: astrodeckLoanAdapter,
    generate: generateAstrodeckLoanPreview,
    meta: Object.freeze({
      title: 'AstroDeck Loan',
      category: 'legacy',
      tags: Object.freeze(['astrodeck', 'new']),
      isPremium: false,
      isExperimental: false,
    }),
  }),
  'lander-core': Object.freeze({
    id: 'lander-core',
    adapter: landerCoreAdapter,
    generate: generateLanderCorePreview,
    meta: Object.freeze({
      title: 'Lander Core',
      category: 'legacy',
      tags: Object.freeze(['high-conversion', 'advanced']),
      isPremium: false,
      isExperimental: false,
    }),
  }),
});

// Cache for custom templates from API
let customTemplatesCache = null;
let customTemplatesLoading = false;

let customTemplatesPromise = null;

function parseTemplateFiles(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return {};
}

function detectTemplateHealth(files) {
  const keys = Object.keys(files || {});
  // Empty files = GitHub Actions template (built on CI, not stored locally) — mark usable
  if (keys.length === 0) return { usable: true, entry: 'ci', reason: '' };
  const hasAstroIndex = keys.some(k => k === 'src/pages/index.astro' || k.endsWith('/src/pages/index.astro') || k.endsWith('index.astro'));
  const hasHtmlIndex = keys.some(k => k === 'index.html' || k.endsWith('/index.html'));
  const usable = hasAstroIndex || hasHtmlIndex;
  return {
    usable,
    entry: hasAstroIndex ? 'astro' : (hasHtmlIndex ? 'html' : 'none'),
    reason: usable ? '' : 'Missing index entry (need src/pages/index.astro or index.html)',
  };
}

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
        customTemplatesCache = response.map((t) => {
          const files = parseTemplateFiles(t.files);
          return normalizeTemplateRecord({
            files,
            health: detectTemplateHealth(files),
            id: t.template_id || t.id,
            dbId: t.id,
            name: t.name,
            description: t.description,
            badge: t.badge || 'Custom',
            category: t.category || 'custom',
            source: 'api',
            sourceCode: t.source_code,
            createdAt: t.created_at,
          }, {
            sourceHint: 'api',
            registryPath: 'api-custom',
          });
        });
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
    fetchCustomTemplates(),
  ]);

  const { templates, collisions } = mergeTemplateCollections([
    { templates: builtin, sourceHint: 'builtin', registryPath: 'builtin-merged' },
    { templates: custom, sourceHint: 'api', registryPath: 'api-custom' },
  ]);
  const collidedIds = new Set(collisions.map((c) => c.id.toLowerCase()));

  return templates.map((t) => ({
    ...t,
    visibilityFlags: {
      ...(t.visibilityFlags || {}),
      hasCollision: collidedIds.has(t.id.toLowerCase()),
    },
  }));
}

/**
 * Get all available templates (module + legacy) - synchronous version
 */
export function getAllTemplates() {
  let runtimeModuleTemplates = [];
  let runtimeError = '';

  if (getModuleTemplates) {
    try {
      runtimeModuleTemplates = getModuleTemplates().map((t) => ({
        ...t,
        source: 'module',
        badge: t.badge || (t.id === 'classic' ? 'Stable' : ''),
      }));
      moduleLoaded = true;
    } catch (e) {
      moduleLoaded = false;
      runtimeError = e?.message || 'unknown module error';
      console.warn('Module templates error, using fallback');
    }
  }

  const fallbackTemplates = MODULE_TEMPLATES_FALLBACK.map((t) => normalizeTemplateRecord(t, {
    sourceHint: t.source || 'module',
    registryPath: 'module-fallback',
  }));
  const moduleRuntimeTemplates = runtimeModuleTemplates.map((t) => normalizeTemplateRecord(t, {
    sourceHint: 'module',
    registryPath: 'module-runtime',
  }));
  const legacyTemplates = LEGACY_TEMPLATES.map((t) => normalizeTemplateRecord(t, {
    sourceHint: 'legacy',
    registryPath: 'legacy-static',
  }));

  // Deterministic merge order:
  // 1) fallback baseline, 2) runtime module overrides, 3) legacy overlays.
  const { templates, collisions } = mergeTemplateCollections([
    { templates: fallbackTemplates, sourceHint: 'module', registryPath: 'module-fallback' },
    { templates: moduleRuntimeTemplates, sourceHint: 'module', registryPath: 'module-runtime' },
    { templates: legacyTemplates, sourceHint: 'legacy', registryPath: 'legacy-static' },
  ]);
  const collidedIds = new Set(collisions.map((c) => c.id.toLowerCase()));

  const hiddenIds = getHiddenBuiltinIds();
  return templates
    .filter((t) => !hiddenIds.has(t.id))
    .map((t) => ({
      ...t,
      visibilityFlags: {
        ...(t.visibilityFlags || {}),
        runtimeModuleLoaded: runtimeModuleTemplates.length > 0 || moduleLoaded,
        runtimeModuleError: runtimeError,
        runtimeHasId: moduleRuntimeTemplates.some((m) => m.id === t.id),
        fallbackHasId: fallbackTemplates.some((f) => f.id === t.id),
        hasCollision: collidedIds.has(t.id.toLowerCase()),
      },
    }));
}

export function getTemplateDiagnostics(templates, options = {}) {
  const list = Array.isArray(templates) ? templates : getAllTemplates();
  const filterId = String(options.filterId || 'all');
  const hidden = [];
  const bySource = { module: 0, legacy: 0, api: 0, unknown: 0 };
  const byCategory = { loan: 0, pet: 0, custom: 0, other: 0 };
  const health = { usable: 0, broken: 0, unknown: 0 };

  for (const tpl of list) {
    const source = tpl.sourceResolved || tpl.source || 'unknown';
    if (source in bySource) bySource[source] += 1;
    else bySource.unknown += 1;

    const cat = tpl?.visibilityFlags?.wizardCategory || resolveWizardCategory(tpl);
    if (cat === 'loan' || cat === 'pet' || cat === 'custom') byCategory[cat] += 1;
    else byCategory.other += 1;

    if (tpl?.health?.usable === true) health.usable += 1;
    else if (tpl?.health?.usable === false) health.broken += 1;
    else health.unknown += 1;

    const reasons = [];
    if (tpl?.health?.usable === false) reasons.push(tpl?.health?.reason || 'Template health failed');
    if (filterId !== 'all' && cat !== filterId) reasons.push(`Filtered out by category "${filterId}"`);
    if (reasons.length > 0) {
      hidden.push({
        id: tpl.id,
        name: tpl.name || tpl.id,
        reasons,
        source,
        wizardCategory: cat || 'other',
      });
    }
  }

  return {
    total: list.length,
    bySource,
    byCategory,
    health,
    hidden,
    hiddenCount: hidden.length,
    visibleCount: list.length - hidden.length,
  };
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
