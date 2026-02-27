/**
 * Generate an Astrodeck preview site from the template generator
 * and write it to a temp folder for local dev server preview.
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// We need to import from src — use tsx or direct import
const { generateAstroProject } = await import(join(root, 'src/utils/astro-generator.jsx'));

const site = {
  brand: 'ElasticCredit',
  domain: 'elasticcredit.com',
  colorId: 'ocean',
  fontId: 'inter',
  radius: 'md',
  loanType: 'personal',
  amountMin: 500,
  amountMax: 5000,
  h1: 'Fast Personal Loans Up To $5,000',
  sub: 'Get approved in minutes. Funds as fast as next business day.',
  cta: 'Check My Rate',
  aid: '14881',
  conversionId: '',
  formStartLabel: '',
  formSubmitLabel: '',
  voluumDomain: '',
};

const files = generateAstroProject(site);

const outDir = join(root, '.preview-astrodeck');

// Clean previous generated files but preserve node_modules and .vercel
if (existsSync(outDir)) {
  for (const entry of ['src', 'public', 'dist', 'package.json', 'astro.config.mjs', 'tsconfig.json', '.env', 'README.md']) {
    const p = join(outDir, entry);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
};

// Write files
for (const [filePath, content] of Object.entries(files)) {
  const fullPath = join(outDir, filePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
}

console.log(`✅ Preview site generated at: ${outDir}`);
console.log(`📁 Files: ${Object.keys(files).join(', ')}`);
