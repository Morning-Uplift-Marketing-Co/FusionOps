import { describe, expect, it } from 'vitest';
import {
  getAstroValidationIssues,
  getViteValidationIssues,
  resolveDeployStack,
} from '../../../scripts/lib/db-template-validate.mjs';

const minimalPkg = (overrides: Record<string, unknown>) =>
  JSON.stringify({
    scripts: { build: 'vite build' },
    devDependencies: { vite: '^5.0.0' },
    ...overrides,
  });

describe('db-template-validate', () => {
  it('accepts minimal Astro template', () => {
    const template = {
      files: {
        'package.json': JSON.stringify({
          scripts: { build: 'astro build' },
          dependencies: { astro: '^4.0.0' },
        }),
        'src/pages/index.astro': '---\n---\n<p>x</p>',
        'src/layouts/Layout.astro': '---\n---\n<slot />',
      },
    };
    expect(getAstroValidationIssues(template)).toEqual([]);
    expect(getViteValidationIssues(template).length).toBeGreaterThan(0);
    expect(resolveDeployStack(template).stack).toBe('astro');
  });

  it('accepts minimal Vite / Loveable-shaped template', () => {
    const template = {
      files: {
        'package.json': minimalPkg({}),
        'index.html': '<div id="root"></div>',
        'vite.config.ts': "export default { root: '.' }",
        'src/main.tsx': "import App from './App';",
      },
    };
    expect(getViteValidationIssues(template)).toEqual([]);
    expect(getAstroValidationIssues(template).length).toBeGreaterThan(0);
    expect(resolveDeployStack(template).stack).toBe('vite');
  });

  it('Vite: npx vite build in script', () => {
    const template = {
      files: {
        'package.json': JSON.stringify({
          scripts: { build: 'npx vite build' },
          devDependencies: { vite: '^5' },
        }),
        'index.html': '<html></html>',
        'vite.config.js': 'export default {}',
        'src/main.jsx': 'x',
      },
    };
    expect(getViteValidationIssues(template)).toEqual([]);
  });

  it('Vite: fails without main entry', () => {
    const template = {
      files: {
        'package.json': minimalPkg({}),
        'index.html': '<html></html>',
        'vite.config.ts': 'export default {}',
      },
    };
    const issues = getViteValidationIssues(template);
    expect(issues.some((i) => i.includes('main'))).toBe(true);
  });

  it('Vite: fails without vite build in script', () => {
    const template = {
      files: {
        'package.json': JSON.stringify({
          scripts: { build: 'echo hi' },
          devDependencies: { vite: '^5' },
        }),
        'index.html': '<html></html>',
        'vite.config.ts': 'export default {}',
        'src/main.tsx': 'x',
      },
    };
    expect(getViteValidationIssues(template).some((i) => i.includes('vite build'))).toBe(true);
  });

  it('Astro: passes with astro.config.mjs and astro build in script (no deps.astro)', () => {
    const template = {
      files: {
        'package.json': JSON.stringify({
          scripts: { build: 'astro build' },
        }),
        'astro.config.mjs': "export default {}",
        'src/pages/index.astro': '---\n---\n<p>x</p>',
        'src/layouts/Layout.astro': '---\n---\n<slot />',
      },
    };
    expect(getAstroValidationIssues(template)).toEqual([]);
    expect(resolveDeployStack(template).stack).toBe('astro');
  });

  it('Vite: devDependencies.vite + vite.config.ts + main entry', () => {
    const template = {
      files: {
        'package.json': JSON.stringify({
          scripts: { build: 'vite build' },
          devDependencies: { vite: '^5' },
        }),
        'index.html': '<html></html>',
        'vite.config.ts': 'export default {}',
        'src/main.tsx': 'x',
      },
    };
    expect(getViteValidationIssues(template)).toEqual([]);
  });

  it('resolveDeployStack returns null when neither stack is valid', () => {
    const template = {
      files: {
        'package.json': '{"scripts":{"build":"echo x"}}',
        'readme.md': 'x',
      },
    };
    const r = resolveDeployStack(template);
    expect(r.stack).toBeNull();
    expect(r.astroIssues.length).toBeGreaterThan(0);
    expect(r.viteIssues.length).toBeGreaterThan(0);
    expect(Object.keys(r.files).length).toBe(2);
  });

  it('normalizes backslash paths for Astro validation', () => {
    const template = {
      files: {
        'package.json': JSON.stringify({
          scripts: { build: 'astro build' },
          dependencies: { astro: '^4.0.0' },
        }),
        'src\\pages\\index.astro': '---\n---\n<p>x</p>',
        'src\\layouts\\Layout.astro': '---\n---\n<slot />',
      },
    };
    const r = resolveDeployStack(template);
    expect(r.stack).toBe('astro');
    expect(r.files['src/pages/index.astro']).toBeDefined();
  });
});
