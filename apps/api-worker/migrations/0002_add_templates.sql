-- ============================================================
-- D1 Migration: 0002_add_templates.sql
-- LP Factory V2 — Custom Templates Storage
-- ============================================================

-- Templates: Custom template definitions
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  template_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  badge TEXT DEFAULT 'New',
  source_code TEXT DEFAULT '',
  files TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_templates_template_id ON templates(template_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at DESC);
