-- Template Manager schema extensions
-- NOTE:
-- - Existing environments may already have template columns added by runtime
--   schema guards in worker.js. To keep this migration idempotent in D1,
--   we only create new tables/indexes here.

CREATE TABLE IF NOT EXISTS template_versions (
  id TEXT PRIMARY KEY,
  template_db_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  name TEXT DEFAULT '',
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  badge TEXT DEFAULT 'New',
  source_code TEXT DEFAULT '',
  files TEXT DEFAULT '{}',
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_template_versions
ON template_versions(template_db_id, version_number);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id
ON template_versions(template_id);
