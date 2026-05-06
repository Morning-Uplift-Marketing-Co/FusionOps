// ============================================================
// Pixel + Voluum postback handler for FusionOps API Worker
// ============================================================
// Routes:
//   POST/GET /e            First-party tracking pixel (writes pixel_events)
//   GET/POST/OPTIONS /v    Voluum/LeadsGate postback ingestion + relay
//   GET /api/postbacks     Query voluum_postbacks table (operator UI)
//
// Both /e and /v use t.{domain}/* via Workers Routes.
// /v writes voluum_postbacks then forwards to upstream tracker
// (vd= param or env.DEFAULT_VOLUUM_POSTBACK_DOMAIN) with SSRF guard.
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { corsHeaders, json, uid } from '../lib/http.js';
import {
  parseVoluumPostbackMergedParams,
  normalizeVoluumDomainParam,
  isSafeVoluumForwardHost,
  voluumForwardSearchParams,
} from '../lib/voluum-guard.js';

// ═══ Pixel event canonicalization ═══

const PIXEL_EVENT_ALIASES = {
  pv: 'pv',
  page_view: 'pv',
  pageview: 'pv',
  fl: 'form_start',
  form_load: 'form_start',
  leadsgate_form_start: 'form_start',
  /** LeadsGate hooks in goldrush / inject-tracking apply.astro */
  lg_form_load: 'form_start',
  lg_form_ready: 'form_start',
  form_start: 'form_start',
  fs: 'form_submit',
  leadsgate_form_submit: 'form_submit',
  lg_submit: 'form_submit',
  form_submit: 'form_submit',
  step: 'step_change',
  leadsgate_form_progress: 'step_change',
  lg_step: 'step_change',
  step_change: 'step_change',
  success: 'success',
  lg_success_all: 'success',
  lg_success: 'sold_lead',
  soldlead: 'sold_lead',
  sold_lead: 'sold_lead',
  lead_conversion_approved: 'sold_lead',
  amt: 'amount_selected',
  amount_selected: 'amount_selected',
  ze: 'zip_entered',
  zip_entered: 'zip_entered',
  t30: 'time_on_page_30s',
  t60: 'time_on_page_60s',
  top_30s: 'time_on_page_30s',
  top_60s: 'time_on_page_60s',
  n1: 'pv',
  n2: 'form_start',
  n3: 'form_submit',
  n4: 'sold_lead',
  n5: 'step_change',
  n6: 'success',
  n7: 'amount_selected',
  n8: 'zip_entered',
  n9: 'time_on_page_30s',
  n10: 'time_on_page_60s',
  n11: 'scroll_25',
  n12: 'scroll_50',
  n13: 'scroll_75',
  n14: 'scroll_100',
};

export function canonicalPixelEvent(rawEvent) {
  const value = String(rawEvent || '').trim().toLowerCase();
  if (!value) return 'unknown';
  if (PIXEL_EVENT_ALIASES[value]) return PIXEL_EVENT_ALIASES[value];
  const shortScrollMatch = value.match(/^s(25|50|75|100)$/);
  if (shortScrollMatch) return `scroll_${shortScrollMatch[1]}`;
  const longScrollMatch = value.match(/^scroll_(25|50|75|100)$/);
  if (longScrollMatch) return `scroll_${longScrollMatch[1]}`;
  const scrollPctMatch = value.match(/^scroll_(25|50|75|100)%$/);
  if (scrollPctMatch) return `scroll_${scrollPctMatch[1]}`;
  if (value === 'time_on_page_30s') return 'time_on_page_30s';
  if (value === 'time_on_page_60s') return 'time_on_page_60s';
  return value;
}

async function parsePixelPayloadFromRequest(request, url, method) {
  if (method === 'GET') {
    const payload = {};
    for (const [k, v] of url.searchParams) payload[k] = v;
    return payload;
  }

  let bodyText = '';
  try {
    bodyText = await request.text();
  } catch {
    bodyText = '';
  }

  if (!bodyText) return {};

  try {
    const parsed = JSON.parse(bodyText);
    if (parsed && typeof parsed === 'object') {
      return Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k, v == null ? '' : String(v)])
      );
    }
  } catch {
    // Fall through to form decoding
  }

  const params = new URLSearchParams(bodyText);
  const payload = {};
  for (const [k, v] of params.entries()) payload[k] = v;
  return payload;
}

