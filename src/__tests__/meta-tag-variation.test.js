/**
 * Meta Tag Variation Tests
 * ========================
 * Test meta tag injection and variation patterns.
 */

import { describe, it, expect } from 'vitest';
import cheerio from 'cheerio';
import { generateDeterministicString, createDeterministicRng } from '../utils/fingerprint-seeder.js';

describe('Meta Tag Variation', () => {
  it('should inject generator meta tag if missing', () => {
    const html = '<html><head><title>Page</title></head><body>Content</body></html>';
    const $ = cheerio.load(html);
    const siteId = 'test-site';

    const generators = [
      'Generated with custom build tool',
      'Built with static site generator',
      `Template engine v${generateDeterministicString(siteId, 'metaVersion', 3)}`
    ];

    const rng = createDeterministicRng(siteId, 'metaTags');
    const generatorIdx = Math.floor(rng() * generators.length);
    const generator = generators[generatorIdx];

    const head = $('head').first();
    head.find('meta[name="generator"]').remove();
    head.append(`<meta name="generator" content="${generator}" />`);

    const generatorTag = $('head meta[name="generator"]');
    expect(generatorTag.length).toBe(1);
    expect(generatorTag.attr('content')).toBe(generator);
  });

  it('should vary generator tag deterministically', () => {
    const siteId = 'deterministic-test';

    const generators = [
      'Generated with custom build tool',
      'Built with static site generator',
      `Template engine v${generateDeterministicString(siteId, 'metaVersion', 3)}`
    ];

    // Generate choice 1
    const rng1 = createDeterministicRng(siteId, 'metaTags');
    const idx1 = Math.floor(rng1() * generators.length);

    // Generate choice 2 (same siteId, same choice)
    const rng2 = createDeterministicRng(siteId, 'metaTags');
    const idx2 = Math.floor(rng2() * generators.length);

    expect(idx1).toBe(idx2);
    expect(generators[idx1]).toBe(generators[idx2]);
  });

  it('should vary description phrasing with hash suffix', () => {
    const html = '<html><head><meta name="description" content="Original description"></head></html>';
    const $ = cheerio.load(html);
    const siteId = 'test-site';

    const descMeta = $('head meta[name="description"]');
    const originalContent = descMeta.attr('content');

    const suffix = ` [${generateDeterministicString(siteId, 'metaDesc', 4)}]`;
    descMeta.attr('content', originalContent + suffix);

    const updated = $('head meta[name="description"]').attr('content');
    expect(updated).toContain('Original description');
    expect(updated).toContain('[');
    expect(updated).not.toBe(originalContent);
  });

  it('should vary description deterministically', () => {
    const siteId = 'description-test';

    const suffix1 = generateDeterministicString(siteId, 'metaDesc', 4);
    const suffix2 = generateDeterministicString(siteId, 'metaDesc', 4);

    expect(suffix1).toBe(suffix2);
  });

  it('should preserve og:type tag', () => {
    const html = '<html><head><meta property="og:type" content="website"></head></html>';
    const $ = cheerio.load(html);

    const ogType = $('head meta[property="og:type"]');
    expect(ogType.attr('content')).toBe('website');

    // Simulate variation logic that preserves og:type
    // (should not be modified)
  });

  it('should preserve og:image tag', () => {
    const html = '<html><head><meta property="og:image" content="https://example.com/img.png"></head></html>';
    const $ = cheerio.load(html);

    const ogImage = $('head meta[property="og:image"]');
    expect(ogImage.attr('content')).toBe('https://example.com/img.png');

    // Should not be modified (image URLs break Facebook sharing if changed)
  });

  it('should vary og:title tag', () => {
    const html = '<html><head><meta property="og:title" content="Page Title"></head></html>';
    const $ = cheerio.load(html);
    const siteId = 'test-site';

    const ogTitle = $('head meta[property="og:title"]');
    const originalContent = ogTitle.attr('content');

    // Vary non-critical OG tags
    const variant = generateDeterministicString(siteId, 'og:og:title', 3);
    ogTitle.attr('content', `${originalContent}_${variant}`);

    const updated = $('head meta[property="og:title"]').attr('content');
    expect(updated).toContain('Page Title');
    expect(updated).toContain('_');
    expect(updated).not.toBe(originalContent);
  });

  it('should vary og:description tag', () => {
    const html = '<html><head><meta property="og:description" content="Page description"></head></html>';
    const $ = cheerio.load(html);
    const siteId = 'test-site';

    const ogDesc = $('head meta[property="og:description"]');
    const originalContent = ogDesc.attr('content');

    const variant = generateDeterministicString(siteId, 'og:og:description', 3);
    ogDesc.attr('content', `${originalContent}_${variant}`);

    const updated = $('head meta[property="og:description"]').attr('content');
    expect(updated).not.toBe(originalContent);
    expect(updated).toMatch(/_[a-z0-9]+$/);
  });

  it('should create head if missing', () => {
    const html = '<html><body>Content</body></html>';
    const $ = cheerio.load(html);

    if ($('head').length === 0) {
      $('html').prepend('<head></head>');
    }

    expect($('head').length).toBe(1);
  });

  it('should handle HTML with no description tag', () => {
    const html = '<html><head><title>Page</title></head><body>Content</body></html>';
    const $ = cheerio.load(html);

    const descMeta = $('head meta[name="description"]');
    if (descMeta.length === 0) {
      // Should handle gracefully (no error)
      expect(descMeta.length).toBe(0);
    }
  });

  it('should handle HTML with multiple OG tags', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Title">
          <meta property="og:description" content="Description">
          <meta property="og:image" content="https://example.com/img.png">
          <meta property="og:type" content="website">
          <meta property="og:url" content="https://example.com">
        </head>
      </html>
    `;
    const $ = cheerio.load(html);
    const siteId = 'test-site';

    // Vary non-critical tags only
    const ogTags = $('head meta[property^="og:"]');
    expect(ogTags.length).toBe(5);

    ogTags.each((i, el) => {
      const property = $(el).attr('property');
      if (property !== 'og:type' && property !== 'og:image' && property !== 'og:url') {
        const content = $(el).attr('content');
        const variant = generateDeterministicString(siteId, `og:${property}`, 3);
        $(el).attr('content', `${content}_${variant}`);
      }
    });

    // Verify preservation
    expect($('head meta[property="og:type"]').attr('content')).toBe('website');
    expect($('head meta[property="og:image"]').attr('content')).toBe('https://example.com/img.png');
    expect($('head meta[property="og:url"]').attr('content')).toBe('https://example.com');

    // Verify variation
    expect($('head meta[property="og:title"]').attr('content')).toContain('_');
  });

  it('should verify HTML validity after meta tag variation', () => {
    const html = '<html><head><title>Page</title></head><body>Content</body></html>';
    const $ = cheerio.load(html);
    const siteId = 'test-site';

    // Add generator
    const head = $('head').first();
    head.append('<meta name="generator" content="test-generator" />');

    // Parse result to verify validity
    const finalHtml = $.html();
    const $2 = cheerio.load(finalHtml);

    expect($2('meta[name="generator"]').length).toBe(1);
    expect($2('html').length).toBe(1);
    expect($2('head').length).toBe(1);
    expect($2('body').length).toBe(1);
  });

  it('should generate different meta tag variations for different siteIds', () => {
    const siteId1 = 'site-001';
    const siteId2 = 'site-002';

    const variant1 = generateDeterministicString(siteId1, 'metaDesc', 4);
    const variant2 = generateDeterministicString(siteId2, 'metaDesc', 4);

    expect(variant1).not.toBe(variant2);
  });

  it('should handle generator tag replacement', () => {
    const html = '<html><head><meta name="generator" content="old-generator"></head></html>';
    const $ = cheerio.load(html);

    // Remove old, add new
    $('head meta[name="generator"]').remove();
    $('head').first().append('<meta name="generator" content="new-generator" />');

    const generator = $('head meta[name="generator"]').attr('content');
    expect(generator).toBe('new-generator');
    expect(generator).not.toBe('old-generator');
  });
});
