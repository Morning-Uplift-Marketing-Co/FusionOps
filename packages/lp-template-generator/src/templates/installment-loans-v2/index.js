/**
 * Installment Loans V2 Template Generator
 * Mobile-first LP + Apply page with LeadsGate form embed
 * - Form above the fold on mobile
 * - Sticky CTA at 30% scroll
 * - APR compliance table
 * - Popup modals (Privacy, Terms, Contact, Disclosures)
 * - Apply page with progress bar + LG form hooks
 * - Zero external JS frameworks, PageSpeed 95+
 */

import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const brand = site.brand || "LoanBridge";
  const domain = site.domain || "example.com";
  const h1 = site.h1 || "Fixed Monthly Payments You Can Trust";
  const sub = site.sub || `Installment loans from $${(site.amountMin || 1000).toLocaleString()} to $${(site.amountMax || 10000).toLocaleString()}. No hidden fees.`;
  const cta = site.cta || "Check My Rate";
  const badge = site.badge || "Trusted by 50,000+ borrowers";
  const loanLabel = site.loanLabel || "Installment Loans";
  const amountMin = site.amountMin || 1000;
  const amountMax = site.amountMax || 10000;
  const aprMin = site.aprMin || 5.99;
  const aprMax = site.aprMax || 35.99;
  const email = site.email || `support@${domain}`;
  const phone = site.phone || "1-800-555-1234";
  const address = site.address || "1700 Market Street, Suite 1005, Philadelphia, PA 19103";

  // Tracking
  const aid = site.aid || "";
  const network = site.network || "LeadsGate";
  const redirectUrl = site.redirectUrl || "#";
  const voluumDomain = site.voluumDomain || "";
  const conversionId = site.conversionId || "";
  const formStartLabel = site.formStartLabel || "form_start";
  const formSubmitLabel = site.formSubmitLabel || "form_submit";

  // Color helpers — HSL values
  const pH = c.p[0], pS = c.p[1], pL = c.p[2];
  const aH = c.a[0], aS = c.a[1], aL = c.a[2];

  // Generate CSS color values
  const primaryHsl = `hsl(${pH}, ${pS}%, ${pL}%)`;
  const primaryDarkHsl = `hsl(${pH}, ${pS}%, ${Math.max(pL - 12, 10)}%)`;
  const primaryLightHsl = `hsl(${pH}, ${pS}%, ${Math.min(pL + 8, 90)}%)`;
  const primaryGlow = `hsla(${pH}, ${pS}%, ${pL}%, 0.25)`;
  const accentHsl = `hsl(${aH}, ${aS}%, ${aL}%)`;
  const accentLightHsl = `hsl(${aH}, ${aS}%, ${Math.min(aL + 10, 90)}%)`;
  const accentGlow = `hsla(${aH}, ${aS}%, ${aL}%, 0.3)`;

  // Font
  const fontFamily = f.family || "'Plus Jakarta Sans', system-ui, sans-serif";
  const fontImport = f.import || "Plus+Jakarta+Sans:wght@400;500;600;700;800";

  // APR table data (auto-calculated)
  function calcPayment(P, apr, months) {
    const r = apr / 100 / 12;
    if (r === 0) return P / months;
    return P * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
  }

  const aprRows = [
    { amt: amountMin, term: 12 },
    { amt: Math.round((amountMax - amountMin) * 0.25 + amountMin), term: 24 },
    { amt: Math.round((amountMax - amountMin) * 0.5 + amountMin), term: 36 },
    { amt: Math.round((amountMax - amountMin) * 0.75 + amountMin), term: 48 },
    { amt: amountMax, term: 60 },
  ].map(r => {
    const minPay = Math.round(calcPayment(r.amt, aprMin, r.term));
    const maxPay = Math.round(calcPayment(r.amt, aprMax, r.term));
    const minTotal = minPay * r.term;
    const maxTotal = maxPay * r.term;
    return {
      ...r,
      minPay, maxPay, minTotal, maxTotal,
      minInterest: minTotal - r.amt,
      maxInterest: maxTotal - r.amt,
    };
  });

  // Representative example (middle row, 9.99% APR)
  const repRow = aprRows[2];
  const repPay = Math.round(calcPayment(repRow.amt, 9.99, repRow.term));
  const repTotal = repPay * repRow.term;
  const repInterest = repTotal - repRow.amt;

  // Amount button labels (smart: if max <= 5000, show hundreds; else show K)
  const amtButtons = [amountMin, Math.round((amountMax - amountMin) * 0.33 + amountMin), Math.round((amountMax - amountMin) * 0.66 + amountMin), amountMax];
  const fmtBtn = (n) => n >= 1000 ? `$${(n/1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : `$${n}`;

  const files = {};

  // ─── package.json ──────────────────────────────────────
  files["package.json"] = JSON.stringify({
    name: brand.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-lp",
    version: "1.0.0",
    type: "module",
    scripts: { dev: "astro dev", build: "astro build", preview: "astro preview" },
    dependencies: { astro: "^5.2.0" },
  }, null, 2);

  // ─── astro.config.mjs ─────────────────────────────────
  files["astro.config.mjs"] = `import { defineConfig } from 'astro/config';
