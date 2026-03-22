#!/usr/bin/env node
/**
 * Build Variant — Theme + Content + Tracking replacement for templates
 *
 * Handles ONLY colors and fonts (reliable regex on CSS).
 * Content and tracking go to .env (Astro reads import.meta.env natively).
 *
 * Usage:
 *   node scripts/build-variant.mjs <template-dir> --config theme.json
 *   node scripts/build-variant.mjs <template-dir> --config theme.json --dry-run
 *
 * What it does:
 *   1. Reads theme.json
 *   2. Replaces CSS color variables in global.css / index.css
 *   3. Replaces font-family in Layout.astro (if specified)
 *   4. Writes .env with content + tracking vars (PUBLIC_* for Astro)
 *   5. Does NOT touch tracking scripts — inject-tracking.mjs handles those
 *
 * Compatible with:
 *   - Wizard (config → theme.json → this script)
 *   - CI pipeline (runs before inject-tracking.mjs)
 *   - Local dev (run manually, then `npm run dev`)
 */
import fs from 'node:fs';
import path from 'node:path';

// ─── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const templateDir = path.resolve(args.find(a => !a.startsWith('--')) || '.');
const configIdx = args.indexOf('--config');
const configPath = configIdx !== -1 ? path.resolve(args[configIdx + 1]) : path.resolve(templateDir, 'theme.json');
const dryRun = args.includes('--dry-run');

// ─── Load theme.json ─────────────────────────────────────────────────────────
let theme;
try {
  theme = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log(`✓ Loaded theme: ${configPath}`);
} catch (e) {
  console.error(`✗ Failed to load theme config: ${e.message}`);
  process.exit(1);
}

// ─── Find CSS file (global.css or index.css) ─────────────────────────────────
const cssCandidates = [
  'src/styles/global.css',
  'src/styles/index.css',
  'src/index.css',
  'src/app.css',
];
let cssFile = null;
for (const c of cssCandidates) {
  const p = path.join(templateDir, c);
  if (fs.existsSync(p)) { cssFile = p; break; }
}

// ─── 1. Replace colors in CSS ────────────────────────────────────────────────
if (cssFile && theme.colors) {
  let css = fs.readFileSync(cssFile, 'utf8');
  const colorMap = {
    'primary':            theme.colors.primary,
    'color-primary':      theme.colors.primary,
    'secondary':          theme.colors.secondary,
    'accent':             theme.colors.accent,
    'background':         theme.colors.background,
    'foreground':         theme.colors.foreground,
    'muted':              theme.colors.muted,
    'muted-foreground':   theme.colors['muted-foreground'],
    'border':             theme.colors.border,
    'input':              theme.colors.input,
    'ring':               theme.colors.ring,
    'card-foreground':    theme.colors['card-foreground'],
  };

  let replaced = 0;
  for (const [varName, value] of Object.entries(colorMap)) {
    if (!value) continue;
    // Match: --primary: 217 91% 35%  OR  --primary: ;  OR  --primary: <anything until ;>
    const regex = new RegExp(`(--${varName}:\\s*)[^;]*`, 'g');
    const before = css;
    css = css.replace(regex, `$1${value}`);
    if (css !== before) replaced++;
  }

  // Replace radius if specified
  if (theme.radius) {
    const before = css;
    css = css.replace(/(--radius:\s*)[^;]*/, `$1${theme.radius}`);
    if (css !== before) replaced++;
  }

  if (replaced > 0) {
    if (!dryRun) fs.writeFileSync(cssFile, css);
    console.log(`✓ Replaced ${replaced} CSS variables in ${path.relative(templateDir, cssFile)}`);
  } else {
    console.log(`○ No CSS variables matched in ${path.relative(templateDir, cssFile)}`);
  }
} else if (theme.colors) {
  console.log('○ No CSS file found — skipping color replacement');
}

