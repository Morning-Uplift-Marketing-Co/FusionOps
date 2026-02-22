// Resolve API base URL from environment variables
function resolveApiBase() {
    const fromWindow = typeof window !== "undefined" ? window.__LP_API__ : "";
    const fromEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_API_BASE : "";
    const isLocalDev = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

    // Default production API base - should be overridden by VITE_API_BASE
    const PROD_API_BASE = import.meta.env?.VITE_API_BASE || "https://lp-factory-api.songsawat-w.workers.dev/api";
    const fallback = isLocalDev ? "/api" : PROD_API_BASE;
    return String(fromWindow || fromEnv || fallback).replace(/\/+$/, "");
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

    const headers = {
        ...opts.headers,
        ...(isMutation && { "X-CSRF-Token": getCsrfToken() }),
    };

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);

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
        // Don't expose detailed error messages in production
        const isDev = import.meta.env?.DEV || false;
        return {
            error: `HTTP ${r.status}`,
            detail: isDev ? text : "Request failed",
            url,
        };
    }

    // Validate content-type before parsing JSON
    const contentType = r.headers.get("content-type");
    if (contentType && !contentType.includes("application/json")) {
        console.warn("[API] Unexpected content-type:", contentType);
        // Still try to parse, but log the warning
    }

    return r.json();
}

export const api = {
    get: (path) => request(path),
    post: (path, data) => request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    put: (path, data) => request(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    del: (path) => request(path, { method: "DELETE" }),
    patch: (path, data) => request(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    delBody: (path, data) => request(path, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
};
