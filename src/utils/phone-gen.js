/**
 * phone-gen.js
 * Deterministically generates a display-only toll-free phone number
 * from a site's domain or brand name.
 *
 * Rules:
 * - Always 1-8XX-XXX-XXXX format (toll-free prefixes: 800, 833, 844, 855, 866, 877, 888)
 * - Deterministic: same input → same output every time
 * - Last 7 digits avoid all-same, sequential, or 0000000 patterns
 * - Used for credibility/compliance display only — no tel: href
 */

const TOLL_FREE_PREFIXES = ['800', '833', '844', '855', '866', '877', '888'];

/**
 * Simple deterministic hash: djb2 variant
 * @param {string} str
 * @returns {number} unsigned 32-bit integer
 */
function hash32(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h;
}

/**
 * Seeded pseudo-random number generator (mulberry32)
 * @param {number} seed
 * @returns {() => number} function returning [0, 1)
 */
function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a 7-digit suffix that avoids degenerate patterns
 * @param {() => number} rng
 * @returns {string} "XXX-XXXX"
 */
function generate7Digits(rng) {
  const MAX_ATTEMPTS = 20;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const d = Array.from({ length: 7 }, () => Math.floor(rng() * 10));

    // Reject all-same digits (e.g. 0000000, 1111111)
    if (d.every(x => x === d[0])) continue;

    // Reject sequential runs (e.g. 1234567, 9876543)
    const isAsc = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
    const isDesc = d.every((x, i) => i === 0 || x === d[i - 1] - 1);
    if (isAsc || isDesc) continue;

    // Reject first 3 digits starting with 0 or 1 (looks fake for area code)
    if (d[0] === 0 || d[0] === 1) continue;

    return `${d.slice(0, 3).join('')}-${d.slice(3).join('')}`;
  }
  // Fallback — guaranteed non-degenerate
  return '232-7562';
}

/**
 * Generate a deterministic display-only toll-free phone number.
 *
 * @param {string} domain  - e.g. "bearloannow.com"
 * @param {string} [brand] - e.g. "BearLoanNow" (optional, used as salt)
 * @returns {string} e.g. "1-800-429-3817"
 */
export function generatePhone(domain = '', brand = '') {
  // Normalize inputs
  const domainClean = String(domain || '')
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .trim();

  const brandClean = String(brand || '').toLowerCase().trim();

  // Combine for seed — domain is primary, brand is salt
  const seed = hash32(domainClean || brandClean || 'fusionops');

  const rng = seededRng(seed);

  // Pick toll-free prefix deterministically
  const prefixIdx = Math.floor(rng() * TOLL_FREE_PREFIXES.length);
  const prefix = TOLL_FREE_PREFIXES[prefixIdx];

  // Generate 7 digits
  const suffix = generate7Digits(rng);

  return `1-${prefix}-${suffix}`;
}

/**
 * Format a phone number for display (plain text, no tel: link)
 * Returns the number wrapped in a <span> with no href
 *
 * @param {string} phone - e.g. "1-800-429-3817"
 * @returns {string} HTML span
 */
export function phoneDisplayHtml(phone) {
  return `<span class="font-medium tabular-nums">${phone}</span>`;
}
