import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: `https://${process.env.PUBLIC_DOMAIN || 'example.com'}`,
});
