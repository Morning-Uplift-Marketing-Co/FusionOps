import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'static',
  integrations: [tailwind()],
  build: {
    inlineStylesheets: 'always',
  },
  vite: {
    build: {
      cssMinify: true,
      minify: 'esbuild',
      assetsInlineLimit: 2048,
      rollupOptions: {
        output: {
          manualChunks: undefined,
          assetFileNames: '_astro/[name].[hash][extname]',
          chunkFileNames: '_astro/[name].[hash].js',
          entryFileNames: '_astro/[name].[hash].js',
        },
      },
    },
    esbuild: {
      drop: ['console', 'debugger'],
      legalComments: 'none',
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
    },
  },
});
