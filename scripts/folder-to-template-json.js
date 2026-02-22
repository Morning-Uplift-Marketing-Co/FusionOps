#!/usr/bin/env node
/**
 * folder-to-template-json.js
 *
 * Convert an Astro project folder into a JSON payload
 * ready to POST to POST /api/templates
 *
 * Usage:
 *   node scripts/folder-to-template-json.js <folder> [options]
 *
 * Options:
 *   --id        Template ID (default: folder name)
 *   --name      Display name (default: folder name)
 *   --desc      Description
 *   --badge     Badge label (default: New)
 *   --category  Category (default: general)
 *   --out       Output file path (default: <id>.template.json)
 *   --upload    Upload directly to API (requires API_URL env var)
 *   --api-url   API base URL (e.g. http://localhost:8787)
 *
 * Examples:
 *   node scripts/folder-to-template-json.js ./my-lp --id my-lp --name "My LP"
 *   node scripts/folder-to-template-json.js ./my-lp --upload --api-url http://localhost:8787
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([
  '.astro', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.json', '.css', '.html', '.md', '.env', '.toml', '.txt',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', '.astro', '.cache',
  '.netlify', '.vercel', '.wrangler', 'coverage',
]);

const SKIP_FILES = new Set([
  'package-lock.json', 'bun.lock', 'yarn.lock', 'pnpm-lock.yaml',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(arg);
    }
  }
  return args;
}

function collectFiles(dir, baseDir = dir, result = {}) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      collectFiles(fullPath, baseDir, result);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext) && ext !== '') continue;

      try {
        result[relPath] = fs.readFileSync(fullPath, 'utf-8');
      } catch {
        console.warn(`  ⚠ Skipped (unreadable): ${relPath}`);
      }
    }
  }

  return result;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const folderArg = args._[0];

  if (!folderArg) {
    console.error('Usage: node scripts/folder-to-template-json.js <folder> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --id        Template ID (default: folder name)');
    console.error('  --name      Display name');
    console.error('  --desc      Description');
    console.error('  --badge     Badge (default: New)');
    console.error('  --category  Category (default: general)');
    console.error('  --out       Output .json file path');
    console.error('  --upload    Upload directly to API');
    console.error('  --api-url   API base URL (default: http://localhost:8787)');
    process.exit(1);
  }

  const folderPath = path.resolve(folderArg);

  if (!fs.existsSync(folderPath)) {
    console.error(`Error: Folder not found: ${folderPath}`);
    process.exit(1);
  }

  const folderName = path.basename(folderPath);
  const templateId = args.id || slugify(folderName);
  const templateName = args.name || folderName;
  const description = args.desc || '';
  const badge = args.badge || 'New';
  const category = args.category || 'general';

  console.log(`\n📦 Converting: ${folderPath}`);
  console.log(`   Template ID : ${templateId}`);
  console.log(`   Name        : ${templateName}`);
  console.log(`   Category    : ${category}`);
  console.log('');

  // Collect files
  const files = collectFiles(folderPath);
  const fileCount = Object.keys(files).length;

  if (fileCount === 0) {
    console.error('Error: No files found in folder.');
    process.exit(1);
  }

  // Validate required file
  const hasIndex = Object.keys(files).some(f => f === 'src/pages/index.astro' || f.endsWith('/index.astro'));
  if (!hasIndex) {
    console.warn('⚠  Warning: src/pages/index.astro not found — preview may not work.');
  }

  console.log(`✅ Found ${fileCount} files:`);
  Object.keys(files).sort().forEach(f => console.log(`   📄 ${f}`));

  // Build payload
  const payload = {
    templateId,
    name: templateName,
    description,
    category,
    badge,
    sourceCode: `// Imported from folder: ${folderName}\n// Files: ${fileCount}\n// Generated: ${new Date().toISOString()}`,
    files,
  };

  // Output JSON
  const outFile = args.out || `${templateId}.template.json`;
  const outPath = path.resolve(outFile);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`\n💾 Saved to: ${outPath}`);

  // Upload to API
  if (args.upload) {
    const apiUrl = args['api-url'] || process.env.API_URL || 'http://localhost:8787';
    const endpoint = `${apiUrl}/api/templates`;

    console.log(`\n🚀 Uploading to: ${endpoint}`);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(`❌ Upload failed (${res.status}): ${data.error || JSON.stringify(data)}`);
        process.exit(1);
      }

      console.log(`✅ Uploaded successfully! Template ID: ${data.id}`);
      console.log(`   Template "${templateName}" is now available in LP Wizard.`);
    } catch (err) {
      console.error(`❌ Upload error: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log('\n💡 To upload directly, run with --upload flag:');
    console.log(`   node scripts/folder-to-template-json.js ${folderArg} --upload --api-url http://localhost:8787`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
