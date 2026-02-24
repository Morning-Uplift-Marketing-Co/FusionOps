/**
 * PDL Loans V3 Template Generator
 * Enhanced version with modern design, dark mode support, and improved UX
 * Features: Hero form, trust badges, calculator, FAQ, testimonials, full compliance
 */

import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[3];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS.find(x => x.id === 'dm-sans') || FONTS[0];
  const brand = site.brand || "CashFlow Pro";
  const loanLabel = site.loanLabel || "Personal Loans";
  const h1 = site.h1 || "Get the Cash You Need,";
  const h1span = site.h1span || "When You Need It";
  const sub = site.sub || "Fast approvals, no hidden fees, funds as soon as tomorrow.";
  const badge = site.badge || "Over 50,000 people helped this month";
  const cta = site.cta || "Check Your Rate";
  const companyName = brand;
  const domain = site.domain || "example.com";
  const amountMin = site.amountMin || 100;
  const amountMax = site.amountMax || 5000;
  const aprMin = site.aprMin || 4.99;
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

  const files = {};

  // ─── package.json ───────────────────────────────────────────
  files["package.json"] = JSON.stringify({
    name: brand.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-pdl-loans-v3",
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
  build: {
    assets: '_assets',
  },
});
`;

  // ─── src/pages/index.astro ──────────────────────────────────
  files["src/pages/index.astro"] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${brand} — ${loanLabel} $${amountMin}-$${amountMax} | Fast Approval</title>
    <meta name="description" content="${sub}" />

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=${f.import}&display=swap" rel="stylesheet">

    <!-- Inline Styles -->
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      :root {
        --primary: ${c.p[0]} ${c.p[1]}% ${c.p[2]}%;
        --primary-dark: ${c.s[0]} ${c.s[1]}% ${c.s[2]}%;
        --accent: ${c.a[0]} ${c.a[1]}% ${c.a[2]}%;
        --accent-hover: ${c.a[0]} ${c.a[1]}% ${Math.max(c.a[2]-10)}%;
        --bg: 0 0% 100%;
        --fg: 222 47% 11%;
        --muted: 210 40% 96%;
        --border: 214 32% 91%;
        --success: 142 76% 36%;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: 222 47% 11%;
          --fg: 0 0% 100%;
          --muted: 217 33% 17%;
          --border: 217 33% 27%;
        }
      }
      body {
        font-family: '${f.family.replace(/"/g, '')}', system-ui, sans-serif;
        background: hsl(var(--bg));
        color: hsl(var(--fg));
        line-height: 1.6;
      }
      .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: hsl(var(--accent));
        color: white;
        padding: 16px 32px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 700;
        text-decoration: none;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn:hover { background: hsl(var(--accent-hover)); transform: translateY(-2px); }
      .btn-full { width: 100%; }
      .card {
        background: hsl(var(--bg));
        border: 1px solid hsl(var(--border));
        border-radius: 16px;
        padding: 24px;
      }
      /* Header */
      header {
        position: sticky;
        top: 0;
        z-index: 100;
        background: hsl(var(--bg) / 0.9);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid hsl(var(--border));
      }
      header .container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 70px;
      }
      .logo { font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
      nav { display: flex; gap: 24px; }
      nav a { color: hsl(var(--fg)); text-decoration: none; font-weight: 500; font-size: 14px; }
      nav a:hover { color: hsl(var(--primary)); }
      @media (max-width: 768px) { nav { display: none; } }
      /* Hero */
      .hero {
        min-height: 90vh;
        display: flex;
        align-items: center;
        background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-dark)) 100%);
        color: white;
        padding: 80px 20px;
        position: relative;
        overflow: hidden;
      }
      .hero::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -20%;
        width: 600px;
        height: 600px;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
        border-radius: 50%;
      }
      .hero-content {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 60px;
        align-items: center;
        max-width: 1200px;
        margin: 0 auto;
      }
      @media (max-width: 968px) { .hero-content { grid-template-columns: 1fr; text-align: center; } }
      .hero-text h1 {
        font-size: clamp(2.5rem, 5vw, 4rem);
        font-weight: 900;
        line-height: 1.1;
        margin-bottom: 20px;
      }
      .hero-text .sub {
        font-size: clamp(1rem, 2vw, 1.25rem);
        opacity: 0.9;
        margin-bottom: 30px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(255,255,255,0.15);
        padding: 8px 16px;
        border-radius: 100px;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 20px;
      }
      .badge::before {
        content: '';
        width: 8px;
        height: 8px;
        background: hsl(var(--success));
        border-radius: 50%;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.2); }
      }
      .features { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 30px; }
      .feature-tag {
        background: rgba(255,255,255,0.1);
        padding: 8px 16px;
        border-radius: 100px;
        font-size: 13px;
      }
      /* Hero Form */
      .hero-form {
        background: white;
        border-radius: 20px;
        padding: 32px;
        box-shadow: 0 25px 50px rgba(0,0,0,0.15);
        color: hsl(var(--fg));
      }
      .form-header { text-align: center; margin-bottom: 24px; }
      .form-header h3 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
      .form-header p { font-size: 14px; color: hsl(var(--muted-foreground)); }
      .amount-selector { margin-bottom: 24px; }
      .amount-selector label { display: block; font-weight: 600; margin-bottom: 12px; font-size: 14px; }
      .amount-buttons {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 12px;
      }
      .amount-btn {
        padding: 12px;
        border: 2px solid hsl(var(--border));
        background: transparent;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .amount-btn:hover { border-color: hsl(var(--primary)); }
      .amount-btn.active {
        background: hsl(var(--primary));
        border-color: hsl(var(--primary));
        color: white;
      }
      .amount-display {
        text-align: center;
        font-size: 32px;
        font-weight: 800;
        color: hsl(var(--primary));
        margin: 16px 0;
      }
      input[type="range"] {
        width: 100%;
        height: 8px;
        border-radius: 4px;
        background: hsl(var(--muted));
        outline: none;
        -webkit-appearance: none;
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: hsl(var(--primary));
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      }
      .zip-input { margin-bottom: 20px; }
      .zip-input label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; }
      .zip-input input {
        width: 100%;
        padding: 14px 16px;
        border: 2px solid hsl(var(--border));
        border-radius: 10px;
        font-size: 16px;
        transition: border-color 0.2s;
      }
      .zip-input input:focus { outline: none; border-color: hsl(var(--primary)); }
      .error-message { color: #ef4444; font-size: 13px; margin-top: 6px; display: none; }
      .disclaimer-text {
        text-align: center;
        font-size: 12px;
        color: hsl(var(--muted-foreground));
        margin-top: 16px;
      }
      /* Stats Section */
      .stats { padding: 60px 20px; background: hsl(var(--muted)); }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 24px;
        max-width: 1000px;
        margin: 0 auto;
      }
      @media (max-width: 768px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
      .stat-item { text-align: center; }
      .stat-value { font-size: 36px; font-weight: 800; color: hsl(var(--primary)); }
      .stat-label { font-size: 14px; color: hsl(var(--muted-foreground)); }
      /* Calculator Section */
      .calculator { padding: 80px 20px; }
      .calculator h2 {
        text-align: center;
        font-size: clamp(2rem, 4vw, 3rem);
        font-weight: 800;
        margin-bottom: 16px;
      }
      .calculator .sub-text {
        text-align: center;
        color: hsl(var(--muted-foreground));
        margin-bottom: 40px;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
      }
      .calc-amount {
        text-align: center;
        font-size: 48px;
        font-weight: 900;
        color: hsl(var(--primary));
        margin-bottom: 32px;
      }
      .plans {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        max-width: 900px;
        margin: 0 auto;
      }
      @media (max-width: 768px) { .plans { grid-template-columns: 1fr; } }
      .plan {
        border: 2px solid hsl(var(--border));
        border-radius: 16px;
        padding: 24px;
        text-align: center;
        transition: all 0.2s;
      }
      .plan:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
      .plan.featured {
        border-color: hsl(var(--primary));
        background: hsl(var(--primary) / 0.05);
        position: relative;
      }
      .plan-badge {
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
        background: hsl(var(--success));
        color: white;
        padding: 4px 12px;
        border-radius: 100px;
        font-size: 12px;
        font-weight: 600;
      }
      .plan-term { font-size: 14px; font-weight: 600; color: hsl(var(--muted-foreground)); margin-bottom: 8px; }
      .plan-apr { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
      .plan-payment { font-size: 32px; font-weight: 800; color: hsl(var(--primary)); }
      .plan-details {
        font-size: 13px;
        color: hsl(var(--muted-foreground));
        margin-top: 12px;
      }
      /* Testimonials */
      .testimonials { padding: 80px 20px; background: hsl(var(--muted)); }
      .testimonials h2 {
        text-align: center;
        font-size: clamp(2rem, 4vw, 2.5rem);
        font-weight: 800;
        margin-bottom: 16px;
      }
      .testimonials-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        max-width: 1000px;
        margin: 40px auto 0;
      }
      @media (max-width: 768px) { .testimonials-grid { grid-template-columns: 1fr; } }
      .testimonial {
        background: hsl(var(--bg));
        border-radius: 16px;
        padding: 24px;
      }
      .stars { color: #f59e0b; margin-bottom: 12px; }
      .testimonial-text { font-size: 15px; margin-bottom: 16px; }
      .testimonial-author { font-size: 13px; color: hsl(var(--muted-foreground)); }
      /* FAQ */
      .faq { padding: 80px 20px; }
      .faq h2 {
        text-align: center;
        font-size: clamp(2rem, 4vw, 2.5rem);
        font-weight: 800;
        margin-bottom: 40px;
      }
      .faq-list { max-width: 800px; margin: 0 auto; }
      .faq-item {
        border: 1px solid hsl(var(--border));
        border-radius: 12px;
        margin-bottom: 12px;
        overflow: hidden;
      }
      .faq-question {
        width: 100%;
        padding: 20px;
        background: none;
        border: none;
        text-align: left;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .faq-question:hover { background: hsl(var(--muted)); }
      .faq-answer {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s, padding 0.3s;
      }
      .faq-item.open .faq-answer {
        max-height: 200px;
        padding: 0 20px 20px;
      }
      .faq-item.open .faq-question svg { transform: rotate(180deg); }
      .faq-question svg { transition: transform 0.3s; }
      /* Footer */
      footer {
        background: hsl(var(--fg));
        color: white;
        padding: 60px 20px 30px;
      }
      footer .container {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 40px;
        margin-bottom: 40px;
      }
      @media (max-width: 768px) { footer .container { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 480px) { footer .container { grid-template-columns: 1fr; } }
      footer h4 { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
      footer a { color: rgba(255,255,255,0.7); text-decoration: none; display: block; margin-bottom: 8px; font-size: 14px; }
      footer a:hover { color: white; }
      .footer-bottom {
        border-top: 1px solid rgba(255,255,255,0.1);
        padding-top: 30px;
        text-align: center;
        font-size: 13px;
        color: rgba(255,255,255,0.5);
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
    <!-- Header -->
    <header>
      <div class="container">
        <div class="logo">
          <span>💰</span>
          <span>${brand}</span>
        </div>
        <nav>
          <a href="#how-it-works">How It Works</a>
          <a href="#calculator">Calculator</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a href="#apply" class="btn" style="padding: 12px 24px; font-size: 14px;">Get Started</a>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-content">
        <div class="hero-text">
          <div class="badge">${badge}</div>
          <h1>${h1}<br>${h1span}</h1>
          <p class="sub">${sub}</p>
          <div class="features">
            <span class="feature-tag">✓ No Hard Credit Check</span>
            <span class="feature-tag">✓ Instant Decision</span>
            <span class="feature-tag">✓ Funds Tomorrow</span>
          </div>
        </div>
        <div class="hero-form" id="apply">
          <div class="form-header">
            <h3>Check Your Rate</h3>
            <p>Won't affect your credit score</p>
          </div>
          <form id="loanForm">
            <div class="amount-selector">
              <label>How much do you need?</label>
              <div class="amount-buttons">
                <button type="button" class="amount-btn" data-amount="1000">$1K</button>
                <button type="button" class="amount-btn active" data-amount="2000">$2K</button>
                <button type="button" class="amount-btn" data-amount="3000">$3K</button>
                <button type="button" class="amount-btn" data-amount="5000">$5K</button>
              </div>
              <input type="range" id="amountSlider" min="${amountMin}" max="${amountMax}" step="100" value="2000">
              <div class="amount-display">$2,000</div>
            </div>
            <div class="zip-input">
              <label for="zipCode">Your ZIP Code</label>
              <input type="text" id="zipCode" placeholder="e.g. 90210" maxlength="5" inputmode="numeric">
              <div class="error-message" id="zipError">Please enter a valid 5-digit ZIP code</div>
            </div>
            <button type="submit" class="btn btn-full">
              ${cta} →
            </button>
            <p class="disclaimer-text">
              🔒 Secure · No obligation · No hard credit check
            </p>
          </form>
        </div>
      </div>
    </section>

    <!-- Stats Section -->
    <section class="stats">
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">50K+</div>
          <div class="stat-label">People Helped</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">4.9★</div>
          <div class="stat-label">Customer Rating</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">2 min</div>
          <div class="stat-label">Average Time</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">$500</div>
          <div class="stat-label">Avg. Loan Amount</div>
        </div>
      </div>
    </section>

    <!-- Calculator Section -->
    <section class="calculator" id="calculator">
      <h2>See Your Monthly Payment</h2>
      <p class="sub-text">Choose your amount and see instant payment options</p>
      <div class="calc-amount" id="calcAmount">$2,000</div>
      <input type="range" id="calcSlider" min="${amountMin}" max="${amountMax}" step="100" value="2000" style="max-width: 400px; margin: 0 auto 32px; display: block;">
      <div class="plans">
        <div class="plan">
          <div class="plan-term">5 Months</div>
          <div class="plan-apr">0% APR</div>
          <div class="plan-payment" id="plan5">$400<span style="font-size: 16px; font-weight: 600;">/mo</span></div>
          <div class="plan-details">$0 finance charge · $2,000 total</div>
        </div>
        <div class="plan featured">
          <div class="plan-badge">MOST POPULAR</div>
          <div class="plan-term">12 Months</div>
          <div class="plan-apr">14.99% APR</div>
          <div class="plan-payment" id="plan12">$180<span style="font-size: 16px; font-weight: 600;">/mo</span></div>
          <div class="plan-details">$160 finance charge · $2,160 total</div>
        </div>
        <div class="plan">
          <div class="plan-term">24 Months</div>
          <div class="plan-apr">18.99% APR</div>
          <div class="plan-payment" id="plan24">$98<span style="font-size: 16px; font-weight: 600;">/mo</span></div>
          <div class="plan-details">$352 finance charge · $2,352 total</div>
        </div>
      </div>
    </section>

    <!-- Testimonials -->
    <section class="testimonials">
      <h2>What Our Customers Say</h2>
      <div class="testimonials-grid">
        <div class="testimonial">
          <div class="stars">⭐⭐⭐⭐⭐</div>
          <p class="testimonial-text">"Super fast process! Got my money the next day. The whole thing took less than 5 minutes."</p>
          <p class="testimonial-author">Sarah M. · Austin, TX</p>
        </div>
        <div class="testimonial">
          <div class="stars">⭐⭐⭐⭐⭐</div>
          <p class="testimonial-text">"No hidden fees, exactly what they promised. The payment calculator was spot on."</p>
          <p class="testimonial-author">James R. · Miami, FL</p>
        </div>
        <div class="testimonial">
          <div class="stars">⭐⭐⭐⭐⭐</div>
          <p class="testimonial-text">"Saved me when I had an emergency. Great customer service and very transparent."</p>
          <p class="testimonial-author">Lisa K. · Denver, CO</p>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="faq" id="faq">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-list">
        <div class="faq-item">
          <button class="faq-question">
            <span>How fast can I get my money?</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8l5 5 5-5"/></svg>
          </button>
          <div class="faq-answer">
            <p>Most approved applicants receive their funds as soon as the next business day. The exact timing depends on your bank.</p>
          </div>
        </div>
        <div class="faq-item">
          <button class="faq-question">
            <span>Will this affect my credit score?</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8l5 5 5-5"/></svg>
          </button>
          <div class="faq-answer">
            <p>No. We use a soft credit check that doesn't impact your score. Only if you accept a loan offer and complete the application might there be a hard inquiry.</p>
          </div>
        </div>
        <div class="faq-item">
          <button class="faq-question">
            <span>What documents do I need?</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8l5 5 5-5"/></svg>
          </button>
          <div class="faq-answer">
            <p>Basic information like your ID, proof of income, and bank account details. Most people complete the application in under 5 minutes.</p>
          </div>
        </div>
        <div class="faq-item">
          <button class="faq-question">
            <span>Are there any prepayment penalties?</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8l5 5 5-5"/></svg>
          </button>
          <div class="faq-answer">
            <p>No! You can pay off your loan early at any time with no extra fees. In fact, paying early can save you money on interest.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer>
      <div class="container">
        <div>
          <h4>${brand}</h4>
          <p style="color: rgba(255,255,255,0.7); font-size: 14px;">Helping people get access to fair and transparent loans since 2020.</p>
        </div>
        <div>
          <h4>Product</h4>
          <a href="#apply">Apply Now</a>
          <a href="#calculator">Calculator</a>
          <a href="#how-it-works">How It Works</a>
        </div>
        <div>
          <h4>Support</h4>
          <a href="#faq">FAQ</a>
          <a href="#">Contact Us</a>
          <a href="#">Help Center</a>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="#">Terms of Service</a>
          <a href="#">Privacy Policy</a>
          <a href="#">Cookie Policy</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© ${new Date().getFullYear()} ${brand}. All rights reserved.</p>
        <p style="margin-top: 12px;">APR ranges from ${aprMin}% to ${aprMax}%. Loan terms vary by lender. Please review all terms before accepting any offer.</p>
      </div>
    </footer>

    <!-- Inline Scripts -->
    <script>
      (function() {
        // Amount selector functionality
        var amount = 2000;
        var amountSlider = document.getElementById('amountSlider');
        var amountDisplay = document.querySelector('.amount-display');
        var amountBtns = document.querySelectorAll('.amount-btn');

        var calcSlider = document.getElementById('calcSlider');
        var calcAmount = document.getElementById('calcAmount');
        var plan5 = document.getElementById('plan5');
        var plan12 = document.getElementById('plan12');
        var plan24 = document.getElementById('plan24');

        function formatMoney(n) {
          return '$' + n.toLocaleString();
        }

        function setAmount(v) {
          amount = v;
          if (amountSlider) amountSlider.value = v;
          if (amountDisplay) amountDisplay.textContent = formatMoney(v);
          if (calcSlider) calcSlider.value = v;
          if (calcAmount) calcAmount.textContent = formatMoney(v);
          updatePlans(v);
          updateAmountButtons(v);
        }

        function updateAmountButtons(v) {
          amountBtns.forEach(function(btn) {
            var btnAmount = parseInt(btn.dataset.amount);
            if (btnAmount === v) {
              btn.classList.add('active');
            } else {
              btn.classList.remove('active');
            }
          });
        }

        function calculatePayment(principal, apr, months) {
          if (apr === 0) {
            var monthly = principal / months;
            var finance = 0;
          } else {
            var r = (apr / 100) / 12;
            var monthly = principal * r / (1 - Math.pow(1 + r, -months));
            var finance = (monthly * months) - principal;
          }
          var total = principal + finance;
          return { monthly: Math.round(monthly), finance: Math.round(finance), total: total };
        }

        function updatePlans(p) {
          var p5 = calculatePayment(p, 0, 5);
          var p12 = calculatePayment(p, 14.99, 12);
          var p24 = calculatePayment(p, 18.99, 24);

          if (plan5) plan5.innerHTML = formatMoney(p5.monthly) + '<span style="font-size: 16px; font-weight: 600;">/mo</span>';
          if (plan12) plan12.innerHTML = formatMoney(p12.monthly) + '<span style="font-size: 16px; font-weight: 600;">/mo</span>';
          if (plan24) plan24.innerHTML = formatMoney(p24.monthly) + '<span style="font-size: 16px; font-weight: 600;">/mo</span>';
        }

        // Amount buttons
        amountBtns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            setAmount(parseInt(btn.dataset.amount));
          });
        });

        // Sliders
        if (amountSlider) {
          amountSlider.addEventListener('input', function() {
            setAmount(parseInt(amountSlider.value));
          });
        }
        if (calcSlider) {
          calcSlider.addEventListener('input', function() {
            setAmount(parseInt(calcSlider.value));
          });
        }

        // Form submission
        var form = document.getElementById('loanForm');
        var zipInput = document.getElementById('zipCode');
        var zipError = document.getElementById('zipError');

        zipInput.addEventListener('input', function() {
          zipInput.value = zipInput.value.replace(/\\D/g, '').slice(0, 5);
          zipError.style.display = 'none';
        });

        form.addEventListener('submit', function(e) {
          e.preventDefault();

          var zip = zipInput.value;
          if (!/^\\d{5}$/.test(zip)) {
            zipError.style.display = 'block';
            return;
          }

          // Tracking: Form Start
          if (window.dataLayer) {
            window.dataLayer.push({
              event: window.formStartLabel || 'form_start',
              conversion_id: window.conversionId,
              aid: window.aid,
              network: window.network,
              amount: amount,
              zip: zip
            });
          }

          // Tracking: Form Submit
          if (window.dataLayer) {
            window.dataLayer.push({
              event: window.formSubmitLabel || 'generate_lead',
              conversion_id: window.conversionId,
              aid: window.aid,
              network: window.network,
              amount: amount,
              zip: zip
            });
          }

          // Show success and redirect
          form.innerHTML = '<div style="text-align: center; padding: 40px 0;"><div style="font-size: 48px; margin-bottom: 16px;">✓</div><div style="font-size: 18px; font-weight: 700; color: hsl(var(--success));">Application Started!</div><p style="margin-top: 12px; color: hsl(var(--muted-foreground));">Redirecting...</p></div>';

          setTimeout(function() {
            var params = new URLSearchParams();
            params.set('amount', amount);
            params.set('zip', zip);
            params.set('aid', window.aid);
            window.location.href = window.redirectUrl + '?' + params.toString();
          }, 1500);
        });

        // FAQ accordion
        var faqQuestions = document.querySelectorAll('.faq-question');
        faqQuestions.forEach(function(question) {
          question.addEventListener('click', function() {
            var item = this.parentElement;
            var isOpen = item.classList.contains('open');
            // Close all
            document.querySelectorAll('.faq-item').forEach(function(i) {
              i.classList.remove('open');
            });
            // Open clicked if it wasn't open
            if (!isOpen) {
              item.classList.add('open');
            }
          });
        });

        // Page view tracking
        if (window.dataLayer) {
          window.dataLayer.push({
            event: 'page_view',
            page: '${brand}',
            aid: window.aid,
            network: window.network
          });
        }

        // Initialize
        updatePlans(amount);
      })();
    </script>
  </body>
</html>
`;

  // ─── README.md ─────────────────────────────────────────────
  files["README.md"] = `# ${brand} — PDL Loans V3

Modern landing page template with enhanced UX and dark mode support.

## Features

- **Modern Design**: Clean, contemporary UI with smooth animations
- **Dark Mode**: Automatic dark mode support
- **Interactive Calculator**: Real-time payment estimates
- **Full Tracking**: LeadsGate AID, Voluum, GTM support
- **FAQ Accordion**: Smooth expand/collapse animations
- **Responsive**: Works perfectly on all devices

## Configuration

This template uses the following settings from Wizard:

- **Brand**: ${brand}
- **Domain**: ${domain}
- **Primary Color**: ${c.name}
- **Font**: ${f.name}
- **Loan Range**: $${amountMin} - $${amountMax}
- **APR Range**: ${aprMin}% - ${aprMax}%

## Tracking Events

- \`page_view\` - Fired on page load
- \`form_start\` - Fired when form is submitted
- \`generate_lead\` - Conversion event

## Deploy

\`\`\`bash
npm install
npm run build
# Upload dist/ folder to your host
\`\`\`

## Affiliate Setup

Replace the \`redirectUrl\` in the script with your affiliate tracking URL:

\`\`\`javascript
window.redirectUrl = "https://your-affiliate-link.com";
\`\`\`
`;

  return files;
}
