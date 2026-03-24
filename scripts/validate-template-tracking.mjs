#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { resolveAstroShellAstroPath } from './lib/astro-shell-resolve.mjs';

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function ensure(condition, message, issues) {
  if (!condition) issues.push(message);
}

const templateDirArg = process.argv[2];
if (!templateDirArg) {
  console.error('Usage: node scripts/validate-template-tracking.mjs <template-dir>');
  process.exit(2);
}

const templateDir = path.resolve(templateDirArg);

// Detect template format: Astro (has src/pages/index.astro) or HTML-first (has index.html)
const indexAstroPath = path.join(templateDir, 'src', 'pages', 'index.astro');
const indexHtmlPath = path.join(templateDir, 'index.html');
const distIndexPath = path.join(templateDir, 'dist', 'index.html');
const isAstro = fs.existsSync(indexAstroPath);
const isHtml = !isAstro && (fs.existsSync(indexHtmlPath) || fs.existsSync(distIndexPath));

if (isHtml) {
  // HTML-first templates: validate basic tracking presence in HTML files
  const htmlFiles = [];
  function findHtml(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== 'node_modules') findHtml(path.join(dir, entry.name));
      else if (entry.name.endsWith('.html')) htmlFiles.push(path.join(dir, entry.name));
    }
  }
  findHtml(templateDir);

  const allHtml = htmlFiles.map(f => readText(f)).join('\n');
  const issues = [];

  if (allHtml.length === 0) {
    issues.push('No HTML files found in template directory');
  } else {
    // Basic checks for HTML templates — warnings only, not blocking
    const hasGtag = /gtag\(|googletagmanager|AW-\d+/i.test(allHtml);
    const hasPixel = /sendBeacon|fpPixel|__fpPixel|pixel|\/e['"?]/i.test(allHtml);
    if (!hasGtag) console.warn('⚠ HTML template: No Google Ads tracking detected (non-blocking)');
    if (!hasPixel) console.warn('⚠ HTML template: No pixel tracking detected (non-blocking)');
  }

  if (issues.length) {
    console.error('\n✗ HTML template validation failed:\n');
    for (const issue of issues) console.error(`  - ${issue}`);
    process.exit(1);
  }

  console.log('✓ HTML-first template validation passed for', templateDir, `(${htmlFiles.length} HTML files)`);
  process.exit(0);
}

// Astro template validation — document shell path matches inject-tracking (index imports, layouts, components)
const shellPath = resolveAstroShellAstroPath(templateDir);
const endpointPath = path.join(templateDir, 'src', 'pages', 'e.ts');
const robotsPath = path.join(templateDir, 'src', 'pages', 'robots.txt.ts');
const headersPath = path.join(templateDir, 'public', '_headers');

const layout = shellPath ? readText(shellPath) : '';
const index = readText(indexAstroPath);

const issues = [];

ensure(
  Boolean(shellPath && fs.existsSync(shellPath)),
  'Missing or unresolvable Astro document shell (need <html>/<head> in a layout or component imported from index.astro, or under src/layouts|components)',
  issues,
);
ensure(fs.existsSync(indexAstroPath), `Missing file: ${indexAstroPath}`, issues);
ensure(fs.existsSync(endpointPath), `Missing endpoint: ${endpointPath}`, issues);
ensure(fs.existsSync(robotsPath), `Missing robots route: ${robotsPath}`, issues);
ensure(fs.existsSync(headersPath), `Missing security headers file: ${headersPath}`, issues);

const shellLabel = shellPath ? path.relative(templateDir, shellPath) : 'document shell';

if (layout) {
  ensure(
    layout.includes('PUBLIC_VOLUUMDOMAIN')
      || layout.includes('__voluumDomain')
      || layout.includes('__VOLUUM_DOMAIN__'),
    `${shellLabel} missing Voluum domain wiring (PUBLIC_VOLUUMDOMAIN or injected __voluumDomain)`,
    issues,
  );
  ensure(layout.includes('PUBLIC_FORMSTARTLABEL'), `${shellLabel} missing PUBLIC_FORMSTARTLABEL env usage`, issues);
  ensure(layout.includes('PUBLIC_FORMSUBMITLABEL'), `${shellLabel} missing PUBLIC_FORMSUBMITLABEL env usage`, issues);
  ensure(
    layout.includes("'https://t.' + window.location.hostname + '/e'") ||
      layout.includes('"https://t." + window.location.hostname + "/e"') ||
      layout.includes('PX_ENDPOINT'),
    `${shellLabel} pixel must use t.{domain}/e (pixel worker), not /e on apex host`,
    issues
  );
  ensure(
    !layout.includes("i.src = '/e?") &&
      !layout.includes('i.src = "/e?') &&
      !layout.includes("fetch('/e'") &&
      !layout.includes('fetch("/e"') &&
      !layout.includes("sendBeacon('/e'"),
    `${shellLabel} must NOT use apex /e transport — use t.{domain}/e instead`,
    issues
  );
  ensure(
    layout.includes('dtpCallback') || layout.includes('PUBLIC_VOLUUMDOMAIN'),
    `${shellLabel} missing Voluum dtpCallback injection (use dtpCallback.js, not vp.js)`,
    issues
  );
  ensure(
    layout.includes('voluum-cta-rewriter')
      || layout.includes('fusionops-voluum-cta')
      || layout.includes('__foPatchCta'),
    `${shellLabel} missing Voluum CTA rewriter / inline __foPatchCta (run scripts/inject-tracking.mjs on template dir)`,
    issues
  );
}

if (index) {
  ensure(index.includes('const ctaHref') || index.includes('ctaHref'), 'index.astro missing ctaHref declaration', issues);
  // CTA wiring is best-effort — inject-tracking replaces /apply and #apply but some templates use other patterns
  if (!index.includes('href={ctaHref}') && !index.includes('/apply')) {
    console.warn('  ⚠ index.astro CTA links may not be wired to ctaHref (non-blocking)');
  }
}

if (issues.length) {
  console.error('\\n✗ Tracking stack validation failed:\\n');
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

console.log('✓ Tracking stack static validation passed for', templateDir);

// Optional Puppeteer network check — must NOT use static `import` here: ESM hoists imports, so CI
// would load puppeteer even when we exit early (e.g. no dist yet). deploy-lp runs this step before
// `npm run build`, so dist is often absent; when dist exists, root node_modules may still be missing
// in Actions because only the template folder gets `npm install`.
const distDir = path.join(templateDir, 'dist');
if (!fs.existsSync(distDir)) {
  console.log(
    '⚠ No dist directory found. Skipping Puppeteer network validation (normal for deploy-lp before build).'
  );
  process.exit(0);
}

(async () => {
  const { spawn } = await import('node:child_process');
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch (e) {
    console.warn('⚠ Puppeteer not available; skipping network validation:', e?.code || e?.message);
    process.exit(0);
  }

  console.log('\n[Puppeteer] Starting local server to verify tracking network requests...');
  const server = spawn('npx', ['serve', 'dist', '-p', '8080'], { cwd: templateDir, stdio: 'ignore' });

  await new Promise((r) => setTimeout(r, 2000));
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();

    let caughtPixel = false;
    let caughtVoluum = false;

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/e?') || url.includes('/e&')) {
        console.log('  ✓ [Network] Caught First-party Pixel request:', url);
        caughtPixel = true;
      }
      if (url.includes('link.scratchpayeasy.com/d/.js') || url.includes('/d/.js')) {
        console.log('  ✓ [Network] Caught Voluum dtpCallback request:', url);
        caughtVoluum = true;
      }
    });

    console.log('[Puppeteer] Navigating to http://localhost:8080');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle0', timeout: 10000 });

    await browser.close();

    if (caughtPixel && caughtVoluum) {
      console.log('\n✅ ALL TRACKING VERIFIED: Puppeteer successfully intercepted Pixel and Voluum network requests.');
      process.exit(0);
    } else {
      console.error('\n❌ TRACKING FAILURE: Missing network requests.');
      if (!caughtPixel) console.error('  - First-party Pixel beacon (/e) did NOT fire.');
      if (!caughtVoluum) console.error('  - Voluum dtpCallback (/d/.js) did NOT fire.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Puppeteer verification error:', err);
    process.exit(1);
  } finally {
    try {
      server.kill('SIGTERM');
    } catch (_) {}
  }
})().catch((err) => {
  console.error('Puppeteer async bootstrap error:', err);
  process.exit(1);
});
