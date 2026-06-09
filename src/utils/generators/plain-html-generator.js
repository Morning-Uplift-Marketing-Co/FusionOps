/**
 * Plain HTML Generator — Framework-Free Landing Page
 * ====================================================
 * Generates clean, zero-framework HTML landing pages that look nothing
 * like Astro or React output. Each site gets a unique structure based
 * on its site.id hash.
 *
 * Anti-fingerprinting features:
 * - Multiple layout templates (hero-top, split, card-center, sidebar)
 * - Randomized CSS class names (no Tailwind, no BEM pattern)
 * - Randomized section order
 * - Different Google Fonts per site
 * - Unique inline style variations
 * - No framework fingerprints (no __next, no __preact, no astro attrs)
 *
 * Tracking: Compatible with inject-tracking.mjs (type='html')
 * and ensureTrackingBaselineHtml() from template-router.js
 */

import { createHash } from 'node:crypto';
import seedrandom from 'seedrandom';
import { COLORS, FONTS } from "../../constants/index.js";

// ─── Seeded RNG per site ───

function makeRng(siteId, namespace = 'html-gen') {
  const seed = createHash('sha256').update(`${siteId}:${namespace}`).digest('hex').slice(0, 10);
  return seedrandom(seed);
}

function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function rngInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ─── Layout strategies ───

const LAYOUTS = ['hero-top', 'split-left', 'card-center', 'sidebar-form'];

// ─── Google Fonts (diverse selection — not just Inter/DM Sans) ───

const FONT_FAMILIES = [
  { family: "'Plus Jakarta Sans', sans-serif", import: "Plus+Jakarta+Sans:wght@400;500;600;700;800" },
  { family: "'Outfit', sans-serif", import: "Outfit:wght@300;400;500;600;700;800" },
  { family: "'Sora', sans-serif", import: "Sora:wght@300;400;500;600;700;800" },
  { family: "'Space Grotesk', sans-serif", import: "Space+Grotesk:wght@400;500;600;700" },
  { family: "'DM Sans', sans-serif", import: "DM+Sans:wght@400;500;600;700;800" },
  { family: "'Manrope', sans-serif", import: "Manrope:wght@400;500;600;700;800" },
  { family: "'Figtree', sans-serif", import: "Figtree:wght@400;500;600;700;800" },
  { family: "'Nunito Sans', sans-serif", import: "Nunito+Sans:wght@400;600;700;800" },
  { family: "'Karla', sans-serif", import: "Karla:wght@400;500;600;700;800" },
  { family: "'Lexend', sans-serif", import: "Lexend:wght@400;500;600;700;800" },
];

// ─── CSS naming-convention strategies (cross-network fingerprint diversity) ───
// Each site deterministically adopts ONE class-naming paradigm so the network
// is not a monoculture of identically-shaped class names. None of these emit
// Tailwind-style utility strings.
export const CSS_NAMING_STRATEGIES = ['short-random', 'bem', 'semantic', 'hashed'];

/**
 * Deterministically pick a CSS naming strategy for a site.
 * Same site.id → same strategy (stable across rebuilds).
 */
export function pickCssStrategy(siteId) {
  const rng = makeRng(siteId, 'css-strategy');
  return rngPick(rng, CSS_NAMING_STRATEGIES);
}

