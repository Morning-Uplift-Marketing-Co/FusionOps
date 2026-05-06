// ============================================================
// Voluum postback SSRF guard for FusionOps API Worker
// ============================================================
// Validates outbound forward destinations for /v postback relay.
// Optional env.VOLUUM_FORWARD_DOMAIN_ALLOWLIST = comma-separated
// suffixes (e.g. "voluumtrk.com,my-track-domain.com").
//
// Extracted from worker.js (Phase 1: utility extraction).
// ============================================================

import { extractHost } from './url.js';

/** Merge query + POST body into one param bag for Voluum postback relay (multi-site via `vd`). */
export async function parseVoluumPostbackMergedParams(request, url, method) {
  const merged = new URLSearchParams(url.search);
  if (method !== 'POST') return merged;
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  let text = '';
  try {
    text = await request.text();
  } catch (_e) {
    return merged;
  }
  if (!text || !String(text).trim()) return merged;
  try {
    if (ct.includes('application/json')) {
      const obj = JSON.parse(text);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) {
          if (v == null || typeof v === 'object') continue;
          merged.set(k, String(v));
        }
      }
    } else {
      const bodyParams = new URLSearchParams(text);
      for (const [k, v] of bodyParams) merged.set(k, v);
    }
  } catch (_e) { /* keep query-only */ }
  return merged;
}

export function normalizeVoluumDomainParam(vd) {
  const h = extractHost(String(vd || '').trim());
  return h.replace(/\.$/, '');
}

/** Basic SSRF guard for outbound Voluum postback fetches. */
export function isSafeVoluumForwardHost(host, env) {
  if (!host || typeof host !== 'string') return false;
  const h = host.toLowerCase().trim();
  if (h.length < 3 || h.length > 253) return false;
  if (h === 'localhost') return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
  if (h.startsWith('[')) return false;
  if (h.includes('..')) return false;
  if (!/^[a-z0-9.-]+$/.test(h)) return false;
  const parts = h.split('.');
  if (parts.some((p) => !p || p.length > 63)) return false;

  const list = String(env?.VOLUUM_FORWARD_DOMAIN_ALLOWLIST || '').trim();
  if (list) {
    const suffixes = list.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const ok = suffixes.some((suffix) => h === suffix || h.endsWith('.' + suffix));
    if (!ok) return false;
  }
  return true;
}

export function voluumForwardSearchParams(merged) {
  const fwd = new URLSearchParams(merged);
  fwd.delete('vd');
  fwd.delete('voluum_domain');
  return fwd;
}
