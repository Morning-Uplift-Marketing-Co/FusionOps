// ============================================================
// Bot Radar API — Google Ads/Search bot tracking endpoints
// ============================================================
// POST /api/bot-ip-sync         Sync Google IP ranges into D1 (Hermes)
// GET  /api/bot-radar/summary   Overall bot activity (24h/7d)
// GET  /api/bot-radar/heatmap   Time × site activity grid
// GET  /api/bot-radar/top-ips   Top bot IPs by frequency
// GET  /api/bot-radar/pre-ban   Sites with anomaly_score > 0.7
// GET  /api/bot-radar/timeline  Per-site Google review timeline
// GET  /api/bot-radar/signals   Detection signal breakdown
// ============================================================

import { json } from '../lib/http.js';

function pixelDb(env) {
  return env.PIXEL_DB || env.DB;
}

// ============================================================
// POST /api/bot-ip-sync
// ============================================================
// Body: { ranges: [{ cidr, ip_version, ip_start, ip_end, bot_type, source }] }
// Auth: X-Internal-Token header
async function handleBotIpSync({ request, env }) {
  const internalToken = env.INTERNAL_SYNC_TOKEN || env.API_SECRET;
  const provided = request.headers.get('X-Internal-Token') || '';

  if (internalToken && provided !== internalToken) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const body = await request.json();
    const ranges = Array.isArray(body?.ranges) ? body.ranges : [];

    if (!ranges.length) {
      return json({ success: false, error: 'No ranges provided' }, 400);
    }

    const db = pixelDb(env);

    // Ensure table exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS bot_ip_ranges (
        cidr TEXT PRIMARY KEY,
        ip_version INTEGER NOT NULL,
        ip_start INTEGER,
        ip_end INTEGER,
        bot_type TEXT NOT NULL,
        source TEXT NOT NULL,
        last_updated INTEGER NOT NULL
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_botrange_v4 ON bot_ip_ranges(ip_version, ip_start, ip_end)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_botrange_type ON bot_ip_ranges(bot_type)`).run();

    const now = Math.floor(Date.now() / 1000);

    // Use batch insert via prepared statement
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO bot_ip_ranges (cidr, ip_version, ip_start, ip_end, bot_type, source, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const batch = ranges.map(r =>
      stmt.bind(
        String(r.cidr || ''),
        Number(r.ip_version || 4),
        r.ip_start !== undefined ? Number(r.ip_start) : null,
        r.ip_end !== undefined ? Number(r.ip_end) : null,
        String(r.bot_type || 'unknown'),
        String(r.source || ''),
        now
      )
    );

    await db.batch(batch);

    return json({
      success: true,
      count: ranges.length,
      timestamp: now,
    });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

// ============================================================
// GET /api/bot-radar/summary
// ============================================================
async function handleSummary({ env, url }) {
  try {
    const db = pixelDb(env);
    const now = Math.floor(Date.now() / 1000);
    const oneHourAgo = now - 3600;
    const oneDayAgo = now - 86400;
    const sevenDaysAgo = now - 7 * 86400;

    const tableExists = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bot_visits' LIMIT 1")
      .first();

    if (!tableExists) {
      return json({
        success: true,
        empty: true,
        message: 'bot_visits table not yet created — waiting for first bot traffic',
      });
    }

    const total1h = await db.prepare(
      `SELECT COUNT(*) AS n FROM bot_visits WHERE timestamp >= ?`
    ).bind(oneHourAgo).first();

    const total24h = await db.prepare(
      `SELECT COUNT(*) AS n FROM bot_visits WHERE timestamp >= ?`
    ).bind(oneDayAgo).first();

    const total7d = await db.prepare(
      `SELECT COUNT(*) AS n FROM bot_visits WHERE timestamp >= ?`
    ).bind(sevenDaysAgo).first();

    const byType24h = await db.prepare(
      `SELECT bot_type, COUNT(*) AS n FROM bot_visits
       WHERE timestamp >= ? GROUP BY bot_type ORDER BY n DESC LIMIT 10`
    ).bind(oneDayAgo).all();

    const uniqueSites24h = await db.prepare(
      `SELECT COUNT(DISTINCT site_domain) AS n FROM bot_visits WHERE timestamp >= ?`
    ).bind(oneDayAgo).first();

    return json({
      success: true,
      totals: {
        last_1h: total1h?.n || 0,
        last_24h: total24h?.n || 0,
        last_7d: total7d?.n || 0,
        unique_sites_24h: uniqueSites24h?.n || 0,
      },
      by_type_24h: (byType24h?.results || []).map(r => ({
        bot_type: r.bot_type,
        count: r.n,
      })),
      timestamp: now,
    });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

// ============================================================
// GET /api/bot-radar/heatmap?hours=24
// ============================================================
async function handleHeatmap({ env, url }) {
  try {
    const db = pixelDb(env);
    const hours = Math.min(parseInt(url.searchParams.get('hours') || '24'), 168);
    const since = Math.floor(Date.now() / 1000) - hours * 3600;

    const tableExists = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bot_visits' LIMIT 1")
      .first();

    if (!tableExists) {
      return json({ success: true, empty: true, cells: [] });
    }

    // Group by (site_domain, hour_bucket)
    const rows = await db.prepare(`
      SELECT
        site_domain,
        (timestamp / 3600) * 3600 AS hour_bucket,
        COUNT(*) AS visits,
        SUM(CASE WHEN bot_type = 'googlebot' THEN 1 ELSE 0 END) AS googlebot,
        SUM(CASE WHEN bot_type = 'adsbot' THEN 1 ELSE 0 END) AS adsbot
      FROM bot_visits
      WHERE timestamp >= ?
      GROUP BY site_domain, hour_bucket
      ORDER BY hour_bucket DESC
    `).bind(since).all();

    return json({
      success: true,
      hours,
      cells: (rows?.results || []).map(r => ({
        site: r.site_domain,
        hour: r.hour_bucket,
        visits: r.visits,
        googlebot: r.googlebot,
        adsbot: r.adsbot,
      })),
    });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

// ============================================================
// GET /api/bot-radar/top-ips?limit=20
// ============================================================
async function handleTopIps({ env, url }) {
  try {
    const db = pixelDb(env);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const since = Math.floor(Date.now() / 1000) - 24 * 3600;

    const tableExists = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bot_visits' LIMIT 1")
      .first();

    if (!tableExists) {
      return json({ success: true, empty: true, ips: [] });
    }

    const rows = await db.prepare(`
      SELECT
        ip,
        asn,
        org,
        bot_type,
        country,
        COUNT(*) AS visits,
        MAX(timestamp) AS last_seen,
        AVG(composite_score) AS avg_score,
        GROUP_CONCAT(DISTINCT site_domain) AS sites_visited
      FROM bot_visits
      WHERE timestamp >= ?
      GROUP BY ip
      ORDER BY visits DESC
      LIMIT ?
    `).bind(since, limit).all();

    const ips = rows?.results || [];

    // Enrich with account info for sites visited
    let accountMap = {};
    if (ips.length > 0 && env.DB) {
      try {
        const allDomains = [...new Set(
          ips.flatMap(r => (r.sites_visited || '').split(',').filter(Boolean))
        )];
        if (allDomains.length > 0) {
          const placeholders = allDomains.map(() => '?').join(',');
          const accounts = await env.DB.prepare(
            `SELECT site_domain, id, label, email FROM ops_accounts WHERE site_domain IN (${placeholders}) AND site_domain != ''`
          ).bind(...allDomains).all();
          for (const a of accounts?.results || []) {
            accountMap[a.site_domain] = { id: a.id, label: a.label, email: a.email };
          }
        }
      } catch (_) { /* main DB may not have ops_accounts yet */ }
    }

    return json({
      success: true,
      ips: ips.map(r => {
        const domains = (r.sites_visited || '').split(',').filter(Boolean);
        return {
          ip: r.ip,
          asn: r.asn,
          org: r.org,
          bot_type: r.bot_type,
          country: r.country,
          visits: r.visits,
          last_seen: r.last_seen,
          avg_score: Number(Number(r.avg_score).toFixed(3)),
          sites: domains.map(d => ({ domain: d, account: accountMap[d] || null })),
        };
      }),
    });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

// ============================================================
// GET /api/bot-radar/pre-ban
// ============================================================
async function handlePreBan({ env }) {
  try {
    const db = pixelDb(env);

    const tableExists = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ban_correlation' LIMIT 1")
      .first();

    if (!tableExists) {
      return json({ success: true, empty: true, sites: [] });
    }

    const rows = await db.prepare(`
      SELECT site_domain, recent_bot_visits_1h, recent_bot_visits_24h,
             avg_baseline_per_hour, anomaly_score, status,
             last_googlebot_visit, last_adsbot_visit, last_computed
      FROM ban_correlation
      ORDER BY anomaly_score DESC
      LIMIT 50
    `).all();

    const sites = rows?.results || [];

    // Enrich with Google Ads account info from main DB
    let accountMap = {};
    if (sites.length > 0 && env.DB) {
      try {
        const domains = sites.map(s => s.site_domain).filter(Boolean);
        const placeholders = domains.map(() => '?').join(',');
        const accounts = await env.DB.prepare(
          `SELECT site_domain, id, label, email FROM ops_accounts WHERE site_domain IN (${placeholders}) AND site_domain != ''`
        ).bind(...domains).all();
        for (const a of accounts?.results || []) {
          if (!accountMap[a.site_domain]) accountMap[a.site_domain] = [];
          accountMap[a.site_domain].push({ id: a.id, label: a.label, email: a.email });
        }
      } catch (_) { /* main DB may not have ops_accounts yet */ }
    }

    return json({
      success: true,
      sites: sites.map(s => ({
        ...s,
        accounts: accountMap[s.site_domain] || [],
      })),
    });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

// ============================================================
// GET /api/bot-radar/timeline?site=example.com
// ============================================================
async function handleTimeline({ env, url }) {
  try {
    const db = pixelDb(env);
    const site = url.searchParams.get('site') || '';

    if (!site) return json({ success: false, error: 'site param required' }, 400);

    const since = Math.floor(Date.now() / 1000) - 30 * 86400;

    const tableExists = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bot_visits' LIMIT 1")
      .first();

    if (!tableExists) {
      return json({ success: true, empty: true, events: [] });
    }

    const rows = await db.prepare(`
      SELECT timestamp, ip, user_agent, bot_type, composite_score,
             ptr_record, ptr_verified
      FROM bot_visits
      WHERE site_domain = ? AND timestamp >= ?
      ORDER BY timestamp DESC
      LIMIT 200
    `).bind(site, since).all();

    return json({
      success: true,
      site,
      events: (rows?.results || []),
    });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

// ============================================================
// GET /api/bot-radar/signals
// ============================================================
async function handleSignals({ env }) {
  try {
    const db = pixelDb(env);
    const since = Math.floor(Date.now() / 1000) - 24 * 3600;

    const tableExists = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bot_visits' LIMIT 1")
      .first();

    if (!tableExists) {
      return json({ success: true, empty: true });
    }

    const row = await db.prepare(`
      SELECT
        AVG(sig_ip_match) AS avg_ip,
        AVG(sig_ptr_match) AS avg_ptr,
        AVG(sig_ua_match) AS avg_ua,
        AVG(sig_behavior) AS avg_behavior,
        SUM(CASE WHEN sig_ip_match >= 0.5 THEN 1 ELSE 0 END) AS hits_ip,
        SUM(CASE WHEN sig_ptr_match >= 0.5 THEN 1 ELSE 0 END) AS hits_ptr,
        SUM(CASE WHEN sig_ua_match >= 0.5 THEN 1 ELSE 0 END) AS hits_ua,
        SUM(CASE WHEN sig_behavior >= 0.5 THEN 1 ELSE 0 END) AS hits_behavior,
        COUNT(*) AS total
      FROM bot_visits
      WHERE timestamp >= ?
    `).bind(since).first();

    return json({
      success: true,
      hours: 24,
      averages: {
        ip_match: Number(Number(row?.avg_ip || 0).toFixed(3)),
        ptr_match: Number(Number(row?.avg_ptr || 0).toFixed(3)),
        ua_match: Number(Number(row?.avg_ua || 0).toFixed(3)),
        behavior: Number(Number(row?.avg_behavior || 0).toFixed(3)),
      },
      hits: {
        ip_match: row?.hits_ip || 0,
        ptr_match: row?.hits_ptr || 0,
        ua_match: row?.hits_ua || 0,
        behavior: row?.hits_behavior || 0,
      },
      total_visits: row?.total || 0,
    });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

// ============================================================
// Route dispatcher
// ============================================================
export async function handleBotRadarRoute({ request, env, url, path, method }) {
  // POST /api/bot-ip-sync (auth required)
  if (path === '/api/bot-ip-sync' && method === 'POST') {
    return handleBotIpSync({ request, env });
  }

  // GET endpoints
  if (method !== 'GET') return null;

  if (path === '/api/bot-radar/summary') return handleSummary({ env, url });
  if (path === '/api/bot-radar/heatmap') return handleHeatmap({ env, url });
  if (path === '/api/bot-radar/top-ips') return handleTopIps({ env, url });
  if (path === '/api/bot-radar/pre-ban') return handlePreBan({ env });
  if (path === '/api/bot-radar/timeline') return handleTimeline({ env, url });
  if (path === '/api/bot-radar/signals') return handleSignals({ env });

  return null;
}
