// ============================================================
// Hermes Agent State API — D1-backed persistent state for AEGIS/SCOUT/HERALD/ORACLE
// ============================================================
// Replaces legacy local JSONL files under ~/.hermes/*-state/ on the Hetzner VPS.
// Decision: .agents/debates/hermes-state-20260518-231225/SYNTHESIS-R2.md (4-0 Pure D1).
//
// POST   /api/agents/state/fingerprints       Upsert (single object or array)
// GET    /api/agents/state/fingerprints       List (filters: agent, scope, since)
//
// POST   /api/agents/state/baselines          Upsert single baseline
// GET    /api/agents/state/baselines          List (filters: agent, metric)
//
// POST   /api/agents/state/alerts             Create alert
// GET    /api/agents/state/alerts             List (filters: status, agent, limit)
// PATCH  /api/agents/state/alerts             Ack/dismiss/resolve (body: {id, ack_status, acked_by})
//
// POST   /api/agents/state/oracle-keywords    Upsert (single object or array)
// GET    /api/agents/state/oracle-keywords    List (filters: source, since, limit)
//
// Auth: relies on the worker.js global Bearer/origin gate — register AFTER auth block.
// ============================================================

import { json } from '../lib/http.js';

const AGENTS = new Set(['AEGIS', 'SCOUT', 'HERALD', 'ORACLE']);
const SEVERITIES = new Set(['info', 'warn', 'high', 'critical']);
const ACK_STATUSES = new Set(['pending', 'acked', 'dismissed', 'resolved']);
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

function bad(message, status = 400) {
  return json({ success: false, error: message }, status);
}

function parseLimit(url) {
  const raw = Number(url.searchParams.get('limit') || DEFAULT_LIMIT);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(raw), MAX_LIMIT);
}

function parseSince(url) {
  const raw = url.searchParams.get('since');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

async function readJsonArray(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: 'Invalid JSON body' };
  }
  const rows = Array.isArray(body) ? body : [body];
  if (rows.length === 0) return { error: 'Empty body' };
  if (rows.length > MAX_LIMIT) return { error: `Batch too large (max ${MAX_LIMIT})` };
  return { rows };
}

// ─── Fingerprints ────────────────────────────────────────────────────────────

async function upsertFingerprints({ request, env }) {
  const parsed = await readJsonArray(request);
  if (parsed.error) return bad(parsed.error);

  const stmt = env.DB.prepare(`
    INSERT INTO agent_fingerprints (agent, scope, fingerprint_key, fingerprint_hash, payload, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(agent, scope, fingerprint_key) DO UPDATE SET
      fingerprint_hash = excluded.fingerprint_hash,
      payload = excluded.payload,
      last_seen_at = unixepoch()
  `);

  const batch = [];
  for (const r of parsed.rows) {
    if (!AGENTS.has(r.agent)) return bad(`Invalid agent: ${r.agent}`);
    if (!r.scope || !r.fingerprint_key || !r.fingerprint_hash) {
      return bad('fingerprints require: agent, scope, fingerprint_key, fingerprint_hash');
    }
    batch.push(stmt.bind(
      r.agent,
      String(r.scope),
      String(r.fingerprint_key),
      String(r.fingerprint_hash),
      r.payload == null ? null : (typeof r.payload === 'string' ? r.payload : JSON.stringify(r.payload)),
    ));
  }

  await env.DB.batch(batch);
  return json({ success: true, upserted: batch.length });
}

