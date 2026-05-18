// ============================================================
// Cloudflare Worker - FusionOps First-Party Pixel
// ============================================================
// Endpoint: POST /e
// Receives sendBeacon payloads from LP tracking-pixel.js
// Stores events in D1 pixel_events table.
// Deployed to t.{domain} via CNAME -> pixel-worker.{cf}.workers.dev
//
// Bot Detection: every /e POST also runs 4-signal bot detection
// and records to bot_visits table for GUARDIAN agent analysis.
// ============================================================

import { detectBot, recordBotVisit } from './bot-detect';

interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
}

const MAX_PIXEL_BODY_BYTES = 64 * 1024;
const PIXEL_ASYNC_ERROR = 'pixel_worker_async_error';

const PIXEL_EVENT_ALIASES: Record<string, string> = {
  pv: 'pv',
  page_view: 'pv',
  pageview: 'pv',
  fl: 'form_start',
  form_load: 'form_start',
  leadsgate_form_start: 'form_start',
  lg_form_load: 'form_start',
  lg_form_ready: 'form_start',
  form_start: 'form_start',
  fs: 'form_submit',
  leadsgate_form_submit: 'form_submit',
  lg_submit: 'form_submit',
  form_submit: 'form_submit',
  step: 'step_change',
  leadsgate_form_progress: 'step_change',
  lg_step: 'step_change',
  step_change: 'step_change',
  success: 'success',
  lg_success_all: 'success',
  lg_success: 'sold_lead',
  soldlead: 'sold_lead',
  sold_lead: 'sold_lead',
  lead_conversion_approved: 'sold_lead',
  amt: 'amount_selected',
  amount_selected: 'amount_selected',
  ze: 'zip_entered',
  zip_entered: 'zip_entered',
  t30: 'time_on_page_30s',
  t60: 'time_on_page_60s',
  top_30s: 'time_on_page_30s',
  top_60s: 'time_on_page_60s',
  n1: 'pv',
  n2: 'form_start',
  n3: 'form_submit',
  n4: 'sold_lead',
  n5: 'step_change',
  n6: 'success',
  n7: 'amount_selected',
  n8: 'zip_entered',
  n9: 'time_on_page_30s',
  n10: 'time_on_page_60s',
  n11: 'scroll_25',
  n12: 'scroll_50',
  n13: 'scroll_75',
  n14: 'scroll_100',
};

function canonicalPixelEvent(rawEvent: string): string {
  const value = String(rawEvent || '').trim().toLowerCase();
  if (!value) return 'unknown';
  if (PIXEL_EVENT_ALIASES[value]) return PIXEL_EVENT_ALIASES[value];
  const shortScrollMatch = value.match(/^s(25|50|75|100)$/);
  if (shortScrollMatch) return `scroll_${shortScrollMatch[1]}`;
  const longScrollMatch = value.match(/^scroll_(25|50|75|100)$/);
  if (longScrollMatch) return `scroll_${longScrollMatch[1]}`;
  const scrollPctMatch = value.match(/^scroll_(25|50|75|100)%$/);
  if (scrollPctMatch) return `scroll_${scrollPctMatch[1]}`;
  if (value === 'time_on_page_30s') return 'time_on_page_30s';
  if (value === 'time_on_page_60s') return 'time_on_page_60s';
  return value;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const allowedOrigins = getPixelAllowedOrigins(request);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, allowedOrigins),
      });
    }

    // Health check
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'pixel', ts: Date.now() }), {
        status: 200,
        headers: corsHeaders(request, allowedOrigins),
      });
    }

    // Pixel endpoint - POST /e (sendBeacon) or GET /e (legacy image pixel)
    if (url.pathname === '/e' && request.method === 'POST') {
      return handlePixelEvent(request, env, ctx, allowedOrigins);
    }
    if (url.pathname === '/e' && request.method === 'GET') {
      return new Response(null, { status: 204, headers: corsHeaders(request, allowedOrigins) });
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
      headers: corsHeaders(request, allowedOrigins),
    });
  },
} satisfies ExportedHandler<Env>;

// ============================================================
// Pixel Event Handler
// ============================================================
// Immediately returns 204 - processing happens via waitUntil
// so sendBeacon is never blocked.
// ============================================================

