/**
 * Main Generator Interface
 * Handles template generation with unified API
 */

import { registerTemplate, getTemplate, getTemplates, hasTemplate } from './template-registry.js';
import { normalizeConfig, getDynamicDefaults } from './schema.js';

/**
 * Generate files from template
 * @param {string} templateId - Template ID
 * @param {object} config - Site configuration
 * @returns {object} Files map { filepath: content }
 */
export function generateTemplate(templateId, config = {}) {
  if (!hasTemplate(templateId)) {
    throw new Error(`Template "${templateId}" not found. Available: ${getTemplates().map(t => t.id).join(', ')}`);
  }

  const normalized = normalizeConfig(config);
  const dynamic = getDynamicDefaults(normalized);
  const fullConfig = { ...normalized, ...dynamic };

  const template = getTemplate(templateId);
  return template.generate(fullConfig);
}

/**
 * Generate with validation
 * @param {string} templateId
 * @param {object} config
 * @param {object} options
 * @returns {object} { files, warnings, errors }
 */
export function generateTemplateSafe(templateId, config = {}, options = {}) {
  const warnings = [];
  const errors = [];

  try {
    if (!hasTemplate(templateId)) {
      errors.push(`Template "${templateId}" not found`);
      return { files: null, warnings, errors };
    }

    const files = generateTemplate(templateId, config);

    // Validate files output
    if (!files || typeof files !== 'object') {
      errors.push('Template did not return a valid files object');
      return { files: null, warnings, errors };
    }

    const fileCount = Object.keys(files).length;
    if (fileCount === 0) {
      warnings.push('Template generated no files');
    }

    if (options.validateFiles) {
      for (const [path, content] of Object.entries(files)) {
        if (typeof content !== 'string') {
          warnings.push(`File "${path}" has non-string content`);
        }
      }
    }

    return { files, warnings, errors };
  } catch (err) {
    errors.push(err.message);
    return { files: null, warnings, errors };
  }
}

/**
 * Get template info for UI display
 */
export function getTemplateInfo(templateId) {
  const template = getTemplate(templateId);
  if (!template) return null;

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    badge: template.badge,
    category: template.category,
    config: template.config,
  };
}

/**
 * List all available templates
 */
export function listTemplates() {
  return getTemplates();
}

// Export registry functions for external use
export { registerTemplate, getTemplate, getTemplates, hasTemplate };
export * from './template-registry.js';
export * from './schema.js';
