// ============================================================
// Misc small routes for FusionOps API Worker
// ============================================================
// Routes:
//   GET  /api/cfg                        Site config lookup (obfuscated aid by domain)
//   GET  /api/postbacks                  Voluum postback log query (delegates to pixel-tracking)
//   POST /api/provision-domain-dns       Auto-provision DNS records for new LP domain
//   POST /api/deploy/vps                 Stash HTML for VPS rsync (returns instructions)
//   GET  /api/deploy/vps/download/:id    Fetch stashed HTML for VPS rsync
//   POST /api/ai/generate-assets         Generate logo/hero image via Gemini + pollinations.ai
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json, corsHeaders } from '../lib/http.js';
import { resolveCloudflareAccount } from '../lib/cloudflare.js';
import { handleVoluumPostbacksApiGet } from './pixel-tracking.js';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

async function handleCfg({ db, url }) {
  try {
    const domain = url.searchParams.get('d') || '';
    if (!domain) return json({ error: 'Missing d param' }, 400);
    const row = await db.prepare(
      `SELECT data FROM sites WHERE id = ? OR json_extract(data, '$.domain') = ? LIMIT 1`
    ).bind(domain, domain).first();
    const data = row?.data ? JSON.parse(row.data) : null;
    const aid = data?.aid || '';
    if (!aid) return json({ error: 'Not found' }, 404);
    // Return only what's needed — single char key to minimize fingerprinting
    return json({ a: aid });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleProvisionDomainDns({ request, db }) {
  try {
    const body = await request.json();
    const { domain, pagesHost } = body;
    if (!domain || !pagesHost) return json({ error: 'domain and pagesHost required' }, 400);

    const cleanDomain = String(domain).trim().toLowerCase().replace(/^www\./, '');

    // Look up domain → cf_account_id from ops_domains
    const domainRow = await db.prepare(
      'SELECT cf_account_id, zone_id FROM ops_domains WHERE domain = ? OR domain = ? LIMIT 1'
    ).bind(cleanDomain, `www.${cleanDomain}`).first().catch(() => null);

    const cfAccountRef = domainRow?.cf_account_id || '';
    if (!cfAccountRef) {
      return json({ error: `No CF account linked to ${cleanDomain} in ops_domains`, code: 'NO_CF_ACCOUNT' }, 404);
    }

    const cfRow = await resolveCloudflareAccount(db, cfAccountRef);
    if (!cfRow?.api_token || !cfRow?.account_id) {
      return json({ error: `CF account ${cfAccountRef} has no api_token in cf_accounts`, code: 'NO_CF_TOKEN' }, 404);
    }

    const cfToken = cfRow.api_token;
    const cfAccountId = cfRow.account_id;
    const cfHeaders = { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' };

    // Get or create zone
    let zoneId = domainRow?.zone_id || '';
    if (!zoneId) {
      const zoneRes = await fetch(
        `${CF_API_BASE}/zones?name=${encodeURIComponent(cleanDomain)}&account.id=${encodeURIComponent(cfAccountId)}`,
        { headers: cfHeaders }
      );
      const zoneData = await zoneRes.json().catch(() => ({}));
      zoneId = zoneData?.result?.[0]?.id || '';
    }
    if (!zoneId) {
      return json({ error: `Zone not found for ${cleanDomain}`, code: 'NO_ZONE' }, 404);
    }

    // Upsert DNS records: @, www → pagesHost (CNAME), t., link. → 192.0.2.1 (A)
    const records = [
      { type: 'CNAME', name: cleanDomain, content: pagesHost, proxied: true },
      { type: 'CNAME', name: `www.${cleanDomain}`, content: pagesHost, proxied: true },
      { type: 'A', name: `t.${cleanDomain}`, content: '192.0.2.1', proxied: true },
      { type: 'A', name: `link.${cleanDomain}`, content: '192.0.2.1', proxied: true },
    ];

    const results = [];
    for (const rec of records) {
      try {
        // Check existing
        const listRes = await fetch(
          `${CF_API_BASE}/zones/${zoneId}/dns_records?name=${encodeURIComponent(rec.name)}&type=${rec.type}`,
          { headers: cfHeaders }
        );
        const listData = await listRes.json().catch(() => ({}));
        const existing = (listData?.result || [])[0];

        if (existing && existing.content === rec.content) {
          results.push({ name: rec.name, status: 'exists' });
          continue;
        }

        // Delete conflicting records (A/AAAA/CNAME)
        const allRecs = await fetch(
          `${CF_API_BASE}/zones/${zoneId}/dns_records?name=${encodeURIComponent(rec.name)}`,
          { headers: cfHeaders }
        );
        const allData = await allRecs.json().catch(() => ({}));
        for (const old of (allData?.result || []).filter(r => ['A', 'AAAA', 'CNAME'].includes(r.type))) {
          await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records/${old.id}`, {
            method: 'DELETE', headers: cfHeaders,
          });
        }

        // Create
        const createRes = await fetch(
          `${CF_API_BASE}/zones/${zoneId}/dns_records`,
          {
            method: 'POST', headers: cfHeaders,
            body: JSON.stringify({ type: rec.type, name: rec.name, content: rec.content, proxied: rec.proxied, ttl: 1 }),
          }
        );
        const createData = await createRes.json().catch(() => ({}));
        results.push({ name: rec.name, status: createData?.success ? 'created' : 'error', error: createData?.errors?.[0]?.message });
      } catch (e) {
        results.push({ name: rec.name, status: 'error', error: e.message });
      }
    }

    // Also set up Workers Route for t.{domain}/* → lp-factory-api
    let routeStatus = 'skipped';
    try {
      const routeListRes = await fetch(
        `${CF_API_BASE}/zones/${zoneId}/workers/routes`,
        { headers: cfHeaders }
      );
      const routeListData = await routeListRes.json().catch(() => ({}));
      const pattern = `t.${cleanDomain}/*`;
      const existingRoute = (routeListData?.result || []).find(r => r.pattern === pattern);
      if (existingRoute) {
        routeStatus = 'exists';
      } else {
        const routeRes = await fetch(
          `${CF_API_BASE}/zones/${zoneId}/workers/routes`,
          {
            method: 'POST', headers: cfHeaders,
            body: JSON.stringify({ pattern, script: 'lp-factory-api' }),
          }
        );
        const routeData = await routeRes.json().catch(() => ({}));
        routeStatus = routeData?.success ? 'created' : `error: ${routeData?.errors?.[0]?.message || 'unknown'}`;
      }
    } catch (e) {
      routeStatus = `error: ${e.message}`;
    }

    return json({ success: true, domain: cleanDomain, zoneId, records: results, workerRoute: routeStatus });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleVpsDeploy({ request, env, url }) {
  // CF Workers cannot open SSH connections.
  // This endpoint writes the HTML to D1 for download, then returns
  // instructions for the user to rsync it manually.
  try {
    const body = await request.json();
    const { html, host, user, remotePath, siteName } = body;
    if (!html) return json({ error: 'Missing html in body' }, 400);

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await env.DB.prepare(
      'INSERT OR REPLACE INTO vps_deploys (id, html, host, created_at) VALUES (?, ?, ?, ?)'
    ).bind(id, html, host || 'unknown', new Date().toISOString()).run().catch(() => { });

    const downloadUrl = `${url.origin}/api/deploy/vps/download/${id}`;
    const sshCmd = `curl -sL "${downloadUrl}" -o /tmp/index.html && scp /tmp/index.html ${user}@${host}:${remotePath}/index.html`;

    return json({
      success: true,
      url: `http://${host}${remotePath?.endsWith('/') ? remotePath : (remotePath || '/') + '/'}`,
      downloadUrl,
      sshCommand: sshCmd,
      note: 'CF Workers cannot SSH directly. Use the download URL or command above.',
      siteName,
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleVpsDownload({ env, path }) {
  const id = path.split('/').pop();
  try {
    const row = await env.DB.prepare('SELECT html FROM vps_deploys WHERE id = ?').bind(id).first();
    if (!row) return json({ error: 'Not found or expired' }, 404);
    return new Response(row.html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleAiGenerateAssets({ request, db }) {
  const body = await request.json();
  const settingsRes = await db.prepare("SELECT * FROM settings WHERE key = 'geminiKey'").first();
  const key = settingsRes?.value;
  if (!key) return json({ error: 'Gemini Key not configured' }, 400);

  const type = body.type || 'logo';
  const promptGen = `Act as an expert AI prompt engineer.Create a highly detailed, professional prompt for an image generator(DALL - E 3 style).
            Brand: "${body.brand}"
          Context: "${type === 'logo' ? 'Fintech logo design' : 'High-converting hero background for loan site'}"
          Style: "${body.style || 'Modern & Clean'}"
          Requirements: ${type === 'logo' ? 'Flat vector, minimalist, white background, no text except brand' : 'Photorealistic, soft lighting, lots of copy space, 16:9'}
          Output: ONLY the refined prompt text.No chatter.`;

  // Pass key via x-goog-api-key header (URLs leak into logs / Referer / proxies).
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: promptGen }] }] }),
  });
  const d = await res.json();
  const refinedPrompt = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Modern fintech visual';

  const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(refinedPrompt)}?width=${type === 'logo' ? 512 : 1280}&height=${type === 'logo' ? 512 : 720}&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;

  return json({ url: imageUrl, prompt: refinedPrompt });
}

/**
 * Route entry. Returns Response if path matches; null otherwise.
 */
export async function handleMiscRoute({ request, env, db, url, path, method }) {
  if (path === '/api/cfg' && method === 'GET') return handleCfg({ db, url });
  if (path === '/api/postbacks' && method === 'GET') return handleVoluumPostbacksApiGet(env, url);
  if (path === '/api/provision-domain-dns' && method === 'POST') return handleProvisionDomainDns({ request, db });
  if (path === '/api/deploy/vps' && method === 'POST') return handleVpsDeploy({ request, env, url });
  if (path.startsWith('/api/deploy/vps/download/') && method === 'GET') return handleVpsDownload({ env, path });
  if (path === '/api/ai/generate-assets' && method === 'POST') return handleAiGenerateAssets({ request, db });
  return null;
}
