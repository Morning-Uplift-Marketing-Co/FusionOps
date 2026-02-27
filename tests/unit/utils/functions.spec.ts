import { describe, it, expect } from 'vitest';
import { uid, now, hsl } from '../../../src/utils';

describe('Utility Functions', () => {
  describe('uid()', () => {
    it('should generate a 16-character string', () => {
      const id = uid();
      expect(id).toBeTruthy();
      expect(id.length).toBe(16);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(uid());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('now()', () => {
    it('should return ISO 8601 timestamp', () => {
      const timestamp = now();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return current time', () => {
      const before = new Date();
      const timestamp = now();
      const after = new Date();
      const parsed = new Date(timestamp);
      expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('hsl()', () => {
    it('should format HSL color string', () => {
      expect(hsl(200, 50, 50)).toBe('hsl(200,50%,50%)');
    });

    it('should handle zero values', () => {
      expect(hsl(0, 0, 0)).toBe('hsl(0,0%,0%)');
    });

    it('should handle maximum values', () => {
      expect(hsl(360, 100, 100)).toBe('hsl(360,100%,100%)');
    });
  });
});
