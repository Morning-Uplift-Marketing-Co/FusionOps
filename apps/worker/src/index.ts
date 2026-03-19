// ============================================================
// Cloudflare Worker - FusionOps Callback Engine
// ============================================================
// Routes:
//   POST /callback/:account_id/leadsgate  - LeadsGate callback
//   POST /track                           - Beacon tracking endpoint
//   GET  /health                          - Health check
// ============================================================

import type { Env } from './types';
import { handleLeadsGateCallback } from './handlers/callback';

const CALLBACK_ROUTE_REGEX = /^\/callback\/([a-zA-Z0-9_-]+)\/leadsgate$/;
const TRACKING_ASYNC_ERROR = 'worker_tracking_async_error';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- CORS preflight ---
    if (request.method === 'OPTIONS') {
      return handleCors(request, env);
    }

    // --- Health check ---
    if (path === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        status: 200,
        headers: corsHeaders(request, getDefaultAllowedOrigins(request)),
      });
    }

    // --- Beacon tracking endpoint (internal API) ---
    if (path === '/track' && request.method === 'POST') {
      return handleTrack(request, env, ctx);
    }

    // --- First-party pixel endpoint (LP sendBeacon -> t.{domain}/e) ---
    if (path === '/e' && (request.method === 'POST' || request.method === 'GET')) {
      return handlePixel(request, env, ctx);
    }

    // --- LeadsGate callback ---
    const callbackMatch = path.match(CALLBACK_ROUTE_REGEX);
    if (callbackMatch && request.method === 'POST') {
      const accountId = callbackMatch[1];
      const allowedOrigins = await getCallbackAllowedOrigins(env, accountId);

      try {
        const response = await handleLeadsGateCallback(request, env, accountId);
        const headers = new Headers(response.headers);
        for (const [key, value] of Object.entries(corsHeaders(request, allowedOrigins))) {
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
            headers: corsHeaders(request, allowedOrigins),
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
      headers: corsHeaders(request, getDefaultAllowedOrigins(request)),
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
  const allowedOrigins = getDefaultAllowedOrigins(request);

  // Immediately return 204 - don't block the beacon
  const response = new Response(null, { status: 204, headers: corsHeaders(request, allowedOrigins) });

  // Process async via waitUntil so we don't delay the response
  ctx.waitUntil(
    (async () => {
      let stage = 'parse_body';
      let parsedEvent = 'unknown';
      let parsedClickId = '';
      let parsedAccountId = 'unknown';
      try {
        const body = await request.text();
        stage = 'parse_json';
        const data = JSON.parse(body);

        // Validate required fields
        if (!data.event || !data.click_id) {
          return;
        }
        parsedEvent = String(data.event);
        parsedClickId = String(data.click_id);
        parsedAccountId = String(data.account_id || 'unknown');

        // Log to D1 - no PII, only tracking identifiers
        stage = 'db_write';
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
      } catch (error) {
        logWorkerAsyncError({
          flow: 'track',
          stage,
          request,
          error,
          accountId: parsedAccountId,
          event: parsedEvent,
          clickId: parsedClickId,
        });
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
// Returns 204 immediately - processes async via waitUntil
// ============================================================

async function handlePixel(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const allowedOrigins = getDefaultAllowedOrigins(request);
  // Return 204 immediately - never block the beacon
  const response = new Response(null, { status: 204, headers: corsHeaders(request, allowedOrigins) });

  ctx.waitUntil(
    (async () => {
      let stage = 'parse_payload';
      let event = 'unknown';
      let clickId = '';
      let accountId = '';
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

        event = params.get('e') || 'unknown';
        const sid = params.get('sid') || '';
        const cid = params.get('cid') || '';
        clickId = cid || sid;
        const gid = params.get('gid') || '';
        const ts = params.get('ts') || String(Date.now());
        const pageUrl = params.get('url') || '';
        const hostname = new URL(request.url).hostname;
        accountId = hostname;

        const payload = JSON.stringify({ e: event, sid, cid, gid, ts, url: pageUrl, domain: hostname });

        stage = 'db_write';
        await env.DB
          .prepare(
            `INSERT INTO lead_callbacks (account_id, type, click_id, raw_payload)
             VALUES (?, ?, ?, ?)`
          )
          .bind(hostname, `pixel:${event}`, cid || sid, payload)
          .run();
      } catch (error) {
        logWorkerAsyncError({
          flow: 'pixel_proxy',
          stage,
          request,
          error,
          accountId,
          event,
          clickId,
        });
      }
    })()
  );

  return response;
}

// ============================================================
// CORS Utilities
// ============================================================

function normalizeOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

function domainToOrigins(domainValue: string): string[] {
  const domain = domainValue.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain) return [];
  const origins = new Set<string>();
  origins.add(`https://${domain}`);
  if (!domain.startsWith('www.')) origins.add(`https://www.${domain}`);
  return [...origins];
}

function getRootDomain(hostname: string): string | null {
  const parts = hostname.toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0] === 'api' || parts[0] === 't' || parts[0] === 'lp') {
    return parts.slice(1).join('.');
  }
  return null;
}

function getDefaultAllowedOrigins(request: Request): string[] {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const allowed = new Set<string>();

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    allowed.add('http://localhost:3000');
    allowed.add('http://localhost:4321');
    allowed.add('http://127.0.0.1:3000');
    allowed.add('http://127.0.0.1:4321');
  } else {
    allowed.add(`https://${hostname}`);
    const rootDomain = getRootDomain(hostname);
    if (rootDomain) {
      for (const origin of domainToOrigins(rootDomain)) {
        allowed.add(origin);
      }
      allowed.add(`https://lp.${rootDomain}`);
      allowed.add(`https://t.${rootDomain}`);
    }
  }

  return [...allowed];
}

async function getCallbackAllowedOrigins(env: Env, accountId: string): Promise<string[]> {
  try {
    const account = await env.DB
      .prepare('SELECT domains FROM accounts WHERE account_id = ?')
      .bind(accountId)
      .first<{ domains: string }>();
    if (!account?.domains) return [];

    const parsed = JSON.parse(account.domains);
    if (!Array.isArray(parsed)) return [];

    const allowed = new Set<string>();
    for (const domain of parsed) {
      if (typeof domain !== 'string') continue;
      for (const origin of domainToOrigins(domain)) {
        allowed.add(origin);
      }
      const root = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (root) allowed.add(`https://lp.${root}`);
    }

    return [...allowed];
  } catch {
    return [];
  }
}

function corsHeaders(request: Request, allowedOrigins: string[]): Record<string, string> {
  const hostname = new URL(request.url).hostname;
  const normalizedOrigin = normalizeOrigin(request.headers.get('Origin'));
  const normalizedAllowlist = new Set(allowedOrigins.map(origin => origin.toLowerCase()));

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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Callback-Token',
    'Access-Control-Max-Age': maxAgeVariants[maxAgeIndex],
    'Server': serverHeader,
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  };

  if (normalizedOrigin && normalizedAllowlist.has(normalizedOrigin)) {
    headers['Access-Control-Allow-Origin'] = normalizedOrigin;
  }

  return headers;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function logWorkerAsyncError(input: {
  flow: string;
  stage: string;
  request: Request;
  error: unknown;
  accountId?: string;
  event?: string;
  clickId?: string;
}): void {
  const url = new URL(input.request.url);
  console.error(TRACKING_ASYNC_ERROR, {
    flow: input.flow,
    stage: input.stage,
    account_id: input.accountId || 'unknown',
    event: input.event || 'unknown',
    click_id: input.clickId || '',
    path: url.pathname,
    host: url.hostname,
    message: toErrorMessage(input.error),
    timestamp: new Date().toISOString(),
  });
}

async function handleCors(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const callbackMatch = url.pathname.match(CALLBACK_ROUTE_REGEX);
  const allowedOrigins = callbackMatch
    ? await getCallbackAllowedOrigins(env, callbackMatch[1])
    : getDefaultAllowedOrigins(request);

  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, allowedOrigins),
  });
}
