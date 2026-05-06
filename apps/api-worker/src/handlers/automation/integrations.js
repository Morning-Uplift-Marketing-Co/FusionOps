// ============================================================
// LeadingCards + Multilogin automation for FusionOps API Worker
// ============================================================
// LC routes (POST):
//   /api/automation/lc/create
//   /api/automation/lc/block
//   /api/automation/lc/activate
//   /api/automation/lc/change_limit
//
// ML routes (POST/GET):
//   /api/automation/ml/signin
//   /api/automation/ml/refresh_token
//   /api/automation/ml/profiles (GET/POST)
//   /api/automation/ml/profiles/start
//   /api/automation/ml/profiles/stop
//   /api/automation/ml/profiles/clone
//
// NOTE: /api/automation/ml/signin references md5() which is not
// defined anywhere in the codebase (pre-existing bug — would throw
// ReferenceError if invoked). Preserved as-is to avoid behavior
// change; needs follow-up to either define md5 or use plaintext
// password like the operator-facing /api/ml/signin already does.
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json } from '../../lib/http.js';
import { getLcSettings } from '../leadingcards.js';
import { getMlSettings } from '../multilogin.js';

const LC_BASE = 'https://app.leadingcards.media/v1';
const ML_BASE = 'https://api.multilogin.com';

// ═══ LeadingCards automation handlers ═══

async function lcCreate({ request, db }) {
  const lc = await getLcSettings(db);
  if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
  const body = await request.json();
  if (lc.lcTeamUuid) body.team_uuid = lc.lcTeamUuid;

  const res = await fetch(`${LC_BASE}/cards/`, {
    method: 'POST',
    headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return json({ success: res.ok, card: data, status: res.status });
}

async function lcBlock({ request, db }) {
  const lc = await getLcSettings(db);
  if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
  const body = await request.json();
  const { cardUuid } = body;
  if (!cardUuid) return json({ error: 'Missing cardUuid' }, 400);

  const res = await fetch(`${LC_BASE}/cards/${cardUuid}/block/`, {
    method: 'PUT',
    headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  return json({ success: res.ok, card: data, status: res.status });
}

async function lcActivate({ request, db }) {
  const lc = await getLcSettings(db);
  if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
  const body = await request.json();
  const { cardUuid } = body;
  if (!cardUuid) return json({ error: 'Missing cardUuid' }, 400);

  const res = await fetch(`${LC_BASE}/cards/${cardUuid}/activate/`, {
    method: 'PUT',
    headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  return json({ success: res.ok, card: data, status: res.status });
}

async function lcChangeLimit({ request, db }) {
  const lc = await getLcSettings(db);
  if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
  const body = await request.json();
  const { cardUuid, limit } = body;
  if (!cardUuid || !limit) return json({ error: 'Missing cardUuid or limit' }, 400);

  const res = await fetch(`${LC_BASE}/cards/${cardUuid}/change_limit/`, {
    method: 'PUT',
    headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  });
  const data = await res.json();
  return json({ success: res.ok, card: data, status: res.status });
}

// ═══ Multilogin automation handlers ═══

async function mlSignin({ db }) {
  const ml = await getMlSettings(db);
  if (!ml.mlEmail || !ml.mlPassword) return json({ error: 'Multilogin credentials not configured' }, 400);

  // PRE-EXISTING BUG: md5 is not defined anywhere in worker.js.
  // Would throw ReferenceError if this endpoint is invoked.
  // Preserved here to avoid behavior change; tracked for cleanup.
  const res = await fetch(`${ML_BASE}/user/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ml.mlEmail, password: md5(ml.mlPassword) }), // eslint-disable-line no-undef
  });
  const data = await res.json();
  if (data.data?.token) {
    await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('mlToken', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`)
      .bind(data.data.token, data.data.token).run();
  }
  return json({
    success: !!data.data?.token,
    token: data.data?.token || null,
    message: data.message,
  });
}

async function mlRefreshToken({ db }) {
  const ml = await getMlSettings(db);
  if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);

  const res = await fetch(`${ML_BASE}/user/refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
  });
  const data = await res.json();
  if (data.data?.token) {
    await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('mlToken', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`)
      .bind(data.data.token, data.data.token).run();
  }
  return json({
    success: !!data.data?.token,
    token: data.data?.token || null,
    message: data.message,
  });
}

async function mlProfilesList({ db, url }) {
  const ml = await getMlSettings(db);
  if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);

  const params = new URLSearchParams(url.search);
  const res = await fetch(`${ML_BASE}/profile/list?${params.toString()}`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
  });
  const data = await res.json();
  return json({
    success: res.ok,
    profiles: data.data || [],
    total: data.total || 0,
  });
}

async function mlProfilesCreate({ request, db }) {
  const ml = await getMlSettings(db);
  if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
  const body = await request.json();

  const res = await fetch(`${ML_BASE}/profile/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return json({
    success: !!data.data?.profile_id,
    profileId: data.data?.profile_id || null,
    profile: data.data || null,
  });
}

async function mlProfileStart({ request, db }) {
  const ml = await getMlSettings(db);
  if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
  const body = await request.json();
  const { profileId } = body;
  if (!profileId) return json({ error: 'Missing profileId' }, 400);

  const res = await fetch(`${ML_BASE}/profile/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
    body: JSON.stringify({ profile_id: profileId }),
  });
  const data = await res.json();
  return json({
    success: !!data.data?.connection_url,
    connectionUrl: data.data?.connection_url || null,
    profileId: data.data?.profile_id || profileId,
  });
}

