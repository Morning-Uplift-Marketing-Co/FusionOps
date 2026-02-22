/**
 * Multilogin X API Service — Direct Integration
 *
 * Two API layers:
 *   1. Remote API  → https://api.multilogin.com  (auth, profile CRUD, folders)
 *   2. Local Launcher → https://launcher.mlx.yt:45001 (start / stop / quick profiles)
 *
 * Docs: https://multilogin.com/help/en_US/api
 * Postman: https://documenter.getpostman.com/view/28533318/2s946h9Cv9
 */

import { getMlxApiBase } from "../utils/api-proxy.js";

/* ────────────────── Constants ────────────────── */

const LAUNCHER_BASE = "https://launcher.mlx.yt:45001";

function getMLXBase() {
  return getMlxApiBase();
}

// Exposed for UI display
const MLX_BASE_DISPLAY = "https://api.multilogin.com";

/* ────────────────── MD5 (for password hashing per MLX spec) ─── */

function md5(str) {
    function safeAdd(x, y) { const l = (x & 0xFFFF) + (y & 0xFFFF); return ((x >> 16) + (y >> 16) + (l >> 16)) << 16 | l & 0xFFFF; }
    function bitRol(n, c) { return (n << c) | (n >>> (32 - c)); }
    function md5cmn(q, a, b, x, s, t) { return safeAdd(bitRol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
    function md5ff(a, b, c, d, x, s, t) { return md5cmn((b & c) | (~b & d), a, b, x, s, t); }
    function md5gg(a, b, c, d, x, s, t) { return md5cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function md5hh(a, b, c, d, x, s, t) { return md5cmn(b ^ c ^ d, a, b, x, s, t); }
    function md5ii(a, b, c, d, x, s, t) { return md5cmn(c ^ (b | ~d), a, b, x, s, t); }
    function binlMD5(x, len) {
        x[len >> 5] |= 0x80 << (len % 32);
        x[((len + 64) >>> 9 << 4) + 14] = len;
        let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
        for (let i = 0; i < x.length; i += 16) {
            const oa = a, ob = b, oc = c, od = d;
            a = md5ff(a, b, c, d, x[i], 7, -680876936); d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
            c = md5ff(c, d, a, b, x[i + 2], 17, 606105819); b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
            a = md5ff(a, b, c, d, x[i + 4], 7, -176418897); d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
            c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341); b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
            a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416); d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
            c = md5ff(c, d, a, b, x[i + 10], 17, -42063); b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682); d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290); b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
            a = md5gg(a, b, c, d, x[i + 1], 5, -165796510); d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
            c = md5gg(c, d, a, b, x[i + 11], 14, 643717713); b = md5gg(b, c, d, a, x[i], 20, -373897302);
            a = md5gg(a, b, c, d, x[i + 5], 5, -701558691); d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
            c = md5gg(c, d, a, b, x[i + 15], 14, -660478335); b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
            a = md5gg(a, b, c, d, x[i + 9], 5, 568446438); d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
            c = md5gg(c, d, a, b, x[i + 3], 14, -187363961); b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
            a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467); d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
            c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473); b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
            a = md5hh(a, b, c, d, x[i + 5], 4, -378558); d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
            c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562); b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060); d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
            c = md5hh(c, d, a, b, x[i + 7], 16, -155497632); b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = md5hh(a, b, c, d, x[i + 13], 4, 681279174); d = md5hh(d, a, b, c, x[i], 11, -358537222);
            c = md5hh(c, d, a, b, x[i + 3], 16, -722521979); b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
            a = md5hh(a, b, c, d, x[i + 9], 4, -640364487); d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = md5hh(c, d, a, b, x[i + 15], 16, 530742520); b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
            a = md5ii(a, b, c, d, x[i], 6, -198630844); d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
            c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905); b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
            a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571); d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
            c = md5ii(c, d, a, b, x[i + 10], 15, -1051523); b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
            a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359); d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380); b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
            a = md5ii(a, b, c, d, x[i + 4], 6, -145523070); d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = md5ii(c, d, a, b, x[i + 2], 15, 718787259); b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
            a = safeAdd(a, oa); b = safeAdd(b, ob); c = safeAdd(c, oc); d = safeAdd(d, od);
        }
        return [a, b, c, d];
    }
    function rstrMD5(s) {
        const bin = binlMD5(str2binl(s), s.length * 8);
        let r = "";
        for (let i = 0; i < bin.length * 32; i += 8)
            r += String.fromCharCode((bin[i >> 5] >>> (i % 32)) & 0xFF);
        return r;
    }
    function str2binl(s) {
        const bin = [];
        for (let i = 0; i < s.length * 8; i += 8)
            bin[i >> 5] |= (s.charCodeAt(i / 8) & 0xFF) << (i % 32);
        return bin;
    }
    function hexMD5(s) {
        const hex = "0123456789abcdef";
        const raw = rstrMD5(s);
        let r = "";
        for (let i = 0; i < raw.length; i++)
            r += hex.charAt((raw.charCodeAt(i) >>> 4) & 0x0F) + hex.charAt(raw.charCodeAt(i) & 0x0F);
        return r;
    }
    return hexMD5(str);
}

