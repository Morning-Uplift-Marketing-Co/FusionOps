/**
 * Simple LP Template Generator
 * Minimal template with tracking support
 * Perfect example for adding custom templates
 */

import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  // Config from Wizard
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const brand = site.brand || "SimpleLP";
  const domain = site.domain || "example.com";
  const h1 = site.h1 || "Get Started Today";
  const sub = site.sub || "Simple, fast, and effective.";
  const cta = site.cta || "Apply Now";
  const badge = site.badge || "";

  // Tracking configs from Wizard Step 5
  const aid = site.aid || "14881";
  const network = site.network || "LeadsGate";
  const redirectUrl = site.redirectUrl || "#";
  const voluumId = site.voluumId || "";
  const voluumDomain = site.voluumDomain || "";
  const conversionId = site.conversionId || "";
  const formStartLabel = site.formStartLabel || "Form Start";
  const formSubmitLabel = site.formSubmitLabel || "Form Submit";

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
  files["src/pages/index.astro"] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${brand}</title>
    <meta name="description" content="${sub}" />

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=${f.import}&display=swap" rel="stylesheet">

    <!-- Inline Styles -->
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: '${f.family.replace(/"/g, '')}', system-ui, sans-serif;
        line-height: 1.6;
        color: #1a1a1a;
      }
      .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
      .hero {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        background: linear-gradient(135deg, hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}%) 0%, hsl(${c.p[0]} ${c.p[1]}% ${c.s[2]}%) 100%);
        color: white;
        padding: 40px 20px;
      }
      h1 { font-size: clamp(2rem, 5vw, 4rem); font-weight: 800; margin-bottom: 20px; line-height: 1.1; }
      .subtitle { font-size: clamp(1rem, 2vw, 1.25rem); margin-bottom: 30px; opacity: 0.95; }
      .badge {
        display: inline-block;
        background: rgba(255,255,255,0.2);
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 20px;
      }
      .cta-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: hsl(${c.a[0]} ${c.a[1]}% ${c.a[2]}%);
        color: white;
        padding: 16px 32px;
        border-radius: 12px;
        font-size: 18px;
        font-weight: 700;
        text-decoration: none;
        transition: all 0.2s;
        border: none;
        cursor: pointer;
      }
      .cta-button:hover { transform: scale(1.05); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
      .features {
        padding: 80px 20px;
        background: #f8f9fa;
      }
      .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 30px;
        max-width: 1000px;
        margin: 0 auto;
      }
      .feature-card {
        background: white;
        padding: 30px;
        border-radius: 16px;
        text-align: center;
      }
      .feature-icon { font-size: 40px; margin-bottom: 16px; }
      .feature-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
      .feature-desc { color: #666; font-size: 14px; }

      /* Form Styles */
      .lead-form {
        max-width: 400px;
        margin: 30px auto 0;
        background: white;
        padding: 24px;
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      }
      .form-group { margin-bottom: 16px; }
      .form-input {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 16px;
        transition: border-color 0.2s;
      }
      .form-input:focus { outline: none; border-color: hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}%); }
      .disclaimer {
        padding: 40px 20px;
        text-align: center;
        font-size: 12px;
        color: #666;
        background: #f8f9fa;
      }
    </style>

    <!-- GTM dataLayer -->
    <script>
      window.dataLayer = window.dataLayer || [];
    </script>

    <!-- LeadsGate Tracking -->
    <script>
      window.aid = "${aid}";
      window.network = "${network}";
      window.conversionId = "${conversionId}";
      window.formStartLabel = "${formStartLabel}";
      window.formSubmitLabel = "${formSubmitLabel}";
      window.redirectUrl = "${redirectUrl}";
    </script>

    ${voluumId ? `
    <!-- Voluum Tracking Script -->
    <script>
      (function(w,d,s,l,i){
        w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
        var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
        j.async=true;j.src='https://${voluumDomain || voluumId + ".trck.pch"}/webp/e.js?v='+i;
        f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${voluumId}');
    </script>` : ''}
  </head>
  <body>
    <!-- Hero Section -->
    <section class="hero">
      <div class="container">
        ${badge ? `<div class="badge">${badge}</div>` : ''}
        <h1>${h1}</h1>
        <p class="subtitle">${sub}</p>

        <!-- Lead Form -->
        <form class="lead-form" id="leadForm" onsubmit="handleFormSubmit(event)">
          <div class="form-group">
            <input
              type="email"
              class="form-input"
              placeholder="Enter your email"
              required
              name="email"
            />
          </div>
          <button type="submit" class="cta-button">
            ${cta} →
          </button>
        </form>

        <p style="font-size: 12px; opacity: 0.8; margin-top: 16px;">
          🔒 Secure · No credit card required
        </p>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features">
      <div class="container">
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">⚡</div>
            <div class="feature-title">Fast Approval</div>
            <div class="feature-desc">Get approved in minutes, not days</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <div class="feature-title">Secure & Private</div>
            <div class="feature-desc">Your data is always protected</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">💰</div>
            <div class="feature-title">Transparent Pricing</div>
            <div class="feature-desc">No hidden fees or surprises</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="disclaimer">
      <div class="container">
        <p>© ${new Date().getFullYear()} ${brand}. All rights reserved.</p>
      </div>
    </footer>

    <!-- Form & Tracking Script -->
    <script>
      function handleFormSubmit(e) {
        e.preventDefault();

        var form = e.target;
        var email = form.email.value;

        // Tracking: Form Start Event
        if (window.dataLayer) {
          window.dataLayer.push({
            event: window.formStartLabel || 'form_start',
            conversion_id: window.conversionId,
            aid: window.aid,
            network: window.network,
            email: email
          });
        }

        // Tracking: Conversion Event
        if (window.dataLayer) {
          window.dataLayer.push({
            event: window.formSubmitLabel || 'generate_lead',
            conversion_id: window.conversionId,
            aid: window.aid,
            network: window.network,
            email: email
          });
        }

        // Show success message
        form.innerHTML = '<div style="color:#22c55e;font-size:18px;font-weight:600;padding:20px;">✓ Application Started!</div>';

        // Redirect after delay
        setTimeout(function() {
          window.location.href = window.redirectUrl;
        }, 1500);
      }

      // Track page view
      if (window.dataLayer) {
        window.dataLayer.push({
          event: 'page_view',
          page: '${brand}',
          aid: window.aid,
          network: window.network
        });
      }
    </script>
  </body>
</html>`;

  // ─── README.md ─────────────────────────────────────────────
  files["README.md"] = `# ${brand} — Simple LP

A minimal landing page template with full tracking support.

## Features

- **Clean Design**: Minimal, conversion-focused layout
- **Full Tracking**: LeadsGate AID, Voluum, GTM support
- **Responsive**: Works on all devices
- **Zero JS Framework**: Pure HTML/CSS/JS for maximum performance

## Configuration

This template uses the following settings from Wizard:

- **Brand**: ${brand}
- **Domain**: ${domain}
- **Primary Color**: ${c.name}
- **Font**: ${f.name}
- **Tracking**:
  - AID: ${aid}
  - Network: ${network}
  - Redirect URL: ${redirectUrl || "(set in Wizard)"}
  - Voluum ID: ${voluumId || "(optional)"}

## Deploy

\`\`\`bash
npm install
npm run build
# Upload dist/ folder to your host
\`\`\`

## Tracking Events

- \`page_view\` - Fired on page load
- \`form_start\` - Fired when form is submitted
- \`generate_lead\` - Conversion event
`;

  return files;
}
