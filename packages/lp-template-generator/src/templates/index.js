/**
 * Templates Index
 * Exports all available templates
 */

import { registerTemplate } from '../core/template-registry.js';
import { generate as generateClassic } from './classic/index.js';
import { generate as generatePDLLoansV1 } from './pdl-loans-v1/index.js';
import { generate as generatePDLLoansV3 } from './pdl-loans-v3/index.js';
import { generate as generateSimpleLP } from './simple-lp/index.js';
import { generate as generatePetCareLoans } from './pet-care-loans/index.js';
import { generate as generateElasticCreditsV3 } from './elastic-credits-v3/index.js';
import { generate as generateScratchpayBridge } from './scratchpay-bridge/index.js';
import { generate as generatePetLoansV1 } from './pet-loans-v1/index.js';
import { generate as generateInstallmentLoansV1 } from './installment-loans-v1/index.js';

// Register Classic Template
registerTemplate('classic', {
  name: 'Classic LP',
  description: 'Simple, clean landing page with form and compliance',
  badge: 'Stable',
  category: 'general',
  generate: generateClassic,
});

// Register PDL Loans V1 Template
registerTemplate('pdl-loans-v1', {
  name: 'PDL Loans V1',
  description: 'Payday/PDL loan template with hero form, trust badges, calculator, FAQ - Zero-JS architecture',
  badge: 'Popular',
  category: 'pdl',
  generate: generatePDLLoansV1,
});

// Register PDL Loans V3 Template
registerTemplate('pdl-loans-v3', {
  name: 'PDL Loans V3',
  description: 'Enhanced PDL template with modern design, dark mode, and improved UX',
  badge: 'New',
  category: 'pdl',
  generate: generatePDLLoansV3,
});

// Register Simple LP Template
registerTemplate('simple-lp', {
  name: 'Simple LP',
  description: 'Minimal landing page with full tracking support - perfect starting point',
  badge: 'Simple',
  category: 'general',
  generate: generateSimpleLP,
});

// Register Pet Care Loans Template
registerTemplate('pet-care-loans', {
  name: 'Pet Care Loans',
  description: 'Pet care financing landing page based on PDL V3 architecture',
  badge: 'New',
  category: 'general',
  generate: generatePetCareLoans,
});

// Register Elastic Credits V3 Template
registerTemplate('elastic-credits-v3', {
  name: 'Elastic Credits V3',
  description: 'Custom credit template with tracking integration and modern design',
  badge: 'New',
  category: 'pdl',
  generate: generateElasticCreditsV3,
});

// Register Scratchpay Bridge Template
registerTemplate('scratchpay-bridge', {
  name: 'Scratchpay Bridge',
  description: 'Pet care financing bridge page with claymorphism design, payment calculator, and modal system',
  badge: 'New',
  category: 'general',
  generate: generateScratchpayBridge,
});

// Register Pet Loans V1 Template
registerTemplate('pet-loans-v1', {
  name: 'Pet Loans V1',
  description: 'Pet care financing LP with hero form, calculator, FAQ, testimonials — Tailwind + zero-JS static components',
  badge: 'New',
  category: 'pet-care',
  generate: generatePetLoansV1,
});

// Register Installment Loans V1 Template
registerTemplate('installment-loans-v1', {
  name: 'Installment Loans V1',
  description: 'Standard installment loan LP with payment calculator, multi-step form, trust badges, FAQ',
  badge: 'New',
  category: 'installment',
  generate: generateInstallmentLoansV1,
});

// Export for direct use
export { generate as generateClassic } from './classic/index.js';
export { generate as generatePDLLoansV1 } from './pdl-loans-v1/index.js';
export { generate as generatePDLLoansV3 } from './pdl-loans-v3/index.js';
export { generate as generateSimpleLP } from './simple-lp/index.js';
export { generate as generatePetCareLoans } from './pet-care-loans/index.js';
export { generate as generateElasticCreditsV3 } from './elastic-credits-v3/index.js';
export { generate as generateScratchpayBridge } from './scratchpay-bridge/index.js';
export { generate as generatePetLoansV1 } from './pet-loans-v1/index.js';
export { generate as generateInstallmentLoansV1 } from './installment-loans-v1/index.js';