// Readable vocab variants for the `semantic` strategy (seeded pick adds
// intra-strategy variety so two semantic sites still differ).
const SEMANTIC_VOCAB = [
  {
    'wrapper': 'page-wrap', 'header': 'site-head', 'hero': 'hero-band', 'h1': 'hero-title',
    'subtitle': 'hero-sub', 'cta-btn': 'action-button', 'trust-bar': 'trust-row', 'trust-item': 'trust-cell',
    'form-card': 'lead-card', 'form-title': 'lead-title', 'form-sub': 'lead-note', 'input': 'field-control',
    'reviews': 'voices', 'review-card': 'voice-card', 'review-name': 'voice-name', 'review-text': 'voice-body',
    'footer': 'site-foot', 'badge': 'pill-tag', 'section-title': 'block-heading', 'amount-display': 'amount-box',
    'how-it-works': 'steps-band',
  },
  {
    'wrapper': 'shell', 'header': 'topbar', 'hero': 'intro', 'h1': 'headline',
    'subtitle': 'tagline', 'cta-btn': 'primary-cta', 'trust-bar': 'badges', 'trust-item': 'badge-cell',
    'form-card': 'apply-box', 'form-title': 'apply-head', 'form-sub': 'apply-hint', 'input': 'entry',
    'reviews': 'testimonials', 'review-card': 'quote', 'review-name': 'quote-by', 'review-text': 'quote-text',
    'footer': 'foot', 'badge': 'chip', 'section-title': 'heading', 'amount-display': 'figure',
    'how-it-works': 'process',
  },
];

// Block names for the `bem` strategy.
const BEM_BLOCKS = ['lp', 'pg', 'site', 'ldg'];

// ─── Randomized CSS class name generator (strategy-aware) ───

function generateClassNames(rng, count = 20, strategy = 'short-random') {
  const prefixes = ['fx', 'lx', 'mx', 'nx', 'px', 'qx', 'rx', 'sx', 'tx', 'vx', 'wx', 'zx'];
  const map = {};
  const used = new Set();

  const needed = [
    'wrapper', 'header', 'hero', 'h1', 'subtitle', 'cta-btn',
    'trust-bar', 'trust-item', 'form-card', 'form-title', 'form-sub',
    'input', 'reviews', 'review-card', 'review-name', 'review-text',
    'footer', 'badge', 'section-title', 'amount-display', 'how-it-works',
  ];

  // Pre-resolve per-strategy site-level choices (seeded, deterministic).
  const vocab = strategy === 'semantic' ? rngPick(rng, SEMANTIC_VOCAB) : null;
  const bemBlock = strategy === 'bem' ? rngPick(rng, BEM_BLOCKS) : null;

  const uniq = (cls) => {
    let candidate = cls;
    let suffix = 2;
    while (used.has(candidate)) { candidate = `${cls}-${suffix++}`; }
    used.add(candidate);
    return candidate;
  };

  for (const name of needed.slice(0, count)) {
    let cls;
    if (strategy === 'bem') {
      // block__element — e.g. lp__hero-band
      cls = uniq(`${bemBlock}__${name.replace(/[^a-z0-9-]/g, '')}`);
    } else if (strategy === 'semantic') {
      // readable kebab-case from a seeded vocab
      cls = uniq(vocab[name] || name);
    } else if (strategy === 'hashed') {
      // css-modules-like opaque token — letter + base36
      let candidate;
      let attempts = 0;
      do {
        candidate = `${rngPick(rng, prefixes).charAt(0)}${rngInt(rng, 100000, 9999999).toString(36)}`;
        attempts++;
      } while (used.has(candidate) && attempts < 50);
      used.add(candidate);
      cls = candidate;
    } else {
      // short-random (default): prefix + number, e.g. fx123
      let candidate;
      let attempts = 0;
      do {
        candidate = `${rngPick(rng, prefixes)}${rngInt(rng, 1, 999)}`;
        attempts++;
      } while (used.has(candidate) && attempts < 50);
      used.add(candidate);
      cls = candidate;
    }
    map[name] = cls;
  }
  return map;
}

// ─── Review generation ───

