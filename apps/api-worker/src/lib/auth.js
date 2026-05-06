// ============================================================
// Auth utilities for FusionOps API Worker
// ============================================================
// Provides:
// - Trusted-origin detection (browser SPA via Origin/Referer)
// - Bearer API_SECRET fallback
// - Read-only D1 direct-query SQL gate (defense in depth)
//
// Extracted from worker.js (Phase 1: utility extraction).
// ============================================================

import { extractHost } from './url.js';
import { json } from './http.js';

export const TRUSTED_PAGES_SUFFIXES = [
  '.fusionops-web.pages.dev',
  '.fusionops.pages.dev',
  '.up.railway.app',
];

export function buildAllowedHosts(env, requestHost) {
  const configured = String(env?.ALLOWED_ORIGINS || '')
    .split(',')
    .map((v) => extractHost(v))
    .filter(Boolean);
  return new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'fusionops-web.pages.dev',
    'main.fusionops.pages.dev',
    'fusionops.pages.dev',
    extractHost(env?.APP_ORIGIN || ''),
    extractHost(env?.PUBLIC_APP_ORIGIN || ''),
    extractHost(requestHost || ''),
    ...configured,
  ].filter(Boolean));
}

/** Cloudflare Pages preview/production hosts that include "fusionops" (e.g. multi-fusionops-web.pages.dev). */
export function isFusionopsPagesDevHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h.endsWith('.pages.dev')) return false;
  return h.includes('fusionops');
}

export function isTrustedOriginRequest(request, url, env) {
  const allowed = buildAllowedHosts(env, url?.hostname || '');
  const originHost = extractHost(request.headers.get('Origin') || '');
  const refererHost = extractHost(request.headers.get('Referer') || '');
  const sourceHost = originHost || refererHost;
  if (!sourceHost) return false;
  if (allowed.has(sourceHost)) return true;
  if (isFusionopsPagesDevHost(sourceHost)) return true;
  return TRUSTED_PAGES_SUFFIXES.some((suffix) => sourceHost.endsWith(suffix));
}

/**
 * Expensive template thumb mutations: require same trust as authenticated /api —
 * Bearer API_SECRET, or browser Origin/Referer on allowlist (see isTrustedOriginRequest).
 */
export function denyUnlessTrustedOrBearer(request, url, env) {
  const auth = request.headers.get('Authorization') || '';
  if (env.API_SECRET && auth === `Bearer ${env.API_SECRET}`) return null;
  if (isTrustedOriginRequest(request, url, env)) return null;
  if (env.API_SECRET) {
    return json({ error: 'Unauthorized (missing/invalid Bearer and untrusted origin)' }, 401);
  }
  return json({ error: 'Unauthorized (untrusted origin)' }, 401);
}

/**
 * Bound-D1 direct-query: one statement only; SELECT / WITH only (after optional EXPLAIN).
 * Blocks writes and PRAGMA even if outer auth is compromised.
 */
export function isReadOnlyD1DirectSql(sql) {
  let s = String(sql || '').trim();
  if (!s) return false;
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  s = s
    .split(/\r?\n/)
    .map((line) => line.replace(/--[^\n]*/, ''))
    .join('\n');
  s = s.trim();
  const parts = s.split(';').map((x) => x.trim()).filter(Boolean);
  if (parts.length !== 1) return false;
  let one = parts[0];
  one = one.replace(/^\s*EXPLAIN\s+(QUERY\s+PLAN\s+)?/i, '').trim();
  return /^(SELECT|WITH)\b/i.test(one);
}
