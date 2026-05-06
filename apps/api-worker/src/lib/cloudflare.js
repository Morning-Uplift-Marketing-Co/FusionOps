// ============================================================
// Cloudflare API helpers for FusionOps API Worker
// ============================================================
// Account lookup, zone create/get, nameserver polling. Used by:
//   - handlers/automation/cloudflare.js (operator endpoints)
//   - sites.js auto-sync flow
//   - /api/provision-domain-dns
//
// Extracted from worker.js (Phase 2: utility extraction).
// ============================================================

import { normalizeNameservers } from './internetbs.js';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const CF_NS_RETRY_ATTEMPTS = 6;
const CF_NS_RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll Cloudflare zone until nameservers are assigned (typically takes <30s). */
export async function pollCloudflareNameservers(zoneId, headers, options = {}) {
  const attempts = Number(options.attempts || CF_NS_RETRY_ATTEMPTS);
  const delayMs = Number(options.delayMs || CF_NS_RETRY_DELAY_MS);
  let lastError = '';
  let latestZone = null;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await sleep(delayMs);
    }

    const zoneRes = await fetch(`${CF_API_BASE}/zones/${zoneId}`, { headers });
    const zoneData = await zoneRes.json().catch(() => ({}));

    if (!zoneRes.ok || zoneData?.success === false) {
      lastError = zoneData?.errors?.[0]?.message || `Cloudflare zone lookup failed (${zoneRes.status})`;
      continue;
    }

    latestZone = zoneData?.result || latestZone;
    const nameservers = normalizeNameservers(latestZone?.name_servers || latestZone?.nameServers);
    if (nameservers.length >= 2) {
      return { success: true, nameservers, zone: latestZone };
    }

    lastError = 'Cloudflare nameservers are not ready yet';
  }

  return {
    success: false,
    error: lastError || 'Cloudflare nameservers are not ready yet',
    zone: latestZone,
  };
}

/** Look up CF account credentials by either DB row id or account_id. */
export async function resolveCloudflareAccount(db, cfAccountRef) {
  if (!cfAccountRef) return null;
  const row = await db
    .prepare('SELECT id, account_id, api_token FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
    .bind(cfAccountRef, cfAccountRef)
    .first();
  if (!row?.account_id || !row?.api_token) return null;
  return row;
}

/** Idempotent: get-or-create a CF zone for the given domain, then return its nameservers. */
export async function ensureCloudflareZoneAndNameservers(accountId, apiToken, domain) {
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };

  let zone = null;

  const checkRes = await fetch(
    `${CF_API_BASE}/zones?name=${encodeURIComponent(domain)}&account.id=${encodeURIComponent(accountId)}`,
    { headers }
  );
  const checkData = await checkRes.json();
  if (checkData?.success && Array.isArray(checkData.result) && checkData.result.length > 0) {
    zone = checkData.result[0];
  } else {
    const createRes = await fetch(`${CF_API_BASE}/zones`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        account: { id: accountId },
        name: domain,
        jump_start: false,
      }),
    });
    const createData = await createRes.json();
    if (!createData?.success || !createData?.result?.id) {
      return { success: false, error: createData?.errors?.[0]?.message || 'Failed to create Cloudflare zone' };
    }
    zone = createData.result;
  }

  let nameservers = normalizeNameservers(zone?.name_servers || zone?.nameServers);
  let latestZone = zone;
  if (nameservers.length < 2 && zone?.id) {
    const nsPoll = await pollCloudflareNameservers(zone.id, headers);
    if (!nsPoll.success) {
      return {
        success: false,
        error: `${nsPoll.error}. Retry in 10-30 seconds.`,
      };
    }
    nameservers = nsPoll.nameservers;
    latestZone = nsPoll.zone || zone;
  }

  if (nameservers.length < 2) {
    return { success: false, error: 'Cloudflare nameservers are not ready yet. Retry in 10-30 seconds.' };
  }

  return { success: true, zoneId: zone.id, nameservers, zone: latestZone };
}
