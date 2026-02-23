#!/usr/bin/env node
/**
 * ============================================================
 * FusionOps - Neon Database Migration Script
 * ============================================================
 * Sets up Neon Postgres database with required tables
 *
 * Usage:
 *   node scripts/migrate-neon.js "postgresql://user:pass@ep-xxx.aws.neon.tech/db"
 *   or set NEON_DATABASE_URL environment variable
 * ============================================================
 */

import { neon } from '@neondatabase/serverless';

// SQL Schema
const SCHEMA = `
-- ============================================================
-- FusionOps Neon Database Schema
-- ============================================================

-- Drop existing tables if needed (for clean install)
-- DROP TABLE IF EXISTS deploy_history CASCADE;
-- DROP TABLE IF EXISTS sites CASCADE;
-- DROP TABLE IF EXISTS settings CASCADE;

-- Settings table (key-value store for app configuration)
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
  site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
  target TEXT NOT NULL,
  url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  brand TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates table (landing page templates registry)
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  preview_url TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily spend table (Cost & ROI Tracking)
CREATE TABLE IF NOT EXISTS daily_spend (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  account_id TEXT NOT NULL,
  campaign_id TEXT,
  google_spend NUMERIC(10, 2) DEFAULT 0,
  vat NUMERIC(10, 2) DEFAULT 0,
  lendingcard_fee NUMERIC(10, 2) DEFAULT 0,
  true_cost NUMERIC(10, 2) DEFAULT 0,
  revenue NUMERIC(10, 2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  true_roi NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LendingCard transactions table
CREATE TABLE IF NOT EXISTS lendingcard_transactions (
  id TEXT PRIMARY KEY, -- Maps to LeadingCards API transaction uuid
  date TIMESTAMPTZ NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  deposit_fee NUMERIC(10, 2) DEFAULT 0,
  net_amount NUMERIC(10, 2) NOT NULL,
  card_id TEXT,
  card_last4 TEXT,
  merchant TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Accounting & Spend Dashboard V2 Schema
-- ============================================================

-- Opex (operating expenses)
CREATE TABLE IF NOT EXISTS opex (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,       -- proxy, anti_detect, tracking, hosting, domain, payment, other
    item_name TEXT NOT NULL,      -- NodeMaven, Multilogin, etc.
    monthly_cost NUMERIC(10, 2) DEFAULT 0,
    billing_cycle TEXT DEFAULT 'monthly',  -- monthly, annual, one_time
    start_date DATE,
    end_date DATE,
    is_active INTEGER DEFAULT 1,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly P&L snapshots
CREATE TABLE IF NOT EXISTS monthly_pnl (
    id SERIAL PRIMARY KEY,
    month TEXT NOT NULL,           -- '2026-02'
    gross_revenue NUMERIC(10, 2) DEFAULT 0,
    google_spend NUMERIC(10, 2) DEFAULT 0,
    vat_amount NUMERIC(10, 2) DEFAULT 0,
    lendingcard_fees NUMERIC(10, 2) DEFAULT 0,
    total_cost_of_revenue NUMERIC(10, 2) DEFAULT 0,
    gross_profit NUMERIC(10, 2) DEFAULT 0,
    total_opex NUMERIC(10, 2) DEFAULT 0,
    net_profit NUMERIC(10, 2) DEFAULT 0,
    net_margin NUMERIC(5, 2) DEFAULT 0,
    leads_submitted INTEGER DEFAULT 0,
    leads_sold INTEGER DEFAULT 0,
    leads_rejected INTEGER DEFAULT 0,
    active_accounts INTEGER DEFAULT 0,
    active_domains INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reconciliation records
CREATE TABLE IF NOT EXISTS reconcile_records (
    id SERIAL PRIMARY KEY,
    month TEXT NOT NULL,
    card_last4 TEXT NOT NULL,
    lc_date DATE,
    lc_description TEXT DEFAULT '',
    lc_amount NUMERIC(10, 2) DEFAULT 0,
    our_amount NUMERIC(10, 2) DEFAULT 0,
    diff NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending',  -- matched, diff, missing
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deploy_history_site_id ON deploy_history(site_id);
CREATE INDEX IF NOT EXISTS idx_deploy_history_created_at ON deploy_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deploy_history_status ON deploy_history(status);
CREATE INDEX IF NOT EXISTS idx_sites_created_at ON sites(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);

-- Insert default settings
INSERT INTO settings (key, value) VALUES
  ('app_version', '"2.1.0"'),
  ('default_loan_amount_min', '100'),
  ('default_loan_amount_max', '5000'),
  ('default_apr_min', '5.99'),
  ('default_apr_max', '35.99')
ON CONFLICT (key) DO NOTHING;
`;

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

