import {
    getAllTemplates as fetchAllTemplates,
    getTemplateById as fetchTemplateById,
    resolveTemplateId,
    getTemplateDiagnostics as fetchTemplateDiagnostics,
    resolveWizardCategory as fetchWizardCategory,
} from "../../utils/template-registry.js";

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

export function getTemplateDiagnostics(templates, options) {
    return fetchTemplateDiagnostics(templates, options);
}

export function resolveWizardCategory(template) {
    return fetchWizardCategory(template);
}
