// Resolve API base URL from environment variables
function resolveApiBase() {
    const fromWindow = typeof window !== "undefined" ? window.__LP_API__ : "";
    const fromEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_API_BASE : "";
    const isLocalDev = typeof window !== "undefined" && (
        /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname) ||
        /^192\.168\./.test(window.location.hostname) ||
        /^10\./.test(window.location.hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname)
    );

    // Always fall back to production worker — /api proxy on localhost doesn't have all routes
    const PROD_API_BASE = "https://lp-factory-api.misty-feather-556e.workers.dev/api";
    return String(fromWindow || fromEnv || PROD_API_BASE).replace(/\/+$/, "");
}

function buildApiUrl(path) {
    const base = resolveApiBase();
    const cleanPath = String(path || "");

    // Prevent duplicated "/api/api/..." when API_BASE already contains "/api".
    if (base.endsWith("/api") && cleanPath.startsWith("/api/")) {
        return `${base}${cleanPath.slice(4)}`;
    }

    if (!cleanPath.startsWith("/")) {
        return `${base}/${cleanPath}`;
    }

    return `${base}${cleanPath}`;
}

// Simple CSRF token management
const CSRF_TOKEN_KEY = 'lpf2-csrf-token';

function getCsrfToken() {
    if (typeof window === "undefined") return "";
    // Get existing token or generate new one
    let token = sessionStorage.getItem(CSRF_TOKEN_KEY);
    if (!token) {
        token = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
        sessionStorage.setItem(CSRF_TOKEN_KEY, token);
    }
    return token;
}

async function request(path, opts = {}) {
    const url = buildApiUrl(path);

    // Add CSRF token to headers for state-changing operations
    const method = (opts.method || "GET").toUpperCase();
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    let isSameOrigin = true;
    if (typeof window !== "undefined") {
        try {
            const targetOrigin = new URL(url, window.location.origin).origin;
            isSameOrigin = targetOrigin === window.location.origin;
        } catch (_e) {
            isSameOrigin = true;
        }
    }

    const headers = {
        ...opts.headers,
        ...(isMutation && isSameOrigin && { "X-CSRF-Token": getCsrfToken() }),
    };

    // Longer timeout for registrar/automation endpoints (external APIs are slower)
    const isSlowEndpoint = url.includes('/automation/registrar') || url.includes('/cloudflare/');
    const timeoutMs = opts.timeout || (isSlowEndpoint ? 30000 : 10000);

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    let r;

    try {
        r = await fetch(url, { ...opts, headers, signal: controller.signal });
        clearTimeout(id);
    } catch (e) {
        clearTimeout(id);
        console.warn("[API] Network error or timeout:", e?.message || e);
        return {
            error: "NETWORK_ERROR",
            detail: e?.message || "Failed to fetch",
            url,
        };
    }

    if (!r.ok) {
        const text = await r.text().catch(() => '');
        // Parse JSON error body to extract real error message
        let errorMsg = `HTTP ${r.status}`;
        try {
            const parsed = JSON.parse(text);
            if (parsed?.error) errorMsg = parsed.error;
        } catch (_) {}
        return {
            error: errorMsg,
            detail: text,
            url,
        };
    }

    function buildTextError(status, text) {
        const trimmed = String(text || "").trim();
        return {
            error: trimmed || `HTTP ${status}`,
            detail: trimmed,
            url,
        };
    }

    const text = await r.text().catch(() => "");
    const contentType = r.headers.get("content-type") || "";
    const trimmed = text.trim();
    const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[");

    if (!trimmed) {
        return { ok: true };
    }

    if (!contentType.includes("application/json") && !looksLikeJson) {
        console.warn("[API] Non-JSON response body:", contentType || "unknown content-type", trimmed.slice(0, 200));
        return buildTextError(r.status, text);
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn("[API] Failed to parse JSON response:", e?.message || e, trimmed.slice(0, 200));
        return buildTextError(r.status, text);
    }
}

export const api = {
    get: (path) => request(path),
    post: (path, data) => request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    postForm: (path, formData) => request(path, { method: "POST", body: formData }),
    put: (path, data) => request(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    del: (path) => request(path, { method: "DELETE" }),
    patch: (path, data) => request(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    delBody: (path, data) => request(path, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
};
