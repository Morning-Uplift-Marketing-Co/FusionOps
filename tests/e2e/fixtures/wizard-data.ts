/**
 * Wizard Test Data Fixtures
 *
 * Provides valid and invalid test data for wizard form fields
 */

export const VALID_BRAND_DATA = {
  brand: 'Test Loan Company',
  domain: 'test-loan.example.com',
  tagline: 'Fast. Simple. Trusted.',
  email: 'support@test-loan.example.com',
};

export const INVALID_BRAND_DATA = {
  emptyBrand: '',
  emptyDomain: '',
  invalidDomain: 'not-a-valid-domain@@',
  domainWithSpaces: 'domain with spaces.com',
  domainWithoutTLD: 'justdomain',
};

export const VALID_PRODUCT_DATA = {
  loanType: 'Personal',
  amountMin: 500,
  amountMax: 10000,
  aprMin: 5.99,
  aprMax: 35.99,
};

export const INVALID_PRODUCT_DATA = {
  amountMinNegative: -100,
  amountMaxNegative: -5000,
  minGreaterThanMax: { min: 10000, max: 500 },
  aprMinNegative: -5.99,
  aprMaxNegative: -35.99,
  aprMinGreaterThanMax: { min: 35.99, max: 5.99 },
};

export const VALID_TRACKING_DATA = {
  minimal: {
    mode: 'minimal' as const,
    conversionId: 'AW-987654321',
    formStartLabel: 'AbCdEfGhIjK',
    formSubmitLabel: 'XyZaBcDeFgH',
  },
  voluum: {
    mode: 'voluum' as const,
    conversionId: 'AW-987654321',
    voluumCampaignId: 'test-campaign-id',
  },
};

export const INVALID_TRACKING_DATA = {
  emptyConversionId: '',
  invalidConversionId: 'NOT-AW-FORMAT',
  voluumWithoutCampaign: {
    mode: 'voluum' as const,
    conversionId: 'AW-987654321',
  },
};

export const TEMPLATE_CATEGORIES = ['All', 'Loan', 'Pet', 'Custom'];

export const COLOR_SCHEMES = ['Ocean', 'Forest', 'Midnight', 'Ruby', 'Slate', 'Rose'];

export const FONTS = ['DM Sans', 'Inter', 'Outfit', 'Poppins'];

export const LAYOUTS = ['Classic', 'Modern', 'Compact'];

export const RADIUS_OPTIONS = ['Sharp', 'Rounded', 'Pill'];

export const TRUST_BADGE_STYLES = ['Cards', 'Compact', 'Minimal'];

export const AFFILIATE_NETWORKS = ['LeadsGate', 'ZeroParallel', 'LeadStack', 'Performance'];

export const LANGUAGES = ['English', 'Spanish', 'German', 'French', 'Italian'];

export const COPY_TEMPLATES = [
  { brand: 'QuickFund', h1: 'Get Cash Fast' },
  { brand: 'LoanBridge', h1: 'Smart Loans' },
  { brand: 'ElasticCredits', h1: 'Flexible Credit' },
];

/**
 * Complete wizard flow test data
 */
export const MINIMAL_WIZARD_DATA = {
  brand: {
    brand: 'Minimal Test LP',
    domain: 'minimal-test.example.com',
  },
  product: {
    amountMin: 500,
    amountMax: 5000,
    aprMin: 5.99,
    aprMax: 29.99,
  },
  template: 'Classic LP',
  design: {
    colorScheme: 'Ocean',
  },
  copy: {
    useTemplate: true,
  },
  tracking: {
    mode: 'minimal' as const,
    conversionId: 'AW-123456789',
  },
};

/**
 * Full wizard flow test data with all fields
 */
export const FULL_WIZARD_DATA = {
  brand: {
    brand: 'Full Test LP Company',
    domain: 'full-test-loan.example.com',
    tagline: 'Your Trusted Loan Partner',
    email: 'support@full-test-loan.example.com',
  },
  product: {
    loanType: 'Personal',
    amountMin: 1000,
    amountMax: 25000,
    aprMin: 4.99,
    aprMax: 35.99,
  },
  template: 'Classic LP',
  design: {
    colorScheme: 'Forest',
    font: 'Inter',
    layout: 'Modern',
    radius: 'Rounded',
  },
  copy: {
    h1: 'Get Your Fast Loan Today',
    badge: 'No Credit Check Required',
    cta: 'Apply Now',
    sub: 'Get approved in minutes. Funds as fast as next business day.',
    metaTitle: 'Get Fast Loans $100-$25,000 | Full Test LP - Apply Now',
    metaDesc: 'Need cash fast? Apply online in 2 minutes for loans up to $25,000. No hidden fees, instant decision.',
    lang: 'English',
  },
  tracking: {
    mode: 'minimal' as const,
    conversionId: 'AW-987654321',
    formStartLabel: 'form_start',
    formSubmitLabel: 'form_submit',
  },
};
