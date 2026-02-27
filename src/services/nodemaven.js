/**
 * NodeMaven Proxy Service
 *
 * Manages NodeMaven residential proxy connections for Multilogin profiles.
 * Supports sticky sessions (up to 24h), IP rotation, geo-targeting,
 * and IP Quality Filter (low/medium/high).
 *
 * Proxy format:
 *   Host: gate.nodemaven.com
 *   HTTP ports: 8080–9080, 32000–33000
 *   SOCKS5 ports: 1080–2080, 42000–43000
 *   Username: {user}-country-{cc}-region-{r}-city-{c}-sid-{session}-filter-{level}
 *   Password: {password}
 *
 * Docs: https://docs.nodemaven.com
 * Dashboard: https://dashboard.nodemaven.com
 */

/* ────────────────── Constants ────────────────── */

const GATEWAY_HOST = "gate.nodemaven.com";
const HTTP_PORT = 8080;
const SOCKS5_PORT = 1080;

const FILTER_LEVELS = ["low", "medium", "high"];
const DEFAULT_FILTER = "medium";

/* ────────────────── Settings ────────────────── */

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem("lp_settings") || "{}");
  } catch {
    return {};
  }
}

function getCredentials() {
  const s = getSettings();
  return {
    user: s.nmProxyUser || "",
    password: s.nmProxyPassword || "",
  };
}

/* ────────────────── Session ID Generator ────────────────── */

/**
 * Generate a unique session ID for sticky sessions.
 * Format: profileId prefix + random hex (keeps session tied to profile).
 */
function generateSessionId(profileId) {
  const prefix = (profileId || "default").slice(0, 8).replace(/[^a-z0-9]/gi, "");
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${rand}`;
}

/* ────────────────── Username Builder ────────────────── */

/**
 * Build the NodeMaven proxy username string with targeting params.
 *
 * @param {object} opts
 * @param {string} opts.country    - ISO 2-letter country code (e.g. "us")
 * @param {string} [opts.region]   - Region/state (e.g. "california")
 * @param {string} [opts.city]     - City (e.g. "los_angeles")
 * @param {string} [opts.isp]      - ISP targeting
 * @param {string} [opts.sessionId]- Sticky session ID
 * @param {string} [opts.filter]   - IP quality filter: "low"|"medium"|"high"
 * @returns {string} formatted username
 */
function buildUsername(baseUser, opts = {}) {
  let parts = [baseUser];

  if (opts.country) {
    parts.push(`country-${opts.country.toLowerCase()}`);
  }
  if (opts.region) {
    parts.push(`region-${opts.region.toLowerCase().replace(/\s+/g, "_")}`);
  }
  if (opts.city) {
    parts.push(`city-${opts.city.toLowerCase().replace(/\s+/g, "_")}`);
  }
  if (opts.isp) {
    parts.push(`isp-${opts.isp.toLowerCase().replace(/\s+/g, "_")}`);
  }
  if (opts.sessionId) {
    parts.push(`sid-${opts.sessionId}`);
  }

  // Always apply quality filter for multi-account safety
  const filter = opts.filter || DEFAULT_FILTER;
  if (FILTER_LEVELS.includes(filter)) {
    parts.push(`filter-${filter}`);
  }

  return parts.join("-");
}

/* ────────────────── Proxy Config Generator ────────────────── */

/**
 * Generate a proxy configuration object ready for Multilogin.
 *
 * @param {object} opts
 * @param {string} opts.profileId  - Multilogin profile ID (used for session binding)
 * @param {string} opts.country    - Target country code
 * @param {string} [opts.region]   - Target region/state
 * @param {string} [opts.city]     - Target city
 * @param {string} [opts.filter]   - Quality filter level
 * @param {string} [opts.protocol] - "http" or "socks5" (default: "http")
 * @param {boolean} [opts.rotate]  - If true, generate new session ID (rotate IP)
 * @param {string} [opts.sessionId]- Explicit session ID (overrides auto-generate)
 * @returns {object} { host, port, username, password, protocol, sessionId }
 */
function getProxyConfig(opts = {}) {
  const creds = getCredentials();
  if (!creds.user || !creds.password) {
    return { error: "NodeMaven credentials not configured. Set nmProxyUser and nmProxyPassword in Settings." };
  }

  const protocol = opts.protocol || "http";
  const port = protocol === "socks5" ? SOCKS5_PORT : HTTP_PORT;

  // Generate or reuse session ID for sticky sessions
  const sessionId = opts.sessionId || generateSessionId(opts.profileId);

  const username = buildUsername(creds.user, {
    country: opts.country || "us",
    region: opts.region,
    city: opts.city,
    isp: opts.isp,
    sessionId,
    filter: opts.filter || DEFAULT_FILTER,
  });

  return {
    host: GATEWAY_HOST,
    port,
    username,
    password: creds.password,
    protocol,
    sessionId,
    // Formatted string for quick copy/paste or cURL testing
    proxyUrl: `${protocol}://${username}:${creds.password}@${GATEWAY_HOST}:${port}`,
  };
}

