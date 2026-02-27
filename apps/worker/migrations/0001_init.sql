-- ============================================================
-- D1 Migration: 0001_init.sql
-- Landing Page Factory — Callback & Conversion Infrastructure
-- ============================================================

-- Account registry: maps account_id to callback token and Voluum config
CREATE TABLE IF NOT EXISTS accounts (
  account_id    TEXT PRIMARY KEY,
  callback_token TEXT NOT NULL,
  voluum_api_key TEXT NOT NULL,
  domains        TEXT NOT NULL DEFAULT '[]',  -- JSON array of bound domains
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Raw callback log: every inbound LeadsGate callback is stored here
CREATE TABLE IF NOT EXISTS lead_callbacks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    TEXT NOT NULL,
  type          TEXT NOT NULL,
  lead_id       TEXT,
  click_id      TEXT,
  price         REAL,
  created       TEXT,
  raw_payload   TEXT NOT NULL,
  received_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- Dedup keys: prevents double-posting conversions to Voluum
CREATE TABLE IF NOT EXISTS dedup_keys (
  dedup_key     TEXT NOT NULL,
  account_id    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (dedup_key, account_id),
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- Conversion upload audit trail
CREATE TABLE IF NOT EXISTS conversion_uploads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    TEXT NOT NULL,
  click_id      TEXT NOT NULL,
  lead_id       TEXT NOT NULL,
  payout        REAL NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_lead_callbacks_account
  ON lead_callbacks(account_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_callbacks_click
  ON lead_callbacks(click_id);

CREATE INDEX IF NOT EXISTS idx_lead_callbacks_type
  ON lead_callbacks(account_id, type);

CREATE INDEX IF NOT EXISTS idx_conversion_uploads_account
  ON conversion_uploads(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversion_uploads_status
  ON conversion_uploads(account_id, status);

CREATE INDEX IF NOT EXISTS idx_dedup_keys_account
  ON dedup_keys(account_id);