function generateReviews(site, rng, count) {
  const reviewNames = [
    'Sarah K.', 'Mark D.', 'Jessica M.', 'David R.', 'Lisa T.',
    'James W.', 'Maria G.', 'Robert H.', 'Jennifer P.', 'Michael S.',
    'Amanda L.', 'Chris B.', 'Nicole F.', 'Tom K.', 'Rachel N.',
  ];
  const reviewLocations = [
    'Austin, TX', 'Portland, OR', 'Miami, FL', 'Denver, CO', 'Seattle, WA',
    'Chicago, IL', 'Nashville, TN', 'Phoenix, AZ', 'Atlanta, GA', 'Boston, MA',
    'San Diego, CA', 'Dallas, TX', 'Charlotte, NC', 'Orlando, FL', 'Columbus, OH',
  ];

  const reviews = site.reviews && site.reviews.length > 0
    ? site.reviews
    : [
        { name: 'Sarah K.', text: 'The process was incredibly smooth. Got matched with a lender in minutes and had funds the next business day.', rating: 5, location: 'Austin, TX' },
        { name: 'Mark D.', text: 'Simple, fast, and transparent. No hidden fees and the terms were exactly what I needed.', rating: 5, location: 'Portland, OR' },
        { name: 'Jessica M.', text: 'I was skeptical at first but the whole experience was professional from start to finish.', rating: 5, location: 'Miami, FL' },
      ];

  return reviews.slice(0, count);
}

// ─── Main generator ───

/**
 * Generate a framework-free HTML landing page.
 * Output is plain HTML + inline CSS + vanilla JS.
 * No build step needed — works with inject-tracking.mjs type='html'.
 *
 * @param {object} site - Site configuration from Wizard
 * @returns {string} Complete HTML document
 */
