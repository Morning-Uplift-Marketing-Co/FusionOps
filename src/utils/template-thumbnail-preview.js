import { buildPreviewHtml } from "./template-preview-runtime.js";

/** Same API host resolution as api.js / template-utils (strip trailing /api for absolute preview asset URLs). */
function workerOriginForTemplateAssets() {
    const fromWindow = typeof window !== "undefined" ? window.__LP_API__ : "";
    const fromEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_API_BASE : "";
    const fallback = "https://lp-factory-api.misty-feather-556e.workers.dev/api";
    const raw = String(fromWindow || fromEnv || fallback).replace(/\/+$/, "");
    return raw.endsWith("/api") ? raw.slice(0, -4) : raw;
}

/**
 * Build the same HTML as Template Manager / Preview modal, with asset base pointing at
 * Worker /preview/dist so dist/_astro and relative files load during screenshot.
 *
 * @param {Record<string, string>} files
 * @param {{ dbId: string, brand?: string }} opts
 */
export function buildThumbnailPreviewDocument(files, { dbId, brand }) {
    const origin = workerOriginForTemplateAssets();
    const basePath = `${origin}/api/templates/${encodeURIComponent(dbId)}/preview/dist/`;
    return buildPreviewHtml(files || {}, { brand: brand || "Preview" }, null, basePath);
}
