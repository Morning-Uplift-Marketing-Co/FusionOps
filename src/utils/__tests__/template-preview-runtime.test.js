/**
 * Tests for template-preview-runtime.js
 * Tests: buildPreviewHtml
 */

import { describe, it, expect } from 'vitest';
import { buildPreviewHtml } from '../template-preview-runtime.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const SITE = {
  brand: 'TestBrand',
  domain: 'testbrand.com',
  colorId: 'ruby',
  h1: 'Get Cash Fast',
  sub: 'Apply in minutes',
  cta: 'Apply Now',
  conversionId: 'AW-12345',
  formStartLabel: 'form_start',
  formSubmitLabel: 'form_submit',
  voluumDomain: 'track.example.com',
  aid: '14881',
};

const COLORS = {
  p: [350, 85, 62],
  a: [40, 90, 55],
  s: [350, 75, 48],
};

const STATIC_HTML_FILES = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Landing Page</title>
</head>
<body>
  <h1>Hello World</h1>
  <button>Apply</button>
</body>
</html>`,
  'style.css': 'body { margin: 0; font-family: sans-serif; }',
};

const TAILWIND_HTML_FILES = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tailwind Page</title>
</head>
<body>
  <div class="flex items-center justify-center min-h-screen bg-blue-50">
    <h1 class="text-3xl font-bold text-blue-600 rounded-lg p-4">Hello from Bolt</h1>
  </div>
</body>
</html>`,
};

const SHADCN_HTML_FILES = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>shadcn Page</title>
</head>
<body>
  <div class="bg-primary text-primary-foreground p-4">Card</div>
</body>
</html>`,
  'src/index.css': `:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --muted: 210 40% 96.1%;
  --accent: 210 40% 96.1%;
  --destructive: 0 84.2% 60.2%;
  --border: 214.3 31.8% 91.4%;
  --radius: 0.5rem;
}`,
};

const ASTRO_FILES = {
  'src/pages/index.astro': `---
const title = "Hello";
---
<!DOCTYPE html>
<html>
<head><title>{title}</title></head>
<body>
  <Header />
  <h1>Welcome</h1>
</body>
</html>`,
  'src/components/Header.astro': `---
