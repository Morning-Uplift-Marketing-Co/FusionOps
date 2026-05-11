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
 *
 * Uses a string-aware tokenizer instead of a bare split(';') so that a semicolon
 * inside a quoted string literal ('foo;bar') is not miscounted as a statement separator.
 */
export function isReadOnlyD1DirectSql(sql) {
  let s = String(sql || '').trim();
  if (!s) return false;

  // Strip block comments first (not string-aware, but block comments can't
  // contain unmatched quotes in valid SQL).
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');

  // Strip line comments using a string-aware pass so that '--' inside a quoted
  // string is not treated as a comment start.
  s = stripLineComments(s);
  s = s.trim();
  if (!s) return false;

  // Count top-level statement separators (semicolons outside string literals).
  if (countTopLevelStatements(s) !== 1) return false;

  // Remove trailing semicolon for the keyword check.
  let one = s.replace(/;\s*$/, '').trim();
  one = one.replace(/^\s*EXPLAIN\s+(QUERY\s+PLAN\s+)?/i, '').trim();
  return /^(SELECT|WITH)\b/i.test(one);
}

/** Strip SQL line comments (--...) while respecting single- and double-quoted strings. */
function stripLineComments(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      const q = c;
      out += c; i++;
      while (i < sql.length) {
        const d = sql[i];
        out += d; i++;
        if (d === q) {
          // Handle escaped quote by doubling ('' or "")
          if (sql[i] === q) { out += sql[i]; i++; } else { break; }
        }
      }
    } else if (c === '-' && sql[i + 1] === '-') {
      // Line comment: skip to end of line
      while (i < sql.length && sql[i] !== '\n') i++;
    } else {
      out += c; i++;
    }
  }
  return out;
}

/** Count the number of non-empty SQL statements (split by top-level semicolons). */
function countTopLevelStatements(sql) {
  let count = 0;
  let current = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      const q = c;
      current += c; i++;
      while (i < sql.length) {
        const d = sql[i];
        current += d; i++;
        if (d === q) {
          if (sql[i] === q) { current += sql[i]; i++; } else { break; }
        }
      }
    } else if (c === ';') {
      if (current.trim()) count++;
      current = '';
      i++;
    } else {
      current += c; i++;
    }
  }
  if (current.trim()) count++;
  return count;
}
