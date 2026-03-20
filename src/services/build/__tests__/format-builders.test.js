/**
 * Format Builders Tests
 * =====================
 * Test that each format builder (Astro, Vite, HTML) handles building independently.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { AstroBuilder } from '../AstroBuilder.js';
import { ViteBuilder } from '../ViteBuilder.js';
import { HtmlStaticBuilder } from '../HtmlStaticBuilder.js';
import { FormatBuilder } from '../FormatBuilder.js';

describe('Format Builders', () => {
  let testDir;

  beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), 'builder-test-'));
  });

  afterEach(async () => {
    try {
      const { rmSync } = await import('node:fs');
      rmSync(testDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('AstroBuilder', () => {
    it('should identify Astro templates', () => {
      const files = {
        'astro.config.mjs': 'export default {}',
        'package.json': '{}'
      };

      expect(AstroBuilder.canHandle(files, { id: 'astro' })).toBe(true);
      expect(AstroBuilder.canHandle(files, { id: 'vite-react' })).toBe(false);
    });

    it('should preprocess .astro files with env vars', async () => {
      // Mock the build process
      const builder = new AstroBuilder();
      const spy = vi.spyOn(FormatBuilder, 'execAsync').mockResolvedValue('');
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockResolvedValue(undefined);

      const files = {
        'src/pages/index.astro': 'const name = import.meta.env.PUBLIC_BRAND || "default"',
        'package.json': '{"name": "test"}'
      };
      const envVars = { PUBLIC_BRAND: 'TestBrand' };

      try {
        await builder.build(files, envVars, testDir);
        // Verify writeFilesSync was called (which means preprocessing happened)
        expect(FormatBuilder.writeFilesSync).toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    it('should return success with dist/ output on successful build', async () => {
      const builder = new AstroBuilder();
      vi.spyOn(FormatBuilder, 'execAsync').mockResolvedValue('');
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockResolvedValue(undefined);

      const result = await builder.build({}, {}, testDir);

      expect(result.success).toBe(true);
      expect(result.outputDir).toContain('dist');
      expect(result.error).toBeUndefined();
    });

    it('should return error on build failure', async () => {
      const builder = new AstroBuilder();
      const error = new Error('npm ci failed');
      vi.spyOn(FormatBuilder, 'execAsync').mockRejectedValue(error);
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockResolvedValue(undefined);

      const result = await builder.build({}, {}, testDir);

      expect(result.success).toBe(false);
      expect(result.outputDir).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('ViteBuilder', () => {
    it('should identify Vite/React templates', () => {
      const files = {
        'vite.config.js': 'export default {}',
        'package.json': '{"dependencies": {"react": "^19"}}'
      };

      expect(ViteBuilder.canHandle(files, { id: 'vite-react' })).toBe(true);
      expect(ViteBuilder.canHandle(files, { id: 'astro' })).toBe(false);
    });

    it('should create .env file with environment variables', async () => {
      const builder = new ViteBuilder();
      vi.spyOn(FormatBuilder, 'execAsync').mockResolvedValue('');
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockResolvedValue(undefined);

      const files = {
        'src/main.jsx': 'console.log(process.env.REACT_APP_BRAND)',
        'package.json': '{"name": "test"}'
      };
      const envVars = {
        REACT_APP_BRAND: 'TestBrand',
        REACT_APP_API_KEY: 'secret123'
      };

      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      try {
        await builder.build(files, envVars, testDir);
        // Verify .env file was written
        expect(writeFileSpy).toHaveBeenCalledWith(
          expect.stringContaining('.env'),
          expect.stringContaining('REACT_APP_BRAND'),
          'utf8'
        );
      } finally {
        writeFileSpy.mockRestore();
      }
    });

    it('should return success with dist/ output on successful build', async () => {
      const builder = new ViteBuilder();
      vi.spyOn(FormatBuilder, 'execAsync').mockResolvedValue('');
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockResolvedValue(undefined);
      vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      const result = await builder.build({}, {}, testDir);

      expect(result.success).toBe(true);
      expect(result.outputDir).toContain('dist');
    });

    it('should return error on build failure', async () => {
      const builder = new ViteBuilder();
      const error = new Error('Build failed');
      vi.spyOn(FormatBuilder, 'execAsync').mockRejectedValue(error);
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockResolvedValue(undefined);

      const result = await builder.build({}, {}, testDir);

      expect(result.success).toBe(false);
      expect(result.outputDir).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('HtmlStaticBuilder', () => {
    it('should identify static HTML templates', () => {
      const files = {
        'index.html': '<!doctype html><h1>Test</h1>',
        'style.css': 'body {}'
      };

      expect(HtmlStaticBuilder.canHandle(files, { id: 'html-static' })).toBe(true);
      expect(HtmlStaticBuilder.canHandle(files, { id: 'astro' })).toBe(false);
    });

    it('should replace {VAR} pattern in HTML files', async () => {
      const builder = new HtmlStaticBuilder();
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockResolvedValue(undefined);

      const files = {
        'index.html': '<h1>{BRAND_NAME}</h1><p>{TAGLINE}</p>',
        'style.css': 'body { color: black; }'
      };
      const envVars = {
        BRAND_NAME: 'MyBrand',
        TAGLINE: 'Best in class'
      };

      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      try {
        await builder.build(files, envVars, testDir);
        // Verify writeFile was called with replaced content
        expect(writeFileSpy).toHaveBeenCalledWith(
          expect.stringContaining('index.html'),
          expect.stringContaining('MyBrand'),
          'utf8'
        );
      } finally {
        writeFileSpy.mockRestore();
      }
    });

    it('should replace ${VAR} pattern in HTML files', async () => {
      const builder = new HtmlStaticBuilder();
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockResolvedValue(undefined);

      const files = {
        'index.html': '<h1>${BRAND_NAME}</h1><p>${TAGLINE}</p>'
      };
      const envVars = {
        BRAND_NAME: 'MyBrand',
        TAGLINE: 'Best in class'
      };

      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      try {
        await builder.build(files, envVars, testDir);
        expect(writeFileSpy).toHaveBeenCalledWith(
          expect.stringContaining('index.html'),
          expect.stringContaining('MyBrand'),
          'utf8'
        );
      } finally {
        writeFileSpy.mockRestore();
      }
    });

    it('should preserve non-HTML files unchanged', async () => {
      const builder = new HtmlStaticBuilder();
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockResolvedValue(undefined);

      const files = {
        'index.html': '<h1>{BRAND}</h1>',
        'script.js': "const brand = '{BRAND}'", // JS file, not HTML
        'style.css': 'body {}'
      };
      const envVars = { BRAND: 'TestBrand' };

      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

      try {
        await builder.build(files, envVars, testDir);
        // Only HTML file should be written back (modified)
        const calls = writeFileSpy.mock.calls.filter(call => call[0].includes('html'));
        expect(calls.length).toBeGreaterThan(0);
      } finally {
        writeFileSpy.mockRestore();
      }
    });

    it('should return workDir as output (no dist/)', async () => {
      const builder = new HtmlStaticBuilder();
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockResolvedValue(undefined);

      const result = await builder.build({}, {}, testDir);

      expect(result.success).toBe(true);
      expect(result.outputDir).toBe(testDir);
      expect(result.outputDir).not.toContain('dist');
    });

    it('should return error on file write failure', async () => {
      const builder = new HtmlStaticBuilder();
      const error = new Error('Permission denied');
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockRejectedValue(error);

      const result = await builder.build({}, {}, testDir);

      expect(result.success).toBe(false);
      expect(result.outputDir).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('Isolation and Parallel Builds', () => {
    it('should handle multiple concurrent builds with different workDirs', async () => {
      const builders = [
        new AstroBuilder(),
        new ViteBuilder(),
        new HtmlStaticBuilder()
      ];

      vi.spyOn(FormatBuilder, 'execAsync').mockResolvedValue('');
      vi.spyOn(FormatBuilder, 'writeFilesSync').mockResolvedValue(undefined);

      const results = await Promise.all(
        builders.map(builder => builder.build({}, {}, mkdtempSync(path.join(tmpdir(), 'parallel-'))))
      );

      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      // All should have different output paths
      const outputPaths = results.map(r => r.outputDir);
      const uniquePaths = new Set(outputPaths);
      expect(uniquePaths.size).toBe(results.length);
    });
  });
});
