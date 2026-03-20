import { describe, it, expect } from 'vitest';
import { checkGoogleAdMarkers } from '../validators/google-ads-validator.js';

describe('google-ads-validator', () => {
  describe('checkGoogleAdMarkers', () => {
    // Test 1: Pass when gtag.js script tag + gtag('config', 'G-...') + GCLID URL parameter present
    it('should pass when all three components (gtag script, config, GCLID) are present', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XXXXXXXXXX');
          </script>
        </head>
        <body>
          <a href="/?gclid=CjwKCAiA9f2kBhAOEiwAK0YH-XXXXXXX">Link</a>
        </body>
        </html>
      `;

      const result = checkGoogleAdMarkers(html);

      expect(result.id).toBe('QUAL-04');
      expect(result.name).toBe('Google Ads Tracking Markers');
      expect(result.passed).toBe(true);
      expect(result.severity).toBe('info');
      expect(result.details.gtagScriptPresent).toBe(true);
      expect(result.details.conversionIdValid).toBe(true);
      expect(result.details.gclIdPresent).toBe(true);
    });

    // Test 2: Fail when gtag script missing
    it('should fail when gtag script is missing', () => {
      const html = `
        <html>
        <body>
          <a href="/?gclid=abc123">Link</a>
        </body>
        </html>
      `;

      const result = checkGoogleAdMarkers(html);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.details.gtagScriptPresent).toBe(false);
      expect(result.details.conversionIdValid).toBe(false);
      expect(result.message).toContain('incomplete');
    });

    // Test 3: Fail when conversion ID missing or invalid format (not G-*)
    it('should fail when conversion ID is missing', () => {
      const html = `
        <html>
        <head>
          <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
        </head>
        <body>
          <a href="/?gclid=abc123">Link</a>
        </body>
        </html>
      `;

      const result = checkGoogleAdMarkers(html);

      expect(result.passed).toBe(false);
      expect(result.details.gtagScriptPresent).toBe(true);
      expect(result.details.conversionIdValid).toBe(false);
    });

    // Test 4: Fail when GCLID parameter missing
    it('should fail when GCLID parameter is missing', () => {
      const html = `
        <html>
        <head>
          <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
          <script>
            gtag('config', 'G-XXXXXXXXXX');
          </script>
        </head>
        <body>
          <p>No GCLID here</p>
        </body>
        </html>
      `;

      const result = checkGoogleAdMarkers(html);

      expect(result.passed).toBe(false);
      expect(result.details.gclIdPresent).toBe(false);
    });

    // Test 5: Pass when GCLID in form field instead of URL
    it('should pass when GCLID is in form field instead of URL', () => {
      const html = `
        <html>
        <head>
          <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
          <script>
            gtag('config', 'G-XXXXXXXXXX');
          </script>
        </head>
        <body>
          <form>
            <input type="hidden" name="gclid" value="CjwKCAiA9f2kBhAOEiwAK0YH-XXXXXXX">
          </form>
        </body>
        </html>
      `;

      const result = checkGoogleAdMarkers(html);

      expect(result.passed).toBe(true);
      expect(result.details.gclIdPresent).toBe(true);
    });

    // Test 6: Pass when conversion ID extracted from inline gtag config
    it('should pass when conversion ID is in inline gtag config', () => {
      const html = `
        <html>
        <head>
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-ABCDEFGHIJ');
          </script>
        </head>
        <body>
          <a href="/?gclid=test123">Link</a>
        </body>
        </html>
      `;

      const result = checkGoogleAdMarkers(html);

      expect(result.passed).toBe(true);
      expect(result.details.conversionIdValid).toBe(true);
    });

    // Test 7: Provide detailed checklist of missing components
    it('should provide detailed checklist of what is missing', () => {
      const html = `<html><body>Nothing here</body></html>`;

      const result = checkGoogleAdMarkers(html);

      expect(result.checklist).toBeDefined();
      expect(result.checklist['✓ gtag.js script present']).toBe(false);
      expect(result.checklist['✓ Conversion ID valid format (G-*)']).toBe(false);
      expect(result.checklist['✓ GCLID parameter detected']).toBe(false);
    });

    // Test 8: Accept conversion ID variations (G-XXXXXXXXXX, 10+ chars after G-)
    it('should accept various conversion ID formats (10+ chars)', () => {
      const html = `
        <html>
        <head>
          <script>
            gtag('config', 'G-1234567890');
          </script>
        </head>
        <body>
          <a href="/?gclid=test">Link</a>
        </body>
        </html>
      `;

      const result = checkGoogleAdMarkers(html);

      expect(result.details.conversionIdValid).toBe(true);
    });

    // Test 9: Handle malformed gtag scripts gracefully (no throw)
    it('should handle malformed gtag scripts gracefully', () => {
      const html = `
        <html>
        <script>
          // Broken gtag config
          gtag('config' G-INVALID);
        </script>
        </html>
      `;

      expect(() => {
        checkGoogleAdMarkers(html);
      }).not.toThrow();
    });

    // Test 10: Case-insensitive GCLID input field detection
    it('should detect GCLID input field (case-insensitive)', () => {
      const html = `
        <html>
        <head>
          <script>gtag('config', 'G-ABC1234567');</script>
        </head>
        <body>
          <form>
            <input type="hidden" name="GCLID" value="test123">
          </form>
        </body>
        </html>
      `;

      const result = checkGoogleAdMarkers(html);

      expect(result.details.gclIdPresent).toBe(true);
    });

    // Test 11: Detect gtag('event') as evidence of gtag presence
    it('should detect gtag("event") as valid gtag presence', () => {
      const html = `
        <html>
        <head>
          <script>
            gtag('event', 'page_view', {
              'page_title': 'Home',
              'page_path': '/'
            });
            gtag('config', 'G-XXXXXXXXXX');
          </script>
        </head>
        <body>
          <a href="/?gclid=abc">Link</a>
        </body>
        </html>
      `;

      const result = checkGoogleAdMarkers(html);

      expect(result.details.gtagScriptPresent).toBe(true);
    });

    // Test 12: Immutability - input should not be modified
    it('should not modify input HTML', () => {
      const html = `<html><body>Test</body></html>`;
      const htmlCopy = html;

      checkGoogleAdMarkers(html);

      expect(html).toBe(htmlCopy);
    });

    // Test 13: Empty HTML
    it('should handle empty HTML gracefully', () => {
      const result = checkGoogleAdMarkers('');

      expect(result.passed).toBe(false);
      expect(result.details).toBeDefined();
    });

    // Test 14: Fix message shows missing components
    it('should provide fix message with missing components', () => {
      const html = `<html><body>No tracking</body></html>`;

      const result = checkGoogleAdMarkers(html);

      expect(result.fix).toBeDefined();
      expect(result.fix).toContain('Missing');
    });

    // Test 15: Return value has expected structure
    it('should return object with id, name, passed, severity, message', () => {
      const html = `<html><body>Test</body></html>`;

      const result = checkGoogleAdMarkers(html);

      expect(result).toHaveProperty('id', 'QUAL-04');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('checklist');
    });

    // Test 16: GCLID with special characters
    it('should detect GCLID with special characters (-, _)', () => {
      const html = `
        <html>
        <head>
          <script>gtag('config', 'G-XXXXXXXXXX');</script>
        </head>
        <body>
          <a href="/?gclid=CjwKCAiA_Yx-BRBvEiwAK0YH-XXXXXXX">Link</a>
        </body>
        </html>
      `;

      const result = checkGoogleAdMarkers(html);

      expect(result.details.gclIdPresent).toBe(true);
    });

    // Test 17: Config as optional parameter
    it('should accept optional config parameter', () => {
      const html = `
        <html>
        <head>
          <script>gtag('config', 'G-XXXXXXXXXX');</script>
        </head>
        <body>
          <a href="/?gclid=test">Link</a>
        </body>
        </html>
      `;

      const result1 = checkGoogleAdMarkers(html);
      const result2 = checkGoogleAdMarkers(html, {});
      const result3 = checkGoogleAdMarkers(html, { required: true });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();
    });
  });
});
