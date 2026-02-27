CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  name TEXT,
  description TEXT,
  category TEXT,
  badge TEXT,
  source_code TEXT,
  files TEXT,
  created_at TEXT,
  is_deleted INTEGER DEFAULT 0
);
