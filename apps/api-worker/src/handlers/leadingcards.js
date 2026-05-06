// ============================================================
// LeadingCards proxy handler for FusionOps API Worker
// ============================================================
// Routes (proxy to https://app.leadingcards.media/v1/*):
//   GET    /api/lc/cards                    list cards (team-scoped)
//   GET    /api/lc/cards/:uuid              get one card
//   POST   /api/lc/cards                    create card
//   PUT    /api/lc/cards/:uuid/block        block card
//   PUT    /api/lc/cards/:uuid/activate     activate card
//   PUT    /api/lc/cards/:uuid/change_limit update card limit
//   GET    /api/lc/{bins|billing|tags|transactions|teams}  list resource
//   POST   /api/lc/billing                  create billing address
//
// Auth: Token retrieved from D1 settings (key='lcToken').
// Team scoping: lcTeamUuid auto-attached to list/create where applicable.
//
// Extracted from worker.js (Phase 2: integration handler extraction).
// ============================================================

import { json } from '../lib/http.js';

const LC_BASE = 'https://app.leadingcards.media/v1';

/** Pull LeadingCards credentials from D1 settings. */
export async function getLcSettings(db) {
  const rows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('lcToken', 'lcTeamUuid')").all();
  const s = {};
  rows.results.forEach(r => { s[r.key] = r.value; });
  return s;
}

function lcAuthHeaders(token) {
  return { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' };
}

function lcMissingTokenResponse() {
  return json({ error: 'LeadingCards token not configured' }, 400);
}

/**
 * Route entry. Returns Response if path matches; null otherwise.
 * Caller (main router) should fall through to other handlers on null.
 */
export async function handleLeadingCardsRoute({ request, db, path, method, url }) {
  if (path === '/api/lc/cards' && method === 'GET') {
    const lc = await getLcSettings(db);
    if (!lc.lcToken) return lcMissingTokenResponse();
    const params = new URLSearchParams(url.search);
    if (lc.lcTeamUuid) params.set('team_uuid', lc.lcTeamUuid);
    const res = await fetch(`${LC_BASE}/cards/?${params.toString()}`, {
      headers: lcAuthHeaders(lc.lcToken),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  if (path.match(/^\/api\/lc\/cards\/[\w-]+$/) && method === 'GET') {
    const lc = await getLcSettings(db);
    if (!lc.lcToken) return lcMissingTokenResponse();
    const parts = path.split('/');
    const uuid = parts.pop();
    const res = await fetch(`${LC_BASE}/cards/${uuid}/`, {
      headers: lcAuthHeaders(lc.lcToken),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  if (path === '/api/lc/cards' && method === 'POST') {
    const lc = await getLcSettings(db);
    if (!lc.lcToken) return lcMissingTokenResponse();
    const body = await request.json();
    if (lc.lcTeamUuid) body.team_uuid = lc.lcTeamUuid;
    const res = await fetch(`${LC_BASE}/cards/`, {
      method: 'POST',
      headers: lcAuthHeaders(lc.lcToken),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  if (path.match(/^\/api\/lc\/cards\/[\w-]+\/(block|activate)$/) && method === 'PUT') {
    const lc = await getLcSettings(db);
    if (!lc.lcToken) return lcMissingTokenResponse();
    const parts = path.split('/');
    const action = parts.pop();
    const uuid = parts.pop();
    const res = await fetch(`${LC_BASE}/cards/${uuid}/${action}/`, {
      method: 'PUT',
      headers: lcAuthHeaders(lc.lcToken),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  if (path.match(/^\/api\/lc\/cards\/[\w-]+\/change_limit$/) && method === 'PUT') {
    const lc = await getLcSettings(db);
    if (!lc.lcToken) return lcMissingTokenResponse();
    const parts = path.split('/');
    parts.pop(); // change_limit
    const uuid = parts.pop();
    const body = await request.json();
    const res = await fetch(`${LC_BASE}/cards/${uuid}/change_limit/`, {
      method: 'PUT',
      headers: lcAuthHeaders(lc.lcToken),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  if (path.match(/^\/api\/lc\/(bins|billing|tags|transactions|teams)$/) && method === 'GET') {
    const lc = await getLcSettings(db);
    if (!lc.lcToken) return lcMissingTokenResponse();
    const resource = path.split('/').pop();
    const apiMap = { bins: 'cards/bins', billing: 'billing_addresses', tags: 'tags', transactions: 'transactions', teams: 'teams' };
    const endpoint = apiMap[resource];
    const params = new URLSearchParams(url.search);
    const res = await fetch(`${LC_BASE}/${endpoint}/?${params.toString()}`, {
      headers: lcAuthHeaders(lc.lcToken),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  if (path === '/api/lc/billing' && method === 'POST') {
    const lc = await getLcSettings(db);
    if (!lc.lcToken) return lcMissingTokenResponse();
    const body = await request.json();
    const res = await fetch(`${LC_BASE}/billing_addresses/`, {
      method: 'POST',
      headers: lcAuthHeaders(lc.lcToken),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  return null;
}
