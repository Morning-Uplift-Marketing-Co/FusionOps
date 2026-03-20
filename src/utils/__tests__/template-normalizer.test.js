import { describe, it, expect } from 'vitest';
import { normalizeTemplate } from '../template-normalizer.js';

describe('template-normalizer', () => {
  describe('normalizeTemplate', () => {
    it('should move pages/ to src/pages/ if src/ missing', () => {
      const files = {
        'pages/index.astro': '<h1>Home</h1>',
        'pages/about.astro': '<h1>About</h1>',
        'package.json': '{"name":"test"}',
      };

      const result = normalizeTemplate(files);

      expect(result.files['src/pages/index.astro']).toBe('<h1>Home</h1>');
      expect(result.files['src/pages/about.astro']).toBe('<h1>About</h1>');
      expect(result.files['pages/index.astro']).toBeUndefined();
      expect(result.changes).toContain('moved pages/ and components/ to src/');
    });

    it('should move components/ to src/components/ if src/ missing', () => {
      const files = {
        'components/Button.astro': '<button>Click</button>',
        'pages/index.astro': '<h1>Home</h1>',
        'package.json': '{"name":"test"}',
      };

      const result = normalizeTemplate(files);

      expect(result.files['src/components/Button.astro']).toBe(
        '<button>Click</button>'
      );
      expect(result.files['src/pages/index.astro']).toBe('<h1>Home</h1>');
      expect(result.files['components/Button.astro']).toBeUndefined();
    });

    it('should create astro.config.mjs if missing and astro in package.json', () => {
      const files = {
        'src/pages/index.astro': '<h1>Home</h1>',
        'package.json': '{"devDependencies":{"astro":"5.0.0"}}',
      };

      const result = normalizeTemplate(files);

      expect(result.files['astro.config.mjs']).toBeDefined();
      expect(result.files['astro.config.mjs']).toContain('export default');
      expect(result.files['astro.config.mjs']).toContain('integrations');
      expect(result.changes).toContain('created astro.config.mjs');
    });

    it('should not create astro.config.mjs if astro not in package.json', () => {
      const files = {
        'src/pages/index.html': '<h1>Home</h1>',
        'package.json': '{"devDependencies":{"webpack":"5.0.0"}}',
      };

      const result = normalizeTemplate(files);

      expect(result.files['astro.config.mjs']).toBeUndefined();
    });

    it('should create tsconfig.json if missing', () => {
      const files = {
        'src/pages/index.astro': '<h1>Home</h1>',
        'package.json': '{"name":"test"}',
      };

      const result = normalizeTemplate(files);

      expect(result.files['tsconfig.json']).toBeDefined();
      const tsconfig = JSON.parse(result.files['tsconfig.json']);
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.compilerOptions.target).toBe('ES2020');
      expect(result.changes).toContain('created tsconfig.json');
    });

    it('should not modify already-normalized structure', () => {
      const files = {
        'src/pages/index.astro': '<h1>Home</h1>',
        'src/components/Button.astro': '<button>Click</button>',
        'astro.config.mjs': 'export default {}',
        'tsconfig.json': '{}',
        'package.json': '{"name":"test"}',
      };

      const result = normalizeTemplate(files);

      expect(result.files['src/pages/index.astro']).toBe('<h1>Home</h1>');
      expect(result.files['src/components/Button.astro']).toBe(
        '<button>Click</button>'
      );
      expect(result.files['astro.config.mjs']).toBe('export default {}');
      expect(result.changes).toHaveLength(0);
    });

    it('should preserve root-level files during normalization', () => {
      const files = {
        'package.json': '{"name":"test"}',
        '.env': 'PUBLIC_BRAND=MyBrand',
        'pages/index.astro': '<h1>Home</h1>',
        'components/Button.astro': '<button>Click</button>',
      };

      const result = normalizeTemplate(files);

      expect(result.files['package.json']).toBe('{"name":"test"}');
      expect(result.files['.env']).toBe('PUBLIC_BRAND=MyBrand');
    });

    it('should detect entry point after normalization', () => {
      const files = {
        'pages/index.astro': '<h1>Home</h1>',
        'package.json': '{"name":"test"}',
      };

      const result = normalizeTemplate(files);

      expect(result.entryPoint).toBeDefined();
      expect(result.entryPoint).toMatch(/(index\.astro|index\.tsx|index\.jsx)/);
    });

    it('should return object with files, entryPoint, and changes', () => {
      const files = {
        'src/pages/index.astro': '<h1>Home</h1>',
        'package.json': '{"name":"test"}',
      };

      const result = normalizeTemplate(files);

      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('entryPoint');
      expect(result).toHaveProperty('changes');
      expect(Array.isArray(result.changes)).toBe(true);
    });

    it('should not mutate input files object', () => {
      const originalFiles = {
        'pages/index.astro': '<h1>Home</h1>',
        'package.json': '{"name":"test"}',
      };
      const inputFiles = { ...originalFiles };

      normalizeTemplate(inputFiles);

      expect(inputFiles).toEqual(originalFiles);
    });

    it('should handle empty files object', () => {
      const result = normalizeTemplate({});

      expect(result.files).toBeDefined();
      expect(result.entryPoint).toBeNull();
      // Empty files object still gets tsconfig.json created
      expect(result.files['tsconfig.json']).toBeDefined();
      expect(result.changes).toContain('created tsconfig.json');
    });

    it('should handle null or undefined input gracefully', () => {
      const result1 = normalizeTemplate(null);
      const result2 = normalizeTemplate(undefined);

      expect(result1.files).toBeDefined();
      expect(result2.files).toBeDefined();
      expect(result1.entryPoint).toBeNull();
      expect(result2.entryPoint).toBeNull();
    });

    it('should handle tsconfig.json with valid JSON structure', () => {
      const files = {
        'src/pages/index.astro': '<h1>Home</h1>',
        'package.json': '{"name":"test"}',
      };

      const result = normalizeTemplate(files);
      const tsconfigContent = result.files['tsconfig.json'];

      // Verify it's valid JSON
      expect(() => JSON.parse(tsconfigContent)).not.toThrow();

      // Verify structure
      const tsconfig = JSON.parse(tsconfigContent);
      expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler');
      expect(tsconfig.compilerOptions.module).toBe('ESNext');
    });

    it('should handle multiple moves and config creation together', () => {
      const files = {
        'pages/index.astro': '<h1>Home</h1>',
        'pages/about.astro': '<h1>About</h1>',
        'components/Header.astro': '<header>Header</header>',
        'package.json': '{"devDependencies":{"astro":"5.0.0"}}',
        '.env': 'PUBLIC_BRAND=MyBrand',
      };

      const result = normalizeTemplate(files);

      // Check files moved
      expect(result.files['src/pages/index.astro']).toBeDefined();
      expect(result.files['src/pages/about.astro']).toBeDefined();
      expect(result.files['src/components/Header.astro']).toBeDefined();

      // Check configs created
      expect(result.files['astro.config.mjs']).toBeDefined();
      expect(result.files['tsconfig.json']).toBeDefined();

      // Check changes recorded
      expect(result.changes).toContain('moved pages/ and components/ to src/');
      expect(result.changes).toContain('created astro.config.mjs');
      expect(result.changes).toContain('created tsconfig.json');

      // Check root files preserved
      expect(result.files['package.json']).toBeDefined();
      expect(result.files['.env']).toBeDefined();
    });
  });
});
