/**
 * Viewport Meta Tag Validator Tests
 * ==================================
 * Tests for QUAL-01: Viewport meta tag detection and validation
 */

import { describe, it, expect } from 'vitest';
import { checkViewportMeta } from '../validators/viewport-validator.js';

describe('checkViewportMeta - Viewport Detection', () => {
  it('should pass when viewport meta tag correctly formatted with width=device-width and initial-scale', () => {
    const html = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head></html>';
    const result = checkViewportMeta(html);

    expect(result.passed).toBe(true);
    expect(result.severity).toBe('info');
    expect(result.id).toBe('QUAL-01');
    expect(result.message).toContain('correctly configured');
  });

  it('should fail when viewport meta tag is missing', () => {
    const html = '<html><head><title>Test</title></head></html>';
    const result = checkViewportMeta(html);

    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.id).toBe('QUAL-01');
    expect(result.message).toContain('Missing viewport meta tag');
  });

  it('should fail when viewport meta tag missing width=device-width', () => {
    const html = '<html><head><meta name="viewport" content="initial-scale=1"></head></html>';
    const result = checkViewportMeta(html);

    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('width=device-width');
  });

  it('should pass when viewport has width=device-width without initial-scale', () => {
    const html = '<html><head><meta name="viewport" content="width=device-width"></head></html>';
    const result = checkViewportMeta(html);

    expect(result.passed).toBe(true);
    expect(result.severity).toBe('info');
  });

  it('should pass with format variation - no spaces around comma', () => {
    const html = '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head></html>';
    const result = checkViewportMeta(html);

    expect(result.passed).toBe(true);
  });

  it('should pass when viewport has extra properties like maximum-scale', () => {
    const html = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5"></head></html>';
    const result = checkViewportMeta(html);

    expect(result.passed).toBe(true);
  });

  it('should return result object with immutable structure', () => {
    const html = '<html><head><meta name="viewport" content="width=device-width"></head></html>';
    const result = checkViewportMeta(html);

    // Verify required fields exist
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('severity');
    expect(result).toHaveProperty('message');
  });

  it('should not mutate input HTML', () => {
    const html = '<html><head><meta name="viewport" content="width=device-width"></head></html>';
    const originalHtml = html;

    checkViewportMeta(html);

    expect(html).toBe(originalHtml);
  });

  it('should handle empty HTML gracefully', () => {
    const html = '';
    const result = checkViewportMeta(html);

    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });
});
