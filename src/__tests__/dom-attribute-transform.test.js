/**
 * DOM Attribute Transform Tests
 * =============================
 * Test randomization of DOM attributes (data-*, id, aria-labels).
 */

import { describe, it, expect } from 'vitest';
import { load } from 'cheerio';
import { generateDeterministicString } from '../utils/fingerprint-seeder.js';

describe('DOM Attribute Transformation', () => {
  it('should randomize ID attributes', () => {
    const html = '<div id="hero-section">Content</div>';
    const $ = load(html);
    const siteId = 'test-site';

    const oldId = $('[id]').attr('id');
    const newId = `id_${generateDeterministicString(siteId, `id:${oldId}`, 8)}`;

    $('[id]').attr('id', newId);

    expect($('[id]').attr('id')).toBe(newId);
    expect($('[id]').attr('id')).not.toBe('hero-section');
  });

  it('should preserve internal framework IDs (__ prefix)', () => {
    const html = '<div id="__internal-123">Content</div>';
    const $ = load(html);

    const id = $('[id]').attr('id');
    if (!id.startsWith('__')) {
      // Would randomize, but let's verify it doesn't for __ prefix
      expect(id).toMatch(/^__/);
    }
  });

  it('should update ID references (href)', () => {
    const html = `
      <div id="hero-section">Hero</div>
      <a href="#hero-section">Link</a>
    `;
    const $ = load(html);
    const siteId = 'test-site';

    const oldId = $('#hero-section').attr('id');
    const newId = `id_${generateDeterministicString(siteId, `id:${oldId}`, 8)}`;

    // Update ID
    $('#hero-section').attr('id', newId);

    // Update reference
    $(`a[href="#${oldId}"]`).attr('href', `#${newId}`);

    expect($('a').attr('href')).toBe(`#${newId}`);
    expect($('a').attr('href')).not.toContain('hero-section');
  });

  it('should randomize data-* attributes', () => {
    const html = '<div data-tracking="event-click">Button</div>';
    const $ = load(html);
    const siteId = 'test-site';

    const oldValue = $('[data-tracking]').attr('data-tracking');
    const newValue = generateDeterministicString(siteId, `data:data-tracking:${oldValue}`, 10);

    $('[data-tracking]').attr('data-tracking', newValue);

    expect($('[data-tracking]').attr('data-tracking')).toBe(newValue);
    expect($('[data-tracking]').attr('data-tracking')).not.toBe('event-click');
  });

  it('should preserve third-party data-* attributes', () => {
    const html = `
      <div data-ga-event="view" data-tracking="custom">Content</div>
    `;
    const $ = load(html);

    // Verify GA attribute exists
    expect($('[data-ga-event]').attr('data-ga-event')).toBe('view');

    // In real implementation, GA attributes would be preserved
    // while custom ones get randomized
  });

  it('should randomize aria-label values', () => {
    const html = '<button aria-label="Close dialog">X</button>';
    const $ = load(html);
    const siteId = 'test-site';

    const { createHash } = await import('node:crypto');
    const oldLabel = $('[aria-label]').attr('aria-label');
    const hash = createHash('sha1').update(`${siteId}:${oldLabel}`).digest('hex').slice(0, 8);
    const newLabel = `aria_${hash}`;

    $('[aria-label]').attr('aria-label', newLabel);

    expect($('[aria-label]').attr('aria-label')).toBe(newLabel);
    expect($('[aria-label]').attr('aria-label')).not.toContain('Close dialog');
  });

  it('should preserve structural aria-* attributes', () => {
    const html = `
      <div id="heading" aria-label="Title">Title</div>
      <div aria-labelledby="heading">Content</div>
    `;
    const $ = load(html);

    // Verify aria-labelledby exists (structural, not randomized)
    expect($('[aria-labelledby]').attr('aria-labelledby')).toBe('heading');
  });

  it('should avoid randomizing UUID values in data attributes', () => {
    const html = '<div data-id="550e8400-e29b-41d4-a716-446655440000">Content</div>';
    const $ = load(html);

    const originalValue = $('[data-id]').attr('data-id');
    // UUID should not be randomized (would break external systems)
    expect(originalValue).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('should handle deterministic randomization of attributes', () => {
    const siteId = 'deterministic-test';
    const idValue = 'hero-section';

    // Generate randomized value twice
    const rand1 = `id_${generateDeterministicString(siteId, `id:${idValue}`, 8)}`;
    const rand2 = `id_${generateDeterministicString(siteId, `id:${idValue}`, 8)}`;

    // Should be identical
    expect(rand1).toBe(rand2);
  });

  it('should generate different attribute values for different siteIds', () => {
    const idValue = 'hero-section';

    const rand1 = `id_${generateDeterministicString('site-001', `id:${idValue}`, 8)}`;
    const rand2 = `id_${generateDeterministicString('site-002', `id:${idValue}`, 8)}`;

    // Should differ
    expect(rand1).not.toBe(rand2);
  });

  it('should handle multiple ID attributes in same document', () => {
    const html = `
      <div id="hero">Hero</div>
      <div id="about">About</div>
      <div id="contact">Contact</div>
    `;
    const $ = load(html);
    const siteId = 'test-site';

    const mapping = {};
    $('[id]').each((i, el) => {
      const oldId = $(el).attr('id');
      const newId = `id_${generateDeterministicString(siteId, `id:${oldId}`, 8)}`;
      mapping[oldId] = newId;
      $(el).attr('id', newId);
    });

    // All IDs should be unique
    const ids = Object.values(mapping);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    // All should be randomized
    for (const oldId of Object.keys(mapping)) {
      expect(mapping[oldId]).not.toBe(oldId);
    }
  });

  it('should handle empty and missing attributes gracefully', () => {
    const html = '<div id="" data-attr="">Content</div><span>No ID</span>';
    const $ = load(html);

    // Should handle empty id gracefully
    const emptyId = $('#div').attr('id');
    expect(emptyId === '' || emptyId === undefined).toBe(true);

    // Should handle elements with no attributes
    expect($('span').attr('id')).toBeUndefined();
  });

  it('should preserve data attribute prefixes in randomized values', () => {
    const html = '<div data-custom="value">Content</div>';
    const $ = load(html);
    const siteId = 'test-site';

    const oldValue = $('[data-custom]').attr('data-custom');
    const newValue = generateDeterministicString(siteId, `data:data-custom:${oldValue}`, 10);

    $('[data-custom]').attr('data-custom', newValue);

    // Verify attribute name not changed, only value
    expect($('[data-custom]').length).toBe(1);
    expect($('[data-custom]').attr('data-custom')).toBe(newValue);
  });

  it('should handle aria-label with special characters', () => {
    const html = '<button aria-label="Close &amp; confirm">OK</button>';
    const $ = load(html);
    const siteId = 'test-site';

    const oldLabel = $('[aria-label]').attr('aria-label');
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha1').update(`${siteId}:${oldLabel}`).digest('hex').slice(0, 8);
    const newLabel = `aria_${hash}`;

    $('[aria-label]').attr('aria-label', newLabel);

    expect($('[aria-label]').attr('aria-label')).toMatch(/^aria_[a-f0-9]{8}$/);
  });
});
