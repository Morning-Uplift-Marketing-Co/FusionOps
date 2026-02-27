/**
 * Installment Loans V1 Template Generator
 * Standard installment loan LP with payment calculator, multi-step form,
 * trust badges, FAQ — zero external JS frameworks
 */

import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const brand = site.brand || "InstallmentPro";
  const domain = site.domain || "example.com";
  const h1 = site.h1 || "Fixed Monthly Payments You Can Count On";
  const sub = site.sub || "Personal installment loans from $500 to $10,000. Predictable payments, no surprises.";
  const cta = site.cta || "Check My Rate";
  const badge = site.badge || "Trusted by 25,000+ borrowers";
  const loanLabel = site.loanLabel || "Installment Loans";
  const amountMin = site.amountMin || 500;
  const amountMax = site.amountMax || 10000;
  const aprMin = site.aprMin || 5.99;
  const aprMax = site.aprMax || 35.99;

  // Tracking configs from Wizard Step 5
  const aid = site.aid || "14881";
  const network = site.network || "LeadsGate";
  const redirectUrl = site.redirectUrl || "#";
  const voluumId = site.voluumId || "";
  const voluumDomain = site.voluumDomain || "";
  const conversionId = site.conversionId || "";
  const formStartLabel = site.formStartLabel || "Form Start";
  const formSubmitLabel = site.formSubmitLabel || "Form Submit";

  // Color helpers
  const pH = c.p[0], pS = c.p[1], pL = c.p[2];
  const primary = `${pH} ${pS}% ${pL}%`;
  const primaryDark = `${pH} ${pS}% ${Math.max(pL - 12, 10)}%`;
  const sH = c.s[0], sS = c.s[1], sL = c.s[2];
  const secondary = `${sH} ${sS}% ${sL}%`;
  const aH = c.a[0], aS = c.a[1], aL = c.a[2];
  const accent = `${aH} ${aS}% ${aL}%`;

  const files = {};

  // ─── package.json ────────────────────────────────────────
  files["package.json"] = JSON.stringify({
    name: brand.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-lp",
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
    inlineStylesheets: 'always',
  },
});
`;

  // ─── src/pages/index.astro ────────────────────────────────
  files["src/pages/index.astro"] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${brand} — ${loanLabel} $${amountMin.toLocaleString()}-$${amountMax.toLocaleString()}</title>
    <meta name="description" content="${sub}" />
    <link rel="canonical" href="https://${domain}" />

    <!-- Open Graph -->
    <meta property="og:title" content="${brand} — ${loanLabel}" />
    <meta property="og:description" content="${sub}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://${domain}" />

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=${f.import}" rel="stylesheet" />

    <!-- Schema.org -->
    <script type="application/ld+json">
    {
      "@context":"https://schema.org",
      "@type":"FinancialProduct",
      "name":"${brand} ${loanLabel}",
      "description":"${sub}",
      "provider":{"@type":"FinancialService","name":"${brand}","url":"https://${domain}"},
      "annualPercentageRate":{"@type":"QuantitativeValue","minValue":${aprMin},"maxValue":${aprMax},"unitCode":"P1"},
      "amount":{"@type":"MonetaryAmount","minValue":${amountMin},"maxValue":${amountMax},"currency":"USD"},
      "feesAndCommissionsSpecification":"No hidden fees. APR varies based on creditworthiness."
    }
    </script>

    <!-- Tracking: dataLayer + globals -->
    <script>
      window.dataLayer = window.dataLayer || [];
      window.aid = "${aid}";
      window.network = "${network}";
      window.conversionId = "${conversionId}";
      window.formStartLabel = "${formStartLabel}";
      window.formSubmitLabel = "${formSubmitLabel}";
      window.redirectUrl = "${redirectUrl}";
    </script>

${conversionId ? `    <!-- Google Ads gtag -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${conversionId}"></script>
    <script>
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${conversionId}');
    </script>` : ''}

${voluumId ? `    <!-- Voluum -->
    <script>
      var _vs = document.createElement('script');
      _vs.src = 'https://${voluumDomain || 'track.vlm.icu'}/scripts/${voluumId}/vp.js';
      document.head.appendChild(_vs);
    </script>` : ''}

    <style>
      *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
      :root {
        --primary: hsl(${primary});
        --primary-dark: hsl(${primaryDark});
        --secondary: hsl(${secondary});
        --accent: hsl(${accent});
        --bg: hsl(${c.bg[0]} ${c.bg[1]}% ${c.bg[2]}%);
        --fg: hsl(${c.fg[0]} ${c.fg[1]}% ${c.fg[2]}%);
        --muted: #64748b;
        --border: #e2e8f0;
        --card: #ffffff;
        --radius: 12px;
      }
      html { scroll-behavior:smooth; }
      body {
        font-family: ${f.family};
        line-height:1.6; color:var(--fg); background:var(--bg);
        -webkit-font-smoothing:antialiased;
      }
      .container { max-width:1140px; margin:0 auto; padding:0 20px; }
      a { color:inherit; text-decoration:none; }

      /* ── HEADER ─────────────────────────── */
      .header {
        position:fixed; top:0; left:0; right:0; z-index:50;
        background:rgba(255,255,255,0.92); backdrop-filter:blur(12px);
        border-bottom:1px solid var(--border); height:64px;
      }
      .header-inner { display:flex; align-items:center; justify-content:space-between; height:64px; }
      .logo { font-size:20px; font-weight:800; color:var(--fg); }
      .logo span { color:var(--primary); }
      .header-cta {
        display:inline-flex; align-items:center; gap:6px;
        background:var(--primary); color:#fff; padding:10px 20px;
        border-radius:8px; font-size:14px; font-weight:700;
        transition:all 0.2s; border:none; cursor:pointer;
      }
      .header-cta:hover { background:var(--primary-dark); transform:scale(1.02); }

      /* ── HERO ───────────────────────────── */
      .hero {
        padding:120px 20px 80px; position:relative; overflow:hidden;
        background:linear-gradient(135deg, hsl(${primary}) 0%, hsl(${primaryDark}) 100%);
        color:#fff;
      }
      .hero::before {
        content:''; position:absolute; top:-50%; right:-20%; width:600px; height:600px;
        border-radius:50%; background:rgba(255,255,255,0.04); pointer-events:none;
      }
      .hero-grid { display:grid; grid-template-columns:1fr 1fr; gap:48px; align-items:center; }
      .hero-badge {
        display:inline-flex; align-items:center; gap:8px;
        background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2);
        padding:8px 16px; border-radius:50px; font-size:14px; font-weight:600; margin-bottom:20px;
      }
      .hero-badge-dot { width:8px; height:8px; border-radius:50%; background:hsl(${accent}); animation:pulse 2s infinite; }
      @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(0.7)} }
      .hero h1 { font-size:clamp(2rem,4.5vw,3.2rem); font-weight:800; line-height:1.1; margin-bottom:16px; }
      .hero h1 em { font-style:normal; color:hsl(${accent}); }
      .hero-sub { font-size:18px; opacity:0.85; margin-bottom:24px; max-width:480px; }
      .hero-checks { display:flex; flex-wrap:wrap; gap:16px; }
      .hero-check { display:flex; align-items:center; gap:6px; font-size:14px; opacity:0.8; }
      .hero-check svg { width:18px; height:18px; color:hsl(${accent}); flex-shrink:0; }

      /* ── HERO FORM ─────────────────────── */
      .hero-form {
        background:rgba(255,255,255,0.95); backdrop-filter:blur(8px);
        border-radius:20px; padding:28px; box-shadow:0 24px 48px rgba(0,0,0,0.15);
        color:var(--fg);
      }
      .hero-form h3 { font-size:18px; font-weight:700; margin-bottom:16px; text-align:center; }
      .amount-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
      .amt-btn {
        padding:10px; border-radius:8px; font-size:14px; font-weight:600;
        border:2px solid var(--border); background:#fff; cursor:pointer;
        transition:all 0.15s; color:var(--fg);
      }
      .amt-btn.active { background:var(--primary); color:#fff; border-color:var(--primary); }
      .amt-btn:hover:not(.active) { border-color:var(--primary); color:var(--primary); }
      .form-slider {
        width:100%; height:6px; border-radius:3px; background:var(--border);
        -webkit-appearance:none; appearance:none; cursor:pointer; margin:8px 0 4px;
      }
      .form-slider::-webkit-slider-thumb {
        -webkit-appearance:none; width:22px; height:22px; border-radius:50%;
        background:var(--primary); border:3px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.15);
        cursor:pointer;
      }
      .slider-labels { display:flex; justify-content:space-between; font-size:12px; color:var(--muted); margin-bottom:16px; }
      .slider-labels .current { font-size:16px; font-weight:700; color:var(--fg); }
      .form-group { margin-bottom:12px; }
      .form-group label { display:block; font-size:13px; font-weight:600; margin-bottom:4px; color:var(--fg); }
      .form-input {
        width:100%; height:44px; padding:0 14px; border:2px solid var(--border);
        border-radius:8px; font-size:15px; transition:border-color 0.2s;
        background:#fff; color:var(--fg);
      }
      .form-input:focus { outline:none; border-color:var(--primary); }
      .form-input.error { border-color:#ef4444; }
      .form-error { font-size:12px; color:#ef4444; margin-top:2px; display:none; }
      .form-error.show { display:block; }
      .submit-btn {
        width:100%; height:52px; border:none; border-radius:10px;
        background:linear-gradient(135deg, hsl(${accent}) 0%, hsl(${aH} ${aS}% ${Math.max(aL-10,20)}%) 100%);
        color:#fff; font-size:17px; font-weight:700; cursor:pointer;
        transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:8px;
        box-shadow:0 4px 14px hsl(${accent} / 0.35);
      }
      .submit-btn:hover { transform:scale(1.02); box-shadow:0 6px 20px hsl(${accent} / 0.45); }
      .submit-btn:disabled { opacity:0.6; cursor:wait; }
      .form-trust { text-align:center; font-size:12px; color:var(--muted); margin-top:12px; }
      .form-trust svg { width:14px; height:14px; vertical-align:-2px; margin-right:4px; color:hsl(${secondary}); }

      /* ── SOCIAL PROOF BAR ──────────────── */
      .proof-bar { background:var(--card); border-bottom:1px solid var(--border); padding:16px 0; }
      .proof-inner { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:24px; }
      .proof-item { display:flex; align-items:center; gap:8px; font-size:14px; color:var(--muted); }
      .proof-item strong { color:var(--fg); }
      .proof-stars { color:#f59e0b; font-size:16px; }
      .proof-divider { width:1px; height:24px; background:var(--border); }

      /* ── SECTION COMMON ────────────────── */
      .section { padding:80px 20px; }
      .section-alt { background:#f8fafc; }
      .section-title { text-align:center; margin-bottom:48px; }
      .section-label {
        display:inline-block; padding:6px 14px; border-radius:50px;
        font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;
        margin-bottom:12px;
      }
      .section-title h2 { font-size:clamp(1.75rem,3vw,2.5rem); font-weight:800; color:var(--fg); margin-bottom:8px; }
      .section-title p { color:var(--muted); max-width:560px; margin:0 auto; }

      /* ── HOW IT WORKS ──────────────────── */
      .steps-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; max-width:900px; margin:0 auto; }
      .step-card {
        background:var(--card); border:1px solid var(--border); border-radius:16px;
        padding:28px; text-align:center; transition:all 0.3s;
      }
      .step-card:hover { box-shadow:0 8px 24px rgba(0,0,0,0.06); transform:translateY(-2px); }
      .step-icon {
        width:56px; height:56px; border-radius:14px; margin:0 auto 16px;
        display:flex; align-items:center; justify-content:center;
      }
      .step-icon svg { width:28px; height:28px; }
      .step-num {
        width:28px; height:28px; border-radius:50%; color:#fff; font-size:13px; font-weight:700;
        display:flex; align-items:center; justify-content:center;
        margin:-14px auto 8px; box-shadow:0 2px 6px rgba(0,0,0,0.15);
      }
      .step-card h3 { font-size:17px; font-weight:700; margin-bottom:6px; }
      .step-card p { font-size:14px; color:var(--muted); }

      /* ── CALCULATOR ────────────────────── */
      .calc-card {
        max-width:680px; margin:0 auto; background:var(--card); border:1px solid var(--border);
        border-radius:20px; padding:32px; box-shadow:0 4px 12px rgba(0,0,0,0.04);
      }
      .calc-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
      .calc-amount { font-size:28px; font-weight:800; }
      .calc-tiers { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:24px; }
      .tier {
        border:1px solid var(--border); border-radius:14px; padding:20px; text-align:center;
        transition:all 0.2s; position:relative;
      }
      .tier:hover { border-color:var(--primary); }
      .tier.featured {
        background:hsl(${secondary} / 0.06); border-color:hsl(${secondary} / 0.3);
        box-shadow:0 0 0 1px hsl(${secondary} / 0.15);
      }
      .tier-badge {
        position:absolute; top:-10px; left:50%; transform:translateX(-50%);
        background:linear-gradient(135deg, hsl(${secondary}), hsl(${sH} ${sS}% ${Math.max(sL-8,15)}%));
        color:#fff; font-size:11px; font-weight:700; padding:3px 10px; border-radius:50px;
      }
      .tier-label { font-size:13px; font-weight:600; color:var(--muted); margin-bottom:4px; }
      .tier-amount { font-size:28px; font-weight:800; }
      .tier-amount small { font-size:14px; font-weight:400; color:var(--muted); }
      .tier-apr { font-size:12px; color:var(--muted); margin-top:4px; }
      .calc-cta { text-align:center; margin-top:24px; }
      .calc-cta a {
        display:inline-flex; align-items:center; gap:8px;
        background:var(--primary); color:#fff; padding:14px 28px;
        border-radius:10px; font-size:16px; font-weight:700;
        transition:all 0.2s;
      }
      .calc-cta a:hover { background:var(--primary-dark); transform:scale(1.02); }

      /* ── FEATURES ──────────────────────── */
      .feat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
      .feat-card {
        background:var(--card); border:1px solid var(--border); border-radius:14px;
        padding:24px; text-align:center; transition:all 0.3s;
      }
      .feat-card:hover { box-shadow:0 6px 18px rgba(0,0,0,0.06); transform:translateY(-2px); }
      .feat-icon {
        width:48px; height:48px; border-radius:12px;
        display:flex; align-items:center; justify-content:center; margin:0 auto 12px;
      }
      .feat-icon svg { width:24px; height:24px; }
      .feat-card h3 { font-size:15px; font-weight:700; margin-bottom:4px; }
      .feat-card p { font-size:13px; color:var(--muted); }

      /* ── TESTIMONIALS ──────────────────── */
      .testi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
      .testi-card {
        background:var(--card); border:1px solid var(--border); border-radius:16px;
        padding:24px; transition:all 0.3s;
      }
      .testi-card:hover { box-shadow:0 6px 18px rgba(0,0,0,0.06); transform:translateY(-2px); }
      .testi-header { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
      .testi-avatar {
        width:44px; height:44px; border-radius:50%; color:#fff;
        display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px;
      }
      .testi-name { font-weight:600; font-size:14px; }
      .testi-loc { font-size:12px; color:var(--muted); }
      .testi-text { font-size:14px; color:var(--muted); line-height:1.6; }
      .testi-stars { color:#f59e0b; margin-top:10px; font-size:14px; }

      /* ── FAQ ────────────────────────────── */
      .faq-list { max-width:640px; margin:0 auto; }
      .faq-item {
        border:1px solid var(--border); border-radius:12px; background:var(--card);
        margin-bottom:8px; overflow:hidden; transition:all 0.2s;
      }
      .faq-item:hover { border-color:hsl(${primary} / 0.3); }
      .faq-item[open] { border-color:hsl(${primary} / 0.2); background:hsl(${primary} / 0.02); }
      .faq-q {
        list-style:none; padding:18px 20px; cursor:pointer;
        display:flex; align-items:center; justify-content:space-between;
        font-size:15px; font-weight:600;
      }
      .faq-q::-webkit-details-marker { display:none; }
      .faq-q::marker { display:none; content:''; }
      .faq-q svg { width:18px; height:18px; color:var(--muted); transition:transform 0.2s; flex-shrink:0; }
      .faq-item[open] .faq-q svg { transform:rotate(180deg); }
      .faq-a { padding:0 20px 18px; font-size:14px; color:var(--muted); line-height:1.7; }

      /* ── FINAL CTA ─────────────────────── */
      .final-cta {
        padding:80px 20px; text-align:center; color:#fff; position:relative; overflow:hidden;
        background:linear-gradient(135deg, hsl(${primary}) 0%, hsl(${primaryDark}) 100%);
      }
      .final-cta h2 { font-size:clamp(1.75rem,3.5vw,2.75rem); font-weight:800; margin-bottom:12px; }
      .final-cta p { font-size:18px; opacity:0.8; margin-bottom:28px; }
      .final-cta-btn {
        display:inline-flex; align-items:center; gap:10px;
        background:linear-gradient(135deg, hsl(${accent}), hsl(${aH} ${aS}% ${Math.max(aL-10,20)}%));
        color:#fff; padding:18px 36px; border-radius:14px;
        font-size:20px; font-weight:700; transition:all 0.2s;
        box-shadow:0 6px 20px hsl(${accent} / 0.4);
      }
      .final-cta-btn:hover { transform:scale(1.04); box-shadow:0 10px 30px hsl(${accent} / 0.5); }
      .final-cta-note { font-size:13px; opacity:0.6; margin-top:14px; }

      /* ── FOOTER ─────────────────────────── */
      .footer { background:var(--card); border-top:1px solid var(--border); padding:48px 20px; }
      .footer-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:32px; margin-bottom:32px; }
      .footer-brand { font-size:18px; font-weight:800; margin-bottom:8px; }
      .footer-brand span { color:var(--primary); }
      .footer-desc { font-size:13px; color:var(--muted); line-height:1.6; }
      .footer-col h4 { font-size:13px; font-weight:700; margin-bottom:10px; }
      .footer-col a { display:block; font-size:13px; color:var(--muted); padding:3px 0; transition:color 0.15s; }
      .footer-col a:hover { color:var(--fg); }
      .footer-compliance { border-top:1px solid var(--border); padding-top:24px; }
      .footer-compliance p { font-size:11px; color:var(--muted); line-height:1.7; margin-bottom:8px; }
      .footer-copyright { border-top:1px solid var(--border); padding-top:16px; margin-top:16px; text-align:center; font-size:12px; color:var(--muted); }

      /* ── RESPONSIVE ─────────────────────── */
      @media (max-width:768px) {
        .hero { padding:100px 20px 60px; }
        .hero-grid { grid-template-columns:1fr; text-align:center; }
        .hero-checks { justify-content:center; }
        .hero-sub { margin-left:auto; margin-right:auto; }
        .steps-grid { grid-template-columns:1fr; max-width:360px; }
        .feat-grid { grid-template-columns:1fr 1fr; }
        .testi-grid { grid-template-columns:1fr; max-width:400px; margin:0 auto; }
        .calc-tiers { grid-template-columns:1fr; }
        .footer-grid { grid-template-columns:1fr 1fr; }
        .proof-divider { display:none; }
        .amount-grid { grid-template-columns:repeat(2,1fr); }
      }
    </style>
  </head>
  <body>
    <!-- HEADER -->
    <header class="header">
      <div class="container header-inner">
        <a href="/" class="logo">${brand.split(/(?=[A-Z])/).length > 1 ? brand.replace(/([A-Z])/g, '<span>$1</span>').replace('<span>' + brand[0], brand[0]) : brand}</a>
        <a href="#apply" class="header-cta">
          ${cta}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </div>
    </header>

    <!-- HERO -->
    <section class="hero" id="apply">
      <div class="container">
        <div class="hero-grid">
          <div>
            <div class="hero-badge">
              <span class="hero-badge-dot"></span>
              ${badge}
            </div>
            <h1>${h1}</h1>
            <p class="hero-sub">${sub}</p>
            <div class="hero-checks">
              <div class="hero-check">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span>Fixed Monthly Payments</span>
              </div>
              <div class="hero-check">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span>All Credit Types</span>
              </div>
              <div class="hero-check">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span>No Prepayment Penalty</span>
              </div>
            </div>
          </div>

          <!-- FORM -->
          <div>
            <form class="hero-form" id="heroForm">
              <h3>How much do you need?</h3>
              <div class="amount-grid" id="amountBtns">
                <button type="button" data-amount="1000" class="amt-btn">$1,000</button>
                <button type="button" data-amount="2500" class="amt-btn">$2,500</button>
                <button type="button" data-amount="5000" class="amt-btn active">$5,000</button>
                <button type="button" data-amount="${amountMax}" class="amt-btn">$${amountMax.toLocaleString()}</button>
              </div>
              <input type="range" class="form-slider" id="amountSlider" min="${amountMin}" max="${amountMax}" step="100" value="5000" />
              <div class="slider-labels">
                <span>$${amountMin.toLocaleString()}</span>
                <span class="current" id="amountDisplay">$5,000</span>
                <span>$${amountMax.toLocaleString()}</span>
              </div>
              <div class="form-group">
                <label for="zip">ZIP Code</label>
                <input type="text" class="form-input" id="zip" inputmode="numeric" maxlength="5" placeholder="e.g. 90210" required />
                <div class="form-error" id="zipError">Please enter a valid 5-digit ZIP code</div>
              </div>
              <button type="submit" class="submit-btn" id="submitBtn">
                <span>${cta}</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
              <div class="form-trust">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                Won't affect your credit score
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>

    <!-- SOCIAL PROOF -->
    <div class="proof-bar">
      <div class="container">
        <div class="proof-inner">
          <div class="proof-item"><strong>25,000+</strong> loans funded</div>
          <div class="proof-divider"></div>
          <div class="proof-item"><span class="proof-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span> <strong>4.8/5</strong> rating</div>
          <div class="proof-divider"></div>
          <div class="proof-item">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="hsl(${secondary})"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            <strong>256-bit</strong> encryption
          </div>
        </div>
      </div>
    </div>

    <!-- HOW IT WORKS -->
    <section class="section section-alt" id="how-it-works">
      <div class="container">
        <div class="section-title">
          <span class="section-label" style="background:hsl(${primary} / 0.06);color:var(--primary)">How It Works</span>
          <h2>Get Funded in 3 Simple Steps</h2>
          <p>No paperwork. No waiting in line. Everything happens online.</p>
        </div>
        <div class="steps-grid">
          <div class="step-card">
            <div class="step-icon" style="background:hsl(${primary} / 0.1)">
              <svg style="color:var(--primary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div class="step-num" style="background:var(--primary)">1</div>
            <h3>Apply Online</h3>
            <p>Fill out our simple 2-minute form. No impact on your credit score.</p>
          </div>
          <div class="step-card">
            <div class="step-icon" style="background:hsl(${secondary} / 0.1)">
              <svg style="color:var(--secondary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="step-num" style="background:var(--secondary)">2</div>
            <h3>Choose Your Terms</h3>
            <p>Select from multiple offers with different rates and repayment periods.</p>
          </div>
          <div class="step-card">
            <div class="step-icon" style="background:hsl(${accent} / 0.1)">
              <svg style="color:var(--accent)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div class="step-num" style="background:var(--accent)">3</div>
            <h3>Get Funded</h3>
            <p>Accept your offer and receive funds as fast as the next business day.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CALCULATOR -->
    <section class="section" id="calculator">
      <div class="container">
        <div class="section-title">
          <span class="section-label" style="background:hsl(${accent} / 0.06);color:var(--accent)">Payment Calculator</span>
          <h2>Estimate Your Monthly Payment</h2>
          <p>See how affordable your installment loan could be.</p>
        </div>
        <div class="calc-card">
          <div class="calc-header">
            <span style="font-size:14px;color:var(--muted)">Loan Amount</span>
            <span class="calc-amount" id="calcAmount">$5,000</span>
          </div>
          <input type="range" class="form-slider" id="calcSlider" min="${Math.max(amountMin, 500)}" max="${amountMax}" step="100" value="5000" />
          <div class="slider-labels">
            <span>$${Math.max(amountMin, 500).toLocaleString()}</span>
            <span>$${amountMax.toLocaleString()}</span>
          </div>
          <div class="calc-tiers">
            <div class="tier featured">
              <span class="tier-badge">Best Value</span>
              <div class="tier-label">6 Months</div>
              <div class="tier-amount">$<span id="t6">856</span><small>/mo</small></div>
              <div class="tier-apr">${aprMin}% APR</div>
            </div>
            <div class="tier">
              <div class="tier-label">12 Months</div>
              <div class="tier-amount">$<span id="t12">440</span><small>/mo</small></div>
              <div class="tier-apr">15% APR</div>
            </div>
            <div class="tier">
              <div class="tier-label">24 Months</div>
              <div class="tier-amount">$<span id="t24">240</span><small>/mo</small></div>
              <div class="tier-apr">${aprMax}% APR</div>
            </div>
          </div>
          <div class="calc-cta">
            <a href="#apply">Get My Personalized Rate
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- FEATURES -->
    <section class="section section-alt" id="features">
      <div class="container">
        <div class="section-title">
          <span class="section-label" style="background:hsl(${secondary} / 0.06);color:var(--secondary)">Why ${brand}</span>
          <h2>Built Around Trust</h2>
        </div>
        <div class="feat-grid">
          <div class="feat-card">
            <div class="feat-icon" style="background:hsl(${primary} / 0.1)">
              <svg style="color:var(--primary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h3>Fast Decisions</h3>
            <p>Get your decision in minutes, not days.</p>
          </div>
          <div class="feat-card">
            <div class="feat-icon" style="background:hsl(${secondary} / 0.1)">
              <svg style="color:var(--secondary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3>No Hidden Fees</h3>
            <p>Transparent terms with clear pricing.</p>
          </div>
          <div class="feat-card">
            <div class="feat-icon" style="background:hsl(${accent} / 0.1)">
              <svg style="color:var(--accent)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3>All Credit Types</h3>
            <p>Lenders who consider all histories.</p>
          </div>
          <div class="feat-card">
            <div class="feat-icon" style="background:hsl(${primary} / 0.1)">
              <svg style="color:var(--primary)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <h3>Direct Deposit</h3>
            <p>Funds straight to your bank account.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- TESTIMONIALS -->
    <section class="section" id="testimonials">
      <div class="container">
        <div class="section-title">
          <span class="section-label" style="background:hsl(${primary} / 0.06);color:var(--primary)">Customer Stories</span>
          <h2>Trusted by Thousands</h2>
          <p>See what our customers are saying about their experience.</p>
        </div>
        <div class="testi-grid">
          <div class="testi-card">
            <div class="testi-header">
              <div class="testi-avatar" style="background:linear-gradient(135deg,#3b82f6,#8b5cf6)">JM</div>
              <div><div class="testi-name">John M.</div><div class="testi-loc">Verified &bull; Texas</div></div>
            </div>
            <div class="testi-text">"The fixed payments made budgeting easy. Got approved in 2 minutes and funds hit my account the next day."</div>
            <div class="testi-stars">&#9733;&#9733;&#9733;&#9733;&#9733; 5.0</div>
          </div>
          <div class="testi-card">
            <div class="testi-header">
              <div class="testi-avatar" style="background:linear-gradient(135deg,#10b981,#14b8a6)">SK</div>
              <div><div class="testi-name">Sarah K.</div><div class="testi-loc">Verified &bull; California</div></div>
            </div>
            <div class="testi-text">"I compared rates from multiple lenders and found one much better than my credit card. Highly recommend!"</div>
            <div class="testi-stars">&#9733;&#9733;&#9733;&#9733;&#9733; 5.0</div>
          </div>
          <div class="testi-card">
            <div class="testi-header">
              <div class="testi-avatar" style="background:linear-gradient(135deg,#f97316,#ef4444)">RM</div>
              <div><div class="testi-name">Robert M.</div><div class="testi-loc">Verified &bull; Florida</div></div>
            </div>
            <div class="testi-text">"Was skeptical at first but they delivered. Clear terms, no surprises, and great customer service throughout."</div>
            <div class="testi-stars">&#9733;&#9733;&#9733;&#9733;&#9733; 5.0</div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="section section-alt" id="faq">
      <div class="container">
        <div class="section-title">
          <span class="section-label" style="background:hsl(${primary} / 0.06);color:var(--primary)">FAQ</span>
          <h2>Common Questions</h2>
        </div>
        <div class="faq-list">
          <details class="faq-item" open>
            <summary class="faq-q">
              <span>What is an installment loan?</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="faq-a">An installment loan is a type of loan that is repaid over time with a set number of scheduled payments. Unlike revolving credit, you get a lump sum upfront and repay it in fixed monthly installments.</div>
          </details>
          <details class="faq-item">
            <summary class="faq-q">
              <span>Will checking my rate affect my credit?</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="faq-a">No. We use a soft credit inquiry which does not affect your credit score. A hard inquiry only occurs if you accept an offer and proceed with a lender.</div>
          </details>
          <details class="faq-item">
            <summary class="faq-q">
              <span>How much can I borrow?</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="faq-a">Loan amounts range from $${amountMin.toLocaleString()} to $${amountMax.toLocaleString()} depending on your state, credit profile, and lender terms.</div>
          </details>
          <details class="faq-item">
            <summary class="faq-q">
              <span>What are the repayment terms?</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="faq-a">Repayment terms typically range from 6 to 24 months. APR ranges from ${aprMin}% to ${aprMax}% depending on your credit profile, loan amount, and selected term.</div>
          </details>
          <details class="faq-item">
            <summary class="faq-q">
              <span>Can I repay my loan early?</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="faq-a">Yes! Most lenders allow early repayment without prepayment penalties, saving you money on interest charges.</div>
          </details>
          <details class="faq-item">
            <summary class="faq-q">
              <span>What do I need to apply?</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="faq-a">You must be 18+, have a valid U.S. bank account, a steady source of income, and a valid email and phone number.</div>
          </details>
        </div>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section class="final-cta">
      <div class="container">
        <h2>Ready to Get Started?</h2>
        <p>Join thousands who've found a smarter way to borrow.</p>
        <a href="#apply" class="final-cta-btn">
          ${cta} Now
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
        <div class="final-cta-note">No impact on your credit score &bull; 100% free to check</div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-brand">${brand}</div>
            <p class="footer-desc">Connecting you with trusted lenders for ${loanLabel.toLowerCase()} up to $${amountMax.toLocaleString()}. Fixed payments, transparent terms.</p>
          </div>
          <div class="footer-col">
            <h4>Company</h4>
            <a href="#how-it-works">How It Works</a>
            <a href="#calculator">Calculator</a>
            <a href="#faq">FAQ</a>
          </div>
          <div class="footer-col">
            <h4>Legal</h4>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="/disclosures">Disclosures</a>
          </div>
          <div class="footer-col">
            <h4>Support</h4>
            <a href="mailto:support@${domain}">Contact Us</a>
            <a href="/licensing">Licensing</a>
          </div>
        </div>
        <div class="footer-compliance">
          <p><strong>Representative Example:</strong> A $5,000 loan repaid over 12 monthly installments at 15% APR would result in 12 monthly payments of $451.29. Total amount payable: $5,415.48. Total interest: $415.48.</p>
          <p><strong>APR Disclosure:</strong> Annual Percentage Rate (APR) ranges from ${aprMin}% to ${aprMax}%. APR depends on credit score, loan amount, loan term, credit usage and history. Only the most creditworthy applicants qualify for the lowest rates.</p>
          <p>${brand} is NOT a lender and does not make loan or credit decisions. ${brand} connects interested persons with a lender from its network of approved lenders. Not all lenders can provide loan amounts up to $${amountMax.toLocaleString()}. Cash transfer times may vary. Repayment terms vary by lender and local laws.</p>
          <p>Loans issued by WebBank, Member FDIC. Checking your rate won't affect your credit score.</p>
        </div>
        <div class="footer-copyright">&copy; ${new Date().getFullYear()} ${brand}. All rights reserved.</div>
      </div>
    </footer>

    <!-- SCRIPTS -->
    <script>
      // ── Amount Selector ─────────────────────
      (function(){
        var amount = 5000;
        var slider = document.getElementById('amountSlider');
        var display = document.getElementById('amountDisplay');
        var btns = document.querySelectorAll('.amt-btn');
        var form = document.getElementById('heroForm');
        var zipInput = document.getElementById('zip');
        var zipErr = document.getElementById('zipError');
        var submitBtn = document.getElementById('submitBtn');

        function fmt(n){ return '$' + n.toLocaleString(); }

        function setAmount(v){
          amount = v;
          slider.value = v;
          display.textContent = fmt(v);
          btns.forEach(function(b){
            b.classList.toggle('active', parseInt(b.dataset.amount) === v);
          });
        }

        btns.forEach(function(b){
          b.addEventListener('click', function(){ setAmount(parseInt(b.dataset.amount)); });
        });
        slider.addEventListener('input', function(){ setAmount(parseInt(slider.value)); });

        zipInput.addEventListener('input', function(){
          zipInput.value = zipInput.value.replace(/\\D/g,'').slice(0,5);
          zipErr.classList.remove('show');
          zipInput.classList.remove('error');
        });

        form.addEventListener('submit', function(e){
          e.preventDefault();
          var zip = zipInput.value;
          if(!/^\\d{5}$/.test(zip)){
            zipErr.classList.add('show');
            zipInput.classList.add('error');
            return;
          }
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Finding your best rate...</span>';

          // Tracking: form_start
          window.dataLayer.push({ event:'form_start', conversion_value:amount, currency:'USD' });
${conversionId && formStartLabel ? `          if(typeof gtag==='function') gtag('event','conversion',{send_to:'${conversionId}/${formStartLabel}',value:amount,currency:'USD'});` : ''}

          // Redirect after brief delay
          setTimeout(function(){
            var p = new URLSearchParams(window.location.search);
            p.set('amount', amount);
            p.set('zip', zip);
            window.location.href = (window.redirectUrl && window.redirectUrl !== '#')
              ? window.redirectUrl + '?' + p.toString()
              : '/apply?' + p.toString();
          }, 800);
        });
      })();

      // ── Calculator ──────────────────────────
      (function(){
        var slider = document.getElementById('calcSlider');
        var display = document.getElementById('calcAmount');
        var t6 = document.getElementById('t6');
        var t12 = document.getElementById('t12');
        var t24 = document.getElementById('t24');

        function calc(amt, months, apr){
          if(apr === 0) return Math.round(amt / months);
          var r = apr / 100 / 12;
          return Math.round((amt * r * Math.pow(1+r,months)) / (Math.pow(1+r,months)-1));
        }

        function update(){
          var a = parseInt(slider.value);
          display.textContent = '$' + a.toLocaleString();
          t6.textContent = calc(a, 6, ${aprMin}).toLocaleString();
          t12.textContent = calc(a, 12, 15).toLocaleString();
          t24.textContent = calc(a, 24, ${aprMax}).toLocaleString();
        }

        slider.addEventListener('input', update);
        update();
      })();

      // ── Page View Tracking ──────────────────
      window.dataLayer.push({ event:'page_view', page:'${brand}', aid:window.aid, network:window.network });
    </script>
  </body>
</html>`;

  // ─── README.md ─────────────────────────────────────────────
  files["README.md"] = `# ${brand} — ${loanLabel}

An installment loan landing page template with payment calculator, multi-step form, trust badges, and full tracking.

## Features

- **Hero + Form**: Amount selector with slider, ZIP code validation
- **Payment Calculator**: Interactive 3-tier (6/12/24 months) with live calculation
- **Social Proof**: Stats bar, testimonials
- **Trust Signals**: Feature cards, security badges
- **FAQ**: Accordion-style, SEO-friendly
- **Compliance Footer**: Full APR disclosure, representative example
- **Tracking**: Zero-GTM architecture — gtag.js (Google Ads), Voluum, dataLayer

## Configuration

- **Brand**: ${brand}
- **Domain**: ${domain}
- **Primary Color**: ${c.name || 'Custom'}
- **Font**: ${f.name}
- **Loan Range**: $${amountMin.toLocaleString()} – $${amountMax.toLocaleString()}
- **APR Range**: ${aprMin}% – ${aprMax}%
- **AID**: ${aid}
- **Network**: ${network}

## Deploy

\`\`\`bash
npm install
npm run build
# Upload dist/ to Cloudflare Pages, Netlify, or Vercel
\`\`\`

## Tracking Events

- \`page_view\` — on page load
- \`form_start\` — on form submit (secondary conversion)
- \`form_submit\` — on apply page submit (primary conversion)
`;

  return files;
}
