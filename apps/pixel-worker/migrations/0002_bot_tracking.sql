-- ============================================================
-- Bot Tracking Tables — Google Ads Bot / Search Bot Detection
-- ============================================================
-- Records every bot visit with 4 detection signals + composite score
-- Powers GUARDIAN Hermes agent + Bot Radar dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS bot_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Visit context
  visit_id TEXT,                     -- Optional FK to pixel_events.session_id
  timestamp INTEGER NOT NULL,        -- Unix epoch seconds
  campaign_id TEXT DEFAULT '',
  site_domain TEXT DEFAULT '',
  url TEXT DEFAULT '',
  path TEXT DEFAULT '',

  -- Identity
  ip TEXT NOT NULL,
  ip_version INTEGER DEFAULT 4,      -- 4 or 6
  user_agent TEXT DEFAULT '',
  asn INTEGER DEFAULT 0,
  org TEXT DEFAULT '',               -- e.g., "GOOGLE", "Cloudflare"
  country TEXT DEFAULT '',

  -- Reverse DNS
  ptr_record TEXT DEFAULT '',
  ptr_verified INTEGER DEFAULT 0,    -- 1 if forward-confirmed match

  -- Detection signals (0.0 - 1.0)
  sig_ip_match REAL DEFAULT 0,
  sig_ptr_match REAL DEFAULT 0,
  sig_ua_match REAL DEFAULT 0,
  sig_behavior REAL DEFAULT 0,       -- From CF bot management score
  composite_score REAL DEFAULT 0,    -- Weighted avg

  -- Classification
  bot_type TEXT DEFAULT 'unknown',   -- googlebot|adsbot|mediapartners|inspection|other
  confidence TEXT DEFAULT 'low',     -- high|medium|low

  -- Metadata
  cf_threat_score INTEGER DEFAULT 0,
  cf_bot_score INTEGER DEFAULT 100,  -- CF "verified bot" score 0-99 = bot
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bot_site_time ON bot_visits(site_domain, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bot_ip ON bot_visits(ip);
CREATE INDEX IF NOT EXISTS idx_bot_type_time ON bot_visits(bot_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bot_score ON bot_visits(composite_score) WHERE composite_score >= 0.7;


-- ============================================================
-- Google official IP ranges (synced daily by Hermes BOT_IP_SYNC)
-- ============================================================

CREATE TABLE IF NOT EXISTS bot_ip_ranges (
  cidr TEXT PRIMARY KEY,             -- "66.249.64.0/19" or "2001:4860::/32"
  ip_version INTEGER NOT NULL,       -- 4 or 6
  ip_start INTEGER,                  -- For IPv4: integer start of range
  ip_end INTEGER,                    -- For IPv4: integer end of range
  bot_type TEXT NOT NULL,            -- googlebot|adsbot|special-crawlers|user-triggered-fetchers
  source TEXT NOT NULL,              -- URL or label of source
  last_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_botrange_v4 ON bot_ip_ranges(ip_version, ip_start, ip_end);
CREATE INDEX IF NOT EXISTS idx_botrange_type ON bot_ip_ranges(bot_type);


-- ============================================================
-- Pre-ban correlation (computed every 30 min by GUARDIAN)
-- ============================================================

CREATE TABLE IF NOT EXISTS ban_correlation (
  site_domain TEXT PRIMARY KEY,
  recent_bot_visits_1h INTEGER DEFAULT 0,
  recent_bot_visits_24h INTEGER DEFAULT 0,
  recent_bot_visits_7d INTEGER DEFAULT 0,
  avg_baseline_per_hour REAL DEFAULT 0,
  anomaly_score REAL DEFAULT 0,      -- 0-1; >0.7 = critical
  status TEXT DEFAULT 'normal',      -- normal|elevated|critical
  last_googlebot_visit INTEGER DEFAULT 0,
  last_adsbot_visit INTEGER DEFAULT 0,
  last_computed INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bancorr_status ON ban_correlation(status, anomaly_score DESC);


-- ============================================================
-- Alert audit log (every Telegram alert sent)
-- ============================================================

CREATE TABLE IF NOT EXISTS bot_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  alert_type TEXT NOT NULL,          -- google_review|pre_ban_signal|anomaly
  site_domain TEXT,
  bot_type TEXT,
  composite_score REAL,
  message TEXT,
  telegram_sent INTEGER DEFAULT 0,
  details TEXT                       -- JSON
);

CREATE INDEX IF NOT EXISTS idx_alerts_time ON bot_alerts(timestamp DESC);
