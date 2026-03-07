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
const layoutPath = path.join(templateDir, 'src', 'layouts', 'Layout.astro');
const indexPath = path.join(templateDir, 'src', 'pages', 'index.astro');
const endpointPath = path.join(templateDir, 'src', 'pages', 'e.ts');
const robotsPath = path.join(templateDir, 'src', 'pages', 'robots.txt.ts');
const headersPath = path.join(templateDir, 'public', '_headers');

const layout = readText(layoutPath);
const index = readText(indexPath);

const issues = [];

ensure(fs.existsSync(layoutPath), `Missing file: ${layoutPath}`, issues);
ensure(fs.existsSync(indexPath), `Missing file: ${indexPath}`, issues);
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
  ensure(layout.includes('/scripts/') && layout.includes('/vp.js'), 'Layout.astro missing Voluum vp.js injection', issues);
}

if (index) {
  ensure(index.includes('const ctaHref'), 'index.astro missing ctaHref declaration', issues);
  ensure(index.includes('href={ctaHref}'), 'index.astro CTA links are not wired to ctaHref', issues);
}

if (issues.length) {
  console.error('\n✗ Tracking stack validation failed:\n');
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

console.log('✓ Tracking stack validation passed for', templateDir);
