import { buildPreviewHtml } from "./template-preview-runtime.js";

/** Same API host resolution as api.js / template-utils (strip trailing /api for absolute preview asset URLs). */
export function workerOriginForTemplateAssets() {
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

/**
 * Inject <base href> so dist/index.html loaded in an iframe resolves `/_astro/*` via Worker preview.
 * Skips if a base href already exists.
 * @param {string} html
 * @param {string} dbId — Template UUID in API
 * @returns {string}
 */
export function injectDistPreviewBase(html, dbId) {
    const body = String(html || "");
    if (!body.trim() || !dbId) return body;
    if (/<base\s+[^>]*href\s*=/i.test(body)) return body;
    const origin = workerOriginForTemplateAssets();
    const baseHref = `${origin}/api/templates/${encodeURIComponent(dbId)}/preview/dist/`;
    const tag = `<base href="${baseHref}">`;
    if (body.includes("</head>")) {
        return body.replace("</head>", `${tag}\n</head>`);
    }
    if (/<head(\s[^>]*)?>/i.test(body)) {
        return body.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${tag}`);
    }
    return `<!DOCTYPE html><html><head>${tag}</head><body>${body}</body></html>`;
}
