/**
 * Anti-Fingerprint Service
 * ========================
 * Post-build transform service for deterministic fingerprinting.
 *
 * Applies multiple randomization strategies AFTER build completes:
 * 1. Class name randomization (CSS + HTML + JS references)
 * 2. ID attribute randomization
 * 3. Data attribute randomization
 * 4. Aria label hashing
 * 5. Meta tag variation (generator, description, OG)
 * 6. Structural variation (whitespace, comments, attribute order)
 *
 * Design principle: All transforms use deterministic seeding from siteId.
 * Same siteId → byte-identical output across redeploys.
 */

import { load as cheerioLoad } from 'cheerio';
import { createClassNameMap, createDeterministicRng, generateDeterministicString } from '../utils/fingerprint-seeder.js';
import { hash53 } from '../utils/deterministic-hash.js';

export class AntiFingerprint {
  /**
   * Transform HTML/CSS to add anti-fingerprinting variations
   *
   * @param {string} htmlContent - built HTML
   * @param {string} cssContent - built CSS (inline or external)
   * @param {string} siteId - unique site identifier
   * @returns {Promise<{html: string, css: string}>}
   */
  static async transform(htmlContent, cssContent, siteId) {
    // Step 1: Parse HTML with cheerio
    const $ = cheerioLoad(htmlContent);

    // Step 2: Extract all class names from HTML
    const classNames = new Set();
    $('[class]').each((i, el) => {
      const classes = $(el).attr('class');
      if (classes) {
        classes.split(/\s+/).forEach(c => {
          if (c) classNames.add(c);
        });
      }
    });

    // Step 3: Create deterministic mapping
    const classMap = createClassNameMap(siteId, Array.from(classNames));

    // Step 4: Apply transformations
    this.#replaceClasses($, classMap);
    this.#replaceIds($, siteId);
    this.#replaceDataAttributes($, siteId);
    this.#replaceAriaLabels($, siteId);
    this.#injectMetaTags($, siteId);
    this.#addStructuralVariation($, siteId);

    // Step 5: Update CSS class references
    let transformedCss = cssContent;
    for (const [original, randomized] of Object.entries(classMap)) {
      // Match .class-name at word boundary (including pseudo-classes)
      transformedCss = transformedCss.replace(
        new RegExp(`\\.${escapeRegex(original)}\\b`, 'g'),
        `.${randomized}`
      );
    }

    // Step 6: Update JS class references (in script tags)
    $('script').each((i, el) => {
      let scriptContent = $(el).html();
      if (scriptContent) {
        for (const [original, randomized] of Object.entries(classMap)) {
          scriptContent = scriptContent.replace(
            new RegExp(`["']${escapeRegex(original)}["']`, 'g'),
            `"${randomized}"`
          );
        }
        $(el).html(scriptContent);
      }
    });

    return {
      html: $.html(),
      css: transformedCss
    };
  }

