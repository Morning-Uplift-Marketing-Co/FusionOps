-- ============================================================
-- D1 Migration: 0001_init.sql
-- LP Factory V2 — Core Schema
-- ============================================================

-- Sites: Landing page configurations
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  brand TEXT DEFAULT '',
  domain TEXT DEFAULT '',
  tagline TEXT DEFAULT '',
  email TEXT DEFAULT '',
  loan_type TEXT DEFAULT 'personal',
  amount_min INTEGER DEFAULT 100,
  amount_max INTEGER DEFAULT 5000,
  apr_min REAL DEFAULT 5.99,
  apr_max REAL DEFAULT 35.99,
  color_id TEXT DEFAULT 'ocean',
  font_id TEXT DEFAULT 'dm-sans',
  layout TEXT DEFAULT 'hero-left',
  radius TEXT DEFAULT 'rounded',
  h1 TEXT DEFAULT '',
  badge TEXT DEFAULT '',
  cta TEXT DEFAULT '',
  sub TEXT DEFAULT '',
  gtm_id TEXT DEFAULT '',
  network TEXT DEFAULT 'LeadsGate',
  redirect_url TEXT DEFAULT '',
  conversion_id TEXT DEFAULT '',
  conversion_label TEXT DEFAULT '',
  copy_id TEXT DEFAULT '',
  sections TEXT DEFAULT 'default',
  compliance TEXT DEFAULT 'standard',
  status TEXT DEFAULT 'completed',
  cost REAL DEFAULT 0,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Deploys: Deployment history
CREATE TABLE IF NOT EXISTS deploys (
  id TEXT PRIMARY KEY,
  site_id TEXT DEFAULT '',
  brand TEXT DEFAULT '',
  url TEXT DEFAULT '',
  type TEXT DEFAULT 'new',
  deployed_by TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Variants: A/B test variants
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  color_id TEXT DEFAULT 'ocean',
  font_id TEXT DEFAULT 'dm-sans',
  layout TEXT DEFAULT 'hero-left',
  radius TEXT DEFAULT 'rounded',
  copy_id TEXT DEFAULT 'smart',
  sections TEXT DEFAULT 'default',
  compliance TEXT DEFAULT 'standard',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- OPS: Domains
CREATE TABLE IF NOT EXISTS ops_domains (
  id TEXT PRIMARY KEY,
  domain TEXT DEFAULT '',
  registrar TEXT DEFAULT '',
  account_id TEXT DEFAULT '',
  profile_id TEXT DEFAULT '',
  cf_account_id TEXT DEFAULT '',
  zone_id TEXT DEFAULT '',
  nameservers TEXT DEFAULT '[]',
  cf_status TEXT DEFAULT '',
  registrar_account_id TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

-- OPS: Accounts
CREATE TABLE IF NOT EXISTS ops_accounts (
  id TEXT PRIMARY KEY,
  label TEXT DEFAULT '',
  email TEXT DEFAULT '',
  payment_id TEXT DEFAULT '',
  budget TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  card_uuid TEXT DEFAULT '',
  card_last4 TEXT DEFAULT '',
  card_status TEXT DEFAULT '',
  profile_id TEXT DEFAULT '',
  proxy_ip TEXT DEFAULT '',
  monthly_spend INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- OPS: Profiles
CREATE TABLE IF NOT EXISTS ops_profiles (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  proxy_ip TEXT DEFAULT '',
  browser_type TEXT DEFAULT '',
  os TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  ml_profile_id TEXT DEFAULT '',
  ml_folder_id TEXT DEFAULT '',
  proxy_host TEXT DEFAULT '',
  proxy_port TEXT DEFAULT '',
  proxy_user TEXT DEFAULT '',
  fingerprint_os TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- OPS: Payments
CREATE TABLE IF NOT EXISTS ops_payments (
  id TEXT PRIMARY KEY,
  label TEXT DEFAULT '',
  type TEXT DEFAULT '',
  last4 TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  lc_card_uuid TEXT DEFAULT '',
  lc_bin_uuid TEXT DEFAULT '',
  card_limit INTEGER DEFAULT 0,
  card_expiry TEXT DEFAULT '',
  total_spend INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- OPS: Logs
CREATE TABLE IF NOT EXISTS ops_logs (
  id TEXT PRIMARY KEY,
  msg TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Settings: Key-value store for configuration
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Cloudflare Accounts: Multi-account support
CREATE TABLE IF NOT EXISTS cf_accounts (
  id TEXT PRIMARY KEY,
  email TEXT DEFAULT '',
  api_key TEXT DEFAULT '',
  api_token TEXT DEFAULT '',
  account_id TEXT DEFAULT '',
  label TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Registrar Accounts: Domain registrar API credentials
CREATE TABLE IF NOT EXISTS registrar_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT DEFAULT 'internetbs',
  label TEXT DEFAULT '',
  api_key TEXT DEFAULT '',
  secret_key TEXT DEFAULT '',
  account_id TEXT DEFAULT '',
  api_token TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

-- VPS Deploys: Temporary storage for VPS deployments
CREATE TABLE IF NOT EXISTS vps_deploys (
  id TEXT PRIMARY KEY,
  html TEXT NOT NULL,
  host TEXT DEFAULT 'unknown',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sites_created_at ON sites(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deploys_site_id ON deploys(site_id);
CREATE INDEX IF NOT EXISTS idx_deploys_created_at ON deploys(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_domains_cf_account ON ops_domains(cf_account_id);
CREATE INDEX IF NOT EXISTS idx_ops_domains_registrar_account ON ops_domains(registrar_account_id);
CREATE INDEX IF NOT EXISTS idx_ops_logs_created_at ON ops_logs(created_at DESC);
