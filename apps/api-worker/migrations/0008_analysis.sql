-- apps/api-worker/migrations/0008_analysis.sql
-- ============================================================
-- FBIS: Ban Intelligence System — Analysis Database Schema
-- ============================================================

-- Ban events (backfill from Alpha Test + future live bans)
CREATE TABLE IF NOT EXISTS ban_events (
  id TEXT PRIMARY KEY,
  account_id TEXT DEFAULT '',
  domain TEXT DEFAULT '',
  ban_reason TEXT DEFAULT '',
  ban_date TEXT DEFAULT '',
  days_active INTEGER DEFAULT 0,
  risk_score_at_ban INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Daily risk scores per account
CREATE TABLE IF NOT EXISTS account_risk_scores (
  id TEXT PRIMARY KEY,
  account_id TEXT DEFAULT '',
  proxy_risk INTEGER DEFAULT 0,
  isolation_score INTEGER DEFAULT 0,
  traffic_quality INTEGER DEFAULT 0,
  timeline_risk INTEGER DEFAULT 0,
  verdict_score INTEGER DEFAULT 0,
  verdict_status TEXT DEFAULT 'healthy',
  scored_at TEXT DEFAULT (datetime('now'))
);

-- Agent KPI log (one row per agent per day)
CREATE TABLE IF NOT EXISTS agent_kpis (
  id TEXT PRIMARY KEY,
  agent_name TEXT DEFAULT '',
  kpi_name TEXT DEFAULT '',
  kpi_value REAL DEFAULT 0,
  kpi_target REAL DEFAULT 0,
  kpi_unit TEXT DEFAULT '',
  recorded_at TEXT DEFAULT (datetime('now'))
);

-- Cross-account correlation flags
CREATE TABLE IF NOT EXISTS correlation_flags (
  id TEXT PRIMARY KEY,
  account_id_a TEXT DEFAULT '',
  account_id_b TEXT DEFAULT '',
  correlation_type TEXT DEFAULT '',
  strength REAL DEFAULT 0,
  detected_at TEXT DEFAULT (datetime('now'))
);

-- Phase 2: spend rules
CREATE TABLE IF NOT EXISTS spend_rules (
  account_id TEXT PRIMARY KEY,
  current_cap INTEGER DEFAULT 20,
  last_scale_date TEXT DEFAULT '',
  scale_reason TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ban_events_account ON ban_events(account_id);
CREATE INDEX IF NOT EXISTS idx_ban_events_date ON ban_events(ban_date DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scores_account ON account_risk_scores(account_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_date ON account_risk_scores(scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_kpis_agent ON agent_kpis(agent_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_correlation_a ON correlation_flags(account_id_a);
CREATE INDEX IF NOT EXISTS idx_correlation_b ON correlation_flags(account_id_b);
