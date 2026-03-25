/**
 * When a template dir has no tsconfig.json, Vite/esbuild walks up to the monorepo root.
 * Root tsconfig extends astro/tsconfigs/strict but CI only npm-installs inside the template
 * — resolution fails. Writing a local tsconfig stops the walk.
 */
import { existsSync, writeFileSync } from 'fs';
import path from 'path';

/** @param {string} tempDir @param {'astro' | 'vite'} stack */
export function ensureTemplateTsconfig(tempDir, stack) {
  const tsconfigPath = path.join(tempDir, 'tsconfig.json');
  if (existsSync(tsconfigPath)) return false;

  if (stack === 'astro') {
    const cfg = {
      extends: 'astro/tsconfigs/strict',
      compilerOptions: {
        jsx: 'react-jsx',
        jsxImportSource: 'react',
        baseUrl: '.',
        paths: { '@/*': ['./src/*'] },
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    };
    writeFileSync(tsconfigPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
    return true;
  }

  if (stack === 'vite') {
    const cfg = {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        baseUrl: '.',
        paths: { '@/*': ['./src/*'] },
      },
      include: ['src'],
    };
    writeFileSync(tsconfigPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
    return true;
  }

  return false;
}

/** Infer stack from template root for CI (no DB metadata). */
export function detectTemplateStack(dir) {
  const hasAstro =
    existsSync(path.join(dir, 'astro.config.mjs')) ||
    existsSync(path.join(dir, 'astro.config.ts')) ||
    existsSync(path.join(dir, 'astro.config.js'));
  if (hasAstro) return 'astro';
  const hasVite =
    existsSync(path.join(dir, 'vite.config.ts')) ||
    existsSync(path.join(dir, 'vite.config.js')) ||
    existsSync(path.join(dir, 'vite.config.mjs')) ||
    existsSync(path.join(dir, 'vite.config.mts'));
  if (hasVite) return 'vite';
  return null;
}