/* ────────────────── Token state ─────────────────── */

let _token = null;
let _tokenSetAt = 0;
const TOKEN_TTL_MS = 25 * 60 * 1000; // refresh 5 min before 30-min expiry

function setToken(t) {
    _token = t;
    _tokenSetAt = Date.now();
}

function getToken() {
    return _token;
}

function isTokenExpired() {
    if (!_token) return true;
    return (Date.now() - _tokenSetAt) > TOKEN_TTL_MS;
}

/* ────────────────── Settings access ─────────────── */

function getSettings() {
    try {
        return JSON.parse(localStorage.getItem("lp_settings") || "{}");
    } catch { return {}; }
}

function getSavedToken() {
    return getSettings().mlToken || null;
}

/* ────────────────── Generic fetch helpers ────────── */

const HEADERS_JSON = { "Accept": "application/json", "Content-Type": "application/json" };

function authHeaders(token) {
    return { ...HEADERS_JSON, "Authorization": `Bearer ${token || _token}` };
}

async function mlxFetch(url, opts = {}) {
    try {
        const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
        if (!r.ok) {
            const text = await r.text().catch(() => "");
            return { error: `HTTP ${r.status}`, detail: text, status: r.status };
        }
        const contentType = r.headers.get("content-type") || "";
        if (contentType.includes("json")) return r.json();
        return { data: await r.text() };
    } catch (e) {
        return { error: e.message || "Network error", detail: String(e) };
    }
}

/* ────────────────────────────────────────────────────
   REMOTE API — https://api.multilogin.com
   ──────────────────────────────────────────────────── */

/**
 * Sign in with email + MD5(password).
 * Returns { data: { token, refresh_token } } on success.
 * Ref: POST /user/signin
 */
async function signin(email, password) {
    if (!email || !password) return { error: "Email and password required" };
    const payload = {
        email,
        password: md5(password),
    };
    const res = await mlxFetch(`${getMLXBase()}/user/signin`, {
        method: "POST",
        headers: HEADERS_JSON,
        body: JSON.stringify(payload),
    });
    if (res.data?.token) {
        setToken(res.data.token);
    }
    return res;
}

/**
 * Refresh an expired token.
 * Ref: POST /user/refresh-token (uses bearer)
 */
async function refreshToken(token) {
    const t = token || _token || getSavedToken();
    if (!t) return { error: "No token to refresh" };
    const res = await mlxFetch(`${getMLXBase()}/user/refresh-token`, {
        method: "POST",
        headers: authHeaders(t),
    });
    if (res.data?.token) {
        setToken(res.data.token);
    }
    return res;
}

/**
 * Ensure we have a valid token; refresh if close to expiry.
 * Returns the current token string or null.
 */
