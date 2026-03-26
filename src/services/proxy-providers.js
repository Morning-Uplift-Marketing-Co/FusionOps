/**
 * Proxy Providers — Multi-provider adapter with auto-fallback
 *
 * Unified interface for 4 residential proxy providers:
 *   1. NodeMaven  (gate.nodemaven.com)
 *   2. SmartProxy (gate.smartproxy.com)
 *   3. SOAX       (proxy.soax.com)
 *   4. Bright Data (brd.superproxy.io)
 *
 * Each provider adapter builds a proxy config in a unified format.
 * Auto-fallback: if primary provider fails quality check, try next in priority.
 */

import { nodemavenApi } from "./nodemaven";

/* ────────────────── Settings ────────────────── */

function getSettings() {
  try {
    const host = typeof window !== "undefined" ? `${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}` : "";
    const namespaced = host ? localStorage.getItem(`lpf2:${host}:settings`) : null;
    const legacy = localStorage.getItem("lpf2-settings");
    const old = localStorage.getItem("lp_settings");
    return JSON.parse(namespaced || legacy || old || "{}");
  } catch {
    return {};
  }
}

/** Merge unsaved form fields over persisted settings (Settings page tests). */
function mergedProxySettings(settingsOverride) {
  if (settingsOverride === undefined || settingsOverride === null) return getSettings();
  if (typeof settingsOverride !== "object") return getSettings();
  return { ...getSettings(), ...settingsOverride };
}

const DEFAULT_PROVIDER_ORDER = ["nodemaven", "smartproxy", "soax", "brightdata"];

/** Order used by getProxyConfigWithFallback — respects Settings "Primary Provider" unless proxyFallbackOrder JSON overrides. */
export function getProviderFallbackOrder(settings = getSettings()) {
  if (settings.proxyFallbackOrder) {
    try {
      const parsed = JSON.parse(settings.proxyFallbackOrder);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.filter((id) => PROVIDERS[id]);
      }
    } catch {
      /* ignore invalid JSON */
    }
  }
  const primary = String(settings.proxyPrimaryProvider || "nodemaven").toLowerCase();
  const first = PROVIDERS[primary] ? primary : "nodemaven";
  const rest = DEFAULT_PROVIDER_ORDER.filter((id) => id !== first);
  return [first, ...rest];
}

/* ────────────────── Session ID Generator ────────────────── */