export default defineConfig({
  output: 'static',
  site: 'https://${domain}',
  build: { assets: '_assets' },
});
`;

  // ─── src/pages/index.astro (LANDING PAGE) ─────────────
  files["src/pages/index.astro"] = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brand} — ${loanLabel} up to $${amountMax.toLocaleString()}</title>
  <meta name="description" content="${sub}" />
  <meta name="robots" content="noindex, nofollow" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=${fontImport}&display=swap" rel="stylesheet" />
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    :root{
      --primary:${primaryHsl};--primary-light:${primaryLightHsl};--primary-dark:${primaryDarkHsl};
      --primary-glow:${primaryGlow};--accent:${accentHsl};--accent-light:${accentLightHsl};
      --accent-glow:${accentGlow};--success:#27ae60;
      --bg:#faf9f7;--bg-warm:#f5f0eb;--fg:#1a1a2e;--fg-secondary:#4a4a5a;
      --muted:#8a8a9a;--border:#e8e5e0;--card:#fff;--radius:16px;--radius-sm:10px;
      --font:${fontFamily};
    }
    html{scroll-behavior:smooth}
    body{font-family:var(--font);line-height:1.6;color:var(--fg);background:var(--bg);-webkit-font-smoothing:antialiased;overflow-x:hidden}
    .container{max-width:1120px;margin:0 auto;padding:0 16px}
    a{color:inherit;text-decoration:none}

    .header{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(26,26,46,.97);backdrop-filter:blur(12px);height:52px;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid rgba(255,255,255,.08)}
    .header-inner{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:1120px;margin:0 auto}
    .logo{font-size:17px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px}
    .logo-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent-glow)}
    .header-phone{display:flex;align-items:center;gap:4px;color:rgba(255,255,255,.7);font-size:12px;font-weight:600}
    .header-phone svg{width:14px;height:14px}

    .hero{padding:60px 0 32px;background:linear-gradient(170deg,#1a1a2e 0%,#0f3460 100%);color:#fff;position:relative;overflow:hidden}
    .hero::before{content:'';position:absolute;top:-100px;right:-80px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,hsla(${pH},${pS}%,${pL}%,.2) 0%,transparent 70%)}
    .hero-content{position:relative;z-index:2}
    .hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);padding:5px 12px;border-radius:50px;font-size:11px;font-weight:600;margin-bottom:12px}
    .hero-badge-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.7)}}
    .hero h1{font-size:26px;font-weight:800;line-height:1.1;letter-spacing:-.8px;margin-bottom:8px}
    .hero h1 .hl{background:linear-gradient(135deg,var(--accent),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .hero-sub{font-size:14px;opacity:.65;margin-bottom:16px;line-height:1.5}

    .hero-form{background:#fff;border-radius:16px;padding:20px;box-shadow:0 16px 48px rgba(0,0,0,.2);color:var(--fg);position:relative}
    .hero-form::before{content:'';position:absolute;top:-2px;left:24px;right:24px;height:3px;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:0 0 3px 3px}
    .form-title{font-size:16px;font-weight:800;text-align:center;margin-bottom:4px}
    .form-subtitle{font-size:11px;color:var(--muted);text-align:center;margin-bottom:14px}
    .amount-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px}
    .amt-btn{padding:9px 2px;border-radius:8px;font-size:13px;font-weight:700;border:2px solid var(--border);background:#fff;cursor:pointer;transition:all .15s;color:var(--fg);font-family:var(--font)}
    .amt-btn:hover{border-color:var(--primary);color:var(--primary)}
    .amt-btn.active{background:var(--primary);color:#fff;border-color:var(--primary);box-shadow:0 2px 8px var(--primary-glow)}
    .form-slider{width:100%;height:6px;border-radius:3px;background:var(--border);-webkit-appearance:none;appearance:none;cursor:pointer;margin:6px 0 2px}
    .form-slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid var(--primary);box-shadow:0 2px 6px rgba(0,0,0,.15);cursor:pointer}
    .slider-labels{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:14px}
    .slider-current{font-size:18px;font-weight:800;color:var(--fg)}
    .form-group{margin-bottom:10px}
    .form-group label{display:block;font-size:12px;font-weight:600;margin-bottom:3px}
    .form-input{width:100%;height:44px;padding:0 12px;border:2px solid var(--border);border-radius:var(--radius-sm);font-size:15px;font-family:var(--font);transition:all .2s;background:var(--bg)}
    .form-input:focus{outline:none;border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px var(--primary-glow)}
    .form-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .form-submit{width:100%;height:50px;margin-top:6px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;border:none;border-radius:var(--radius-sm);font-size:16px;font-weight:800;font-family:var(--font);cursor:pointer;transition:all .25s;box-shadow:0 4px 20px var(--primary-glow);display:flex;align-items:center;justify-content:center;gap:8px}
    .form-submit:hover{box-shadow:0 8px 32px var(--primary-glow);transform:translateY(-1px)}
    .form-submit:active{transform:scale(.98)}
    .form-trust{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:10px;font-size:10px;color:var(--muted)}
    .form-trust span{display:flex;align-items:center;gap:3px}
    .form-trust svg{width:12px;height:12px;opacity:.5}

    .proof-bar{background:#fff;border-bottom:1px solid var(--border);padding:16px 0}
    .proof-scroll{display:flex;gap:20px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:0 4px}
    .proof-scroll::-webkit-scrollbar{display:none}
    .proof-item{display:flex;align-items:center;gap:8px;white-space:nowrap;font-size:13px;font-weight:600;color:var(--fg-secondary);flex-shrink:0}

    .section{padding:48px 0}
    .section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--primary);margin-bottom:8px}
    .section-title{font-size:22px;font-weight:800;letter-spacing:-.8px;margin-bottom:12px;line-height:1.15}
    .section-desc{font-size:14px;color:var(--fg-secondary);margin-bottom:28px}

    .steps-grid{display:flex;flex-direction:column;gap:16px}
    .step-card{display:flex;gap:16px;align-items:flex-start;background:var(--card);border-radius:14px;padding:20px;border:1px solid var(--border)}
    .step-num{width:38px;height:38px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,var(--primary),var(--primary-light));color:#fff;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px var(--primary-glow)}
    .step-card h3{font-size:15px;font-weight:700;margin-bottom:4px}
    .step-card p{font-size:13px;color:var(--fg-secondary);line-height:1.5}

    .calc-section{background:var(--bg-warm)}
    .calc-card{background:var(--card);border-radius:16px;padding:24px 20px;box-shadow:0 1px 3px rgba(0,0,0,.06);border:1px solid var(--border)}
    .calc-result{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px;padding-top:20px;border-top:2px solid var(--border)}
    .calc-result-item{text-align:center}
    .calc-result-value{font-size:22px;font-weight:800;color:var(--primary);letter-spacing:-.5px}
    .calc-result-label{font-size:10px;color:var(--muted);margin-top:2px}

    .benefits-grid{display:flex;flex-direction:column;gap:12px}
    .benefit-card{display:flex;gap:14px;background:var(--card);border-radius:14px;padding:18px;border:1px solid var(--border)}
    .benefit-icon{width:42px;height:42px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;background:linear-gradient(135deg,hsla(${pH},${pS}%,${pL}%,.08),hsla(${pH},${pS}%,${pL}%,.03))}
    .benefit-card h4{font-size:14px;font-weight:700;margin-bottom:3px}
    .benefit-card p{font-size:12px;color:var(--fg-secondary);line-height:1.5}

    .faq-item{border-bottom:1px solid var(--border)}
    .faq-q{width:100%;display:flex;align-items:center;justify-content:space-between;padding:16px 0;font-size:14px;font-weight:700;background:none;border:none;cursor:pointer;color:var(--fg);font-family:var(--font);text-align:left}
    .faq-icon{width:24px;height:24px;border-radius:50%;background:var(--bg-warm);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .3s;font-size:14px;color:var(--muted)}
    .faq-item.open .faq-icon{background:var(--primary);color:#fff;transform:rotate(45deg)}
    .faq-a{max-height:0;overflow:hidden;transition:max-height .35s ease;font-size:13px;color:var(--fg-secondary);line-height:1.6}
    .faq-item.open .faq-a{max-height:300px;padding-bottom:16px}

    .sticky-cta{position:fixed;bottom:0;left:0;right:0;z-index:90;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border-top:1px solid var(--border);padding:10px 16px;display:flex;align-items:center;gap:12px;transform:translateY(100%);transition:transform .4s cubic-bezier(.16,1,.3,1)}
    .sticky-cta.visible{transform:translateY(0)}
    .sticky-cta-text{font-size:12px;font-weight:600;flex:1}
    .sticky-cta-text small{display:block;font-size:10px;color:var(--muted);font-weight:400}
    .sticky-cta .btn-sm{background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:800;border:none;cursor:pointer;font-family:var(--font);white-space:nowrap;box-shadow:0 3px 12px var(--primary-glow)}

    .popup-overlay{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:opacity .3s}
    .popup-overlay.active{opacity:1;pointer-events:auto}
    .popup-card{background:#fff;border-radius:20px;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;position:relative;box-shadow:0 32px 80px rgba(0,0,0,.3);animation:popup-in .35s cubic-bezier(.16,1,.3,1)}
    @keyframes popup-in{from{opacity:0;transform:translateY(30px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
    .popup-close{position:absolute;top:12px;right:12px;z-index:5;width:36px;height:36px;border-radius:50%;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;color:var(--fg-secondary);transition:all .2s}
    .popup-close:hover{background:var(--fg);color:#fff}
    .popup-header{padding:28px 24px 0;text-align:center}
    .popup-header h3{font-size:20px;font-weight:800;margin-bottom:4px}
    .popup-header p{font-size:13px;color:var(--muted)}
    .popup-body{padding:20px 24px 28px;font-size:13px;color:var(--fg-secondary);line-height:1.8}
    .popup-body p+p{margin-top:14px}

    .cta-section{background:linear-gradient(170deg,#1a1a2e,#0f3460);padding:48px 0 100px;text-align:center;color:#fff}
    .cta-section h2{font-size:22px;font-weight:800;letter-spacing:-.5px;margin-bottom:10px}
    .cta-section p{font-size:14px;opacity:.6;margin-bottom:20px}
    .btn-accent{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,var(--accent),hsl(${aH},${Math.max(aS-10,0)}%,${Math.max(aL-10,10)}%));color:#1a1a2e;padding:14px 32px;border-radius:var(--radius-sm);font-size:16px;font-weight:800;border:none;cursor:pointer;box-shadow:0 4px 20px var(--accent-glow);font-family:var(--font);transition:all .25s}
    .btn-accent:hover{transform:translateY(-2px);box-shadow:0 8px 36px var(--accent-glow)}

    .compliance{background:#fff;padding:40px 0;border-top:1px solid var(--border)}
    .compliance-text{font-size:12px;color:var(--fg-secondary);line-height:1.9;text-align:center;max-width:800px;margin:0 auto}
    .compliance-text strong{color:var(--fg)}
    .apr-section-title{font-size:16px;font-weight:800;color:var(--fg);text-align:center;margin:32px 0 8px}
    .apr-section-sub{font-size:13px;color:var(--fg-secondary);text-align:center;margin-bottom:16px}
    .apr-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 auto;max-width:800px}
    .apr-table{width:100%;border-collapse:collapse;font-size:13px;color:var(--fg);border:2px solid var(--fg);border-radius:8px;overflow:hidden}
    .apr-table th{padding:12px 14px;font-weight:800;font-size:12px;background:var(--fg);color:#fff;text-align:left;text-transform:uppercase;letter-spacing:.5px}
    .apr-table td{padding:11px 14px;border-bottom:1px solid var(--border);font-size:13px;font-weight:500}
    .apr-table tbody tr:nth-child(even){background:var(--bg)}
    .apr-table .apr-col{font-weight:700;color:var(--primary)}
    .apr-rep{max-width:800px;margin:16px auto 0;background:#fef9e7;border:2px solid var(--accent);border-radius:10px;padding:16px 20px;font-size:13px;color:var(--fg);line-height:1.7;text-align:center}
    .apr-rep strong{color:var(--primary)}

    .footer{background:#1a1a2e;color:rgba(255,255,255,.5);padding:24px 0;text-align:center;font-size:11px;line-height:1.8}
    .footer a{color:rgba(255,255,255,.7);text-decoration:underline}
    .footer strong{color:rgba(255,255,255,.8)}

    @media(min-width:769px){
      .container{padding:0 24px}
      .header{height:60px}
      .hero{padding:120px 0 80px}
      .hero-grid{display:grid;grid-template-columns:1fr 440px;gap:56px;align-items:center}
      .hero h1{font-size:clamp(2.2rem,4vw,3.2rem)}
      .hero-sub{font-size:16px}
      .hero-stats{display:flex;gap:40px;margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,.1)}
      .hero-stat-value{font-size:26px;font-weight:800}
      .hero-stat-label{font-size:12px;opacity:.5}
      .hero-form{padding:28px;border-radius:20px}
      .form-title{font-size:18px}
      .proof-scroll{justify-content:center;gap:40px}
      .section{padding:72px 0}
      .section-title{font-size:clamp(1.6rem,3vw,2.2rem)}
      .steps-grid{flex-direction:row;gap:20px}
      .step-card{flex-direction:column;flex:1;padding:28px}
      .benefits-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
      .faq-list{max-width:680px;margin:0 auto}
      .calc-card{padding:40px;max-width:680px;margin:0 auto}
      .calc-result-value{font-size:28px}
      .sticky-cta{display:none}
      .cta-section{padding:72px 0}
      .header-nav{display:flex;align-items:center;gap:28px}
      .header-nav a{font-size:13px;font-weight:600;color:rgba(255,255,255,.7);transition:color .2s}
      .header-nav a:hover{color:#fff}
      .header-nav .nav-cta{background:var(--primary);color:#fff;padding:8px 18px;border-radius:8px;font-weight:700;box-shadow:0 2px 8px var(--primary-glow)}
    }
    @media(max-width:768px){
      .header-nav{display:none}
      .hero-stats{display:none}
      .hero-grid{display:flex;flex-direction:column;gap:20px}
    }
  </style>
</head>
<body>
  <header class="header"><div class="header-inner">
    <a href="#" class="logo"><span class="logo-dot"></span> ${brand}</a>
    <nav class="header-nav"><a href="#how">How It Works</a><a href="#calculator">Calculator</a><a href="#faq">FAQ</a><a href="#apply" class="nav-cta">${cta} →</a></nav>
    <a href="tel:${phone}" class="header-phone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>Call</a>
  </div></header>

  <section class="hero" id="apply"><div class="container"><div class="hero-grid">
    <div class="hero-content" style="order:1">
      <div class="hero-badge"><span class="hero-badge-dot"></span> ${badge}</div>
      <h1>${h1.includes(' ') ? h1.replace(/(\S+)$/, '<span class="hl">$1</span>') : h1}</h1>
      <p class="hero-sub">${sub} Check your rate — no credit impact.</p>
      <div class="hero-stats">
        <div><div class="hero-stat-value">${aprMin}%</div><div class="hero-stat-label">Starting APR</div></div>
        <div><div class="hero-stat-value">2 min</div><div class="hero-stat-label">To apply</div></div>
        <div><div class="hero-stat-value">24hr</div><div class="hero-stat-label">Funding</div></div>
      </div>
    </div>
    <div style="order:0"><div class="hero-form">
      <div class="form-title">How much do you need?</div>
      <div class="form-subtitle">No impact on your credit score</div>
      <form id="heroForm">
        <div class="amount-grid" id="amountBtns">
          ${amtButtons.map((a, i) => `<button type="button" data-amount="${a}" class="amt-btn${i === 2 ? ' active' : ''}">${fmtBtn(a)}</button>`).join('\n          ')}
        </div>
        <input type="range" class="form-slider" id="amountSlider" min="${amountMin}" max="${amountMax}" step="100" value="${amtButtons[2]}" />
        <div class="slider-labels"><span>$${amountMin.toLocaleString()}</span><span class="slider-current" id="sliderValue">$${amtButtons[2].toLocaleString()}</span><span>$${amountMax.toLocaleString()}</span></div>
        <div class="form-row">
          <div class="form-group"><label>Email</label><input type="email" class="form-input" placeholder="you@email.com" required id="emailInput" /></div>
          <div class="form-group"><label>ZIP Code</label><input type="text" class="form-input" placeholder="00000" maxlength="5" pattern="[0-9]{5}" required /></div>
        </div>
        <button type="submit" class="form-submit">${cta} →</button>
        <div class="form-trust">
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>SSL</span>
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Secure</span>
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>No credit impact</span>
        </div>
      </form>
    </div></div>
  </div></div></section>

  <div class="proof-bar"><div class="container"><div class="proof-scroll">
    <div class="proof-item">🛡️ Licensed 42 states</div>
    <div class="proof-item">⭐ 4.8/5 rating</div>
    <div class="proof-item">⚡ Same-day approval</div>
    <div class="proof-item">💰 $180M+ funded</div>
  </div></div></div>

  <section class="section" id="how"><div class="container">
    <div class="section-label">● How It Works</div>
    <div class="section-title">Funded in 3 steps</div>
    <div class="section-desc">Application to funding, faster than any bank.</div>
    <div class="steps-grid">
      <div class="step-card"><div class="step-num">1</div><div><h3>Check your rate</h3><p>2-minute form. See offers with no credit impact.</p></div></div>
      <div class="step-card"><div class="step-num">2</div><div><h3>Choose your terms</h3><p>Compare personalized offers. Pick the payment that fits.</p></div></div>
      <div class="step-card"><div class="step-num">3</div><div><h3>Get your funds</h3><p>Accept and receive funds next business day via direct deposit.</p></div></div>
    </div>
  </div></section>

  <section class="section calc-section" id="calculator"><div class="container">
    <div class="section-label">● Calculator</div>
    <div class="section-title">Estimate your payment</div>
    <div class="section-desc">Rates vary by creditworthiness.</div>
    <div class="calc-card">
      <div style="margin-bottom:16px"><label style="font-size:13px;font-weight:700;display:block;margin-bottom:6px">Loan Amount</label>
        <input type="range" class="form-slider" id="calcAmount" min="${amountMin}" max="${amountMax}" step="100" value="${amtButtons[2]}" />
        <div class="slider-labels"><span>$${amountMin >= 1000 ? (amountMin/1000)+'K' : amountMin}</span><span class="slider-current" id="calcAmountVal">$${amtButtons[2].toLocaleString()}</span><span>$${amountMax >= 1000 ? (amountMax/1000)+'K' : amountMax}</span></div>
      </div>
      <div><label style="font-size:13px;font-weight:700;display:block;margin-bottom:6px">Term</label>
        <input type="range" class="form-slider" id="calcTerm" min="12" max="60" step="6" value="36" />
        <div class="slider-labels"><span>12 mo</span><span class="slider-current" id="calcTermVal">36 mo</span><span>60 mo</span></div>
      </div>
      <div class="calc-result">
        <div class="calc-result-item"><div class="calc-result-value" id="calcMonthly">$${repPay}</div><div class="calc-result-label">Monthly</div></div>
        <div class="calc-result-item"><div class="calc-result-value" id="calcTotal">$${repTotal.toLocaleString()}</div><div class="calc-result-label">Total repaid</div></div>
        <div class="calc-result-item"><div class="calc-result-value" id="calcAPR">9.99%</div><div class="calc-result-label">Example APR</div></div>
      </div>
    </div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-label">● Why Us</div><div class="section-title">Built for real people</div><div class="section-desc">Lenders who understand that life happens.</div>
    <div class="benefits-grid">
      <div class="benefit-card"><div class="benefit-icon">📊</div><div><h4>Fixed payments</h4><p>Same amount every month. No variable rates.</p></div></div>
      <div class="benefit-card"><div class="benefit-icon">🏦</div><div><h4>All credit welcome</h4><p>Bad credit? Our partners work with all profiles.</p></div></div>
      <div class="benefit-card"><div class="benefit-icon">🔒</div><div><h4>No prepayment fees</h4><p>Pay off early. Zero penalties, ever.</p></div></div>
      <div class="benefit-card"><div class="benefit-icon">⚡</div><div><h4>Next-day funding</h4><p>Approved in minutes. Money by tomorrow.</p></div></div>
    </div>
  </div></section>

  <section class="section" id="faq" style="background:var(--bg-warm)"><div class="container">
    <div class="section-label">● FAQ</div><div class="section-title">Common questions</div>
    <div class="faq-list">
      <div class="faq-item"><button class="faq-q">Will this affect my credit? <span class="faq-icon">+</span></button><div class="faq-a">No. Soft inquiry only. Hard pull only if you accept an offer.</div></div>
      <div class="faq-item"><button class="faq-q">What amounts are available? <span class="faq-icon">+</span></button><div class="faq-a">$${amountMin.toLocaleString()} to $${amountMax.toLocaleString()} depending on creditworthiness and state.</div></div>
      <div class="faq-item"><button class="faq-q">How fast do I get the money? <span class="faq-icon">+</span></button><div class="faq-a">Same-day approval. Funds deposited within 1 business day.</div></div>
      <div class="faq-item"><button class="faq-q">What are the rates? <span class="faq-icon">+</span></button><div class="faq-a">APR ${aprMin}% to ${aprMax}% based on your profile. You see your exact rate before accepting.</div></div>
      <div class="faq-item"><button class="faq-q">Can I pay off early? <span class="faq-icon">+</span></button><div class="faq-a">Yes. No prepayment penalties.</div></div>
    </div>
  </div></section>

  <section class="cta-section"><div class="container">
    <h2>Ready to get started?</h2><p>Check your rate in under 2 minutes.</p>
    <a href="#apply" class="btn-accent">${cta} Now →</a>
  </div></section>

  <div class="compliance"><div class="container">
    <div class="compliance-text"><strong>⚠️ Important Disclosures</strong><br/>${brand} is not a lender and does not make credit decisions. We connect consumers with lending partners. Loan amounts $${amountMin.toLocaleString()}–$${amountMax.toLocaleString()}. Not available in all states. This is an advertisement.</div>
    <div class="apr-section-title">APR & Loan Cost Disclosure</div>
    <div class="apr-section-sub">Annual Percentage Rate (APR) ranges from <strong style="color:var(--primary)">${aprMin}% to ${aprMax}%</strong>. Actual rate depends on credit score, loan amount, and term.</div>
    <div class="apr-table-wrap"><table class="apr-table">
      <thead><tr><th>Amount</th><th>Term</th><th>APR Range</th><th>Monthly</th><th>Total</th><th>Interest</th></tr></thead>
      <tbody>
        ${aprRows.map(r => `<tr><td><strong>$${r.amt.toLocaleString()}</strong></td><td>${r.term} months</td><td class="apr-col">${aprMin}% – ${aprMax}%</td><td>$${r.minPay.toLocaleString()} – $${r.maxPay.toLocaleString()}</td><td>$${r.minTotal.toLocaleString()} – $${r.maxTotal.toLocaleString()}</td><td>$${r.minInterest.toLocaleString()} – $${r.maxInterest.toLocaleString()}</td></tr>`).join('\n        ')}
      </tbody>
    </table></div>
    <div class="apr-rep"><strong>Representative Example:</strong> A $${repRow.amt.toLocaleString()} loan at 9.99% APR for ${repRow.term} months = <strong>$${repPay}/mo</strong>, total <strong>$${repTotal.toLocaleString()}</strong>, interest <strong>$${repInterest.toLocaleString()}</strong>.</div>
    <div class="compliance-text" style="margin-top:24px"><strong>Privacy:</strong> 256-bit SSL. By submitting you agree to our <a href="#" onclick="openPopup('privacyPopup');return false" style="color:var(--primary);font-weight:600">Privacy Policy</a> and <a href="#" onclick="openPopup('termsPopup');return false" style="color:var(--primary);font-weight:600">Terms</a>.</div>
  </div></div>

  <footer class="footer"><div class="container">
    <strong>${brand}</strong><br/>${address}<br/>
    <a href="tel:${phone}">${phone}</a> · <a href="mailto:${email}">${email}</a><br/><br/>
    © ${new Date().getFullYear()} ${brand} · <a href="#" onclick="openPopup('privacyPopup');return false">Privacy</a> · <a href="#" onclick="openPopup('termsPopup');return false">Terms</a> · <a href="#" onclick="openPopup('contactPopup');return false">Contact</a> · <a href="#" onclick="openPopup('disclPopup');return false">Disclosures</a>
  </div></footer>

  <div class="popup-overlay" id="privacyPopup"><div class="popup-card"><button class="popup-close" onclick="closePopup('privacyPopup')">✕</button><div class="popup-header"><h3>🔒 Privacy Policy</h3><p>Last updated: January ${new Date().getFullYear()}</p></div><div class="popup-body"><p><strong>Information We Collect</strong><br/>We collect personal information you provide (name, email, ZIP, loan preferences) and device/browsing data via cookies.</p><p><strong>How We Use It</strong><br/>To connect you with lending partners matching your criteria, improve our services, and comply with legal obligations.</p><p><strong>Sharing</strong><br/>Shared with lending partners for loan evaluation. Not sold for unrelated marketing.</p><p><strong>Security</strong><br/>256-bit SSL encryption for transmission and storage.</p><p><strong>Your Rights</strong><br/>Contact ${email} to access, correct, or delete your data. California residents have CCPA rights.</p><p><strong>Contact</strong><br/>${brand}, ${address}<br/>${email} | ${phone}</p></div></div></div>

  <div class="popup-overlay" id="termsPopup"><div class="popup-card"><button class="popup-close" onclick="closePopup('termsPopup')">✕</button><div class="popup-header"><h3>📋 Terms of Service</h3><p>Last updated: January ${new Date().getFullYear()}</p></div><div class="popup-body"><p><strong>Service</strong><br/>${brand} is a loan matching service, not a lender. No fees charged.</p><p><strong>Eligibility</strong><br/>Must be 18+, US citizen/resident, have bank account and income.</p><p><strong>Not a Loan Offer</strong><br/>Submitting info doesn't guarantee a loan offer.</p><p><strong>APR</strong><br/>APR ${aprMin}%–${aprMax}%. Terms 12–60 months. Amounts $${amountMin.toLocaleString()}–$${amountMax.toLocaleString()}.</p><p><strong>Credit</strong><br/>Soft inquiry initially (no impact). Hard pull only if you accept an offer.</p></div></div></div>

  <div class="popup-overlay" id="contactPopup"><div class="popup-card"><button class="popup-close" onclick="closePopup('contactPopup')">✕</button><div class="popup-header"><h3>📞 Contact Us</h3></div><div class="popup-body" style="text-align:center"><div style="font-size:40px;margin-bottom:8px">🏢</div><strong style="font-size:16px">${brand}</strong><p>📍 ${address}</p><p>📞 <a href="tel:${phone}" style="color:var(--primary);font-weight:700;font-size:18px">${phone}</a><br/><span style="font-size:12px;color:var(--muted)">Mon–Fri 8AM–8PM EST</span></p><p>✉️ <a href="mailto:${email}" style="color:var(--primary);font-weight:600">${email}</a></p></div></div></div>

  <div class="popup-overlay" id="disclPopup"><div class="popup-card"><button class="popup-close" onclick="closePopup('disclPopup')">✕</button><div class="popup-header"><h3>⚠️ Disclosures</h3></div><div class="popup-body"><p><strong>Lending</strong><br/>${brand} is NOT a lender. Free service connecting consumers with lenders.</p><p><strong>APR</strong><br/>${aprMin}%–${aprMax}% depending on credit, income, amount, term.</p><p><strong>Example</strong><br/>$${repRow.amt.toLocaleString()} at 9.99% for ${repRow.term} months = $${repPay}/mo, total $${repTotal.toLocaleString()}.</p><p><strong>Late Payment</strong><br/>May result in fees and credit score impact.</p><p><strong>States</strong><br/>Not available in all states. Terms may vary.</p></div></div></div>

  <div class="sticky-cta" id="stickyCta"><div class="sticky-cta-text">Loans up to $${amountMax.toLocaleString()}<small>No credit score impact</small></div><a href="#apply" class="btn-sm">${cta}</a></div>

  <script>
    window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
    ${conversionId ? `gtag('js',new Date());gtag('config','${conversionId}');` : ''}

    const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
    const fmt=n=>'$'+Number(n).toLocaleString();

    function openPopup(id){document.getElementById(id).classList.add('active');document.body.style.overflow='hidden'}
    function closePopup(id){document.getElementById(id).classList.remove('active');document.body.style.overflow=''}
    $$('.popup-overlay').forEach(p=>p.addEventListener('click',function(e){if(e.target===this)closePopup(this.id)}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.popup-overlay.active').forEach(p=>closePopup(p.id))});

    const slider=$('#amountSlider'),sliderVal=$('#sliderValue');
    function updateSlider(){sliderVal.textContent=fmt(slider.value);const pct=(slider.value-${amountMin})/${amountMax-amountMin}*100;slider.style.background=\`linear-gradient(to right,var(--primary) \${pct}%,var(--border) \${pct}%)\`;$$('.amt-btn').forEach(b=>b.classList.toggle('active',+b.dataset.amount===+slider.value))}
    slider.addEventListener('input',updateSlider);
    $$('.amt-btn').forEach(b=>b.addEventListener('click',()=>{slider.value=b.dataset.amount;updateSlider()}));
    updateSlider();

    const cA=$('#calcAmount'),cT=$('#calcTerm');
    function updateCalc(){const P=+cA.value,n=+cT.value,r=.0999/12;const M=P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);$('#calcAmountVal').textContent=fmt(P);$('#calcTermVal').textContent=n+' mo';$('#calcMonthly').textContent=fmt(Math.round(M));$('#calcTotal').textContent=fmt(Math.round(M*n));const pA=(P-${amountMin})/${amountMax-amountMin}*100,pT=(n-12)/48*100;cA.style.background=\`linear-gradient(to right,var(--primary) \${pA}%,var(--border) \${pA}%)\`;cT.style.background=\`linear-gradient(to right,var(--primary) \${pT}%,var(--border) \${pT}%)\`}
    cA.addEventListener('input',updateCalc);cT.addEventListener('input',updateCalc);updateCalc();

    $$('.faq-q').forEach(q=>q.addEventListener('click',()=>{const item=q.closest('.faq-item'),w=item.classList.contains('open');$$('.faq-item.open').forEach(i=>i.classList.remove('open'));if(!w)item.classList.add('open')}));

    const stickyCta=$('#stickyCta');
    window.addEventListener('scroll',()=>{stickyCta.classList.toggle('visible',window.scrollY/(document.body.scrollHeight-window.innerHeight)>=.3)},{passive:true});

    let fs=false;$$('#heroForm input').forEach(inp=>inp.addEventListener('focus',()=>{if(!fs){fs=true;gtag('event','conversion',{send_to:'${conversionId}/${formStartLabel}'})}}));
    $('#heroForm').addEventListener('submit',e=>{e.preventDefault();gtag('event','conversion',{send_to:'${conversionId}/${formSubmitLabel}'});localStorage.setItem('lp_amount',slider.value);window.location.href='/apply?amount='+slider.value});
  </script>
</body>
</html>`;

  // ─── src/pages/apply.astro (APPLY PAGE) ──────────────
  files["src/pages/apply.astro"] = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Apply — ${brand}</title>
  <meta name="robots" content="noindex, nofollow" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=${fontImport}&display=swap" rel="stylesheet" />
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    :root{--primary:${primaryHsl};--primary-dark:${primaryDarkHsl};--primary-glow:${primaryGlow};--accent:${accentHsl};--accent-glow:${accentGlow};--success:#27ae60;--bg:#faf9f7;--bg-warm:#f5f0eb;--fg:#1a1a2e;--fg-secondary:#4a4a5a;--muted:#8a8a9a;--border:#e8e5e0;--card:#fff;--radius-sm:10px;--font:${fontFamily}}
    html{scroll-behavior:smooth}body{font-family:var(--font);line-height:1.6;color:var(--fg);background:var(--bg);-webkit-font-smoothing:antialiased;min-height:100vh;display:flex;flex-direction:column}
    .header{background:#1a1a2e;height:52px;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid rgba(255,255,255,.08)}.header-inner{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:1120px;margin:0 auto}
    .logo{font-size:17px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px;text-decoration:none}.logo-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent-glow)}
    .header-secure{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--success)}.header-secure svg{width:14px;height:14px}
    .progress-wrap{background:#fff;border-bottom:1px solid var(--border);padding:12px 16px}.progress-inner{max-width:600px;margin:0 auto}
    .progress-steps{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.progress-step{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--muted)}.progress-step.active{color:var(--primary)}.progress-step.done{color:var(--success)}
    .progress-dot{width:22px;height:22px;border-radius:50%;border:2px solid var(--border);background:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800}
    .progress-step.active .progress-dot{border-color:var(--primary);background:var(--primary);color:#fff}.progress-step.done .progress-dot{border-color:var(--success);background:var(--success);color:#fff}
    .progress-bar-track{height:4px;background:var(--border);border-radius:2px;overflow:hidden}.progress-bar-fill{height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:2px;transition:width .5s;width:33%}
    .apply-main{flex:1;display:flex;flex-direction:column;max-width:640px;width:100%;margin:0 auto;padding:20px 16px 32px}
    .amount-card{background:linear-gradient(135deg,#1a1a2e,#0f3460);border-radius:14px;padding:18px 20px;color:#fff;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between}
    .amount-card-label{font-size:11px;opacity:.6;font-weight:600;text-transform:uppercase;letter-spacing:.5px}.amount-card-value{font-size:28px;font-weight:800;letter-spacing:-1px;margin-top:2px}
    .amount-card-edit{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--accent);background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);padding:6px 12px;border-radius:8px;cursor:pointer;text-decoration:none;transition:all .2s}
    .trust-bar{display:flex;align-items:center;justify-content:center;gap:16px;padding:14px 0;margin-bottom:20px;border:1px solid var(--border);border-radius:12px;background:#fff}
    .trust-item{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--fg-secondary)}.trust-item svg{width:14px;height:14px;color:var(--success)}
    .form-wrapper{background:#fff;border-radius:16px;border:1px solid var(--border);box-shadow:0 4px 24px rgba(0,0,0,.04);overflow:hidden;flex:1;min-height:400px}
    .form-wrapper-header{padding:20px 20px 16px;border-bottom:1px solid var(--border)}.form-wrapper-header h2{font-size:18px;font-weight:800}.form-wrapper-header p{font-size:12px;color:var(--muted);margin-top:2px}
    #lg-form-container{padding:20px;min-height:360px}
    .form-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;gap:12px;color:var(--muted)}
    .form-loading-spinner{width:36px;height:36px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--primary);animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .apply-compliance{margin-top:20px;padding:16px;background:var(--bg-warm);border-radius:12px;font-size:10px;color:var(--muted);line-height:1.8;text-align:center}.apply-compliance strong{color:var(--fg-secondary)}
    .footer{background:#1a1a2e;color:rgba(255,255,255,.5);padding:20px 16px;text-align:center;font-size:11px;line-height:1.8;margin-top:auto}.footer a{color:rgba(255,255,255,.7);text-decoration:underline}.footer strong{color:rgba(255,255,255,.8)}
    .result-card{text-align:center;padding:40px 20px;display:none}.result-card.active{display:block}
    .result-icon{font-size:48px;margin-bottom:12px}.result-title{font-size:22px;font-weight:800;margin-bottom:8px}.result-desc{font-size:14px;color:var(--fg-secondary);line-height:1.6;max-width:400px;margin:0 auto}
    @media(min-width:769px){.apply-main{padding:32px 24px 48px}.amount-card{padding:24px 28px}.amount-card-value{font-size:36px}.form-wrapper-header{padding:24px 28px 20px}#lg-form-container{padding:28px}.trust-bar{gap:24px}}
  </style>
</head>
<body>
  <header class="header"><div class="header-inner"><a href="/" class="logo"><span class="logo-dot"></span> ${brand}</a><div class="header-secure"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Secure Application</div></div></header>
  <div class="progress-wrap"><div class="progress-inner"><div class="progress-steps"><div class="progress-step done" id="pStep1"><div class="progress-dot">✓</div><span>Amount</span></div><div class="progress-step active" id="pStep2"><div class="progress-dot">2</div><span>Apply</span></div><div class="progress-step" id="pStep3"><div class="progress-dot">3</div><span>Offers</span></div></div><div class="progress-bar-track"><div class="progress-bar-fill" id="progressFill"></div></div></div></div>
  <main class="apply-main">
    <div class="amount-card"><div><div class="amount-card-label">Requested Amount</div><div class="amount-card-value" id="displayAmount">$${amtButtons[2].toLocaleString()}</div></div><div><a href="/" class="amount-card-edit">← Change</a></div></div>
    <div class="trust-bar">
      <div class="trust-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>256-bit SSL</div>
      <div class="trust-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>No credit impact</div>
      <div class="trust-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>2-min</div>
    </div>
    <div class="form-wrapper">
      <div class="form-wrapper-header"><h2>Complete Your Application</h2><p>Encrypted and never shared without consent.</p></div>
      <div id="lg-form-container"><div class="form-loading" id="formLoading"><div class="form-loading-spinner"></div><div style="font-size:13px;font-weight:600">Loading secure form...</div></div></div>
      <div class="result-card" id="resultSold"><div class="result-icon">🎉</div><div class="result-title">You've been matched!</div><div class="result-desc">A lending partner was found. You'll be redirected.</div></div>
      <div class="result-card" id="resultRejected"><div class="result-icon">😔</div><div class="result-title">No match found</div><div class="result-desc">No partner could approve your request right now. Try again later.</div></div>
    </div>
    <div class="apply-compliance"><strong>Important:</strong> ${brand} is not a lender. APR ${aprMin}%–${aprMax}%. Not all applicants qualify.</div>
  </main>
  <footer class="footer"><strong>${brand}</strong><br/>${address}<br/><a href="tel:${phone}">${phone}</a> · <a href="mailto:${email}">${email}</a></footer>

  <script>
    const params=new URLSearchParams(location.search);const amount=params.get('amount')||localStorage.getItem('lp_amount')||'${amtButtons[2]}';
    document.getElementById('displayAmount').textContent='$'+Number(amount).toLocaleString();
    window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
    function setProgress(p){document.getElementById('progressFill').style.width=p+'%'}
    function showResult(t,d){document.getElementById('lg-form-container').style.display='none';document.querySelector('.form-wrapper-header').style.display='none';if(t==='sold'){document.getElementById('resultSold').classList.add('active');document.getElementById('pStep2').className='progress-step done';document.getElementById('pStep2').querySelector('.progress-dot').textContent='✓';document.getElementById('pStep3').className='progress-step done';document.getElementById('pStep3').querySelector('.progress-dot').textContent='✓';setProgress(100)}else{document.getElementById('resultRejected').classList.add('active');setProgress(66)}}

    const _lg_form_init_={
      aid:"${aid}",template:"fresh",container:"#lg-form-container",
      hooks:{
        onFormLoad(){var l=document.getElementById('formLoading');if(l)l.style.display='none';gtag('event','conversion',{send_to:'${conversionId}/${formStartLabel}'})},
        onStepChange(d){var s=d?.step||1,t=d?.totalSteps||5;setProgress(33+s/t*34)},
        onSubmit(){setProgress(67);gtag('event','conversion',{send_to:'${conversionId}/${formSubmitLabel}'})},
        onLeadSold(d){showResult('sold',d);gtag('event','purchase',{send_to:'${conversionId}/lead_sold',value:d?.price||0,currency:'USD',transaction_id:d?.leadId})},
        onLeadRejected(d){showResult('rejected',d)},
        onLeadFinished(d){console.log('[LG] Done:',d?.leadId)}
      }
    };
    (function(){var s=document.createElement('script');s.src='https://cdn.leadsgate.com/form/v3/lg-form.min.js';s.async=true;s.onerror=function(){var e=document.getElementById('formLoading');if(e)e.innerHTML='<div style="color:var(--primary);font-weight:600">Unable to load form</div><button onclick="location.reload()" style="margin-top:12px;padding:10px 24px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer">Refresh</button>'};document.body.appendChild(s)})();
  </script>
</body>
</html>`;

  // ─── README.md ─────────────────────────────────────────
  files["README.md"] = `# ${brand} — ${loanLabel}

Mobile-first installment loan landing page with apply page.

## Pages
- \`/\` — Landing page (form above fold on mobile)
- \`/apply\` — LeadsGate form embed with progress tracking

## Features
- Mobile-first, form above the fold
- Sticky CTA at 30% scroll
- APR compliance table (auto-calculated)
- Popup modals (Privacy, Terms, Contact, Disclosures)
- Payment calculator
- LeadsGate form with full hook integration
- Google Ads conversion tracking (${formStartLabel}, ${formSubmitLabel})
${voluumDomain ? `- Voluum tracking (${voluumDomain})` : ''}

## Config
- Brand: ${brand}
- Domain: ${domain}
- Color: ${c.name}
- APR: ${aprMin}%–${aprMax}%
- Amount: $${amountMin.toLocaleString()}–$${amountMax.toLocaleString()}
- AID: ${aid}
`;

  return files;
}
