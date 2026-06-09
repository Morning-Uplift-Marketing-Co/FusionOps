/**
 * Browser-safe deterministic hashing helpers.
 *
 * Used anywhere we need stable seeding in code that may be bundled for the
 * browser, so we do not depend on `node:crypto` at build time.
 */

function normalizeInput(value) {
  return String(value ?? '');
}

/**
 * 53-bit deterministic hash for stable seeding.
 * Based on a common cyrb53-style mixer, but kept local so we avoid runtime
 * dependency on Node crypto in browser bundles.
 */
export function hash53(input, seed = 0) {
  const str = normalizeInput(input);
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Produce a stable hex seed string for seeded RNGs.
 */
export function seedHex(input, length = 10) {
  const hex = hash53(input).toString(16).padStart(13, '0');
  return hex.slice(0, length);
}
