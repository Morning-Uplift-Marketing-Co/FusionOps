#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { normalizeTemplateFiles, resolveTemplateEntry, validateAstroStandard } from '../src/utils/template-standard.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/prepare-bolt-astro-import.mjs <source-dir> [template-id] [options]');
  console.log('');
  console.log('Options:');
  console.log('  --name "Display Name"');
  console.log('  --desc "Description"');
  console.log('  --category general|custom|loan');
  console.log('  --badge "Label"');
  console.log('  --out-dir <folder>');
  console.log('  --zip-only');
  console.log('  --json-only');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/prepare-bolt-astro-import.mjs C:/tmp/bolt-site bolt-site --name "Bolt Site"');
  process.exit(1);
}

const sourceDir = path.resolve(args[0]);
const templateId = (args[1] || path.basename(sourceDir))
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '') || `tpl-${Date.now().toString(36)}`;

let displayName = '';
let description = '';
let category = 'custom';
let badge = 'Imported';
let outDir = path.join(process.cwd(), 'tmp', 'prepared-template-imports');
let zipOnly = false;
let jsonOnly = false;

for (let i = 2; i < args.length; i++) {
  if (args[i] === '--name' && args[i + 1]) displayName = args[++i];
  else if (args[i] === '--desc' && args[i + 1]) description = args[++i];
  else if (args[i] === '--category' && args[i + 1]) category = args[++i];
  else if (args[i] === '--badge' && args[i + 1]) badge = args[++i];
  else if (args[i] === '--out-dir' && args[i + 1]) outDir = path.resolve(args[++i]);
  else if (args[i] === '--zip-only') zipOnly = true;
  else if (args[i] === '--json-only') jsonOnly = true;
}

if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
  console.error(`❌ Source directory not found: ${sourceDir}`);
  process.exit(1);
}

if (zipOnly && jsonOnly) {
  console.error('❌ Use either --zip-only or --json-only, not both.');
  process.exit(1);
}

const ALLOWED_EXTS = new Set(['.astro', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.css', '.html', '.md', '.env', '.toml', '.svg', '.txt']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.astro', '.wrangler']);
const SKIP_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
const THEME_CLASS_REPLACEMENTS = [
  [/bg-teal-\d{2,3}/g, 'bg-primary'],
  [/hover:bg-teal-\d{2,3}/g, 'hover:bg-primary/90'],
  [/text-teal-\d{2,3}(?:\/\d+)?/g, 'text-primary-soft'],
  [/border-teal-\d{2,3}(?:\/\d+)?/g, 'border-primary-soft'],
  [/ring-teal-\d{2,3}(?:\/\d+)?/g, 'ring-primary-soft'],
  [/focus:ring-teal-\d{2,3}(?:\/\d+)?/g, 'focus:ring-primary-soft'],
  [/focus:border-teal-\d{2,3}(?:\/\d+)?/g, 'focus:border-primary-soft'],
  [/accent-teal-\d{2,3}/g, 'accent-primary'],
  [/bg-amber-\d{2,3}/g, 'bg-accent'],
  [/hover:bg-amber-\d{2,3}/g, 'hover:bg-accent/90'],
  [/text-amber-\d{2,3}(?:\/\d+)?/g, 'text-accent'],
  [/border-amber-\d{2,3}(?:\/\d+)?/g, 'border-accent'],
  [/bg-red-\d{2,3}/g, 'bg-danger-soft'],
  [/text-red-\d{2,3}(?:\/\d+)?/g, 'text-danger'],
  [/border-red-\d{2,3}(?:\/\d+)?/g, 'border-danger-soft'],
  [/ring-red-\d{2,3}(?:\/\d+)?/g, 'ring-danger-soft'],
  [/focus:ring-red-\d{2,3}(?:\/\d+)?/g, 'focus:ring-danger-soft'],
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isAllowedFile(relPath) {
  const base = path.basename(relPath);
  if (SKIP_FILES.has(base)) return false;
  const ext = path.extname(base).toLowerCase();
  return ALLOWED_EXTS.has(ext) || base === '.env';
}

function walk(dir, collector, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/').replace(/^\/+/, '');
    if (!relPath) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(fullPath, collector, baseDir);
      continue;
    }
    if (!isAllowedFile(relPath)) continue;
    collector[relPath] = fs.readFileSync(fullPath, 'utf8');
  }
}

