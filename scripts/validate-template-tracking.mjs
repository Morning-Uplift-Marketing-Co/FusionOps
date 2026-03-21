#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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

// Astro template validation (original logic)
const layoutPath = path.join(templateDir, 'src', 'layouts', 'Layout.astro');
const endpointPath = path.join(templateDir, 'src', 'pages', 'e.ts');
const robotsPath = path.join(templateDir, 'src', 'pages', 'robots.txt.ts');
const headersPath = path.join(templateDir, 'public', '_headers');

const layout = readText(layoutPath);
const index = readText(indexAstroPath);

const issues = [];

ensure(fs.existsSync(layoutPath), `Missing file: ${layoutPath}`, issues);
ensure(fs.existsSync(indexAstroPath), `Missing file: ${indexAstroPath}`, issues);
ensure(fs.existsSync(endpointPath), `Missing endpoint: ${endpointPath}`, issues);
ensure(fs.existsSync(robotsPath), `Missing robots route: ${robotsPath}`, issues);
ensure(fs.existsSync(headersPath), `Missing security headers file: ${headersPath}`, issues);

if (layout) {
  ensure(layout.includes('PUBLIC_VOLUUMDOMAIN'), 'Layout.astro missing PUBLIC_VOLUUMDOMAIN env usage', issues);
  ensure(layout.includes('PUBLIC_FORMSTARTLABEL'), 'Layout.astro missing PUBLIC_FORMSTARTLABEL env usage', issues);
  ensure(layout.includes('PUBLIC_FORMSUBMITLABEL'), 'Layout.astro missing PUBLIC_FORMSUBMITLABEL env usage', issues);
  ensure(
    layout.includes("'https://t.' + window.location.hostname + '/e'") ||
      layout.includes('"https://t." + window.location.hostname + "/e"') ||
      layout.includes('PX_ENDPOINT'),
    "Layout.astro pixel must use t.{domain}/e (pixel worker), not /e on apex host",
    issues
  );
  ensure(
    !layout.includes("i.src = '/e?") &&
      !layout.includes('i.src = "/e?') &&
      !layout.includes("fetch('/e'") &&
      !layout.includes('fetch("/e"') &&
      !layout.includes("sendBeacon('/e'"),
    "Layout.astro must NOT use apex /e transport — use t.{domain}/e instead",
    issues
  );
  ensure(
    layout.includes('dtpCallback') || layout.includes('PUBLIC_VOLUUMDOMAIN'),
    'Layout.astro missing Voluum dtpCallback injection (use dtpCallback.js, not vp.js)',
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
  console.error('\n✗ Tracking stack validation failed:\n');
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

console.log('✓ Tracking stack validation passed for', templateDir);
