import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';

try {
  const isHostedBuild = Boolean(process.env.NETLIFY || process.env.CI);
  const lockPath = path.resolve(process.cwd(), '.env.lock');
  if (!isHostedBuild && fs.existsSync(lockPath)) {
    const raw = fs.readFileSync(lockPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
    if (!process.env.VITE_CF_API_TOKEN && process.env.VITE_CF_ACCOUNT_API) {
      process.env.VITE_CF_API_TOKEN = process.env.VITE_CF_ACCOUNT_API;
    }
    if (!process.env.VITE_CF_API_TOKEN && process.env.CF_API_TOKEN) {
      process.env.VITE_CF_API_TOKEN = process.env.CF_API_TOKEN;
    }
  }
} catch (_e) {
}

// Get API base URL from environment or use default
const API_BASE = process.env.VITE_API_BASE || 'https://lp-factory-api.misty-feather-556e.workers.dev';

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      port: 4323,
      host: true,
      fs: { allow: ['../..', '.'] },
      proxy: {
        '/api': {
          target: API_BASE.replace(/\/api$/, ''),
          changeOrigin: true,
          secure: false,
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
          "connect-src 'self' https: http: ws: wss:",
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
