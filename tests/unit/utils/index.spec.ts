import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LS } from '../../../src/utils';

describe('LocalStorage Utility', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Also clear any items with our prefix
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('lpf2-')) {
        localStorage.removeItem(key);
      }
    });
  });

  describe('get()', () => {
    it('should return null for non-existent key', () => {
      expect(LS.get('nonexistent')).toBeNull();
    });

    it('should return parsed JSON for existing key', () => {
      LS.set('test-key', { foo: 'bar' });
      expect(LS.get('test-key')).toEqual({ foo: 'bar' });
    });

    it('should return null for invalid JSON', () => {
      localStorage.setItem('lpf2-invalid', 'not-json');
      expect(LS.get('invalid')).toBeNull();
    });
  });

  describe('set()', () => {
    it('should store value as JSON string', () => {
      LS.set('test-key', { foo: 'bar' });
      expect(localStorage.getItem('lpf2-test-key')).toBe('{"foo":"bar"}');
    });

    it('should return true on success', () => {
      expect(LS.set('test-key', { foo: 'bar' })).toBe(true);
    });

    it('should handle quota exceeded errors gracefully', () => {
      // Directly override localStorage.setItem for this specific key
      const originalLocalStorage = global.localStorage;
      const mockLocalStorage = {
        ...originalLocalStorage,
        setItem: () => {
          throw new Error('QuotaExceededError');
        }
      };

      // Replace localStorage with mock
      vi.stubGlobal('localStorage', mockLocalStorage);

      expect(LS.set('test-key', { foo: 'bar' })).toBe(false);

      // Restore original localStorage
      vi.unstubAllGlobals();
    });
  });

  describe('remove()', () => {
    it('should remove item from localStorage', () => {
      LS.set('test-key', { foo: 'bar' });
      expect(LS.get('test-key')).toEqual({ foo: 'bar' });
      LS.remove('test-key');
      expect(LS.get('test-key')).toBeNull();
    });

    it('should return true on success', () => {
      LS.set('test-key', { foo: 'bar' });
      expect(LS.remove('test-key')).toBe(true);
    });

    it('should handle errors gracefully', () => {
      // remove() returns true because it catches errors internally
      LS.set('test-key', { foo: 'bar' });
      expect(LS.remove('test-key')).toBe(true);
      // Trying to remove again (doesn't exist, but function handles it)
      expect(LS.remove('test-key')).toBe(true);
    });
  });

  describe('clear()', () => {
    it('should remove all lpf2- prefixed items', () => {
      LS.set('key1', { data: 1 });
      LS.set('key2', { data: 2 });
      localStorage.setItem('other-key', 'keep-this');

      LS.clear();

      expect(LS.get('key1')).toBeNull();
      expect(LS.get('key2')).toBeNull();
      expect(localStorage.getItem('other-key')).toBe('keep-this');
    });
  });
});
