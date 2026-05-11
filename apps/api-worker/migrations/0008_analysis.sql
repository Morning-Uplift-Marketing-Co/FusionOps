-- 0008_analysis.sql
-- FBIS Phase 1 — ban intelligence + risk scoring + agent KPIs
--
-- Apply:
--   cd apps/api-worker
--   wrangler d1 execute fusionops-main-new-v2 --file migrations/0008_analysis.sql --remote
--
-- Idempotent: DROP IF EXISTS on FBIS tables (no production data yet),
-- ALTER TABLE guards skipped via separate patch if columns already exist.

-- ── Lifecycle columns on ops_accounts ───────────────────────────────────────
-- SQLite ignores "duplicate column" only via IF NOT EXISTS workaround below.
-- We use INSERT-select trick: attempt each ALTER; D1 stops on first error
-- so we split into individual statements the user can re-run selectively.
ALTER TABLE ops_accounts ADD COLUMN lifecycle_stage TEXT DEFAULT 'active';
ALTER TABLE ops_accounts ADD COLUMN risk_score REAL DEFAULT 0.0;
ALTER TABLE ops_accounts ADD COLUMN ban_reason TEXT DEFAULT '';
ALTER TABLE ops_accounts ADD COLUMN banned_at TEXT DEFAULT '';

-- ── Drop & recreate FBIS tables (safe — no data exists yet) ─────────────────
DROP TABLE IF EXISTS ban_events;
DROP TABLE IF EXISTS account_risk_scores;
DROP TABLE IF EXISTS agent_kpis;
DROP TABLE IF EXISTS correlation_flags;
DROP TABLE IF EXISTS spend_rules;

-- Ban event log
CREATE TABLE ban_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  ban_type TEXT NOT NULL,
  platform TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  evidence TEXT DEFAULT '',
  occurred_at TEXT NOT NULL
);

CREATE INDEX idx_ban_events_account ON ban_events(account_id);
CREATE INDEX idx_ban_events_occurred ON ban_events(occurred_at);

-- Risk scores
CREATE TABLE account_risk_scores (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE,
  score REAL NOT NULL DEFAULT 0.0,
  flags TEXT DEFAULT '[]',
  computed_at TEXT NOT NULL
);

CREATE INDEX idx_risk_scores_score ON account_risk_scores(score);

-- Agent KPIs
CREATE TABLE agent_kpis (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE INDEX idx_agent_kpis_agent ON agent_kpis(agent_name, metric);
CREATE INDEX idx_agent_kpis_recorded ON agent_kpis(recorded_at);

-- Correlation flags
CREATE TABLE correlation_flags (
  id TEXT PRIMARY KEY,
  flag_type TEXT NOT NULL,
  account_ids TEXT NOT NULL,
  detail TEXT DEFAULT '',
  detected_at TEXT NOT NULL
);

CREATE INDEX idx_corr_flags_type ON correlation_flags(flag_type);

-- Spend rules
CREATE TABLE spend_rules (
  id TEXT PRIMARY KEY,
  lifecycle_stage TEXT NOT NULL UNIQUE,
  max_daily_spend REAL DEFAULT 0.0,
  max_monthly_spend REAL DEFAULT 0.0,
  alert_threshold REAL DEFAULT 0.8,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO spend_rules (id, lifecycle_stage, max_daily_spend, max_monthly_spend, alert_threshold, created_at, updated_at)
VALUES
  ('rule-active',    'active',    500.0,  10000.0, 0.8, datetime('now'), datetime('now')),
  ('rule-warming',   'warming',   100.0,  2000.0,  0.8, datetime('now'), datetime('now')),
  ('rule-flagged',   'flagged',   50.0,   500.0,   0.7, datetime('now'), datetime('now')),
  ('rule-suspended', 'suspended', 0.0,    0.0,     0.0, datetime('now'), datetime('now')),
  ('rule-banned',    'banned',    0.0,    0.0,     0.0, datetime('now'), datetime('now'));
