/**
 * Resolve wizard-facing capabilities for the selected template (Step 4 Design gating).
 * Module / legacy built-ins: full wizard theme + defaults for calculator/section reorder.
 * Custom (API) templates: read .lp-manifest.json via capability-resolver when present;
 * without manifest, conservative defaults (no fake theme controls).
 */

import { resolveTemplateId, getCustomTemplatesCache } from './template-registry.js';
import { loadAndValidateManifest } from './manifest-loader.js';
import { resolveCapabilities as resolveManifestCapabilities } from './capability-resolver.js';
import { isModuleTemplate, isLegacyModuleLikeTemplate } from './template-router.js';

/**
 * @typedef {Object} WizardTemplateCapabilities
 * @property {boolean} supportsWizardTheme - Color / font / layout / radius in wizard apply to this template
 * @property {boolean} supportsCalculator - Show calculator range controls in Design step
 * @property {boolean} supportsSectionReorder - Show section reorder UI in Design step
 */

function capBool(resolved, key) {
  const v = resolved?.[key];
  if (v && typeof v === 'object' && typeof v.value === 'boolean') return v.value;
  return false;
}

/**
 * @param {string} templateId
 * @returns {WizardTemplateCapabilities}
 */
export function resolveWizardTemplateCapabilities(templateId) {
  const id = resolveTemplateId(templateId || '') || templateId || '';
  if (!id) {
    return { supportsWizardTheme: true, supportsCalculator: true, supportsSectionReorder: true };
  }

  if (isModuleTemplate(id) || isLegacyModuleLikeTemplate(id)) {
    return {
      supportsWizardTheme: true,
      supportsCalculator: true,
      supportsSectionReorder: true,
    };
  }

  const cache = getCustomTemplatesCache();
  const custom = Array.isArray(cache)
    ? cache.find((t) => t.id === id || t.dbId === id)
    : null;

  if (custom && custom.source === 'api') {
    const files = custom.files && typeof custom.files === 'object' ? custom.files : {};
    const { manifest, valid } = loadAndValidateManifest(files);
    const resolved = resolveManifestCapabilities(files, valid ? manifest : null, {});

    const hasManifest = !!(valid && manifest);

    const supportsCalculator = capBool(resolved, 'supportsCalculator');
    const supportsSectionReorder = capBool(resolved, 'supportsSectionReorder');
    const explicitTheme = capBool(resolved, 'supportsWizardTheme');
    const customColors = capBool(resolved, 'supportsCustomColors');

    const supportsWizardTheme = explicitTheme || (hasManifest ? customColors : false);

    return {
      supportsWizardTheme,
      supportsCalculator,
      supportsSectionReorder,
    };
  }

  // Unknown id (e.g. cache not loaded): match historical wizard permissive defaults
  return {
    supportsWizardTheme: true,
    supportsCalculator: true,
    supportsSectionReorder: true,
  };
}
