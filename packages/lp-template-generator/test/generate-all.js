#!/usr/bin/env node

/**
 * Test: Generate ALL templates and validate output
 */

import { generate, listTemplates } from '../src/index.js';

const templates = listTemplates();
console.log(`\n🧪 Testing ${templates.length} templates...\n`);

let pass = 0, fail = 0;

const testConfigs = {
  'installment-loans': { brand: 'CashBear Loans', domain: 'cashbearloans.com', colorId: 'ruby', amountMax: 10000 },
  'pet-care-loans': { brand: 'PetPaw Finance', domain: 'petpawfinance.com', colorId: 'teal', niche: 'pet-care-loans', amountMax: 8000 },
};

for (const tmpl of templates) {
  const config = testConfigs[tmpl.id] || { brand: 'TestBrand', domain: 'test.com' };
  const result = generate(tmpl.id, config);

  const checks = [];

  // Check generation succeeded
  if (!result.files) {
    checks.push(`FAIL: No files generated. Errors: ${result.errors.join(', ')}`);
  } else {
    // Required files
    for (const req of ['package.json', 'astro.config.mjs', 'src/pages/index.astro']) {
      if (!result.files[req]) {
        checks.push(`FAIL: Missing ${req}`);
      }
    }

    // Validate all files are strings
    for (const [path, content] of Object.entries(result.files)) {
      if (typeof content !== 'string') {
        checks.push(`FAIL: ${path} is ${typeof content}, not string`);
      }
      if (content.includes('undefined')) {
        checks.push(`WARN: ${path} contains "undefined"`);
      }
      if (content.includes('[object Object]')) {
        checks.push(`WARN: ${path} contains "[object Object]"`);
      }
    }

    // Validate index.astro has required elements
    const index = result.files['src/pages/index.astro'];
    if (index) {
      if (!index.includes('<!doctype html>')) checks.push('FAIL: Missing doctype');
      if (!index.includes('<html')) checks.push('FAIL: Missing <html>');
      if (!index.includes('</html>')) checks.push('FAIL: Missing </html>');
      if (!index.includes('<style>')) checks.push('FAIL: Missing <style>');
      if (!index.includes(config.brand)) checks.push(`WARN: Brand "${config.brand}" not found`);
    }

    // Validate package.json is valid JSON
    try {
      const pkg = JSON.parse(result.files['package.json']);
      if (!pkg.dependencies?.astro) checks.push('FAIL: No astro dependency');
    } catch {
      checks.push('FAIL: package.json is not valid JSON');
    }
  }

  const fails = checks.filter(c => c.startsWith('FAIL'));
  const warns = checks.filter(c => c.startsWith('WARN'));

  if (fails.length === 0) {
    console.log(`  ✅ ${tmpl.id} — ${Object.keys(result.files).length} files, ${warns.length} warnings`);
    pass++;
  } else {
    console.log(`  ❌ ${tmpl.id}`);
    fails.forEach(c => console.log(`     ${c}`));
    fail++;
  }
  warns.forEach(c => console.log(`     ⚠️  ${c}`));
}

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${pass} passed, ${fail} failed out of ${templates.length}`);
console.log(`${'='.repeat(40)}\n`);

process.exit(fail > 0 ? 1 : 0);
