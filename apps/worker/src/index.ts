// ============================================================
// Cloudflare Worker — LP Factory Callback Engine
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

    // --- Beacon tracking endpoint ---
    if (path === '/track' && request.method === 'POST') {
      return handleTrack(request, env, ctx);
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

    // --- 404 ---
    return new Response(JSON.stringify({ error: 'Not found' }), {
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
// CORS Utilities
// ============================================================

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Callback-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function handleCors(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}
