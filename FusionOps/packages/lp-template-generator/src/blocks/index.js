/**
 * Block Library — Main Export
 * All blocks available to the Composer
 */

export * from './heroes/index.js';
export * from './forms/index.js';
export * from './trust/index.js';
export * from './benefits/index.js';
export * from './secondary/index.js';

import { HEROES, HERO_IDS } from './heroes/index.js';
import { FORMS, FORM_IDS } from './forms/index.js';
import { TRUST, TRUST_IDS } from './trust/index.js';
import { BENEFITS, BENEFIT_IDS } from './benefits/index.js';
import { HOWIТWORKS, HIW_IDS, FAQS, FAQ_IDS, CTAS, CTA_IDS, LEGAL, LEGAL_IDS } from './secondary/index.js';

export const ALL_BLOCKS = {
  heroes:   HEROES,
  forms:    FORMS,
  trust:    TRUST,
  benefits: BENEFITS,
  hiw:      HOWIТWORKS,
  faq:      FAQS,
  cta:      CTAS,
  legal:    LEGAL,
};

export const BLOCK_IDS = {
  heroes:   HERO_IDS,
  forms:    FORM_IDS,
  trust:    TRUST_IDS,
  benefits: BENEFIT_IDS,
  hiw:      HIW_IDS,
  faq:      FAQ_IDS,
  cta:      CTA_IDS,
  legal:    LEGAL_IDS,
};

/**
 * Total combination count
 * heroes × forms × trust × benefits × hiw × faq × cta × legal
 */
export function getCombinationCount() {
  return Object.values(BLOCK_IDS).reduce((acc, ids) => acc * ids.length, 1);
}
