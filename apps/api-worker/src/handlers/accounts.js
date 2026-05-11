// ============================================================
// CF + Registrar accounts CRUD for FusionOps API Worker
// ============================================================
// Routes:
//   GET/POST   /api/cf-accounts          List + create CF API account
//   PUT/DELETE /api/cf-accounts/:id      Update + remove
//   GET/POST   /api/registrar-accounts   List + create (also ops_logs entry)
//   PUT/DELETE /api/registrar-accounts/:id   Update (logged) + remove
//
// Stored in cf_accounts / registrar_accounts tables; consumed by
// automation/cloudflare.js, automation/registrar.js, and sites.js.
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json, uid } from '../lib/http.js';

const MASK = '••••';

/** Returns true if the value is the placeholder mask sent by the frontend. */
function isMasked(v) { return !v || /^[•*]+$/.test(String(v)); }

/** Mask a single row from cf_accounts for API responses. */
function maskCfAccount(row) {
  return { ...row, api_key: row.api_key ? MASK : '', api_token: row.api_token ? MASK : '' };
}

/** Mask a single row from registrar_accounts for API responses. */
function maskRegistrarAccount(row) {
  return { ...row, api_key: row.api_key ? MASK : '', secret_key: row.secret_key ? MASK : '' };
}

async function handleCfAccountsRoute({ request, db, path, method }) {
  if (path === '/api/cf-accounts' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM cf_accounts ORDER BY label ASC').all();
    return json(results.map(maskCfAccount));
  }
  if (path === '/api/cf-accounts' && method === 'POST') {
    const body = await request.json();
    const id = body.id || uid();
    await db.prepare('INSERT INTO cf_accounts (id, email, api_key, api_token, account_id, label) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, body.email || '', body.apiKey || '', body.apiToken || '', body.accountId || '', body.label || '').run();
    return json({ id, success: true }, 201);
  }
  if (path.match(/^\/api\/cf-accounts\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop();
    const body = await request.json();
    // Fetch existing credentials so masked placeholders don't overwrite real values.
    const existing = await db.prepare('SELECT api_key, api_token FROM cf_accounts WHERE id = ?').bind(id).first().catch(() => null);
    const apiKey = isMasked(body.apiKey) ? (existing?.api_key || '') : (body.apiKey || '');
    const apiToken = isMasked(body.apiToken) ? (existing?.api_token || '') : (body.apiToken || '');
    await db.prepare('UPDATE cf_accounts SET email = ?, api_key = ?, api_token = ?, account_id = ?, label = ? WHERE id = ?')
      .bind(body.email || '', apiKey, apiToken, body.accountId || '', body.label || '', id).run();
    return json({ success: true });
  }
  if (path.match(/^\/api\/cf-accounts\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop();
    await db.prepare('DELETE FROM cf_accounts WHERE id = ?').bind(id).run();
    return json({ success: true });
  }
  return null;
}

async function handleRegistrarAccountsRoute({ request, db, path, method }) {
  if (path === '/api/registrar-accounts' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM registrar_accounts ORDER BY provider ASC, label ASC').all();
    return json(results.map(maskRegistrarAccount));
  }
  if (path === '/api/registrar-accounts' && method === 'POST') {
    const body = await request.json();
    const id = body.id || uid();
    await db.prepare('INSERT INTO registrar_accounts (id, provider, label, api_key, secret_key) VALUES (?, ?, ?, ?, ?)')
      .bind(id, body.provider || 'internetbs', body.label || '', body.apiKey || '', body.secretKey || '').run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Added registrar account: ${body.label || body.provider}`).run();
    return json({ id, success: true }, 201);
  }
  if (path.match(/^\/api\/registrar-accounts\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop();
    const body = await request.json();
    // Fetch existing credentials so masked placeholders don't overwrite real values.
    const existing = await db.prepare('SELECT api_key, secret_key FROM registrar_accounts WHERE id = ?').bind(id).first().catch(() => null);
    const apiKey = isMasked(body.apiKey) ? (existing?.api_key || '') : (body.apiKey || '');
    const secretKey = isMasked(body.secretKey) ? (existing?.secret_key || '') : (body.secretKey || '');
    await db.prepare('UPDATE registrar_accounts SET provider = ?, label = ?, api_key = ?, secret_key = ? WHERE id = ?')
      .bind(body.provider || 'internetbs', body.label || '', apiKey, secretKey, id).run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Updated registrar account: ${body.label || body.provider}`).run();
    return json({ success: true });
  }
  if (path.match(/^\/api\/registrar-accounts\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop();
    await db.prepare('DELETE FROM registrar_accounts WHERE id = ?').bind(id).run();
    return json({ success: true });
  }
  return null;
}

/**
 * Combined entry. Returns Response if path matches; null otherwise.
 */
export async function handleAccountsRoute(args) {
  return (await handleCfAccountsRoute(args)) || (await handleRegistrarAccountsRoute(args));
}
