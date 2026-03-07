/**
 * HyperUI Loan Template
 * =====================
 * Bold, high-contrast loan LP inspired by HyperUI marketing components.
 * Design: dark hero, bright accents, card-heavy layout, urgency-driven copy.
 * Pure HTML + Tailwind CDN — no build required.
 * Sections: Nav → Hero + Form → Stats Strip → Steps
 *           → Benefits Grid → Social Proof → FAQ → CTA → Footer
 *
 * v2: All custom Tailwind colors replaced with inline styles for iframe preview compatibility
 */

import { generateScaffold } from '../../shared/scaffold.js';
import { aprTableHTML, disclaimerHTML, legalModalsHTML, modalCSS, modalJS, complianceCSS } from '../../shared/compliance.js';

export function generate(site) {
  const brand     = site.brand     || 'CashBridge';
  const domain    = site.domain    || 'example.com';
  const h1        = site.h1        || 'Get the Cash You Need — Today';
  const sub       = site.sub       || 'Fast personal loans from $100 to $5,000. Simple application, quick decisions.';
  const cta       = site.cta       || 'Get My Rate Now';
  const badge     = site.badge     || '★ Rated 4.8/5 by 5,200+ borrowers';
  const amountMin = site.amountMin || 100;
  const amountMax = site.amountMax || 5000;
  const aprMin    = site.aprMin    || 5.99;
  const aprMax    = site.aprMax    || 35.99;
  const email     = site.email     || `support@${domain}`;
  const phone     = site.phone     || '1-800-555-0100';
  const aid       = site.aid       || '';
  const redirectUrl     = site.redirectUrl     || '#';
  const conversionId    = site.conversionId    || '';
  const formSubmitLabel = site.formSubmitLabel || '';
  const midAmount = Math.round((amountMin + amountMax) / 2);
  const year      = new Date().getFullYear();

  const complianceConfig = { brand, domain, email, phone, amountMin, amountMax, aprMin, aprMax, address: domain };

  const gtagHead = conversionId ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${conversionId}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${conversionId}');</script>` : '';

  const voluumScript = site.voluumLanderScript || '';

  const files = {
    ...generateScaffold({ brand, domain }),
  };

  files['src/pages/index.astro'] = `---
// ${brand} — HyperUI Loan LP
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brand} — Personal Loans Up To $${amountMax.toLocaleString()}</title>
  <meta name="description" content="${sub}" />
  <meta name="robots" content="noindex,nofollow" />
  <link rel="canonical" href="https://${domain}/" />

  <!-- Tailwind CSS CDN (for utility classes) -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

  ${gtagHead}
  ${voluumScript}

  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; margin: 0; }
    html { scroll-behavior: smooth; }

    .hero-bg {
      background: linear-gradient(160deg, #0f1117 0%, #1a1f2e 50%, #0d1f0f 100%);
    }
    .glow-btn {
      box-shadow: 0 0 24px rgba(34,197,94,.4);
      transition: box-shadow .2s, transform .2s;
    }
    .glow-btn:hover {
      box-shadow: 0 0 40px rgba(34,197,94,.6);
      transform: translateY(-2px);
    }
    .card-lift {
      transition: transform .2s, box-shadow .2s;
    }
    .card-lift:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 40px rgba(0,0,0,.12);
    }
    input[type=range] {
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      border-radius: 3px;
      background: #e5e7eb;
      outline: none;
      width: 100%;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #22c55e;
      cursor: pointer;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,.2);
    }
    .faq-body { max-height: 0; overflow: hidden; transition: max-height .3s ease; }
    .faq-body.open { max-height: 400px; }
    ${modalCSS()}
    ${complianceCSS()}
  </style>
</head>

<body style="background:#fff;color:#111827">

<!-- ── NAVBAR ─────────────────────────────────────────────── -->
<header style="background:#0f1117;border-bottom:1px solid rgba(255,255,255,.1);position:fixed;top:0;width:100%;z-index:50">
  <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div style="background:#22c55e;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="color:white;font-weight:900;font-size:14px">${brand[0]}</span>
      </div>
      <span style="color:white;font-weight:900;font-size:18px;letter-spacing:-0.5px">${brand}</span>
    </div>
    <div class="hidden md:flex items-center gap-5" style="font-size:12px;font-weight:500;color:#9ca3af">
      <span class="flex items-center gap-1" style="color:#9ca3af">
        <svg style="color:#4ade80;width:14px;height:14px;flex-shrink:0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
        SSL Secured
      </span>
      <span class="flex items-center gap-1">
        <svg style="color:#4ade80;width:14px;height:14px;flex-shrink:0" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
        No Hard Pull
      </span>
      <span class="flex items-center gap-1">
        <svg style="color:#4ade80;width:14px;height:14px;flex-shrink:0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
        Fast Approval
      </span>
    </div>
    <a href="#apply" style="background:#22c55e;color:white;font-weight:700;font-size:14px;padding:8px 16px;border-radius:8px;text-decoration:none" class="glow-btn">
      Apply Free →
    </a>
  </div>
</header>

<!-- ── HERO ───────────────────────────────────────────────── -->
<section class="hero-bg" style="padding-top:56px;padding-bottom:64px;color:white;min-height:100vh;display:flex;align-items:center">
  <div class="max-w-6xl mx-auto px-4 w-full" style="padding-top:32px">
    <div class="grid lg:grid-cols-5 gap-10 items-center">

      <!-- Left: Copy (3/5) -->
      <div class="lg:col-span-3">
        <div style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);color:#4ade80;display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;padding:6px 12px;border-radius:9999px;margin-bottom:20px">
          <span style="background:#4ade80;width:6px;height:6px;border-radius:50%;display:inline-block"></span>
          ${badge}
        </div>
        <h1 style="font-size:clamp(2rem,5vw,3.5rem);font-weight:900;line-height:1.1;margin-bottom:20px;letter-spacing:-1px;color:white">
          ${h1.replace(' — ', '<br><span style="color:#4ade80">')}${h1.includes(' — ') ? '</span>' : ''}
        </h1>
        <p style="color:#9ca3af;font-size:1.125rem;margin-bottom:32px;max-width:480px;line-height:1.6">${sub}</p>

        <!-- Stats row -->
        <div style="border-top:1px solid rgba(255,255,255,.1);padding-top:32px;margin-bottom:32px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
          ${[['$'+amountMax.toLocaleString(),'Max Loan'],['2 min','Application'],['Next Day','Funding']].map(([val,label]) =>
            `<div>
              <div style="color:#4ade80;font-size:1.5rem;font-weight:900">${val}</div>
              <div style="color:#6b7280;font-size:12px;margin-top:2px;font-weight:500">${label}</div>
            </div>`
          ).join('\n          ')}
        </div>

        <!-- Trust badges -->
        <div class="flex flex-wrap gap-2">
          ${['🔒 256-bit SSL','✅ Soft Inquiry Only','🏦 100+ Lenders','⚡ Instant Matching'].map(b =>
            `<span style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#d1d5db;font-size:12px;font-weight:500;padding:6px 12px;border-radius:9999px">${b}</span>`
          ).join('\n          ')}
        </div>
      </div>

      <!-- Right: Form Card (2/5) -->
      <div id="apply" class="lg:col-span-2">
        <div style="background:white;border-radius:16px;padding:28px;box-shadow:0 25px 50px rgba(0,0,0,.3);border:1px solid #f3f4f6">
          <!-- Amount Picker -->
          <div style="text-align:center;margin-bottom:20px">
            <p style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">I NEED</p>
            <p style="font-size:3rem;font-weight:900;color:#111827;line-height:1" id="amtDisplay">$${midAmount.toLocaleString()}</p>
            <p style="font-size:12px;color:#9ca3af;margin-top:4px">Estimated payment from <span style="color:#16a34a;font-weight:700">$XX/mo</span></p>
          </div>

          <input type="range" id="amtSlider"
            min="${amountMin}" max="${amountMax}" value="${midAmount}" step="100"
            style="margin-bottom:8px" />
          <div class="flex justify-between" style="font-size:12px;color:#9ca3af;font-weight:500;margin-bottom:20px">
            <span>$${amountMin.toLocaleString()}</span>
            <span>$${amountMax.toLocaleString()}</span>
          </div>

          <!-- ZIP input -->
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Your ZIP Code</label>
            <input type="text" id="zipInput" inputmode="numeric" maxlength="5" placeholder="e.g. 10001"
              style="width:100%;border:2px solid #e5e7eb;border-radius:12px;padding:14px 16px;font-size:16px;font-weight:600;outline:none;font-family:inherit;transition:border-color .2s"
              onfocus="this.style.borderColor='#22c55e'" onblur="this.style.borderColor='#e5e7eb'" />
          </div>

          <!-- CTA -->
          <button id="ctaBtn"
            style="background:#22c55e;width:100%;color:white;font-weight:900;font-size:18px;padding:16px;border-radius:12px;border:none;cursor:pointer;font-family:inherit" class="glow-btn">
            ${cta} →
          </button>

          <!-- Social proof -->
          <div style="margin-top:16px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:12px;color:#9ca3af">
            <span class="flex items-center gap-1">
              <svg style="color:#22c55e;width:14px;height:14px" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
              No credit impact
            </span>
            <span>·</span>
            <span>Free service</span>
            <span>·</span>
            <span>2 min</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── STATS STRIP ─────────────────────────────────────────── -->