async function listFingerprints({ env, url }) {
  const agent = url.searchParams.get('agent');
  if (agent && !AGENTS.has(agent)) return bad(`Invalid agent: ${agent}`);
  const scope = url.searchParams.get('scope');
  const since = parseSince(url);
  const limit = parseLimit(url);

  const clauses = [];
  const params = [];
  if (agent) { clauses.push('agent = ?'); params.push(agent); }
  if (scope) { clauses.push('scope = ?'); params.push(scope); }
  if (since !== null) { clauses.push('last_seen_at >= ?'); params.push(since); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const sql = `
    SELECT id, agent, scope, fingerprint_key, fingerprint_hash, payload,
           first_seen_at, last_seen_at
    FROM agent_fingerprints
    ${where}
    ORDER BY last_seen_at DESC
    LIMIT ?
  `;
  const { results } = await env.DB.prepare(sql).bind(...params, limit).all();
  return json({ success: true, count: results.length, fingerprints: results });
}

// ─── Baselines ───────────────────────────────────────────────────────────────

async function upsertBaseline({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return bad('Invalid JSON body'); }
  if (!AGENTS.has(body.agent)) return bad(`Invalid agent: ${body.agent}`);
  if (!body.metric || !body.window || body.value == null) {
    return bad('baselines require: agent, metric, window, value');
  }
  const scope = body.scope || '_global';
  const sampleCount = Number.isFinite(body.sample_count) ? Math.max(1, Math.floor(body.sample_count)) : 1;

  await env.DB.prepare(`
    INSERT INTO agent_baselines (agent, metric, scope, window, value, sample_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(agent, metric, scope, window) DO UPDATE SET
      value = excluded.value,
      sample_count = excluded.sample_count,
      updated_at = unixepoch()
  `).bind(body.agent, String(body.metric), scope, String(body.window), Number(body.value), sampleCount).run();

  return json({ success: true });
}

async function listBaselines({ env, url }) {
  const agent = url.searchParams.get('agent');
  if (agent && !AGENTS.has(agent)) return bad(`Invalid agent: ${agent}`);
  const metric = url.searchParams.get('metric');

  const clauses = [];
  const params = [];
  if (agent) { clauses.push('agent = ?'); params.push(agent); }
  if (metric) { clauses.push('metric = ?'); params.push(metric); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { results } = await env.DB.prepare(`
    SELECT id, agent, metric, scope, window, value, sample_count, updated_at
    FROM agent_baselines
    ${where}
    ORDER BY updated_at DESC
  `).bind(...params).all();
  return json({ success: true, count: results.length, baselines: results });
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

async function createAlert({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return bad('Invalid JSON body'); }
  if (!AGENTS.has(body.agent)) return bad(`Invalid agent: ${body.agent}`);
  if (!SEVERITIES.has(body.severity)) return bad(`Invalid severity: ${body.severity}`);
  if (!body.title) return bad('alerts require: title');
  if (body.payload == null) return bad('alerts require: payload');

  const payloadStr = typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload);
  const result = await env.DB.prepare(`
    INSERT INTO agent_alerts (agent, severity, title, payload)
    VALUES (?, ?, ?, ?)
  `).bind(body.agent, body.severity, String(body.title), payloadStr).run();

  return json({ success: true, id: result.meta?.last_row_id ?? null });
}

async function listAlerts({ env, url }) {
  const status = url.searchParams.get('status');
  if (status && !ACK_STATUSES.has(status)) return bad(`Invalid status: ${status}`);
  const agent = url.searchParams.get('agent');
  if (agent && !AGENTS.has(agent)) return bad(`Invalid agent: ${agent}`);
  const limit = parseLimit(url);

  const clauses = [];
  const params = [];
  if (status) { clauses.push('ack_status = ?'); params.push(status); }
  if (agent) { clauses.push('agent = ?'); params.push(agent); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { results } = await env.DB.prepare(`
    SELECT id, agent, severity, title, payload, ack_status, acked_by, acked_at, created_at
    FROM agent_alerts
    ${where}
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(...params, limit).all();
  return json({ success: true, count: results.length, alerts: results });
}

async function patchAlert({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return bad('Invalid JSON body'); }
  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) return bad('id required');
  if (!ACK_STATUSES.has(body.ack_status)) return bad(`Invalid ack_status: ${body.ack_status}`);

  const ackedBy = body.acked_by ? String(body.acked_by) : null;
  const setAckedAt = body.ack_status !== 'pending';

  const result = await env.DB.prepare(`
    UPDATE agent_alerts
    SET ack_status = ?, acked_by = ?, acked_at = ${setAckedAt ? 'unixepoch()' : 'NULL'}
    WHERE id = ?
  `).bind(body.ack_status, ackedBy, id).run();

  if (!result.meta?.changes) return bad(`Alert ${id} not found`, 404);
  return json({ success: true, id });
}

// ─── ORACLE Keywords ─────────────────────────────────────────────────────────

async function upsertOracleKeywords({ request, env }) {
  const parsed = await readJsonArray(request);
  if (parsed.error) return bad(parsed.error);

  const stmt = env.DB.prepare(`
    INSERT INTO oracle_keywords (keyword, source, volume, weekly_baseline_volume, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(keyword, source) DO UPDATE SET
      weekly_baseline_volume = oracle_keywords.volume,
      volume = excluded.volume,
      last_seen_at = unixepoch()
  `);

  const batch = [];
  for (const r of parsed.rows) {
    if (!r.keyword || !r.source) return bad('oracle-keywords require: keyword, source');
    batch.push(stmt.bind(
      String(r.keyword),
      String(r.source),
      Number.isFinite(r.volume) ? Math.floor(r.volume) : 0,
      Number.isFinite(r.weekly_baseline_volume) ? Math.floor(r.weekly_baseline_volume) : 0,
    ));
  }

  await env.DB.batch(batch);
  return json({ success: true, upserted: batch.length });
}

async function listOracleKeywords({ env, url }) {
  const source = url.searchParams.get('source');
  const since = parseSince(url);
  const limit = parseLimit(url);

  const clauses = [];
  const params = [];
  if (source) { clauses.push('source = ?'); params.push(source); }
  if (since !== null) { clauses.push('last_seen_at >= ?'); params.push(since); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { results } = await env.DB.prepare(`
    SELECT id, keyword, source, volume, weekly_baseline_volume, first_seen_at, last_seen_at
    FROM oracle_keywords
    ${where}
    ORDER BY last_seen_at DESC
    LIMIT ?
  `).bind(...params, limit).all();
  return json({ success: true, count: results.length, keywords: results });
}

// ─── Route dispatcher ────────────────────────────────────────────────────────

export async function handleAgentStateRoute({ request, env, url, path, method }) {
  if (!path.startsWith('/api/agents/state/')) return null;

  if (path === '/api/agents/state/fingerprints') {
    if (method === 'POST') return upsertFingerprints({ request, env });
    if (method === 'GET')  return listFingerprints({ env, url });
  }
  if (path === '/api/agents/state/baselines') {
    if (method === 'POST') return upsertBaseline({ request, env });
    if (method === 'GET')  return listBaselines({ env, url });
  }
  if (path === '/api/agents/state/alerts') {
    if (method === 'POST')  return createAlert({ request, env });
    if (method === 'GET')   return listAlerts({ env, url });
    if (method === 'PATCH') return patchAlert({ request, env });
  }
  if (path === '/api/agents/state/oracle-keywords') {
    if (method === 'POST') return upsertOracleKeywords({ request, env });
    if (method === 'GET')  return listOracleKeywords({ env, url });
  }

  return bad(`Method ${method} not allowed on ${path}`, 405);
}
