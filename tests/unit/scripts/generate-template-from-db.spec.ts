import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchTemplateFromDB,
  fixAstroFrontmatter,
  getAstroValidationIssues,
  parseTemplateFiles,
} from '../../../scripts/generate-template-from-db.mjs';

describe('generate-template-from-db', () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses serialized template files safely', () => {
    expect(parseTemplateFiles('{"src/pages/index.astro":"ok"}')).toEqual({
      'src/pages/index.astro': 'ok',
    });
    expect(parseTemplateFiles({ 'package.json': '{}' })).toEqual({ 'package.json': '{}' });
    expect(parseTemplateFiles('{invalid json')).toEqual({});
  });

  it('flags missing Astro deploy requirements', () => {
    const issues = getAstroValidationIssues({
      files: {
        'package.json': JSON.stringify({ scripts: { build: 'vite build' } }),
      },
    });

    expect(issues).toContain('Missing required Astro deploy file: src/pages/index.astro');
    expect(issues).toContain(
      'Template is not Astro-based (missing astro build signal in package.json/config).',
    );
  });

  it('accepts valid Astro template payloads', () => {
    const issues = getAstroValidationIssues({
      files: {
        'package.json': JSON.stringify({
          scripts: { build: 'astro build' },
          dependencies: { astro: '^5.0.0' },
        }),
        'src/pages/index.astro': '---\n---\n<div />',
        'src/layouts/Layout.astro': '---\n---\n<slot />',
        'src/pages/e.ts': 'export const GET = () => new Response("ok");',
        'src/pages/robots.txt.ts': 'export const GET = () => new Response("ok");',
        'public/_headers': '/*\n  X-Frame-Options: DENY',
      },
    });

    expect(issues).toEqual([]);
  });

  it('reorders Astro frontmatter imports before declarations', () => {
    const input = `---
const foo = "bar";
import Layout from "../layouts/Layout.astro";
---
<Layout />`;

    const output = fixAstroFrontmatter(input);

    expect(output).toContain('import Layout from "../layouts/Layout.astro";\n\nconst foo = "bar";');
  });

  it('returns the active template when it exists', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: '1',
          template_id: 'tpl-active',
          name: 'Active Template',
          status: 'active',
          files: '{"package.json":"{}"}',
        },
      ],
    });

    const template = await fetchTemplateFromDB('tpl-active');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(template).toMatchObject({
      templateId: 'tpl-active',
      status: 'active',
      files: { 'package.json': '{}' },
    });
  });

  it('rejects templates that exist but are not active', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            template_id: 'tpl-draft',
            status: 'draft',
            files: '{}',
          },
        ],
      });

    const template = await fetchTemplateFromDB('tpl-draft');

    expect(template).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      '[db-template] Template tpl-draft exists in D1 but is not deployable. status=draft',
    );
    expect(logSpy).toHaveBeenCalled();
  });
});
