/**
 * Format Detection Tests
 * ======================
 * Test that TemplateBuilder correctly routes to format-specific adapters.
 */

import { describe, it, expect, vi } from 'vitest';
import { TemplateBuilder } from '../TemplateBuilder.js';
import { AstroBuilder } from '../AstroBuilder.js';
import { ViteBuilder } from '../ViteBuilder.js';
import { HtmlStaticBuilder } from '../HtmlStaticBuilder.js';

describe('Format Detection Routing', () => {
  it('should detect Astro templates', () => {
    const files = {
      'astro.config.mjs': 'export default {}',
      'package.json': '{"dependencies": {"astro": "^5.0.0"}}',
      'src/pages/index.astro': '<h1>Astro</h1>'
    };

    expect(AstroBuilder.canHandle(files, { id: 'astro', label: 'Astro' })).toBe(true);
  });

  it('should detect Vite/React templates', () => {
    const files = {
      'vite.config.js': 'export default {}',
      'package.json': '{"dependencies": {"react": "^19.0.0", "vite": "^5.0.0"}}',
      'src/main.jsx': 'ReactDOM.render(...)'
    };

    expect(ViteBuilder.canHandle(files, { id: 'vite-react', label: 'Vite + React' })).toBe(true);
  });

  it('should detect HTML static templates', () => {
    const files = {
      'index.html': '<!doctype html><h1>Hello</h1>',
      'style.css': 'body { margin: 0; }'
    };

    expect(HtmlStaticBuilder.canHandle(files, { id: 'html-static', label: 'Static HTML' })).toBe(true);
  });

  it('should return error for unknown format', async () => {
    const files = {
      'unknown.file': 'content'
    };

    const result = await TemplateBuilder.buildTemplate(files, {}, 'test-001');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown');
  });

  it('should route Astro to AstroBuilder', async () => {
    const files = {
      'astro.config.mjs': 'export default {}',
      'package.json': '{"name": "test"}',
      'src/pages/index.astro': '<h1>Test</h1>'
    };

    const spy = vi.spyOn(AstroBuilder.prototype, 'build').mockResolvedValue({
      outputDir: '/tmp/test',
      success: true
    });

    try {
      // This will fail at staging but builder should be called
      await TemplateBuilder.buildTemplate(files, {}, 'astro-test').catch(() => {});
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('should route Vite to ViteBuilder', async () => {
    const files = {
      'vite.config.js': 'export default {}',
      'package.json': '{"name": "test"}',
      'src/main.jsx': 'ReactDOM.render(...)'
    };

    const spy = vi.spyOn(ViteBuilder.prototype, 'build').mockResolvedValue({
      outputDir: '/tmp/test',
      success: true
    });

    try {
      await TemplateBuilder.buildTemplate(files, {}, 'vite-test').catch(() => {});
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('should route HTML to HtmlStaticBuilder', async () => {
    const files = {
      'index.html': '<!doctype html><h1>Test</h1>',
      'style.css': 'body {}'
    };

    const spy = vi.spyOn(HtmlStaticBuilder.prototype, 'build').mockResolvedValue({
      outputDir: '/tmp/test',
      success: true
    });

    try {
      await TemplateBuilder.buildTemplate(files, {}, 'html-test').catch(() => {});
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('should validate builder interface', () => {
    const builders = [AstroBuilder, ViteBuilder, HtmlStaticBuilder];

    for (const Builder of builders) {
      // All builders must have canHandle static method
      expect(typeof Builder.canHandle).toBe('function');

      // All builder instances must have build async method
      const instance = new Builder();
      expect(typeof instance.build).toBe('function');
    }
  });

  it('should reject when no builder found for framework', async () => {
    const mockFramework = { id: 'unknown-framework', label: 'Unknown' };

    // Create a template that will be detected as unknown
    const files = { 'mystery.file': 'content' };

    // Mock identifyFramework to return unknown
    const result = await TemplateBuilder.buildTemplate(files, {}, 'unknown-test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown template format');
  });
});
