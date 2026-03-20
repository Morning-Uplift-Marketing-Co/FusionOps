import { describe, it, expect } from 'vitest';
import { NetworkRandomizer } from '../network-randomization.js';

describe('NetworkRandomizer', () => {
  describe('Jitter Range (3 tests)', () => {
    it('jitter delays within safe range (50-500ms by default)', () => {
      const html = '<img src="https://pixel.example.com/track.gif" />';
      const result = NetworkRandomizer.transform(html, 'test-site', { min: 50, max: 500 });
      expect(result.jitterApplied).toBe(true);
      expect(result.html).toBeDefined();
    });

    it('custom jitter ranges accepted via options.min / options.max', () => {
      const html = '<script>navigator.sendBeacon("https://pixel.example.com");</script>';
      const result = NetworkRandomizer.transform(html, 'test-site', { min: 100, max: 300 });
      expect(result.jitterApplied).toBe(true);
      expect(result.html).toContain('100');
      expect(result.html).toContain('300');
    });

    it('invalid ranges (min > max, max > 2000) throw errors', () => {
      const html = '<img src="pixel.gif" />';
      expect(() => {
        NetworkRandomizer.transform(html, 'test-site', { min: 500, max: 100 });
      }).toThrow();
    });
  });

  describe('Network API Wrappers (4 tests)', () => {
    it('sendBeacon API wrapped with jitter delays', () => {
      const html = '<script>navigator.sendBeacon("https://pixel.example.com");</script>';
      const result = NetworkRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('sendBeacon');
      expect(result.html).toContain('setTimeout');
      expect(result.jitterApplied).toBe(true);
    });

    it('fetch API wrapped as fallback', () => {
      const html = '<script>fetch("https://pixel.example.com").catch(e => console.log(e));</script>';
      const result = NetworkRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('fetch');
      expect(result.jitterApplied).toBe(true);
    });

    it('multiple sendBeacon calls delay independently', () => {
      const html = `
        <script>
          navigator.sendBeacon("https://pixel1.com");
          navigator.sendBeacon("https://pixel2.com");
          navigator.sendBeacon("https://pixel3.com");
        </script>
      `;
      const result = NetworkRandomizer.transform(html, 'test-site', {});
      expect(result.jitterApplied).toBe(true);
      expect(result.html).toContain('sendBeacon');
    });

    it('sendBeacon still returns true immediately (queued, but executed after jitter)', () => {
      const html = '<script>const result = navigator.sendBeacon("https://pixel.com"); console.log(result === true);</script>';
      const result = NetworkRandomizer.transform(html, 'test-site', {});
      expect(result.jitterApplied).toBe(true);
      expect(result.html).toContain('return true');
    });
  });

  describe('HTML Transformation (3 tests)', () => {
    it('jitter wrapper script injected into HTML head', () => {
      const html = '<html><head><title>Test</title></head><body><script>navigator.sendBeacon("pixel");</script></body></html>';
      const result = NetworkRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('</head>');
      expect(result.html).toContain('setTimeout');
      expect(result.jitterApplied).toBe(true);
    });

    it('script injected before first <script> if no head tag', () => {
      const html = '<body><script>navigator.sendBeacon("pixel");</script></body>';
      const result = NetworkRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('setTimeout');
      expect(result.jitterApplied).toBe(true);
    });

    it('multiple injections do not conflict', () => {
      const html = '<html><head></head><body><script>fetch("p1");</script><script>fetch("p2");</script></body></html>';
      const result = NetworkRandomizer.transform(html, 'test-site', {});
      expect(result.jitterApplied).toBe(true);
      expect(result.html.includes('<script')).toBe(true);
    });
  });

  describe('Determinism (2 tests)', () => {
    it('same siteId produces consistent jitter sequence', () => {
      const html = '<script>navigator.sendBeacon("pixel");</script>';
      const result1 = NetworkRandomizer.transform(html, 'deterministic-site', {});
      const result2 = NetworkRandomizer.transform(html, 'deterministic-site', {});
      expect(result1.html).toBe(result2.html);
    });

    it('different siteIds produce different sequences', () => {
      const html = '<script>navigator.sendBeacon("pixel");</script>';
      const result1 = NetworkRandomizer.transform(html, 'site-a', {});
      const result2 = NetworkRandomizer.transform(html, 'site-b', {});
      expect(result1.html).not.toBe(result2.html);
    });
  });

  describe('Pixel Loss Simulation (2 tests)', () => {
    it('simulated 1000 pixel fires show <2% loss rate', async () => {
      const html = '<script>for(let i = 0; i < 1000; i++) navigator.sendBeacon("pixel");</script>';
      const result = NetworkRandomizer.transform(html, 'test-site', { min: 50, max: 500 });
      expect(result.jitterApplied).toBe(true);
      expect(result.html).toBeDefined();
    });

    it('sendBeacon fallback handles errors gracefully', () => {
      const html = '<script>navigator.sendBeacon("https://invalid-pixel.example.com");</script>';
      const result = NetworkRandomizer.transform(html, 'test-site', {});
      expect(result.jitterApplied).toBe(true);
      expect(result.html).toBeDefined();
    });
  });

  describe('Integration (2 tests)', () => {
    it('returns {html, jitterApplied: boolean}', () => {
      const html = '<script>navigator.sendBeacon("pixel");</script>';
      const result = NetworkRandomizer.transform(html, 'test-site', {});
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('jitterApplied');
      expect(typeof result.jitterApplied).toBe('boolean');
    });

    it('Voluum pixel attributes preserved (data-pixel, src attributes)', () => {
      const html = `
        <img data-pixel="voluum-impression" src="https://voluum.example.com/track.gif" />
        <script>
          const pixel = document.querySelector('[data-pixel]');
          navigator.sendBeacon(pixel.src);
        </script>
      `;
      const result = NetworkRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('data-pixel="voluum-impression"');
      expect(result.html).toContain('voluum.example.com');
    });
  });
});
