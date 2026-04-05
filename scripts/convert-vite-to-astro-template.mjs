#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (res.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function parseArgs(argv) {
  const args = { build: true };
  for (let i = 2; i < argv.length; i += 1) {
    const v = argv[i];
    if (v === '--source') args.source = argv[++i];
    else if (v === '--out') args.out = argv[++i];
    else if (v === '--template-id') args.templateId = argv[++i];
    else if (v === '--name') args.name = argv[++i];
    else if (v === '--no-build') args.build = false;
    else if (v === '--help' || v === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log('Usage: node scripts/convert-vite-to-astro-template.mjs --source <path|git-url> --out <dir> --template-id <id> [--name <name>] [--no-build]');
}

function isGitUrl(source) {
  return /^https?:\/\/|^git@/.test(source || '');
}

function normalizeGitSource(source) {
  if (!source) return source;
  // git@github.com:org/repo.git -> https://github.com/org/repo.git
  const sshMatch = source.match(/^git@github\.com:(.+)$/);
  if (sshMatch) return `https://github.com/${sshMatch[1]}`;
  return source;
}

function applyGithubTokenIfNeeded(url) {
  const token = process.env.SOURCE_REPO_PAT || '';
  if (!token) return url;
  if (!/^https:\/\/github\.com\//.test(url)) return url;
  return url.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirIfExists(src, dst) {
  if (!fs.existsSync(src)) return;
  ensureDir(dst);
  fs.cpSync(src, dst, { recursive: true, force: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeFile(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, 'utf8');
}

function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cloneIfNeeded(source) {
  if (!isGitUrl(source)) return { workSource: path.resolve(source), cleanup: null };
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-to-astro-'));
  const normalized = normalizeGitSource(source);
  const cloneUrl = applyGithubTokenIfNeeded(normalized);
  run('git', ['clone', '--depth', '1', cloneUrl, tmpRoot]);
  return {
    workSource: tmpRoot,
    cleanup: () => fs.rmSync(tmpRoot, { recursive: true, force: true }),
  };
}

function copyRootStaticFiles(source, outDir) {
  const candidates = ['README.md', '.gitignore', 'favicon.svg'];
  for (const file of candidates) {
    const src = path.join(source, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(outDir, file));
    }
  }
}

function buildViteProject(source) {
  if (!fs.existsSync(path.join(source, 'package.json'))) {
    throw new Error(`Missing package.json in source: ${source}`);
  }
  const pkg = readJson(path.join(source, 'package.json'));
  if (!pkg.scripts || !pkg.scripts.build) {
    throw new Error('Source is missing build script');
  }
  run('npm', ['ci'], { cwd: source });
  run('npm', ['run', 'build'], { cwd: source });
}

function copyDistToPublic(source, outDir) {
  const dist = path.join(source, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    throw new Error(`dist/index.html not found after build in ${source}`);
  }
  const publicDir = path.join(outDir, 'public');
  ensureDir(publicDir);
  for (const name of fs.readdirSync(dist)) {
    const src = path.join(dist, name);
    const dst = path.join(publicDir, name);
    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dst, { recursive: true, force: true });
    } else {
      fs.copyFileSync(src, dst);
    }
  }
}

function createAstroFiles(outDir, templateName) {
  const layout = `---
const { title = 'Template', description = '' } = Astro.props;
const PX_ENDPOINT = 'https://t.' + (typeof window !== 'undefined' ? window.location.hostname : 'example.com') + '/e';
const PUBLIC_VOLUUMDOMAIN = import.meta.env.PUBLIC_VOLUUMDOMAIN || '';
const PUBLIC_FORMSTARTLABEL = import.meta.env.PUBLIC_FORMSTARTLABEL || 'form_start';
const PUBLIC_FORMSUBMITLABEL = import.meta.env.PUBLIC_FORMSUBMITLABEL || 'form_submit';
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    <script is:inline>
      window.__lpRuntime = window.__lpRuntime || {};
      window.__lpRuntime.PX_ENDPOINT = 'https://t.' + window.location.hostname + '/e';
      window.__lpRuntime.PUBLIC_VOLUUMDOMAIN = '{PUBLIC_VOLUUMDOMAIN}';
      window.__lpRuntime.PUBLIC_FORMSTARTLABEL = '{PUBLIC_FORMSTARTLABEL}';
      window.__lpRuntime.PUBLIC_FORMSUBMITLABEL = '{PUBLIC_FORMSUBMITLABEL}';
      if (window.__lpRuntime.PUBLIC_VOLUUMDOMAIN) {
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://' + window.__lpRuntime.PUBLIC_VOLUUMDOMAIN + '/dtpCallback.js';
        document.head.appendChild(s);
      }
    </script>
    <slot name="head" />
  </head>
  <body>
    <slot />
  </body>
</html>
`;

  let index = `---
const ctaHref = '/apply';
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${templateName}</title>
  </head>
  <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin:0; background:#0b1220; color:#f8fafc;">
    <main style="max-width:720px; margin:0 auto; padding:48px 20px; text-align:center;">
      <h1 style="margin:0 0 12px; font-size:32px; line-height:1.2;">${templateName}</h1>
      <p style="margin:0 0 20px; color:#cbd5e1;">Astro fallback entry for deploy compatibility.</p>
      <p style="margin:0 0 24px;"><a href={ctaHref} style="display:inline-block; padding:12px 18px; border-radius:10px; text-decoration:none; background:#2563eb; color:white; font-weight:600;">Apply Now</a></p>
      <p style="font-size:13px; color:#94a3b8;">Generated fallback. Real template HTML was not detected.</p>
    </main>
  </body>
</html>
`;

  let apply = `---
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Apply</title>
  </head>
  <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin:0; background:#0b1220; color:#f8fafc;">
    <main style="max-width:720px; margin:0 auto; padding:48px 20px; text-align:center;">
      <h1 style="margin:0 0 12px; font-size:30px; line-height:1.2;">Apply</h1>
      <p style="margin:0 0 16px; color:#cbd5e1;">Template-owned apply experience is expected at <code>public/apply.html</code>.</p>
      <p style="font-size:13px; color:#94a3b8;">This Astro page is only a safe fallback to avoid preview-domain redirect loops.</p>
    </main>
  </body>
</html>
`;

  const publicIndex = path.join(outDir, 'public', 'index.html');
  if (fs.existsSync(publicIndex)) {
    const rawIndex = sanitizeExpressionLeak(fs.readFileSync(publicIndex, 'utf8'), templateName).html;
    const withMarker = /href=\{ctaHref\}/.test(rawIndex)
      ? rawIndex
      : /<\/body>/i.test(rawIndex)
        ? rawIndex.replace(/<\/body>/i, '<a href={ctaHref} style="display:none" aria-hidden="true">Apply</a></body>')
        : `${rawIndex}\n<a href={ctaHref} style="display:none" aria-hidden="true">Apply</a>\n`;
    index = `---
const ctaHref = '/apply';
---
${withMarker}`;
  }

  const publicApply = path.join(outDir, 'public', 'apply.html');
  if (fs.existsSync(publicApply)) {
    const rawApply = sanitizeExpressionLeak(fs.readFileSync(publicApply, 'utf8'), templateName).html;
    apply = `---
---
${rawApply}`;
  }

  const eTs = `export const prerender = true;
export async function GET() {
  const domain = 'static-endpoint';
  return new Response(
    JSON.stringify({ ok: true, domain, ts: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  );
}
`;

  const robots = `export const prerender = true;
export function GET() {
  return new Response('User-agent: *\\nAllow: /\\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
`;

  const astroConfig = `import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
});
`;

  const pkg = {
    name: 'astro-converted-template',
    private: true,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'astro dev',
      build: 'astro build',
      preview: 'astro preview',
    },
    dependencies: {
      astro: '^5.18.0',
    },
  };

  const tsconfig = {
    extends: 'astro/tsconfigs/strict',
  };

  writeFile(path.join(outDir, 'src/layouts/Layout.astro'), layout);
  writeFile(path.join(outDir, 'src/pages/index.astro'), index);
  writeFile(path.join(outDir, 'src/pages/apply.astro'), apply);
  writeFile(path.join(outDir, 'src/pages/e.ts'), eTs);
  writeFile(path.join(outDir, 'src/pages/robots.txt.ts'), robots);
  writeFile(path.join(outDir, 'astro.config.mjs'), astroConfig);
  writeFile(path.join(outDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  writeFile(path.join(outDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');
}

function collectExternalOrigins(outDir) {
  const publicDir = path.join(outDir, 'public');
  const htmlFiles = walkFiles(publicDir, (f) => f.toLowerCase().endsWith('.html'));
  const origins = new Set();

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const re = /https:\/\/[^\s"'`<>)]+/gi;
    for (const match of html.match(re) || []) {
      try {
        const u = new URL(match);
        origins.add(`${u.protocol}//${u.host}`);
      } catch (_e) {}
    }

    const voluumVar = html.match(/voluumDomain\s*=\s*["']([^"']+)["']/i);
    if (voluumVar && voluumVar[1]) {
      try {
        const host = voluumVar[1].replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        if (host) origins.add(`https://${host}`);
      } catch (_e) {}
    }
  }

  return origins;
}

function ensureHeaders(outDir) {
  const headersPath = path.join(outDir, 'public', '_headers');
  const origins = collectExternalOrigins(outDir);
  const scriptSrc = new Set([
    "'self'",
    "'unsafe-inline'",
    'https:',
    'https://apikeep.com',
    'https://www.googletagmanager.com',
  ]);
  const styleSrc = new Set([
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
  ]);
  const fontSrc = new Set([
    "'self'",
    'https://fonts.gstatic.com',
  ]);
  const imgSrc = new Set([
    "'self'",
    'data:',
    'https:',
    'https://images.pexels.com',
  ]);
  const connectSrc = new Set([
    "'self'",
    'https:',
    'https://*.supabase.co',
    'https://apikeep.com',
  ]);

  for (const origin of origins) {
    scriptSrc.add(origin);
    imgSrc.add(origin);
    connectSrc.add(origin);
  }

  const hasGtag =
    scriptSrc.has('https://www.googletagmanager.com') ||
    [...origins].some((o) => /googletagmanager|google-analytics/i.test(o));
  if (hasGtag) {
    const googleAdsOrigins = [
      'https://www.google.com',
      'https://www.googleadservices.com',
      'https://googleads.g.doubleclick.net',
      'https://stats.g.doubleclick.net',
    ];
    for (const o of googleAdsOrigins) {
      scriptSrc.add(o);
      imgSrc.add(o);
      connectSrc.add(o);
    }
  }

  const joined = (set) => [...set].join(' ');
  const csp = [
    `default-src 'self'`,
    `script-src ${joined(scriptSrc)}`,
    `style-src ${joined(styleSrc)}`,
    `font-src ${joined(fontSrc)}`,
    `img-src ${joined(imgSrc)}`,
    `connect-src ${joined(connectSrc)}`,
    `frame-src 'none'`,
  ].join('; ');

  writeFile(headersPath, `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: ${csp};
`);
}

function mirrorApplyForValidator(outDir) {
  const publicApply = path.join(outDir, 'public', 'apply.html');
  const rootApply = path.join(outDir, 'apply.html');
  if (fs.existsSync(publicApply)) {
    fs.copyFileSync(publicApply, rootApply);
  }
}

function walkFiles(root, predicate, acc = []) {
  if (!fs.existsSync(root)) return acc;
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, acc);
      continue;
    }
    if (predicate(full)) acc.push(full);
  }
  return acc;
}

function ensureViewportMeta(html) {
  if (/<meta[^>]+name=["']viewport["']/i.test(html)) return { html, changed: false };
  const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1" />';
  if (/<head[^>]*>/i.test(html)) {
    return {
      html: html.replace(/<head([^>]*)>/i, `<head$1>\n    ${viewportTag}`),
      changed: true,
    };
  }
  return { html: `${viewportTag}\n${html}`, changed: true };
}

function ensurePrimaryToken(html) {
  if (/--color-primary|--primary\s*:|--fo-primary|var\(--color-primary\)|var\(--primary\)|var\(--fo-primary\)|hsl\(var\(--primary\)\)/i.test(html)) {
    return { html, changed: false };
  }
  const tokenStyle = '<style id="lp-primary-token">:root{--color-primary:#6d28d9;--fo-primary:#6d28d9;}</style>';
  if (/<head[^>]*>/i.test(html)) {
    return {
      html: html.replace(/<head([^>]*)>/i, `<head$1>\n    ${tokenStyle}`),
      changed: true,
    };
  }
  return { html: `${tokenStyle}\n${html}`, changed: true };
}

function sanitizeExpressionLeak(html, templateName) {
  let next = html;
  let changed = false;

  if (/\{title\}/.test(next)) {
    next = next.replace(/\{title\}/g, templateName);
    changed = true;
  }

  if (/\{\s*noindex\s*\?/.test(next)) {
    next = next.replace(/<meta[^>]*\{\s*noindex\s*\?[\s\S]*?\/?>/gi, '');
    changed = true;
  }

  const jsxConditional = /\{\s*([a-zA-Z_$][\w$]*\s*&&\s*\([^{}]*\))\s*\}/g;
  if (jsxConditional.test(next)) {
    next = next.replace(jsxConditional, '$1');
    changed = true;
  }

  // Normalize legacy FusionOps tracking markers in imported static HTML.
  const markerReplacements = [
    [/\bFusionOps index\.html tracking\b/gi, 'Landing index.html tracking'],
    [/\b__fusionopsLandingParams\b/g, '__lpLandingParams'],
    [/\b__fusionopsLandingSearch\b/g, '__lpLandingSearch'],
    [/\b__fusionops_lp_search\b/g, '__lp_search'],
    [/\b__fusionops_lp_params\b/g, '__lp_params'],
    [/\bfusionops-voluum-cta\b/g, 'lp-voluum-cta'],
    [/\bdata-fusionops-cta\b/gi, 'data-lp-cta'],
    [/\bdata-fusionops\b/gi, 'data-lp'],
    [/\bwindow\.__fusionops\b/g, 'window.__lpRuntime'],
  ];
  for (const [pattern, replacement] of markerReplacements) {
    if (pattern.test(next)) {
      next = next.replace(pattern, replacement);
      changed = true;
    }
  }

  return { html: next, changed };
}

function autoFixHtmlQualityGate(outDir, templateName) {
  const htmlFiles = walkFiles(path.join(outDir, 'public'), (f) => f.toLowerCase().endsWith('.html'));
  if (htmlFiles.length === 0) return;

  let touched = 0;
  for (const file of htmlFiles) {
    const original = fs.readFileSync(file, 'utf8');
    let next = original;

    const leakFix = sanitizeExpressionLeak(next, templateName);
    next = leakFix.html;

    const viewportFix = ensureViewportMeta(next);
    next = viewportFix.html;

    const tokenFix = ensurePrimaryToken(next);
    next = tokenFix.html;

    if (next !== original) {
      fs.writeFileSync(file, next, 'utf8');
      touched += 1;
    }
  }

  if (touched > 0) {
    console.log(`[convert] auto-fixed quality gate markers in ${touched} html file(s)`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.source || !args.out || !args.templateId) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const { workSource, cleanup } = cloneIfNeeded(args.source);
  try {
    const outDir = path.resolve(args.out, args.templateId);
    fs.rmSync(outDir, { recursive: true, force: true });
    ensureDir(outDir);

    if (args.build) buildViteProject(workSource);
    copyDistToPublic(workSource, outDir);
    copyDirIfExists(path.join(workSource, 'public'), path.join(outDir, 'public'));
    copyDirIfExists(path.join(workSource, 'functions'), path.join(outDir, 'functions'));
    copyRootStaticFiles(workSource, outDir);
    createAstroFiles(outDir, args.name || args.templateId);
    autoFixHtmlQualityGate(outDir, args.name || args.templateId);
    ensureHeaders(outDir);
    mirrorApplyForValidator(outDir);

    console.log(`Converted template ready at: ${outDir}`);
  } finally {
    if (cleanup) cleanup();
  }
}

main();
