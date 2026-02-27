import { getAllTemplates as fetchAllTemplates, getTemplateById as fetchTemplateById, resolveTemplateId } from "../../utils/template-registry.js";

export const DEFAULT_TEMPLATE_ID = "classic";

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
