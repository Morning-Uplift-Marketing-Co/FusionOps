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
import { generate as genBearLoanModern } from './bear-loan-modern/index.js';
import { generate as genInstallmentGolden } from './installment-golden/index.js';
import { generate as genPetCareGolden } from './pet-care-golden/index.js';
import { generate as genLeadgenGolden } from './leadgen-golden/index.js';
import { generate as genFlowbiteLoan } from './flowbite-loan/index.js';
import { generate as genHyperUILoan } from './hyperui-loan/index.js';

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

registerTemplate('bear-loan-modern', {
  name: 'Bear Loan Modern',
  description: 'Modern conversion-first design inspired by premium fintech LPs: social proof, calculator, and clean dark UI.',
  niche: 'installment-loans',
  badge: 'New',
  category: 'installment',
  generate: genBearLoanModern,
});

registerTemplate('installment-golden', {
  name: 'Installment Golden',
  description: 'Golden installment template with production-safe tracking baseline and publish-gate readiness.',
  niche: 'installment-loans',
  badge: 'Golden',
  category: 'installment',
  generate: genInstallmentGolden,
});

registerTemplate('pet-care-golden', {
  name: 'Pet Care Golden',
  description: 'Golden pet care financing template with vet-focused layout and tracking baseline.',
  niche: 'pet-care-loans',
  badge: 'Golden',
  category: 'pet-care',
  generate: genPetCareGolden,
});

registerTemplate('flowbite-loan', {
  name: 'Flowbite Loan',
  description: 'Modern loan LP — Flowbite CDN components, trust-heavy design, slider form, testimonials, FAQ. Mobile-first.',
  niche: 'installment-loans',
  badge: 'New',
  category: 'installment',
  generate: genFlowbiteLoan,
});

registerTemplate('hyperui-loan', {
  name: 'HyperUI Loan',
  description: 'Bold dark-hero loan LP — HyperUI style, green accents, stats strip, benefit grid, dark testimonials section.',
  niche: 'installment-loans',
  badge: 'New',
  category: 'installment',
  generate: genHyperUILoan,
});

registerTemplate('leadgen-golden', {
  name: 'LeadGen Golden',
  description: 'Golden generic lead generation template for multi-vertical campaigns.',
  niche: 'general',
  badge: 'Golden',
  category: 'general',
  generate: genLeadgenGolden,
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