function stripSingleRootWrappers(inputFiles) {
  let current = normalizeTemplateFiles(inputFiles);
  while (true) {
    const paths = Object.keys(current);
    if (paths.length === 0) return current;
    const topLevel = [...new Set(paths.map((p) => p.split('/')[0]).filter(Boolean))];
    if (topLevel.length !== 1) return current;
    const root = topLevel[0];
    const hasNested = paths.some((p) => p.startsWith(root + '/'));
    if (!hasNested) return current;
    const next = {};
    for (const [filePath, content] of Object.entries(current)) {
      const trimmed = filePath.startsWith(root + '/') ? filePath.slice(root.length + 1) : filePath;
      if (trimmed) next[trimmed] = content;
    }
    const nextKeys = Object.keys(next);
    if (nextKeys.length === 0 || (nextKeys.length === paths.length && nextKeys.every((key) => paths.includes(key)))) {
      return current;
    }
    current = next;
    if (resolveTemplateEntry(current).format !== 'unknown') return current;
  }
}

function applyThemeClassReplacements(content, filePath) {
  if (!/\.(astro|tsx|jsx|ts|js|css)$/i.test(filePath)) return content;
  let next = String(content || '');
  for (const [pattern, replacement] of THEME_CLASS_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  next = next
    .replace(/#0f4c4c/gi, 'var(--primary-strong)')
    .replace(/#0d6e6e/gi, 'var(--primary)')
    .replace(/#0e7f74/gi, 'var(--primary-bright)')
    .replace(/#1a6a5a/gi, 'var(--primary-deep)')
    .replace(/#f59e0b/gi, 'var(--accent-strong)')
    .replace(/#f8fafc/gi, 'hsl(var(--background))');
  return next;
}

function ensureThemeIndexCss(inputFiles) {
  const files = { ...inputFiles };
  const cssKey = files['src/index.css'] ? 'src/index.css' : null;
  const themeBlock = `
@layer base {
  :root {
    --primary: var(--wizard-primary, #1d4ed8);
    --primary-strong: var(--wizard-primary-strong, #1e40af);
    --primary-bright: var(--wizard-primary-bright, #2563eb);
    --primary-deep: var(--wizard-primary-deep, #1e3a8a);
    --primary-soft: var(--wizard-primary-soft, rgba(37, 99, 235, 0.18));
    --accent: var(--wizard-accent, #f59e0b);
    --accent-strong: var(--wizard-accent-strong, #d97706);
    --accent-soft: var(--wizard-accent-soft, rgba(245, 158, 11, 0.18));
    --danger: #dc2626;
    --danger-soft: rgba(220, 38, 38, 0.12);
    --background: 210 40% 98%;
    --foreground: 222 47% 11%;
    --radius: var(--wizard-radius, 0.75rem);
  }

  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: var(--wizard-font-family, 'Inter'), system-ui, sans-serif;
  }
}

@layer utilities {
  .bg-primary { background-color: var(--primary) !important; }
  .hover\\:bg-primary\\/90:hover { background-color: color-mix(in srgb, var(--primary) 90%, black) !important; }
  .text-primary-soft { color: color-mix(in srgb, var(--primary) 35%, white) !important; }
  .border-primary-soft { border-color: var(--primary-soft) !important; }
  .ring-primary-soft { --tw-ring-color: var(--primary-soft) !important; }
  .focus\\:ring-primary-soft:focus { --tw-ring-color: var(--primary-soft) !important; }
  .focus\\:border-primary-soft:focus { border-color: var(--primary) !important; }
  .accent-primary { accent-color: var(--primary) !important; }
  .bg-accent { background-color: var(--accent) !important; }
  .hover\\:bg-accent\\/90:hover { background-color: color-mix(in srgb, var(--accent) 90%, black) !important; }
  .text-accent { color: var(--accent) !important; }
  .border-accent { border-color: var(--accent-soft) !important; }
  .bg-danger-soft { background-color: var(--danger-soft) !important; }
  .text-danger { color: var(--danger) !important; }
  .border-danger-soft { border-color: var(--danger-soft) !important; }
  .ring-danger-soft { --tw-ring-color: var(--danger-soft) !important; }
  .focus\\:ring-danger-soft:focus { --tw-ring-color: var(--danger-soft) !important; }
}
`;

  if (cssKey) {
    if (!String(files[cssKey] || '').includes('--wizard-primary')) {
      files[cssKey] = String(files[cssKey] || '') + themeBlock;
    }
    return files;
  }

  files['src/index.css'] = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n${themeBlock}`;
  return files;
}

function ensureWizardLayout(inputFiles) {
  const files = { ...inputFiles };
  const existingLayoutKey = files['src/layouts/Layout.astro']
    ? 'src/layouts/Layout.astro'
    : (files['src/layouts/BaseLayout.astro'] ? 'src/layouts/BaseLayout.astro' : null);

  const shimContent = `---
import '../index.css';

const brand = import.meta.env.PUBLIC_BRAND || 'Imported Template';
const domain = import.meta.env.PUBLIC_DOMAIN || 'example.com';
const conversionId = import.meta.env.PUBLIC_CONVERSIONID || '';
const formStartLabel = import.meta.env.PUBLIC_FORMSTARTLABEL || '';
const formSubmitLabel = import.meta.env.PUBLIC_FORMSUBMITLABEL || '';
const voluumDomain = import.meta.env.PUBLIC_VOLUUMDOMAIN || '';
const voluumClickUrl = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '';

interface Props {
  title?: string;
  description?: string;
  canonicalUrl?: string;
}

const {
  title = brand,
  description = brand,
  canonicalUrl = \`https://\${domain}\`,
} = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalUrl} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    {conversionId && (
      <script data-cfasync="false" is:inline async src={\`https://www.googletagmanager.com/gtag/js?id=\${conversionId}\`}></script>
    )}
    {voluumDomain && (
      <script data-cfasync="false" is:inline define:vars={{ voluumDomain }}>
        (function(){
          var p = new URLSearchParams(window.location.search);
          var cpid = p.get('cpid') || p.get('cid') || p.get('click_id') || p.get('vlcid') || '';
          if (cpid) { try { sessionStorage.setItem('voluum_cpid', cpid); } catch(_){} }
          var s = document.createElement('script');
          s.async = true; s.setAttribute('data-cfasync','false');
          s.src = 'https://' + voluumDomain + '/dtpCallback.js';
          document.head.appendChild(s);
        })();
      </script>
    )}
    <script data-cfasync="false" is:inline define:vars={{ conversionId, formStartLabel, formSubmitLabel }}>
      (function(){
        function gtag(){window.dataLayer=window.dataLayer||[];window.dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', conversionId);
        window.__gtagConversionId = conversionId;
        window.__formStartLabel = formStartLabel;
        window.__formSubmitLabel = formSubmitLabel;
      })();
    </script>
  </head>
  <body>
    <script data-cfasync="false" is:inline define:vars={{ domain }}>
      (function(){
        function fpPixel(eventName, extra) {
          try {
            var endpoint = 'https://t.' + window.location.hostname + '/e';
            var payload = Object.assign({ e: eventName, d: window.location.hostname, ts: Date.now() }, extra || {});
            navigator.sendBeacon(endpoint, JSON.stringify(payload));
          } catch(_) {}
        }
        var p = new URLSearchParams(window.location.search);
        var cid = p.get('gclid') || p.get('vlcid') || p.get('clickid') || p.get('click_id') || p.get('cid') || p.get('cpid') || '';
        window.__fpClickId = cid || '';
        if (!window.__fpPageTracked) {
          window.__fpPageTracked = true;
          fpPixel('pv', cid ? { click_id: cid } : {});
        }
        window.__fpPixel = fpPixel;
      })();
    </script>
    <slot />
  </body>
</html>
`;

  if (!files['src/layouts/Layout.astro']) {
    files['src/layouts/Layout.astro'] = shimContent;
  }

  if (existingLayoutKey && existingLayoutKey !== 'src/layouts/Layout.astro') {
    for (const [filePath, content] of Object.entries(files)) {
      if (!/\.(astro|tsx|jsx|ts|js)$/i.test(filePath)) continue;
      files[filePath] = String(content || '').replace(/\.\.\/layouts\/BaseLayout\.astro/g, '../layouts/Layout.astro');
    }
  }

  return files;
}

function ensureTrackingFiles(inputFiles) {
  const files = { ...inputFiles };
  if (!files['src/pages/e.ts']) {
    files['src/pages/e.ts'] = `import type { APIRoute } from 'astro';
export const POST: APIRoute = async ({ request }) => {
  try { const payload = JSON.parse(await request.text()); console.log('[pixel]', payload); } catch (_) {}
  return new Response(null, { status: 204 });
};
export const GET: APIRoute = () => new Response(null, { status: 204 });
`;
  }
  if (!files['src/pages/robots.txt.ts']) {
    files['src/pages/robots.txt.ts'] = `import type { APIRoute } from 'astro';
export const GET: APIRoute = () => {
  const domain = import.meta.env.PUBLIC_DOMAIN || import.meta.env.PUBLIC_SITE_URL || '';
  const sitemapUrl = domain ? \`https://\${domain}/sitemap.xml\` : '';
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /apply/'];
  if (sitemapUrl) { lines.push(''); lines.push(\`Sitemap: \${sitemapUrl}\`); }
  return new Response(lines.join('\\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
`;
  }
  if (!files['public/_headers']) {
    files['public/_headers'] = `/*.html
  Cache-Control: no-cache, no-store, must-revalidate

/
  Cache-Control: no-cache, no-store, must-revalidate

/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Robots-Tag: index, follow
  Link: <https://fonts.gstatic.com>; rel=preconnect; crossorigin
`;
  }
  return files;
}

function ensureTrackingIndexWiring(inputFiles) {
  const files = { ...inputFiles };
  const indexKey = files['src/pages/index.astro'] ? 'src/pages/index.astro' : null;
  if (!indexKey) return files;
  let index = String(files[indexKey] || '');
  if (!index.includes('const ctaHref')) {
    const frontmatterMatch = index.match(/^---\n?([\s\S]*?)\n---/m);
    if (frontmatterMatch) {
      const block = frontmatterMatch[1];
      const addition = `\nconst voluumClickUrl = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '';\nconst ctaHref = voluumClickUrl || '#apply';\n`;
      index = index.replace(frontmatterMatch[0], `---\n${block}${addition}---`);
    }
  }
  if (index.includes('href="#apply"')) {
    index = index.replace(/href="#apply"/g, 'href={ctaHref}');
  }
  if (!index.includes('href={ctaHref}')) {
    index = index.replace(/<\/BaseLayout>\s*$/, `  <a href={ctaHref} class="sr-only">Continue</a>\n</BaseLayout>\n`);
  }
  files[indexKey] = index;
  return files;
}

function applyWizardCompatibility(inputFiles) {
  let files = { ...inputFiles };
  for (const [filePath, content] of Object.entries(files)) {
    files[filePath] = applyThemeClassReplacements(content, filePath);
  }
  files = ensureThemeIndexCss(files);
  files = ensureWizardLayout(files);
  files = ensureTrackingFiles(files);
  files = ensureTrackingIndexWiring(files);
  return files;
}

function buildSourceCodeSummary(fileMap, format, validation) {
  const warnings = validation.warnings?.length || 0;
  return [
    `// Prepared for Template Wizard import`,
    `// Source: ${sourceDir}`,
    `// Template ID: ${templateId}`,
    `// Format: ${format}`,
    `// Files: ${Object.keys(fileMap).length}`,
    `// Warnings: ${warnings}`,
    `// Prepared At: ${new Date().toISOString()}`,
  ].join('\n');
}

async function writeZip(fileMap, zipPath) {
  const zip = new JSZip();
  for (const [filePath, content] of Object.entries(fileMap)) {
    zip.file(filePath, content);
  }
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  fs.writeFileSync(zipPath, buffer);
}

async function main() {
  console.log(`\n📦 Prepare Bolt Astro Import`);
  console.log(`   Source: ${sourceDir}`);
  console.log(`   Template ID: ${templateId}`);

  const rawFiles = {};
  walk(sourceDir, rawFiles, sourceDir);

  const normalizedFiles = applyWizardCompatibility(stripSingleRootWrappers(rawFiles));
  const validation = validateAstroStandard(normalizedFiles);
  const { format, entry } = resolveTemplateEntry(normalizedFiles);

  if (!validation.ok) {
    console.error('\n❌ Template is not importable yet.');
    for (const error of validation.errors || []) {
      console.error(`   - ${error}`);
    }
    process.exit(1);
  }

  ensureDir(outDir);

  const sourceCode = buildSourceCodeSummary(normalizedFiles, format, validation);
  const payload = {
    templateId,
    name: displayName || templateId.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
    description: description || `Imported Astro template: ${templateId}`,
    category,
    badge,
    format,
    sourceCode,
    files: normalizedFiles,
    validation,
    detectedEntry: entry,
    preparedAt: new Date().toISOString(),
  };

  const jsonPath = path.join(outDir, `${templateId}.file-map.json`);
  const zipPath = path.join(outDir, `${templateId}.import.zip`);

  if (!zipOnly) {
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  }

  if (!jsonOnly) {
    await writeZip(normalizedFiles, zipPath);
  }

  console.log(`\n✅ Template is ready for import.`);
  console.log(`   Format: ${format}`);
  console.log(`   Entry: ${entry || 'n/a'}`);
  console.log(`   Files: ${Object.keys(normalizedFiles).length}`);

  if ((validation.warnings || []).length > 0) {
    console.log(`\n⚠️ Warnings:`);
    for (const warning of validation.warnings) {
      console.log(`   - ${warning}`);
    }
  }

  if (!zipOnly) console.log(`\n   File map: ${jsonPath}`);
  if (!jsonOnly) console.log(`   ZIP: ${zipPath}`);

  console.log(`\nNext steps:`);
  if (!jsonOnly) {
    console.log(`   1. Open Template Wizard -> Smart Import (ZIP)`);
    console.log(`   2. Upload ${path.basename(zipPath)}`);
  }
  console.log(`   3. Review metadata and save the template`);
  console.log(`   4. The save payload should keep format=${format} and the normalized files map\n`);
}

main().catch((error) => {
  console.error('❌ Failed to prepare Astro import:', error);
  process.exit(1);
});
