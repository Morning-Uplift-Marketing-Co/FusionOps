-- ============================================================
-- D1 Migration: 0002_deploy_history.sql
-- Deployment History Tracking
-- ============================================================

-- Deployment history with detailed tracking
CREATE TABLE IF NOT EXISTS ops_deployments (
  id TEXT PRIMARY KEY,
  domain_id TEXT DEFAULT '',
  domain TEXT DEFAULT '',
  target TEXT DEFAULT '',           -- cf-pages, netlify, vercel, etc.
  environment TEXT DEFAULT 'production', -- production, staging, dev
  url TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',    -- pending, success, failed, cancelled
  duration_ms INTEGER DEFAULT 0,
  error_message TEXT DEFAULT '',
  config TEXT DEFAULT '{}',         -- JSON config (branch, buildCommand, etc.)
  deployed_by TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for deployment queries
CREATE INDEX IF NOT EXISTS idx_ops_deployments_domain ON ops_deployments(domain_id);
CREATE INDEX IF NOT EXISTS idx_ops_deployments_status ON ops_deployments(status);
CREATE INDEX IF NOT EXISTS idx_ops_deployments_created_at ON ops_deployments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_deployments_target_env ON ops_deployments(target, environment);

-- Deploy configurations saved per domain+target combination
CREATE TABLE IF NOT EXISTS ops_deploy_configs (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  target_key TEXT NOT NULL,        -- e.g., "production-cf-pages"
  config TEXT NOT NULL,            -- JSON config
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(domain_id, target_key)
);

CREATE INDEX IF NOT EXISTS idx_ops_deploy_configs_domain ON ops_deploy_configs(domain_id);
