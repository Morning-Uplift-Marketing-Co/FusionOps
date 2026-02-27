/**
 * Template Registry v2
 * ====================
 * - Register templates with generate() function
 * - Validate output: must return { files: { path: string } }
 * - Every file must be a string (no undefined, no objects)
 */

const _templates = new Map();

/**
 * Register a template
 * @param {string} id 
 * @param {{ name: string, description: string, niche: string, generate: Function }} tmpl 
 */
export function registerTemplate(id, tmpl) {
  if (!id || typeof id !== 'string') throw new Error('Template ID must be a non-empty string');
  if (!tmpl?.generate || typeof tmpl.generate !== 'function') throw new Error(`Template "${id}" must have a generate() function`);

  _templates.set(id, {
    id,
    name: tmpl.name || id,
    description: tmpl.description || '',
    niche: tmpl.niche || 'general',
    badge: tmpl.badge || '',
    generate: tmpl.generate,
  });
}

/** Get a registered template */
export function getTemplate(id) {
  return _templates.get(id) || null;
}

/** Check if template exists */
export function hasTemplate(id) {
  return _templates.has(id);
}

/** List all templates (metadata only) */
export function listTemplates() {
  return Array.from(_templates.values()).map(t => ({
    id: t.id, name: t.name, description: t.description, niche: t.niche, badge: t.badge,
  }));
}

/** Clear registry (for testing) */
export function clearTemplates() {
  _templates.clear();
}
