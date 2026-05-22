#!/usr/bin/env node
/**
 * ============================================================
 * FusionOps - Create NEW D1 Databases (Separate from old project)
 * ============================================================
 * Creates fresh D1 databases for FusionOps project
 *
 * ⚠️  WARNING: This script CREATES NEW databases and OVERWRITES
 * database_id values in all wrangler.toml files.
 * DO NOT run against production unless intentionally migrating
 * to new databases.
 * Production IDs (as of 2026-05-23):
 *   fusionops-main-new-v2     = 4eaee76d-10fb-42a7-bb9d-50737c3da785
 *   fusionops-pixel-new-v2   = 99437cde-5e7c-4b58-97ad-69e43019c6ff
 *   fusionops-callback-new-v2 = 5219aeec-c6d8-42e4-9a40-15573c6e53a4
 *
 * Usage:
 *   node scripts/create-new-databases.js
 * ============================================================
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ============================================================
// Configuration - NEW database names for FusionOps
// ============================================================
// Legacy D1 / project DB names (do not use for new creates):
//   lp-factory-db, ppc-gen-claude, lp-factory-beta
// See INFRASTRUCTURE_SETUP.md → "Legacy database / D1 names".

const NEW_DATABASES = {
  main: 'fusionops-main',
  pixel: 'fusionops-pixel',
  callback: 'fusionops-callback'
};

// ============================================================
// Colors
// ============================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  step: (msg) => {
    console.log('');
    console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}  ${msg}${colors.reset}`);
    console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log('');
  }
};

function exec(command, options = {}) {
  const opts = {
    cwd: rootDir,
    stdio: options.stdio || 'pipe',
    ...options
  };
  try {
    return execSync(command, opts).toString().trim();
  } catch (err) {
    if (options.ignoreError) return null;
    throw err;
  }
}

function execJson(command) {
  try {
    const output = exec(command);
    return JSON.parse(output);
  } catch (err) {
    return null;
  }
}

// ============================================================
// Create D1 Database
// ============================================================

async function createD1Database(dbName) {
  log.info(`Creating D1 database: ${dbName}`);

  // Check if already exists
  const existing = execJson('wrangler d1 list --json');
  const found = existing?.find(db => db.name === dbName);

  if (found) {
    log.warning(`Database ${dbName} already exists`);
    return { name: dbName, id: found.database_id || found.uuid };
  }

  // Create new
  const output = exec(`wrangler d1 create ${dbName} --json`);
  const result = JSON.parse(output);

  log.success(`Created ${dbName}`);
  log.info(`  ID: ${result.database_id}`);

  return { name: dbName, id: result.database_id };
}

// ============================================================
// Update wrangler.toml files
// ============================================================

function updateWranglerToml(filePath, dbName, dbId) {
  let content = readFileSync(filePath, 'utf-8');

  // Update production database
  content = content.replace(
    /database_name = "ppc-gen-claude"/g,
    `database_name = "${dbName}"`
  );
  content = content.replace(
    /database_id = "[a-f0-9-]+"/g,
    `database_id = "${dbId}"`
  );

  // Update staging database names
  content = content.replace(
    /database_name = "ppc-gen-claude-staging"/g,
    `database_name = "${dbName}-staging"`
  );
  content = content.replace(
    /database_id = "7d31d941-f863-46f5-99c2-2179de821573"/g,
    `database_id = "${dbId}"`
  );

  writeFileSync(filePath, content);
  log.success(`Updated: ${filePath}`);
}

// ============================================================
// Main Flow
// ============================================================

async function main() {
  log.step('Creating NEW D1 Databases for FusionOps');

  console.log(`
This will create NEW databases separate from your old project:
  - ${NEW_DATABASES.main}    (main app data)
  - ${NEW_DATABASES.pixel}   (analytics tracking)
  - ${NEW_DATABASES.callback} (lead callbacks)

Your old databases will NOT be affected.
`);

  // Get account ID
  log.info('Getting Cloudflare Account ID...');
  const whoami = execJson('wrangler whoami --json');
  const accountId = whoami?.account ? Object.keys(whoami.account)[0] : null;
  if (accountId) {
    log.success(`Account ID: ${accountId}`);
  }

  // Create databases
  const dbIds = {};
  const dbOrder = ['main', 'pixel', 'callback'];

  for (const key of dbOrder) {
    dbIds[key] = await createD1Database(NEW_DATABASES[key]);
  }

  // Update wrangler.toml files
  log.step('Updating wrangler.toml Files');

  updateWranglerToml(
    join(rootDir, 'apps/api-worker/wrangler.toml'),
    dbIds.main.name,
    dbIds.main.id
  );

  updateWranglerToml(
    join(rootDir, 'apps/pixel-worker/wrangler.toml'),
    dbIds.pixel.name,
    dbIds.pixel.id
  );

  updateWranglerToml(
    join(rootDir, 'apps/worker/wrangler.toml'),
    dbIds.callback.name,
    dbIds.callback.id
  );

  // Save IDs to file
  const idsFile = join(rootDir, '.d1-db-ids');
  writeFileSync(idsFile, `# Cloudflare D1 Database IDs for FusionOps
# Generated: ${new Date().toISOString()}

D1_MAIN_ID="${dbIds.main.id}"
D1_PIXEL_ID="${dbIds.pixel.id}"
D1_CALLBACK_ID="${dbIds.callback.id}"

D1_MAIN_NAME="${dbIds.main.name}"
D1_PIXEL_NAME="${dbIds.pixel.name}"
D1_CALLBACK_NAME="${dbIds.callback.name}"

CF_ACCOUNT_ID="${accountId || ''}"
`);

  log.success('Database IDs saved to .d1-db-ids');

  // Summary
  log.step('Databases Created Successfully!');

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  FusionOps D1 Databases                                      │
├─────────────────────────────────────────────────────────────┤
│  Main:      ${dbIds.main.name.padEnd(44)}│
│  Pixel:     ${dbIds.pixel.name.padEnd(44)}│
│  Callback:  ${dbIds.callback.name.padEnd(44)}│
└─────────────────────────────────────────────────────────────┘

Next step: Run migrations
  node scripts/migrate-d1.js
`);
}

main().catch(err => {
  log.error(err.message);
  process.exit(1);
});
