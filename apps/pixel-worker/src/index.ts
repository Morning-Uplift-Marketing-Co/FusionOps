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

    // Pixel endpoint — POST /e
    if (url.pathname === '/e' && request.method === 'POST') {
      return handlePixelEvent(request, env, ctx);
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

  const response = new Response('', {
    status: 204,
    headers: corsHeaders(request),
  });

  ctx.waitUntil(
    (async () => {
      try {
        const body = await request.text();
        const params = new URLSearchParams(body);

        const event = params.get('e');
        if (!event) return; // Invalid payload — silently discard

        // Add random DB delay (0-5ms) to vary database timing patterns
        const dbDelay = Math.random() * 5;
        await new Promise(resolve => setTimeout(resolve, dbDelay));

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
