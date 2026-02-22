#!/usr/bin/env node
/**
 * ============================================================
 * FusionOps - Run D1 Migrations (Fixed)
 * ============================================================
 * Runs migrations from each worker's directory
 *
 * Usage:
 *   node scripts/migrate-d1.js
 * ============================================================
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

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

// ============================================================
// Run Migrations (from worker directory)
// ============================================================

function runMigrationsForDatabase(workerDir, dbName) {
  const fullPath = join(rootDir, workerDir);
  const migrationsDir = join(fullPath, 'migrations');

  if (!existsSync(migrationsDir)) {
    log.warning(`Migrations directory not found: ${migrationsDir}`);
    return { success: 0, failed: 0 };
  }

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  log.info(`Running ${files.length} migrations for ${dbName}...`);
  log.info(`  Directory: ${workerDir}`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    log.info(`  → ${file}`);

    // Run from the worker directory so npx wrangler@4 can find npx wrangler@4.toml
    const result = exec(
      `npx wrangler@4 d1 execute ${dbName} --file="migrations/${file}" --remote`,
      {
        cwd: fullPath,
        stdio: 'pipe'
      }
    );

    if (result !== null) {
      success++;
      log.success(`    ✓ ${file}`);
    } else {
      failed++;
      log.error(`    ✗ ${file}`);
    }
  }

  if (failed === 0) {
    log.success(`All migrations complete for ${dbName}`);
  } else {
    log.warning(`${success} succeeded, ${failed} failed for ${dbName}`);
  }

  return { success, failed };
}

// ============================================================
// Verify Migrations
// ============================================================

function verifyDatabase(workerDir, dbName, tableName) {
  const fullPath = join(rootDir, workerDir);

  log.info(`Checking ${dbName}...`);

  try {
    const result = exec(
      `npx wrangler@4 d1 execute ${dbName} --command="SELECT COUNT(*) as count FROM ${tableName}" --remote`,
      {
        cwd: fullPath,
        stdio: 'pipe'
      }
    );
    log.success(`  ✓ Table '${tableName}' exists`);
    return true;
  } catch (err) {
    // Table might not exist yet - that's ok for fresh databases
    log.warning(`  Table '${tableName}' not found (expected for fresh database)`);
    return false;
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  log.step('FusionOps - D1 Migrations');

  // Migrations configuration
  const migrations = [
    {
      worker: 'apps/api-worker',
      db: 'fusionops-main-new-v2',
      verifyTable: 'sites'
    },
    {
      worker: 'apps/pixel-worker',
      db: 'fusionops-pixel-new-v2',
      verifyTable: 'pixel_events'
    },
    {
      worker: 'apps/worker',
      db: 'fusionops-callback-new-v2',
      verifyTable: 'accounts'
    }
  ];

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const migration of migrations) {
    const result = runMigrationsForDatabase(migration.worker, migration.db);
    totalSuccess += result.success;
    totalFailed += result.failed;

    // Verify
    verifyDatabase(migration.worker, migration.db, migration.verifyTable);
  }

  // Summary
  log.step('Migration Complete!');

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  Migration Summary                                           │
├─────────────────────────────────────────────────────────────┤
│  Success:  ${totalSuccess.toString().padEnd(52)}│
│  Failed:   ${totalFailed.toString().padEnd(52)}│
└─────────────────────────────────────────────────────────────┘

${totalFailed === 0 ? '✓ All migrations successful!' : '✗ Some migrations failed - check errors above'}

Next step: Deploy workers
  node scripts/deploy-all.js --workers-only
`);
}

main().catch(err => {
  log.error(err.message);
  process.exit(1);
});
