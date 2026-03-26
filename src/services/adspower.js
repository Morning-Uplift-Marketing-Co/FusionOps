/**
 * AdsPower Local API — browser profiles, proxy, automation hooks.
 *
 * Postman (overview): https://documenter.getpostman.com/view/45822952/2sB34hEzQH
 * Official Local API docs: https://localapi-doc-en.adspower.com/docs/Rdw7Iu
 *
 * Default base: http://127.0.0.1:50325 or http://local.adspower.net:50325/
 * In Vite dev, requests go via same-origin `/adspower-local` → proxy to 50325 (see astro.config.mjs).
 *
 * Paid AdsPower + Local API enabled. With security on: Authorization: Bearer <api_key>.
 */

const FALLBACK_LOCAL = "http://127.0.0.1:50325";

/**
 * @param {object} [settings]
 * @param {string} [settings.adspowerLocalBase] — override full origin (e.g. https://tunnel.example.com)
 * @returns {string} base URL without trailing slash
 */
export function resolveAdsPowerBaseUrl(settings = {}) {
  const custom = String(settings.adspowerLocalBase || "").trim().replace(/\/+$/, "");
  if (custom) return custom;
  if (import.meta.env.DEV) return "/adspower-local";
  return FALLBACK_LOCAL;
}

function authHeaders(apiKey) {
  const h = { Accept: "application/json" };
  const k = String(apiKey || "").trim();
  if (k) h.Authorization = `Bearer ${k}`;
  return h;
}

/**
 * @param {object} settings
 * @param {string} path — e.g. /status or /api/v2/browser-profile/list
 * @param {RequestInit} [init]
 */
export async function adsPowerFetch(settings, path, init = {}) {
  const base = resolveAdsPowerBaseUrl(settings);
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${p}`;
  const mergedHeaders = {
    ...authHeaders(settings.adspowerApiKey),
    ...(init.headers || {}),
  };
  const res = await fetch(url, { ...init, headers: mergedHeaders });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _raw: text };
  }
  return { res, json };
}

/** GET /status — connection check */
export async function getAdsPowerStatus(settings) {
  const { res, json } = await adsPowerFetch(settings, "/status", { method: "GET" });
  if (json?.code === 0) return { ok: true, msg: json.msg || "success", json };
  return {
    ok: false,
    error: json?.msg || `HTTP ${res.status}`,
    json,
  };
}

/**
 * POST /api/v2/browser-profile/list
 * @see https://localapi-doc-en.adspower.com/docs/Query-Profile-V2
 */
export async function listAdsPowerProfiles(settings, { page = 1, limit = 30, group_id } = {}) {
  const body = { page, limit: Math.min(100, Math.max(1, limit)) };
  if (group_id != null && group_id !== "") body.group_id = String(group_id);
  const { res, json } = await adsPowerFetch(settings, "/api/v2/browser-profile/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (json?.code === 0 && Array.isArray(json?.data?.list)) {
    return {
      ok: true,
      profiles: json.data.list,
      page: json.data.page,
      limit: json.data.limit,
      json,
    };
  }
  return {
    ok: false,
    error: json?.msg || `HTTP ${res.status}`,
    json,
  };
}

/**
 * POST /api/v2/browser-profile/start
 * @see https://localapi-doc-en.adspower.com/docs/Open-Browser-V2
 */
export async function startAdsPowerBrowser(settings, { profile_id, profile_no, headless } = {}) {
  const body = {};
  if (profile_id) body.profile_id = String(profile_id);
  if (profile_no != null) body.profile_no = String(profile_no);
  if (headless === 0 || headless === 1) body.headless = headless;
  const { res, json } = await adsPowerFetch(settings, "/api/v2/browser-profile/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (json?.code === 0) return { ok: true, data: json.data, json };
  return { ok: false, error: json?.msg || `HTTP ${res.status}`, json };
}

/**
 * POST /api/v2/browser-profile/stop
 */
export async function stopAdsPowerBrowser(settings, { profile_id } = {}) {
  if (!profile_id) return { ok: false, error: "profile_id required" };
  const { res, json } = await adsPowerFetch(settings, "/api/v2/browser-profile/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_id: String(profile_id) }),
  });
  if (json?.code === 0) return { ok: true, json };
  return { ok: false, error: json?.msg || `HTTP ${res.status}`, json };
}
