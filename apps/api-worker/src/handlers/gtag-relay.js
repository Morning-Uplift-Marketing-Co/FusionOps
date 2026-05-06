// ============================================================
// Google Ads / Analytics tracking relay
// ============================================================
// Browser LPs fetch gtag.js and beacon conversions via t.{domain}
// so ad blockers + ITP cannot strip them. Relay scope is
// deliberately narrow: strictly allowlisted upstream paths,
// conversion-ID regex gate, no arbitrary open-proxy behavior.
//
// Feature-flagged with env.ENABLE_GTAG_RELAY = "1". Off by default
// so the code can ship ahead of LP-side inject-tracking changes
// without affecting production. When disabled, the routes 404
// silently and gtag.js calls fall back to direct Google endpoints
// (zero LP breakage).
//
// See .planning/specs/tracking-pipeline-v1/DESIGN.md (Option G).
// Extracted from worker.js (Phase 2: integration handler extraction).
// ============================================================

const GTAG_RELAY_ID_RE = /^(AW-\d{6,15}|G-[A-Z0-9]{4,20}|GT-[A-Z0-9]{4,20}|DC-\d{6,15})$/;

// Upstream hosts we are permitted to proxy to. Any other host = reject.
const GTAG_RELAY_UPSTREAMS = {
  loader: 'https://www.googletagmanager.com',
  ga: 'https://www.google-analytics.com',
  ads: 'https://www.googleadservices.com',
  doubleclick: 'https://googleads.g.doubleclick.net',
};

// Exhaustive path allowlist per upstream. Everything else = 404.
const GTAG_RELAY_PATHS = {
  '/gtag/js': 'loader',
  '/gtm.js': 'loader',
  '/g/collect': 'ga',
  '/j/collect': 'ga',
  '/ccm/collect': 'ga',
  '/r/collect': 'ga',
  '/pagead/conversion': 'ads',
  '/pagead/1p-conversion': 'ads',
  '/pagead/form-data': 'ads',
  '/pagead/viewthroughconversion': 'ads',
};

