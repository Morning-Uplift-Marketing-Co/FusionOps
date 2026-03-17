// ============================================================
// Cloudflare Worker — FusionOps First-Party Pixel
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

    // Pixel endpoint — POST /e (sendBeacon) or GET /e (legacy image pixel)
    if (url.pathname === '/e' && request.method === 'POST') {
      return handlePixelEvent(request, env, ctx);
    }
    if (url.pathname === '/e' && request.method === 'GET') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Vary 404 messages per domain to prevent fingerprinting
    const hostname = url.hostname;
    const errorMessages = [
      'Not Found',
      'Page Not Found',
      '404 - Resource Not Found',
      'The requested URL was not found on this server.',
      '',
    ];
    const msgIndex = hostname.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % errorMessages.length;
    
    return new Response(errorMessages[msgIndex], { 
      status: 404,
      headers: corsHeaders(request),
    });
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
  // Add random delay (0-8ms) to vary response timing per request
  const randomDelay = Math.random() * 8;
  await new Promise(resolve => setTimeout(resolve, randomDelay));

  // Read body up-front; request stream may be unavailable inside waitUntil.
  let requestBody = '';
  try {
    requestBody = await request.text();
  } catch {
    requestBody = '';
  }

  const response = new Response('', {
    status: 204,
    headers: corsHeaders(request),
  });

  ctx.waitUntil(
    (async () => {
      try {
        const body = requestBody;
        let payload: Record<string, string> = {};

        // Beacon payload can be either JSON (current LP templates)
        // or urlencoded form data (legacy senders).
        try {
          const parsed = JSON.parse(body);
          if (parsed && typeof parsed === 'object') {
            for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
              payload[key] = String(value ?? '');
            }
          }
        } catch {
          const params = new URLSearchParams(body);
          for (const [key, value] of params.entries()) {
            payload[key] = value;
          }
        }

        const event = payload.e || payload.event;
        if (!event) return; // Invalid payload — silently discard

        // Add random DB delay (0-5ms) to vary database timing patterns
        const dbDelay = Math.random() * 5;
        await new Promise(resolve => setTimeout(resolve, dbDelay));

        // Ensure table exists (idempotent) so first traffic does not fail silently
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS pixel_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event TEXT NOT NULL,
            session_id TEXT DEFAULT '',
            click_id TEXT DEFAULT '',
            gclid TEXT DEFAULT '',
            timestamp TEXT DEFAULT '',
            url TEXT DEFAULT '',
            referrer TEXT DEFAULT '',
            domain TEXT DEFAULT '',
            details TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
          )`
        ).run();

        const clickId = payload.cid || payload.click_id || payload.clickId || payload.cpid || '';
        const gclid = payload.gid || payload.gclid || '';
        const ts = payload.ts || payload.timestamp || String(Math.floor(Date.now() / 1000));
        const urlValue = payload.url || payload.current_url || '';
        const refValue = payload.ref || payload.referrer || '';
        const domainValue = payload.d || payload.domain || new URL(request.url).hostname.replace(/^t\./, '');

        await env.DB.prepare(
          `INSERT INTO pixel_events (event, session_id, click_id, gclid, timestamp, url, referrer, domain, details, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          event,
          payload.sid || payload.session_id || '',
          clickId,
          gclid,
          ts,
          urlValue,
          refValue,
          domainValue,
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
  const hostname = new URL(request.url).hostname;
  
  // Vary server header based on domain to prevent fingerprinting
  const serverVariants = [
    'cloudflare',
    'nginx/1.18.0',
    'nginx/1.20.1', 
    'nginx/1.21.6',
    'Apache/2.4.41',
  ];
  const serverIndex = hostname.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % serverVariants.length;
  const serverHeader = serverVariants[serverIndex];
  
  // Vary X-Powered-By based on domain
  const poweredByVariants = ['Express', 'PHP/8.1.0', 'ASP.NET', hostname];
  const poweredByIndex = (serverIndex + 1) % poweredByVariants.length;
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Server': serverHeader,
    'X-Powered-By': poweredByVariants[poweredByIndex],
    'X-Content-Type-Options': 'nosniff',
  };
}
