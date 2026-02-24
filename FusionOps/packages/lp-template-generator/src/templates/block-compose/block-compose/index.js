/**
 * block-compose Template
 * Registers the Variant Composition Engine as a standard template
 * in the existing FusionOps lp-template-generator template registry.
 *
 * Usage (existing API — no changes needed in FusionOps):
 *   generateTemplate('block-compose', siteConfig)
 *   // returns { 'index.html': '...', 'privacy/index.html': '...', 'terms/index.html': '...' }
 */

import { compose, getCompositionStats } from '../../composer/index.js';

/**
 * Generate function — matches existing template contract
 * @param {object} site - normalized config from schema.js
 * @returns {object} files map { filepath: content }
 */
export function generate(site) {
  // existingSelections can be passed via site._existingSelections
  // (set by FusionOps Wizard/VariantStudio before calling generateTemplate)
  const result = compose(site, {
    existingSelections: site._existingSelections || [],
    maxRetries: 5,
  });

  // Attach composition metadata to files as a manifest
  // FusionOps can read this to store blockSelection + hash in Neon/D1
  result.files['_manifest.json'] = JSON.stringify({
    blockSelection:    result.blockSelection,
    theme:             result.theme,
    hash:              result.hash,
    buildId:           result.buildId,
    attempts:          result.attempts,
    passedAntiCorr:    result.passedAntiCorrelation,
    maxSimilarity:     result.maxSimilarity,
    generatedAt:       new Date().toISOString(),
    brand:             site.brand,
    domain:            site.domain,
    templateId:        'block-compose',
  }, null, 2);

  return result.files;
}

/**
 * Template metadata for registry
 */
export const templateMeta = {
  name: 'Block Composer V2',
  description: 'Dynamic LP assembled from block library — millions of unique combinations with anti-similarity engine',
  badge: 'V2',
  category: 'compose',
  generate,
  config: getCompositionStats(),
};
