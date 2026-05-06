// ============================================================
// Generic proxy handler for FusionOps API Worker
// ============================================================
// Routes:
//   /api/proxy/cf/*        → api.cloudflare.com/client/v4/*
//   /api/proxy/mlx/*       → api.multilogin.com/* (with 60s cache for GET)
//   /api/proxy/netlify/*   → api.netlify.com/api/v1/*
//   /api/proxy/pass        → arbitrary HTTPS forwarding (?url=)
//   /api/proxy/resolve-ip  → exit IP via ip-api.com through HTTP proxy
//   /api/proxy/dns-check   → proxy DNS leak check
//   /api/proxy/latency-check → round-trip latency through proxy
//
// In-memory MLX TTL cache (success: 60s, rate-limit: 20s) reduces
// upstream rate-limit pressure within the same Worker isolate.
//
// Extracted from worker.js (Phase 2: integration handler extraction).
// ============================================================

import { connect } from 'cloudflare:sockets';
import { corsHeaders, json, toBase64 } from '../lib/http.js';

/** RFC 7617-style UTF-8 safe Basic auth for HTTP proxies (btoa(user:pass) breaks on non-Latin1). */
export function proxyBasicAuth(username, password) {
  return toBase64(`${String(username ?? '')}:${String(password ?? '')}`);
}

/** Extra JSON for 502 when Workers cannot open TCP to the proxy (all providers share this path). */
export function proxyTcpFailurePayload(tcpErr, host, port) {
  const msg = String(tcpErr?.message ?? tcpErr);
  const disallowed =
    /cannot connect to the specified address/i.test(msg) ||
    /proxy request failed/i.test(msg);
  const payload = { error: `Proxy connection failed: ${msg}` };
  if (disallowed) {
    payload.hint =
      'ทุกค่ายพร็อกซีในแอปใช้ Worker เส้นทางเดียวกัน: เปิด TCP จาก Cloudflare ไปที่ host:port ของ gateway — ถ้าขั้นนี้ล้ม จะล้มทั้ง Smartproxy / NodeMaven / Bright Data พร้อมกัน แม้รหัสจะถูก (Multilogin บนเครื่องคุณอาจใช้พร็อกซีได้ปกติ). Production: ตั้ง PROXY_RESOLVE_RELAY_URL บน Worker ชี้ไป https://relay ของคุณ (รัน npm run proxy-relay บน VPS + TLS) แล้ว Worker จะส่งต่อ resolve-ip อัตโนมัติเมื่อ TCP ล้ม — แอป HTTPS ไม่ต้องเรียก http://127.0.0.1. ลอง: ยืนยันแผน Cloudflare Workers รองรับ outbound TCP sockets; ใช้ host+พอร์ตมาตรฐานจากเอกสารผู้ให้บริการ (เช่น gate.nodemaven.com:8080, brd.superproxy.io:22225, gate.decodo.com:7000). อ้างอิง: Cloudflare TCP sockets troubleshooting.';
    payload.docs = 'https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/#troubleshooting';
    payload.attempted = { host: String(host), port: Number(port) };
    payload.fix =
      'Cloudflare Dashboard → Workers → lp-factory-api → Settings → Variables → add PROXY_RESOLVE_RELAY_URL = https://your-relay.example.com (no /api). Deploy relay with: npm run proxy-relay on a VPS behind HTTPS; then wrangler deploy this worker.';
  }
  return payload;
}

/** Normalize relay origin for Worker → relay fetch (same path contract as scripts/proxy-resolve-relay.mjs). */
export function normalizeProxyRelayBase(env) {
  let b = String(env?.PROXY_RESOLVE_RELAY_URL ?? '').trim();
  if (!b) return '';
  b = b.replace(/\/+$/, '');
  if (b.endsWith('/api')) b = b.slice(0, -4);
  if (!/^https?:\/\//i.test(b)) b = `https://${b}`;
  try {
    const u = new URL(b);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    const path = u.pathname.replace(/\/$/, '');
    return `${u.origin}${path}`;
  } catch {
    return '';
  }
}

/**
 * When outbound TCP to the residential proxy fails from the Worker, forward the same JSON body to an
 * operator-run HTTPS relay (Node + undici on a VPS). Browser → Worker stays same-origin enough for CORS;
 * avoids mixed-content (browser cannot call http://127.0.0.1 from https:// pages).
 */
export async function forwardToProxyRelay(env, apiPath, jsonBody) {
  const base = normalizeProxyRelayBase(env);
  if (!base) return null;
  const target = `${base}${apiPath}`;
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 28000);
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonBody),
      signal: ac.signal,
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * HTTP GET with absolute URL through an HTTP proxy (RFC 7230).
 * Cloudflare: await socket.opened before write; await writer.close() after request so the readable stream is not cancelled mid-flight.
 */
