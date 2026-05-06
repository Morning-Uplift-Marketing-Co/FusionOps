// ============================================================
// Pixel events query handler for FusionOps API Worker
// ============================================================
// Routes (GET):
//   /api/pixel/events            Stored pixel events (operator UI feed)
//   /api/pixel/crawler-health    Google crawler UA hit summary
//
// Both endpoints query pixel_events with schema-tolerant column
// detection (legacy ts/timestamp/created_at, ua/data/details columns).
// They merge primary (PIXEL_DB) + fallback (DB) when both bindings
// are present, so events written before the dual-binding split are
// not lost.
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json } from '../lib/http.js';
import { canonicalPixelEvent } from './pixel-tracking.js';

async function handlePixelEvents({ env, url }) {
  try {
    const primaryDb = env.PIXEL_DB || env.DB;
    const domain = url.searchParams.get('domain') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const since = parseInt(url.searchParams.get('since') || '0', 10);

    // Query one DB binding and normalize schema differences. (param not named `db` —
    // avoids clashing with fetch-local `const db`.)
    async function queryFromDb(d1Conn) {
      const tableExists = await d1Conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pixel_events' LIMIT 1")
        .first();
      if (!tableExists) return [];

      const schema = await d1Conn.prepare('PRAGMA table_info(pixel_events)').all();
      const columns = new Set((schema?.results || []).map((c) => String(c.name || '')));

      const tsExpr = columns.has('ts')
        ? 'ts'
        : columns.has('timestamp')
          ? "CASE WHEN CAST(timestamp AS INTEGER) > 2000000000 THEN CAST(timestamp AS INTEGER) / 1000 ELSE CAST(timestamp AS INTEGER) END"
          : columns.has('created_at')
            ? 'unixepoch(created_at)'
            : '0';

      const dataExpr = columns.has('data')
        ? 'data'
        : columns.has('details')
          ? 'details'
          : "''";

      const domainExpr = columns.has('domain') ? 'domain' : "''";
      const gclidExpr = columns.has('gclid') ? 'gclid' : "''";
      const clickExpr = columns.has('click_id') ? 'click_id' : "''";

      let stmt;
      if (domain && columns.has('domain')) {
        stmt = d1Conn.prepare(
          `SELECT id, ${domainExpr} AS domain, event, ${gclidExpr} AS gclid, ${clickExpr} AS click_id, ${dataExpr} AS data, ${tsExpr} AS ts
           FROM pixel_events
           WHERE ${domainExpr} LIKE ? AND ${tsExpr} > ?
           ORDER BY ${tsExpr} DESC
           LIMIT ?`
        ).bind(`%${domain}%`, since, limit);
      } else {
        stmt = d1Conn.prepare(
          `SELECT id, ${domainExpr} AS domain, event, ${gclidExpr} AS gclid, ${clickExpr} AS click_id, ${dataExpr} AS data, ${tsExpr} AS ts
           FROM pixel_events
           WHERE ${tsExpr} > ?
           ORDER BY ${tsExpr} DESC
           LIMIT ?`
        ).bind(since, limit);
      }

      const { results } = await stmt.all();
      return (results || []).map((r) => {
        const event = canonicalPixelEvent(r.event);
        return {
          ...r,
          event,
          ts: Number(r.ts || 0),
          _key: `${r.domain || ''}|${event || ''}|${r.ts || 0}|${r.click_id || ''}|${r.gclid || ''}`,
        };
      });
    }

    const primaryRows = await queryFromDb(primaryDb);
    let merged = primaryRows;

    // Some t.{domain} routes may still hit api-worker (/e writes env.DB),
    // so merge events from DB as fallback to avoid missing rows in dashboard.
    if (env.PIXEL_DB && env.DB && env.PIXEL_DB !== env.DB) {
      const fallbackRows = await queryFromDb(env.DB);
      merged = [...primaryRows, ...fallbackRows];
    }

    const dedup = new Map();
    for (const row of merged) {
      if (!dedup.has(row._key)) dedup.set(row._key, row);
    }

    const events = Array.from(dedup.values())
      .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
      .slice(0, limit)
      .map(({ _key, ...rest }) => rest);

    return json({ success: true, events, count: events.length });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

async function handleCrawlerHealth({ env, url }) {
  try {
    const domain = String(url.searchParams.get('domain') || '').trim();
    const sinceParam = parseInt(url.searchParams.get('since') || '0', 10);
    const since = Number.isFinite(sinceParam) && sinceParam > 0 ? sinceParam : 0;

    async function aggregateCrawlerHits(d1Conn) {
      const tableExists = await d1Conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pixel_events' LIMIT 1")
        .first();
      if (!tableExists) return null;

      // Legacy pixel_worker schema omitted ua; add column so crawler stats and /e inserts can use it.
      try {
        await d1Conn.prepare('ALTER TABLE pixel_events ADD COLUMN ua TEXT').run();
      } catch (_e) { /* column already exists */ }

      const schema = await d1Conn.prepare('PRAGMA table_info(pixel_events)').all();
      const columns = new Set((schema?.results || []).map((c) => String(c.name || '')));
      if (!columns.has('ua')) {
        return { unsupported: true };
      }

      const tsExpr = columns.has('ts')
        ? 'ts'
        : columns.has('timestamp')
          ? "CASE WHEN CAST(timestamp AS INTEGER) > 2000000000 THEN CAST(timestamp AS INTEGER) / 1000 ELSE CAST(timestamp AS INTEGER) END"
          : columns.has('created_at')
            ? 'unixepoch(created_at)'
            : '0';

      const domainExpr = columns.has('domain') ? 'domain' : "''";
      const uaExpr = "LOWER(COALESCE(ua, ''))";

      let where = `${tsExpr} > ?`;
      const binds = [since];
      if (domain) {
        where += ` AND ${domainExpr} LIKE ?`;
        binds.push(`%${domain}%`);
      }

      const stmt = d1Conn.prepare(
        `SELECT
          COUNT(*) AS total_rows,
          SUM(CASE WHEN LENGTH(TRIM(COALESCE(ua, ''))) > 0 THEN 1 ELSE 0 END) AS rows_with_ua,
          SUM(CASE WHEN ${uaExpr} LIKE '%adsbot-google%' THEN 1 ELSE 0 END) AS adsbot_google,
          SUM(CASE WHEN ${uaExpr} LIKE '%mediapartners-google%' THEN 1 ELSE 0 END) AS mediapartners_google,
          SUM(CASE WHEN ${uaExpr} LIKE '%googlebot%' AND ${uaExpr} NOT LIKE '%adsbot-google%' THEN 1 ELSE 0 END) AS googlebot,
          SUM(CASE WHEN ${uaExpr} LIKE '%google-read-aloud%' THEN 1 ELSE 0 END) AS google_read_aloud
         FROM pixel_events
         WHERE ${where}`
      );
      const row = await stmt.bind(...binds).first();
      return { row, unsupported: false };
    }

    function mergeRows(a, b) {
      if (!a && !b) return null;
      if (!a) return b;
      if (!b) return a;
      return {
        total_rows: Number(a.total_rows || 0) + Number(b.total_rows || 0),
        rows_with_ua: Number(a.rows_with_ua || 0) + Number(b.rows_with_ua || 0),
        adsbot_google: Number(a.adsbot_google || 0) + Number(b.adsbot_google || 0),
        mediapartners_google: Number(a.mediapartners_google || 0) + Number(b.mediapartners_google || 0),
        googlebot: Number(a.googlebot || 0) + Number(b.googlebot || 0),
        google_read_aloud: Number(a.google_read_aloud || 0) + Number(b.google_read_aloud || 0),
      };
    }

    const dbList = [];
    if (env.PIXEL_DB) dbList.push(env.PIXEL_DB);
    if (env.DB && (!env.PIXEL_DB || env.DB !== env.PIXEL_DB)) dbList.push(env.DB);

    let merged = null;
    let sawTable = false;
    for (const d1Conn of dbList) {
      const result = await aggregateCrawlerHits(d1Conn);
      if (result === null) continue;
      sawTable = true;
      if (result.unsupported || !result.row) continue;
      merged = merged ? mergeRows(merged, result.row) : result.row;
    }

    if (!sawTable) {
      return json({
        success: true,
        domain: domain || null,
        since,
        buckets: null,
        disclaimer:
          'No pixel_events table yet. Events appear after traffic hits t.{domain}/e.',
      });
    }
    if (!merged) {
      return json({
        success: true,
        domain: domain || null,
        since,
        buckets: null,
        disclaimer:
          'pixel_events exists but User-Agent could not be aggregated (unexpected schema).',
      });
    }

    const r = merged || {};
    const adsbot = Number(r.adsbot_google || 0);
    const partners = Number(r.mediapartners_google || 0);
    const gbot = Number(r.googlebot || 0);
    const readAloud = Number(r.google_read_aloud || 0);
    const googleAdsRelated = adsbot + partners;

    return json({
      success: true,
      domain: domain || null,
      since,
      buckets: {
        total_pixel_events: Number(r.total_rows || 0),
        rows_with_user_agent: Number(r.rows_with_ua || 0),
        adsbot_google: adsbot,
        mediapartners_google: partners,
        google_ads_related_ua_hits: googleAdsRelated,
        googlebot: gbot,
        google_read_aloud: readAloud,
        google_crawler_ua_total: adsbot + partners + gbot + readAloud,
      },
      disclaimer:
        'Counts are requests to the first-party pixel (t.{domain}/e) whose User-Agent matches known Google crawlers (e.g. AdsBot-Google, Googlebot). Many policy checks fetch HTML without executing JS, so those visits may not hit the pixel — this is a lower bound, not full “Google Ads inspection” coverage.',
    });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

/**
 * Route entry. Returns Response if path matches; null otherwise.
 */
export async function handlePixelEventsRoute({ env, url, path, method }) {
  if (method !== 'GET') return null;
  if (path === '/api/pixel/events') return handlePixelEvents({ env, url });
  if (path === '/api/pixel/crawler-health') return handleCrawlerHealth({ env, url });
  return null;
}
