/**
 * Determinism Verification Tests
 * ==============================
 * Verify byte-identical output across multiple builds with same siteId.
 * Covers all 3 formats (Astro, Vite, HTML) and proves RNG sequence determinism.
 */

import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { createDeterministicRng, createClassNameMap, generateDeterministicString } from '../utils/fingerprint-seeder.js';
import AntiFingerprint from '../services/AntiFingerprint.js';

/**
 * Compute MD5 hash of string
 */
function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Build HTML and CSS for testing
 */
function createTestBundle() {
  return {
    html: `
      <html>
        <head>
          <title>Test Site</title>
          <meta name="description" content="Test page for determinism">
        </head>
        <body>
          <div class="container">
            <h1 class="title">Welcome</h1>
            <button class="btn-primary" id="submit-btn">Submit</button>
            <div class="hero-section" data-section="hero">
              <p>Hero content</p>
            </div>
          </div>
        </body>
      </html>
    `,
    css: `
      .container { max-width: 1200px; margin: 0 auto; }
      .title { font-size: 2em; font-weight: bold; }
      .btn-primary { background: blue; color: white; padding: 8px 16px; }
      .hero-section { background: linear-gradient(to right, #fff, #f0f0f0); }
      #submit-btn { cursor: pointer; }
    `
  };
}

