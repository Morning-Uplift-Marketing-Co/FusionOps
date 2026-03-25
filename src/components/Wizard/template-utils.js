import {
    getAllTemplates as fetchAllTemplates,
    getTemplateById as fetchTemplateById,
    resolveTemplateId,
    getTemplateDiagnostics as fetchTemplateDiagnostics,
    resolveWizardCategory as fetchWizardCategory,
} from "../../utils/template-registry.js";

export const DEFAULT_TEMPLATE_ID = "classic";

/** Worker origin for template thumbnails stored as paths (matches StepDesign / API assets). */
const TEMPLATE_THUMB_ORIGIN = "https://lp-factory-api.misty-feather-556e.workers.dev";

/**
 * @param {{ thumbnailUrl?: string|null, thumbnailGeneratedAt?: string|null }} template
 * @returns {string|null} Full URL with cache-bust, or null
 */
export function buildTemplateThumbnailUrl(template) {
    if (!template?.thumbnailUrl) return null;
    const path = String(template.thumbnailUrl);
    const absolute = path.startsWith("http://") || path.startsWith("https://");
    const base = absolute ? "" : TEMPLATE_THUMB_ORIGIN;
    const qs = template.thumbnailGeneratedAt
        ? `?t=${new Date(template.thumbnailGeneratedAt).getTime()}`
        : "";
    return `${base}${path}${qs}`;
}

/**
 * Get template by ID with fallback to default
 */
export function getTemplateById(templateId) {
    const resolvedId = resolveTemplateId(templateId);
    return fetchTemplateById(resolvedId) || fetchTemplateById(DEFAULT_TEMPLATE_ID);
}

/**
 * Get all available templates
 */
export function getAllTemplates() {
    return fetchAllTemplates();
}

export function getTemplateDiagnostics(templates, options) {
    return fetchTemplateDiagnostics(templates, options);
}

export function resolveWizardCategory(template) {
    return fetchWizardCategory(template);
}
