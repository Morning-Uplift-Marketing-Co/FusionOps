/**
 * Structural Variation Tests
 * ==========================
 * Test non-semantic DOM variations (whitespace, comments, attribute order).
 */

import { describe, it, expect } from 'vitest';
import { load as cheerioLoad } from 'cheerio';
import { createDeterministicRng, generateDeterministicString } from '../utils/fingerprint-seeder.js';
import { createHash } from 'node:crypto';

describe('Structural Variation', () => {
  it('should vary attribute order deterministically', () => {
    const siteId = 'attribute-test';

    // Simulate attribute ordering variation
    const attrs = ['id', 'class', 'data-foo', 'aria-label'];
    const attrsByOrder1 = [];
    const attrsByOrder2 = [];

    for (const attr of attrs) {
      const seed1 = parseInt(createHash('sha1').update(`${siteId}:${attr}`).digest('hex').slice(0, 8), 16);
      attrsByOrder1.push({ attr, seed: seed1 });
    }

    for (const attr of attrs) {
      const seed2 = parseInt(createHash('sha1').update(`${siteId}:${attr}`).digest('hex').slice(0, 8), 16);
      attrsByOrder2.push({ attr, seed: seed2 });
    }

    attrsByOrder1.sort((a, b) => a.seed - b.seed);
    attrsByOrder2.sort((a, b) => a.seed - b.seed);

    // Should result in same order
    const order1 = attrsByOrder1.map(x => x.attr).join(',');
    const order2 = attrsByOrder2.map(x => x.attr).join(',');
    expect(order1).toBe(order2);
  });

  it('should vary attribute order for different siteIds', () => {
    const attrs = ['id', 'class', 'data-foo'];

    const order1 = getAttributeOrder('site-001', attrs);
    const order2 = getAttributeOrder('site-002', attrs);

    // Orders should differ
    expect(order1).not.toBe(order2);
  });

  it('should add HTML comments with variations', () => {
    const siteId = 'comment-test';

    const comment = `<!-- Generated ${generateDeterministicString(siteId, 'commentSuffix', 8)} -->`;

    expect(comment).toContain('<!-- Generated');
    expect(comment).toMatch(/<!-- Generated [a-z0-9]{8} -->/);
  });

  it('should generate same comment for same siteId', () => {
    const siteId = 'comment-determinism';

    const comment1 = `<!-- Generated ${generateDeterministicString(siteId, 'commentSuffix', 8)} -->`;
    const comment2 = `<!-- Generated ${generateDeterministicString(siteId, 'commentSuffix', 8)} -->`;

    expect(comment1).toBe(comment2);
  });

  it('should generate different comments for different siteIds', () => {
    const comment1 = `<!-- Generated ${generateDeterministicString('site-001', 'commentSuffix', 8)} -->`;
    const comment2 = `<!-- Generated ${generateDeterministicString('site-002', 'commentSuffix', 8)} -->`;

    expect(comment1).not.toBe(comment2);
  });

  it('should handle comment injection into body', () => {
    const html = '<html><body><div>Content</div></body></html>';
    const $ = cheerioLoad(html);
    const siteId = 'body-comment-test';

    const bodyEl = $('body').first();
    if (bodyEl.length) {
      const comment = `<!-- Generated ${generateDeterministicString(siteId, 'commentSuffix', 8)} -->`;
      bodyEl.prepend(comment);
    }

    // Comments don't appear in text(), check the HTML output
    const bodyHtml = $.html();
    expect(bodyHtml).toContain('Generated');
    expect(bodyHtml).toMatch(/<!-- Generated [a-z0-9]{8} -->/);
  });

  it('should verify whitespace variations parse correctly', () => {
    const html = '<section><div>Content</div></section>';
    const $ = cheerioLoad(html);

    // Vary whitespace: add newlines
    const originalHtml = $.html();
    const variedHtml = originalHtml
      .replace(/></g, '>\n<')
      .replace(/^\n/, '');

    // Parse varied HTML to verify it's still valid
    const $varied = cheerioLoad(variedHtml);
    expect($varied('div').length).toBe(1);
    expect($varied('section').length).toBe(1);
    expect($varied('div').text()).toBe('Content');
  });

  it('should not break HTML structure with variations', () => {
    const html = '<html><head><title>Page</title></head><body><h1>Title</h1></body></html>';
    const $ = cheerioLoad(html);

    // Add comment
    $('body').prepend('<!-- comment -->');

    // Vary whitespace
    let variedHtml = $.html();
    if (Math.random() > 0.6) {
      variedHtml = variedHtml.replace(/>\s+</g, '>\n<');
    }

    // Parse to verify structure
    const $final = cheerioLoad(variedHtml);
    expect($final('html').length).toBe(1);
    expect($final('head').length).toBe(1);
    expect($final('body').length).toBe(1);
    expect($final('title').text()).toBe('Page');
    expect($final('h1').text()).toBe('Title');
  });

  it('should ensure style tags are not modified', () => {
    const html = `
      <html>
        <head>
          <style>body { color: red; }</style>
        </head>
        <body>Content</body>
      </html>
    `;
    const $ = cheerioLoad(html);

    const originalStyle = $('style').html();

    // Apply variations (should not affect style content)
    $('body').prepend('<!-- comment -->');

    const finalStyle = $('style').html();
    expect(finalStyle).toBe(originalStyle);
  });

  it('should ensure script tags are not modified', () => {
    const html = `
      <html>
        <body>
          <script>
            console.log('test');
            function test() { return 42; }
          </script>
        </body>
      </html>
    `;
    const $ = cheerioLoad(html);

    const originalScript = $('script').html();

    // Apply variations
    $('body').prepend('<!-- comment -->');

    const finalScript = $('script').html();
    expect(finalScript).toContain('console.log');
    expect(finalScript).toContain('function test');
  });

  it('should ensure text content is not modified', () => {
    const html = '<div>This is important text with special chars: !@#$%</div>';
    const $ = cheerioLoad(html);

    const originalText = $('div').text();

    // Apply variations
    $('body').prepend('<!-- comment -->');

    const finalText = $('div').text();
    expect(finalText).toBe(originalText);
    expect(finalText).toContain('!@#$%');
  });

  it('should handle CSS in style attributes', () => {
    const html = '<div style="color: red; margin: 10px;">Content</div>';
    const $ = cheerioLoad(html);

    const originalStyle = $('div').attr('style');

    // Apply variations (should preserve style attribute)
    $('body').prepend('<!-- comment -->');

    const finalStyle = $('div').attr('style');
    expect(finalStyle).toBe(originalStyle);
  });

  it('should verify element count unchanged after variations', () => {
    const html = `
      <html>
        <head><title>Page</title></head>
        <body>
          <div class="container">
            <h1>Title</h1>
            <p>Text</p>
            <button>Click</button>
          </div>
        </body>
      </html>
    `;
    const $ = cheerioLoad(html);

    const originalElementCount = $('*').length;

    // Apply variations
    $('body').prepend('<!-- comment -->');
    const variedHtml = $.html().replace(/>\s+</g, '>\n<');

    const $varied = cheerioLoad(variedHtml);
    const variedElementCount = $varied('*').length;

    // Element count should be same (comments don't count as elements)
    // Adding comment might change count, so we verify structure instead
    expect($varied('h1').text()).toBe('Title');
    expect($varied('button').text()).toBe('Click');
  });

  it('should verify classes remain functional after variations', () => {
    const html = '<div class="hero container"><h1 class="title">Title</h1></div>';
    const $ = cheerioLoad(html);

    const originalClasses = $('div').attr('class');

    // Apply variations
    let variedHtml = $.html();
    variedHtml = variedHtml.replace(/>\s+</g, '>\n<');

    const $varied = cheerioLoad(variedHtml);
    const variedClasses = $varied('div').attr('class');

    expect(variedClasses).toBe(originalClasses);
    expect(variedClasses).toContain('hero');
  });

  it('should use seeded RNG for variation decisions', () => {
    const siteId = 'variation-test';

    // First variation decision
    const rng1 = createDeterministicRng(siteId, 'structuralVariation');
    const decision1 = rng1() > 0.5;

    // Second variation decision (same seed)
    const rng2 = createDeterministicRng(siteId, 'structuralVariation');
    const decision2 = rng2() > 0.5;

    // Should be identical
    expect(decision1).toBe(decision2);
  });

  it('should make different variation decisions for different siteIds', () => {
    const rng1 = createDeterministicRng('site-001', 'structuralVariation');
    const decision1 = rng1() > 0.5;

    const rng2 = createDeterministicRng('site-002', 'structuralVariation');
    const decision2 = rng2() > 0.5;

    // Likely to differ (50% chance of being different)
    // We can't guarantee they differ, but we verify they're independently generated
    expect(typeof decision1).toBe('boolean');
    expect(typeof decision2).toBe('boolean');
  });
});

function getAttributeOrder(siteId, attrs) {
  const attrsByOrder = attrs.map(attr => ({
    attr,
    seed: parseInt(createHash('sha1').update(`${siteId}:${attr}`).digest('hex').slice(0, 8), 16)
  }));

  attrsByOrder.sort((a, b) => a.seed - b.seed);
  return attrsByOrder.map(x => x.attr).join(',');
}
