import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  astroFileLooksLikeDocumentShell,
  findAnyDocumentShellUnderSrc,
  resolveAstroShellAstroPath,
  resolveShellFromIndexImports,
} from '../../../scripts/lib/astro-shell-resolve.mjs';

function write(p: string, content: string) {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content, 'utf8');
}

describe('astro-shell-resolve', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('detects document shell in content', () => {
    expect(astroFileLooksLikeDocumentShell('<slot />')).toBe(false);
    expect(astroFileLooksLikeDocumentShell('<html lang="en"><head></head></html>')).toBe(true);
    expect(astroFileLooksLikeDocumentShell('<head><title>x</title></head>')).toBe(true);
  });

  it('prefers layout imported from index.astro', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'astro-shell-'));
    write(
      path.join(dir, 'src/layouts/Layout.astro'),
      `---
---
<!doctype html><html><head></head><body><slot /></body></html>`,
    );
    write(
      path.join(dir, 'src/pages/index.astro'),
      `---
import Layout from '../layouts/Layout.astro';
---
<Layout><p>x</p></Layout>`,
    );
    expect(resolveShellFromIndexImports(dir)).toBe(path.join(dir, 'src/layouts/Layout.astro'));
    expect(resolveAstroShellAstroPath(dir)).toBe(path.join(dir, 'src/layouts/Layout.astro'));
  });

  it('resolves shell under src/components when imported', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'astro-shell-'));
    write(
      path.join(dir, 'src/components/Layout.astro'),
      `---
---
<html><head></head><body><slot /></body></html>`,
    );
    write(
      path.join(dir, 'src/pages/index.astro'),
      `---
import Layout from '../components/Layout.astro';
---
<Layout />`,
    );
    expect(resolveAstroShellAstroPath(dir)).toBe(path.join(dir, 'src/components/Layout.astro'));
  });

  it('falls back to src/layouts when index has no shell import', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'astro-shell-'));
    write(
      path.join(dir, 'src/layouts/Layout.astro'),
      `---
---
<html><head></head><body><slot /></body></html>`,
    );
    write(path.join(dir, 'src/pages/index.astro'), '---\n---\n<p>x</p>');
    expect(resolveAstroShellAstroPath(dir)).toBe(path.join(dir, 'src/layouts/Layout.astro'));
  });

  it('findAnyDocumentShellUnderSrc picks a reasonable file', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'astro-shell-'));
    write(path.join(dir, 'src/components/Hero.astro'), '---\n---\n<div/>');
    write(
      path.join(dir, 'src/layouts/Layout.astro'),
      `---
---
<html><head></head><body><slot /></body></html>`,
    );
    expect(findAnyDocumentShellUnderSrc(dir)).toBe(path.join(dir, 'src/layouts/Layout.astro'));
  });
});
