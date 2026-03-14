#!/usr/bin/env node
/**
 * Upload a local template folder to D1 Database via API
 *
 * Usage:
 *   node scripts/upload-template.mjs <folder> [--id <templateId>] [--name <name>] [--source bolt|loveable|custom]
 *
 * Examples:
 *   node scripts/upload-template.mjs ./my-template --id lion-funds-01 --name "Lion Funds" --source loveable
 *   node scripts/upload-template.mjs H:\templates\new-lp --id my-lp-v1
 *
 * If --id is not provided, it will be derived from the folder name.
 * If --name is not provided, it will be derived from the template ID.
 * If a template with the same ID already exists, it will be UPDATED.
 */
import fs from 'node:fs';
import path from 'node:path';

const API_BASE = process.env.API_BASE || 'https://lp-factory-api.misty-feather-556e.workers.dev';
const MCP_SECRET = process.env.MCP_SECRET || process.env.MCP_SHARED_SECRET || '';

// ─── Parse args ───
const args = process.argv.slice(2);
let folder = '';
let templateId = '';
let name = '';
let source = '';
let description = '';
let category = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--id' && args[i + 1]) { templateId = args[++i]; continue; }
  if (args[i] === '--name' && args[i + 1]) { name = args[++i]; continue; }
  if (args[i] === '--source' && args[i + 1]) { source = args[++i]; continue; }
  if (args[i] === '--desc' && args[i + 1]) { description = args[++i]; continue; }
  if (args[i] === '--category' && args[i + 1]) { category = args[++i]; continue; }
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

Examples:
  node scripts/upload-template.mjs ./my-template --id lion-funds-01 --name "Lion Funds"
  node scripts/upload-template.mjs H:\\templates\\new-lp --source loveable
`);
  process.exit(1);
}

const templateDir = path.resolve(folder);

if (!fs.existsSync(templateDir)) {
  console.error(`Folder not found: ${templateDir}`);
  process.exit(1);
}

// ─── Auto-detect source ───
if (!source) {
  if (fs.existsSync(path.join(templateDir, 'vite.config.ts')) || fs.existsSync(path.join(templateDir, 'vite.config.js'))) {
    const pkg = readJson(path.join(templateDir, 'package.json'));
    if (pkg?.devDependencies?.['lovable-tagger'] || pkg?.name?.includes('lovable')) {
      source = 'loveable';
    } else {
      source = 'vite';
    }
  } else if (fs.existsSync(path.join(templateDir, 'astro.config.mjs')) || fs.existsSync(path.join(templateDir, 'astro.config.ts'))) {
    const bolt = fs.existsSync(path.join(templateDir, '.bolt'));
    source = bolt ? 'bolt' : 'astro';
  } else {
    source = 'custom';
  }
}

// ─── Auto-detect ID ───
if (!templateId) {
  templateId = path.basename(templateDir)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

// ─── Auto-detect name ───
if (!name) {
  const pkg = readJson(path.join(templateDir, 'package.json'));
  if (pkg?.name && pkg.name !== 'vite_react_shadcn_ts' && !pkg.name.startsWith('my-')) {
    name = pkg.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } else {
    name = templateId.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

// ─── Badge ───
const badge = source === 'loveable' ? 'Loveable'
  : source === 'bolt' ? 'Bolt'
  : source === 'vite' ? 'Vite'
  : source === 'astro' ? 'Astro'
  : 'Custom';

// ─── Collect files ───
const IGNORE = new Set([
  'node_modules', '.git', 'dist', '.bolt', '.next', '.vercel',
  'playwright-report', 'test-results', 'coverage',
]);
const IGNORE_FILES = new Set([
  'package-lock.json', 'bun.lock', 'bun.lockb', 'yarn.lock', 'pnpm-lock.yaml',
  '.DS_Store', 'Thumbs.db',
]);
const MAX_FILE_SIZE = 500_000; // 500KB per file

const files = {};
let totalSize = 0;
let skipped = 0;

function collectFiles(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (IGNORE.has(entry.name)) continue;
      collectFiles(fullPath, relPath);
    } else {
      if (IGNORE_FILES.has(entry.name)) continue;
      if (entry.name.endsWith('.zip') || entry.name.endsWith('.tar.gz')) continue;

      const stat = fs.statSync(fullPath);
      if (stat.size > MAX_FILE_SIZE) {
        console.warn(`  ⚠ Skipping large file (${(stat.size / 1024).toFixed(0)}KB): ${relPath}`);
        skipped++;
        continue;
      }

      // Check if binary
      const ext = path.extname(entry.name).toLowerCase();
      const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.pdf']);
      if (binaryExts.has(ext)) {
        // Store binary files as base64
        const buf = fs.readFileSync(fullPath);
        files[relPath] = `data:base64,${buf.toString('base64')}`;
      } else {
        files[relPath] = fs.readFileSync(fullPath, 'utf8');
      }
      totalSize += stat.size;
    }
  }
}

console.log(`\nScanning: ${templateDir}`);
collectFiles(templateDir);

console.log(`\n📦 Template: ${name}`);
console.log(`   ID:       ${templateId}`);
console.log(`   Source:    ${source} (${badge})`);
console.log(`   Category: ${category || '(auto-detect)'}`);
console.log(`   Files:    ${Object.keys(files).length} (${skipped} skipped)`);
console.log(`   Size:     ${(totalSize / 1024).toFixed(0)}KB`);

// ─── Upload ───
console.log(`\nUploading to ${API_BASE}...`);

const payload = {
  templateId,
  name,
  description: description || `${name} template from ${badge}`,
  category: category || '',
  source,
  badge,
  files,
};

const headers = {
  'Content-Type': 'application/json',
  'Origin': 'http://localhost:4322',
};
if (MCP_SECRET) headers['x-mcp-secret'] = MCP_SECRET;

try {
  const res = await fetch(`${API_BASE}/api/mcp/templates`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const result = await res.json();

  if (res.ok) {
    console.log(`\n✅ ${result.action === 'updated' ? 'Updated' : 'Created'} template successfully!`);
    console.log(`   ID: ${result.id}`);
    console.log(`   Action: ${result.action}`);
  } else {
    console.error(`\n❌ Upload failed: ${result.error || res.statusText}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`\n❌ Upload error: ${err.message}`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}
