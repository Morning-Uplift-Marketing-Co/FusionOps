-- 0009_lifecycle.sql — Phase 2: Lifecycle Engine
-- Account state machine, creative fatigue, spend intelligence
-- Note: ops_accounts lifecycle columns were added in a prior migration

-- ─── State Transition Log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lifecycle_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'system',
  risk_score INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_account ON lifecycle_transitions(account_id, created_at DESC);

-- ─── Creative Fatigue ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creative_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  headline TEXT,
  impressions_7d INTEGER NOT NULL DEFAULT 0,
  clicks_7d INTEGER NOT NULL DEFAULT 0,
  conversions_7d REAL NOT NULL DEFAULT 0,
  ctr_7d REAL NOT NULL DEFAULT 0,
  cpa_7d REAL NOT NULL DEFAULT 0,
  ctr_delta REAL NOT NULL DEFAULT 0,
  conv_delta REAL NOT NULL DEFAULT 0,
  fatigue_score INTEGER NOT NULL DEFAULT 0,
  fatigue_status TEXT NOT NULL DEFAULT 'healthy'
    CHECK (fatigue_status IN ('healthy','watch','fatigued','retired')),
  first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_creative_account ON creative_performance(account_id, fatigue_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creative_ad ON creative_performance(account_id, ad_id);

CREATE TABLE IF NOT EXISTS fatigue_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  fatigue_score INTEGER NOT NULL,
  alerted_at INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at INTEGER
);

-- ─── Spend Intelligence ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spend_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  actual_spend REAL NOT NULL DEFAULT 0,
  budget_cap REAL NOT NULL DEFAULT 0,
  utilization_pct REAL NOT NULL DEFAULT 0,
  conversions REAL NOT NULL DEFAULT 0,
  cpa REAL,
  roas REAL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_spend_date ON spend_snapshots(account_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_spend_account ON spend_snapshots(account_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS budget_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  recommended_cap REAL NOT NULL,
  current_cap REAL NOT NULL,
  delta_pct REAL NOT NULL,
  reason TEXT NOT NULL,
  signal TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0,
  applied_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ─── Auto-Pause Rules ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pause_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL UNIQUE,
  condition_field TEXT NOT NULL,
  condition_op TEXT NOT NULL,
  condition_value REAL NOT NULL,
  action TEXT NOT NULL,
  action_value REAL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO pause_rules (rule_name, condition_field, condition_op, condition_value, action, action_value) VALUES
  ('critical_risk_pause',  'risk_score',    'gte', 80,  'pause',         null),
  ('high_risk_reduce',     'risk_score',    'gte', 60,  'reduce_budget', 50),
  ('overspend_alert',      'spend_pct',     'gte', 110, 'alert',         null),
  ('conv_drop_alert',      'conv_drop_pct', 'gte', 30,  'alert',         null),
  ('creative_fatigue_warn','fatigue_score', 'gte', 70,  'alert',         null);

CREATE TABLE IF NOT EXISTS pause_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  trigger_value REAL NOT NULL,
  notes TEXT,
  reversed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pause_account ON pause_events(account_id, created_at DESC);
