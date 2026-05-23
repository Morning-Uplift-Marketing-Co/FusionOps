#!/usr/bin/env node
/**
 * ============================================================
 * FusionOps - Infrastructure Setup Script (Node.js)
 * ============================================================
 * Cross-platform infrastructure setup for Windows/Linux/Mac
 *
 * Usage:
 *   node scripts/setup-infrastructure.js
 *   node scripts/setup-infrastructure.js --d1-only
 * ============================================================
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ============================================================
// Configuration
// ============================================================

const CONFIG = {
  project: 'fusionops',
  databases: {
    main: 'fusionops-main',
    pixel: 'fusionops-pixel',
    callback: 'fusionops-callback'
  },
  workers: ['api-worker', 'cf-proxy', 'pixel-worker', 'worker'],
  migrations: {
    main: ['0001_init.sql', '0002_deploy_history.sql', '0002_add_templates.sql'],
    pixel: ['0001_pixel_events.sql'],
    callback: ['0001_init.sql']
  }
};

// ============================================================
// Utilities
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function confirm(message) {
  // In automated mode, always return true
  if (process.env.CI || process.argv.includes('--yes')) {
    return true;
  }
  // For interactive mode, would need readline - simplified here
  return true;
}

// ============================================================
// Pre-flight Checks
// ============================================================

async function preflightCheck() {
  log.step('Pre-flight Checks');

  // Check Node.js
  const nodeVersion = process.version;
  log.success(`Node.js: ${nodeVersion}`);

  // Check npm
  const npmVersion = exec('npm -v');
  log.success(`npm: ${npmVersion}`);

  // Check Wrangler
  let wranglerVersion;
  try {
    wranglerVersion = exec('wrangler --version');
    log.success(`Wrangler: ${wranglerVersion}`);
  } catch (err) {
    log.warning('Wrangler not found. Installing...');
    exec('npm install -g wrangler', { stdio: 'inherit' });
    log.success('Wrangler installed');
  }

  // Check Cloudflare authentication
  log.info('Checking Cloudflare authentication...');
  try {
    const whoami = execJson('wrangler whoami --json');
    if (whoami) {
      const account = Object.keys(whoami?.account || {})[0] || 'Unknown';
      log.success(`Authenticated for account: ${account}`);
      return whoami;
    }
  } catch (err) {
    log.error('Not logged in to Cloudflare. Run: wrangler login');
    throw new Error('Cloudflare authentication required');
  }
}

// ============================================================
// Cloudflare Account ID
// ============================================================

function getAccountId() {
  log.info('Getting Cloudflare Account ID...');

  try {
    const whoami = execJson('wrangler whoami --json');
    const accountId = Object.keys(whoami?.account || {})[0];
    if (accountId) {
      log.success(`Account ID: ${accountId}`);
      return accountId;
    }
  } catch (err) {
    log.warning('Could not get Account ID from wrangler');
  }

  return null;
}

// ============================================================
// D1 Database Operations
// ============================================================

async function createD1Database(dbName) {
  log.info(`Creating D1 database: ${dbName}`);

  // Check if exists
  const existing = execJson('wrangler d1 list --json');
  const found = existing?.find(db => db.name === dbName || db.name === `ppc-gen-claude` /* old name */);

  if (found) {
    log.warning(`Database ${dbName} already exists (${found.name})`);
    return { name: found.name, id: found.database_id || found.uuid };
  }

  // Create new
  const output = exec(`wrangler d1 create ${dbName} --json`);
  const result = JSON.parse(output);

  log.success(`Created ${dbName} with ID: ${result.database_id}`);
  return { name: dbName, id: result.database_id };
}

async function createAllD1Databases() {
  log.step('Creating Cloudflare D1 Databases');

  const dbIds = {};

  for (const [key, name] of Object.entries(CONFIG.databases)) {
    const result = await createD1Database(name);
    dbIds[key] = result;
    await sleep(500); // Rate limiting
  }

  return dbIds;
}

// ============================================================
// Run Migrations
// ============================================================

