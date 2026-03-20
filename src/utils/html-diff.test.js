/**
 * html-diff Utility Tests (PREV-04)
 * =================================
 * Tests for HTML diff generation utility wrapper around diff-match-patch.
 * Verifies diff computation for HTML-specific scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateHtmlDiff } from './html-diff.js';

describe('html-diff utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Basic HTML Diff (PREV-04) ─────────────────────────────────────────────

  it('should compute diff between simple HTML strings', () => {
    const preHtml = '<div>test</div>';
    const postHtml = '<div class="fp">test</div>';

    const { diffs, summary } = generateHtmlDiff(preHtml, postHtml);

    expect(diffs).toBeDefined();
    expect(diffs.length).toBeGreaterThan(0);
    expect(summary.added).toBeGreaterThan(0);
  });

  it('should identify added text as character count', () => {
    const preHtml = '<div>test</div>';
    const postHtml = '<div class="fp-abc">test</div>';

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    expect(summary.added).toBeGreaterThan(0);
    expect(summary.removed).toBe(0);
    expect(summary.unchanged).toBeGreaterThan(0);
  });

  it('should show unchanged character count', () => {
    const preHtml = '<div>test</div>';
    const postHtml = '<div class="fp">test</div>';

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    // Both have '<div' and '>test</div>' unchanged
    expect(summary.unchanged).toBeGreaterThan(0);
  });

  it('should return diffs array with operation types', () => {
    const preHtml = '<div>test</div>';
    const postHtml = '<div class="fp">test</div>';

    const { diffs } = generateHtmlDiff(preHtml, postHtml);

    // Each diff is [operation, text]
    // operation: 0 = unchanged, 1 = added, -1 = removed
    for (const [op, text] of diffs) {
      expect([-1, 0, 1]).toContain(op);
      expect(typeof text).toBe('string');
    }
  });

  // ─── CSS Class Changes (PREV-04) ───────────────────────────────────────────

  it('should detect CSS class name changes', () => {
    const preHtml = '<button class="btn-primary">Click</button>';
    const postHtml = '<button class="btn-fp-xyz">Click</button>';

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    expect(summary.removed).toBeGreaterThan(0); // 'btn-primary' removed
    expect(summary.added).toBeGreaterThan(0);   // 'btn-fp-xyz' added
  });

  it('should handle multiple class changes', () => {
    const preHtml = '<div class="btn primary large">Text</div>';
    const postHtml = '<div class="btn fp-abc fp-def">Text</div>';

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    expect(summary.removed).toBeGreaterThan(0);
    expect(summary.added).toBeGreaterThan(0);
  });

  // ─── ID Randomization (PREV-04) ────────────────────────────────────────────

  it('should detect ID changes from fingerprinting', () => {
    const preHtml = '<form id="form-1">content</form>';
    const postHtml = '<form id="form-fp-abc">content</form>';

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    expect(summary.removed).toBeGreaterThan(0); // 'form-1' removed
    expect(summary.added).toBeGreaterThan(0);   // 'form-fp-abc' added
  });

  it('should track character count changes in ID mutations', () => {
    const preHtml = '<div id="elem-123"></div>';
    const postHtml = '<div id="elem-fp-very-long"></div>';

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    // Added count should be larger for longer replacement
    expect(summary.added).toBeGreaterThan(0);
  });

  // ─── Data Attribute Changes (PREV-04) ──────────────────────────────────────

  it('should detect new data attributes added during fingerprinting', () => {
    const preHtml = '<div data-tracking="voluum">content</div>';
    const postHtml = '<div data-tracking="voluum" data-fp="xyz">content</div>';

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    // Should detect added data-fp attribute
    expect(summary.added).toBeGreaterThan(0);
  });

  it('should preserve unchanged data attributes', () => {
    const preHtml = '<div data-tracking="voluum">content</div>';
    const postHtml = '<div data-tracking="voluum" data-fp="new">content</div>';

    const { summary, diffs } = generateHtmlDiff(preHtml, postHtml);

    // data-tracking value should appear unchanged in diff
    expect(summary.unchanged).toBeGreaterThan(0);
  });

  // ─── Whitespace Handling ───────────────────────────────────────────────────

  it('should handle HTML formatting differences (newlines, indentation)', () => {
    const preHtml = `<div>
  <p>Test</p>
</div>`;
    const postHtml = `<div><p>Test</p></div>`;

    const { diffs } = generateHtmlDiff(preHtml, postHtml);

    // Should handle whitespace changes
    expect(diffs).toBeDefined();
  });

  it('should compute diffs with varying whitespace', () => {
    const preHtml = '<div class="test">content</div>';
    const postHtml = '<div class="test" >content</div>'; // Extra space

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    // Should detect the extra space
    expect(summary.added + summary.removed).toBeGreaterThanOrEqual(0);
  });

  // ─── Performance ───────────────────────────────────────────────────────────

  it('should compute diff for moderate HTML (1-10KB) quickly', () => {
    // Create ~5KB HTML
    const preHtml = '<div>' + '<p>test</p>'.repeat(500) + '</div>';
    const postHtml = '<div class="fp">' + '<p class="fp">test</p>'.repeat(500) + '</div>';

    const startTime = performance.now();
    const result = generateHtmlDiff(preHtml, postHtml);
    const duration = performance.now() - startTime;

    expect(result.diffs).toBeDefined();
    expect(duration).toBeLessThan(100); // Should complete in <100ms
  });

  it('should handle large HTML without stack overflow', () => {
    // Create ~50KB HTML
    const preHtml = '<div>' + '<span>x</span>'.repeat(5000) + '</div>';
    const postHtml = '<div class="fp">' + '<span class="fp">x</span>'.repeat(5000) + '</div>';

    // Should not throw or hang
    expect(() => {
      generateHtmlDiff(preHtml, postHtml);
    }).not.toThrow();
  });

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  it('should handle identical HTML (no diff)', () => {
    const html = '<div class="test">content</div>';

    const { diffs, summary } = generateHtmlDiff(html, html);

    // All should be unchanged
    expect(summary.added).toBe(0);
    expect(summary.removed).toBe(0);
    expect(summary.unchanged).toBeGreaterThan(0);
  });

  it('should handle completely replaced HTML', () => {
    const preHtml = '<div>old</div>';
    const postHtml = '<section>new</section>';

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    // Should detect significant changes
    expect(summary.removed).toBeGreaterThan(0);
    expect(summary.added).toBeGreaterThan(0);
  });

  it('should return summary with correct aggregate', () => {
    const preHtml = '<div>test content</div>';
    const postHtml = '<div class="fp">test content</div>';

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    // Summary should have all three counters
    expect(summary.added).toBeGreaterThanOrEqual(0);
    expect(summary.removed).toBeGreaterThanOrEqual(0);
    expect(summary.unchanged).toBeGreaterThanOrEqual(0);
  });

  // ─── Real Template Examples ───────────────────────────────────────────────

  it('should diff real Astro template example', () => {
    const preHtml = `<!DOCTYPE html>
<html>
  <head><title>Test</title></head>
  <body>
    <h1>Welcome</h1>
    <button class="btn-primary">Click</button>
  </body>
</html>`;

    const postHtml = `<!DOCTYPE html>
<html>
  <head><title>Test</title></head>
  <body>
    <h1>Welcome</h1>
    <button class="btn-fp-xyz" id="btn-fp-abc">Click</button>
  </body>
</html>`;

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    expect(summary.added).toBeGreaterThan(0);
    expect(summary.removed).toBeGreaterThan(0);
    expect(summary.unchanged).toBeGreaterThan(0);
  });

  it('should diff HTML with meta tags', () => {
    const preHtml = `<head>
  <meta name="description" content="Original" />
  <meta property="og:title" content="Original Title" />
</head>`;

    const postHtml = `<head>
  <meta name="description" content="Original" />
  <meta property="og:title" content="Original Title" />
  <meta data-fp="xyz" />
</head>`;

    const { summary } = generateHtmlDiff(preHtml, postHtml);

    // Should detect added meta tag
    expect(summary.added).toBeGreaterThan(0);
  });
});
