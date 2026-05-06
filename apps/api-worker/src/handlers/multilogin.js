// ============================================================
// Multilogin proxy handler for FusionOps API Worker
// ============================================================
// Routes (proxy to https://api.multilogin.com/*):
//   POST /api/ml/signin                          email/password → token (cached in D1)
//   POST /api/ml/refresh-token                   refresh expired token
//   GET  /api/ml/profiles                        list profiles
//   POST /api/ml/profiles                        create profile
//   POST /api/ml/profiles/:profileId/start       start profile
//   POST /api/ml/profiles/:profileId/stop        stop profile
//   POST /api/ml/profiles/:profileId/clone       clone profile
//
// Auth: Token cached in D1 settings (key='mlToken'); signin and
// refresh-token both upsert it. Email/password also stored in
// settings (mlEmail, mlPassword) for headless signin.
//
// Extracted from worker.js (Phase 2: integration handler extraction).
// ============================================================

import { json } from '../lib/http.js';

const ML_BASE = 'https://api.multilogin.com';

/** Pull Multilogin credentials from D1 settings. */
export async function getMlSettings(db) {
  const rows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('mlToken', 'mlEmail', 'mlPassword', 'mlFolderId')").all();
  const s = {};
  rows.results.forEach(r => { s[r.key] = r.value; });
  return s;
}

function mlAuthHeaders(token) {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

function mlMissingTokenResponse() {
  return json({ error: 'Multilogin token not configured' }, 400);
}

/** Persist a fresh token returned from signin/refresh into D1 settings. */
async function persistMlToken(db, token) {
  if (!token) return;
  await db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES ('mlToken', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
  `).bind(token, token).run();
}

/**
 * Route entry. Returns Response if path matches; null otherwise.
 * Caller (main router) should fall through to other handlers on null.
 */
export async function handleMultiloginRoute({ request, db, path, method, url }) {
  if (path === '/api/ml/signin' && method === 'POST') {
    const ml = await getMlSettings(db);
    if (!ml.mlEmail || !ml.mlPassword) return json({ error: 'Multilogin email/password not configured' }, 400);
    const res = await fetch(`${ML_BASE}/user/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ml.mlEmail, password: ml.mlPassword }),
    });
    const data = await res.json();
    await persistMlToken(db, data.data?.token);
    return json(data, res.status);
  }

  if (path === '/api/ml/refresh-token' && method === 'POST') {
    const ml = await getMlSettings(db);
    if (!ml.mlToken) return mlMissingTokenResponse();
    const res = await fetch(`${ML_BASE}/user/refresh_token`, {
      method: 'POST',
      headers: mlAuthHeaders(ml.mlToken),
    });
    const data = await res.json();
    await persistMlToken(db, data.data?.token);
    return json(data, res.status);
  }

  if (path === '/api/ml/profiles' && method === 'GET') {
    const ml = await getMlSettings(db);
    if (!ml.mlToken) return mlMissingTokenResponse();
    const params = new URLSearchParams(url.search);
    const res = await fetch(`${ML_BASE}/profile/list?${params.toString()}`, {
      headers: mlAuthHeaders(ml.mlToken),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  if (path === '/api/ml/profiles' && method === 'POST') {
    const ml = await getMlSettings(db);
    if (!ml.mlToken) return mlMissingTokenResponse();
    const body = await request.json();
    const res = await fetch(`${ML_BASE}/profile/create`, {
      method: 'POST',
      headers: mlAuthHeaders(ml.mlToken),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  if (path.match(/^\/api\/ml\/profiles\/[\w-]+\/(start|stop)$/) && method === 'POST') {
    const ml = await getMlSettings(db);
    if (!ml.mlToken) return mlMissingTokenResponse();
    const parts = path.split('/');
    const action = parts.pop();
    const profileId = parts.pop();
    const res = await fetch(`${ML_BASE}/profile/${action}`, {
      method: 'POST',
      headers: mlAuthHeaders(ml.mlToken),
      body: JSON.stringify({ profile_id: profileId }),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  if (path.match(/^\/api\/ml\/profiles\/[\w-]+\/clone$/) && method === 'POST') {
    const ml = await getMlSettings(db);
    if (!ml.mlToken) return mlMissingTokenResponse();
    const parts = path.split('/');
    parts.pop(); // clone
    const profileId = parts.pop();
    const res = await fetch(`${ML_BASE}/profile/clone`, {
      method: 'POST',
      headers: mlAuthHeaders(ml.mlToken),
      body: JSON.stringify({ profile_id: profileId }),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  return null;
}