async function runMigration(dbName, migrationFile) {
  const fullPath = join(rootDir, migrationFile);
  if (!existsSync(fullPath)) {
    log.warning(`Migration file not found: ${migrationFile}`);
    return;
  }

  log.info(`  Running: ${migrationFile}`);
  exec(`wrangler d1 execute ${dbName} --file="${fullPath}" --local=false`, { stdio: 'pipe' });
}

async function runAllMigrations(dbIds) {
  log.step('Running Database Migrations');

  // Main database migrations
  log.info(`Running migrations for ${dbIds.main.name}...`);
  const mainMigrationsDir = join(rootDir, 'apps/api-worker/migrations');
  if (existsSync(mainMigrationsDir)) {
    const files = readdirSync(mainMigrationsDir).filter(f => f.endsWith('.sql'));
    for (const file of files) {
      await runMigration(dbIds.main.name, `apps/api-worker/migrations/${file}`);
    }
  }
  log.success('Main database migrations complete');

  // Pixel database migrations
  log.info(`Running migrations for ${dbIds.pixel.name}...`);
  const pixelMigrationsDir = join(rootDir, 'apps/pixel-worker/migrations');
  if (existsSync(pixelMigrationsDir)) {
    const files = readdirSync(pixelMigrationsDir).filter(f => f.endsWith('.sql'));
    for (const file of files) {
      await runMigration(dbIds.pixel.name, `apps/pixel-worker/migrations/${file}`);
    }
  }
  log.success('Pixel database migrations complete');

  // Callback database migrations
  log.info(`Running migrations for ${dbIds.callback.name}...`);
  const callbackMigrationsDir = join(rootDir, 'apps/worker/migrations');
  if (existsSync(callbackMigrationsDir)) {
    const files = readdirSync(callbackMigrationsDir).filter(f => f.endsWith('.sql'));
    for (const file of files) {
      await runMigration(dbIds.callback.name, `apps/worker/migrations/${file}`);
    }
  }
  log.success('Callback database migrations complete');
}

// ============================================================
// Update wrangler.toml files
// ============================================================

function updateWranglerToml(filePath, replacements) {
  if (!existsSync(filePath)) {
    log.warning(`File not found: ${filePath}`);
    return;
  }

  let content = readFileSync(filePath, 'utf-8');
  let modified = false;

  for (const [search, replace] of Object.entries(replacements)) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    if (content.match(regex)) {
      content = content.replace(regex, replace);
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(filePath, content);
    log.success(`Updated: ${filePath}`);
  }
}

async function updateAllWranglerConfigs(dbIds, accountId) {
  log.step('Updating wrangler.toml Files');

  // Update api-worker
  updateWranglerToml(join(rootDir, 'apps/api-worker/wrangler.toml'), {
    'database_name = "ppc-gen-claude"': `database_name = "${dbIds.main.name}"`,
    'database_id = "[0-9a-f-]+"': `database_id = "${dbIds.main.id}"`
  });

  // Update pixel-worker
  updateWranglerToml(join(rootDir, 'apps/pixel-worker/wrangler.toml'), {
    'database_name = "ppc-gen-claude"': `database_name = "${dbIds.pixel.name}"`,
    'database_id = "[0-9a-f-]+"': `database_id = "${dbIds.pixel.id}"`,
    'database_name = "lp-factory-db-staging"': `database_name = "${dbIds.pixel.name}-staging"`,
    'YOUR_STAGING_D1_DATABASE_ID': dbIds.pixel.id
  });

  // Update worker (callback)
  updateWranglerToml(join(rootDir, 'apps/worker/wrangler.toml'), {
    'database_name = "ppc-gen-claude"': `database_name = "${dbIds.callback.name}"`,
    'database_id = "[0-9a-f-]+"': `database_id = "${dbIds.callback.id}"`,
    'database_name = "lp-factory-db-staging"': `database_name = "${dbIds.callback.name}-staging"`,
    'YOUR_STAGING_D1_DATABASE_ID': dbIds.callback.id
  });

  log.success('All wrangler.toml files updated');

  // Save IDs to file
  const idsFile = join(rootDir, '.d1-db-ids');
  writeFileSync(idsFile, `# Cloudflare D1 Database IDs
# Generated: ${new Date().toISOString()}

D1_MAIN_ID="${dbIds.main.id}"
D1_PIXEL_ID="${dbIds.pixel.id}"
D1_CALLBACK_ID="${dbIds.callback.id}"

D1_MAIN_NAME="${dbIds.main.name}"
D1_PIXEL_NAME="${dbIds.pixel.name}"
D1_CALLBACK_NAME="${dbIds.callback.name}"

# Cloudflare Account ID
CF_ACCOUNT_ID="${accountId}"
`);
  log.success('Database IDs saved to .d1-db-ids');
}