async function ensureToken() {
    // Prefer in-memory token
    if (_token && !isTokenExpired()) return _token;
    // Try saved token from settings
    const saved = getSavedToken();
    if (saved && !_token) {
        setToken(saved);
        return saved;
    }
    // Try refresh
    if (_token || saved) {
        const res = await refreshToken(_token || saved);
        if (res.data?.token) return res.data.token;
    }
    // Try auto-signin from settings
    const s = getSettings();
    if (s.mlEmail && s.mlPassword) {
        const res = await signin(s.mlEmail, s.mlPassword);
        if (res.data?.token) return res.data.token;
    }
    return null;
}

/**
 * Generate a long-lived automation token.
 * Ref: GET /workspace/automation_token?expiration_period=...
 * expiration_period examples: "1h", "1d", "7d", "30d"
 */
async function getAutomationToken(expiration = "30d") {
    const token = await ensureToken();
    if (!token) return { error: "Not authenticated. Sign in first." };
    return mlxFetch(`${getMLXBase()}/workspace/automation_token?expiration_period=${expiration}`, {
        method: "GET",
        headers: authHeaders(token),
    });
}

/**
 * Search profiles.
 * Ref: POST /profile/search
 */
async function getProfiles(opts = {}) {
    const token = await ensureToken();
    if (!token) return { error: "Not authenticated" };
    const body = {
        is_removed: false,
        limit: opts.limit || 100,
        offset: opts.offset || 0,
        search_text: opts.search || "",
        storage_type: opts.storage_type || "all",
        order_by: opts.order_by || "created_at",
        sort: opts.sort || "desc",
    };
    return mlxFetch(`${getMLXBase()}/profile/search`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(body),
    });
}

/**
 * Create a browser profile.
 * Ref: POST /profile/create
 */
async function createProfile(profileData) {
    const token = await ensureToken();
    if (!token) return { error: "Not authenticated" };
    return mlxFetch(`${getMLXBase()}/profile/create`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(profileData),
    });
}

/**
 * Update a profile.
 * Ref: PATCH /profile/update
 */
async function updateProfile(data) {
    const token = await ensureToken();
    if (!token) return { error: "Not authenticated" };
    return mlxFetch(`${getMLXBase()}/profile/update`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify(data),
    });
}

/**
 * Delete profiles by IDs.
 * Ref: DELETE /profile/delete
 */
async function deleteProfiles(ids, folderId) {
    const token = await ensureToken();
    if (!token) return { error: "Not authenticated" };
    return mlxFetch(`${getMLXBase()}/profile/delete`, {
        method: "DELETE",
        headers: authHeaders(token),
        body: JSON.stringify({ ids, folder_id: folderId }),
    });
}

/**
 * Clone a profile.
 * Ref: POST /profile/clone
 */
async function cloneProfile(profileId) {
    const token = await ensureToken();
    if (!token) return { error: "Not authenticated" };
    return mlxFetch(`${getMLXBase()}/profile/clone`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ id: profileId }),
    });
}

/**
 * Get profile metadata.
 * Ref: POST /profile/metas
 */
async function getProfileMetas(ids) {
    const token = await ensureToken();
    if (!token) return { error: "Not authenticated" };
    return mlxFetch(`${getMLXBase()}/profile/metas`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ ids }),
    });
}

/**
 * List folders.
 * Ref: GET /folder (uses bearer)
 */
async function getFolders() {
    const token = await ensureToken();
    if (!token) return { error: "Not authenticated" };
    return mlxFetch(`${getMLXBase()}/folder`, {
        method: "GET",
        headers: authHeaders(token),
    });
}

/* ────────────────────────────────────────────────────
   LOCAL LAUNCHER — https://launcher.mlx.yt:45001
   ──────────────────────────────────────────────────── */

/**
 * Check if the MLX desktop launcher is running.
 * Ref: GET /api/v1/version
 */
async function checkLauncher() {
    return mlxFetch(`${LAUNCHER_BASE}/api/v1/version`, {
        method: "GET",
        headers: HEADERS_JSON,
    });
}

