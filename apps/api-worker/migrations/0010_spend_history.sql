-- 0010_spend_history.sql
-- Historical spend tracking per account per day
-- Enables anomaly detection (sudden spend spikes) in VERDICT

CREATE TABLE IF NOT EXISTS spend_history (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (date('now')),
  spend_24h   REAL NOT NULL DEFAULT 0,
  spend_30d   REAL NOT NULL DEFAULT 0,
  daily_budget REAL NOT NULL DEFAULT 0,
  campaign_count    INTEGER NOT NULL DEFAULT 0,
  active_campaigns  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(account_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_spend_history_account
  ON spend_history(account_id, recorded_at DESC);
