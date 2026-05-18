-- 0011_agent_state.sql — Hermes agent persistent state
-- Source of truth for AEGIS/SCOUT/HERALD/ORACLE state across cron runs.
-- Replaces legacy local JSONL files under ~/.hermes/{aegis,scout,herald,oracle}-state/.
-- Decision context: .agents/debates/hermes-state-20260518-231225/SYNTHESIS-R2.md (4-0 Pure D1).

-- ─── Fingerprints (dedup + change detection) ─────────────────────────────────
-- AEGIS  : brand-jack candidate URLs already seen (24h dedup window).
-- SCOUT  : competitor ad-copy hashes per domain (flag NEW creatives).
-- scope  : free-form bucket (e.g. domain, brand_term) so one agent can
--          partition by multiple dimensions without separate tables.
CREATE TABLE IF NOT EXISTS agent_fingerprints (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  agent           TEXT NOT NULL
    CHECK (agent IN ('AEGIS','SCOUT','HERALD','ORACLE')),
  scope           TEXT NOT NULL,
  fingerprint_key TEXT NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  payload         TEXT,
  first_seen_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_fp_key
  ON agent_fingerprints(agent, scope, fingerprint_key);
CREATE INDEX IF NOT EXISTS idx_agent_fp_recent
  ON agent_fingerprints(agent, last_seen_at DESC);

-- ─── Rolling Baselines (anomaly detection) ───────────────────────────────────
-- HERALD : per-metric rolling baselines (rating, trend volume, mention count).
-- window : '24h' | '7d' | '30d' (validated at app layer, free TEXT here).
CREATE TABLE IF NOT EXISTS agent_baselines (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent        TEXT NOT NULL
    CHECK (agent IN ('AEGIS','SCOUT','HERALD','ORACLE')),
  metric       TEXT NOT NULL,
  scope        TEXT NOT NULL DEFAULT '_global',
  window       TEXT NOT NULL,
  value        REAL NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 1,
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_baseline_key
  ON agent_baselines(agent, metric, scope, window);

-- ─── Alerts (pending human ack) ──────────────────────────────────────────────
-- Any agent can emit alerts. ack_status drives the Observability UI inbox.
-- payload = JSON blob describing the finding (URL, evidence, screenshots, etc.)
CREATE TABLE IF NOT EXISTS agent_alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent       TEXT NOT NULL
    CHECK (agent IN ('AEGIS','SCOUT','HERALD','ORACLE')),
  severity    TEXT NOT NULL
    CHECK (severity IN ('info','warn','high','critical')),
  title       TEXT NOT NULL,
  payload     TEXT NOT NULL,
  ack_status  TEXT NOT NULL DEFAULT 'pending'
    CHECK (ack_status IN ('pending','acked','dismissed','resolved')),
  acked_by    TEXT,
  acked_at    INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_pending
  ON agent_alerts(ack_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_agent
  ON agent_alerts(agent, created_at DESC);

-- ─── ORACLE keyword corpus ───────────────────────────────────────────────────
-- Weekly keyword discovery accumulates over time. weekly_baseline_volume holds
-- last week's volume so ORACLE can flag week-over-week movers.
CREATE TABLE IF NOT EXISTS oracle_keywords (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword                 TEXT NOT NULL,
  source                  TEXT NOT NULL,
  volume                  INTEGER NOT NULL DEFAULT 0,
  weekly_baseline_volume  INTEGER NOT NULL DEFAULT 0,
  first_seen_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at            INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oracle_keyword
  ON oracle_keywords(keyword, source);
CREATE INDEX IF NOT EXISTS idx_oracle_recent
  ON oracle_keywords(last_seen_at DESC);
