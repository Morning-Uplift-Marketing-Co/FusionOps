/**
 * Shared Tailwind Base Config
 * ===========================
 * ALL LP templates should extend this config.
 *
 * Usage in template's tailwind.config.mjs:
 *   import baseConfig from '../../packages/lp-template-generator/tailwind.config.base.mjs';
 *   export default { ...baseConfig, content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'] };
 *
 * This maps CSS variables (--primary, --secondary, etc.) to Tailwind classes:
 *   bg-primary, text-primary, border-primary, ring-primary, etc.
 *
 * Colors come from unified-colors.js and are injected via :root CSS vars.
 */
export default {
  theme: {
    extend: {
      colors: {
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
      },
      borderRadius: {
        DEFAULT: 'var(--radius, 0.75rem)',
      },
    },
  },
  plugins: [],
};
