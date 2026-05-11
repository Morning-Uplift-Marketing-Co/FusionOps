#!/usr/bin/env node
/**
 * Quick sanity check for new clones: Node version, optional .env, optional api-worker deps.
 * Does not print secrets. Exit 1 only if Node is below package.json engines.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const pkg = readJson(path.join(repoRoot, 'package.json'));
const enginesNode = pkg.engines?.node || '>=22.0.0';
const match = enginesNode.match(/(\d+)/);
const minMajor = match ? Number(match[1]) : 22;

const current = Number(process.version.slice(1).split('.')[0]);
const okNode = current >= minMajor;

const lines = ['', '── FusionOps setup check ──', `  Node: ${process.version} (need ${enginesNode})`];

if (!okNode) {
  lines.push(`  ${'✖'} Upgrade Node to v${minMajor}+ (see .nvmrc).`);
  console.log(lines.join('\n'));
  process.exit(1);
}
lines.push(`  ${'✔'} Node OK`);

const envPath = path.join(repoRoot, '.env');
if (fs.existsSync(envPath)) {
  lines.push(`  ${'✔'} .env present`);
} else {
  lines.push(`  ${'○'} .env missing — copy .env.example → .env (see README)`);
}

const nvmrcPath = path.join(repoRoot, '.nvmrc');
if (fs.existsSync(nvmrcPath)) {
  const want = fs.readFileSync(nvmrcPath, 'utf8').trim();
  lines.push(`  .nvmrc → ${want}`);
}

const workerNm = path.join(repoRoot, 'apps', 'api-worker', 'node_modules');
if (fs.existsSync(workerNm)) {
  lines.push(`  ${'✔'} apps/api-worker dependencies installed`);
} else {
  lines.push(`  ${'○'} api-worker deps not installed — run: npm run install:api-worker`);
}

lines.push('', '  Dev server: http://localhost:4321  (npm run dev)', '');
console.log(lines.join('\n'));
