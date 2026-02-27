/**
 * Scratchpay Bridge Page Template
 * High-converting pet care financing landing page with claymorphism design
 * Features: Zip code hero input, payment calculator (3 tiers), modal system,
 *           short form with tracking, compliance footer
 */

import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS.find(x => x.id === 'green') || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS.find(x => x.id === 'dm-sans') || FONTS[0];
  const brand = site.brand || "Scratchpay";
  const domain = site.domain || "scratchpay.com";
  const h1 = site.h1 || "Flexible Pet Care Financing";
  const sub = site.sub || "Approved in seconds. No hard credit check.";
  const cta = site.cta || "Check Eligibility";
  const amountMin = site.amountMin || 200;
  const amountMax = site.amountMax || 10000;
  const aprMin = site.aprMin || 0;
  const aprMax = site.aprMax || 24.99;

  // Tracking configs
  const aid = site.aid || "14881";
  const network = site.network || "LeadsGate";
  const redirectUrl = site.redirectUrl || "#";
  const voluumId = site.voluumId || "";
  const voluumDomain = site.voluumDomain || "";
  const conversionId = site.conversionId || "";
  const formStartLabel = site.formStartLabel || "form_start";
  const formSubmitLabel = site.formSubmitLabel || "generate_lead_qualified";

  const files = {};

  // ─── package.json ───────────────────────────────────────────
  files["package.json"] = JSON.stringify({
    name: brand.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-bridge",
    private: true,
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

  // ─── astro.config.mjs ──────────────────────────────────────
  files["astro.config.mjs"] = `import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://${domain}',
  build: { assets: '_assets' },
});
`;

  // ─── src/pages/index.astro ──────────────────────────────────
  files["src/pages/index.astro"] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${brand} — ${h1} | $${amountMin}-$${amountMax}</title>
    <meta name="description" content="${sub}" />

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=${f.import}&display=swap" rel="stylesheet">

    <style>
      /* ═══ RESET & TOKENS ═══ */
      *{margin:0;padding:0;box-sizing:border-box}
      :root{
        --primary:${c.p[0]} ${c.p[1]}% ${c.p[2]}%;
        --primary-dark:${c.s[0]} ${c.s[1]}% ${c.s[2]}%;
        --accent:25 92% 53%;
        --accent-hover:25 92% 45%;
        --bg:0 0% 98%;
        --fg:222 47% 11%;
        --card:0 0% 100%;
        --muted:210 20% 94%;
        --muted-fg:215 16% 47%;
        --border:214 20% 88%;
        --success:152 76% 36%;
        --radius:20px;
        /* Claymorphism tokens */
        --clay-shadow:
          8px 8px 16px hsl(var(--fg)/0.06),
          -4px -4px 12px hsl(0 0% 100%/0.8),
          inset 0 1px 0 hsl(0 0% 100%/0.6);
        --clay-shadow-sm:
          4px 4px 10px hsl(var(--fg)/0.05),
          -2px -2px 8px hsl(0 0% 100%/0.7),
          inset 0 1px 0 hsl(0 0% 100%/0.5);
        --clay-shadow-hover:
          6px 6px 20px hsl(var(--fg)/0.08),
          -3px -3px 14px hsl(0 0% 100%/0.9),
          inset 0 1px 0 hsl(0 0% 100%/0.7);
      }
      body{
        font-family:'${f.family.replace(/"/g, '')}',system-ui,sans-serif;
        background:hsl(var(--bg));
        color:hsl(var(--fg));
        line-height:1.6;
        -webkit-font-smoothing:antialiased;
      }
      .container{max-width:1100px;margin:0 auto;padding:0 20px}

      /* ═══ CLAYMORPHISM CARD ═══ */
      .clay{
        background:hsl(var(--card));
        border-radius:var(--radius);
        box-shadow:var(--clay-shadow);
        border:1px solid hsl(var(--border)/0.5);
      }
      .clay:hover{box-shadow:var(--clay-shadow-hover)}
      .clay-sm{
        background:hsl(var(--card));
        border-radius:16px;
        box-shadow:var(--clay-shadow-sm);
        border:1px solid hsl(var(--border)/0.4);
      }

      /* ═══ BUTTONS ═══ */
      .btn{
        display:inline-flex;align-items:center;justify-content:center;gap:8px;
        padding:16px 32px;border-radius:14px;font-size:16px;font-weight:700;
        border:none;cursor:pointer;transition:all .2s;text-decoration:none;
      }
      .btn-accent{
        background:hsl(var(--accent));color:#fff;
        box-shadow:0 4px 14px hsl(var(--accent)/0.35);
      }
      .btn-accent:hover{background:hsl(var(--accent-hover));transform:translateY(-2px);box-shadow:0 6px 20px hsl(var(--accent)/0.4)}
      .btn-primary{
        background:hsl(var(--primary));color:#fff;
        box-shadow:0 4px 14px hsl(var(--primary)/0.3);
      }
      .btn-primary:hover{background:hsl(var(--primary-dark));transform:translateY(-2px)}
      .btn-ghost{background:transparent;color:hsl(var(--fg));border:2px solid hsl(var(--border))}
      .btn-ghost:hover{border-color:hsl(var(--primary));color:hsl(var(--primary))}
      .btn-full{width:100%}

      /* ═══ HEADER ═══ */
      header{
        position:sticky;top:0;z-index:100;
        background:hsl(var(--bg)/0.85);
        backdrop-filter:blur(12px);
        border-bottom:1px solid hsl(var(--border)/0.5);
      }
      header .container{display:flex;justify-content:space-between;align-items:center;height:64px}
      .logo{font-size:20px;font-weight:800;display:flex;align-items:center;gap:8px;color:hsl(var(--primary))}
      .logo svg{width:28px;height:28px}
      nav{display:flex;gap:24px}
      nav a{color:hsl(var(--muted-fg));text-decoration:none;font-weight:500;font-size:14px;transition:color .2s}
      nav a:hover{color:hsl(var(--primary))}
      @media(max-width:768px){nav{display:none}}

      /* ═══ HERO ═══ */
      .hero{
        padding:80px 20px 60px;
        text-align:center;
        background:linear-gradient(180deg,hsl(var(--primary)/0.06) 0%,hsl(var(--bg)) 100%);
      }
      .hero-badge{
        display:inline-flex;align-items:center;gap:8px;
        background:hsl(var(--success)/0.1);color:hsl(var(--success));
        padding:8px 18px;border-radius:100px;font-size:13px;font-weight:600;margin-bottom:20px;
      }
      .hero-badge::before{content:'';width:8px;height:8px;background:hsl(var(--success));border-radius:50%;animation:pulse 2s infinite}
      @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
      .hero h1{
        font-size:clamp(2.2rem,5vw,3.8rem);font-weight:900;line-height:1.1;margin-bottom:16px;
        background:linear-gradient(135deg,hsl(var(--fg)),hsl(var(--primary)));
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
      }
      .hero .sub{font-size:clamp(1rem,2vw,1.2rem);color:hsl(var(--muted-fg));max-width:520px;margin:0 auto 32px}
      .hero-tags{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:36px}
      .hero-tag{
        background:hsl(var(--card));padding:8px 16px;border-radius:100px;font-size:13px;font-weight:500;
        box-shadow:var(--clay-shadow-sm);border:1px solid hsl(var(--border)/0.3);
      }

      /* ═══ ZIP INPUT GROUP ═══ */
      .zip-group{
        display:flex;max-width:420px;margin:0 auto;
        border-radius:16px;overflow:hidden;
        box-shadow:var(--clay-shadow);
        border:2px solid hsl(var(--border)/0.5);
        background:hsl(var(--card));
        transition:border-color .2s;
      }
      .zip-group:focus-within{border-color:hsl(var(--primary))}
      .zip-group input{
        flex:1;padding:18px 20px;border:none;font-size:17px;font-weight:500;
        background:transparent;outline:none;color:hsl(var(--fg));
      }
      .zip-group input::placeholder{color:hsl(var(--muted-fg))}
      .zip-group button{
        padding:18px 28px;background:hsl(var(--accent));color:#fff;
        border:none;font-size:15px;font-weight:700;cursor:pointer;
        white-space:nowrap;transition:background .2s;
      }
      .zip-group button:hover{background:hsl(var(--accent-hover))}
      .zip-error{color:#ef4444;font-size:13px;margin-top:8px;display:none;text-align:center}

      /* ═══ TRUST BAR ═══ */
      .trust-bar{
        display:flex;gap:32px;justify-content:center;flex-wrap:wrap;
        padding:40px 20px;
      }
      .trust-item{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:hsl(var(--muted-fg))}
      .trust-item span:first-child{font-size:20px}

      /* ═══ CALCULATOR ═══ */
      .calculator{padding:80px 20px}
      .calculator h2{text-align:center;font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;margin-bottom:8px}
      .calculator .sub-text{text-align:center;color:hsl(var(--muted-fg));margin-bottom:40px;max-width:500px;margin-left:auto;margin-right:auto}
      .calc-card{max-width:800px;margin:0 auto;padding:40px}
      .calc-amount{text-align:center;font-size:48px;font-weight:900;color:hsl(var(--primary));margin-bottom:8px}
      .calc-label{text-align:center;font-size:14px;color:hsl(var(--muted-fg));margin-bottom:24px}
      input[type="range"]{
        width:100%;height:8px;border-radius:4px;background:hsl(var(--muted));
        outline:none;-webkit-appearance:none;margin-bottom:40px;
      }
      input[type="range"]::-webkit-slider-thumb{
        -webkit-appearance:none;width:28px;height:28px;border-radius:50%;
        background:hsl(var(--primary));cursor:pointer;
        box-shadow:0 2px 8px hsl(var(--primary)/0.3);
      }
      .tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
      @media(max-width:768px){.tiers{grid-template-columns:1fr}}
      .tier{
        padding:28px 20px;text-align:center;border-radius:16px;
        transition:all .25s;position:relative;
        background:hsl(var(--card));
        box-shadow:var(--clay-shadow-sm);
        border:2px solid hsl(var(--border)/0.4);
      }
      .tier:hover{transform:translateY(-4px);box-shadow:var(--clay-shadow-hover)}
      .tier.featured{border-color:hsl(var(--success));background:hsl(var(--success)/0.04)}
      .tier-badge{
        position:absolute;top:-12px;left:50%;transform:translateX(-50%);
        background:hsl(var(--success));color:#fff;padding:4px 14px;
        border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.5px;
      }
      .tier-label{font-size:13px;font-weight:600;color:hsl(var(--muted-fg));margin-bottom:6px}
      .tier-rate{font-size:15px;font-weight:700;margin-bottom:10px}
      .tier-payment{font-size:36px;font-weight:900;color:hsl(var(--primary))}
      .tier-payment small{font-size:15px;font-weight:600}
      .tier-detail{font-size:12px;color:hsl(var(--muted-fg));margin-top:10px}

      /* ═══ HOW IT WORKS ═══ */
      .how-it-works{padding:80px 20px;background:hsl(var(--muted)/0.5)}
      .how-it-works h2{text-align:center;font-size:clamp(1.8rem,4vw,2.5rem);font-weight:800;margin-bottom:48px}
      .steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:900px;margin:0 auto}
      @media(max-width:768px){.steps-grid{grid-template-columns:1fr}}
      .step-card{padding:32px 24px;text-align:center}
      .step-icon{font-size:40px;margin-bottom:16px}
      .step-num{
        display:inline-flex;align-items:center;justify-content:center;
        width:28px;height:28px;border-radius:50%;
        background:hsl(var(--primary));color:#fff;font-size:13px;font-weight:700;
        margin-bottom:12px;
      }
      .step-card h3{font-size:17px;font-weight:700;margin-bottom:8px}
      .step-card p{font-size:14px;color:hsl(var(--muted-fg))}

      /* ═══ TESTIMONIALS ═══ */
      .testimonials{padding:80px 20px}
      .testimonials h2{text-align:center;font-size:clamp(1.8rem,4vw,2.5rem);font-weight:800;margin-bottom:48px}
      .test-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:1000px;margin:0 auto}
      @media(max-width:768px){.test-grid{grid-template-columns:1fr}}
      .test-card{padding:28px}
      .test-stars{color:#f59e0b;margin-bottom:12px;font-size:16px}
      .test-text{font-size:15px;margin-bottom:16px;line-height:1.7}
      .test-author{font-size:13px;color:hsl(var(--muted-fg));font-weight:500}

      /* ═══ CTA BANNER ═══ */
      .cta-banner{
        margin:0 20px 80px;border-radius:24px;padding:60px 40px;text-align:center;
        background:linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary-dark)));color:#fff;
        box-shadow:0 20px 40px hsl(var(--primary)/0.25);
      }
      .cta-banner h2{font-size:clamp(1.8rem,4vw,2.5rem);font-weight:800;margin-bottom:12px}
      .cta-banner p{font-size:16px;opacity:.9;margin-bottom:28px;max-width:500px;margin-left:auto;margin-right:auto}
      .cta-banner .btn{background:#fff;color:hsl(var(--primary));font-size:17px;padding:18px 36px}
      .cta-banner .btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.2)}

      /* ═══ FOOTER ═══ */
      footer{background:hsl(222 47% 11%);color:#fff;padding:60px 20px 30px}
      .footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:40px}
      @media(max-width:768px){.footer-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:480px){.footer-grid{grid-template-columns:1fr}}
      footer h4{font-size:15px;font-weight:700;margin-bottom:16px}
      footer a{color:rgba(255,255,255,.65);text-decoration:none;display:block;margin-bottom:10px;font-size:14px;cursor:pointer;transition:color .2s}
      footer a:hover{color:#fff}
      .footer-brand{font-size:13px;color:rgba(255,255,255,.5);line-height:1.7;margin-top:8px}
      .footer-bottom{border-top:1px solid rgba(255,255,255,.08);padding-top:30px}
      .footer-compliance{font-size:12px;color:rgba(255,255,255,.4);line-height:1.8;max-width:800px;margin:0 auto;text-align:center}
      .footer-copy{text-align:center;font-size:13px;color:rgba(255,255,255,.35);margin-top:20px}

      /* ═══ MODAL ═══ */
      .modal-overlay{
        position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);
        z-index:1000;display:none;align-items:center;justify-content:center;
        opacity:0;transition:opacity .25s;
      }
      .modal-overlay.active{display:flex;opacity:1}
      .modal-box{
        background:hsl(var(--card));border-radius:24px;
        width:90%;max-width:520px;max-height:85vh;overflow-y:auto;
        padding:32px;position:relative;
        box-shadow:0 25px 60px rgba(0,0,0,.2);
        animation:modalIn .3s ease;
      }
      @keyframes modalIn{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}
      @media(max-width:640px){
        .modal-overlay.active{align-items:flex-end}
        .modal-box{
          border-radius:24px 24px 0 0;width:100%;max-width:100%;
          max-height:90vh;padding:24px 20px 32px;
          animation:sheetIn .3s ease;
        }
        @keyframes sheetIn{from{transform:translateY(100%)}to{transform:none}}
        .modal-box::before{
          content:'';display:block;width:40px;height:4px;
          background:hsl(var(--border));border-radius:2px;
          margin:0 auto 20px;
        }
      }
      .modal-close{
        position:absolute;top:16px;right:16px;
        width:32px;height:32px;border-radius:50%;border:none;
        background:hsl(var(--muted));cursor:pointer;font-size:18px;
        display:flex;align-items:center;justify-content:center;
        transition:background .2s;
      }
      .modal-close:hover{background:hsl(var(--border))}
      .modal-title{font-size:22px;font-weight:800;margin-bottom:20px}

      /* ═══ FORM MODAL ═══ */
      .form-group{margin-bottom:16px}
      .form-group label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:hsl(var(--muted-fg))}
      .form-group input{
        width:100%;padding:14px 16px;border:2px solid hsl(var(--border));
        border-radius:12px;font-size:15px;transition:border-color .2s;
        background:hsl(var(--bg));color:hsl(var(--fg));
      }
      .form-group input:focus{outline:none;border-color:hsl(var(--primary))}
      .form-error{color:#ef4444;font-size:12px;margin-top:4px;display:none}
      .form-success{text-align:center;padding:40px 0}
      .form-success .icon{font-size:56px;margin-bottom:12px}
      .form-success h3{font-size:20px;font-weight:700;color:hsl(var(--success));margin-bottom:8px}
      .form-success p{color:hsl(var(--muted-fg));font-size:14px}

      /* ═══ INFO MODAL CONTENT ═══ */
      .info-steps{display:flex;flex-direction:column;gap:20px}
      .info-step{display:flex;gap:16px;align-items:flex-start}
      .info-step-num{
        flex-shrink:0;width:36px;height:36px;border-radius:50%;
        background:hsl(var(--primary)/0.1);color:hsl(var(--primary));
        display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;
      }
      .info-step h4{font-size:15px;font-weight:700;margin-bottom:4px}
      .info-step p{font-size:13px;color:hsl(var(--muted-fg))}
      .info-faq-item{border-bottom:1px solid hsl(var(--border));padding:16px 0}
      .info-faq-item:last-child{border:none}
      .info-faq-item h4{font-size:15px;font-weight:600;margin-bottom:6px}
      .info-faq-item p{font-size:13px;color:hsl(var(--muted-fg));line-height:1.7}
    </style>

    <!-- GTM dataLayer -->
    <script>window.dataLayer=window.dataLayer||[];</script>

    <!-- Tracking Config -->
    <script>
      window.aid="${aid}";
      window.network="${network}";
      window.conversionId="${conversionId}";
      window.formStartLabel="${formStartLabel}";
      window.formSubmitLabel="${formSubmitLabel}";
      window.redirectUrl="${redirectUrl}";
    </script>

    ${voluumId ? `<script>
      (function(w,d,s,l,i){
        w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
        var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
        j.async=true;j.src='https://${voluumDomain || voluumId + ".trck.pch"}/webp/e.js?v='+i;
        f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${voluumId}');
    </script>` : ''}
  </head>
  <body>
    <!-- ═══ HEADER ═══ -->
    <header>
      <div class="container">
        <div class="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5M8 14v.5M16 14v.5M11.25 16.25h1.5L12 17l-.75-.75z"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"/></svg>
          <span>${brand}</span>
        </div>
        <nav>
          <a href="#calculator">Calculator</a>
          <a data-modal="how-it-works">How It Works</a>
          <a data-modal="faq">FAQ</a>
          <a data-modal="for-vets">For Veterinarians</a>
        </nav>
        <button class="btn btn-accent" style="padding:10px 20px;font-size:13px" data-open-form>Get Started</button>
      </div>
    </header>

    <!-- ═══ HERO ═══ -->
    <section class="hero">
      <div class="hero-badge">Trusted by 10,000+ pet parents</div>
      <h1>${h1}</h1>
      <p class="sub">${sub}</p>
      <div class="hero-tags">
        <span class="hero-tag">🐾 All Vet Clinics</span>
        <span class="hero-tag">⚡ Instant Decision</span>
        <span class="hero-tag">🔒 No Hard Credit Check</span>
        <span class="hero-tag">💳 0% Interest Plans</span>
      </div>
      <div class="zip-group" id="heroZipGroup">
        <input type="text" id="heroZip" placeholder="Enter your zip code" maxlength="5" inputmode="numeric" autocomplete="postal-code">
        <button type="button" id="heroZipBtn">${cta} →</button>
      </div>
      <div class="zip-error" id="heroZipError">Please enter a valid 5-digit zip code</div>
    </section>

    <!-- ═══ TRUST BAR ═══ -->
    <div class="trust-bar">
      <div class="trust-item"><span>🏥</span> 15,000+ Vet Partners</div>
      <div class="trust-item"><span>⭐</span> 4.9/5 Rating</div>
      <div class="trust-item"><span>🔒</span> 256-bit Encryption</div>
      <div class="trust-item"><span>⏱️</span> 60-Second Approval</div>
    </div>

    <!-- ═══ PAYMENT CALCULATOR ═══ -->
    <section class="calculator" id="calculator">
      <h2>See Your Payment Plan</h2>
      <p class="sub-text">Slide to choose your treatment cost and see instant options</p>
      <div class="calc-card clay">
        <div class="calc-amount" id="calcAmount">$2,000</div>
        <div class="calc-label">Treatment Cost</div>
        <input type="range" id="calcSlider" min="${amountMin}" max="${amountMax}" step="50" value="2000">
        <div class="tiers">
          <div class="tier featured" id="tier1">
            <div class="tier-badge">0% INTEREST</div>
            <div class="tier-label">Pay in 5</div>
            <div class="tier-rate" style="color:hsl(var(--success))">0% APR</div>
            <div class="tier-payment" id="t1pay">$400<small>/mo</small></div>
            <div class="tier-detail" id="t1detail">$0 interest · $2,000 total</div>
          </div>
          <div class="tier" id="tier2">
            <div class="tier-label">12 Months</div>
            <div class="tier-rate">14.99% APR</div>
            <div class="tier-payment" id="t2pay">$180<small>/mo</small></div>
            <div class="tier-detail" id="t2detail">$160 interest · $2,160 total</div>
          </div>
          <div class="tier" id="tier3">
            <div class="tier-label">24 Months</div>
            <div class="tier-rate">24.99% APR</div>
            <div class="tier-payment" id="t3pay">$106<small>/mo</small></div>
            <div class="tier-detail" id="t3detail">$544 interest · $2,544 total</div>
          </div>
        </div>
        <div style="text-align:center;margin-top:32px">
          <button class="btn btn-accent btn-full" style="max-width:360px" data-open-form>Apply for This Amount →</button>
        </div>
      </div>
    </section>

    <!-- ═══ HOW IT WORKS ═══ -->
    <section class="how-it-works">
      <h2>Simple as 1-2-3</h2>
      <div class="steps-grid">
        <div class="step-card clay">
          <div class="step-icon">📋</div>
          <div class="step-num">1</div>
          <h3>Quick Application</h3>
          <p>Enter basic info — name, email, and zip. Takes under 60 seconds.</p>
        </div>
        <div class="step-card clay">
          <div class="step-icon">✅</div>
          <div class="step-num">2</div>
          <h3>Instant Decision</h3>
          <p>Get approved in seconds with no impact to your credit score.</p>
        </div>
        <div class="step-card clay">
          <div class="step-icon">🐾</div>
          <div class="step-num">3</div>
          <h3>Visit Your Vet</h3>
          <p>Use your approved credit at any of our 15,000+ partner clinics.</p>
        </div>
      </div>
    </section>

    <!-- ═══ TESTIMONIALS ═══ -->
    <section class="testimonials">
      <h2>Loved by Pet Parents</h2>
      <div class="test-grid">
        <div class="test-card clay">
          <div class="test-stars">⭐⭐⭐⭐⭐</div>
          <p class="test-text">"My dog needed emergency surgery and ${brand} saved us. The 0% plan made it completely manageable."</p>
          <p class="test-author">Sarah M. · Golden Retriever Mom · Austin, TX</p>
        </div>
        <div class="test-card clay">
          <div class="test-stars">⭐⭐⭐⭐⭐</div>
          <p class="test-text">"Applied in the vet's waiting room and got approved before the appointment ended. Incredible!"</p>
          <p class="test-author">James R. · Cat Dad · Miami, FL</p>
        </div>
        <div class="test-card clay">
          <div class="test-stars">⭐⭐⭐⭐⭐</div>
          <p class="test-text">"No hidden fees, exactly what they showed in the calculator. My vet recommended them too."</p>
          <p class="test-author">Lisa K. · Pet Parent · Denver, CO</p>
        </div>
      </div>
    </section>

    <!-- ═══ CTA BANNER ═══ -->
    <section class="cta-banner container">
      <h2>Your Pet Deserves the Best Care</h2>
      <p>Don't let cost stand between your pet and the treatment they need.</p>
      <button class="btn" data-open-form>${cta} →</button>
    </section>

    <!-- ═══ FOOTER ═══ -->
    <footer>
      <div class="container">
        <div class="footer-grid">
          <div>
            <h4>${brand}</h4>
            <p class="footer-brand">Making pet healthcare affordable for every family. Flexible financing with transparent terms and no surprises.</p>
          </div>
          <div>
            <h4>Product</h4>
            <a data-open-form>Apply Now</a>
            <a href="#calculator">Calculator</a>
            <a data-modal="how-it-works">How It Works</a>
          </div>
          <div>
            <h4>Resources</h4>
            <a data-modal="for-vets">For Veterinarians</a>
            <a data-modal="faq">FAQ</a>
            <a href="#">Contact Us</a>
          </div>
          <div>
            <h4>Legal</h4>
            <a data-modal="legal-privacy">Privacy Policy</a>
            <a data-modal="legal-terms">Terms of Service</a>
            <a data-modal="legal-disclosures">Disclosures</a>
            <a data-modal="legal-licensing">Licensing</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom container">
        <p class="footer-compliance">
          Representative Example: A $1,000 loan paid over 12 months at 15% APR would result in 12 monthly payments of $90.26. Minimum repayment 61 days. Loans issued by WebBank, Member FDIC. ${brand} is not a lender and does not make credit decisions. All loan terms are between you and the lender. APR ranges from ${aprMin}% to ${aprMax}%. Actual terms depend on creditworthiness and lender.
        </p>
        <p class="footer-copy">&copy; ${new Date().getFullYear()} ${brand}. All rights reserved.</p>
      </div>
    </footer>

    <!-- ═══ ELIGIBILITY FORM MODAL ═══ -->
    <div class="modal-overlay" id="formModal">
      <div class="modal-box">
        <button class="modal-close" data-close>&times;</button>
        <div id="formContent">
          <div class="modal-title">Check Your Eligibility</div>
          <p style="font-size:14px;color:hsl(var(--muted-fg));margin-bottom:24px">Quick form — no impact on your credit score.</p>
          <form id="eligibilityForm">
            <div class="form-group">
              <label for="fName">Full Name</label>
              <input type="text" id="fName" placeholder="Jane Smith" required>
              <div class="form-error" id="fNameErr">Please enter your full name</div>
            </div>
            <div class="form-group">
              <label for="fEmail">Email Address</label>
              <input type="email" id="fEmail" placeholder="jane@example.com" required>
              <div class="form-error" id="fEmailErr">Please enter a valid email</div>
            </div>
            <div class="form-group">
              <label for="fPhone">Phone Number</label>
              <input type="tel" id="fPhone" placeholder="(555) 123-4567" inputmode="tel" required>
              <div class="form-error" id="fPhoneErr">Please enter a valid phone number</div>
            </div>
            <div class="form-group">
              <label for="fZip">Zip Code</label>
              <input type="text" id="fZip" placeholder="90210" maxlength="5" inputmode="numeric" required>
              <div class="form-error" id="fZipErr">Please enter a valid 5-digit zip code</div>
            </div>
            <div class="form-group">
              <label for="fAmount">Desired Amount</label>
              <input type="text" id="fAmount" placeholder="$2,000" inputmode="numeric" required>
              <div class="form-error" id="fAmountErr">Enter an amount between $${amountMin} and $${amountMax}</div>
            </div>
            <button type="submit" class="btn btn-accent btn-full" id="formSubmitBtn" style="margin-top:8px">
              Check Eligibility →
            </button>
            <p style="text-align:center;font-size:12px;color:hsl(var(--muted-fg));margin-top:12px">
              🔒 Secure · No obligation · No hard credit check
            </p>
          </form>
        </div>
      </div>
    </div>

    <!-- ═══ INFO MODALS ═══ -->
    <div class="modal-overlay" id="infoModal">
      <div class="modal-box">
        <button class="modal-close" data-close>&times;</button>
        <div id="infoContent"></div>
      </div>
    </div>

    <!-- ═══ SCRIPTS ═══ -->
    <script>
    (function(){
      /* ── Helpers ── */
      function $(s,p){return(p||document).querySelector(s)}
      function $$(s,p){return(p||document).querySelectorAll(s)}
      function fmt(n){return '$'+n.toLocaleString()}
      function calcPmt(P,apr,m){
        if(apr===0)return{mo:Math.round(P/m),int:0,tot:P};
        var r=apr/100/12,mo=P*r/(1-Math.pow(1+r,-m)),i=mo*m-P;
        return{mo:Math.round(mo),int:Math.round(i),tot:Math.round(mo*m)};
      }

      /* ── Calculator ── */
      var slider=$('#calcSlider'),amtEl=$('#calcAmount');
      function updateCalc(){
        var v=parseInt(slider.value);
        amtEl.textContent=fmt(v);
        var t1=calcPmt(v,0,5),t2=calcPmt(v,14.99,12),t3=calcPmt(v,24.99,24);
        $('#t1pay').innerHTML=fmt(t1.mo)+'<small>/mo</small>';
        $('#t1detail').textContent=fmt(t1.int)+' interest · '+fmt(t1.tot)+' total';
        $('#t2pay').innerHTML=fmt(t2.mo)+'<small>/mo</small>';
        $('#t2detail').textContent=fmt(t2.int)+' interest · '+fmt(t2.tot)+' total';
        $('#t3pay').innerHTML=fmt(t3.mo)+'<small>/mo</small>';
        $('#t3detail').textContent=fmt(t3.int)+' interest · '+fmt(t3.tot)+' total';
      }
      slider.addEventListener('input',updateCalc);
      updateCalc();

      /* ── Zip Hero Validation ── */
      var heroZip=$('#heroZip'),heroErr=$('#heroZipError');
      heroZip.addEventListener('input',function(){
        heroZip.value=heroZip.value.replace(/\\D/g,'').slice(0,5);
        heroErr.style.display='none';
      });
      $('#heroZipBtn').addEventListener('click',function(){
        if(!/^\\d{5}$/.test(heroZip.value)){heroErr.style.display='block';return}
        // Valid zip — open form modal with zip pre-filled
        openFormModal(heroZip.value);
      });

      /* ── Modal System ── */
      function openModal(id){
        var m=$('#'+id);if(!m)return;
        m.classList.add('active');
        document.body.style.overflow='hidden';
      }
      function closeModal(id){
        var m=$('#'+id);if(!m)return;
        m.classList.remove('active');
        document.body.style.overflow='';
      }
      // Close buttons
      $$('[data-close]').forEach(function(btn){
        btn.addEventListener('click',function(){
          var overlay=btn.closest('.modal-overlay');
          if(overlay)overlay.classList.remove('active');
          document.body.style.overflow='';
        });
      });
      // Click outside
      $$('.modal-overlay').forEach(function(ov){
        ov.addEventListener('click',function(e){
          if(e.target===ov){ov.classList.remove('active');document.body.style.overflow=''}
        });
      });

      /* ── Form Modal ── */
      function openFormModal(zip){
        openModal('formModal');
        if(zip)$('#fZip').value=zip;
        $('#fAmount').value=fmt(parseInt(slider.value));
        // Track form_start
        window.dataLayer.push({event:window.formStartLabel||'form_start',aid:window.aid,network:window.network});
      }
      $$('[data-open-form]').forEach(function(btn){
        btn.addEventListener('click',function(e){e.preventDefault();openFormModal()});
      });

      /* ── Form Validation & Submit ── */
      var form=$('#eligibilityForm');
      form.addEventListener('submit',function(e){
        e.preventDefault();
        var ok=true;
        var name=$('#fName').value.trim();
        var email=$('#fEmail').value.trim();
        var phone=$('#fPhone').value.replace(/\\D/g,'');
        var zip=$('#fZip').value.trim();
        var rawAmt=$('#fAmount').value.replace(/[^0-9]/g,'');
        var amount=parseInt(rawAmt)||0;

        // Validate
        if(name.length<2){$('#fNameErr').style.display='block';ok=false}else{$('#fNameErr').style.display='none'}
        if(!/^[^@]+@[^@]+\\.[^@]+$/.test(email)){$('#fEmailErr').style.display='block';ok=false}else{$('#fEmailErr').style.display='none'}
        if(phone.length<10){$('#fPhoneErr').style.display='block';ok=false}else{$('#fPhoneErr').style.display='none'}
        if(!/^\\d{5}$/.test(zip)){$('#fZipErr').style.display='block';ok=false}else{$('#fZipErr').style.display='none'}
        if(amount<${amountMin}||amount>${amountMax}){$('#fAmountErr').style.display='block';ok=false}else{$('#fAmountErr').style.display='none'}

        if(!ok)return;

        // Disable button
        var btn=$('#formSubmitBtn');
        btn.disabled=true;btn.textContent='Processing...';

        // Step B: Tracking — fire generate_lead_qualified
        window.dataLayer.push({
          event:'generate_lead_qualified',
          conversion_value:amount,
          currency:'USD',
          conversion_id:window.conversionId,
          aid:window.aid,
          network:window.network,
          zip:zip
        });

        // Show success
        $('#formContent').innerHTML='<div class="form-success"><div class="icon">🎉</div><h3>You\\'re Pre-Qualified!</h3><p>Redirecting to complete your application...</p></div>';

        // Redirect
        setTimeout(function(){
          var params=new URLSearchParams();
          params.set('amount',amount);
          params.set('zip',zip);
          params.set('name',encodeURIComponent(name));
          params.set('email',encodeURIComponent(email));
          params.set('phone',phone);
          params.set('aid',window.aid);
          window.location.href=window.redirectUrl+'?'+params.toString();
        },1500);
      });

      /* ── Info Modals ── */
      var INFO_CONTENT={
        'how-it-works':'<div class="modal-title">How It Works</div><div class="info-steps"><div class="info-step"><div class="info-step-num">1</div><div><h4>Quick Application</h4><p>Enter your name, email, zip code, and desired amount. It takes less than 60 seconds and won\\'t affect your credit score.</p></div></div><div class="info-step"><div class="info-step-num">2</div><div><h4>Instant Decision</h4><p>Our lending partners review your application instantly. Most applicants receive a decision in under 30 seconds.</p></div></div><div class="info-step"><div class="info-step-num">3</div><div><h4>Use at Your Vet</h4><p>Once approved, present your approval code at any of our 15,000+ partner veterinary clinics nationwide.</p></div></div></div>',
        'for-vets':'<div class="modal-title">For Veterinarians</div><p style="color:hsl(var(--muted-fg));margin-bottom:20px">Partner with ${brand} to offer flexible payment options to your clients.</p><div class="info-steps"><div class="info-step"><div class="info-step-num">🏥</div><div><h4>Increase Case Acceptance</h4><p>Clients are 3x more likely to approve treatment when financing is available.</p></div></div><div class="info-step"><div class="info-step-num">💰</div><div><h4>Get Paid Upfront</h4><p>You receive full payment within 2 business days. We handle all billing and collections.</p></div></div><div class="info-step"><div class="info-step-num">🤝</div><div><h4>Easy Integration</h4><p>No equipment needed. Clients apply on their phone right in your waiting room.</p></div></div></div><div style="margin-top:24px;text-align:center"><button class="btn btn-primary" onclick="window.open(\\'mailto:partners@${domain}\\')">Become a Partner</button></div>',
        'faq':'<div class="modal-title">Frequently Asked Questions</div><div><div class="info-faq-item"><h4>Will this affect my credit score?</h4><p>No. We use a soft credit check for pre-qualification that has zero impact on your credit score. A hard inquiry only occurs if you accept a loan offer.</p></div><div class="info-faq-item"><h4>What is the 0% interest plan?</h4><p>Our "Pay in 5" plan splits your treatment cost into 5 equal monthly payments with absolutely no interest or fees. Available for amounts up to $3,000.</p></div><div class="info-faq-item"><h4>How fast can I get approved?</h4><p>Most applications receive an instant decision. Once approved, you can use your credit immediately at any partner clinic.</p></div><div class="info-faq-item"><h4>Can I pay off early?</h4><p>Yes! There are no prepayment penalties. Paying early can save you money on interest for the 12 and 24 month plans.</p></div><div class="info-faq-item"><h4>What if my vet isn\\'t a partner?</h4><p>We\\'re adding new clinics every day. Contact us and we\\'ll reach out to your vet to get them enrolled — usually within 48 hours.</p></div></div>',
        'legal-privacy':'<div class="modal-title">Privacy Policy</div><p style="color:hsl(var(--muted-fg));font-size:13px;line-height:1.8">${brand} ("we", "us") respects your privacy. We collect personal information (name, email, phone, zip code) solely to process your financing application and connect you with lending partners. We do not sell your personal information to third parties. Data is encrypted using 256-bit SSL and stored securely. You may request deletion of your data at any time by contacting privacy@${domain}. By using our service, you consent to this policy. Last updated: ${new Date().toISOString().slice(0,10)}.</p>',
        'legal-terms':'<div class="modal-title">Terms of Service</div><p style="color:hsl(var(--muted-fg));font-size:13px;line-height:1.8">${brand} provides a platform connecting consumers with lending partners for pet care financing. We are not a lender and do not make credit decisions. All loan terms, rates, and conditions are determined by the lending partner. By submitting an application, you authorize us to share your information with our lending network. You must be 18+ and a US resident. Service availability varies by state. ${brand} is not responsible for the actions of lending partners. Disputes should be directed to the applicable lender.</p>',
        'legal-disclosures':'<div class="modal-title">Disclosures</div><p style="color:hsl(var(--muted-fg));font-size:13px;line-height:1.8">Representative Example: A $1,000 loan paid over 12 months at 15% APR would result in 12 monthly payments of $90.26. Total amount payable: $1,083.12. Total cost of credit: $83.12. Minimum repayment period: 61 days. Maximum repayment period: 24 months. APR ranges from ${aprMin}% to ${aprMax}%. Actual rate depends on creditworthiness, loan amount, and term. Loans issued by WebBank, Member FDIC. ${brand} is a marketplace connecting borrowers with lenders and is not a lender itself.</p>',
        'legal-licensing':'<div class="modal-title">Licensing</div><p style="color:hsl(var(--muted-fg));font-size:13px;line-height:1.8">${brand} operates as a licensed loan broker/marketplace. Loans are originated by WebBank, Member FDIC, or other state-licensed lenders. Not all applicants will qualify. Offer terms depend on creditworthiness. State licensing information available upon request. NMLS Consumer Access: www.nmlsconsumeraccess.org. If you have questions about licensing, contact compliance@${domain}.</p>'
      };
      $$('[data-modal]').forEach(function(el){
        el.addEventListener('click',function(e){
          e.preventDefault();
          var key=el.getAttribute('data-modal');
          var html=INFO_CONTENT[key];
          if(html){$('#infoContent').innerHTML=html;openModal('infoModal')}
        });
      });

      /* ── Page View Tracking ── */
      window.dataLayer.push({event:'page_view',page:'${brand}',aid:window.aid,network:window.network});
    })();
    </script>
  </body>
</html>
`;

  // ─── README.md ─────────────────────────────────────────────
  files["README.md"] = `# ${brand} — Pet Care Bridge Page

Claymorphism-styled, mobile-first bridge page for pet care financing.

## Features

- **Claymorphism Design**: Soft 3D card effects with layered shadows
- **Zip Code Hero**: Combined input group with Zod-style validation
- **Payment Calculator**: 3-tier slider (Pay in 5 at 0%, 12mo, 24mo)
- **Modal System**: Bottom-sheet on mobile, centered on desktop
- **Short Form**: Name/Email/Phone/Zip/Amount with validation + tracking
- **Footer Modals**: How It Works, For Vets, FAQ, Legal docs
- **Compliance**: Representative example + WebBank disclosure

## Tracking Events

- \`page_view\` — On page load
- \`form_start\` — When form modal opens
- \`generate_lead_qualified\` — On form submit (with conversion_value)

## Configuration

- **Brand**: ${brand}
- **Domain**: ${domain}
- **Color**: ${c.name}
- **Font**: ${f.name}
- **Amount Range**: $${amountMin} - $${amountMax}
- **APR Range**: ${aprMin}% - ${aprMax}%

## Deploy

\`\`\`bash
npm install
npm run build
\`\`\`
`;

  return files;
}