<section style="background:#16a34a;color:white;padding:32px 0">
  <div class="max-w-5xl mx-auto px-4">
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:24px;text-align:center" class="md:grid-cols-4">
      ${[['15K+','Happy Borrowers'],['$50M+','Loans Matched'],['100+','Lending Partners'],['4.8★','Average Rating']].map(([n,l]) =>
        `<div>
          <div style="font-size:1.875rem;font-weight:900">${n}</div>
          <div style="color:#bbf7d0;font-size:14px;font-weight:500;margin-top:2px">${l}</div>
        </div>`
      ).join('\n      ')}
    </div>
  </div>
</section>

<!-- ── HOW IT WORKS ────────────────────────────────────────── -->
<section style="padding:64px 0;background:#f9fafb">
  <div class="max-w-5xl mx-auto px-4 text-center">
    <p style="color:#16a34a;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Simple Process</p>
    <h2 style="font-size:1.875rem;font-weight:900;margin-bottom:48px;color:#111827">3 Steps to Your Money</h2>
    <div class="grid md:grid-cols-3 gap-8">
      ${[['📋','Fill the Form','Answer a few quick questions about yourself and how much you need. Takes under 2 minutes.'],
         ['🤝','Get Matched','We search our network of 100+ lenders to find you the best rate and terms available.'],
         ['💸','Receive Funds','Accept your offer and get funds deposited as soon as the next business day.']].map(([icon,title,desc], i) =>
        `<div class="relative card-lift" style="background:white;border-radius:16px;padding:32px;border:1px solid #f3f4f6">
          <div style="background:#f0fdf4;width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.875rem;margin:0 auto 16px">
            ${icon}
          </div>
          <div style="background:#dcfce7;color:#15803d;position:absolute;top:20px;right:20px;width:32px;height:32px;border-radius:50%;font-weight:900;font-size:14px;display:flex;align-items:center;justify-content:center">
            ${i+1}
          </div>
          <h3 style="font-weight:700;font-size:18px;margin-bottom:8px;color:#111827">${title}</h3>
          <p style="color:#6b7280;font-size:14px;line-height:1.6">${desc}</p>
        </div>`
      ).join('\n      ')}
    </div>
  </div>
