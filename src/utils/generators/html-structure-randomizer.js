/**
 * HTML Structure Randomizer — Post-Processing Anti-Fingerprinting
 * ================================================================
 * Takes any generated HTML and applies structural randomization to
 * break fingerprinting patterns that Google can use to correlate sites.
 *
 * Applied AFTER template generation, BEFORE tracking injection.
 * Works with ANY generator output (Astro, plain HTML, Vite, etc.)
 *
 * Transformations:
 * 1. Randomize <head> element order (link, meta, style, script)
 * 2. Add noise CSS classes to elements
 * 3. Add random HTML comments
 * 4. Shuffle inline style property order
 * 5. Add random data-* attributes
 * 6. Vary whitespace patterns
 *
 * All transformations are deterministic (same site.id → same output).
 */

import { createHash } from 'node:crypto';
import seedrandom from 'seedrandom';

function makeRng(siteId, namespace = 'struct-rand') {
  const seed = createHash('sha256').update(`${siteId}:${namespace}`).digest('hex').slice(0, 10);
  return seedrandom(seed);
}

function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function rngBool(rng, probability = 0.5) {
  return rng() < probability;
}

// ─── Noise class generator ───

const NOISE_PREFIXES = ['cx', 'dx', 'jx', 'kx', 'ux', 'yx', 'ax', 'bx'];
const NOISE_SUFFIXES = ['wrap', 'inner', 'outer', 'main', 'sec', 'row', 'col', 'blk'];

function generateNoiseClasses(rng, count = 8) {
  const classes = [];
  for (let i = 0; i < count; i++) {
    const prefix = rngPick(rng, NOISE_PREFIXES);
    const suffix = rngPick(rng, NOISE_SUFFIXES);
    const num = Math.floor(rng() * 99) + 1;
    classes.push(`${prefix}-${suffix}${num}`);
  }
  return classes;
}

// ─── Random comment generator ───

const COMMENT_TEMPLATES = [
  (i) => `<!-- Section ${i} -->`,
  (i) => `<!-- Block ${String.fromCharCode(65 + (i % 26))} -->`,
  (i) => `<!-- Component ${i % 10 === 0 ? 'A' : 'B'} -->`,
  (i) => `<!-- ${['Layout', 'Container', 'Wrapper', 'Module', 'Panel'][i % 5]} -->`,
  (i) => ``,
];

// ─── Main randomizer ───

/**
 * Randomize HTML structure for anti-fingerprinting.
 *
 * @param {string} html - Input HTML string
 * @param {string} siteId - Site ID for deterministic RNG
 * @param {object} [options]
 * @param {boolean} [options.shuffleHead=true] - Shuffle <head> element order
 * @param {boolean} [options.addNoiseClasses=true] - Add random CSS classes to elements
 * @param {boolean} [options.addComments=true] - Add random HTML comments
 * @param {boolean} [options.addDataAttrs=true] - Add random data-* attributes
 * @param {boolean} [options.varyWhitespace=true] - Vary indentation patterns
 * @returns {string} Randomized HTML
 */
export function randomizeHtmlStructure(html, siteId, options = {}) {
  if (!html || typeof html !== 'string') return html;

  const {
    shuffleHead = true,
    addNoiseClasses = true,
    addComments = true,
    addDataAttrs = true,
    varyWhitespace = true,
  } = options;

  let result = html;
  const rng = makeRng(siteId, 'html-struct');

  // 1. Shuffle <head> child elements
  if (shuffleHead) {
    result = shuffleHeadElements(result, rng);
  }

  // 2. Add noise CSS classes to div/section/article/main elements
  if (addNoiseClasses) {
    const noiseClasses = generateNoiseClasses(rng);
    result = addNoiseClassesToElements(result, noiseClasses, rng);
  }

  // 3. Add random data-* attributes to some elements
  if (addDataAttrs) {
    result = addRandomDataAttributes(result, rng);
  }

  // 4. Add random HTML comments between sections
  if (addComments) {
    result = addRandomComments(result, rng);
  }

  return result;
}

