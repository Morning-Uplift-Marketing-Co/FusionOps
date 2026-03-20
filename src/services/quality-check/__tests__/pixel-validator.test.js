/**
 * Tracking Pixel Validator Tests
 * ==============================
 * Tests for QUAL-02: Tracking pixel detection for Voluum and Google
 */

import { describe, it, expect } from 'vitest';
import { checkTrackingPixels } from '../validators/pixel-validator.js';

describe('checkTrackingPixels - Voluum Detection', () => {
  it('should pass when Voluum vol_pixel img tag detected', () => {
    const html = `
      <html>
        <body>
          <img src="https://example.voluum.com/vol_pixel?id=123" alt="pixel">
        </body>
      </html>
    `;
    const result = checkTrackingPixels(html);

    expect(result.passed).toBe(true);
    expect(result.id).toBe('QUAL-02');
    expect(result.details.voluum).toBe(true);
  });

  it('should pass when Voluum conversion.gif detected', () => {
    const html = `
      <html>
        <body>
          <img src="https://example.com/conversion.gif" alt="pixel">
        </body>
      </html>
    `;
    const result = checkTrackingPixels(html);

    expect(result.passed).toBe(true);
    expect(result.details.voluum).toBe(true);
  });

  it('should fail when no tracking pixels detected', () => {
    const html = `
      <html>
        <body>
          <img src="https://example.com/logo.png" alt="logo">
        </body>
      </html>
    `;
    const result = checkTrackingPixels(html);

    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('No tracking pixels');
  });
});

describe('checkTrackingPixels - Google Conversion Tracking', () => {
  it('should pass when Google gtag.js script detected with gtag config and GCLID', () => {
    const html = `
      <html>
        <head>
          <script src="https://www.googletagmanager.com/gtag/js?id=G-123456"></script>
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-123456');
          </script>
        </head>
        <body>
          <a href="?gclid=abc123def">Link</a>
        </body>
      </html>
    `;
    const result = checkTrackingPixels(html);

    expect(result.passed).toBe(true);
    expect(result.details.google).toBe(true);
    expect(result.details.gclid).toBe(true);
  });

  it('should pass when GCLID in URL parameter', () => {
    const html = `
      <html>
        <body>
          <a href="?gclid=abc123def456">Link</a>
        </body>
      </html>
    `;
    const result = checkTrackingPixels(html, {});

    expect(result.details.gclid).toBe(true);
  });

  it('should pass when GCLID in hidden form field', () => {
    const html = `
      <html>
        <body>
          <form>
            <input type="hidden" name="gclid" value="abc123">
          </form>
        </body>
      </html>
    `;
    const result = checkTrackingPixels(html);

    expect(result.details.gclid).toBe(true);
  });

  it('should fail when gtag present but GCLID missing (incomplete Google Ads setup)', () => {
    const html = `
      <html>
        <head>
          <script src="https://www.googletagmanager.com/gtag/js?id=G-123456"></script>
          <script>
            gtag('config', 'G-123456');
          </script>
        </head>
        <body>
          <div>No conversion parameter</div>
        </body>
      </html>
    `;
    const result = checkTrackingPixels(html);

    expect(result.details.google).toBe(true);
    expect(result.details.gclid).toBe(false);
  });
});

describe('checkTrackingPixels - Configuration Options', () => {
  it('should respect config.requireVoluum flag', () => {
    const html = `
      <html>
        <body>
          <img src="https://example.com/logo.png" alt="logo">
        </body>
      </html>
    `;
    const config = { requireVoluum: true };
    const result = checkTrackingPixels(html, config);

    expect(result.passed).toBe(false);
  });

  it('should pass when config.requireVoluum true and Voluum detected', () => {
    const html = `
      <html>
        <body>
          <img src="https://example.voluum.com/vol_pixel?id=123" alt="pixel">
        </body>
      </html>
    `;
    const config = { requireVoluum: true };
    const result = checkTrackingPixels(html, config);

    expect(result.passed).toBe(true);
  });

  it('should return result object with detected pixel details', () => {
    const html = `
      <html>
        <body>
          <img src="https://example.voluum.com/vol_pixel" alt="pixel">
        </body>
      </html>
    `;
    const result = checkTrackingPixels(html);

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('severity');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('details');
  });

  it('should not mutate input HTML', () => {
    const html = '<img src="https://example.voluum.com/vol_pixel">';
    const originalHtml = html;

    checkTrackingPixels(html);

    expect(html).toBe(originalHtml);
  });

  it('should handle empty HTML gracefully', () => {
    const html = '';
    const result = checkTrackingPixels(html);

    expect(result.passed).toBe(false);
  });

  it('should detect multiple tracking pixels and report all', () => {
    const html = `
      <html>
        <body>
          <img src="https://example.voluum.com/vol_pixel" alt="pixel">
          <script src="https://www.googletagmanager.com/gtag/js?id=G-123456"></script>
          <script>gtag('config', 'G-123456');</script>
          <input type="hidden" name="gclid" value="abc123">
        </body>
      </html>
    `;
    const result = checkTrackingPixels(html);

    expect(result.passed).toBe(true);
    expect(result.details.voluum).toBe(true);
    expect(result.details.google).toBe(true);
    expect(result.details.gclid).toBe(true);
  });
});