</section>

<!-- ── BENEFITS ────────────────────────────────────────────── -->
<section style="padding:64px 0;background:white">
  <div class="max-w-5xl mx-auto px-4">
    <div class="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
      <div style="margin-bottom:40px" class="lg:mb-0">
        <p style="color:#16a34a;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Why ${brand}</p>
        <h2 style="font-size:1.875rem;font-weight:900;margin-bottom:16px;color:#111827">Borrowing Made Simple</h2>
        <p style="color:#6b7280;margin-bottom:32px;line-height:1.6">We believe getting a loan shouldn't be complicated or stressful. Our platform is designed to get you matched fast with transparent terms.</p>
        <a href="#apply" style="background:#22c55e;color:white;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;display:inline-block">
          Check My Rate →
        </a>
      </div>
      <div style="display:grid;gap:16px">
        ${[['⚡','Lightning Fast','Results in under 2 minutes. Emergency cash when you need it.'],
           ['👁️','Full Transparency','See your complete rate, term, and total cost before you commit. Zero surprises.'],
           ['🌐','Huge Network','100+ lenders competing for your business means better rates for you.'],
           ['🛡️','Privacy Protected','Bank-grade 256-bit encryption. We never sell your data.']].map(([icon,title,desc]) =>
          `<div class="card-lift" style="display:flex;gap:16px;align-items:flex-start;padding:20px;border-radius:16px;border:1px solid #f3f4f6">
            <div style="background:#f0fdf4;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex-shrink:0">
              ${icon}
            </div>
            <div>
              <h3 style="font-weight:700;margin-bottom:4px;color:#111827">${title}</h3>
              <p style="color:#6b7280;font-size:14px">${desc}</p>
            </div>
          </div>`
        ).join('\n        ')}
      </div>
    </div>
  </div>
</section>

