// ============================================================
// Cloudflare Worker — FusionOps Callback Engine
// ============================================================
// Routes:
//   POST /callback/:account_id/leadsgate  — LeadsGate callback
//   POST /track                           — Beacon tracking endpoint
//   GET  /health                          — Health check
// ============================================================

import type { Env } from './types';
import { handleLeadsGateCallback } from './handlers/callback';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- CORS preflight ---
    if (request.method === 'OPTIONS') {
      return handleCors(request);
    }

    // --- Health check ---
    if (path === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        status: 200,
        headers: corsHeaders(request),
      });
    }

    // --- Beacon tracking endpoint (internal API) ---
    if (path === '/track' && request.method === 'POST') {
      return handleTrack(request, env, ctx);
    }

    // --- First-party pixel endpoint (LP sendBeacon → t.{domain}/e) ---
    if (path === '/e' && (request.method === 'POST' || request.method === 'GET')) {
      return handlePixel(request, env, ctx);
    }

    // --- LeadsGate callback ---
    const callbackMatch = path.match(/^\/callback\/([a-zA-Z0-9_-]+)\/leadsgate$/);
    if (callbackMatch && request.method === 'POST') {
      const accountId = callbackMatch[1];
      try {
        const response = await handleLeadsGateCallback(request, env, accountId);
        // Attach CORS headers to response
        const headers = new Headers(response.headers);
        for (const [key, value] of Object.entries(corsHeaders(request))) {
          headers.set(key, value);
        }
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      } catch (err) {
        console.error('Unhandled callback error:', err);
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            headers: corsHeaders(request),
          }
        );
      }
    }

    // --- 404 --- Vary error messages per domain
    const hostname = url.hostname;
    const errorMessages = [
      { error: 'Not found' },
      { error: 'Resource not found' },
      { error: '404 - Endpoint not found' },
      { message: 'The requested resource was not found' },
      { status: 'error', message: 'Not found' },
    ];
    const msgIndex = hostname.split('').reduce((acc: number, char) => acc + char.charCodeAt(0), 0) % errorMessages.length;
    
    return new Response(JSON.stringify(errorMessages[msgIndex]), {
      status: 404,
      headers: corsHeaders(request),
    });
  },
} satisfies ExportedHandler<Env>;

// ============================================================
// Beacon Tracking Handler
// ============================================================
// Accepts lightweight event beacons from the lander.
// Stores nothing with PII. Fire-and-forget via waitUntil.
// ============================================================

async function handleTrack(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Add random delay (0-8ms) to vary response timing
  const randomDelay = Math.random() * 8;
  await new Promise(resolve => setTimeout(resolve, randomDelay));

  // Immediately return 204 — don't block the beacon
  const response = new Response(null, { status: 204, headers: corsHeaders(request) });

  // Process async via waitUntil so we don't delay the response
  ctx.waitUntil(
    (async () => {
      try {
        const body = await request.text();
        const data = JSON.parse(body);

        // Validate required fields
        if (!data.event || !data.click_id) {
          return;
        }

        // Add random DB delay (0-5ms) to vary database timing patterns
        const dbDelay = Math.random() * 5;
        await new Promise(resolve => setTimeout(resolve, dbDelay));

        // Log to D1 — no PII, only tracking identifiers
        await env.DB
          .prepare(
            `INSERT INTO lead_callbacks (account_id, type, click_id, raw_payload)
             VALUES (?, ?, ?, ?)`
          )
          .bind(
            data.account_id || 'unknown',
            `track:${data.event}`,
            data.click_id,
            body
          )
          .run();
      } catch {
        // Fire-and-forget: swallow errors for beacon tracking
      }
    })()
  );

  return response;
}

// ============================================================
// First-Party Pixel Handler
// ============================================================
// Accepts sendBeacon events from LP pages at t.{domain}/e
// Payload: URLSearchParams with e, sid, cid, gid, ts, url, ref
// Returns 204 immediately — processes async via waitUntil
// ============================================================

async function handlePixel(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Return 204 immediately — never block the beacon
  const response = new Response(null, { status: 204, headers: corsHeaders(request) });

  ctx.waitUntil(
    (async () => {
      try {
        let params: URLSearchParams;
        if (request.method === 'POST') {
          const body = await request.text();
          // sendBeacon sends URLSearchParams or JSON
          try {
            params = new URLSearchParams(body);
          } catch {
            const data = JSON.parse(body);
            params = new URLSearchParams(data);
          }
        } else {
          params = new URL(request.url).searchParams;
        }

        const event = params.get('e') || 'unknown';
        const sid = params.get('sid') || '';
        const cid = params.get('cid') || '';
        const gid = params.get('gid') || '';
        const ts = params.get('ts') || String(Date.now());
        const pageUrl = params.get('url') || '';
        const hostname = new URL(request.url).hostname;

        const payload = JSON.stringify({ e: event, sid, cid, gid, ts, url: pageUrl, domain: hostname });

        await env.DB
          .prepare(
            `INSERT INTO lead_callbacks (account_id, type, click_id, raw_payload)
             VALUES (?, ?, ?, ?)`
          )
          .bind(hostname, `pixel:${event}`, cid || sid, payload)
          .run();
      } catch {
        // Fire-and-forget: swallow errors
      }
    })()
  );

  return response;
}

// ============================================================
// CORS Utilities
// ============================================================

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';
  const hostname = new URL(request.url).hostname;
  
  // Vary server header based on domain to prevent fingerprinting
  const serverVariants = [
    'nginx/1.22.1',
    'Apache/2.4.54',
    'cloudflare',
    'nginx/1.24.0',
    'LiteSpeed',
  ];
  const serverIndex = hostname.split('').reduce((acc: number, char) => acc + char.charCodeAt(0), 0) % serverVariants.length;
  const serverHeader = serverVariants[serverIndex];
  
  // Vary max-age slightly
  const maxAgeVariants = ['86400', '43200', '3600'];
  const maxAgeIndex = (serverIndex + 2) % maxAgeVariants.length;
  
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Callback-Token',
    'Access-Control-Max-Age': maxAgeVariants[maxAgeIndex],
    'Server': serverHeader,
    'X-Content-Type-Options': 'nosniff',
  };
}

function handleCors(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}