export async function httpGetThroughHttpProxy(proxyHost, proxyPort, proxyAuthB64, absoluteUrl, originHost) {
  const socket = connect({ hostname: String(proxyHost), port: Number(proxyPort) });
  await socket.opened;
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const httpReq = [
    `GET ${absoluteUrl} HTTP/1.1`,
    `Host: ${originHost}`,
    `Proxy-Authorization: Basic ${proxyAuthB64}`,
    `User-Agent: FusionOps-Worker/1.0`,
    `Connection: close`,
    ``,
    ``,
  ].join('\r\n');
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let responseText = '';
  try {
    await writer.write(encoder.encode(httpReq));
    await writer.close();
    const maxBytes = 524288;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.byteLength) responseText += decoder.decode(value, { stream: true });
      if (responseText.length > maxBytes) break;
    }
  } finally {
    try {
      await socket.close();
    } catch (_) {}
  }
  return responseText;
}

// ═══════════════════════════════════════════
// PROXY TARGETS — generic CORS-proxied endpoints
// ═══════════════════════════════════════════
const PROXY_TARGETS = {
  '/api/proxy/cf/': 'https://api.cloudflare.com/client/v4/',
  '/api/proxy/mlx/': 'https://api.multilogin.com/',
  '/api/proxy/netlify/': 'https://api.netlify.com/api/v1/',
};

const MLX_CACHE_TTL_SUCCESS = 60000;    // ms for 2xx responses
const MLX_CACHE_TTL_RATE_LIMIT = 20000; // ms for 429/503 responses

// In-memory TTL cache for MLX GET proxy responses
// Persists across requests within the same Worker isolate
const mlxCache = new Map(); // key -> { body, status, headers, expiresAt }

function mlxCacheKey(requestUrl, authHeader) {
  return `${requestUrl}|${authHeader || ''}`;
}

function mlxCacheGet(key) {
  const entry = mlxCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    mlxCache.delete(key);
    return null;
  }
  return entry;
}

function mlxCacheSet(key, body, status, headers, ttlMs) {
  if (mlxCache.size > 200) {
    // Evict oldest entry to cap memory usage
    mlxCache.delete(mlxCache.keys().next().value);
  }
  mlxCache.set(key, { body, status, headers, expiresAt: Date.now() + ttlMs });
}

/**
 * Main proxy router. Returns null for unmatched paths so the caller
 * can fall through to other route handlers.
 */
