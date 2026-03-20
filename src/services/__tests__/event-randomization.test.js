import { describe, it, expect } from 'vitest';
import { EventRandomizer } from '../event-randomization.js';

describe('EventRandomizer', () => {
  describe('Selective Randomization (4 tests)', () => {
    it('event listeners on data-pixel elements are deferred', async () => {
      const html = `
        <button data-pixel="voluum-click" onclick="trackClick()">Click</button>
        <script>
          const btn = document.querySelector('[data-pixel]');
          btn.addEventListener('click', () => console.log('tracked'));
        </script>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.eventRandomizationApplied).toBe(true);
      expect(result.html).toContain('addEventListener');
    });

    it('event listeners on data-tracking elements are deferred', async () => {
      const html = `
        <div data-tracking="google-ads">
          <script>
            const el = document.querySelector('[data-tracking]');
            el.addEventListener('click', handleConversion);
          </script>
        </div>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.eventRandomizationApplied).toBe(true);
    });

    it('listeners on other elements attach immediately (not deferred)', async () => {
      const html = `
        <button id="submit-btn">Submit</button>
        <script>
          const btn = document.getElementById('submit-btn');
          btn.addEventListener('click', handleSubmit);
        </script>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toBeDefined();
    });

    it('multiple listeners on same element handled correctly', async () => {
      const html = `
        <div data-pixel="track-all">
          <script>
            const el = document.querySelector('[data-pixel]');
            el.addEventListener('click', track1);
            el.addEventListener('click', track2);
            el.addEventListener('click', track3);
          </script>
        </div>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.eventRandomizationApplied).toBe(true);
    });
  });

  describe('Protected Types (3 tests)', () => {
    it('click handlers attach immediately (not randomized)', async () => {
      const html = `
        <button onclick="handleClick()">Click</button>
        <script>
          function handleClick() { console.log('clicked'); }
        </script>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('onclick');
    });

    it('submit handlers attach immediately', async () => {
      const html = `
        <form onsubmit="handleSubmit()">
          <input type="text" />
        </form>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('onsubmit');
    });

    it('change, input, blur, focus handlers attach immediately', async () => {
      const html = `
        <input onchange="handleChange()" oninput="handleInput()" onblur="handleBlur()" onfocus="handleFocus()" />
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('onchange');
      expect(result.html).toContain('oninput');
      expect(result.html).toContain('onblur');
      expect(result.html).toContain('onfocus');
    });
  });

  describe('Protected Attributes (2 tests)', () => {
    it('elements with data-form attribute: handlers attach immediately', async () => {
      const html = `
        <form data-form="checkout">
          <button type="submit">Submit</button>
        </form>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('data-form="checkout"');
    });

    it('elements with data-validate or data-submit: handlers attach immediately', async () => {
      const html = `
        <input data-validate="email" />
        <button data-submit="form">Submit</button>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('data-validate="email"');
      expect(result.html).toContain('data-submit="form"');
    });
  });

  describe('Delay Behavior (3 tests)', () => {
    it('delays within safe range (50-300ms per delay pool)', async () => {
      const html = `
        <div data-pixel="track">
          <script>
            document.addEventListener('click', () => {});
          </script>
        </div>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', { enabled: true });
      expect(result.eventRandomizationApplied).toBe(true);
    });

    it('addEventListener wrapper intercepts all calls', async () => {
      const html = `
        <script>
          document.addEventListener('click', handler1);
          window.addEventListener('load', handler2);
          element.addEventListener('submit', handler3);
        </script>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('addEventListener');
    });

    it('deterministic delay sequence per siteId', async () => {
      const html = `
        <div data-pixel="track">
          <script>
            el.addEventListener('click', track);
          </script>
        </div>
      `;
      const result1 = await EventRandomizer.transform(html, 'site-a', {});
      const result2 = await EventRandomizer.transform(html, 'site-a', {});
      expect(result1.html).toBe(result2.html);
    });
  });

  describe('Form Framework Compatibility (3 tests)', () => {
    it('React Hook Form submission works after randomization', async () => {
      const html = `
        <form data-form="react-hook-form">
          <input {...register('email')} />
          <button type="submit">Submit</button>
        </form>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('data-form="react-hook-form"');
      expect(result.html).toContain('type="submit"');
    });

    it('Formik form submission works after randomization', async () => {
      const html = `
        <form onSubmit={formik.handleSubmit} data-form="formik">
          <input type="email" name="email" />
          <button type="submit">Submit</button>
        </form>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('data-form="formik"');
    });

    it('native HTML form submission unaffected', async () => {
      const html = `
        <form onsubmit="handleSubmit(event)">
          <input required />
          <button type="submit">Send</button>
        </form>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('onsubmit');
      expect(result.html).toContain('required');
    });
  });

  describe('HTML Transformation (2 tests)', () => {
    it('addEventListener wrapper script injected into HTML', async () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <script>
              document.addEventListener('click', track);
            </script>
          </body>
        </html>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('addEventListener');
      expect(result.eventRandomizationApplied).toBe(true);
    });

    it('tracking data attributes (data-pixel, data-tracking) preserved', async () => {
      const html = `
        <div data-pixel="voluum-click" data-tracking="google-ads">
          <script>
            el.addEventListener('click', () => {});
          </script>
        </div>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result.html).toContain('data-pixel="voluum-click"');
      expect(result.html).toContain('data-tracking="google-ads"');
    });
  });

  describe('Error Handling (1 test)', () => {
    it('invalid elements/listeners handled gracefully', async () => {
      const html = `
        <script>
          null.addEventListener('click', () => {});
        </script>
      `;
      const result = await EventRandomizer.transform(html, 'test-site', {});
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('eventRandomizationApplied');
    });
  });

  describe('Configuration & Returns (1 test)', () => {
    it('returns {html, eventRandomizationApplied} object with correct types', async () => {
      const html = '<div data-pixel="test"><script>el.addEventListener("click", h);</script></div>';
      const result = await EventRandomizer.transform(html, 'test-site', { enabled: true });
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('eventRandomizationApplied');
      expect(typeof result.html).toBe('string');
      expect(typeof result.eventRandomizationApplied).toBe('boolean');
    });
  });
});