/**
 * GET /api/postbacks — module scope only; never uses fetch-local `db`
 * (avoids TDZ / name-collision with nested `queryFromDb(db)`).
 */
export async function handleVoluumPostbacksApiGet(env, url) {
  try {
    const binding = env?.DB;
    if (!binding) {
      return json({ success: true, postbacks: [], count: 0 });
    }
    const domain = url.searchParams.get('domain') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 1000);
    const since = parseInt(url.searchParams.get('since') || '0', 10);

    const tableExists = await binding
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='voluum_postbacks' LIMIT 1")
      .first();
    if (!tableExists) return json({ success: true, postbacks: [], count: 0 });

    const schema = await binding.prepare('PRAGMA table_info(voluum_postbacks)').all();
    const colSet = new Set((schema?.results || []).map((c) => String(c.name || '')));
    const baseCols = ['id', 'domain', 'click_id', 'lead_id', 'payout', 'type', 'ts'];
    const optionalCols = ['voluum_domain', 'forward_status', 'forward_http_status', 'forward_error'];
    const selectCols = [
      ...baseCols,
      ...optionalCols.filter((c) => colSet.has(c)),
    ].join(', ');

    let stmt;
    if (domain && colSet.has('domain')) {
      stmt = binding.prepare(
        `SELECT ${selectCols} FROM voluum_postbacks WHERE domain LIKE ? AND ts > ? ORDER BY ts DESC LIMIT ?`
      ).bind(`%${domain}%`, since, limit);
    } else {
      stmt = binding.prepare(
        `SELECT ${selectCols} FROM voluum_postbacks WHERE ts > ? ORDER BY ts DESC LIMIT ?`
      ).bind(since, limit);
    }

    const { results } = await stmt.all();
    const postbacks = (results || []).map((r) => ({
      ...r,
      ts: Number(r.ts || 0),
      payout: Number(r.payout || 0),
      forward_http_status: r.forward_http_status != null ? Number(r.forward_http_status) : null,
    }));
    return json({ success: true, postbacks, count: postbacks.length });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

// ═══ /e — first-party pixel ingestion ═══

async function handlePixelEndpoint({ request, db, hostname, url, method }) {
  try {
    // Ensure pixel_events table exists (idempotent)
    await db.prepare(`CREATE TABLE IF NOT EXISTS pixel_events (
      id TEXT PRIMARY KEY,
      domain TEXT,
      session_id TEXT,
      event TEXT,
      data TEXT,
      gclid TEXT,
      click_id TEXT,
      ip TEXT,
      ua TEXT,
      ref TEXT,
      ts INTEGER DEFAULT (unixepoch())
    )`).run();

    const payload = await parsePixelPayloadFromRequest(request, url, method);

    const id = uid();
    const domain = String(payload.d || '').trim() || hostname || '';
    const sessionId = payload.sid || payload.session_id || '';
    const rawEvent = payload.e || payload.event || '';
    const hasEvent = Boolean(rawEvent);
    const event = hasEvent ? canonicalPixelEvent(rawEvent) : 'unknown';
    const data = payload.data || JSON.stringify(payload);
    const gclid = payload.gclid || payload.gid || '';
    const clickId = payload.click_id || payload.cid || payload.clickId || payload.cpid || '';
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';
    const ref = request.headers.get('Referer') || payload.ref || '';

    if (hasEvent) {
      await db.prepare(
        `INSERT INTO pixel_events (id, domain, session_id, event, data, gclid, click_id, ip, ua, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, domain, sessionId, event, data, gclid, clickId, ip, ua, ref).run();
    }

    // Return 1x1 transparent GIF for GET, JSON for POST
    if (method === 'GET') {
      const gif = new Uint8Array([71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 0, 0, 59]);
      return new Response(gif, {
        status: 200,
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', ...corsHeaders },
      });
    }
    return json({ ok: true, id, skipped: !hasEvent });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

// ═══ /v — Voluum/LeadsGate postback ingestion + relay ═══

async function handleVoluumPostback({ request, env, db, hostname, url, method }) {
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
    });
  }
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS voluum_postbacks (
      id TEXT PRIMARY KEY,
      domain TEXT,
      click_id TEXT,
      lead_id TEXT,
      payout REAL,
      type TEXT,
      ip TEXT,
      ua TEXT,
      raw TEXT,
      ts INTEGER DEFAULT (unixepoch())
    )`).run();
    for (const alterSql of [
      'ALTER TABLE voluum_postbacks ADD COLUMN voluum_domain TEXT',
      'ALTER TABLE voluum_postbacks ADD COLUMN forward_status TEXT',
      'ALTER TABLE voluum_postbacks ADD COLUMN forward_http_status INTEGER',
      'ALTER TABLE voluum_postbacks ADD COLUMN forward_error TEXT',
    ]) {
      try {
        await db.prepare(alterSql).run();
      } catch (_e) { /* column exists */ }
    }

    const p = await parseVoluumPostbackMergedParams(request, url, method);
    const clickId = p.get('click_id') || p.get('cid') || p.get('clickid') || '';
    const leadId = p.get('lead_id') || p.get('txid') || '';
    const payout = parseFloat(p.get('payout') || p.get('price') || '0');
    const type = p.get('type') || 'soldLead';
    const domain = hostname.replace(/^t\./, '');
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';
    const raw = request.url;
    const id = uid();

    const vdParam = normalizeVoluumDomainParam(p.get('vd') || p.get('voluum_domain') || '');
    const defaultVd = normalizeVoluumDomainParam(env.DEFAULT_VOLUUM_POSTBACK_DOMAIN || env.VOLUUM_POSTBACK_DOMAIN || '');
    const voluumHost = vdParam || defaultVd || '';

    await db.prepare(
      `INSERT INTO voluum_postbacks (id, domain, click_id, lead_id, payout, type, ip, ua, raw, voluum_domain, forward_status, forward_http_status, forward_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, domain, clickId, leadId, payout, type, ip, ua, raw, voluumHost || null, 'pending', null, null).run();

    let forwardStatus = 'skipped';
    let forwardHttp = null;
    let forwardErr = null;

    if (voluumHost && isSafeVoluumForwardHost(voluumHost, env)) {
      const fwdQs = voluumForwardSearchParams(p);
      const forwardUrl = `https://${voluumHost}/postback?${fwdQs.toString()}`;
      try {
        const fr = await fetch(forwardUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: { 'User-Agent': 'FusionOps-Postback-Relay/1' },
        });
        forwardHttp = fr.status;
        if (fr.status >= 200 && fr.status < 400) {
          forwardStatus = 'ok';
        } else {
          forwardStatus = 'http_error';
          forwardErr = await fr.text().then((t) => String(t || '').slice(0, 500)).catch(() => `status ${fr.status}`);
        }
      } catch (fe) {
        forwardStatus = 'error';
        forwardErr = String(fe.message || fe).slice(0, 500);
      }
    } else if (voluumHost) {
      forwardStatus = 'bad_host';
      forwardErr = 'vd failed validation or allowlist';
    }

    try {
      await db.prepare(
        `UPDATE voluum_postbacks SET forward_status = ?, forward_http_status = ?, forward_error = ? WHERE id = ?`
      ).bind(forwardStatus, forwardHttp, forwardErr, id).run();
    } catch (_u) { /* older schema without columns — ignore */ }

    console.log('[postback]', { id, clickId, leadId, payout, type, domain, voluumHost: voluumHost || null, forwardStatus, forwardHttp });
    return new Response('ok', {
      status: 200,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response('error: ' + e.message, { status: 500 });
  }
}

/**
 * Route entry. Returns Response if path matches `/e` or `/v`; null otherwise.
 */
export async function handlePixelTrackingRoute({ request, env, db, hostname, url, path, method }) {
  if (path === '/e' && (method === 'POST' || method === 'GET')) {
    return handlePixelEndpoint({ request, db, hostname, url, method });
  }
  if (path === '/v' && (method === 'GET' || method === 'POST' || method === 'OPTIONS')) {
    return handleVoluumPostback({ request, env, db, hostname, url, method });
  }
  return null;
}
