/**
 * Determinism Tests
 * =================
 * Verify that seeded RNG produces byte-identical output across redeploys.
 */

import { describe, it, expect } from 'vitest';
import { createDeterministicRng, generateDeterministicString, createClassNameMap } from '../utils/fingerprint-seeder.js';

describe('Deterministic Fingerprinting', () => {
  it('should produce identical RNG sequences for same siteId', () => {
    const siteId = 'test-site-001';
    const namespace = 'classNames';

    // Generate sequence 1
    const rng1 = createDeterministicRng(siteId, namespace);
    const seq1 = Array.from({ length: 10 }, () => rng1());

    // Generate sequence 2 (fresh RNG, same inputs)
    const rng2 = createDeterministicRng(siteId, namespace);
    const seq2 = Array.from({ length: 10 }, () => rng2());

    // Must match byte-for-byte
    expect(seq1).toEqual(seq2);
  });

  it('should produce different RNG sequences for different siteIds', () => {
    const namespace = 'classNames';

    const rng1 = createDeterministicRng('site-001', namespace);
    const seq1 = Array.from({ length: 10 }, () => rng1());

    const rng2 = createDeterministicRng('site-002', namespace);
    const seq2 = Array.from({ length: 10 }, () => rng2());

    // Must differ
    expect(seq1).not.toEqual(seq2);
  });

  it('should produce different sequences for different namespaces', () => {
    const siteId = 'test-site-001';

    const rng1 = createDeterministicRng(siteId, 'classNames');
    const seq1 = Array.from({ length: 10 }, () => rng1());

    const rng2 = createDeterministicRng(siteId, 'domAttributes');
    const seq2 = Array.from({ length: 10 }, () => rng2());

    // Must differ (different namespace = different seed)
    expect(seq1).not.toEqual(seq2);
  });

  it('should generate identical strings for same siteId and namespace', () => {
    const siteId = 'determinism-test';
    const namespace = 'test-gen';

    const str1 = generateDeterministicString(siteId, namespace, 8, 'abcdefghijklmnopqrstuvwxyz0123456789');
    const str2 = generateDeterministicString(siteId, namespace, 8, 'abcdefghijklmnopqrstuvwxyz0123456789');

    expect(str1).toBe(str2);
  });

  it('should generate different strings for different siteIds', () => {
    const namespace = 'test-gen';

    const str1 = generateDeterministicString('site-001', namespace, 8);
    const str2 = generateDeterministicString('site-002', namespace, 8);

    expect(str1).not.toBe(str2);
  });

  it('should create identical class name maps for same siteId', () => {
    const siteId = 'map-test';
    const classNames = ['hero-section', 'container', 'button', 'text-primary', 'hover:text-secondary'];

    // Generate map 1
    const map1 = createClassNameMap(siteId, classNames);

    // Generate map 2 (fresh, same inputs)
    const map2 = createClassNameMap(siteId, classNames);

    // Must match exactly
    expect(map1).toEqual(map2);
  });

  it('should create different class name maps for different siteIds', () => {
    const classNames = ['hero-section', 'container', 'button'];

    const map1 = createClassNameMap('site-001', classNames);
    const map2 = createClassNameMap('site-002', classNames);

    // Maps must differ (at least some classes differ)
    let hasDifference = false;
    for (const className of classNames) {
      if (!className.includes(':') && map1[className] !== map2[className]) {
        hasDifference = true;
        break;
      }
    }
    expect(hasDifference).toBe(true);
  });

  it('should skip Tailwind utilities in class name mapping', () => {
    const siteId = 'tailwind-test';
    const classNames = [
      'hover:text-blue-500',
      'md:flex',
      'dark:bg-gray-900',
      'focus:outline-none',
      'custom-class'
    ];

    const map = createClassNameMap(siteId, classNames);

    // Tailwind utilities should remain unchanged
    expect(map['hover:text-blue-500']).toBe('hover:text-blue-500');
    expect(map['md:flex']).toBe('md:flex');
    expect(map['dark:bg-gray-900']).toBe('dark:bg-gray-900');
    expect(map['focus:outline-none']).toBe('focus:outline-none');

    // Custom class should be randomized
    expect(map['custom-class']).not.toBe('custom-class');
  });

  it('should avoid collisions in class name mapping', () => {
    const siteId = 'collision-test';
    const classNames = Array.from({ length: 50 }, (_, i) => `class-${i}`);

    const map = createClassNameMap(siteId, classNames);

    // Collect all randomized names
    const randomizedNames = new Set();
    for (const className of classNames) {
      const randomized = map[className];
      expect(randomizedNames.has(randomized)).toBe(false); // No collision
      randomizedNames.add(randomized);
    }

    expect(randomizedNames.size).toBe(classNames.length);
  });

  it('should maintain namespace isolation across multiple operations', () => {
    const siteId = 'isolation-test';

    // Generate values for different namespaces
    const classStr = generateDeterministicString(siteId, 'classNames', 6);
    const idStr = generateDeterministicString(siteId, 'domAttributes', 6);
    const metaStr = generateDeterministicString(siteId, 'metaTags', 6);

    // All should differ
    expect(classStr).not.toBe(idStr);
    expect(classStr).not.toBe(metaStr);
    expect(idStr).not.toBe(metaStr);

    // Re-generating same namespace should match
    const classStr2 = generateDeterministicString(siteId, 'classNames', 6);
    expect(classStr).toBe(classStr2);
  });

  it('should handle edge cases: empty strings, special characters', () => {
    const siteId = 'edge-case-test';

    // Test with special characters
    const str1 = generateDeterministicString(siteId, 'special-!@#$%', 8);
    const str2 = generateDeterministicString(siteId, 'special-!@#$%', 8);
    expect(str1).toBe(str2);

    // Test with very long namespace
    const longNamespace = 'a'.repeat(1000);
    const str3 = generateDeterministicString(siteId, longNamespace, 8);
    const str4 = generateDeterministicString(siteId, longNamespace, 8);
    expect(str3).toBe(str4);
  });

  it('should verify determinism holds across multiple calls', () => {
    const siteId = 'multi-call-test';
    const namespace = 'multi';

    // Generate many values and verify they're always the same
    const values = [];
    for (let i = 0; i < 100; i++) {
      values.push(generateDeterministicString(siteId, namespace, 6));
    }

    // All should be identical
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBe(values[0]);
    }
  });
});
