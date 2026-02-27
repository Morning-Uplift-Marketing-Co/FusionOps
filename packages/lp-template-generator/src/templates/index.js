/**
 * Templates Index
 * Registers all available templates.
 * Import this once to make all templates available.
 */

import { registerTemplate } from '../core/registry.js';
import { generate as genInstallment } from './installment-loans/index.js';
import { generate as genPetCare } from './pet-care-loans/index.js';

registerTemplate('installment-loans', {
  name: 'Installment Loans',
  description: 'Mobile-first LP with hero form, calculator, FAQ, APR compliance — for US installment/payday loans',
  niche: 'installment-loans',
  badge: 'Stable',
  generate: genInstallment,
});

registerTemplate('pet-care-loans', {
  name: 'Pet Care Loans',
  description: 'Pet financing LP with vet services grid, FAQ, compliance — for ScratchPay-style campaigns',
  niche: 'pet-care-loans',
  badge: 'Stable',
  generate: genPetCare,
});

// ── V2 Stable Templates (shared scaffold + compliance) ──
import { generate as genInstallmentV2 } from './installment-loans-v2/index.js';
import { generate as genPetCareV2 } from './pet-care-v2/index.js';

registerTemplate('installment-loans-v2', {
  name: 'Installment Loans V2',
  description: 'V2 stable — inline CSS, shared compliance, guaranteed no white pages. Mobile-first with hero form, FAQ, APR table.',
  niche: 'installment-loans',
  badge: 'V2 Stable',
  category: 'installment',
  generate: genInstallmentV2,
});

registerTemplate('pet-care-v2', {
  name: 'Pet Care V2',
  description: 'V2 stable pet financing LP — vet services grid, pet-themed hero, shared compliance module.',
  niche: 'pet-care-loans',
  badge: 'V2 Stable',
  category: 'pet-care',
  generate: genPetCareV2,
});

/**
 * === HOW TO ADD A TEMPLATE FROM OUTSIDE ===
 *
 * 1. Create folder: packages/lp-template-generator/src/templates/<your-id>/
 * 2. Add index.js with: export function generate(config) { return files; }
 * 3. Import and registerTemplate() here
 * 4. Restart dev server — template appears in Wizard!
 *
 * The generate() receives normalized config with design tokens resolved.
 * Must return files map: { 'package.json': '...', 'src/pages/index.astro': '...' }
 * Use shared modules:
 *   import { generateScaffold } from '../../shared/scaffold.js';
 *   import { baseCSS, fontTags } from '../../shared/base-css.js';
 *   import { aprTableHTML, disclaimerHTML, legalModalsHTML, ... } from '../../shared/compliance.js';
 */

/**
 * Register an external template dynamically (for runtime use from FusionOps UI)
 */
export function registerExternalTemplate(id, meta, generateFn) {
  registerTemplate(id, {
    name: meta.name || id,
    description: meta.description || '',
    niche: meta.niche || 'general',
    badge: meta.badge || 'External',
    category: meta.category || 'custom',
    generate: generateFn,
  });
}

/**
 * Register a template from raw Astro files (e.g. uploaded ZIP)
 */
export function registerFilesTemplate(id, meta, files) {
  registerTemplate(id, {
    name: meta.name || id,
    description: meta.description || 'Uploaded template',
    niche: meta.niche || 'general',
    badge: meta.badge || 'Uploaded',
    category: meta.category || 'custom',
    generate: (_config) => ({ ...files }),
  });
}
