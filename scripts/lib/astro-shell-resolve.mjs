/**
 * Resolve the .astro file that owns the HTML document shell (<html>/<head>) for inject + validation.
 * Bolt / Lovable exports may put the shell in src/layouts/Layout.astro or src/components/Layout.astro,
 * or only referenced from src/pages/index.astro via import.
 */
import fs from 'node:fs';
import path from 'node:path';

export function astroFileLooksLikeDocumentShell(content) {
  return /<\s*html[\s>]/i.test(content) || /<\s*head[\s>]/i.test(content);
}

function rankLayoutBasename(n) {
  if (/^Layout\.astro$/i.test(n)) return 0;
  if (/^BaseLayout\.astro$/i.test(n)) return 1;
  if (/^MainLayout\.astro$/i.test(n)) return 2;
  if (/^RootLayout\.astro$/i.test(n)) return 3;
  if (/^SiteLayout\.astro$/i.test(n)) return 4;
  if (/^PageLayout\.astro$/i.test(n)) return 5;
  return 99;
}

function resolveSpecifierFromPagesDir(pagesDir, spec) {
  const abs = path.resolve(pagesDir, spec);
  if (fs.existsSync(abs) && abs.endsWith('.astro')) return abs;
  return null;
}

function importBindingPriority(name) {
  if (/^(Layout|BaseLayout|MainLayout|RootLayout|SiteLayout|PageLayout)$/i.test(name)) return 0;
  return 1;
}

/**
 * Parse src/pages/index.astro frontmatter + body for `import X from '...astro'`
 * and return the first resolved path whose content looks like a document shell.
 */
export function resolveShellFromIndexImports(templateDir) {
  const indexPath = path.join(templateDir, 'src', 'pages', 'index.astro');
  const pagesDir = path.join(templateDir, 'src', 'pages');
  if (!fs.existsSync(indexPath)) return null;

  const raw = fs.readFileSync(indexPath, 'utf8');
  const importRe = /^\s*import\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?/gm;
  const candidates = [];
  let m;
  while ((m = importRe.exec(raw)) !== null) {
    const binding = m[1];
    const spec = m[2];
    if (!spec.endsWith('.astro')) continue;
    const resolved = resolveSpecifierFromPagesDir(pagesDir, spec);
    if (!resolved || !fs.existsSync(resolved)) continue;
    const content = fs.readFileSync(resolved, 'utf8');
    if (!astroFileLooksLikeDocumentShell(content)) continue;
    candidates.push({
      prio: importBindingPriority(binding),
      path: resolved,
      binding,
    });
  }
  candidates.sort((a, b) => a.prio - b.prio || a.path.localeCompare(b.path));
  return candidates.length ? candidates[0].path : null;
}

function firstDocumentShellInDir(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.astro'));
  files.sort((a, b) => rankLayoutBasename(a) - rankLayoutBasename(b) || a.localeCompare(b));
  for (const f of files) {
    const fp = path.join(dir, f);
    const content = fs.readFileSync(fp, 'utf8');
    if (astroFileLooksLikeDocumentShell(content)) return fp;
  }
  return null;
}

function scoreShellPathForFallback(p) {
  const lower = p.replace(/\\/g, '/').toLowerCase();
  let s = 0;
  if (lower.includes('/layouts/')) s -= 200;
  if (lower.includes('/components/')) s -= 100;
  if (/layout/i.test(path.basename(p))) s -= 50;
  s += p.length / 2000;
  return s;
}

/**
 * Last resort: any .astro under src/ that contains <html> or <head>.
 */
export function findAnyDocumentShellUnderSrc(templateDir) {
  const src = path.join(templateDir, 'src');
  if (!fs.existsSync(src)) return null;
  const hits = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules') continue;
        walk(p);
      } else if (e.name.endsWith('.astro')) {
        const c = fs.readFileSync(p, 'utf8');
        if (astroFileLooksLikeDocumentShell(c)) hits.push(p);
      }
    }
  }
  walk(src);
  if (!hits.length) return null;
  hits.sort((a, b) => scoreShellPathForFallback(a) - scoreShellPathForFallback(b) || a.localeCompare(b));
  return hits[0];
}

/**
 * Absolute path to the .astro file that should receive Voluum / pixel / gtag injection, or null.
 */
export function resolveAstroShellAstroPath(templateDir) {
  const fromIndex = resolveShellFromIndexImports(templateDir);
  if (fromIndex) return fromIndex;

  const layoutsDir = path.join(templateDir, 'src', 'layouts');
  const inLayouts = firstDocumentShellInDir(layoutsDir);
  if (inLayouts) return inLayouts;

  const componentsDir = path.join(templateDir, 'src', 'components');
  const named = ['Layout.astro', 'BaseLayout.astro', 'MainLayout.astro', 'RootLayout.astro'];
  for (const n of named) {
    const fp = path.join(componentsDir, n);
    if (fs.existsSync(fp)) {
      const c = fs.readFileSync(fp, 'utf8');
      if (astroFileLooksLikeDocumentShell(c)) return fp;
    }
  }
  const inComponents = firstDocumentShellInDir(componentsDir);
  if (inComponents) return inComponents;

  return findAnyDocumentShellUnderSrc(templateDir);
}