<!-- ── SOCIAL PROOF ────────────────────────────────────────── -->
<section style="background:#0f1117;color:white;padding:64px 0">
  <div class="max-w-5xl mx-auto px-4 text-center">
    <p style="color:#4ade80;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Testimonials</p>
    <h2 style="font-size:1.875rem;font-weight:900;margin-bottom:40px">Real People, Real Results</h2>
    <div class="grid md:grid-cols-3 gap-5">
      ${[['D.T.','Ohio','⭐⭐⭐⭐⭐','Needed $1,500 for an emergency car repair. Applied at 9pm, approved by 9:30, money in my account next morning.'],
         ['A.K.','Illinois','⭐⭐⭐⭐⭐','Other sites gave me the runaround. Here I got matched in minutes with a rate I could actually work with.'],
         ['R.S.','Georgia','⭐⭐⭐⭐⭐','Transparent process, no hidden fees. I knew exactly what I was signing before I clicked accept.']].map(([name,loc,stars,text]) =>
        `<div class="card-lift" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;text-align:left">
          <div style="font-size:14px;margin-bottom:12px">${stars}</div>
          <p style="color:#d1d5db;font-size:14px;line-height:1.6;margin-bottom:20px">"${text}"</p>
          <div>
            <div style="font-weight:700;font-size:14px">${name}</div>
            <div style="color:#6b7280;font-size:12px">${loc}</div>
          </div>
        </div>`
      ).join('\n      ')}
    </div>
  </div>
</section>

<!-- ── FAQ ────────────────────────────────────────────────── -->
<section style="padding:64px 0;background:white">
  <div class="max-w-3xl mx-auto px-4">
    <div style="text-align:center;margin-bottom:40px">
      <p style="color:#16a34a;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">FAQ</p>
      <h2 style="font-size:1.875rem;font-weight:900;color:#111827">Common Questions</h2>
    </div>
    <div id="faqList" style="display:flex;flex-direction:column;gap:12px">
      ${[['What loan amounts can I borrow?',`You can borrow between $${amountMin.toLocaleString()} and $${amountMax.toLocaleString()} depending on your creditworthiness and the lender you match with.`],
         ['Is this a soft or hard credit check?','Checking your rate is a soft inquiry only and has zero impact on your credit score. A hard inquiry only occurs after you accept an offer and only with that specific lender.'],
         ['How quickly can I get funded?','Many borrowers receive funds the next business day after accepting their offer. Timing may vary by lender and your bank.'],
         ['What is the APR range?',`Rates range from ${aprMin}% to ${aprMax}% APR depending on credit profile, loan amount, and term chosen.`],
         ['Are there any application fees?','This matching service is completely free. Lenders disclose all fees clearly before you commit to any loan.'],
         ['Who qualifies to apply?','US citizens or permanent residents, 18 years or older, with a regular source of income and an active checking account.']].map(([q,a], i) =>
        `<div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <button class="faq-toggle" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:16px 24px;text-align:left;font-weight:700;font-size:15px;background:transparent;border:none;cursor:pointer;font-family:inherit;color:#111827" data-i="${i}">
            <span>${q}</span>
            <span class="faq-icon" style="flex-shrink:0;width:24px;height:24px;border-radius:50%;border:2px solid #d1d5db;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:14px;margin-left:16px;transition:all .2s">+</span>
          </button>
          <div class="faq-body" style="padding:0 24px">
            <p style="color:#4b5563;font-size:14px;padding-bottom:16px;line-height:1.6">${a}</p>
          </div>
        </div>`
      ).join('\n      ')}
    </div>
  </div>
</section>

<!-- ── FINAL CTA ───────────────────────────────────────────── -->
<section style="background:linear-gradient(135deg,#16a34a 0%,#166534 100%);color:white;padding:80px 0;text-align:center">
  <div class="max-w-2xl mx-auto px-4">
    <div style="font-size:3rem;margin-bottom:16px">💚</div>
    <h2 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:900;margin-bottom:12px">Don't Wait. Apply Free Today.</h2>
    <p style="color:#bbf7d0;font-size:18px;margin-bottom:32px">Join 15,000+ borrowers who found smarter lending with ${brand}.</p>
    <a href="#apply"
      style="display:inline-block;background:white;color:#15803d;font-weight:900;font-size:1.25rem;padding:20px 48px;border-radius:16px;box-shadow:0 25px 50px rgba(0,0,0,.3);text-decoration:none">
      ${cta} →
    </a>
    <p style="color:#86efac;font-size:12px;margin-top:16px">Free · No credit impact · 2-minute form</p>
  </div>
</section>

<!-- ── APR TABLE ───────────────────────────────────────────── -->
<section style="padding:40px 0;background:white">
  <div class="max-w-4xl mx-auto px-4">
    ${aprTableHTML(complianceConfig)}
  </div>
