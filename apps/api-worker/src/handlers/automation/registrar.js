// ============================================================
// Internet.bs registrar automation for FusionOps API Worker
// ============================================================
// Routes:
//   POST /api/automation/registrar/check         domain availability
//   POST /api/automation/registrar/register      register domain
//   POST /api/automation/registrar/credentials   reveal stored creds
//   PUT  /api/automation/registrar/nameservers   update domain NS (with verify)
//   POST /api/automation/registrar/import        list account's domains
//   POST /api/automation/registrar/ping          health check (Account/Balance/Get)
//   GET  /api/automation/registrar/ip            worker outbound IP (ipify)
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json } from '../../lib/http.js';
import {
  canonicalizeNameservers,
  nameserversMatch,
  fetchInternetBsCurrentNameservers,
} from '../../lib/internetbs.js';

const IBS_BASE = 'https://api.internet.bs';

/** Resolve registrar account by id (preferred) or by provider (legacy). */
async function resolveRegistrarAccount(db, { accountId, provider }) {
  return accountId
    ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
    : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
}

async function handleCheck({ request, db }) {
  const body = await request.json();
  const { domain, provider, accountId } = body;
  if (!domain || !provider) return json({ error: 'Missing domain or provider' }, 400);

  const acctRow = await resolveRegistrarAccount(db, { accountId, provider });
  if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

  const formData = new URLSearchParams({
    ApiKey: acctRow.api_key,
    Password: acctRow.secret_key,
    responseformat: 'JSON',
    Domain: domain,
  });

  const res = await fetch(`${IBS_BASE}/Domain/Check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const data = await res.json();
  return json({
    success: data.status?.toLowerCase() !== 'failure',
    available: data.status?.toLowerCase() === 'available',
    domain,
    provider,
    status: data.status,
    message: data.message,
  });
}

async function handleRegister({ request, db }) {
  const body = await request.json();
  const { domain, provider, accountId, period = '1Y' } = body;
  if (!domain || !provider) return json({ error: 'Missing domain or provider' }, 400);

  const acctRow = await resolveRegistrarAccount(db, { accountId, provider });
  if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

  const formData = new URLSearchParams({
    ApiKey: acctRow.api_key,
    Password: acctRow.secret_key,
    responseformat: 'JSON',
    Domain: domain,
    Period: period,
  });

  if (body.nameservers && Array.isArray(body.nameservers)) {
    body.nameservers.forEach((ns, i) => {
      formData.append(`Ns${i + 1}`, ns);
    });
  }

  const res = await fetch(`${IBS_BASE}/Domain/Create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const data = await res.json();
  const success = data.status?.toLowerCase() === 'success';
  return json({
    success,
    domain,
    provider,
    transactionId: data.transactid,
    status: data.status,
    message: data.message,
    product: data.product,
  });
}

async function handleCredentials({ request, db }) {
  const body = await request.json();
  const { provider, accountId } = body;
  const acctRow = await resolveRegistrarAccount(db, { accountId, provider });
  if (!acctRow) return json({ error: 'Registrar account not found' }, 404);
  return json({ apiKey: acctRow.api_key, secretKey: acctRow.secret_key, provider: acctRow.provider });
}

async function handleNameservers({ request, db }) {
  const body = await request.json();
  const { domain, nameservers, provider, accountId } = body;
  if (!domain || !nameservers || !Array.isArray(nameservers)) {
    return json({ error: 'Missing domain or nameservers' }, 400);
  }

  const cleanedNameservers = canonicalizeNameservers(nameservers);
  if (cleanedNameservers.length < 2) {
    return json({ error: 'At least 2 valid nameservers are required' }, 400);
  }

  const acctRow = await resolveRegistrarAccount(db, { accountId, provider });
  if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

  // Whitelist worker's actual outbound IP in InternetBS before calling Domain/Update
  // Use api64.ipify.org which returns the real IP used (IPv6 or IPv4)
  try {
    const ipRes = await fetch('https://api64.ipify.org?format=json').catch(() => null);
    const ipData = await ipRes?.json().catch(() => ({}));
    const workerIp = ipData?.ip;
    const isIPv6 = workerIp?.includes(':');
    console.log('[IBS] Worker outbound IP:', workerIp, isIPv6 ? '(IPv6 - skipping whitelist, add CF IPv4 ranges manually)' : '');
    if (workerIp && !isIPv6) {
      const f = new URLSearchParams({ ApiKey: acctRow.api_key, Password: acctRow.secret_key, responseformat: 'JSON', Ip: workerIp });
      const r = await fetch(`${IBS_BASE}/Account/Access/AddIp`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: f.toString(),
      }).catch(() => null);
      const d = await r?.json().catch(() => ({}));
      console.log(`[IBS] AddIp ${workerIp}:`, d?.status, d?.message);
    }
  } catch (_e) { console.warn('[IBS] IP whitelist failed:', _e?.message); }

  // Pre-check to avoid unnecessary registrar updates.
  const beforeCheck = await fetchInternetBsCurrentNameservers(acctRow, domain);
  if (beforeCheck.success && beforeCheck.nameservers.length >= 2 && nameserversMatch(beforeCheck.nameservers, cleanedNameservers)) {
    return json({
      success: true,
      domain,
      nameservers: cleanedNameservers,
      currentNameservers: beforeCheck.nameservers,
      alreadySynced: true,
      verified: true,
      message: 'Nameservers already match target. No update needed.',
    });
  }

  const formData = new URLSearchParams({
    ApiKey: acctRow.api_key,
    Password: acctRow.secret_key,
    responseformat: 'JSON',
    Domain: domain,
    Ns_list: cleanedNameservers.join(','),
  });

  // Internet.bs Domain/Update expects Ns_list; Ns1/Ns2 can be rejected.
  const res = await fetch(`${IBS_BASE}/Domain/Update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  const rawText = await res.text();
  let data = null;
  try {
    data = JSON.parse(rawText);
  } catch (_e) {
    data = { status: 'FAILURE', message: rawText?.slice(0, 800) || 'Non-JSON response from registrar' };
  }

  const statusText = String(data?.status || '').toLowerCase();
  const isSuccess = statusText === 'success' || statusText === 'ok';
  const message = data?.message || data?.error || data?.msg || 'Unknown registrar response';

  const afterCheck = isSuccess ? await fetchInternetBsCurrentNameservers(acctRow, domain) : { success: false, nameservers: [] };
  const verified = !!(afterCheck.success && nameserversMatch(afterCheck.nameservers, cleanedNameservers));

  return json({
    success: isSuccess,
    domain,
    nameservers: cleanedNameservers,
    currentNameservers: afterCheck.success ? afterCheck.nameservers : beforeCheck.nameservers,
    verified,
    alreadySynced: false,
    status: data.status,
    message: verified ? 'Nameservers updated and verified.' : message,
    raw: data,
    verify: {
      before: beforeCheck.success ? beforeCheck.nameservers : [],
      after: afterCheck.success ? afterCheck.nameservers : [],
      beforeError: beforeCheck.success ? null : (beforeCheck.message || null),
      afterError: afterCheck.success ? null : (afterCheck.message || null),
    },
  });
}

async function handleImport({ request, db }) {
  const body = await request.json();
  const { provider, accountId } = body;
  if (!provider) return json({ error: 'Missing provider' }, 400);

  const acctRow = await resolveRegistrarAccount(db, { accountId, provider });
  if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

  const formData = new URLSearchParams({
    ApiKey: acctRow.api_key,
    Password: acctRow.secret_key,
    responseformat: 'JSON',
    CompactList: 'no',
  });

  const res = await fetch(`${IBS_BASE}/Domain/List`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const data = await res.json();
  const domains = Array.isArray(data.domain) ? data.domain : (data.domain ? [data.domain] : []);
  return json({
    success: data.status?.toLowerCase() !== 'failure',
    provider,
    count: domains.length,
    domains: domains.map(d => ({
      domain: typeof d === 'string' ? d : d.name,
      status: typeof d === 'string' ? 'ACTIVE' : d.status,
      expiration: typeof d === 'string' ? null : d.expiration,
      autoRenew: typeof d === 'string' ? null : d.autorenew?.toLowerCase() === 'yes',
    })),
  });
}

async function handlePing({ request, db }) {
  const body = await request.json();
  const { provider, accountId, apiKey, secretKey } = body;
  if (!provider) return json({ error: 'Missing provider' }, 400);

  // Support testing unsaved credentials directly from UI
  let resolvedApiKey = apiKey || '';
  let resolvedSecretKey = secretKey || '';

  if (!resolvedApiKey || !resolvedSecretKey) {
    const acctRow = await resolveRegistrarAccount(db, { accountId, provider });
    if (!acctRow) return json({ error: 'Registrar account not found' }, 404);
    resolvedApiKey = acctRow.api_key || '';
    resolvedSecretKey = acctRow.secret_key || '';
  }

  if (!resolvedApiKey || !resolvedSecretKey) {
    return json({ error: 'Missing registrar credentials' }, 400);
  }

  const formData = new URLSearchParams({
    ApiKey: resolvedApiKey,
    Password: resolvedSecretKey,
    responseformat: 'JSON',
  });

  const res = await fetch(`${IBS_BASE}/Account/Balance/Get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const data = await res.json();
  return json({
    success: data.status?.toLowerCase() === 'success',
    provider,
    balance: data.balance,
    currency: data.balance?.[0]?.currency,
    message: data.message,
  });
}

async function handleIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return json({ success: true, ip: data.ip });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

/**
 * Route entry. Returns Response if path matches `/api/automation/registrar/*`; null otherwise.
 */
export async function handleRegistrarAutomationRoute({ request, db, path, method }) {
  if (path === '/api/automation/registrar/check' && method === 'POST') return handleCheck({ request, db });
  if (path === '/api/automation/registrar/register' && method === 'POST') return handleRegister({ request, db });
  if (path === '/api/automation/registrar/credentials' && method === 'POST') return handleCredentials({ request, db });
  if (path === '/api/automation/registrar/nameservers' && method === 'PUT') return handleNameservers({ request, db });
  if (path === '/api/automation/registrar/import' && method === 'POST') return handleImport({ request, db });
  if (path === '/api/automation/registrar/ping' && method === 'POST') return handlePing({ request, db });
  if (path === '/api/automation/registrar/ip' && method === 'GET') return handleIp();
  return null;
}