// ============================================================
// Migration Functions
// ============================================================

async function runMigrations(connectionString) {
  log.step('Neon Database Migration');

  log.info('Connecting to Neon...');
  const sql = neon(connectionString);

  // Test connection
  try {
    const result = await sql`SELECT NOW() as now`;
    log.success(`Connected: ${result[0].now}`);
  } catch (err) {
    log.error(`Connection failed: ${err.message}`);
    throw err;
  }

  // Remove purely comment lines, then split by semicolon
  const cleanSchema = SCHEMA
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleanSchema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  log.info(`Executing ${statements.length} SQL statements...`);

  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    try {
      const snippet = statement.slice(0, 50).replace(/\n/g, ' ');
      log.info(`Executing: ${snippet}...`);
      await sql.unsafe(statement);
      successCount++;
    } catch (err) {
      // Ignore "already exists" errors
      if (err.message.includes('already exists')) {
        log.warning(`Table already exists (skipping)`);
        successCount++;
      } else {
        log.error(`Error: ${err.message}`);
        errorCount++;
      }
    }
  }

  if (errorCount === 0) {
    log.success(`All ${successCount} statements executed successfully`);
  } else {
    log.warning(`${successCount} succeeded, ${errorCount} failed`);
  }

  // Verify context
  const ctx = await sql`SELECT current_database(), current_user, current_schema()`;
  log.info(`Context: DB=${ctx[0].current_database}, User=${ctx[0].current_user}, Schema=${ctx[0].current_schema}`);

  // Verify tables
  log.info('Verifying tables...');
  const tables = await sql`
    SELECT table_name, table_schema
    FROM information_schema.tables
    WHERE table_name IN ('settings', 'sites', 'daily_spend', 'opex', 'monthly_pnl')
    OR table_schema = 'public'
    ORDER BY table_name
  `;

  log.success(`Found ${tables.length} tables:`);
  tables.forEach(t => console.log(`  ✓ ${t.table_schema}.${t.table_name}`));

  // Check indexes
  const indexes = await sql`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY indexname
  `;

  log.success('Created indexes:');
  indexes.forEach(i => console.log(`  ✓ ${i.indexname}`));

  // Show settings
  const settings = await sql`SELECT * FROM settings`;
  log.success('Default settings:');
  settings.forEach(s => console.log(`  ✓ ${s.key}: ${s.value}`));

  return { successCount, errorCount, tables: tables.length };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const connectionString = process.argv[2] || process.env.NEON_DATABASE_URL;

  if (!connectionString) {
    log.error('No connection string provided');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/migrate-neon.js "postgresql://user:pass@ep-xxx.aws.neon.tech/db"');
    console.log('');
    console.log('Or set NEON_DATABASE_URL environment variable');
    process.exit(1);
  }

  // Validate connection string format
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    log.error('Invalid connection string format');
    log.info('Expected format: postgresql://user:password@ep-xxx.aws.neon.tech/dbname?sslmode=require');
    process.exit(1);
  }

  try {
    const result = await runMigrations(connectionString);

    console.log('');
    log.step('Migration Complete!');
    console.log(`
Your Neon database is ready for FusionOps.

Connection string: ${connectionString.replace(/:[^:@]+@/, ':****@')}

Add this to GitHub Secrets as NEON_DATABASE_URL
`);
  } catch (err) {
    log.error(`Migration failed: ${err.message}`);
    process.exit(1);
  }
}

main();
