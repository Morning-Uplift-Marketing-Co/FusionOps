// ============================================================
// Astro Configuration — LP Factory Lander
// ============================================================
// Static output only. No SSR. No hydration.
// ============================================================

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',

  site: process.env.SITE_URL || 'https://example.com',

  vite: {
    plugins: [tailwindcss()],
    build: {
      // Keep JS minimal
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  },

  integrations: [
    sitemap(),
    compress({
      CSS: true,
      HTML: {
        removeAttributeQuotes: false,
        removeComments: true,
      },
      Image: false,  // We handle images separately (WebP only)
      JavaScript: true,
      SVG: true,
    }),
  ],

  // No prefetch — minimal JS
  prefetch: false,
});
