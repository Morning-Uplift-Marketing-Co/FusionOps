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

function cloneIfNeeded(source) {
  if (!isGitUrl(source)) return { workSource: path.resolve(source), cleanup: null };
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-to-astro-'));
  run('git', ['clone', '--depth', '1', source, tmpRoot]);
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
      window.__fusionops = window.__fusionops || {};
      window.__fusionops.PX_ENDPOINT = 'https://t.' + window.location.hostname + '/e';
      window.__fusionops.PUBLIC_VOLUUMDOMAIN = '{PUBLIC_VOLUUMDOMAIN}';
      window.__fusionops.PUBLIC_FORMSTARTLABEL = '{PUBLIC_FORMSTARTLABEL}';
      window.__fusionops.PUBLIC_FORMSUBMITLABEL = '{PUBLIC_FORMSUBMITLABEL}';
      if (window.__fusionops.PUBLIC_VOLUUMDOMAIN) {
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://' + window.__fusionops.PUBLIC_VOLUUMDOMAIN + '/dtpCallback.js';
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

  const index = `---
const ctaHref = '/apply';
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=/index.html" />
    <title>${templateName}</title>
    <link rel="canonical" href="/index.html" />
  </head>
  <body>
    <a href={ctaHref}>Apply Now</a>
    <p>Redirecting to landing page...</p>
    <script>location.replace('/index.html')</script>
  </body>
</html>
`;

  const apply = `---
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=/apply.html" />
    <title>Apply</title>
    <link rel="canonical" href="/apply.html" />
  </head>
  <body>
    <p>Redirecting to apply page...</p>
    <script>location.replace('/apply.html')</script>
  </body>
</html>
`;

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
    name: 'fusionops-astro-converted-template',
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

function ensureHeaders(outDir) {
  const headersPath = path.join(outDir, 'public', '_headers');
  if (fs.existsSync(headersPath)) return;
  writeFile(headersPath, `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`);
}

function mirrorApplyForValidator(outDir) {
  const publicApply = path.join(outDir, 'public', 'apply.html');
  const rootApply = path.join(outDir, 'apply.html');
  if (fs.existsSync(publicApply)) {
    fs.copyFileSync(publicApply, rootApply);
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
    ensureHeaders(outDir);
    createAstroFiles(outDir, args.name || args.templateId);
    mirrorApplyForValidator(outDir);

    console.log(`Converted template ready at: ${outDir}`);
  } finally {
    if (cleanup) cleanup();
  }
}

main();
