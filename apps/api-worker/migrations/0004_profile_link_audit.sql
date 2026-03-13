-- ============================================================
-- D1 Migration: 0004_profile_link_audit.sql
-- Profile Link + Proxy Pool + Audit Log
-- ============================================================

-- Geo lock + session persistence + provider tracking on profiles
ALTER TABLE ops_profiles ADD COLUMN proxy_provider TEXT DEFAULT '';
ALTER TABLE ops_profiles ADD COLUMN proxy_geo_country TEXT DEFAULT '';
ALTER TABLE ops_profiles ADD COLUMN proxy_geo_state TEXT DEFAULT '';
ALTER TABLE ops_profiles ADD COLUMN proxy_geo_city TEXT DEFAULT '';
ALTER TABLE ops_profiles ADD COLUMN proxy_session_id TEXT DEFAULT '';
ALTER TABLE ops_profiles ADD COLUMN last_ip TEXT DEFAULT '';
ALTER TABLE ops_profiles ADD COLUMN last_ip_at TEXT DEFAULT '';
ALTER TABLE ops_profiles ADD COLUMN last_trust_score INTEGER DEFAULT 0;

-- Proxy Pool: scanned + validated proxy inventory
CREATE TABLE IF NOT EXISTS ops_proxy_pool (
  id TEXT PRIMARY KEY,
  host TEXT DEFAULT '',
  port TEXT DEFAULT '',
  username TEXT DEFAULT '',
  password TEXT DEFAULT '',
  provider TEXT DEFAULT '',
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  asn TEXT DEFAULT '',
  isp TEXT DEFAULT '',
  fraud_score INTEGER DEFAULT -1,
  trust_score INTEGER DEFAULT -1,
  latency_ms INTEGER DEFAULT -1,
  timezone TEXT DEFAULT '',
  is_proxy INTEGER DEFAULT -1,
  status TEXT DEFAULT 'pending',
  assigned_to TEXT DEFAULT '',
  scan_details TEXT DEFAULT '',
  last_scan_at TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_proxy_pool_status ON ops_proxy_pool(status);
CREATE INDEX IF NOT EXISTS idx_proxy_pool_country ON ops_proxy_pool(country);
CREATE INDEX IF NOT EXISTS idx_proxy_pool_provider ON ops_proxy_pool(provider);

-- Link Audit Log: track every link/unlink/rotate/prelaunch action
CREATE TABLE IF NOT EXISTS ops_link_audit (
  id TEXT PRIMARY KEY,
  account_id TEXT DEFAULT '',
  profile_id TEXT DEFAULT '',
  card_uuid TEXT DEFAULT '',
  proxy_ip TEXT DEFAULT '',
  proxy_provider TEXT DEFAULT '',
  proxy_geo TEXT DEFAULT '',
  trust_score INTEGER DEFAULT 0,
  action TEXT DEFAULT '',
  details TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_link_audit_account ON ops_link_audit(account_id);
CREATE INDEX IF NOT EXISTS idx_link_audit_profile ON ops_link_audit(profile_id);
CREATE INDEX IF NOT EXISTS idx_link_audit_action ON ops_link_audit(action);
CREATE INDEX IF NOT EXISTS idx_link_audit_created ON ops_link_audit(created_at DESC);
