#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function walkFiles(root, predicate, acc = []) {
  if (!fs.existsSync(root)) return acc;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, acc);
      continue;
    }
    if (predicate(full)) acc.push(full);
  }
  return acc;
}

const templateDirArg = process.argv[2];
if (!templateDirArg) {
  console.error('Usage: node scripts/validate-template-quality.mjs <template-dir>');
  process.exit(2);
}

const templateDir = path.resolve(templateDirArg);
if (!fs.existsSync(templateDir)) {
  console.error(`Template folder not found: ${templateDir}`);
  process.exit(2);
}

const allFiles = walkFiles(templateDir, () => true);
const htmlFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.html'));
const textFiles = allFiles.filter((f) => /\.(astro|html|css|js|jsx|ts|tsx|json)$/i.test(f));

const htmlCombined = htmlFiles.map(readText).join('\n');
const combined = textFiles.map(readText).join('\n');

const hasExpressionLeak = /\{title\}|\{\s*noindex\s*\?|\{\s*[a-zA-Z_$][\w$]*\s*&&\s*\(/.test(htmlCombined);
const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(combined);
const hasPrimaryToken = /--color-primary|--primary\s*:|--fo-primary|var\(--color-primary\)|var\(--primary\)|var\(--fo-primary\)|hsl\(var\(--primary\)\)/i.test(combined);

const blocking = [];
const warnings = [];

if (hasExpressionLeak) blocking.push('Potential Astro expression leak detected ({title}/{...&&(...)}).');
if (!hasViewport) warnings.push('Viewport meta not detected (mobile UX risk).');
if (!hasPrimaryToken) warnings.push('Primary color token not detected (--color-primary / var(--primary)).');

if (blocking.length) {
  console.error('\nQuality Gate ✗ Fail');
  for (const issue of blocking) console.error(`- ${issue}`);
  for (const issue of warnings) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('\nQuality Gate ✓ Pass');
for (const issue of warnings) console.warn(`- ${issue}`);