// ============================================================
// Deploy Workers
// ============================================================

async function deployWorker(workerName) {
  const workerDir = join(rootDir, 'apps', workerName);
  if (!existsSync(workerDir)) {
    log.warning(`Worker directory not found: ${workerName}`);
    return;
  }

  log.info(`Deploying ${workerName}...`);

  // Install dependencies if package.json exists
  const packageJson = join(workerDir, 'package.json');
  if (existsSync(packageJson)) {
    log.info('  Installing dependencies...');
    exec('npm install --silent', { cwd: workerDir, stdio: 'pipe' });
  }

  // Deploy
  exec('wrangler deploy', { cwd: workerDir, stdio: 'pipe' });
  log.success(`Deployed ${workerName}`);
}

async function deployAllWorkers() {
  log.step('Deploying Cloudflare Workers');

  for (const worker of CONFIG.workers) {
    await deployWorker(worker);
  }
}

// ============================================================
// Neon Setup
// ============================================================

function printNeonSetupInstructions() {
  log.step('Neon Postgres Setup');

  console.log(`
1. Go to https://console.neon.tech/signup
2. Create a new project named 'fusionops-main'
3. Copy the connection string
4. Add it to GitHub Secrets as NEON_DATABASE_URL

Or run the SQL below in your Neon SQL Editor:

-- Settings table (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites table (landing page configurations)
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deploy history table
CREATE TABLE IF NOT EXISTS deploy_history (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES sites(id),
  target TEXT NOT NULL,
  url TEXT,
  status TEXT DEFAULT 'pending',
  brand TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deploy_history_site_id ON deploy_history(site_id);
CREATE INDEX IF NOT EXISTS idx_deploy_history_created_at ON deploy_history(created_at DESC);
`);
}

// ============================================================
// GitHub Secrets Reference
// ============================================================

function printGitHubSecretsReference(accountId) {
  log.step('GitHub Secrets Setup');

  console.log(`
Add these secrets to your GitHub repository:

Repository: git@github.com:Morning-Uplift-Marketing-Co/FusionOps.git
Go to: Settings → Secrets and variables → Actions

──────────────────────────────────────────────────────────
Required Secrets:
──────────────────────────────────────────────────────────

CLOUDFLARE_ACCOUNT_ID    = ${accountId}
CLOUDFLARE_API_TOKEN      = (from Cloudflare dashboard)

NEON_DATABASE_URL         = (your Neon connection string)

──────────────────────────────────────────────────────────
Optional Secrets (for Vercel deployment):
──────────────────────────────────────────────────────────

VERCEL_TOKEN              = (from vercel.com/account/tokens)
VERCEL_ORG_ID             = (from .vercel/project.json)
VERCEL_PROJECT_ID         = (from .vercel/project.json)

──────────────────────────────────────────────────────────
Optional Secrets (for Netlify deployment):
──────────────────────────────────────────────────────────

NETLIFY_AUTH_TOKEN        = (from app.netlify.com/user/applications)
NETLIFY_SITE_ID           = (from Netlify site settings)
`);

  const secretsFile = join(rootDir, '.github-secrets-reference');
  writeFileSync(secretsFile, `# GitHub Secrets Reference
# Add these to: https://github.com/Morning-Uplift-Marketing-Co/FusionOps/settings/secrets/actions

# Required
CLOUDFLARE_ACCOUNT_ID=${accountId}
CLOUDFLARE_API_TOKEN=(your Cloudflare API Token)

# Required (add your Neon connection string)
NEON_DATABASE_URL=postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require

# Optional (Vercel)
# VERCEL_TOKEN=
# VERCEL_ORG_ID=
# VERCEL_PROJECT_ID=

# Optional (Netlify)
# NETLIFY_AUTH_TOKEN=
# NETLIFY_SITE_ID=
`);
  log.success('Saved reference to .github-secrets-reference');
}

