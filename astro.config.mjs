import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

// Get API base URL from environment or use default
const API_BASE = process.env.VITE_API_BASE || 'https://lp-factory-api.songsawat-w.workers.dev';

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: API_BASE.replace(/\/api$/, ''),
          changeOrigin: true,
          secure: true,
        },
      },
      headers: {
        // Content Security Policy headers for dev server
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https:",
          "frame-ancestors 'none'",
        ].join('; '),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
    ssr: {
      noExternal: [],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src/templates/astrodeck-main/src', import.meta.url)),
        '#lp-template-generator': fileURLToPath(new URL('./packages/lp-template-generator/src', import.meta.url)),
      },
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    },
  },
});
