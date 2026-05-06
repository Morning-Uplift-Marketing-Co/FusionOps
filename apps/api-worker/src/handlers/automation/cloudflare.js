// ============================================================
// Cloudflare automation for FusionOps API Worker
// ============================================================
// Routes:
//   POST /api/automation/cf-validate    Validate API token + account
//   POST /api/automation/cf/zone        Create or fetch zone for domain
//   GET  /api/automation/cf/dns         List DNS records
//   POST /api/automation/cf/dns         Create DNS record
//   PUT  /api/automation/cf/dns         Update DNS record
//   DELETE /api/automation/cf/dns       Delete DNS record
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json } from '../../lib/http.js';
import { normalizeNameservers } from '../../lib/internetbs.js';
import { pollCloudflareNameservers } from '../../lib/cloudflare.js';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

/** Resolve CF token from request body, falling back to D1 settings (cf_accounts). */
async function resolveCfToken(db, cfAccountRef, providedToken) {
  let token = providedToken || '';
  let resolvedAccountId = cfAccountRef;
  const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
    .bind(cfAccountRef, cfAccountRef).first();
  if (acctRow) {
    if (!token) token = acctRow.api_token || '';
    resolvedAccountId = acctRow.account_id || cfAccountRef;
  }
  return { token, resolvedAccountId };
}

async function handleCfValidate({ request }) {
  const body = await request.json();
  const { accountId, apiToken } = body;
  if (!accountId || !apiToken) return json({ error: 'Missing accountId or apiToken' }, 400);

  const res = await fetch(`${CF_API_BASE}/accounts/${accountId}`, {
    headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      errMsg = data.errors?.[0]?.message || errMsg;
    } catch { /* response was not JSON */ }
    return json({ success: false, error: errMsg }, 400);
  }

  const data = await res.json();
  if (!data.success) {
    return json({ success: false, error: data.errors?.[0]?.message || 'Invalid credentials' }, 400);
  }

  return json({ success: true, account: data.result });
}

async function handleCfZone({ request, db }) {
  const body = await request.json();
  const { domain, cfAccountId, cfApiToken, apiToken } = body;
  if (!domain || !cfAccountId) return json({ error: 'Missing domain or cfAccountId' }, 400);

  const { token, resolvedAccountId } = await resolveCfToken(db, cfAccountId, cfApiToken || apiToken);
  if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // First check if zone exists
  const checkRes = await fetch(`${CF_API_BASE}/zones?name=${encodeURIComponent(domain)}`, { headers });
  const checkData = await checkRes.json();
  if (checkData.success && checkData.result?.[0]) {
    let zone = checkData.result[0];
    let nameservers = normalizeNameservers(zone?.name_servers || zone?.nameServers);
    if (nameservers.length < 2 && zone?.id) {
      const nsPoll = await pollCloudflareNameservers(zone.id, headers, { attempts: 4, delayMs: 1500 });
      if (nsPoll.success) {
        zone = nsPoll.zone || zone;
        nameservers = nsPoll.nameservers;
      }
    }
    return json({
      success: true,
      exists: true,
      zoneId: zone.id,
      zone,
      nameservers,
      warning: nameservers.length < 2 ? 'Cloudflare nameservers are not ready yet. Retry in 10-30 seconds.' : undefined,
    });
  }

  // Create zone
  const createRes = await fetch(`${CF_API_BASE}/zones`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: domain, account: { id: resolvedAccountId }, type: 'full' }),
  });
  const createData = await createRes.json();
  if (!createData.success) {
    return json({ success: false, error: createData.errors?.[0]?.message || 'Zone creation failed' }, 400);
  }
  let zone = createData.result;
  let nameservers = normalizeNameservers(zone?.name_servers || zone?.nameServers);
  if (nameservers.length < 2 && zone?.id) {
    const nsPoll = await pollCloudflareNameservers(zone.id, headers, { attempts: 4, delayMs: 1500 });
    if (nsPoll.success) {
      zone = nsPoll.zone || zone;
      nameservers = nsPoll.nameservers;
    }
  }
  return json({
    success: true,
    exists: false,
    zoneId: zone.id,
    zone,
    nameservers,
    warning: nameservers.length < 2 ? 'Cloudflare nameservers are not ready yet. Retry in 10-30 seconds.' : undefined,
  });
}