/**
 * Rotate IP: Generate a new proxy config with a fresh session ID.
 * Use this when pre-flight check fails and we need a different IP.
 */
function rotateProxy(opts = {}) {
  return getProxyConfig({
    ...opts,
    sessionId: generateSessionId(opts.profileId), // force new session
    rotate: true,
  });
}

/* ────────────────── IP Resolution (via proxy) ────────────────── */

/**
 * Resolve the actual IP address assigned by the proxy.
 * Makes a request through the Worker proxy endpoint to avoid CORS.
 *
 * @param {object} proxyConfig - from getProxyConfig()
 * @returns {object} { ip, country, city, isp, org, ... } or { error }
 */
async function resolveIP(proxyConfig) {
  if (proxyConfig.error) return proxyConfig;

  try {
    // Route through our Worker which will connect via the proxy
    const apiBase = getSettings().apiBase || "";
    const workerBase = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;

    const res = await fetch(`${workerBase}/api/proxy/resolve-ip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: proxyConfig.host,
        port: proxyConfig.port,
        username: proxyConfig.username,
        password: proxyConfig.password,
        protocol: proxyConfig.protocol,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { error: `Failed to resolve IP: HTTP ${res.status}` };
    }

    return res.json();
  } catch (e) {
    return { error: `IP resolution failed: ${e.message}` };
  }
}

/* ────────────────── Format for Multilogin Profile ────────────────── */

/**
 * Convert our proxy config to the format expected by Multilogin's updateProfile API.
 *
 * @param {object} proxyConfig - from getProxyConfig()
 * @param {string} [type]      - "http"|"socks5" (default: from config)
 * @returns {object} MLX proxy object for PATCH /profile/update
 */
function toMultiloginFormat(proxyConfig) {
  if (proxyConfig.error) return null;

  return {
    type: proxyConfig.protocol === "socks5" ? "SOCKS5" : "HTTP",
    host: proxyConfig.host,
    port: proxyConfig.port,
    username: proxyConfig.username,
    password: proxyConfig.password,
  };
}

/* ────────────────── Connection Test ────────────────── */

/**
 * Quick test: generate a proxy config and try to resolve IP.
 * Used by Settings UI to verify credentials.
 */
async function testConnection(opts = {}) {
  const config = getProxyConfig({
    profileId: "test",
    country: opts.country || "us",
    filter: opts.filter || "medium",
  });

  if (config.error) return config;

  const ipResult = await resolveIP(config);
  if (ipResult.error) return { error: ipResult.error, config };

  return {
    success: true,
    ip: ipResult.ip || ipResult.query,
    country: ipResult.country,
    city: ipResult.city,
    isp: ipResult.isp,
    org: ipResult.org,
    config,
  };
}

/* ────────────────── Public API ────────────────── */

export const nodemavenApi = {
  // Config
  getProxyConfig,
  rotateProxy,
  toMultiloginFormat,
  buildUsername,
  generateSessionId,

  // Network
  resolveIP,
  testConnection,

  // Constants
  GATEWAY_HOST,
  HTTP_PORT,
  SOCKS5_PORT,
  FILTER_LEVELS,
  DEFAULT_FILTER,
};