// ─── 2. Replace font in Layout.astro ─────────────────────────────────────────
if (theme.font) {
  const layoutCandidates = [
    'src/layouts/Layout.astro',
    'src/layouts/BaseLayout.astro',
  ];
  let layoutFile = null;
  for (const c of layoutCandidates) {
    const p = path.join(templateDir, c);
    if (fs.existsSync(p)) { layoutFile = p; break; }
  }

  if (layoutFile) {
    let layout = fs.readFileSync(layoutFile, 'utf8');
    let changed = false;

    // Replace Google Fonts family parameter
    // Matches: family=Inter or family=DM+Sans:wght@400;500 etc.
    const fontImport = theme.font.replace(/\s/g, '+');
    const fontRegex = /family=[^&"'\s)]+/g;
    const before = layout;
    layout = layout.replace(fontRegex, `family=${fontImport}:wght@400;500;600;700&display=swap`);
    if (layout !== before) changed = true;

    // Replace font-family in inline styles
    if (theme.fontFamily) {
      layout = layout.replace(
        /font-family:\s*['"][^'"]+['"]/g,
        `font-family: '${theme.fontFamily}'`
      );
    }

    if (changed) {
      if (!dryRun) fs.writeFileSync(layoutFile, layout);
      console.log(`✓ Replaced font in ${path.relative(templateDir, layoutFile)}`);
    }
  }
}

// ─── 3. Write .env (content + tracking) ──────────────────────────────────────
const envVars = {};

// Content vars
if (theme.content) {
  if (theme.content.brand)  envVars.PUBLIC_BRAND = theme.content.brand;
  if (theme.content.h1)     envVars.PUBLIC_H1 = theme.content.h1;
  if (theme.content.sub)    envVars.PUBLIC_SUB = theme.content.sub;
  if (theme.content.cta)    envVars.PUBLIC_CTA = theme.content.cta;
  if (theme.content.phone)  envVars.PUBLIC_PHONE = theme.content.phone;
  if (theme.content.email)  envVars.PUBLIC_EMAIL = theme.content.email;
}
if (theme.domain) envVars.PUBLIC_DOMAIN = theme.domain;

// Loan params
if (theme.loan) {
  if (theme.loan.amountMin) envVars.PUBLIC_AMOUNTMIN = String(theme.loan.amountMin);
  if (theme.loan.amountMax) envVars.PUBLIC_AMOUNTMAX = String(theme.loan.amountMax);
  if (theme.loan.aprMin)    envVars.PUBLIC_APRMIN = String(theme.loan.aprMin);
  if (theme.loan.aprMax)    envVars.PUBLIC_APRMAX = String(theme.loan.aprMax);
}

// Tracking vars — passed through .env, inject-tracking.mjs handles the scripts
if (theme.tracking) {
  if (theme.tracking.conversionId)  envVars.PUBLIC_CONVERSIONID = theme.tracking.conversionId;
  if (theme.tracking.formStartLabel)  envVars.PUBLIC_FORMSTARTLABEL = theme.tracking.formStartLabel;
  if (theme.tracking.formSubmitLabel) envVars.PUBLIC_FORMSUBMITLABEL = theme.tracking.formSubmitLabel;
  if (theme.tracking.aid)           envVars.PUBLIC_AID = theme.tracking.aid;
  if (theme.tracking.voluumDomain)  envVars.PUBLIC_VOLUUMDOMAIN = theme.tracking.voluumDomain;
  if (theme.tracking.voluumClickUrl) envVars.PUBLIC_VOLUUM_CLICK_URL = theme.tracking.voluumClickUrl;
}

// Color/font IDs for Astro frontmatter (COLOR_MAP lookup)
if (theme.colorId) envVars.PUBLIC_COLORID = theme.colorId;
if (theme.fontId)  envVars.PUBLIC_FONTID = theme.fontId;
if (theme.radiusId) envVars.PUBLIC_RADIUS = theme.radiusId;

if (Object.keys(envVars).length > 0) {
  const envPath = path.join(templateDir, '.env');

  // Merge with existing .env (preserve keys we don't set)
  let existing = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const key = line.substring(0, eq).trim();
        const val = line.substring(eq + 1).trim();
        existing[key] = val;
      }
    }
  }

  const merged = { ...existing, ...envVars };
  const envContent = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  if (!dryRun) fs.writeFileSync(envPath, envContent + '\n');
  console.log(`✓ Wrote ${Object.keys(envVars).length} vars to .env (${Object.keys(existing).length} preserved)`);
} else {
  console.log('○ No content/tracking vars to write');
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (dryRun) {
  console.log('DRY RUN — no files were modified');
} else {
  console.log(`✓ Build variant applied to ${templateDir}`);
  console.log('');
  console.log('Next: inject-tracking.mjs handles Voluum/pixel/gtag/apply.astro');
  console.log('Then: npm run build');
}
