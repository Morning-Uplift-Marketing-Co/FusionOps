/**
 * AdsPower Local API — browser profiles, proxy, automation hooks.
 *
 * Postman (overview): https://documenter.getpostman.com/view/45822952/2sB34hEzQH
 * Official Local API docs: https://localapi-doc-en.adspower.com/docs/Rdw7Iu
 *
 * Default base: http://127.0.0.1:50325 or http://local.adspower.net:50325/
 * In Vite dev, requests go via same-origin `/adspower-local` → proxy to 50325 (see astro.config.mjs).
 *
 * On HTTPS production (e.g. Pages), or on http://localhost when Base URL is an https:// tunnel, the browser
 * calls `POST /api/adspower/proxy`; the Worker forwards using `adspowerLocalBase` / `adspowerApiKey` from the
 * request body (form) when provided, otherwise from D1 — avoids CORS preflight to ngrok (OPTIONS 403).
 *
 * Paid AdsPower + Local API enabled. With security on: Authorization: Bearer <api_key>.
 */

import { api } from "./api.js";

const FALLBACK_LOCAL = "http://127.0.0.1:50325";

function isLocalDevHost() {
  const h = String(typeof window !== "undefined" ? window.location?.hostname || "" : "").toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    h.endsWith(".local") ||
    /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(h)
  ) {
    return true;
  }
  return false;
}

/**
 * When true, AdsPower traffic goes through the API Worker (avoids mixed content + tunnel CORS).
 * - Public HTTPS (e.g. *.pages.dev): always relay.
 * - http://localhost with Base URL https://… (ngrok): relay so browser does not OPTIONS to ngrok.
 */
export function adspowerUsesWorkerProxy(settings = {}) {
  if (typeof window === "undefined") return false;
  const tunnel = String(settings?.adspowerLocalBase || "").trim();
  const useHttpsTunnel = /^https:\/\//i.test(tunnel);

  if (window.location?.protocol === "https:" && !isLocalDevHost()) {
    return true;
  }
  if (window.location?.protocol === "http:" && isLocalDevHost() && useHttpsTunnel) {
    return true;
  }
  return false;
}

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

/** Browsers block or restrict HTTPS pages calling http://127.0.0.1:50325 (mixed content / private network). */
function adsPowerHttpsLocalHint(settings, existingMsg = "") {
  const m = String(existingMsg || "");
  if (m.includes("HTTPS tunnel") || m.includes("Base URL")) return "";
  if (typeof window === "undefined") return "";
  if (window.location?.protocol !== "https:") return "";
  const base = resolveAdsPowerBaseUrl(settings);
  if (!/^http:\/\//i.test(base)) return "";
  if (!/\b127\.0\.0\.1\b|\blocalhost\b|local\.adspower\.net/i.test(base)) return "";
  return " — แดชบอร์ดเป็น HTTPS จึงเรียก Local API แบบ HTTP ไม่ได้: ตั้ง Base URL เป็น HTTPS tunnel ไปพอร์ต 50325 (Settings → Automation) หรือใช้ `npm run dev` บนเครื่องเดียวกับ AdsPower";
}

async function adsPowerFetchViaWorker(settings, path, init = {}) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const method = String(init.method || "GET").toUpperCase();
  let bodyObj;
  if (method !== "GET" && method !== "HEAD" && init.body) {
    try {
      bodyObj = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    } catch {
      bodyObj = {};
    }
  }
  const payload = { path: p, method, ...(bodyObj !== undefined ? { body: bodyObj } : {}) };
  const tb = String(settings?.adspowerLocalBase || "").trim();
  const tk = String(settings?.adspowerApiKey || "").trim();
  if (tb) payload.adspowerLocalBase = tb;
  if (tk) payload.adspowerApiKey = tk;
  const data = await api.post("/api/adspower/proxy", payload);
  if (data && typeof data === "object" && data.error && data.code === undefined) {
    return {
      res: { status: 0, ok: false },
      json: { code: -1, msg: data.hint ? `${data.error} — ${data.hint}` : String(data.error) },
    };
  }
  return { res: { status: 200, ok: true }, json: data };
}

/**
 * @param {object} settings
 * @param {string} path — e.g. /status or /api/v2/browser-profile/list
 * @param {RequestInit} [init]
 */
export async function adsPowerFetch(settings, path, init = {}) {
  if (adspowerUsesWorkerProxy(settings)) {
    return adsPowerFetchViaWorker(settings, path, init);
  }

  const base = resolveAdsPowerBaseUrl(settings);
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${p}`;
  const mergedHeaders = {
    ...authHeaders(settings.adspowerApiKey),
    ...(init.headers || {}),
  };
  try {
    const res = await fetch(url, { ...init, headers: mergedHeaders });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { _raw: text };
    }
    return { res, json };
  } catch (e) {
    const msg = e?.message || String(e);
    return {
      res: { status: 0, ok: false },
      json: {
        code: -1,
        msg:
          msg.includes("Failed to fetch") || msg === "Load failed"
            ? /^https:\/\//i.test(String(settings?.adspowerLocalBase || "").trim())
              ? "เชื่อมต่อไม่ได้ — จาก localhost + ngrok ควรใช้ Worker relay อัตโนมัติแล้ว; ตรวจ VITE_API_BASE ชี้ Worker และว่า Worker deploy แล้ว หรือเว้น Base URL ว่างแล้วใช้ /adspower-local บนเครื่องเดียวกับ AdsPower"
              : "เชื่อมต่อ Local API ไม่ได้ (มักเกิดจากหน้า HTTPS ที่บล็อก http://127.0.0.1 — ตั้ง Base URL เป็น HTTPS tunnel ใน Settings → Automation)"
            : msg,
      },
    };
  }
}

/** GET /status — connection check */
export async function getAdsPowerStatus(settings) {
  const { res, json } = await adsPowerFetch(settings, "/status", { method: "GET" });
  if (json?.code === 0) return { ok: true, msg: json.msg || "success", json };
  const baseErr = json?.msg || (res.status ? `HTTP ${res.status}` : "เชื่อมต่อไม่สำเร็จ");
  const hint = adsPowerHttpsLocalHint(settings, baseErr);
  return {
    ok: false,
    error: hint ? `${baseErr}${hint}` : baseErr,
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
  const rawList = json?.data?.list ?? json?.data?.profiles;
  const list = Array.isArray(rawList) ? rawList : Array.isArray(json?.data) ? json.data : null;
  if (json?.code === 0 && Array.isArray(list)) {
    return {
      ok: true,
      profiles: list,
      page: json.data?.page,
      limit: json.data?.limit,
      json,
    };
  }
  const baseErr = json?.msg || `HTTP ${res.status}`;
  const hint = adsPowerHttpsLocalHint(settings, baseErr);
  return {
    ok: false,
    error: hint ? `${baseErr}${hint}` : baseErr,
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
