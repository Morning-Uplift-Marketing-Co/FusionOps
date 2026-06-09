/**
 * Test: Generic template parameterizer + substitution pipeline
 */
import { describe, it, expect } from 'vitest';
import { parameterizeTemplate, detectTemplateConstants, parameterizeHtmlString } from '../../generators/template-parameterizer.js';
import { substituteSiteVariables } from '../../template-preview-runtime.js';

// ─── Mock HTML templates for testing ───

const mockBoltTemplate = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vet Care Financing | PetFunderPro</title>
  <meta property="og:title" content="Pet Care Loans - PetFunderPro">
  <meta property="og:description" content="Get financing for your pet's veterinary care">
  <meta property="og:url" content="https://petfunderpro.com">
  <meta name="twitter:description" content="Get financing for your pet's veterinary care">
  <link rel="canonical" href="https://petfunderpro.com/">
  <script type="application/ld+json">{"@type":"Organization","name":"PetFunderPro","url":"https://petfunderpro.com"}</script>
</head>
<body>
  <h1>Need Help Paying Vet Bills?</h1>
  <p>Explore financing options from $100 - $5,000. APR 5.99% - 35.99%.</p>
  <a class="btn-primary" href="https://trk.petfunderpro.com/click">Check Available Options</a>
  <p>Call 1-800-555-1234 or email support@petfunderpro.com</p>
  <footer>© 2024 PetFunderPro. All rights reserved.</footer>
</body>
</html>`,
  'apply.html': `<!DOCTYPE html>