// Header component
---
<header><nav>Navigation</nav></header>`,
};

const VITE_REACT_FILES = {
  'package.json': JSON.stringify({ dependencies: { react: '^18' }, devDependencies: { vite: '^5' } }),
  'vite.config.ts': 'export default {};',
  'src/main.tsx': 'import App from "./App";',
  'src/App.tsx': 'export default function App() { return <div>Hello</div>; }',
};

// ─── buildPreviewHtml ───────────────────────────────────────────────────────

describe('buildPreviewHtml', () => {
  describe('static HTML templates', () => {
    it('should return valid HTML', () => {
      const html = buildPreviewHtml(STATIC_HTML_FILES, SITE, COLORS);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('should inject tracking stubs', () => {
      const html = buildPreviewHtml(STATIC_HTML_FILES, SITE, COLORS);
      expect(html).toContain('var conversionId=');
      expect(html).toContain('AW-12345');
      expect(html).toContain('window.dataLayer');
      expect(html).toContain('window.__fusionopsTrack');
    });

    it('should inline CSS files', () => {
      const html = buildPreviewHtml(STATIC_HTML_FILES, SITE, COLORS);
      expect(html).toContain('body { margin: 0;');
      expect(html).toContain('/* style.css */');
    });

    it('should preserve original HTML structure', () => {
      const html = buildPreviewHtml(STATIC_HTML_FILES, SITE, COLORS);
      expect(html).toContain('<h1>Hello World</h1>');
      expect(html).toContain('<button>Apply</button>');
    });
  });

  describe('Tailwind injection', () => {
    it('should inject Tailwind CDN when classes detected', () => {
      const html = buildPreviewHtml(TAILWIND_HTML_FILES, SITE, COLORS);
      expect(html).toContain('cdn.tailwindcss.com');
      expect(html).toContain('window.tailwind');
    });

    it('should include brand colors in Tailwind config', () => {
      const html = buildPreviewHtml(TAILWIND_HTML_FILES, SITE, COLORS);
      expect(html).toContain('hsl(350 85% 62%)'); // primary from COLORS.p
    });

    it('should NOT inject Tailwind when not needed', () => {
      const html = buildPreviewHtml(STATIC_HTML_FILES, SITE, COLORS);
      expect(html).not.toContain('cdn.tailwindcss.com');
    });

    it('should NOT double-inject Tailwind when CDN already present', () => {
      const files = {
        'index.html': '<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body><div class="flex items-center p-4 rounded-lg text-sm gap-4">hi</div></body></html>',
      };
      const html = buildPreviewHtml(files, SITE, COLORS);
      // Count occurrences of cdn.tailwindcss.com
      const matches = html.match(/cdn\.tailwindcss\.com/g) || [];
      expect(matches.length).toBe(1); // Only the original one
    });
  });

  describe('CSS variable override', () => {
    it('should inject shadcn variable overrides', () => {
      const html = buildPreviewHtml(SHADCN_HTML_FILES, SITE, COLORS);
      expect(html).toContain('id="lp-theme-override"');
      expect(html).toContain('--primary:');
      expect(html).toContain('350 85% 62%'); // From COLORS.p
    });

    it('should preserve existing background/foreground vars', () => {
      const html = buildPreviewHtml(SHADCN_HTML_FILES, SITE, COLORS);
      expect(html).toContain('--background:');
      expect(html).toContain('--radius: 0.5rem');
    });

    it('should NOT inject overrides for plain HTML without CSS vars', () => {
      const html = buildPreviewHtml(STATIC_HTML_FILES, SITE, COLORS);
      expect(html).not.toContain('lp-theme-override');
    });
  });

  describe('Astro template processing', () => {
    it('should strip frontmatter', () => {
      const html = buildPreviewHtml(ASTRO_FILES, SITE, COLORS);
      expect(html).not.toContain('const title = "Hello"');
      expect(html).not.toContain('---');
    });

    it('should inline components', () => {
      const html = buildPreviewHtml(ASTRO_FILES, SITE, COLORS);
      expect(html).toContain('<nav>Navigation</nav>');
    });

    it('should clean Astro syntax artifacts', () => {
      const files = {
        'src/pages/index.astro': '---\n---\n<!DOCTYPE html><html><head></head><body is:global><p>{year}</p></body></html>',
      };
      const html = buildPreviewHtml(files, SITE, COLORS);
      expect(html).not.toContain('is:global');
      expect(html).toContain(String(new Date().getFullYear()));
    });
  });

  describe('build-required templates', () => {
    it('should return a placeholder for Vite+React', () => {
      const html = buildPreviewHtml(VITE_REACT_FILES, SITE, COLORS);
      expect(html).toContain('build step');
      expect(html).toContain('npm run build');
    });
  });

  describe('error handling', () => {
    it('should return error HTML for no entry point', () => {
      const html = buildPreviewHtml({ 'readme.md': '# Hi' }, SITE, COLORS);
      expect(html).toContain('Preview Error');
      expect(html).toContain('No renderable entry point');
    });

    it('should handle empty files', () => {
      const html = buildPreviewHtml({}, SITE, COLORS);
      expect(html).toContain('Preview Error');
    });

    it('should handle missing site config gracefully', () => {
      const html = buildPreviewHtml(STATIC_HTML_FILES, {}, null);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('var conversionId=');
    });
  });

  describe('Tailwind source CSS handling', () => {
    it('should use text/tailwindcss type for @tailwind directives', () => {
      const files = {
        'index.html': '<!DOCTYPE html><html><head></head><body><div class="flex items-center p-4 rounded-lg text-sm gap-4">hi</div></body></html>',
        'src/index.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n.custom { @apply p-4; }',
      };
      const html = buildPreviewHtml(files, SITE, COLORS);
      expect(html).toContain('type="text/tailwindcss"');
      expect(html).toContain('@tailwind base');
    });

    it('should use regular style tags for non-Tailwind CSS', () => {
      const html = buildPreviewHtml(STATIC_HTML_FILES, SITE, COLORS);
      // The CSS should be in a regular <style> tag, not text/tailwindcss
      expect(html).toContain('<style>\n/* style.css */');
      expect(html).not.toContain('text/tailwindcss');
    });
  });
});
