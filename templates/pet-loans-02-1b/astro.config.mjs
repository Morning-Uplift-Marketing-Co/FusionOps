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
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
    esbuild: {
      drop: ['console', 'debugger'],
    },
  },
});
