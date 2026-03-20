/**
 * Fingerprint Seeder Tests
 * ========================
 * Tests for deterministic seed derivation and class name mapping.
 *
 * Key invariants tested:
 * - Same siteId + namespace → identical RNG sequence
 * - Different namespaces get different seeds (no collisions)
 * - Class name mapping is deterministic and collision-free
 * - Tailwind utilities are preserved (not randomized)
 */

import { describe, it, expect } from 'vitest';
import {
  createDeterministicRng,
  generateDeterministicString,
  createClassNameMap
} from './fingerprint-seeder.js';

describe('Fingerprint Seeder - Determinism', () => {
  it('should produce identical RNG sequences for same siteId and namespace', () => {
    const siteId = 'test-site-001';
    const namespace = 'classNames';

    // Generate first sequence
    const rng1 = createDeterministicRng(siteId, namespace);
    const seq1 = Array.from({ length: 10 }, () => rng1());

    // Generate second sequence with same inputs
    const rng2 = createDeterministicRng(siteId, namespace);
    const seq2 = Array.from({ length: 10 }, () => rng2());

    // Must match exactly (no rounding errors)
    expect(seq1).toEqual(seq2);
  });

  it('should produce different RNG sequences for different siteIds', () => {
    const namespace = 'classNames';

    // Generate sequences for different sites
    const rng1 = createDeterministicRng('site-001', namespace);
    const seq1 = Array.from({ length: 10 }, () => rng1());

    const rng2 = createDeterministicRng('site-002', namespace);
    const seq2 = Array.from({ length: 10 }, () => rng2());

    // Sequences must differ
    expect(seq1).not.toEqual(seq2);
  });

  it('should produce different RNG sequences for different namespaces', () => {
    const siteId = 'test-site-001';

    // Generate sequences for different namespaces
    const rng1 = createDeterministicRng(siteId, 'classNames');
    const seq1 = Array.from({ length: 10 }, () => rng1());

    const rng2 = createDeterministicRng(siteId, 'domAttributes');
    const seq2 = Array.from({ length: 10 }, () => rng2());

    // Sequences must differ (namespace isolation)
    expect(seq1).not.toEqual(seq2);
  });

  it('should return values in [0, 1) range', () => {
    const rng = createDeterministicRng('test-site', 'test');

    for (let i = 0; i < 20; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('should be repeatable after creating new RNG instance', () => {
    const siteId = 'determinism-test';
    const namespace = 'test';

    // First RNG instance
    const rng1 = createDeterministicRng(siteId, namespace);
    const val1 = rng1();

    // Second RNG instance (fresh)
    const rng2 = createDeterministicRng(siteId, namespace);
    const val2 = rng2();

    // Must be identical
    expect(val1).toBe(val2);
  });
});

describe('Fingerprint Seeder - String Generation', () => {
  it('should generate deterministic strings for same inputs', () => {
    const siteId = 'test-site';
    const namespace = 'stringTest';

    const str1 = generateDeterministicString(siteId, namespace, 8);
    const str2 = generateDeterministicString(siteId, namespace, 8);

    expect(str1).toBe(str2);
  });

  it('should generate different strings for different siteIds', () => {
    const namespace = 'stringTest';

    const str1 = generateDeterministicString('site-001', namespace, 8);
    const str2 = generateDeterministicString('site-002', namespace, 8);

    expect(str1).not.toBe(str2);
  });

  it('should generate different strings for different namespaces', () => {
    const siteId = 'test-site';

    const str1 = generateDeterministicString(siteId, 'namespace1', 8);
    const str2 = generateDeterministicString(siteId, 'namespace2', 8);

    expect(str1).not.toBe(str2);
  });

  it('should respect requested string length', () => {
    const siteId = 'test-site';
    const namespace = 'lengthTest';

    for (const length of [4, 6, 8, 12, 16]) {
      const str = generateDeterministicString(siteId, namespace, length);
      expect(str.length).toBe(length);
    }
  });

  it('should only use specified charset', () => {
    const siteId = 'test-site';
    const namespace = 'charsetTest';
    const charset = 'abc123';

    for (let i = 0; i < 10; i++) {
      const str = generateDeterministicString(siteId, `${namespace}-${i}`, 20, charset);
      for (const char of str) {
        expect(charset).toContain(char);
      }
    }
  });

  it('should use default charset when not specified', () => {
    const siteId = 'test-site';
    const namespace = 'defaultCharset';

    const str = generateDeterministicString(siteId, namespace, 16);
    const defaultCharset = 'abcdefghijklmnopqrstuvwxyz0123456789';

    for (const char of str) {
      expect(defaultCharset).toContain(char);
    }
  });
});

describe('Fingerprint Seeder - Class Name Mapping', () => {
  it('should create deterministic mapping for same inputs', () => {
    const siteId = 'test-site';
    const classNames = ['hero', 'container', 'button', 'text-lg'];

    const map1 = createClassNameMap(siteId, classNames);
    const map2 = createClassNameMap(siteId, classNames);

    expect(map1).toEqual(map2);
  });

  it('should create different mappings for different siteIds', () => {
    const classNames = ['hero', 'container', 'button'];

    const map1 = createClassNameMap('site-001', classNames);
    const map2 = createClassNameMap('site-002', classNames);

    // Overall maps should differ
    expect(map1).not.toEqual(map2);
  });

  it('should preserve Tailwind utility classes', () => {
    const siteId = 'test-site';
    const classNames = [
      'md:flex',
      'lg:grid',
      'hover:bg-red-500',
      'focus:outline-none',
      'dark:bg-gray-900',
      'sm:w-full',
      'active:scale-95',
      'group:hover:text-blue'
    ];

    const map = createClassNameMap(siteId, classNames);

    // All Tailwind utilities should map to themselves
    for (const className of classNames) {
      expect(map[className]).toBe(className);
    }
  });

  it('should randomize custom class names', () => {
    const siteId = 'test-site';
    const classNames = ['hero', 'container', 'button', 'card'];

    const map = createClassNameMap(siteId, classNames);

    // Custom classes should map to different values
    expect(map['hero']).not.toBe('hero');
    expect(map['container']).not.toBe('container');
    expect(map['button']).not.toBe('button');
    expect(map['card']).not.toBe('card');
  });

  it('should not create class name collisions', () => {
    const siteId = 'test-site';
    const classNames = Array.from({ length: 100 }, (_, i) => `class-${i}`);

    const map = createClassNameMap(siteId, classNames);
    const values = Object.values(map);

    // All values should be unique
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('should handle mixed Tailwind and custom classes', () => {
    const siteId = 'test-site';
    const classNames = [
      'md:flex',
      'hero',
      'hover:bg-red',
      'container',
      'lg:grid',
      'button'
    ];

    const map = createClassNameMap(siteId, classNames);

    // Tailwind utilities should be preserved
    expect(map['md:flex']).toBe('md:flex');
    expect(map['hover:bg-red']).toBe('hover:bg-red');
    expect(map['lg:grid']).toBe('lg:grid');

    // Custom classes should be randomized
    expect(map['hero']).not.toBe('hero');
    expect(map['container']).not.toBe('container');
    expect(map['button']).not.toBe('button');
  });

  it('should handle empty class list', () => {
    const siteId = 'test-site';
    const map = createClassNameMap(siteId, []);

    expect(map).toEqual({});
  });

  it('should handle single class name', () => {
    const siteId = 'test-site';
    const classNames = ['hero'];

    const map = createClassNameMap(siteId, classNames);

    expect(map).toHaveProperty('hero');
    expect(map['hero']).not.toBe('hero');
  });

  it('should generate short, valid CSS identifiers', () => {
    const siteId = 'test-site';
    const classNames = ['hero', 'container', 'button'];

    const map = createClassNameMap(siteId, classNames);

    // All randomized values should be valid CSS identifiers
    const validCssIdentifier = /^[a-z0-9]+$/;
    for (const [original, randomized] of Object.entries(map)) {
      if (original !== randomized) {
        // Custom class (was randomized)
        expect(randomized).toMatch(validCssIdentifier);
      }
    }
  });

  it('should consistently map same class name across multiple calls', () => {
    const siteId = 'test-site';
    const classNames = ['hero', 'container', 'button'];

    const map1 = createClassNameMap(siteId, classNames);
    const map2 = createClassNameMap(siteId, classNames);
    const map3 = createClassNameMap(siteId, classNames);

    expect(map1['hero']).toBe(map2['hero']);
    expect(map2['hero']).toBe(map3['hero']);

    expect(map1['container']).toBe(map2['container']);
    expect(map2['container']).toBe(map3['container']);
  });
});

describe('Fingerprint Seeder - Edge Cases', () => {
  it('should handle special characters in siteId', () => {
    const classNames = ['hero', 'container'];

    // These should not throw
    const map1 = createClassNameMap('site-001-test@domain.com', classNames);
    const map2 = createClassNameMap('site/002/test', classNames);

    expect(map1).toBeDefined();
    expect(map2).toBeDefined();
  });

  it('should handle very long class names', () => {
    const siteId = 'test-site';
    const longClassName = 'very-long-class-name-' + 'x'.repeat(100);

    const map = createClassNameMap(siteId, [longClassName]);

    expect(map[longClassName]).toBeDefined();
    expect(map[longClassName]).not.toBe(longClassName);
  });

  it('should handle class names with special characters (from CSS Modules)', () => {
    const siteId = 'test-site';
    const classNames = [
      'module_hero__x1y2z3',
      'styles__container--active',
      'btn--primary_lg'
    ];

    const map = createClassNameMap(siteId, classNames);

    // These should be randomized (not Tailwind utilities)
    expect(map['module_hero__x1y2z3']).not.toBe('module_hero__x1y2z3');
  });

  it('should handle namespace parameter in deterministic generation', () => {
    const siteId = 'test-site';
    const baseNamespace = 'test';

    const str1 = generateDeterministicString(siteId, `${baseNamespace}:0`, 8);
    const str2 = generateDeterministicString(siteId, `${baseNamespace}:1`, 8);

    expect(str1).not.toBe(str2);
  });

  it('should maintain determinism across process boundaries (simulated)', () => {
    const siteId = 'boundary-test-site';
    const classNames = ['hero', 'container', 'button'];

    // Simulate process restart by creating completely new instances
    const results = [];
    for (let i = 0; i < 3; i++) {
      const map = createClassNameMap(siteId, classNames);
      results.push(map['hero']);
    }

    // All should be identical
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
  });
});