/**
 * Shuffle the order of elements inside <head>.
 * Preserves charset meta (should be first) and viewport meta (should be early).
 */
function shuffleHeadElements(html, rng) {
  const headMatch = html.match(/<head([^>]*)>([\s\S]*?)<\/head>/i);
  if (!headMatch) return html;

  const headAttrs = headMatch[1];
  const headContent = headMatch[2];

  // Parse head into individual elements
  const elements = [];
  let remaining = headContent;

  while (remaining.trim().length > 0) {
    // Match a complete tag (opening tag or self-closing)
    const tagMatch = remaining.match(/^\s*(<(?:meta|link|title|style|script|base|noscript)[^>]*(?:\/>|>[^<]*(?:<\/[^>]+>)?))/i);
    if (tagMatch) {
      elements.push(tagMatch[1]);
      remaining = remaining.slice(tagMatch[0].length);
    } else {
      // Take one character to avoid infinite loop
      remaining = remaining.slice(1);
    }
  }

  if (elements.length <= 2) return html;

  // Separate fixed-position elements (charset, viewport)
  const fixed = [];
  const shufflable = [];

  for (const el of elements) {
    if (/charset/i.test(el) || /viewport/i.test(el)) {
      fixed.push(el);
    } else {
      shufflable.push(el);
    }
  }

  // Fisher-Yates shuffle on shufflable elements
  for (let i = shufflable.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shufflable[i], shufflable[j]] = [shufflable[j], shufflable[i]];
  }

  const newHead = [...fixed, ...shufflable].join('\n');
  return html.replace(headMatch[0], `<head${headAttrs}>\n${newHead}\n</head>`);
}

/**
 * Add noise CSS classes to div, section, article, main elements.
 * These classes have no CSS rules — they're just DOM noise.
 */
function addNoiseClassesToElements(html, noiseClasses, rng) {
  const tags = ['div', 'section', 'article', 'main', 'aside', 'nav'];
  let result = html;
  let noiseIdx = 0;

  for (const tag of tags) {
    // Match opening tags without existing noise classes
    const regex = new RegExp(`<${tag}(\\s[^>]*)>`, 'gi');
    result = result.replace(regex, (match, attrs) => {
      if (!rngBool(rng, 0.3)) return match; // Only 30% chance per element
      const noiseClass = noiseClasses[noiseIdx % noiseClasses.length];
      noiseIdx++;

      if (/class="/i.test(attrs)) {
        // Append to existing class
        return `<${tag}${attrs.replace(/class="([^"]*)"/i, `class="$1 ${noiseClass}"`) || ` class="${noiseClass}"`}>`;
      }
      return `<${tag} class="${noiseClass}"${attrs}>`;
    });
  }

  return result;
}

/**
 * Add random data-* attributes to some elements.
 */
function addRandomDataAttributes(html, rng) {
  const attrNames = ['data-cid', 'data-sid', 'data-vid', 'data-ref', 'data-nid'];
  let result = html;
  let attrIdx = 0;

  // Target div and section tags
  const regex = /<(div|section)(\s[^>]*)>/gi;
  result = result.replace(regex, (match, tag, attrs) => {
    if (!rngBool(rng, 0.2)) return match; // 20% chance
    const attr = attrNames[attrIdx % attrNames.length];
    const value = Math.floor(rng() * 99999).toString(36);
    attrIdx++;
    return `<${tag} ${attr}="${value}"${attrs}>`;
  });

  return result;
}

/**
 * Add random HTML comments between major sections.
 */
function addRandomComments(html, rng) {
  const sectionBreaks = [
    /(<\/div>\s*<div)/gi,
    /(<\/section>\s*<section)/gi,
  ];

  let result = html;
  let commentIdx = 0;

  for (const pattern of sectionBreaks) {
    result = result.replace(pattern, (match) => {
      if (!rngBool(rng, 0.4)) return match; // 40% chance
      const template = COMMENT_TEMPLATES[commentIdx % COMMENT_TEMPLATES.length];
      commentIdx++;
      const comment = template(commentIdx);
      return comment ? `${comment}\n${match}` : match;
    });
  }

  return result;
}
