#!/usr/bin/env node
/**
 * Upload a local template folder to D1 Database via API.
 *
 * Usage:
 *   node scripts/upload-template.mjs <folder> [--id <templateId>] [--name <name>] [--source bolt|loveable|custom] [--status <status>]
 *
 * Examples:
 *   node scripts/upload-template.mjs ./my-template --id lion-funds-01 --name "Lion Funds" --source loveable
 *   node scripts/upload-template.mjs H:\templates\new-lp --id my-lp-v1 --status active
 */
import fs from 'node:fs';
import path from 'node:path';

const API_BASE = process.env.API_BASE || 'https://lp-factory-api.misty-feather-556e.workers.dev';
const MCP_SECRET = process.env.MCP_SECRET || process.env.MCP_SHARED_SECRET || '';
const ALLOWED_STATUSES = new Set(['draft', 'active', 'deprecated', 'archived']);

const args = process.argv.slice(2);
let folder = '';
let templateId = '';
let name = '';
let source = '';
let description = '';
let category = '';
let status = '';

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--id' && args[i + 1]) { templateId = args[++i]; continue; }
  if (args[i] === '--name' && args[i + 1]) { name = args[++i]; continue; }
  if (args[i] === '--source' && args[i + 1]) { source = args[++i]; continue; }
  if (args[i] === '--desc' && args[i + 1]) { description = args[++i]; continue; }
  if (args[i] === '--category' && args[i + 1]) { category = args[++i]; continue; }
  if (args[i] === '--status' && args[i + 1]) { status = String(args[++i] || '').toLowerCase(); continue; }
  if (!args[i].startsWith('--')) folder = args[i];
}

if (!folder) {
  console.error(`
Usage: node scripts/upload-template.mjs <folder> [options]

Options:
  --id <templateId>     Template ID (default: derived from folder name)
  --name <name>         Display name (default: derived from ID)
  --source <source>     Source: bolt | loveable | custom (default: auto-detect)
  --desc <description>  Template description
  --category <cat>      Category: loan | pet | installment | custom | general
  --status <status>     Status: draft | active | deprecated | archived

Examples:
  node scripts/upload-template.mjs ./my-template --id lion-funds-01 --name "Lion Funds"
  node scripts/upload-template.mjs H:\\templates\\new-lp --source loveable --status active
`);
  process.exit(1);
}

const templateDir = path.resolve(folder);
if (!fs.existsSync(templateDir)) {
  console.error(`Folder not found: ${templateDir}`);
  process.exit(1);
}

if (status && !ALLOWED_STATUSES.has(status)) {
  console.error(`Invalid --status "${status}". Allowed: draft | active | deprecated | archived`);
  process.exit(1);
}

if (!source) {
  if (fs.existsSync(path.join(templateDir, 'vite.config.ts')) || fs.existsSync(path.join(templateDir, 'vite.config.js'))) {
    const pkg = readJson(path.join(templateDir, 'package.json'));
    if (pkg?.devDependencies?.['lovable-tagger'] || pkg?.name?.includes('lovable')) source = 'loveable';
    else source = 'vite';
  } else if (fs.existsSync(path.join(templateDir, 'astro.config.mjs')) || fs.existsSync(path.join(templateDir, 'astro.config.ts'))) {
    source = fs.existsSync(path.join(templateDir, '.bolt')) ? 'bolt' : 'astro';
  } else {
    source = 'custom';
  }
}

if (!templateId) {
  templateId = path.basename(templateDir)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

if (!name) {
  const pkg = readJson(path.join(templateDir, 'package.json'));
  if (pkg?.name && pkg.name !== 'vite_react_shadcn_ts' && !pkg.name.startsWith('my-')) {
    name = pkg.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  } else {
    name = templateId.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

const badge = source === 'loveable' ? 'Loveable'
  : source === 'bolt' ? 'Bolt'
    : source === 'vite' ? 'Vite'
      : source === 'astro' ? 'Astro'
        : 'Custom';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.bolt', '.next', '.vercel', 'playwright-report', 'test-results', 'coverage']);
const IGNORE_FILES = new Set(['package-lock.json', 'bun.lock', 'bun.lockb', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store', 'Thumbs.db']);
const MAX_FILE_SIZE = 500_000;
const BINARY_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.pdf']);

const files = {};
let totalSize = 0;
let skipped = 0;

function collectFiles(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      collectFiles(fullPath, relPath);
      continue;
    }

    if (IGNORE_FILES.has(entry.name)) continue;
    if (entry.name.endsWith('.zip') || entry.name.endsWith('.tar.gz')) continue;

    const stat = fs.statSync(fullPath);
    if (stat.size > MAX_FILE_SIZE) {
      console.warn(`  [skip] large file (${(stat.size / 1024).toFixed(0)}KB): ${relPath}`);
      skipped += 1;
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (BINARY_EXTS.has(ext)) {
      files[relPath] = `data:base64,${fs.readFileSync(fullPath).toString('base64')}`;
    } else {
      files[relPath] = fs.readFileSync(fullPath, 'utf8');
    }
    totalSize += stat.size;
  }
}

console.log(`\nScanning: ${templateDir}`);
collectFiles(templateDir);

console.log(`\nTemplate: ${name}`);
console.log(`   ID: ${templateId}`);
console.log(`   Source: ${source} (${badge})`);
console.log(`   Category: ${category || '(auto-detect)'}`);
console.log(`   Status: ${status || '(unchanged/default)'}`);
console.log(`   Files: ${Object.keys(files).length} (${skipped} skipped)`);
console.log(`   Size: ${(totalSize / 1024).toFixed(0)}KB`);

const payload = {
  templateId,
  name,
  description: description || `${name} template from ${badge}`,
  category: category || '',
  source,
  badge,
  files,
  ...(status ? { status } : {}),
};

const headers = {
  'Content-Type': 'application/json',
  Origin: 'http://localhost:4322',
};
if (MCP_SECRET) headers['x-mcp-secret'] = MCP_SECRET;

console.log(`\nUploading to ${API_BASE}...`);

try {
  const res = await fetch(`${API_BASE}/api/mcp/templates`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  if (!res.ok) {
    console.error(`\nUpload failed: ${result.error || res.statusText}`);
    process.exit(1);
  }

  console.log('\nUpload succeeded');
  console.log(`   ID: ${result.id}`);
  console.log(`   Action: ${result.action}`);
  if (result.status || status) {
    console.log(`   Status: ${result.status || status}`);
  }
} catch (err) {
  console.error(`\nUpload error: ${err.message}`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}
