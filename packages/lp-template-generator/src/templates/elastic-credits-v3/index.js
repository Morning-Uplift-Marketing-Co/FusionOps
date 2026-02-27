/**
 * My Custom Template Generator
 */

import previewHtml from './preview.html?raw';
import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  // ดึงค่า config จาก Wizard
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const brand = site.brand || "MyBrand";
  const domain = site.domain || "example.com";
  const h1 = site.h1 || "Welcome to " + brand;
  const sub = site.sub || "Get started today";
  const cta = site.cta || "Apply Now";
  
  // Tracking configs
  const aid = site.aid || "14881";
  const network = site.network || "LeadsGate";
  const redirectUrl = site.redirectUrl || "#";
  const voluumId = site.voluumId || "";
  const conversionId = site.conversionId || "";

  const files = {};

  // ─── package.json ────────────────────────────────────────
  files["package.json"] = JSON.stringify({
    name: brand.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "astro dev",
      build: "astro build",
      preview: "astro preview",
    },
    dependencies: {
      astro: "^5.2.0",
    },
  }, null, 2);

  // ─── astro.config.mjs ────────────────────────────────────
  files["astro.config.mjs"] = `import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://${domain}',
  build: {
    assets: '_assets',
  },
});
`;

  // ─── src/pages/index.astro ────────────────────────────────
  files["src/pages/index.astro"] = previewHtml;

  // เพิ่มไฟล์อื่นๆ ตาม template ของคุณ...
  
  return files;
}