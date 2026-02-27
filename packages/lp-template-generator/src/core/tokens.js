/**
 * Design Tokens v2
 * ================
 * Centralized color + font definitions.
 * Templates ONLY use these — no hardcoded colors allowed.
 */

export const COLORS = {
  blue:   { name: 'Ocean Blue',    p: [210, 80, 52], s: [200, 70, 45], a: [180, 60, 45] },
  ruby:   { name: 'Ruby Red',      p: [350, 85, 62], s: [350, 75, 48], a: [40, 90, 55] },
  green:  { name: 'Forest Green',  p: [150, 70, 40], s: [140, 60, 45], a: [170, 60, 40] },
  purple: { name: 'Royal Purple',  p: [270, 70, 50], s: [260, 60, 48], a: [290, 60, 45] },
  orange: { name: 'Sunset Orange', p: [25, 90, 55],  s: [30, 80, 50],  a: [40, 85, 50] },
  teal:   { name: 'Teal',          p: [174, 72, 40], s: [180, 60, 35], a: [45, 85, 55] },
  slate:  { name: 'Slate',         p: [215, 25, 40], s: [220, 20, 50], a: [40, 90, 55] },
};

export const FONTS = {
  'dm-sans':       { name: 'DM Sans',       family: "'DM Sans', system-ui, sans-serif",       import: 'DM+Sans:wght@400;500;600;700' },
  'inter':         { name: 'Inter',          family: "'Inter', system-ui, sans-serif",          import: 'Inter:wght@400;500;600;700' },
  'space-grotesk': { name: 'Space Grotesk',  family: "'Space Grotesk', system-ui, sans-serif",  import: 'Space+Grotesk:wght@400;500;600;700' },
  'plus-jakarta':  { name: 'Plus Jakarta',   family: "'Plus Jakarta Sans', system-ui, sans-serif", import: 'Plus+Jakarta+Sans:wght@400;500;600;700;800' },
  'outfit':        { name: 'Outfit',         family: "'Outfit', system-ui, sans-serif",         import: 'Outfit:wght@400;500;600;700;800' },
};

/**
 * Resolve design tokens from config
 * Returns CSS-ready values
 */
export function resolveTokens(config) {
  const c = COLORS[config.colorId] || COLORS.blue;
  const f = FONTS[config.fontId] || FONTS['dm-sans'];

  const [pH, pS, pL] = c.p;
  const [sH, sS, sL] = c.s;
  const [aH, aS, aL] = c.a;

  return {
    // Color CSS values
    primary:      `hsl(${pH}, ${pS}%, ${pL}%)`,
    primaryDark:  `hsl(${pH}, ${pS}%, ${Math.max(pL - 12, 10)}%)`,
    primaryLight: `hsl(${pH}, ${pS}%, ${Math.min(pL + 8, 90)}%)`,
    primaryGlow:  `hsla(${pH}, ${pS}%, ${pL}%, 0.25)`,
    secondary:    `hsl(${sH}, ${sS}%, ${sL}%)`,
    accent:       `hsl(${aH}, ${aS}%, ${aL}%)`,
    accentLight:  `hsl(${aH}, ${aS}%, ${Math.min(aL + 10, 90)}%)`,
    accentGlow:   `hsla(${aH}, ${aS}%, ${aL}%, 0.3)`,
    accentDark:   `hsl(${aH}, ${Math.max(aS - 10, 0)}%, ${Math.max(aL - 10, 10)}%)`,

    // Raw HSL for inline usage
    pH, pS, pL, aH, aS, aL,

    // Font
    fontFamily: f.family,
    fontImport: f.import,

    // Color name (for readme)
    colorName: c.name,
  };
}