<html><head><title>Apply | PetFunderPro</title></head>
<body><h1>Apply for Financing</h1>
<p>PetFunderPro makes it easy to get approved.</p>
<a href="https://trk.petfunderpro.com/click">Apply Now</a>
</body></html>`,
};

const siteConfig = {
  domain: 'quickpetloans.com',
  brand: 'QuickPetLoans',
  h1: 'Fast Pet Care Financing',
  sub: 'Compare pet loan options instantly',
  cta: 'Get Approved Today',
  phone: '1-888-738-5626',
  email: 'info@quickpetloans.com',
  amountMin: '200',
  amountMax: '10,000',
  aprMin: '6.99',
  aprMax: '29.99',
  voluumClickUrl: 'https://trk.quickpetloans.com/click',
  siteUrl: 'https://quickpetloans.com',
};

// ─── Detection Tests ───

describe('detectTemplateConstants', () => {
  it('detects brand from <title> tag', () => {
    const constants = detectTemplateConstants(mockBoltTemplate);
    expect(constants.brand).toBe('PetFunderPro');
  });

  it('detects domain from canonical URL', () => {
    const constants = detectTemplateConstants(mockBoltTemplate);
    expect(constants.domain).toBe('petfunderpro.com');
  });

  it('detects H1 text', () => {
    const constants = detectTemplateConstants(mockBoltTemplate);
    expect(constants.title).toContain('Need Help');
  });

  it('detects phone number', () => {
    const constants = detectTemplateConstants(mockBoltTemplate);
    expect(constants.phone).toBeTruthy();
  });

  it('detects email', () => {
    const constants = detectTemplateConstants(mockBoltTemplate);
    expect(constants.email).toContain('@petfunderpro.com');
  });

  it('detects loan amounts', () => {
    const constants = detectTemplateConstants(mockBoltTemplate);
    expect(constants.amounts.length).toBeGreaterThan(0);
  });

  it('detects APR range', () => {
    const constants = detectTemplateConstants(mockBoltTemplate);
    expect(constants.apr).toContain('5.99%');
  });

  it('detects CTA from button link', () => {
    const constants = detectTemplateConstants(mockBoltTemplate);
    expect(constants.cta).toBeTruthy();
  });
});

// ─── Parameterization Tests ───

describe('parameterizeTemplate', () => {
  it('returns parameterized files with detected constants', () => {
    const { files, constants, rulesCount } = parameterizeTemplate(mockBoltTemplate);
    expect(constants.brand).toBe('PetFunderPro');
    expect(rulesCount).toBeGreaterThan(0);
    expect(files['index.html']).toBeDefined();
  });

  it('replaces brand name with ${brand}', () => {
    const { files } = parameterizeTemplate(mockBoltTemplate);
    const html = files['index.html'];
    expect(html).toContain('${brand}');
    expect(html).not.toContain('PetFunderPro');
  });

  it('replaces domain with ${domain}', () => {
    const { files } = parameterizeTemplate(mockBoltTemplate);
    const html = files['index.html'];
    // Domain replaced as part of URL or standalone
    expect(html).not.toContain('petfunderpro.com');
  });

  it('skips dist/ directory when skipDist=true', () => {
    const templateWithDist = {
      ...mockBoltTemplate,
      'dist/index.html': '<!DOCTYPE html><html><body>PetFunderPro built</body></html>',
    };
    const { files } = parameterizeTemplate(templateWithDist, { skipDist: true });
    expect(files['dist/index.html']).toContain('PetFunderPro'); // untouched
  });

  it('parameterizes apply.html too', () => {
    const { files } = parameterizeTemplate(mockBoltTemplate);
    expect(files['apply.html']).toContain('${brand}');
  });
});

// ─── Runtime Fallback Tests ───

describe('parameterizeHtmlString', () => {
  it('parameterizes a raw HTML string at runtime', () => {
    const raw = mockBoltTemplate['index.html'];
    const result = parameterizeHtmlString(raw);
    expect(result).toContain('${brand}');
  });

  it('returns unchanged HTML when no constants detected', () => {
    const plainHtml = '<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>';
    const result = parameterizeHtmlString(plainHtml);
    expect(result).toBe(plainHtml);
  });
});

// ─── Full Pipeline Tests ───

describe('Full pipeline: parameterize → substitute', () => {
  it('replaces brand correctly in final output', () => {
    const { files } = parameterizeTemplate(mockBoltTemplate);
    const finalHtml = substituteSiteVariables(files['index.html'], siteConfig);
    expect(finalHtml).toContain('QuickPetLoans');
    expect(finalHtml).not.toContain('PetFunderPro');
  });

  it('replaces domain correctly in final output', () => {
    const { files } = parameterizeTemplate(mockBoltTemplate);
    const finalHtml = substituteSiteVariables(files['index.html'], siteConfig);
    expect(finalHtml).toContain('quickpetloans.com');
    expect(finalHtml).not.toContain('petfunderpro.com');
  });

  it('replaces H1 correctly in final output', () => {
    const { files } = parameterizeTemplate(mockBoltTemplate);
    const finalHtml = substituteSiteVariables(files['index.html'], siteConfig);
    expect(finalHtml).toContain('Fast Pet Care Financing');
  });

  it('replaces CTA text correctly', () => {
    const { files } = parameterizeTemplate(mockBoltTemplate);
    const finalHtml = substituteSiteVariables(files['index.html'], siteConfig);
    expect(finalHtml).toContain('Get Approved Today');
    expect(finalHtml).not.toContain('Check Available Options');
  });

  it('replaces phone number correctly', () => {
    const { files } = parameterizeTemplate(mockBoltTemplate);
    const finalHtml = substituteSiteVariables(files['index.html'], siteConfig);
    expect(finalHtml).toContain('1-888-738-5626');
    expect(finalHtml).not.toContain('1-800-555-1234');
  });

  it('replaces email correctly', () => {
    const { files } = parameterizeTemplate(mockBoltTemplate);
    const finalHtml = substituteSiteVariables(files['index.html'], siteConfig);
    expect(finalHtml).toContain('info@quickpetloans.com');
    expect(finalHtml).not.toContain('support@petfunderpro.com');
  });

  it('no ${variable} placeholders remain outside protected script blocks', () => {
    const { files } = parameterizeTemplate(mockBoltTemplate);
    const finalHtml = substituteSiteVariables(files['index.html'], siteConfig);
    // Extract only the non-script-protected part
    const noScripts = finalHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
    const remaining = noScripts.match(/\$\{[a-zA-Z]+\}/g);
    if (remaining) {
      const allowed = [];
      const unexpected = remaining.filter(v => !allowed.includes(v.replace('${', '').replace('}', '')));
      expect(unexpected.length).toBe(0);
    }
  });
});

// ─── Cross-template compatibility ───

describe('Works with different templates', () => {
  it('parameterizes a generic lending template', () => {
    const genericTemplate = {
      'index.html': `<!DOCTYPE html><html>
<head><title>Payday Loans | CashQuickUSA</title>
<meta property="og:url" content="https://cashquickusa.com">
</head><body>
<h1>Get Cash Fast</h1>
<a class="btn" href="/apply">Apply Now</a>
<p>Loans from $200 to $2,500. APR 99.99% - 399.99%.</p>
<footer>CashQuickUSA © 2024</footer>
</body></html>`,
    };
    const { constants, files } = parameterizeTemplate(genericTemplate);
    expect(constants.brand).toBe('CashQuickUSA');
    expect(constants.domain).toBe('cashquickusa.com');
    expect(files['index.html']).toContain('${brand}');
  });

  it('handles templates with no detectable constants gracefully', () => {
    const minimalTemplate = {
      'index.html': '<!DOCTYPE html><html><body><p>No special content</p></body></html>',
    };
    const { files, rulesCount } = parameterizeTemplate(minimalTemplate);
    expect(files['index.html']).toBe(minimalTemplate['index.html']);
    expect(rulesCount).toBeGreaterThanOrEqual(0);
  });
});
