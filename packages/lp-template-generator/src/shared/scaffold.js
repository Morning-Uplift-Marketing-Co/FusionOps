/**
 * Shared Astro Scaffold
 * =====================
 * Generates the non-page files that EVERY template needs:
 * - package.json (astro 5.x, zero extra deps)
 * - astro.config.mjs (static output, inline CSS)
 * - tsconfig.json
 * 
 * WHY THIS EXISTS:
 * The #1 cause of "white page" / "CSS broken" was templates
 * generating different package.json or astro configs.
 * Now every template gets the EXACT same base.
 */

/**
 * Generate base Astro project files
 * @param {{ brand: string, domain: string }} config
 * @returns {object} files map
 */
export function generateScaffold(config) {
  const slug = config.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return {
    'package.json': JSON.stringify({
      name: `${slug}-lp`,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'astro dev',
        build: 'astro build',
        preview: 'astro preview',
      },
      dependencies: {
        astro: '^5.2.0',
      },
    }, null, 2),

    'astro.config.mjs': [
      `import { defineConfig } from 'astro/config';`,
      ``,
      `export default defineConfig({`,
      `  output: 'static',`,
      `  site: 'https://${config.domain}',`,
      `  build: {`,
      `    assets: '_a',`,
      `    inlineStylesheets: 'always',`,
      `  },`,
      `  compressHTML: true,`,
      `});`,
    ].join('\n'),

    'tsconfig.json': JSON.stringify({
      extends: 'astro/tsconfigs/strict',
    }, null, 2),

    'public/robots.txt': [
      'User-agent: *',
      'Disallow: /',
      '',
      `Sitemap: https://${config.domain}/sitemap.xml`,
    ].join('\n'),

    'public/favicon.svg': [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
      `  <rect width="32" height="32" rx="6" fill="${config.primary || '#3b82f6'}"/>`,
      `  <text x="16" y="22" text-anchor="middle" fill="white" font-family="sans-serif" font-size="16" font-weight="bold">${(config.brand || 'L')[0]}</text>`,
      '</svg>',
    ].join('\n'),
  };
}
