/**
 * Capability Resolver
 * ===================
 * Merge manifest + auto-detect + user override with clear confidence tracking.
 *
 * Responsibilities:
 *   - Resolve capabilities from three sources: manifest (highest), auto-detect (fallback), user override
 *   - Apply priority: Manifest > User Override > Auto-Detect
 *   - Track confidence at each level
 *   - Return final capability set with source and confidence metadata
 *
 * Design:
 *   - Pure function, no side effects
 *   - User override always has highest priority for its specified keys
 *   - Manifest is used exclusively if present (no fallback to auto-detect)
 *   - Auto-detect used only if no manifest provided
 */

import { autoDetectCapabilities } from './capability-detector.js';

/**
 * @typedef {Object} ResolvedCapability
 * @property {boolean} value - Whether the capability is enabled
 * @property {number} confidence - Confidence score (0-1)
 * @property {string} reason - Human-readable explanation
 * @property {string} [source] - Source of the capability (manifest, auto-detect, user-override)
 */

/**
 * Resolve template capabilities from all available sources
 *
 * Resolution priority:
 * 1. User override (if specified): confidence = 1.0
 * 2. Manifest (if present and valid): confidence = 1.0
 * 3. Auto-detect (fallback): confidence = 0.6-0.95
 *
 * @param {Record<string, string>} files - File map { "path/file.ext": "content" }
 * @param {Object|null} manifest - Output from loadAndValidateManifest, or null
 * @param {Object} userOverride - User corrections { capabilityKey: boolean, ... }
 * @returns {Object} - Resolved capabilities with all 5 types
 *
 * @example
 * const manifest = { capabilities: { supportsCalculator: { value: true, confidence: 1.0 } } };
 * const override = { supportsSectionReorder: true };
 * const resolved = resolveCapabilities(files, manifest, override);
 * // Returns all 5 capabilities with manifest + override applied
 */
export function resolveCapabilities(files, manifest = null, userOverride = {}) {
  if (!files || typeof files !== 'object') {
    files = {};
  }
  if (!userOverride || typeof userOverride !== 'object') {
    userOverride = {};
  }

  let capabilities = {};

  // ─── Level 1: Manifest (if present and valid) ────────────────────────────

  if (manifest && manifest.capabilities && typeof manifest.capabilities === 'object') {
    // Use manifest exclusively; don't fallback to auto-detect
    capabilities = JSON.parse(JSON.stringify(manifest.capabilities)); // Deep copy
  } else {
    // ─── Level 2: Auto-Detect (if no manifest) ──────────────────────────────
    capabilities = autoDetectCapabilities(files);
  }

  // ─── Level 3: Apply User Overrides ──────────────────────────────────────

  for (const [capabilityKey, userValue] of Object.entries(userOverride)) {
    if (capabilities.hasOwnProperty(capabilityKey) && typeof userValue === 'boolean') {
      // Override the capability with user's explicit choice
      capabilities[capabilityKey] = {
        value: userValue,
        confidence: 1.0,
        reason: 'User-overridden in wizard',
      };
    }
  }

  // ─── Ensure all standard capabilities are present ────────────────────────

  const STANDARD_CAPABILITIES = [
    'supportsCalculator',
    'supportsSectionReorder',
    'supportsFormCustomization',
    'supportsCustomColors',
    'supportsImageUpload',
  ];

  for (const capKey of STANDARD_CAPABILITIES) {
    if (!capabilities.hasOwnProperty(capKey)) {
      // This shouldn't happen if manifest/auto-detect are correct,
      // but ensure completeness
      capabilities[capKey] = {
        value: false,
        confidence: 0,
        reason: 'Not detected',
      };
    }
  }

  return capabilities;
}