export function generatePlainHtml(site) {
  const rng = makeRng(site.id, 'plain-html');
  const rngCss = makeRng(site.id, 'css-names');
  const rngLayout = makeRng(site.id, 'layout');

  // Resolve theme
  const colorObj = COLORS.find(c => c.id === site.colorId) || COLORS[3] || COLORS[0];
  const primary = `hsl(${colorObj.p[0]}, ${colorObj.p[1]}%, ${colorObj.p[2]}%)`;
  const primaryLight = `hsl(${colorObj.p[0]}, ${colorObj.p[1]}%, 95%)`;
  const primaryDark = `hsl(${colorObj.p[0]}, ${colorObj.p[1]}%, 30%)`;
  const bg = `hsl(${colorObj.bg[0]}, ${colorObj.bg[1]}%, ${colorObj.bg[2]}%)`;

  // Pick font (different from Inter/DM Sans most of the time)
  const font = rngPick(rng, FONT_FAMILIES);

  // Pick layout
  const layout = rngPick(rngLayout, LAYOUTS);

  // Pick a CSS naming paradigm for this site (cross-network diversity)
  const cssStrategy = pickCssStrategy(site.id);

  // Randomize class names according to the chosen strategy
  const cn = generateClassNames(rngCss, 20, cssStrategy);

  // Randomize review count
  const reviewCount = rngInt(rng, 2, 4);
  const reviews = generateReviews(site, rng, reviewCount);

  // Randomize section order
  const sections = ['hero', 'how-it-works', 'reviews'];
  const shuffledSections = [...sections];
  for (let i = shuffledSections.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledSections[i], shuffledSections[j]] = [shuffledSections[j], shuffledSections[i]];
  }

  // Content
  const brand = site.brand || 'LoanBridge';
  const h1 = site.h1 || 'Get the Funds You Need Today';
  const sub = site.sub || 'Fast, secure, and hassle-free financing';
  const cta = site.cta || 'Apply Now';
  const amountMax = site.amountMax ? `$${Number(String(site.amountMax).replace(/[^0-9]/g, '')).toLocaleString()}` : '$5,000';
  const amountMin = site.amountMin ? `$${Number(String(site.amountMin).replace(/[^0-9]/g, '')).toLocaleString()}` : '$100';
  const phone = site.phone || '1-800-555-HELP';
  const email = site.email || `support@${site.domain || 'example.com'}`;
  const aprMin = site.aprMin || '5.99';
  const aprMax = site.aprMax || '35.99';

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Build sections HTML
  const sectionHtml = {
    hero: buildHeroSection(layout, cn, { h1, sub, cta, amountMin, amountMax, brand, primary, primaryLight, primaryDark }),
    'how-it-works': buildHowItWorksSection(cn, rng, { primary, primaryLight }),
    reviews: buildReviewsSection(cn, reviews, { primary, primaryLight }),
  };

  // Assemble body based on layout
  const bodyContent = buildLayout(layout, cn, sectionHtml, shuffledSections, {
    formContent: buildFormSection(cn, { brand, cta, primary }),
    footer: buildFooter(cn, { brand, phone, email, aprMin, aprMax }),
    trust: buildTrustBar(cn, { primary }),
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(site.metaTitle || `${brand} — ${h1}`)}</title>
<meta name="description" content="${esc(site.metaDesc || sub)}">
<meta name="robots" content="index,follow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${font.import}&display=swap" rel="stylesheet">
<link rel="icon" href="/favicon.ico" sizes="any">
<style>
/* Auto-generated by FusionOps Plain HTML Generator — no framework */
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:${font.family};background:${bg};color:#1a1a2e;line-height:1.6;-webkit-font-smoothing:antialiased}
.${cn['wrapper']}{max-width:480px;margin:0 auto;padding:0 16px}
.${cn['header']}{padding:16px 0;text-align:center;border-bottom:1px solid #f0f0f0}
.${cn['hero']}{padding:${layout === 'card-center' ? '24px' : '40px'} 0 ${layout === 'hero-top' ? '24px' : '16px'};text-align:center}
.${cn['h1']}{font-size:24px;font-weight:800;line-height:1.2;margin-bottom:12px;color:#0f172a}
.${cn['subtitle']}{font-size:14px;color:#64748b;margin-bottom:20px;line-height:1.5}
.${cn['cta-btn']}{display:inline-block;background:${primary};color:#fff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:${rngInt(rng, 6, 16)}px;text-decoration:none;border:none;cursor:pointer;width:100%;text-align:center;transition:opacity .2s;box-shadow:0 4px 14px ${primary}33}
.${cn['cta-btn']}:hover{opacity:.9}
.${cn['badge']}{display:inline-block;background:${primaryLight};color:${primaryDark};font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:12px;border:1px solid ${primary}22}
.${cn['trust-bar']}{display:flex;justify-content:center;gap:20px;margin:20px 0;padding:12px 0;border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0}
.${cn['trust-item']}{text-align:center;font-size:10px;color:#94a3b8;font-weight:600}
.${cn['form-card']}{margin:16px 0;padding:24px;background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.06)}
.${cn['form-title']}{font-size:15px;font-weight:700;text-align:center;margin-bottom:4px}
.${cn['form-sub']}{font-size:11px;color:#94a3b8;text-align:center;margin-bottom:16px}
.${cn['input']}{width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;margin-bottom:10px;background:#f8fafc;font-family:inherit}
.${cn['input']}:focus{outline:none;border-color:${primary};box-shadow:0 0 0 3px ${primary}15}
.${cn['amount-display']}{text-align:center;padding:16px;background:${primaryLight};border-radius:12px;margin:16px 0}
.${cn['section-title']}{font-size:16px;font-weight:800;margin-bottom:16px;text-align:center}
.${cn['how-it-works']}{padding:24px 0}
.${cn['reviews']}{padding:24px 0}
.${cn['review-card']}{background:#fff;padding:16px;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.04);margin-bottom:12px}
.${cn['review-name']}{font-size:13px;font-weight:700;margin-bottom:4px}
.${cn['review-text']}{font-size:12px;color:#64748b;line-height:1.5}
.${cn['footer']}{padding:24px 0;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #f0f0f0;margin-top:24px}
.${cn['footer']} a{color:#94a3b8;text-decoration:underline}
@media(max-width:380px){.${cn['h1']}{font-size:20px}.${cn['wrapper']}{padding:0 12px}}
</style>
</head>
<body>
<div class="${cn['wrapper']}">
${bodyContent}
</div>
</body>
</html>`;
}

// ─── Section builders ───

function buildHeroSection(layout, cn, { h1, sub, cta, amountMin, amountMax, brand, primary, primaryLight, primaryDark }) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `
  <div class="${cn['header']}">
    <strong style="font-size:14px;color:${primaryDark}">${esc(brand)}</strong>
  </div>
  <div class="${cn['hero']}">
    <div class="${cn['badge']}">Loans ${amountMin} – ${amountMax}</div>
    <h1 class="${cn['h1']}">${esc(h1)}</h1>
    <p class="${cn['subtitle']}">${esc(sub)}</p>
  </div>`;
}

function buildTrustBar(cn) {
  const items = [
    { icon: '🔒', label: '256-bit SSL' },
    { icon: '⚡', label: '2-Min Apply' },
    { icon: '✅', label: 'No Credit Impact' },
  ];
  return `
  <div class="${cn['trust-bar']}">
    ${items.map(i => `<div class="${cn['trust-item']}"><div style="font-size:18px;margin-bottom:2px">${i.icon}</div>${i.label}</div>`).join('\n    ')}
  </div>`;
}

function buildFormSection(cn, { brand, cta, primary }) {
  return `
  <div class="${cn['form-card']}">
    <div class="${cn['form-title']}">Check Your Eligibility</div>
    <div class="${cn['form-sub']}">Takes less than 3 minutes — no obligation</div>
    <input class="${cn['input']}" type="text" placeholder="ZIP Code" readonly>
    <button class="${cn['cta-btn']}" onclick="this.textContent='Processing...'">${cta}</button>
  </div>`;
}

function buildHowItWorksSection(cn, rng, { primary, primaryLight }) {
  const steps = [
    { num: '1', text: 'Fill out the simple form' },
    { num: '2', text: 'Get matched with top lenders' },
    { num: '3', text: 'Receive funds as soon as tomorrow' },
  ];
  return `
  <div class="${cn['how-it-works']}">
    <div class="${cn['section-title']}">How It Works</div>
    ${steps.map(s => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#fff;border-radius:12px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.04)">
      <div style="width:28px;height:28px;border-radius:50%;background:${primaryLight};color:${primary};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0">${s.num}</div>
      <div style="font-size:12px;font-weight:600">${s.text}</div>
    </div>`).join('')}
  </div>`;
}

function buildReviewsSection(cn, reviews, { primary }) {
  return `
  <div class="${cn['reviews']}">
    <div class="${cn['section-title']}">What Our Customers Say</div>
    ${reviews.map(r => `
    <div class="${cn['review-card']}">
      <div class="${cn['review-name']}">${'★'.repeat(r.rating || 5)} ${r.name}</div>
      <div class="${cn['review-text']}">${r.text}</div>
      ${r.location ? `<div style="font-size:10px;color:#cbd5e1;margin-top:4px">${r.location}</div>` : ''}
    </div>`).join('')}
  </div>`;
}

function buildFooter(cn, { brand, phone, email, aprMin, aprMax }) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `
  <div class="${cn['footer']}">
    <div style="margin-bottom:8px">${esc(brand)} — ${esc(phone)}</div>
    <div style="margin-bottom:8px;font-size:10px">APR ranges from ${aprMin}% to ${aprMax}%. Not all applicants will qualify.</div>
    <div style="font-size:10px">
      <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a>
    </div>
  </div>`;
}

// ─── Layout assembler ───

function buildLayout(layout, cn, sectionHtml, sectionOrder, extras) {
  const parts = [];

  // Always start with hero
  parts.push(sectionHtml.hero);
  parts.push(extras.trust);

  // Form position varies by layout
  if (layout === 'hero-top') {
    parts.push(extras.formContent);
    for (const sec of sectionOrder.filter(s => s !== 'hero')) {
      parts.push(sectionHtml[sec]);
    }
  } else if (layout === 'split-left') {
    parts.push(extras.formContent);
    for (const sec of sectionOrder.filter(s => s !== 'hero')) {
      parts.push(sectionHtml[sec]);
    }
  } else if (layout === 'card-center') {
    for (const sec of sectionOrder.filter(s => s !== 'hero')) {
      parts.push(sectionHtml[sec]);
    }
    parts.push(extras.formContent);
  } else if (layout === 'sidebar-form') {
    parts.push(extras.formContent);
    for (const sec of sectionOrder.filter(s => s !== 'hero')) {
      parts.push(sectionHtml[sec]);
    }
  }

  parts.push(extras.footer);
  return parts.join('\n');
}
