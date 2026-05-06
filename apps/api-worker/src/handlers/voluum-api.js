// ============================================================
// Voluum API proxy handler for FusionOps API Worker
// ============================================================
// Routes (proxy to https://api.voluum.com/*):
//   POST /api/voluum/session   email/password → cwauth-token
//   GET  /api/voluum/report    forwards report query (cwauth-token from header)
//   POST /api/voluum/proxy     generic relay; body: { token, method, path, body }
//
// Note: separate from POST /v Voluum postback relay (lines ~1080+).
// /api/voluum/* is operator-facing API for the SPA dashboard;
// /v is conversion postback ingestion from Voluum upstream.
//
// Extracted from worker.js (Phase 2: integration handler extraction).
// ============================================================

import { json } from '../lib/http.js';

const VOLUUM_BASE = 'https://api.voluum.com';

/**
 * Route entry. Returns Response if path matches; null otherwise.
 * Caller (main router) should fall through to other handlers on null.
 */
export async function handleVoluumApiRoute({ request, path, method, url }) {
  if (path === '/api/voluum/session' && method === 'POST') {
    const body = await request.json();
    const res = await fetch(`${VOLUUM_BASE}/auth/access/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return json(data, res.status);
  }

  if (path === '/api/voluum/report' && method === 'GET') {
    const token = request.headers.get('cwauth-token');
    if (!token) return json({ error: 'Missing cwauth-token proxy header' }, 401);
    const params = new URLSearchParams(url.search);
    const res = await fetch(`${VOLUUM_BASE}/report?${params.toString()}`, {
      headers: { 'Accept': 'application/json', 'cwauth-token': token },
    });
    const data = await res.json().catch(() => ({}));
    return json(data, res.status);
  }

  if (path === '/api/voluum/proxy' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const token = String(body?.token || '').trim();
    const proxyMethod = String(body?.method || 'GET').toUpperCase();
    const proxyPath = String(body?.path || '').trim();
    const proxyBody = body?.body;

    if (!token) return json({ error: 'Missing Voluum token' }, 401);
    if (!proxyPath || !proxyPath.startsWith('/')) {
      return json({ error: 'Invalid Voluum path; expected path starting with "/"' }, 400);
    }
    if (proxyPath.includes('://') || proxyPath.includes('..')) {
      return json({ error: 'Invalid Voluum path' }, 400);
    }
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(proxyMethod)) {
      return json({ error: `Unsupported method: ${proxyMethod}` }, 400);
    }

    const targetUrl = `${VOLUUM_BASE}${proxyPath}`;
    const headers = {
      'Accept': 'application/json',
      'cwauth-token': token,
    };
    const init = { method: proxyMethod, headers };
    if (proxyMethod !== 'GET' && proxyMethod !== 'DELETE' && proxyBody !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(proxyBody);
    }

    const res = await fetch(targetUrl, init);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_e) {
      data = { raw: text };
    }
    return json(data, res.status);
  }

  return null;
}
