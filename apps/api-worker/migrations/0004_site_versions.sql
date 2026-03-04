CREATE TABLE IF NOT EXISTS site_versions (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_site_version
ON site_versions(site_id, version_number);

CREATE INDEX IF NOT EXISTS idx_site_versions_site_id
ON site_versions(site_id);
