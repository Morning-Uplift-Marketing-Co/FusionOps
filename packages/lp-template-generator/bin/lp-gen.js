#!/usr/bin/env node

/**
 * LP Generator CLI
 * Usage: node bin/lp-gen.js --template installment-loans --brand "CashBear" --out ./output
 */

import { generate, listTemplates } from '../src/index.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const templateId = getArg('template') || getArg('t');
const outDir = getArg('out') || getArg('o') || './output';

// Parse all other --key value pairs as config
const config = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i]?.replace(/^--/, '');
  const val = args[i + 1];
  if (key && val && !['template', 't', 'out', 'o'].includes(key)) {
    config[key] = val;
  }
}

if (!templateId || args.includes('--help') || args.includes('-h')) {
  console.log(`
LP Template Generator v2
========================

Usage:
  lp-gen --template <id> [--out <dir>] [--brand "Name"] [--domain "x.com"] [...]

Templates:`);
  for (const t of listTemplates()) {
    console.log(`  ${t.id.padEnd(22)} ${t.badge.padEnd(8)} ${t.description}`);
  }
  console.log(`
Options:
  --template, -t   Template ID (required)
  --out, -o        Output directory (default: ./output)
  --brand          Brand name
  --domain         Domain name
  --colorId        Color theme (blue, ruby, green, purple, orange, teal, slate)
  --fontId         Font (dm-sans, inter, space-grotesk, plus-jakarta, outfit)
  --amountMin      Min loan amount
  --amountMax      Max loan amount
  --aprMin         Min APR
  --aprMax         Max APR
  --niche          Niche (installment-loans, pet-care-loans)
  --aid            Affiliate ID
  --conversionId   Google Ads conversion ID
  `);
  process.exit(0);
}

// Generate
const result = generate(templateId, config);

if (!result.ok && !result.files) {
  console.error('❌ Generation failed:');
  result.errors.forEach(e => console.error(`   ${e}`));
  process.exit(1);
}

// Write files
let count = 0;
for (const [path, content] of Object.entries(result.files)) {
  const fullPath = join(outDir, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, 'utf-8');
  count++;
}

console.log(`✅ Generated ${count} files → ${outDir}/`);
if (result.errors.length) {
  console.log(`⚠️  Warnings:`);
  result.errors.forEach(e => console.log(`   ${e}`));
}
console.log(`\nNext: cd ${outDir} && npm install && npm run build`);