async function handleCfDnsList({ request, db, url }) {
  const zoneId = url.searchParams.get('zoneId');
  const cfAccountId = url.searchParams.get('cfAccountId');
  const apiToken = request.headers.get('x-cf-api-token') || url.searchParams.get('apiToken') || '';
  if (!zoneId || !cfAccountId) return json({ error: 'Missing zoneId or cfAccountId' }, 400);

  const { token } = await resolveCfToken(db, cfAccountId, apiToken);
  if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

  const res = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  return json({ success: data.success, records: data.result || [], error: data.errors?.[0]?.message });
}

async function handleCfDnsCreate({ request, db }) {
  const body = await request.json();
  const { zoneId, cfAccountId, apiToken, type, name, content, ttl = 3600, proxied = false } = body;
  if (!zoneId || !cfAccountId || !type || !name || content === undefined) {
    return json({ error: 'Missing zoneId, cfAccountId, type, name, or content' }, 400);
  }

  const { token } = await resolveCfToken(db, cfAccountId, apiToken);
  if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

  const res = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, name, content, ttl, proxied }),
  });
  const data = await res.json();
  if (!data.success) return json({ success: false, error: data.errors?.[0]?.message }, 400);
  return json({ success: true, record: data.result });
}

async function handleCfDnsUpdate({ request, db }) {
  const body = await request.json();
  const { dnsRecordId, zoneId, cfAccountId, apiToken, type, name, content, ttl, proxied } = body;
  if (!dnsRecordId || !zoneId || !cfAccountId) return json({ error: 'Missing dnsRecordId, zoneId, or cfAccountId' }, 400);

  const { token } = await resolveCfToken(db, cfAccountId, apiToken);
  if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

  const updateData = {};
  if (type) updateData.type = type;
  if (name) updateData.name = name;
  if (content !== undefined) updateData.content = content;
  if (ttl !== undefined) updateData.ttl = ttl;
  if (proxied !== undefined) updateData.proxied = proxied;

  const res = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records/${dnsRecordId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });
  const data = await res.json();
  if (!data.success) return json({ success: false, error: data.errors?.[0]?.message }, 400);
  return json({ success: true, record: data.result });
}

async function handleCfDnsDelete({ request, db, url }) {
  const dnsRecordId = url.searchParams.get('dnsRecordId');
  const zoneId = url.searchParams.get('zoneId');
  const cfAccountId = url.searchParams.get('cfAccountId');
  const apiToken = request.headers.get('x-cf-api-token') || url.searchParams.get('apiToken') || '';
  if (!dnsRecordId || !zoneId || !cfAccountId) return json({ error: 'Missing dnsRecordId, zoneId, or cfAccountId' }, 400);

  const { token } = await resolveCfToken(db, cfAccountId, apiToken);
  if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

  const res = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records/${dnsRecordId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  return json({ success: data.success });
}

/**
 * Route entry. Returns Response if path matches; null otherwise.
 */
export async function handleCloudflareAutomationRoute({ request, db, url, path, method }) {
  if (path === '/api/automation/cf-validate' && method === 'POST') return handleCfValidate({ request });
  if (path === '/api/automation/cf/zone' && method === 'POST') return handleCfZone({ request, db });
  if (path === '/api/automation/cf/dns' && method === 'GET') return handleCfDnsList({ request, db, url });
  if (path === '/api/automation/cf/dns' && method === 'POST') return handleCfDnsCreate({ request, db });
  if (path === '/api/automation/cf/dns' && method === 'PUT') return handleCfDnsUpdate({ request, db });
  if (path === '/api/automation/cf/dns' && method === 'DELETE') return handleCfDnsDelete({ request, db, url });
  return null;
}
