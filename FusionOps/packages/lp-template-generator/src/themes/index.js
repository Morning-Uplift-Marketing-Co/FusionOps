/**
 * Theme Engine
 * Extends FusionOps's existing COLORS/FONTS from template-registry.js
 * Generates CSS :root variables per build → fingerprint differs every LP
 */

// ─── Color Palettes (15) ────────────────────────────────────
export const COLOR_PALETTES = [
  { id: 'ruby',       name: 'Ruby Red',      p: [350,85,40], a: [40,90,55],  bg: [350,15,97], fg: [220,16,15] },
  { id: 'ocean',      name: 'Ocean Blue',    p: [210,80,45], a: [180,60,45], bg: [210,15,97], fg: [210,20,20] },
  { id: 'forest',     name: 'Forest Green',  p: [150,65,38], a: [170,60,40], bg: [150,15,97], fg: [150,20,20] },
  { id: 'royal',      name: 'Royal Purple',  p: [270,65,48], a: [290,60,45], bg: [270,15,97], fg: [270,20,20] },
  { id: 'ember',      name: 'Ember Orange',  p: [25,88,50],  a: [40,85,50],  bg: [30,15,97],  fg: [25,20,20]  },
  { id: 'teal',       name: 'Teal Trust',    p: [178,65,38], a: [22,90,55],  bg: [178,12,97], fg: [178,20,18] },
  { id: 'indigo',     name: 'Indigo Gold',   p: [240,60,48], a: [45,85,52],  bg: [240,12,97], fg: [240,20,18] },
  { id: 'slate',      name: 'Slate Blue',    p: [215,45,42], a: [35,80,55],  bg: [215,10,97], fg: [215,20,18] },
  { id: 'crimson',    name: 'Crimson',       p: [355,75,45], a: [44,90,55],  bg: [355,10,97], fg: [355,20,18] },
  { id: 'sky',        name: 'Sky Trust',     p: [200,75,45], a: [25,85,55],  bg: [200,12,97], fg: [200,20,18] },
  { id: 'pine',       name: 'Pine Green',    p: [145,60,35], a: [38,80,52],  bg: [145,10,97], fg: [145,20,18] },
  { id: 'violet',     name: 'Violet',        p: [280,60,45], a: [45,85,52],  bg: [280,10,97], fg: [280,20,18] },
  { id: 'amber',      name: 'Amber',         p: [38,90,48],  a: [200,60,45], bg: [38,12,97],  fg: [38,20,18]  },
  { id: 'rose',       name: 'Rose',          p: [345,70,48], a: [175,55,42], bg: [345,10,97], fg: [345,20,18] },
  { id: 'graphite',   name: 'Graphite',      p: [220,20,35], a: [350,80,52], bg: [220,8,97],  fg: [220,15,15] },
];

// ─── Font Pairs (10) ────────────────────────────────────────
export const FONT_PAIRS = [
  { id: 'dm-inter',      heading: "'DM Sans'",       body: "'Inter'",          import: 'DM+Sans:wght@400;600;700&family=Inter:wght@400;500' },
  { id: 'outfit-source', heading: "'Outfit'",         body: "'Source Sans 3'",  import: 'Outfit:wght@400;600;700&family=Source+Sans+3:wght@400;500' },
  { id: 'jakarta-nunito',heading: "'Plus Jakarta Sans'",body: "'Nunito Sans'", import: 'Plus+Jakarta+Sans:wght@400;600;700&family=Nunito+Sans:wght@400;500' },
  { id: 'sora-work',     heading: "'Sora'",           body: "'Work Sans'",      import: 'Sora:wght@400;600;700&family=Work+Sans:wght@400;500' },
  { id: 'manrope-lato',  heading: "'Manrope'",        body: "'Lato'",           import: 'Manrope:wght@400;600;700&family=Lato:wght@400;700' },
  { id: 'urbanist-open', heading: "'Urbanist'",       body: "'Open Sans'",      import: 'Urbanist:wght@400;600;700&family=Open+Sans:wght@400;500' },
  { id: 'barlow-roboto', heading: "'Barlow'",         body: "'Roboto'",         import: 'Barlow:wght@400;600;700&family=Roboto:wght@400;500' },
  { id: 'space-dm',      heading: "'Space Grotesk'",  body: "'DM Sans'",        import: 'Space+Grotesk:wght@400;600;700&family=DM+Sans:wght@400;500' },
  { id: 'fraunces-nun',  heading: "'Fraunces'",       body: "'Nunito'",         import: 'Fraunces:wght@400;700&family=Nunito:wght@400;500' },
  { id: 'playfair-lato', heading: "'Playfair Display'",body: "'Lato'",          import: 'Playfair+Display:wght@400;700&family=Lato:wght@400;700' },
];

