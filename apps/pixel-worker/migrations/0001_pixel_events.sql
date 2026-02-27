-- ============================================================
-- D1 Migration: pixel_events table
-- ============================================================
-- Stores all first-party pixel events from LP tracking.
-- Sent via navigator.sendBeacon() from tracking-pixel.js
-- to the pixel CF Worker at t.{domain}/e
-- ============================================================

CREATE TABLE IF NOT EXISTS pixel_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    session_id TEXT DEFAULT '',
    click_id TEXT DEFAULT '',
    gclid TEXT DEFAULT '',
    timestamp TEXT DEFAULT '',
    url TEXT DEFAULT '',
    referrer TEXT DEFAULT '',
    domain TEXT DEFAULT '',
    details TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pixel_domain_date ON pixel_events(domain, created_at);
CREATE INDEX IF NOT EXISTS idx_pixel_session ON pixel_events(session_id);
CREATE INDEX IF NOT EXISTS idx_pixel_event ON pixel_events(event);
CREATE INDEX IF NOT EXISTS idx_pixel_click_id ON pixel_events(click_id);
