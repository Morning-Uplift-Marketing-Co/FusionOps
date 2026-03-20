/**
 * Unified Color System
 * ====================
 * Single source of truth for color schemes across all templates.
 *
 * Each scheme has 5 HSL color tokens:
 *   --primary, --secondary, --accent, --background, --foreground
 *
 * Used by:
 *   - Tailwind config (bg-primary, text-primary, etc.)
 *   - CSS variable injection at build/deploy time
 *   - template-router.js for preview
 *   - Layout.astro for Astro templates
 */

export const COLOR_SCHEMES = [
  { id: "ocean",    name: "Ocean Trust",      p: [217,91,35],  s: [158,64,42], a: [15,92,62],   bg: [210,40,98], fg: [222,47,11] },
  { id: "forest",   name: "Forest Green",     p: [152,68,28],  s: [45,93,47],  a: [350,80,55],  bg: [140,20,97], fg: [150,40,10] },
  { id: "midnight", name: "Midnight Indigo",  p: [235,70,42],  s: [170,60,45], a: [25,95,58],   bg: [230,25,97], fg: [235,50,12] },
  { id: "ruby",     name: "Ruby Finance",     p: [350,75,38],  s: [200,70,45], a: [40,90,55],   bg: [350,15,97], fg: [350,40,12] },
  { id: "slate",    name: "Slate Modern",     p: [215,25,35],  s: [160,50,42], a: [15,85,55],   bg: [210,15,97], fg: [215,30,12] },
  { id: "coral",    name: "Coral Warm",       p: [12,76,42],   s: [185,60,40], a: [265,65,55],  bg: [20,30,97],  fg: [15,40,12] },
  { id: "teal",     name: "Teal Pro",         p: [180,65,30],  s: [280,55,55], a: [35,90,55],   bg: [175,20,97], fg: [180,40,10] },
  { id: "plum",     name: "Plum Finance",     p: [270,55,40],  s: [150,55,42], a: [20,88,58],   bg: [270,15,97], fg: [270,40,12] },
];

const DEFAULT_SCHEME = "ocean";

/**
 * Get a color scheme by ID
 * @param {string} colorId
 * @returns {object} scheme with p, s, a, bg, fg arrays
 */
export function getColorScheme(colorId) {
  return COLOR_SCHEMES.find(c => c.id === colorId) || COLOR_SCHEMES.find(c => c.id === DEFAULT_SCHEME);
}

/**
 * Format HSL array to CSS string: "217 91% 35%"
 */
export function hsl(arr) {
  return `${arr[0]} ${arr[1]}% ${arr[2]}%`;
}

/**
 * Generate CSS :root variables for a color scheme
 * @param {string} colorId
 * @param {string} [radiusValue] - e.g. "0.75rem"
 * @returns {string} CSS string like ":root { --primary: 217 91% 35%; ... }"
 */
export function getCSSVariables(colorId, radiusValue) {
  const scheme = getColorScheme(colorId);
  const vars = [
    `--primary:${hsl(scheme.p)}`,
    `--color-primary:${hsl(scheme.p)}`,
    `--secondary:${hsl(scheme.s)}`,
    `--accent:${hsl(scheme.a)}`,
    `--background:${hsl(scheme.bg)}`,
    `--foreground:${hsl(scheme.fg)}`,
  ];
  if (radiusValue) vars.push(`--radius:${radiusValue}`);
  return `:root{${vars.join(';')}}`;
}

/**
 * Tailwind theme colors config that maps to CSS variables.
 * Use in tailwind.config.base.mjs:
 *   import { tailwindColorTheme } from './unified-colors.js';
 *   export default { theme: { extend: { colors: tailwindColorTheme } } }
 */
export const tailwindColorTheme = {
  primary: {
    DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
    foreground: 'hsl(var(--foreground) / <alpha-value>)',
  },
  secondary: {
    DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
  },
  accent: {
    DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
  },
  background: 'hsl(var(--background) / <alpha-value>)',
  foreground: 'hsl(var(--foreground) / <alpha-value>)',
};