async function handlePixelEvent(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  allowedOrigins: string[]
): Promise<Response> {
  const declaredLength = parseContentLength(request);
  if (declaredLength !== null && declaredLength > MAX_PIXEL_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), {
      status: 413,
      headers: corsHeaders(request, allowedOrigins),
    });
  }

  // Read body up-front; request stream may be unavailable inside waitUntil.
  let requestBody = '';
  try {
    requestBody = await request.text();
  } catch (error) {
    logPixelWorkerError({
      stage: 'read_body',
      request,
      error,
    });
    requestBody = '';
  }

  if (byteLength(requestBody) > MAX_PIXEL_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), {
      status: 413,
      headers: corsHeaders(request, allowedOrigins),
    });
  }

  const response = new Response('', {
    status: 204,
    headers: corsHeaders(request, allowedOrigins),
  });

  ctx.waitUntil(
    (async () => {
      let stage = 'parse_payload';
      let event = 'unknown';
      let clickId = '';
      let domain = '';
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

        const rawEvent = payload.e || payload.event || '';
        if (!rawEvent) return; // Invalid payload - silently discard
        event = canonicalPixelEvent(rawEvent);

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

        clickId = payload.cid || payload.click_id || payload.clickId || payload.cpid || '';
        const gclid = payload.gid || payload.gclid || '';
        const ts = payload.ts || payload.timestamp || String(Math.floor(Date.now() / 1000));
        const urlValue = payload.url || payload.current_url || '';
        const refValue = payload.ref || payload.referrer || '';
        const domainValue = payload.d || payload.domain || new URL(request.url).hostname.replace(/^t\./, '');
        domain = domainValue;

        stage = 'db_write';
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

        // ============================================================
        // Bot Detection — runs on every pixel event (verbose mode)
        // Records all confirmed bots (score >= 0.5) for GUARDIAN
        // ============================================================
        stage = 'bot_detection';
        try {
          const reqUrl = new URL(request.url);
          const botResult = await detectBot(request, reqUrl, env);
          // Record any visit with score >= 0.5 (medium confidence+)
          if (botResult.composite_score >= 0.5) {
            await recordBotVisit(env.DB, botResult, {
              url: urlValue,
              path: reqUrl.pathname,
              site_domain: domainValue,
              campaign_id: payload.campaign || payload.cid || '',
              visit_id: payload.sid || payload.session_id || '',
            });
          }
        } catch (botErr) {
          // Bot detection failures should NOT block pixel writes
          console.error('bot_detection_error', {
            stage: 'bot_detection',
            message: toErrorMessage(botErr),
          });
        }
      } catch (error) {
        logPixelWorkerError({
          stage,
          request,
          error,
          event,
          clickId,
          domain,
        });
      }
    })()
  );

  return response;
}

// ============================================================
// CORS Utilities
// ============================================================

function parseContentLength(request: Request): number | null {
  const header = request.headers.get('Content-Length');
  if (!header) return null;
  const parsed = Number(header);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function normalizeOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).origin.toLowerCase();
  } catch {
    return null;
  }
}

function getPixelAllowedOrigins(request: Request): string[] {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const allowed = new Set<string>();

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    allowed.add('http://localhost:3000');
    allowed.add('http://localhost:4321');
    allowed.add('http://127.0.0.1:3000');
    allowed.add('http://127.0.0.1:4321');
    return [...allowed];
  }

  allowed.add(`https://${hostname}`);

  if (hostname.startsWith('t.')) {
    const root = hostname.slice(2);
    allowed.add(`https://${root}`);
    allowed.add(`https://www.${root}`);
    allowed.add(`https://lp.${root}`);
  }

  return [...allowed];
}

function corsHeaders(request: Request, allowedOrigins: string[]): Record<string, string> {
  const hostname = new URL(request.url).hostname;
  const normalizedOrigin = normalizeOrigin(request.headers.get('Origin'));
  const normalizedAllowlist = new Set(allowedOrigins.map(origin => origin.toLowerCase()));

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

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Server': serverHeader,
    'X-Powered-By': poweredByVariants[poweredByIndex],
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

function logPixelWorkerError(input: {
  stage: string;
  request: Request;
  error: unknown;
  event?: string;
  clickId?: string;
  domain?: string;
}): void {
  const url = new URL(input.request.url);
  console.error(PIXEL_ASYNC_ERROR, {
    flow: 'pixel_worker',
    stage: input.stage,
    event: input.event || 'unknown',
    click_id: input.clickId || '',
    domain: input.domain || '',
    path: url.pathname,
    host: url.hostname,
    message: toErrorMessage(input.error),
    timestamp: new Date().toISOString(),
  });
}