export function isGtagRelayEnabled(env) {
  const v = String(env?.ENABLE_GTAG_RELAY || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function gtagRelayUpstreamKeyForPath(path) {
  if (GTAG_RELAY_PATHS[path]) return GTAG_RELAY_PATHS[path];
  for (const prefix of Object.keys(GTAG_RELAY_PATHS)) {
    if (!prefix.endsWith('/') && path.startsWith(prefix + '/')) {
      return GTAG_RELAY_PATHS[prefix];
    }
  }
  return null;
}

export function isGtagRelayPath(path) {
  return gtagRelayUpstreamKeyForPath(path) !== null;
}

function gtagRelayRootDomain(host) {
  const parts = String(host || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) return String(host || '').toLowerCase();
  return parts.slice(-2).join('.');
}

// Forward a safe subset of request headers to upstream. Intentionally NOT
// forwarding Cookie (cookies are for t.{domain}, first-party to us — must
// not leak to Google) or Authorization.
function gtagRelayPassthroughHeaders(req) {
  const out = new Headers();
  const allow = ['user-agent', 'accept', 'accept-language', 'content-type', 'referer', 'x-requested-with'];
  for (const name of allow) {
    const v = req.headers.get(name);
    if (v) out.set(name, v);
  }
  const cfIp = req.headers.get('CF-Connecting-IP');
  if (cfIp) out.set('X-Forwarded-For', cfIp);
  return out;
}

// Strip hop-by-hop and CF-internal response headers before returning to the
// LP. Keeps Content-Type, Cache-Control, Content-Encoding, etc.
function gtagRelayResponseHeaders(upstreamRes, extras) {
  const out = new Headers();
  const skip = new Set([
    'transfer-encoding',
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'upgrade',
    'cf-ray',
    'cf-cache-status',
    'cf-request-id',
    'server',
    'alt-svc',
    'strict-transport-security',
    // Cookies set by Google are for google.com — browser will ignore them
    // anyway under our domain, but strip to keep responses clean.
    'set-cookie',
  ]);
  upstreamRes.headers.forEach((value, key) => {
    if (!skip.has(key.toLowerCase())) out.set(key, value);
  });
  // CORS: LPs fetch via <script> (gtag.js) and sendBeacon — both are safe
  // cross-origin by default. Setting ACAO is belt-and-suspenders so fetch()
  // wrappers also work.
  out.set('Access-Control-Allow-Origin', '*');
  out.set('Access-Control-Allow-Credentials', 'false');
  if (extras && typeof extras === 'object') {
    for (const [k, v] of Object.entries(extras)) {
      if (k.toLowerCase() === 'set-cookie' && Array.isArray(v)) {
        for (const c of v) out.append('Set-Cookie', c);
      } else if (v != null) {
        out.set(k, String(v));
      }
    }
  }
  return out;
}

// Rewrite absolute Google endpoint references inside the gtag.js loader body
// so beacons go through t.{host} instead of direct to Google. Case-sensitive
// match — gtag's own source always uses lowercase hostnames.
function gtagRelayRewriteLoaderBody(body, host) {
  const relayBase = `https://${host}`;
  return String(body)
    .replace(/https:\/\/www\.google-analytics\.com/g, relayBase)
    .replace(/https:\/\/www\.googletagmanager\.com/g, relayBase)
    .replace(/https:\/\/www\.googleadservices\.com/g, relayBase)
    .replace(/https:\/\/googleads\.g\.doubleclick\.net/g, relayBase);
}

// Extract a GCLID (or gbraid/wbraid) from the Referer URL — the LP's own
// URL — for seeding the first-party _gcl_aw cookie on pageview.
function gtagRelayExtractGclidFromReferer(req) {
  const ref = req.headers.get('Referer') || '';
  if (!ref) return '';
  try {
    const u = new URL(ref);
    for (const key of ['gclid', 'gbraid', 'wbraid']) {
      const v = u.searchParams.get(key);
      if (v && !/^\{[A-Za-z0-9_]+\}$/.test(v)) return v;
    }
  } catch (_e) { /* malformed referer */ }
  return '';
}

function gtagRelayBuildGclAwCookie(gclid, host) {
  if (!gclid) return '';
  const root = gtagRelayRootDomain(host);
  if (!root) return '';
  const ts = Math.floor(Date.now() / 1000);
  const val = `GCL.${ts}.${encodeURIComponent(gclid)}`;
  // Max-Age = 90 days. HttpOnly blocks JS access (gtag reads its own value
  // from the Google tag, not from the cookie directly on first load — the
  // cookie is a fallback for Safari ITP survival).
  return `_gcl_aw=${val}; Domain=.${root}; Path=/; Max-Age=7776000; Secure; SameSite=Lax`;
}

/**
 * Main relay handler. Returns a Response for any allowlisted path; returns
 * null if caller should fall through to the next route (relay disabled or
 * path unknown). 4xx is only returned for allowlisted paths that fail input
 * validation — callers should treat null as "not this route".
 */
export async function handleGtagRelay(request, url, env) {
  if (!isGtagRelayEnabled(env)) return null;
  const upstreamKey = gtagRelayUpstreamKeyForPath(url.pathname);
  if (!upstreamKey) return null;

  if (!['GET', 'POST', 'OPTIONS', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { 'Allow': 'GET, POST, OPTIONS, HEAD' } });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const upstreamBase = GTAG_RELAY_UPSTREAMS[upstreamKey];
  const upstreamUrl = new URL(url.pathname + url.search, upstreamBase);
  const isLoader = upstreamKey === 'loader';

  if (isLoader) {
    const id = url.searchParams.get('id') || '';
    if (!id || !GTAG_RELAY_ID_RE.test(id)) {
      return new Response('// gtag relay: invalid or missing id\n', {
        status: 400,
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
      });
    }
  }

  let upstream;
  try {
    const fetchInit = {
      method: request.method,
      headers: gtagRelayPassthroughHeaders(request),
      redirect: 'follow',
    };
    if (request.method === 'POST') {
      fetchInit.body = request.body;
    }
    upstream = await fetch(upstreamUrl.toString(), fetchInit);
  } catch (e) {
    return new Response(`// gtag relay upstream error: ${e.message}\n`, {
      status: 502,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }

  if (isLoader) {
    let body = '';
    try {
      body = await upstream.text();
    } catch (e) {
      return new Response(`// gtag relay body-read error: ${e.message}\n`, {
        status: 502,
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
      });
    }
    const rewritten = gtagRelayRewriteLoaderBody(body, url.host);
    const extras = {};
    const cookie = gtagRelayBuildGclAwCookie(gtagRelayExtractGclidFromReferer(request), url.host);
    if (cookie) extras['Set-Cookie'] = [cookie];
    // Loader responses can be cached at the edge for a short window — gtag.js
    // itself sets cache-control but we pass upstream's value through.
    const respHeaders = gtagRelayResponseHeaders(upstream, extras);
    respHeaders.set('X-Relay-Target', upstreamKey);
    return new Response(rewritten, { status: upstream.status, headers: respHeaders });
  }

  // For collect / pagead endpoints: stream body straight through. These are
  // beacons, so bodies are small (<1KB) and we don't need to inspect them.
  const respHeaders = gtagRelayResponseHeaders(upstream);
  respHeaders.set('X-Relay-Target', upstreamKey);
  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}