// ============================================================
// Verification
// ============================================================

async function verifySetup(dbIds) {
  log.step('Verifying Setup');

  // List databases
  log.info('Checking D1 databases...');
  const databases = execJson('wrangler d1 list --json') || [];

  for (const [key, db] of Object.entries(dbIds)) {
    const found = databases.find(d => d.name === db.name || d.database_id === db.id);
    if (found) {
      log.success(`✓ ${db.name}`);
    } else {
      log.error(`✗ ${db.name} not found`);
    }
  }

  // Test queries
  log.info(`Testing ${dbIds.main.name}...`);
  exec(`wrangler d1 execute ${dbIds.main.name} --command="SELECT COUNT(*) as count FROM sites" --local=false`, { stdio: 'pipe', ignoreError: true });

  log.info(`Testing ${dbIds.pixel.name}...`);
  exec(`wrangler d1 execute ${dbIds.pixel.name} --command="SELECT COUNT(*) as count FROM pixel_events" --local=false`, { stdio: 'pipe', ignoreError: true });

  log.info(`Testing ${dbIds.callback.name}...`);
  exec(`wrangler d1 execute ${dbIds.callback.name} --command="SELECT COUNT(*) as count FROM accounts" --local=false`, { stdio: 'pipe', ignoreError: true });

  log.success('Verification complete!');
}

// ============================================================
// Summary
// ============================================================

function printSummary() {
  log.step('Setup Complete!');

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           FusionOps Infrastructure Ready! 🚀              ║
╚═══════════════════════════════════════════════════════════╝

Next steps:

1. Add GitHub Secrets (see .github-secrets-reference)
2. Push to GitHub: git push -u origin main
3. Configure Cloudflare Pages for web app
4. Set up custom domains

For detailed instructions, see INFRASTRUCTURE_SETUP.md
`);
}

// ============================================================
// Main Setup Flow
// ============================================================

async function fullSetup() {
  log.step('FusionOps Infrastructure Setup');

  // Guard: refuse to create new databases if production IDs already exist, unless --force
  const PRODUCTION_MAIN_ID = '4eaee76d-10fb-42a7-bb9d-50737c3da785';
  const currentToml = readFileSync(join(rootDir, 'apps/api-worker/wrangler.toml'), 'utf-8');
  if (currentToml.includes(PRODUCTION_MAIN_ID)) {
    log.warning('⚠️  wrangler.toml already has production IDs. Pass --force to overwrite.');
    if (!process.argv.includes('--force')) {
      log.warning('Aborting to protect production database bindings.');
      process.exit(1);
    }
    log.warning('--force passed — overwriting production IDs.');
  }

  const cfInfo = await preflightCheck();
  const accountId = cfInfo?.account ? Object.keys(cfInfo.account)[0] : getAccountId();

  const dbIds = await createAllD1Databases();

  await updateAllWranglerConfigs(dbIds, accountId);
  await runAllMigrations(dbIds);
  await deployAllWorkers();

  printNeonSetupInstructions();
  printGitHubSecretsReference(accountId);
  await verifySetup(dbIds);

  printSummary();
}

// ============================================================
// CLI Interface
// ============================================================

async function main() {
  const arg = process.argv[2];

  try {
    switch (arg) {
      case '--d1-only':
        await preflightCheck();
        await createAllD1Databases();
        break;

      case '--migrate-only':
        // Would need to load saved IDs
        log.error('Please run full setup first');
        break;

      case '--deploy-only':
        await deployAllWorkers();
        break;

      case '--verify-only':
        log.error('Please run full setup first');
        break;

      case '--help':
      case '-h':
        console.log(`
FusionOps Infrastructure Setup

Usage: node scripts/setup-infrastructure.js [OPTION]

Options:
  --d1-only        Create D1 databases only
  --migrate-only   Run migrations only
  --deploy-only    Deploy workers only
  --verify-only    Verify setup only
  --help, -h       Show this help message

Without options, runs full setup.
`);
        break;

      default:
        await fullSetup();
    }
  } catch (err) {
    log.error(err.message);
    process.exit(1);
  }
}

main();
