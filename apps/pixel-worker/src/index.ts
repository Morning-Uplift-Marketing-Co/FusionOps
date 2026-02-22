// ============================================================
// Cloudflare Worker — LP Factory First-Party Pixel
// ============================================================
// Endpoint: POST /e
// Receives sendBeacon payloads from LP tracking-pixel.js
// Stores events in D1 pixel_events table.
// Deployed to t.{domain} via CNAME → pixel-worker.{cf}.workers.dev
// ============================================================

interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    // Health check
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'pixel', ts: Date.now() }), {
        status: 200,
        headers: corsHeaders(request),
      });
    }

    // Pixel endpoint — POST /e
    if (url.pathname === '/e' && request.method === 'POST') {
      return handlePixelEvent(request, env, ctx);
    }

    return new Response('', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

// ============================================================
// Pixel Event Handler
// ============================================================
// Immediately returns 204 — processing happens via waitUntil
// so sendBeacon is never blocked.
// ============================================================

async function handlePixelEvent(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const response = new Response('', {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });

  ctx.waitUntil(
    (async () => {
      try {
        const body = await request.text();
        const params = new URLSearchParams(body);

        const event = params.get('e');
        if (!event) return; // Invalid payload — silently discard

        await env.DB.prepare(
          `INSERT INTO pixel_events (event, session_id, click_id, gclid, timestamp, url, referrer, domain, details, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          event,
          params.get('sid') || '',
          params.get('cid') || '',
          params.get('gid') || '',
          params.get('ts') || '',
          params.get('url') || '',
          params.get('ref') || '',
          new URL(request.url).hostname.replace(/^t\./, ''), // Strip t. prefix → actual domain
          body
        ).run();
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
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
  };
}
