-- ============================================================
-- D1 Migration: 0003_idempotent_claims.sql
-- Phase 2: Atomic Idempotent Claiming
-- ============================================================

CREATE TABLE IF NOT EXISTS conversion_claims (
  dedup_key     TEXT NOT NULL,
  account_id    TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  last_error    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (dedup_key, account_id),
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE INDEX IF NOT EXISTS idx_conversion_claims_account_status
  ON conversion_claims(account_id, status, updated_at DESC);

