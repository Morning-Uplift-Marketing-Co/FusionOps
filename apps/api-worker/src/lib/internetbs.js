// ============================================================
// Internet.bs registrar helpers for FusionOps API Worker
// ============================================================
// Nameserver normalization, comparison, and Internet.bs Domain/Info
// + Domain/Update wrappers. Used by both:
//   - handlers/automation/registrar.js (operator endpoints)
//   - sites.js auto-sync flow (POST /api/sites + /api/ops/domains)
//
// Extracted from worker.js (Phase 2: utility extraction).
// ============================================================

const IBS_BASE = 'https://api.internet.bs';

export function normalizeNameservers(input) {
  return (Array.isArray(input) ? input : [])
    .map((ns) => String(ns || '').trim().toLowerCase().replace(/\.$/, ''))
    .filter(Boolean);
}

export function canonicalizeNameservers(input) {
  return Array.from(new Set(normalizeNameservers(input))).sort();
}

export function nameserversMatch(a, b) {
  const left = canonicalizeNameservers(a);
  const right = canonicalizeNameservers(b);
  if (left.length !== right.length) return false;
  return left.every((value, idx) => value === right[idx]);
}

/** Walk an Internet.bs Domain/Info payload and harvest all nameserver-shaped values. */
export function extractInternetBsNameservers(payload) {
  const out = [];
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [rawKey, value] of Object.entries(obj)) {
      const key = String(rawKey || '').toLowerCase();

      if (key === 'ns_list' && typeof value === 'string') {
        out.push(...value.split(','));
      } else if (/^ns\d+$/.test(key) || key.includes('nameserver')) {
        if (Array.isArray(value)) out.push(...value);
        else out.push(value);
      } else if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry && typeof entry === 'object') walk(entry);
        });
      } else if (value && typeof value === 'object') {
        walk(value);
      }
    }
  };

  walk(payload);
  return canonicalizeNameservers(out);
}

/** Fetch the current nameservers for a domain from Internet.bs Domain/Info. */
export async function fetchInternetBsCurrentNameservers(registrar, domain) {
  const apiUrl = `${IBS_BASE}/Domain/Info`;
  const formData = new URLSearchParams({
    ApiKey: registrar.api_key || '',
    Password: registrar.secret_key || '',
    responseformat: 'JSON',
    Domain: domain,
  });

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  const rawText = await res.text();
  let data = null;
  try {
    data = JSON.parse(rawText);
  } catch (_e) {
    return {
      success: false,
      nameservers: [],
      message: rawText?.slice(0, 800) || 'Non-JSON response from registrar',
    };
  }

  const statusText = String(data?.status || '').toLowerCase();
  if (statusText === 'failure') {
    return {
      success: false,
      nameservers: [],
      message: data?.message || data?.error || 'Registrar Domain/Info failed',
      raw: data,
    };
  }

  const nameservers = extractInternetBsNameservers(data);
  return {
    success: true,
    nameservers,
    message: data?.message || '',
    raw: data,
  };
}

/** POST Internet.bs Domain/Update with Ns_list to set new nameservers. */
export async function updateInternetBsNameservers(db, accountId, domain, nameservers) {
  const registrar = await db.prepare('SELECT * FROM registrar_accounts WHERE id = ? LIMIT 1').bind(accountId).first();
  if (!registrar) return { success: false, error: 'Internet.bs account not found' };

  const apiUrl = `${IBS_BASE}/Domain/Update`;
  const formData = new URLSearchParams({
    ApiKey: registrar.api_key || '',
    Password: registrar.secret_key || '',
    responseformat: 'JSON',
    Domain: domain,
    Ns_list: nameservers.join(','),
  });

  const res = await fetch(apiUrl, {
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
  return {
    success: isSuccess,
    message: data?.message || data?.error || data?.msg || 'Unknown registrar response',
    raw: data,
  };
}
