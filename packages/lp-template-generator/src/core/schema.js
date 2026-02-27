/**
 * Site Config Schema v2
 * =====================
 * Single source of truth for ALL template config.
 * Every template receives the same normalized config object.
 * 
 * RULE: If a field is not in SCHEMA, it does not exist.
 */

export const SCHEMA = {
  // ─── Brand & Identity ──────────────────────────────
  brand:      { type: 'string',  default: 'LoanBridge', required: true },
  domain:     { type: 'string',  default: 'example.com' },
  niche:      { type: 'string',  default: 'installment-loans', enum: ['installment-loans', 'pet-care-loans'] },

  // ─── Design Tokens ─────────────────────────────────
  colorId:    { type: 'string',  default: 'blue' },
  fontId:     { type: 'string',  default: 'dm-sans' },

  // ─── Loan / Product Config ─────────────────────────
  amountMin:  { type: 'number',  default: 100 },
  amountMax:  { type: 'number',  default: 5000 },
  aprMin:     { type: 'number',  default: 5.99 },
  aprMax:     { type: 'number',  default: 35.99 },

  // ─── Content ───────────────────────────────────────
  h1:         { type: 'string',  default: '' },
  sub:        { type: 'string',  default: '' },
  badge:      { type: 'string',  default: '' },
  cta:        { type: 'string',  default: 'Check My Rate' },

  // ─── Contact / Legal ───────────────────────────────
  email:      { type: 'string',  default: '' },
  phone:      { type: 'string',  default: '1-800-555-1234' },
  address:    { type: 'string',  default: '1700 Market Street, Suite 1005, Philadelphia, PA 19103' },

  // ─── Tracking & Affiliate ──────────────────────────
  conversionId:    { type: 'string', default: '' },
  formStartLabel:  { type: 'string', default: 'form_start' },
  formSubmitLabel: { type: 'string', default: 'form_submit' },
  aid:             { type: 'string', default: '' },
  network:         { type: 'string', default: 'LeadsGate' },
  redirectUrl:     { type: 'string', default: '' },
  voluumId:        { type: 'string', default: '' },
  voluumDomain:    { type: 'string', default: '' },
  formEmbed:       { type: 'string', default: '' },
};

/**
 * Normalize user config → merge with defaults
 * Guarantees every SCHEMA field exists in output
 */
export function normalizeConfig(raw = {}) {
  const out = {};
  for (const [key, def] of Object.entries(SCHEMA)) {
    const val = raw[key];
    if (val !== undefined && val !== null && val !== '') {
      // Type coerce
      if (def.type === 'number' && typeof val === 'string') {
        out[key] = Number(val);
      } else {
        out[key] = val;
      }
    } else {
      out[key] = def.default;
    }
  }

  // Auto-fill derived fields
  if (!out.email) out.email = `support@${out.domain}`;

  return out;
}

/**
 * Generate smart content defaults based on niche + config
 */
export function getContentDefaults(config) {
  const amt = `$${Number(config.amountMax).toLocaleString()}`;

  if (config.niche === 'pet-care-loans') {
    return {
      h1: config.h1 || `Affordable Pet Care Financing Up To ${amt}`,
      sub: config.sub || `Flexible payment plans for vet bills, surgery, dental & more. All credit types welcome.`,
      badge: config.badge || 'Trusted by 25,000+ pet owners',
      loanLabel: 'Pet Care Financing',
    };
  }

  // Default: installment-loans
  return {
    h1: config.h1 || `Fixed Monthly Payments Up To ${amt}`,
    sub: config.sub || `Installment loans from $${Number(config.amountMin).toLocaleString()} to ${amt}. No hidden fees.`,
    badge: config.badge || 'Trusted by 50,000+ borrowers',
    loanLabel: 'Installment Loans',
  };
}
