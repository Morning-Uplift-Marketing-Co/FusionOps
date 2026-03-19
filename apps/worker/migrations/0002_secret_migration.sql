-- ============================================================
-- D1 Migration: 0002_secret_migration.sql
-- Phase 2: Secret Handling and Idempotent Callbacks
-- ============================================================

-- Callback token migration fields
ALTER TABLE accounts ADD COLUMN callback_token_hash TEXT;
ALTER TABLE accounts ADD COLUMN callback_token_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE accounts ADD COLUMN callback_token_migrated_at TEXT;

-- Voluum credential migration fields (non-plaintext path)
ALTER TABLE accounts ADD COLUMN voluum_api_key_enc TEXT;
ALTER TABLE accounts ADD COLUMN voluum_api_key_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE accounts ADD COLUMN voluum_api_key_migrated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_accounts_callback_token_version
  ON accounts(callback_token_version);

