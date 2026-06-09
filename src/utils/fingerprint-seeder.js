/**
 * Fingerprint Seeder
 * ==================
 * Deterministic seed derivation and RNG for anti-fingerprinting.
 *
 * Key insight: Same siteId + namespace ALWAYS produces same random sequence.
 * This enables redeploys to produce byte-identical output (determinism).
 *
 * Algorithm:
 * 1. Hash: SHA256(siteId + ':' + namespace) → hex digest
 * 2. Seed: Take first 10 chars, convert to number
 * 3. RNG: seedrandom(String(seed)) → reproducible random sequence
 */

import seedrandom from 'seedrandom';
import { seedHex } from './deterministic-hash.js';

/**
 * Create deterministic RNG from siteId + namespace
 *
 * Same input ALWAYS produces same RNG sequence across multiple calls.
 * Different namespaces get different seeds (no collisions).
 *
 * @param {string} siteId - unique site identifier
 * @param {string} namespace - feature namespace (e.g., 'classNames', 'domAttributes')
 * @returns {Function} seeded RNG with .random() method returning [0, 1)
 */
export function createDeterministicRng(siteId, namespace = 'default') {
  // Create deterministic hash from siteId + namespace
  const seedInput = `${siteId}:${namespace}`;
  const seedNumber = parseInt(seedHex(seedInput, 10), 16);

  // Create seeded RNG: same seed input → identical sequence
  const rng = seedrandom(String(seedNumber));

  return rng;
}

/**
 * Generate deterministic random string
 *
 * Same siteId → same string every time.
 * Used for class names, IDs, meta tag variations.
 *
 * @param {string} siteId - unique site identifier
 * @param {string} namespace - feature namespace for seeding
 * @param {number} length - desired string length
 * @param {string} charset - character set to choose from
 * @returns {string} deterministic random string
 */
export function generateDeterministicString(
  siteId,
  namespace,
  length = 8,
  charset = 'abcdefghijklmnopqrstuvwxyz0123456789'
) {
  const rng = createDeterministicRng(siteId, namespace);
  let result = '';

  for (let i = 0; i < length; i++) {
    const idx = Math.floor(rng() * charset.length);
    result += charset[idx];
  }

  return result;
}

/**
 * Create mapping: original className → randomized className
 *
 * All mappings for same siteId are deterministic.
 * Tailwind utilities (md:, hover:, etc.) are NOT randomized.
 *
 * @param {string} siteId - unique site identifier
 * @param {string[]} classNames - list of CSS class names to randomize
 * @returns {Record<string, string>} { "original-class": "xyz123", ... }
 */
export function createClassNameMap(siteId, classNames) {
  const map = {};
  const usedNames = new Set();

  for (const className of classNames) {
    // Skip Tailwind utility classes (no fingerprinting benefit)
    if (isTailwindUtility(className)) {
      map[className] = className;
      continue;
    }

    // Generate unique randomized name
    let randomized;
    let attempts = 0;
    do {
      randomized = generateDeterministicString(siteId, `className:${className}:${attempts}`, 6);
      attempts++;
    } while (usedNames.has(randomized) && attempts < 100);

    if (attempts >= 100) {
      // Fallback to original if can't find unique name (unlikely)
      randomized = className;
    }

    usedNames.add(randomized);
    map[className] = randomized;
  }

  return map;
}

/**
 * Check if className is a Tailwind utility
 * @param {string} className
 * @returns {boolean}
 */
function isTailwindUtility(className) {
  // Tailwind utilities: sm:, md:, lg:, xl:, 2xl:, dark:, hover:, focus:, etc.
  return /^(sm|md|lg|xl|2xl|dark|light|hover|focus|active|group|sr-only|before|after|first|last|odd|even)(:|-|\/|_)/.test(className);
}
