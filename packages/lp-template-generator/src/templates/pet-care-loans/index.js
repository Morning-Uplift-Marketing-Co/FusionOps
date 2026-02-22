
// Source: templates/pdl-loans-v3/index.js
// Copy this file to: packages/lp-template-generator/src/templates/pet-care-loans/index.js

/* TEMPLATE GENERATOR CODE - Read from source */
/**
 * NEW TEMPLATE: Based on pdl-loans-v3
 * Created: 2026-02-20T05:20:43.671Z
 *
 * INSTRUCTIONS:
 * 1. Create folder: packages/lp-template-generator/src/templates/YOUR-TEMPLATE-ID/
 * 2. Create index.js with this code
 * 3. Register in packages/lp-template-generator/src/templates/index.js
 * 4. Add to template-registry.js
 */

import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const brand = site.brand || "YourBrand";
  const domain = site.domain || "example.com";

  // TODO: Customize these based on your template needs
  const h1 = site.h1 || "Your Headline";
  const sub = site.sub || "Your subheadline";
  const cta = site.cta || "Get Started";

  const files = {};

  // ─── package.json ────────────────────────────────
  files["package.json"] = JSON.stringify({
    name: brand.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "astro dev",
      build: "astro build",
      preview: "astro preview"
    },
    dependencies: {
      astro: "^5.2.0"
    }
  }, null, 2);

  // ─── astro.config.mjs ─────────────────────────────
  files["astro.config.mjs"] = `import { defineConfig } from "astro/config";
export default defineConfig({
  output: "static",
  site: "https://${domain}"
});`;

  // ─── src/pages/index.astro ─────────────────────────
  files["src/pages/index.astro"] = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brand}</title>
  <style is:global>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${f.system}, system-ui, -apple-system, sans-serif;
      background: ${c.bg};
      color: ${c.text};
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    /* TODO: Add your custom styles here */
  </style>
</head>
<body>
  <section style="min-height: 100vh; display: flex; align-items: center; justify-content: center;">
    <div class="container" style="text-align: center;">
      <h1 style="font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; margin-bottom: 1rem;">
        ${h1}
      </h1>
      <p style="font-size: 1.25rem; color: ${c.muted}; margin-bottom: 2rem;">
        ${sub}
      </p>
      <button style="padding: 1rem 2.5rem; background: ${c.primary}; color: white; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: 700; cursor: pointer;">
        ${cta}
      </button>
    </div>
  </section>
</body>
</html>`;

  // TODO: Add more files as needed (public/assets, components, etc.)

  return files;
}

// Export metadata for the registry
export const metadata = {
  id: "YOUR-TEMPLATE-ID",
  name: "Your Template Name",
  description: "Brief description of what this template does",
  category: "general",
  features: ["hero-form"] // Add features: hero-form, calculator, faq, testimonials, etc.
};
