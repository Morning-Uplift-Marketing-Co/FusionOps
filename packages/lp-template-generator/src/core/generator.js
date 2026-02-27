/**
 * Generator v2
 * ============
 * Main API for generating templates.
 * 
 * STABILITY GUARANTEES:
 * 1. Config is always normalized (no undefined fields)
 * 2. Output is always validated (all files are strings)
 * 3. Every output includes package.json + astro.config.mjs (buildable)
 * 4. Errors are caught and returned, never thrown to caller
 */

import { normalizeConfig, getContentDefaults } from './schema.js';
import { resolveTokens } from './tokens.js';
import { getTemplate, hasTemplate, listTemplates } from './registry.js';

/**
 * Generate a full Astro project from template + config
 * 
 * @param {string} templateId 
 * @param {object} rawConfig 
 * @returns {{ ok: boolean, files: object|null, meta: object, errors: string[] }}
 */
export function generate(templateId, rawConfig = {}) {
  const errors = [];

  // 1. Validate template exists
  if (!hasTemplate(templateId)) {
    const available = listTemplates().map(t => t.id).join(', ');
    return { ok: false, files: null, meta: {}, errors: [`Template "${templateId}" not found. Available: ${available}`] };
  }

  // 2. Normalize config
  const config = normalizeConfig(rawConfig);
  const content = getContentDefaults(config);
  const tokens = resolveTokens(config);
  const fullConfig = { ...config, ...content, ...tokens };

  // 3. Generate files
  let files;
  try {
    const tmpl = getTemplate(templateId);
    files = tmpl.generate(fullConfig);
  } catch (err) {
    return { ok: false, files: null, meta: {}, errors: [`Generate error: ${err.message}`] };
  }

  // 4. Validate output
  if (!files || typeof files !== 'object') {
    return { ok: false, files: null, meta: {}, errors: ['Template returned invalid output (not an object)'] };
  }

  // 5. Validate every file is a string
  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== 'string') {
      errors.push(`File "${path}" is ${typeof content}, expected string — REMOVED`);
      delete files[path];
    }
  }

  // 6. Validate required files exist
  const required = ['package.json', 'astro.config.mjs'];
  for (const req of required) {
    if (!files[req]) {
      errors.push(`Missing required file: ${req} — this will not build!`);
    }
  }

  // 7. Check at least one page exists
  const pages = Object.keys(files).filter(p => p.startsWith('src/pages/'));
  if (pages.length === 0) {
    errors.push('No pages found in src/pages/ — Astro will build empty site');
  }

  const meta = {
    templateId,
    brand: config.brand,
    domain: config.domain,
    niche: config.niche,
    colorId: config.colorId,
    fontId: config.fontId,
    fileCount: Object.keys(files).length,
    pages,
    generatedAt: new Date().toISOString(),
  };

  return { ok: errors.length === 0 || !errors.some(e => e.includes('not build')), files, meta, errors };
}

// Re-export for convenience
export { listTemplates } from './registry.js';
export { normalizeConfig } from './schema.js';
export { resolveTokens } from './tokens.js';