/**
 * Start a browser profile via the local launcher.
 * Ref: POST /api/v2/profile/f/{folder_id}/p/{profile_id}/start
 *
 * @param {string} profileId
 * @param {string} folderId
 * @param {object} opts - { automation: "selenium"|"puppeteer"|"playwright", headless: true|false }
 */
async function startProfile(profileId, folderId, opts = {}) {
    const fid = folderId || getSettings().mlFolderId;
    if (!fid) return { error: "Folder ID required to start a profile" };

    const token = await ensureToken();
    const params = new URLSearchParams();
    if (opts.automation) params.set("automation_type", opts.automation);
    if (opts.headless !== undefined) params.set("headless_mode", String(opts.headless));
    const qs = params.toString() ? `?${params.toString()}` : "";

    return mlxFetch(`${LAUNCHER_BASE}/api/v2/profile/f/${fid}/p/${profileId}/start${qs}`, {
        method: "GET",
        headers: token ? authHeaders(token) : HEADERS_JSON,
    });
}

/**
 * Stop a running profile via the local launcher.
 * Ref: GET /api/v1/profile/stop/p/{profile_id}
 */
async function stopProfile(profileId) {
    const token = await ensureToken();
    return mlxFetch(`${LAUNCHER_BASE}/api/v1/profile/stop/p/${profileId}`, {
        method: "GET",
        headers: token ? authHeaders(token) : HEADERS_JSON,
    });
}

/**
 * Get list of currently active/running profile IDs from launcher.
 * Ref: GET /api/v1/profile/active
 */
async function getActiveProfiles() {
    const token = await ensureToken();
    return mlxFetch(`${LAUNCHER_BASE}/api/v1/profile/active`, {
        method: "GET",
        headers: token ? authHeaders(token) : HEADERS_JSON,
    });
}

/**
 * Start a quick (temporary) profile.
 * Ref: POST /api/v2/profile/quick
 */
async function startQuickProfile(opts = {}) {
    const token = await ensureToken();
    return mlxFetch(`${LAUNCHER_BASE}/api/v2/profile/quick`, {
        method: "POST",
        headers: token ? authHeaders(token) : HEADERS_JSON,
        body: JSON.stringify(opts),
    });
}

/* ────────────────────────────────────────────────────
   SYNC (profile list from cloud → local launcher)
   ──────────────────────────────────────────────────── */

async function syncProfiles() {
    // Pull profiles from remote, compare with local state
    const remote = await getProfiles({ limit: 200 });
    if (remote.error) return remote;
    const profiles = remote.data?.profiles || [];
    return { data: profiles, created: profiles.length, deleted: 0 };
}

/* ────────────────────────────────────────────────────
   PUBLIC API (maintains same interface as before)
   ──────────────────────────────────────────────────── */

export const multiloginApi = {
    // Auth
    signin: (email, password) => signin(email, password),
    refreshToken: (token) => refreshToken(token),
    getAutomationToken: (expiration) => getAutomationToken(expiration),

    // Remote profile management
    getProfiles: (opts) => getProfiles(opts),
    createProfile: (data) => createProfile(data),
    updateProfile: (data) => updateProfile(data),
    deleteProfiles: (ids, folderId) => deleteProfiles(ids, folderId),
    cloneProfile: (id) => cloneProfile(id),
    getProfileMetas: (ids) => getProfileMetas(ids),
    getFolders: () => getFolders(),

    // Launcher operations
    checkLauncher: () => checkLauncher(),
    startProfile: (profileId, folderId, opts) => startProfile(profileId, folderId, opts),
    stopProfile: (profileId) => stopProfile(profileId),
    getActiveProfiles: () => getActiveProfiles(),
    startQuickProfile: (opts) => startQuickProfile(opts),

    // Sync
    syncProfiles: () => syncProfiles(),

    // Token management (for external use)
    setToken,
    getToken,
    ensureToken,
    isTokenExpired,

    // Constants (for UI display / testing)
    MLX_BASE: MLX_BASE_DISPLAY,
    LAUNCHER_BASE,
};