// ─── Spacing Scales (4) ─────────────────────────────────────
export const SPACING_SCALES = [
  { id: 'compact',  name: 'Compact',  section: '3rem',  gap: '1rem',    radius: '0.375rem' },
  { id: 'balanced', name: 'Balanced', section: '5rem',  gap: '1.5rem',  radius: '0.5rem'   },
  { id: 'airy',     name: 'Airy',     section: '7rem',  gap: '2rem',    radius: '0.75rem'  },
  { id: 'spacious', name: 'Spacious', section: '9rem',  gap: '2.5rem',  radius: '1rem'     },
];

// ─── Layout Modes (4) ───────────────────────────────────────
export const LAYOUT_MODES = [
  { id: 'centered',     maxWidth: '720px',  heroAlign: 'center' },
  { id: 'left-aligned', maxWidth: '820px',  heroAlign: 'left'   },
  { id: 'wide',         maxWidth: '1080px', heroAlign: 'center' },
  { id: 'narrow',       maxWidth: '600px',  heroAlign: 'center' },
];

// ─── Shadow Depths (3) ──────────────────────────────────────
export const SHADOW_DEPTHS = [
  { id: 'flat',     card: 'none',                             btn: 'none'                               },
  { id: 'subtle',   card: '0 1px 3px rgba(0,0,0,0.08)',      btn: '0 2px 4px rgba(0,0,0,0.12)'        },
  { id: 'elevated', card: '0 4px 16px rgba(0,0,0,0.10)',     btn: '0 4px 12px rgba(0,0,0,0.18)'       },
];

/**
 * Resolve theme tokens from IDs or random selection
 * @param {object} cfg - { colorId, fontId, spacingId, layoutId, shadowId }
 * @returns {object} resolved theme tokens
 */
export function resolveTheme(cfg = {}) {
  const color   = COLOR_PALETTES.find(c => c.id === cfg.colorId)   || rand(COLOR_PALETTES);
  const font    = FONT_PAIRS.find(f => f.id === cfg.fontId)         || rand(FONT_PAIRS);
  const spacing = SPACING_SCALES.find(s => s.id === cfg.spacingId)  || rand(SPACING_SCALES);
  const layout  = LAYOUT_MODES.find(l => l.id === cfg.layoutId)     || rand(LAYOUT_MODES);
  const shadow  = SHADOW_DEPTHS.find(s => s.id === cfg.shadowId)    || rand(SHADOW_DEPTHS);

  const [ph, ps, pl] = color.p;
  const [ah, as_, al] = color.a;
  const [bgh, bgs, bgl] = color.bg;
  const [fgh, fgs, fgl] = color.fg;

  return {
    color, font, spacing, layout, shadow,
    // Computed CSS values
    colorPrimary:      `hsl(${ph} ${ps}% ${pl}%)`,
    colorPrimaryDark:  `hsl(${ph} ${ps}% ${Math.max(pl-10,10)}%)`,
    colorPrimaryLight: `hsl(${ph} ${ps}% ${Math.min(pl+35,95)}%)`,
    colorAccent:       `hsl(${ah} ${as_}% ${al}%)`,
    colorBg:           `hsl(${bgh} ${bgs}% ${bgl}%)`,
    colorFg:           `hsl(${fgh} ${fgs}% ${fgl}%)`,
    colorMuted:        `hsl(${fgh} ${fgs}% ${fgl+30}%)`,
    colorBorder:       `hsl(${ph} ${ps}% ${pl+40}%)`,
    fontHeading:       font.heading,
    fontBody:          font.body,
    fontImport:        font.import,
    sectionPadding:    spacing.section,
    gap:               spacing.gap,
    radius:            spacing.radius,
    maxWidth:          layout.maxWidth,
    heroAlign:         layout.heroAlign,
    cardShadow:        shadow.card,
    btnShadow:         shadow.btn,
  };
}

/**
 * Generate CSS :root block from theme tokens
 */
export function generateThemeCSS(theme) {
  return `
:root {
  --color-primary:       ${theme.colorPrimary};
  --color-primary-dark:  ${theme.colorPrimaryDark};
  --color-primary-light: ${theme.colorPrimaryLight};
  --color-accent:        ${theme.colorAccent};
  --color-bg:            ${theme.colorBg};
  --color-fg:            ${theme.colorFg};
  --color-muted:         ${theme.colorMuted};
  --color-border:        ${theme.colorBorder};
  --font-heading:        ${theme.fontHeading}, system-ui, sans-serif;
  --font-body:           ${theme.fontBody}, system-ui, sans-serif;
  --section-padding:     ${theme.sectionPadding};
  --gap:                 ${theme.gap};
  --radius:              ${theme.radius};
  --max-width:           ${theme.maxWidth};
  --hero-align:          ${theme.heroAlign};
  --card-shadow:         ${theme.cardShadow};
  --btn-shadow:          ${theme.btnShadow};
}`;
}

/**
 * Total theme combination count
 */
export function getThemeCombinationCount() {
  return COLOR_PALETTES.length * FONT_PAIRS.length * SPACING_SCALES.length * LAYOUT_MODES.length * SHADOW_DEPTHS.length;
  // 15 × 10 × 4 × 4 × 3 = 7,200
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