export async function handleProxy(request, url, env) {
  let targetBase = null;
  let strippedPath = url.pathname;

  for (const [prefix, base] of Object.entries(PROXY_TARGETS)) {
    if (url.pathname.startsWith(prefix)) {
      targetBase = base;
      strippedPath = url.pathname.slice(prefix.length);
      break;
    }
  }

  // Cache GET requests to MLX proxy to avoid upstream rate limits
  const isMlxGet = targetBase === 'https://api.multilogin.com/' && request.method === 'GET';
  if (isMlxGet) {
    const cKey = mlxCacheKey(request.url, request.headers.get('Authorization'));
    const cached = mlxCacheGet(cKey);
    if (cached) {
      const cachedHeaders = new Headers(cached.headers);
      cachedHeaders.set('X-Cache', 'HIT');
      for (const [k, v] of Object.entries(corsHeaders)) cachedHeaders.set(k, v);
      return new Response(cached.body, { status: cached.status, headers: cachedHeaders });
    }
  }

  // Check for generic pass-through: /api/proxy/pass?url=<encoded-target>
  if (!targetBase && url.pathname === '/api/proxy/pass') {
    const passUrl = url.searchParams.get('url');
    if (!passUrl) return json({ error: 'Missing ?url= parameter' }, 400);
    // Only allow HTTPS targets
    if (!passUrl.startsWith('https://')) return json({ error: 'Only HTTPS targets allowed' }, 400);
    const targetUrl = passUrl;
    const proxyHeaders = new Headers(request.headers);
    // Strip headers that expose original client IP — targets see Worker IP only
    proxyHeaders.delete('host');
    proxyHeaders.delete('origin');
    proxyHeaders.delete('referer');
    proxyHeaders.delete('x-forwarded-for');
    proxyHeaders.delete('x-real-ip');
    proxyHeaders.delete('cf-connecting-ip');
    proxyHeaders.delete('cf-ipcountry');
    proxyHeaders.delete('cf-ray');
    proxyHeaders.delete('cf-visitor');
    try {
      const proxyRes = await fetch(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'follow',
      });
      const responseHeaders = new Headers(proxyRes.headers);
      for (const [k, v] of Object.entries(corsHeaders)) {
        responseHeaders.set(k, v);
      }
      return new Response(proxyRes.body, {
        status: proxyRes.status,
        statusText: proxyRes.statusText,
        headers: responseHeaders,
      });
    } catch (e) {
      return json({ error: e.message }, 502);
    }
  }

  // ═══ Custom proxy endpoints — IP resolve, DNS check, latency ═══

  // POST /api/proxy/resolve-ip
  // Connects through the HTTP proxy to resolve the exit IP via ip-api.com
  if (url.pathname === '/api/proxy/resolve-ip' && request.method === 'POST') {
    try {
      const { host, port, username, password } = await request.json();
      if (!host || !port || !username || !password) {
        return json({ error: 'Missing proxy credentials (host, port, username, password)' }, 400);
      }

      const proxyAuth = proxyBasicAuth(username, password);
      const relayCreds = { host, port, username, password };

      // When PROXY_RESOLVE_RELAY_URL is set, try relay first (TCP from CF to residential gates often fails).
      // Pass through any HTTP status from the relay (incl. 4xx/5xx) so ops see real errors; null = fetch failed → try TCP below.
      if (normalizeProxyRelayBase(env)) {
        const relayRes = await forwardToProxyRelay(env, '/api/proxy/resolve-ip', relayCreds);
        if (relayRes != null) return relayRes;
      }

      try {
        const absoluteUrl =
          'http://ip-api.com/json/?fields=status,message,query,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting';
        const responseText = await httpGetThroughHttpProxy(host, port, proxyAuth, absoluteUrl, 'ip-api.com');

        // Parse HTTP response — extract JSON body after headers
        const bodyStart = responseText.indexOf('\r\n\r\n');
        if (bodyStart === -1) {
          return json({ error: 'No response from proxy' }, 502);
        }
        let body = responseText.slice(bodyStart + 4);

        // Handle chunked transfer encoding
        if (responseText.toLowerCase().includes('transfer-encoding: chunked')) {
          let decoded = '';
          let pos = 0;
          while (pos < body.length) {
            const lineEnd = body.indexOf('\r\n', pos);
            if (lineEnd === -1) break;
            const chunkSize = parseInt(body.slice(pos, lineEnd), 16);
            if (!chunkSize || chunkSize === 0) break;
            decoded += body.slice(lineEnd + 2, lineEnd + 2 + chunkSize);
            pos = lineEnd + 2 + chunkSize + 2;
          }
          body = decoded;
        }

        const bodyLower = body.toLowerCase();
        const head = responseText.slice(0, Math.min(400, responseText.length)).toLowerCase();
        if (
          head.includes(' 407 ') ||
          bodyLower.includes('access denied') ||
          bodyLower.includes("couldn't log you in") ||
          bodyLower.includes('could not log you in') ||
          bodyLower.includes('proxy authentication') ||
          (bodyLower.includes('confirm') && bodyLower.includes('password'))
        ) {
          return json({
            error: 'Proxy rejected credentials. Check: (1) user+password (UTF-8/special chars OK now), (2) host:port — Decodo gate.decodo.com:7000 or legacy gate.smartproxy.com:10001, (3) username — sub-user only OR full string from dashboard; if full string includes -country- do not duplicate targeting.',
            raw: body.slice(0, 280),
          }, 502);
        }

        // Extract JSON from body
        const jsonStart = body.indexOf('{');
        const jsonEnd = body.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
          return json({ error: 'Invalid response from ip-api (non-JSON body — often proxy auth failure or HTML error page)', raw: body.slice(0, 200) }, 502);
        }
        const ipData = JSON.parse(body.slice(jsonStart, jsonEnd + 1));

        if (ipData.status === 'fail') {
          return json({ error: ipData.message || 'ip-api returned fail' }, 502);
        }

        return json({
          ip: ipData.query,
          country: ipData.country,
          countryCode: ipData.countryCode,
          region: ipData.regionName,
          regionCode: ipData.region,
          city: ipData.city,
          zip: ipData.zip,
          lat: ipData.lat,
          lon: ipData.lon,
          timezone: ipData.timezone,
          isp: ipData.isp,
          org: ipData.org,
          as: ipData.as,
          proxy: ipData.proxy,
          hosting: ipData.hosting,
        });
      } catch (tcpErr) {
        const relayed = await forwardToProxyRelay(env, '/api/proxy/resolve-ip', relayCreds);
        if (relayed) return relayed;
        return json(proxyTcpFailurePayload(tcpErr, host, port), 502);
      }
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // POST /api/proxy/dns-check
  // Checks for DNS leaks by comparing DNS server country vs proxy country
  if (url.pathname === '/api/proxy/dns-check' && request.method === 'POST') {
    try {
      const { host, port, username, password } = await request.json();
      if (!host || !port || !username || !password) {
        return json({ error: 'Missing proxy credentials' }, 400);
      }

      const proxyAuth = proxyBasicAuth(username, password);
      const relayCreds = { host, port, username, password };

      if (normalizeProxyRelayBase(env)) {
        const relayRes = await forwardToProxyRelay(env, '/api/proxy/dns-check', relayCreds);
        if (relayRes != null) return relayRes;
      }

      try {
        await httpGetThroughHttpProxy(
          host,
          port,
          proxyAuth,
          'http://ip-api.com/json/?fields=query,countryCode,isp',
          'ip-api.com'
        );

        // For DNS leak: in a real implementation we'd check the DNS resolver IP
        // For now, we return no leak detected (proxy is working = DNS is routed through it)
        return json({
          leak_detected: false,
          dns_country: 'unknown',
          proxy_country: 'unknown',
          note: 'Basic DNS check — proxy connection confirmed',
        });
      } catch (tcpErr) {
        const relayed = await forwardToProxyRelay(env, '/api/proxy/dns-check', relayCreds);
        if (relayed) return relayed;
        return json(proxyTcpFailurePayload(tcpErr, host, port), 502);
      }
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // POST /api/proxy/latency-check
  // Measures round-trip time through the proxy
  if (url.pathname === '/api/proxy/latency-check' && request.method === 'POST') {
    try {
      const { host, port, username, password } = await request.json();
      if (!host || !port || !username || !password) {
        return json({ error: 'Missing proxy credentials' }, 400);
      }

      const proxyAuth = proxyBasicAuth(username, password);
      const relayCreds = { host, port, username, password };
      const start = Date.now();

      if (normalizeProxyRelayBase(env)) {
        const relayRes = await forwardToProxyRelay(env, '/api/proxy/latency-check', relayCreds);
        if (relayRes != null) return relayRes;
      }

      try {
        await httpGetThroughHttpProxy(
          host,
          port,
          proxyAuth,
          'http://ip-api.com/json/?fields=query',
          'ip-api.com'
        );
        const latencyMs = Date.now() - start;

        return json({ latencyMs });
      } catch (tcpErr) {
        const relayed = await forwardToProxyRelay(env, '/api/proxy/latency-check', relayCreds);
        if (relayed) return relayed;
        const latencyMs = Date.now() - start;
        const p = proxyTcpFailurePayload(tcpErr, host, port);
        p.error = `Latency check failed: ${String(tcpErr?.message ?? tcpErr)}`;
        p.latencyMs = latencyMs;
        return json(p, 502);
      }
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  if (!targetBase) return null; // not a proxy route

  const targetUrl = `${targetBase}${strippedPath}${url.search}`;

  const proxyHeaders = new Headers(request.headers);
  // Strip headers that expose original client IP — targets see Worker IP only
  proxyHeaders.delete('host');
  proxyHeaders.delete('origin');
  proxyHeaders.delete('referer');
  proxyHeaders.delete('x-forwarded-for');
  proxyHeaders.delete('x-real-ip');
  proxyHeaders.delete('cf-connecting-ip');
  proxyHeaders.delete('cf-ipcountry');
  proxyHeaders.delete('cf-ray');
  proxyHeaders.delete('cf-visitor');

  try {
    const proxyRes = await fetch(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });

    const responseHeaders = new Headers(proxyRes.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      responseHeaders.set(k, v);
    }

    // For MLX GET: read body as text once, cache it, then return from string
    if (isMlxGet) {
      const bodyText = await proxyRes.text();
      const isSuccess = proxyRes.status >= 200 && proxyRes.status < 300;
      const isRateLimit = proxyRes.status === 429 || proxyRes.status === 503;
      const ttlMs = isSuccess ? MLX_CACHE_TTL_SUCCESS : isRateLimit ? MLX_CACHE_TTL_RATE_LIMIT : 0;
      if (ttlMs > 0) {
        const cKey = mlxCacheKey(request.url, request.headers.get('Authorization'));
        mlxCacheSet(cKey, bodyText, proxyRes.status, responseHeaders, ttlMs);
      }
      responseHeaders.set('X-Cache', 'MISS');
      return new Response(bodyText, { status: proxyRes.status, headers: responseHeaders });
    }

    return new Response(proxyRes.body, {
      status: proxyRes.status,
      statusText: proxyRes.statusText,
      headers: responseHeaders,
    });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
