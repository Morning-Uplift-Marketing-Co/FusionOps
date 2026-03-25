-- 0007_voluum_postback_forward.sql
-- Full voluum_postbacks definition including Voluum relay / cross-validation columns.
--
-- Apply: npx wrangler d1 migrations apply fusionops-main-new-v2 --remote
-- (match database_name in apps/api-worker/wrangler.toml)
--
-- If this table already exists WITHOUT voluum_domain / forward_* (created by an older Worker),
-- do not rely on this migration alone — run apps/api-worker/schema/voluum_postbacks_upgrade.sql once in the D1 SQL editor,
-- or hit /v once so the Worker runs idempotent ALTERs.

CREATE TABLE IF NOT EXISTS voluum_postbacks (
  id TEXT PRIMARY KEY,
  domain TEXT,
  click_id TEXT,
  lead_id TEXT,
  payout REAL,
  type TEXT,
  ip TEXT,
  ua TEXT,
  raw TEXT,
  ts INTEGER DEFAULT (unixepoch()),
  voluum_domain TEXT,
  forward_status TEXT,
  forward_http_status INTEGER,
  forward_error TEXT
);
