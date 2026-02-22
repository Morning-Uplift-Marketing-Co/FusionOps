/**
 * Site Config Schema
 * Defines the structure for site configuration passed to generators
 */

export const SCHEMA = {
  // Brand & Identity
  brand: { type: 'string', default: 'LoanBridge', required: true },
  domain: { type: 'string', default: 'example.com' },

  // Design
  colorId: { type: 'string', default: 'ruby' },
  fontId: { type: 'string', default: 'dm-sans' },
  radius: { type: 'string', default: 'md' },

  // Loan Config
  loanType: { type: 'string', default: 'personal' },
  amountMin: { type: 'number', default: 100 },
  amountMax: { type: 'number', default: 5000 },
  aprMin: { type: 'number', default: 5.99 },
  aprMax: { type: 'number', default: 35.99 },

  // Content
  h1: { type: 'string', default: '' },
  h1span: { type: 'string', default: '' },
  sub: { type: 'string', default: '' },
  badge: { type: 'string', default: '' },
  cta: { type: 'string', default: 'Apply Now' },

  // Tracking
  conversionId: { type: 'string', default: '' },
  formStartLabel: { type: 'string', default: '' },
  formSubmitLabel: { type: 'string', default: '' },
  aid: { type: 'string', default: '' },
  network: { type: 'string', default: '' },
  redirectUrl: { type: 'string', default: '' },
  voluumId: { type: 'string', default: '' },
  voluumDomain: { type: 'string', default: '' },
  formEmbed: { type: 'string', default: '' },

  // Meta
  templateId: { type: 'string', default: 'classic' },
};

/**
 * Validate and merge site config with defaults
 */
export function normalizeConfig(config = {}) {
  const normalized = {};

  for (const [key, def] of Object.entries(SCHEMA)) {
    const value = config[key];
    if (value !== undefined && value !== null && value !== '') {
      normalized[key] = value;
    } else {
      normalized[key] = typeof def.default === 'function' ? def.default() : def.default;
    }
  }

  return normalized;
}

/**
 * Get dynamic defaults based on loan type
 */
export function getDynamicDefaults(config) {
  const loanLabels = {
    'personal': 'Personal Loans',
    'payday': 'Payday Loans',
    'installment': 'Installment Loans',
    'pdl': 'PDL Loans',
  };

  const h1Defaults = {
    'personal': `Fast ${loanLabels[config.loanType] || 'Personal Loans'} Up To $${(config.amountMax || 5000).toLocaleString()}`,
    'payday': 'Get Your Cash Today',
    'installment': 'Monthly Payments That Work',
    'pdl': 'A Smarter Way to Borrow',
  };

  return {
    loanLabel: loanLabels[config.loanType] || 'Personal Loans',
    h1: config.h1 || h1Defaults[config.loanType] || h1Defaults.personal,
  };
}
