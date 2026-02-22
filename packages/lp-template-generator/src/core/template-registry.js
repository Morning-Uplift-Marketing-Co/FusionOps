/**
 * Template Registry
 * Central registry for all available templates
 */

// Color definitions (shared across templates)
export const COLORS = [
  { id: 'ruby', name: 'Ruby Red', p: [350, 85, 62], s: [350, 75, 48], a: [40, 90, 55], bg: [350, 15, 97], fg: [220, 16, 15] },
  { id: 'blue', name: 'Ocean Blue', p: [210, 80, 52], s: [200, 70, 45], a: [180, 60, 45], bg: [210, 15, 97], fg: [210, 20, 20] },
  { id: 'green', name: 'Forest Green', p: [150, 70, 40], s: [140, 60, 45], a: [170, 60, 40], bg: [150, 15, 97], fg: [150, 20, 20] },
  { id: 'purple', name: 'Royal Purple', p: [270, 70, 50], s: [260, 60, 48], a: [290, 60, 45], bg: [270, 15, 97], fg: [270, 20, 20] },
  { id: 'orange', name: 'Sunset Orange', p: [25, 90, 55], s: [30, 80, 50], a: [40, 85, 50], bg: [30, 15, 97], fg: [25, 20, 20] },
];

// Font definitions
export const FONTS = [
  { id: 'dm-sans', name: 'DM Sans', family: "'DM Sans', system-ui, sans-serif", import: 'DM+Sans:wght@400;500;600;700&display=swap' },
  { id: 'inter', name: 'Inter', family: "'Inter', system-ui, sans-serif", import: 'Inter:wght@400;500;600;700&display=swap' },
  { id: 'space-grotesk', name: 'Space Grotesk', family: "'Space Grotesk', system-ui, sans-serif", import: 'Space+Grotesk:wght@400;500;600;700&display=swap' },
];

// Radius definitions
export const RADIUS = [
  { id: 'sm', name: 'Small', v: '0.375rem' },
  { id: 'md', name: 'Medium', v: '0.5rem' },
  { id: 'lg', name: 'Large', v: '0.75rem' },
];

// Loan type definitions
export const LOAN_TYPES = [
  { id: 'personal', label: 'Personal Loans' },
  { id: 'payday', label: 'Payday Loans' },
  { id: 'installment', label: 'Installment Loans' },
  { id: 'pdl', label: 'PDL Loans' },
];

// Template registry
const templates = new Map();

/**
 * Register a template
 */
export function registerTemplate(id, template) {
  if (!id || typeof id !== 'string') {
    throw new Error('Template ID is required and must be a string');
  }

  if (!template || typeof template !== 'object') {
    throw new Error('Template must be an object');
  }

  if (!template.generate || typeof template.generate !== 'function') {
    throw new Error('Template must have a generate() function');
  }

  templates.set(id, {
    id,
    name: template.name || id,
    description: template.description || '',
    badge: template.badge || '',
    category: template.category || 'general',
    generate: template.generate,
    config: template.config || {},
  });

  return templates.get(id);
}

/**
 * Get a template by ID
 */
export function getTemplate(id) {
  return templates.get(id);
}

/**
 * Get all templates
 */
export function getTemplates() {
  return Array.from(templates.values()).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    badge: t.badge,
    category: t.category,
  }));
}

/**
 * Check if template exists
 */
export function hasTemplate(id) {
  return templates.has(id);
}

/**
 * Unregister a template
 */
export function unregisterTemplate(id) {
  return templates.delete(id);
}

/**
 * Clear all templates
 */
export function clearTemplates() {
  templates.clear();
}