function generateSessionId(profileId) {
  const prefix = (profileId || "default").slice(0, 8).replace(/[^a-z0-9]/gi, "");
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${rand}`;
}

/* ────────────────── Provider Configs ────────────────── */

const PROVIDERS = {
  nodemaven: {
    name: "NodeMaven",
    host: "gate.nodemaven.com",
    httpPort: 8080,
    socks5Port: 1080,
    settingsKeys: { user: "nmProxyUser", pass: "nmProxyPassword" },
    buildUsername(baseUser, { country, region, city, sessionId, filter }) {
      let parts = [baseUser];
      if (country) parts.push(`country-${country.toLowerCase()}`);
      if (region) parts.push(`region-${region.toLowerCase().replace(/\s+/g, "_")}`);
      if (city) parts.push(`city-${city.toLowerCase().replace(/\s+/g, "_")}`);
      if (sessionId) parts.push(`sid-${sessionId}`);
      parts.push(`filter-${filter || "medium"}`);
      return parts.join("-");
    },
  },

  smartproxy: {
    name: "SmartProxy",
    /**
     * Current Decodo/Smartproxy residential user:pass backconnect (help.smartproxy.com).
     * Legacy: gate.smartproxy.com — set spProxyHost + spProxyHttpPort in Settings.
     */
    host: "gate.decodo.com",
    httpPort: 7000,
    socks5Port: 7000,
    settingsKeys: { user: "spProxyUser", pass: "spProxyPassword" },
    /**
     * Two dashboard styles:
     * - Decodo/backconnect: user-subuser-country-us-session-… (hyphen chain; often needs user- prefix).
     * - Regional endpoints (e.g. as.smartproxy.net): subuser_area-TH_state-BANGKOK_life-120_session-… — NO user- prefix, uses area- not country-.
     */
    buildUsername(baseUser, { country, state, city, sessionId }) {
      const raw = String(baseUser || "").trim();
      const lower = raw.toLowerCase();
      const hasSessionToken = /[_-]session[-_]/i.test(raw);

      /* Underscore + area-XX = regional generator line — use verbatim (never prepend user-, never append profile geo). */
      if (/_area-[a-z]{2}/i.test(raw)) {
        let out = raw;
        if (sessionId && !hasSessionToken) out = `${out}-session-${sessionId}`;
        return out;
      }

      const hyphenComposed = /-(country|city|state|session|sessionduration|continent|asn|zip|area|life)-/.test(lower);
      if (hyphenComposed) {
        let out = raw;
        if (!lower.startsWith("user-")) out = `user-${raw}`;
        if (sessionId && !/-session-/.test(lower)) out = `${out}-session-${sessionId}`;
        return out;
      }

      let u = raw;
      if (!lower.startsWith("user-")) u = `user-${raw}`;
      const parts = [u];
      const cc = (country || "").toLowerCase();
      if (country) parts.push(`country-${cc}`);
      if (state && cc === "us") {
        const st = state.toLowerCase().replace(/\s+/g, "_");
        const slug = st.startsWith("us_") ? st : `us_${st}`;
        parts.push(`state-${slug}`);
      }
      if (city) parts.push(`city-${city.toLowerCase().replace(/\s+/g, "_")}`);
      if (sessionId) parts.push(`session-${sessionId}`);
      return parts.join("-");
    },
  },

  soax: {
    name: "SOAX",
    host: "proxy.soax.com",
    httpPort: 5000,
    socks5Port: 5001,
    settingsKeys: { user: "soaxProxyUser", pass: "soaxProxyPassword" },
    buildUsername(baseUser, { country, state, city, sessionId }) {
      let parts = [baseUser];
      if (country) parts.push(`cc-${country.toLowerCase()}`);
      if (state) parts.push(`st-${state.toLowerCase().replace(/\s+/g, "_")}`);
      if (city) parts.push(`city-${city.toLowerCase().replace(/\s+/g, "_")}`);
      if (sessionId) parts.push(`sessid-${sessionId}`);
      return parts.join("-");
    },
  },

  brightdata: {
    name: "Bright Data",
    host: "brd.superproxy.io",
    httpPort: 22225,
    socks5Port: 22226,
    settingsKeys: { user: "bdCustomer", zone: "bdZone", pass: "bdPassword" },
    buildUsername(customer, { zone, country, state, city, sessionId }) {
      let parts = [`lum-customer-${customer}`];
      if (zone) parts.push(`zone-${zone}`);
      if (country) parts.push(`country-${country.toLowerCase()}`);
      if (state) parts.push(`state-${state.toLowerCase().replace(/\s+/g, "_")}`);
      if (city) parts.push(`city-${city.toLowerCase().replace(/\s+/g, "_")}`);
      if (sessionId) parts.push(`session-${sessionId}`);
      return parts.join("-");
    },
  },
};

/* ────────────────── Get Provider Credentials ────────────────── */

function getProviderCredentials(providerId, settings) {
  const s = settings !== undefined && settings !== null ? settings : getSettings();
  const provider = PROVIDERS[providerId];
  if (!provider) return null;

  const keys = provider.settingsKeys;

  if (providerId === "brightdata") {
    const customer = s[keys.user] || "";
    const zone = s[keys.zone] || "";
    const pass = s[keys.pass] || "";
    if (!customer || !pass) return null;
    return { customer, zone, pass };
  }

  const user = s[keys.user] || "";
  const pass = s[keys.pass] || "";
  if (!user || !pass) return null;
  return { user, pass };
}

/* ────────────────── Unified Proxy Config ────────────────── */

/**
 * Generate a proxy config for any provider.
 *
 * @param {string} providerId - "nodemaven" | "smartproxy" | "soax" | "brightdata"
 * @param {object} opts
 * @param {string} opts.profileId - Multilogin profile ID
 * @param {object} opts.geo - { country, state, city }
 * @param {string} [opts.sessionId] - Reuse existing session ID
 * @param {string} [opts.protocol] - "http" | "socks5" (default: "http")
 * @param {object} [settingsOverride] - merged into stored settings (e.g. unsaved form state)
 * @returns {object} { host, port, username, password, protocol, sessionId, provider } | { error }
 */
export function getProxyConfig(providerId, opts = {}, settingsOverride) {
  const stored = mergedProxySettings(settingsOverride);
  const provider = PROVIDERS[providerId];
  if (!provider) return { error: `Unknown provider: ${providerId}` };

  const creds = getProviderCredentials(providerId, stored);
  if (!creds) return { error: `${provider.name} credentials not configured in Settings.` };

  const protocol = opts.protocol || "http";
  let port = protocol === "socks5" ? provider.socks5Port : provider.httpPort;
  const sessionId = opts.sessionId || generateSessionId(opts.profileId);
  const geo = opts.geo || {};

  let username;
  if (providerId === "brightdata") {
    username = provider.buildUsername(creds.customer, {
      zone: creds.zone,
      country: geo.country,
      state: geo.state,
      city: geo.city,
      sessionId,
    });
  } else {
    username = provider.buildUsername(creds.user, {
      country: geo.country,
      region: geo.state,
      state: geo.state,
      city: geo.city,
      sessionId,
      filter: opts.filter || "medium",
    });
  }

  let host = provider.host;
  if (providerId === "smartproxy") {
    const h = stored.spProxyHost;
    if (typeof h === "string" && h.trim()) host = h.trim();
    const hp = parseInt(String(stored.spProxyHttpPort ?? ""), 10);
    const sp = parseInt(String(stored.spProxySocksPort ?? ""), 10);
    if (protocol === "http" && Number.isFinite(hp) && hp > 0) port = hp;
    if (protocol === "socks5" && Number.isFinite(sp) && sp > 0) port = sp;
  }

  return {
    host,
    port,
    username,
    password: creds.pass || creds.password,
    protocol,
    sessionId,
    provider: providerId,
    providerName: provider.name,
  };
}

/**
 * Get proxy config with auto-fallback across providers.
 * Tries each provider in priority order until one succeeds (has credentials).
 *
 * @param {object} opts - Same as getProxyConfig + { providers?: string[] }
 * @param {object} [settingsOverride] - merged into stored settings (Settings tests / preview)
 * @returns {object} proxyConfig or { error }
 */
export function getProxyConfigWithFallback(opts = {}, settingsOverride) {
  const stored = mergedProxySettings(settingsOverride);
  const providers = opts.providers || getProviderFallbackOrder(stored);

  for (const providerId of providers) {
    const config = getProxyConfig(providerId, opts, settingsOverride);
    if (!config.error) return config;
  }

  return { error: "No proxy providers configured. Add credentials in Settings." };
}

/**
 * Convert unified proxy config to Multilogin format.
 */
export function toMultiloginFormat(proxyConfig) {
  if (proxyConfig.error) return null;
  return {
    type: proxyConfig.protocol === "socks5" ? "SOCKS5" : "HTTP",
    host: proxyConfig.host,
    port: proxyConfig.port,
    username: proxyConfig.username,
    password: proxyConfig.password,
  };
}

/**
 * Get list of available providers (those with configured credentials).
 * @param {object} [settingsOverride] - merged with persisted settings (e.g. LS.get("settings"))
 */
export function getAvailableProviders(settingsOverride) {
  const s = mergedProxySettings(settingsOverride);
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    name: p.name,
    configured: !!getProviderCredentials(id, s),
  }));
}

const MAX_POOL_GENERATE = 50;

/**
 * Build many distinct sticky-session proxy rows from saved provider credentials (no vendor "list" API —
 * residential gateways use one host:port + rotating username sessions).
 *
 * @param {string} providerId
 * @param {number} count - clamped 1..50
 * @param {{ country?: string, state?: string, city?: string, filter?: string, protocol?: string }} [geo]
 * @param {object} [settingsOverride]
 * @returns {{ rows: Array<{host:string,port:string,username:string,password:string,provider:string,country:string,state:string,city:string}> } | { error: string, rows: [] }}
 */
export function generateProxyPoolRowsFromSettings(providerId, count, geo = {}, settingsOverride) {
  const n = Math.min(MAX_POOL_GENERATE, Math.max(1, parseInt(String(count), 10) || 10));
  const stored = mergedProxySettings(settingsOverride);
  const filter = geo.filter || stored.nmProxyFilter || "medium";
  const rows = [];
  for (let i = 0; i < n; i++) {
    const profileKey = `pool_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`;
    const cfg = getProxyConfig(
      providerId,
      {
        profileId: profileKey,
        geo: {
          country: geo.country || "",
          state: geo.state || "",
          city: geo.city || "",
        },
        filter,
        protocol: geo.protocol || "http",
      },
      settingsOverride
    );
    if (cfg.error) {
      return { error: cfg.error, rows: [] };
    }
    rows.push({
      host: cfg.host,
      port: String(cfg.port),
      username: cfg.username,
      password: cfg.password,
      provider: providerId,
      country: (geo.country || "").toUpperCase(),
      state: geo.state || "",
      city: geo.city || "",
    });
  }
  return { rows };
}

/**
 * Get default/primary provider ID from settings.
 */
export function getPrimaryProvider() {
  const settings = getSettings();
  return settings.proxyPrimaryProvider || "nodemaven";
}

/* ────────────────── Export ────────────────── */

export const proxyProviders = {
  getProxyConfig,
  getProxyConfigWithFallback,
  getProviderFallbackOrder,
  toMultiloginFormat,
  getAvailableProviders,
  getPrimaryProvider,
  generateSessionId,
  generateProxyPoolRowsFromSettings,
  PROVIDERS,
};
