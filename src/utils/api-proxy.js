/**
 * API Proxy resolver
 *
 * Routes Cloudflare & Multilogin API calls through the same backend API base
 * used by the app, so environments stay consistent (local/staging/prod).
 *
 * Routes:
 *   /api/proxy/cf/*   → api.cloudflare.com/client/v4/*
 *   /api/proxy/mlx/*  → api.multilogin.com/*
 */

const DEFAULT_API_BASE = "https://lp-factory-api.songsawat-w.workers.dev/api";

function getApiBase() {
  const fromWindow = typeof window !== "undefined" ? window.__LP_API__ : "";
  const fromEnv = typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_API_BASE
    : "";
  const isLocalDev = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

  const fallback = isLocalDev ? "/api" : DEFAULT_API_BASE;
  return String(fromWindow || fromEnv || fallback).replace(/\/+$/, "");
}

function getWorkerBase() {
  const apiBase = getApiBase();
  return apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;
}

/**
 * Get Cloudflare API base URL.
 * All environments route through the Worker proxy to avoid CORS.
 *
 * Equivalent to: https://api.cloudflare.com/client/v4
 */
export function getCfApiBase(/* settings */) {
  return `${getWorkerBase()}/api/proxy/cf`;
}

/**
 * Get Multilogin API base URL.
 * All environments route through the Worker proxy to avoid CORS.
 *
 * Equivalent to: https://api.multilogin.com
 */
export function getMlxApiBase(/* settings */) {
  return `${getWorkerBase()}/api/proxy/mlx`;
}
