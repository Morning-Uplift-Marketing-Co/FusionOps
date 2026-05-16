/**
 * FBIS Relay Worker — deployed to t.sysassets-core-delivery.com
 *                                    s.scratchpetfinancing.com
 * ─────────────────────────────────────────────────────────────
 * Transparent relay: Google Ads Script → FBIS API
 *
 * Auth: payload must contain _k field matching SYNC_SECRET env var.
 *       _k is stripped before forwarding so it never reaches FBIS API.
 */

const TARGET =
  'https://lp-factory-api.misty-feather-556e.workers.dev/api/analysis/accounts/sync';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('', { status: 204 });
    }

    // Parse JSON to validate secret
    let parsed;
    try {
      parsed = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'bad_body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // ── Auth check ────────────────────────────────────────────────────────────
    const secret = env.SYNC_SECRET;
    if (secret && parsed._k !== secret) {
      // Return 204 (not 401) to avoid revealing endpoint purpose
      return new Response('', { status: 204 });
    }

    // Strip _k before forwarding
    const { _k: _removed, ...clean } = parsed;

    // Jitter: 1.5–4.5 s
    await new Promise((r) => setTimeout(r, 1500 + Math.floor(Math.random() * 3000)));

    let upstream;
    try {
      const apiKey = env.FBIS_API_KEY || env.API_SECRET || env.FUSIONOPS_API_KEY || '';
      const upstreamHeaders = {
        'Content-Type': 'application/json',
        'Origin': env.FBIS_API_ORIGIN || 'https://fusionops-web.pages.dev',
      };
      if (apiKey) {
        upstreamHeaders.Authorization = `Bearer ${apiKey}`;
      }

      upstream = await fetch(TARGET, {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify(clean),
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'upstream_error', detail: String(err) }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } }
      );
    }

    const data = await upstream.text();
    return new Response(data, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  },
};