</section>

<!-- ── FOOTER ──────────────────────────────────────────────── -->
<footer style="background:#0f1117;color:#9ca3af;padding:48px 0">
  <div class="max-w-6xl mx-auto px-4">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:40px;margin-bottom:32px;padding-bottom:32px;border-bottom:1px solid rgba(255,255,255,.1)">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <div style="background:#22c55e;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <span style="color:white;font-weight:900;font-size:12px">${brand[0]}</span>
          </div>
          <span style="color:white;font-weight:900">${brand}</span>
        </div>
        <p style="font-size:14px;line-height:1.6;margin-bottom:12px">${sub}</p>
        <p style="font-size:12px">${phone}</p>
        <p style="font-size:12px">${email}</p>
      </div>
      <div>
        <p style="color:white;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px">Legal</p>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;font-size:14px">
          <li><button onclick="openPopup('privacyPopup')" style="color:#9ca3af;background:none;border:none;cursor:pointer;font-family:inherit;font-size:14px;padding:0">Privacy Policy</button></li>
          <li><button onclick="openPopup('termsPopup')" style="color:#9ca3af;background:none;border:none;cursor:pointer;font-family:inherit;font-size:14px;padding:0">Terms of Service</button></li>
          <li><button onclick="openPopup('disclPopup')" style="color:#9ca3af;background:none;border:none;cursor:pointer;font-family:inherit;font-size:14px;padding:0">Disclosures</button></li>
          <li><button onclick="openPopup('contactPopup')" style="color:#9ca3af;background:none;border:none;cursor:pointer;font-family:inherit;font-size:14px;padding:0">Contact</button></li>
        </ul>
      </div>
      <div>
        <p style="color:white;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px">Trust</p>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:14px">
          <p>🔒 256-bit SSL Encryption</p>
          <p>✅ Soft Credit Pull Only</p>
          <p>💰 No Upfront Fees</p>
          <p>🏦 100+ Lending Partners</p>
        </div>
      </div>
    </div>
    <div style="font-size:12px;max-width:720px">
      ${disclaimerHTML(complianceConfig)}
      <p style="margin-top:12px;color:#4b5563">© ${year} ${brand}. All rights reserved.</p>
    </div>
  </div>
</footer>

<!-- ── LEGAL MODALS ────────────────────────────────────────── -->
${legalModalsHTML(complianceConfig)}

<!-- ── SCRIPTS ─────────────────────────────────────────────── -->
<script>
(function(){
  // ── Amount slider ──
  var slider  = document.getElementById('amtSlider');
  var display = document.getElementById('amtDisplay');
  if(slider && display){
    slider.addEventListener('input', function(){
      display.textContent = '$' + Number(this.value).toLocaleString();
    });
  }

  // ── ZIP filter ──
  var zip = document.getElementById('zipInput');
  if(zip){
    zip.addEventListener('input', function(){
      this.value = this.value.replace(/\\D/g,'').slice(0,5);
    });
  }

  // ── CTA button ──
  var btn = document.getElementById('ctaBtn');
  if(btn){
    btn.addEventListener('click', function(){
      var z = zip ? zip.value : '';
      var a = slider ? slider.value : '';
      ${conversionId && formSubmitLabel ? `gtag('event','conversion',{send_to:'${conversionId}/${formSubmitLabel}'});` : ''}
      var url = ${JSON.stringify(aid ? `https://api.leadsgate.com/v1/apply?aid=${aid}` : redirectUrl)};
      if(z) url += (url.includes('?')?'&':'?') + 'zip=' + z;
      if(a) url += '&amount=' + a;
      window.location.href = url;
    });
  }

  // ── FAQ accordion ──
  document.querySelectorAll('.faq-toggle').forEach(function(btn){
    btn.addEventListener('click', function(){
      var body = this.nextElementSibling;
      var icon = this.querySelector('.faq-icon');
      var open = body.classList.contains('open');
      document.querySelectorAll('.faq-body').forEach(function(b){ b.classList.remove('open'); });
      document.querySelectorAll('.faq-icon').forEach(function(i){
        i.textContent='+';
        i.style.background='';
        i.style.color='#6b7280';
        i.style.borderColor='#d1d5db';
      });
      if(!open){
        body.classList.add('open');
        icon.textContent = '−';
        icon.style.background = '#22c55e';
        icon.style.color = 'white';
        icon.style.borderColor = '#22c55e';
      }
    });
  });
})();

${modalJS()}
</script>

</body>
</html>`;

  return files;
}