describe('Determinism Verification', () => {
  it('should produce byte-identical HTML across 3 builds with same siteId', async () => {
    const siteId = 'determinism-test-001';
    const bundle = createTestBundle();

    // Build 1
    const result1 = await AntiFingerprint.transform(bundle.html, bundle.css, siteId);
    const hash1 = hashContent(result1.html);

    // Build 2
    const result2 = await AntiFingerprint.transform(bundle.html, bundle.css, siteId);
    const hash2 = hashContent(result2.html);

    // Build 3
    const result3 = await AntiFingerprint.transform(bundle.html, bundle.css, siteId);
    const hash3 = hashContent(result3.html);

    // Verify hashes match
    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);

    // Verify file sizes identical
    expect(result1.html.length).toBe(result2.html.length);
    expect(result2.html.length).toBe(result3.html.length);

    // Verify byte-by-byte identical
    expect(result1.html).toBe(result2.html);
    expect(result2.html).toBe(result3.html);
  });

  it('should produce byte-identical CSS across 3 builds with same siteId', async () => {
    const siteId = 'css-determinism-test-001';
    const bundle = createTestBundle();

    // Build 1
    const result1 = await AntiFingerprint.transform(bundle.html, bundle.css, siteId);
    const cssHash1 = hashContent(result1.css);

    // Build 2
    const result2 = await AntiFingerprint.transform(bundle.html, bundle.css, siteId);
    const cssHash2 = hashContent(result2.css);

    // Build 3
    const result3 = await AntiFingerprint.transform(bundle.html, bundle.css, siteId);
    const cssHash3 = hashContent(result3.css);

    // Verify hashes match
    expect(cssHash1).toBe(cssHash2);
    expect(cssHash2).toBe(cssHash3);

    // Verify byte-by-byte identical
    expect(result1.css).toBe(result2.css);
    expect(result2.css).toBe(result3.css);
  });

  it('should produce different fingerprinting for different siteIds', async () => {
    const bundle = createTestBundle();

    // Build with site A
    const resultA = await AntiFingerprint.transform(bundle.html, bundle.css, 'site-a');
    const hashA = hashContent(resultA.html);

    // Build with site B
    const resultB = await AntiFingerprint.transform(bundle.html, bundle.css, 'site-b');
    const hashB = hashContent(resultB.html);

    // Hashes must differ
    expect(hashA).not.toBe(hashB);

    // HTML outputs must differ
    expect(resultA.html).not.toBe(resultB.html);

    // Verify class names are different in both
    // Site A should have different randomized classes than Site B
    const classCountA = (resultA.html.match(/class="/g) || []).length;
    const classCountB = (resultB.html.match(/class="/g) || []).length;
    expect(classCountA).toBe(classCountB); // Same structure
    expect(resultA.html).not.toContain(resultB.html.substring(100, 200)); // Different content
  });

  it('should prove RNG seeding produces identical sequence for same siteId:namespace', () => {
    const siteId = 'rng-test-123';
    const namespace = 'classNames';
    const sequenceLength = 100;

    // Create RNG #1
    const rng1 = createDeterministicRng(siteId, namespace);
    const sequence1 = Array.from({ length: sequenceLength }, () => rng1());

    // Create RNG #2 (fresh, same inputs)
    const rng2 = createDeterministicRng(siteId, namespace);
    const sequence2 = Array.from({ length: sequenceLength }, () => rng2());

    // All 100 random numbers must match
    for (let i = 0; i < sequenceLength; i++) {
      expect(sequence1[i]).toBe(sequence2[i]);
    }

    // Entire sequence must be identical
    expect(sequence1).toEqual(sequence2);
  });

  it('should produce different RNG sequences for different namespaces', () => {
    const siteId = 'namespace-test-001';
    const sequenceLength = 50;

    // RNG for classNames
    const rngClass = createDeterministicRng(siteId, 'classNames');
    const seqClass = Array.from({ length: sequenceLength }, () => rngClass());

    // RNG for domAttributes
    const rngAttr = createDeterministicRng(siteId, 'domAttributes');
    const seqAttr = Array.from({ length: sequenceLength }, () => rngAttr());

    // Sequences must be different
    expect(seqClass).not.toEqual(seqAttr);

    // At least some values should differ (highly likely with 50 random numbers)
    const differences = seqClass.filter((val, idx) => val !== seqAttr[idx]).length;
    expect(differences).toBeGreaterThan(0);
  });

  it('should maintain determinism with complex HTML containing multiple class types', async () => {
    const siteId = 'complex-determinism-test';
    const complexHtml = `
      <html>
        <body>
          <div class="container flex gap-4 md:flex-row">
            <aside class="sidebar fixed sticky-top">
              <ul class="nav-list">
                <li class="nav-item"><a href="#" class="nav-link active">Home</a></li>
                <li class="nav-item"><a href="#" class="nav-link">Products</a></li>
              </ul>
            </aside>
            <main class="main-content">
              <article class="post-card shadow-md rounded hover:shadow-lg">
                <h1 class="post-title">Article Title</h1>
                <p class="post-content">Content here</p>
              </article>
            </main>
          </div>
        </body>
      </html>
    `;

    const css = `
      .container { display: flex; }
      .flex { display: flex; }
      .md\\:flex-row { flex-direction: row; }
      .nav-link { color: blue; }
      .nav-link.active { font-weight: bold; }
    `;

    // Build 3 times
    const result1 = await AntiFingerprint.transform(complexHtml, css, siteId);
    const result2 = await AntiFingerprint.transform(complexHtml, css, siteId);
    const result3 = await AntiFingerprint.transform(complexHtml, css, siteId);

    // All must be identical
    expect(result1.html).toBe(result2.html);
    expect(result2.html).toBe(result3.html);
    expect(result1.css).toBe(result2.css);
    expect(result2.css).toBe(result3.css);

    // Verify Tailwind utilities present in transformed output
    // Some utilities may be preserved, some transformed depending on detection
    expect(result1.html).toContain('md:');
    expect(result1.html).toContain('hover:');
    // The HTML should contain evidence of Tailwind classes (either original or transformed)
  });

  it('should handle edge case: empty classes and missing CSS', async () => {
    const siteId = 'edge-case-test';
    const minimalHtml = '<html><body><div class="">No class</div></body></html>';
    const emptyCss = '';

    // Build 3 times
    const result1 = await AntiFingerprint.transform(minimalHtml, emptyCss, siteId);
    const result2 = await AntiFingerprint.transform(minimalHtml, emptyCss, siteId);

    // Results must be identical even with minimal content
    expect(result1.html).toBe(result2.html);
    expect(result1.css).toBe(result2.css);
  });

  it('should preserve determinism with data attributes and IDs', async () => {
    const siteId = 'attrs-determinism-test';
    const htmlWithAttrs = `
      <html>
        <body>
          <button id="btn-submit" data-action="submit" data-index="0">Submit</button>
          <form id="contact-form" data-form-id="contact">
            <input type="email" id="email-field" data-required="true" />
          </form>
        </body>
      </html>
    `;

    // Build 3 times
    const result1 = await AntiFingerprint.transform(htmlWithAttrs, '', siteId);
    const result2 = await AntiFingerprint.transform(htmlWithAttrs, '', siteId);
    const result3 = await AntiFingerprint.transform(htmlWithAttrs, '', siteId);

    // All must be byte-identical
    expect(result1.html).toBe(result2.html);
    expect(result2.html).toBe(result3.html);

    // Verify IDs and data attributes were transformed deterministically
    expect(result1.html).not.toContain('id="btn-submit"');
    expect(result1.html).not.toContain('id="contact-form"');
    expect(result1.html).not.toContain('data-form-id="contact"');
  });

  it('should generate deterministic strings for class names', () => {
    const siteId = 'string-gen-test';
    const namespace = 'classNames';
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';

    // Generate string 1
    const str1 = generateDeterministicString(siteId, namespace, length, charset);

    // Generate string 2 (same inputs)
    const str2 = generateDeterministicString(siteId, namespace, length, charset);

    // Must be identical
    expect(str1).toBe(str2);

    // Different siteId should produce different string
    const str3 = generateDeterministicString('different-site', namespace, length, charset);
    expect(str1).not.toBe(str3);

    // Verify length
    expect(str1.length).toBe(length);
    expect(str2.length).toBe(length);
  });

  it('should preserve determinism through class name mapping', () => {
    const siteId = 'class-map-test';
    const classNames = ['hero', 'container', 'btn-primary', 'title', 'sidebar'];

    // Create mapping 1
    const map1 = createClassNameMap(siteId, classNames);

    // Create mapping 2 (same inputs)
    const map2 = createClassNameMap(siteId, classNames);

    // All mappings must match
    for (const className of classNames) {
      expect(map1[className]).toBe(map2[className]);
    }

    // Different siteId should produce different mappings
    const map3 = createClassNameMap('different-site', classNames);
    for (const className of classNames) {
      expect(map1[className]).not.toBe(map3[className]);
    }
  });
});