async function mlProfileStop({ request, db }) {
  const ml = await getMlSettings(db);
  if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
  const body = await request.json();
  const { profileId } = body;
  if (!profileId) return json({ error: 'Missing profileId' }, 400);

  const res = await fetch(`${ML_BASE}/profile/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
    body: JSON.stringify({ profile_id: profileId }),
  });
  const data = await res.json();
  return json({
    success: res.ok,
    profileId,
    message: data.message,
  });
}

async function mlProfileClone({ request, db }) {
  const ml = await getMlSettings(db);
  if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
  const body = await request.json();
  const { profileId } = body;
  if (!profileId) return json({ error: 'Missing profileId' }, 400);

  const res = await fetch(`${ML_BASE}/profile/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
    body: JSON.stringify({ profile_id: profileId }),
  });
  const data = await res.json();
  return json({
    success: !!data.data?.profile_id,
    newProfileId: data.data?.profile_id || null,
    profile: data.data || null,
  });
}

/**
 * Route entry. Returns Response if path matches LC or ML automation routes; null otherwise.
 */
export async function handleIntegrationsAutomationRoute({ request, db, url, path, method }) {
  // LeadingCards
  if (path === '/api/automation/lc/create' && method === 'POST') return lcCreate({ request, db });
  if (path === '/api/automation/lc/block' && method === 'POST') return lcBlock({ request, db });
  if (path === '/api/automation/lc/activate' && method === 'POST') return lcActivate({ request, db });
  if (path === '/api/automation/lc/change_limit' && method === 'POST') return lcChangeLimit({ request, db });

  // Multilogin
  if (path === '/api/automation/ml/signin' && method === 'POST') return mlSignin({ db });
  if (path === '/api/automation/ml/refresh_token' && method === 'POST') return mlRefreshToken({ db });
  if (path === '/api/automation/ml/profiles' && method === 'GET') return mlProfilesList({ db, url });
  if (path === '/api/automation/ml/profiles' && method === 'POST') return mlProfilesCreate({ request, db });
  if (path === '/api/automation/ml/profiles/start' && method === 'POST') return mlProfileStart({ request, db });
  if (path === '/api/automation/ml/profiles/stop' && method === 'POST') return mlProfileStop({ request, db });
  if (path === '/api/automation/ml/profiles/clone' && method === 'POST') return mlProfileClone({ request, db });

  return null;
}
