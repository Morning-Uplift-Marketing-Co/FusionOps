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
    return JSON.parse(localStorage.getItem("lp_settings") || "{}");
  } catch {
    return {};
  }
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
    host: "gate.smartproxy.com",
    httpPort: 10001,
    socks5Port: 10000,
    settingsKeys: { user: "spProxyUser", pass: "spProxyPassword" },
    buildUsername(baseUser, { country, state, city, sessionId }) {
      let parts = [baseUser];
      if (country) parts.push(`country-${country.toLowerCase()}`);
      if (state) parts.push(`state-${state.toLowerCase().replace(/\s+/g, "_")}`);
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

function getProviderCredentials(providerId) {
  const settings = getSettings();
  const provider = PROVIDERS[providerId];
  if (!provider) return null;

  const keys = provider.settingsKeys;

  if (providerId === "brightdata") {
    const customer = settings[keys.user] || "";
    const zone = settings[keys.zone] || "";
    const pass = settings[keys.pass] || "";
    if (!customer || !pass) return null;
    return { customer, zone, pass };
  }

  const user = settings[keys.user] || "";
  const pass = settings[keys.pass] || "";
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
 * @returns {object} { host, port, username, password, protocol, sessionId, provider } | { error }
 */
export function getProxyConfig(providerId, opts = {}) {
  const provider = PROVIDERS[providerId];
  if (!provider) return { error: `Unknown provider: ${providerId}` };

  const creds = getProviderCredentials(providerId);
  if (!creds) return { error: `${provider.name} credentials not configured in Settings.` };

  const protocol = opts.protocol || "http";
  const port = protocol === "socks5" ? provider.socks5Port : provider.httpPort;
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

  return {
    host: provider.host,
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
 * @returns {object} proxyConfig or { error }
 */
export function getProxyConfigWithFallback(opts = {}) {
  const settings = getSettings();
  const fallbackOrder = settings.proxyFallbackOrder
    ? JSON.parse(settings.proxyFallbackOrder)
    : ["nodemaven", "smartproxy", "soax", "brightdata"];

  const providers = opts.providers || fallbackOrder;

  for (const providerId of providers) {
    const config = getProxyConfig(providerId, opts);
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
 */
export function getAvailableProviders() {
  return Object.entries(PROVIDERS)
    .map(([id, p]) => ({
      id,
      name: p.name,
      configured: !!getProviderCredentials(id),
    }));
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
  toMultiloginFormat,
  getAvailableProviders,
  getPrimaryProvider,
  generateSessionId,
  PROVIDERS,
};