  /**
   * Replace class names in HTML
   * @private
   */
  static #replaceClasses($, classMap) {
    $('[class]').each((i, el) => {
      const classes = $(el).attr('class');
      if (classes) {
        const updated = classes
          .split(/\s+/)
          .filter(c => c) // Remove empty strings
          .map(c => classMap[c] || c)
          .join(' ');
        $(el).attr('class', updated);
      }
    });
  }

  /**
   * Randomize ID attributes
   * @private
   */
  static #replaceIds($, siteId) {
    $('[id]').each((i, el) => {
      const oldId = $(el).attr('id');
      if (oldId && !oldId.startsWith('__')) {
        const newId = `id_${generateDeterministicString(siteId, `id:${oldId}`, 8)}`;
        $(el).attr('id', newId);

        // Update references to this ID
        $(`[href="#${oldId}"]`).attr('href', `#${newId}`);
        $(`[aria-controls="${oldId}"]`).attr('aria-controls', newId);
        $(`[aria-labelledby="${oldId}"]`).attr('aria-labelledby', newId);
      }
    });
  }

  /**
   * Randomize data-* attributes (except third-party)
   * @private
   */
  static #replaceDataAttributes($, siteId) {
    $('*').each((i, el) => {
      const attrs = el.attribs || {};
      for (const [attrName, attrValue] of Object.entries(attrs)) {
        if (!attrName.startsWith('data-')) {
          continue;
        }

        // Whitelist: preserve third-party integration data attributes
        if (isThirdPartyDataAttribute(attrName)) {
          continue;
        }

        // Don't randomize UUIDs or complex values
        if (typeof attrValue === 'string' && !isUuid(attrValue) && attrValue.length < 100) {
          const newValue = generateDeterministicString(
            siteId,
            `data:${attrName}:${attrValue}`,
            Math.min(attrValue.length, 10)
          );
          $(el).attr(attrName, newValue);
        }
      }
    });
  }

  /**
   * Randomize aria-label values
   * @private
   */
  static #replaceAriaLabels($, siteId) {
    $('[aria-label]').each((i, el) => {
      const oldLabel = $(el).attr('aria-label');
      if (oldLabel) {
        const hash = hash53(`${siteId}:${oldLabel}`).toString(16).padStart(13, '0').slice(0, 8);
        const newLabel = `aria_${hash}`;
        $(el).attr('aria-label', newLabel);
      }
    });
  }

  /**
   * Inject and vary meta tags
   * @private
   */
  static #injectMetaTags($, siteId) {
    const head = $('head');
    if (!head.length) {
      // Create head if missing
      $('html').prepend('<head></head>');
    }

    // Vary generator tag
    const generators = [
      'Generated with custom build tool',
      'Built with static site generator',
      `Template engine v${generateDeterministicString(siteId, 'metaVersion', 3)}`
    ];
    const rng = createDeterministicRng(siteId, 'metaTags');
    const generatorIdx = Math.floor(rng() * generators.length);
    const generator = generators[generatorIdx];

    const headEl = $('head').first();
    headEl.find('meta[name="generator"]').remove();
    headEl.append(`<meta name="generator" content="${generator}" />`);

    // Vary description phrasing (if exists)
    const descMeta = headEl.find('meta[name="description"]');
    if (descMeta.length) {
      const desc = descMeta.attr('content');
      const suffix = ` [${generateDeterministicString(siteId, 'metaDesc', 4)}]`;
      descMeta.attr('content', desc + suffix);
    }

    // Vary OG tags if present (conservative: preserve og:type and og:image)
    headEl.find('meta[property^="og:"]').each((i, el) => {
      const property = $(el).attr('property');
      const content = $(el).attr('content');

      // Preserve critical OG tags
      if (property === 'og:type' || property === 'og:image' || property === 'og:url') {
        return;
      }

      // Add variation to other OG tags
      if (content) {
        const variant = generateDeterministicString(siteId, `og:${property}`, 3);
        $(el).attr('content', `${content}_${variant}`);
      }
    });
  }

  /**
   * Add structural variation (whitespace, comments, attribute order)
   * @private
   */
  static #addStructuralVariation($, siteId) {
    const rng = createDeterministicRng(siteId, 'structuralVariation');

    // Vary attribute order (50% of elements)
    $('*').each((i, el) => {
      if (rng() > 0.5) {
        const attrs = Object.entries(el.attribs || {});
        if (attrs.length > 1) {
          // Sort attributes deterministically (by seed hash of attr name)
          attrs.sort((a, b) => {
            const seedA = hash53(`${siteId}:${a[0]}`);
            const seedB = hash53(`${siteId}:${b[0]}`);
            return seedA - seedB;
          });
          el.attribs = Object.fromEntries(attrs);
        }
      }
    });

    // Add HTML comments with variations (70% threshold)
    if (rng() > 0.7) {
      const bodyEl = $('body').first();
      if (bodyEl.length) {
        const comment = `<!-- Generated ${generateDeterministicString(siteId, 'commentSuffix', 8)} -->`;
        bodyEl.prepend(comment);
      }
    }
  }
}

/**
 * Escape special regex characters
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if data attribute is from a third-party integration
 * @param {string} attrName
 * @returns {boolean}
 */
function isThirdPartyDataAttribute(attrName) {
  const thirdPartyPrefixes = [
    'data-ga-',
    'data-gtag-',
    'data-hotjar-',
    'data-analytics-',
    'data-segment-',
    'data-mixpanel-',
    'data-amplitude-',
    'data-intercom-',
    'data-drift-'
  ];

  return thirdPartyPrefixes.some(prefix => attrName.startsWith(prefix));
}

/**
 * Check if value looks like a UUID
 * @param {string} value
 * @returns {boolean}
 */
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default AntiFingerprint;
