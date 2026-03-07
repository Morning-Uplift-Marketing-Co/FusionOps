/**
 * Flowbite Loan Template
 * ======================
 * Modern loan LP inspired by Flowbite/Landwind design system.
 * Pure HTML + Tailwind CDN + Flowbite CDN — no build required.
 * Sections: Nav → Hero + Form → Trust Strip → How It Works
 *           → Features → Testimonials → FAQ → CTA → Footer
 */

import { generateScaffold } from '../../shared/scaffold.js';
import { aprTableHTML, disclaimerHTML, legalModalsHTML, modalCSS, modalJS, complianceCSS } from '../../shared/compliance.js';
export function generate(site) {
  const brand     = site.brand     || 'LoanConnect';
  const domain    = site.domain    || 'example.com';
  const h1        = site.h1        || 'Fast Personal Loans Up To $5,000';
  const sub       = site.sub       || 'Get approved in minutes. Funds as fast as next business day. No hard credit check.';
  const cta       = site.cta       || 'Check My Rate';
  const badge     = site.badge     || 'Trusted by 15,000+ borrowers';
  const amountMin = site.amountMin || 100;
  const amountMax = site.amountMax || 5000;
  const aprMin    = site.aprMin    || 5.99;
  const aprMax    = site.aprMax    || 35.99;
  const email     = site.email     || `support@${domain}`;
  const phone     = site.phone     || '1-800-555-0100';
  const aid       = site.aid       || '';
  const redirectUrl     = site.redirectUrl     || '#';
  const conversionId    = site.conversionId    || '';
  const formStartLabel  = site.formStartLabel  || '';
  const formSubmitLabel = site.formSubmitLabel || '';
  const midAmount = Math.round((amountMin + amountMax) / 2);
  const year      = new Date().getFullYear();

  const complianceConfig = { brand, domain, email, phone, amountMin, amountMax, aprMin, aprMax, address: `${domain}` };

  // ── Google Ads tag ──────────────────────────────────────────
  const gtagHead = conversionId ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${conversionId}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${conversionId}');</script>` : '';

  // ── Voluum script ───────────────────────────────────────────
  const voluumScript = site.voluumLanderScript || '';

  const files = {
    ...generateScaffold({ brand, domain }),
  };

  // ── index.astro ─────────────────────────────────────────────
  files['src/pages/index.astro'] = `---
// ${brand} — Flowbite Loan LP
---
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brand} — Personal Loans</title>
  <meta name="description" content="${sub}" />
  <meta name="robots" content="noindex,nofollow" />
  <link rel="canonical" href="https://${domain}/" />

  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50:'#eff6ff',100:'#dbeafe',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af' },
            accent:  { 400:'#fb923c',500:'#f97316',600:'#ea580c' },
          }
        }
      }
    }
  </script>

  <!-- Flowbite CSS -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/flowbite/2.3.0/flowbite.min.css" />

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

  ${gtagHead}
  ${voluumScript}

  <style>
    body { font-family: 'Inter', sans-serif; }
    .hero-gradient { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #1d4ed8 100%); }
    .card-hover { transition: transform .2s, box-shadow .2s; }
    .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,.12); }
    input[type=range] { -webkit-appearance:none; appearance:none; height:8px; border-radius:4px; background:#dbeafe; outline:none; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:24px; height:24px; border-radius:50%; background:#2563eb; cursor:pointer; border:3px solid #fff; box-shadow:0 2px 8px rgba(37,99,235,.4); }
    .faq-answer { max-height:0; overflow:hidden; transition:max-height .35s ease; }
    .faq-answer.open { max-height:300px; }
    ${modalCSS()}
    ${complianceCSS()}
  </style>
</head>

<body class="bg-white text-gray-900 antialiased">

<!-- ── NAVBAR ─────────────────────────────────────────────── -->
<nav class="fixed top-0 w-full z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
  <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
    <span class="font-black text-xl text-primary-700">${brand}</span>
    <div class="hidden md:flex items-center gap-2 text-sm font-semibold text-gray-500">
      <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
      256-bit Secure
    </div>
    <a href="#apply" class="bg-accent-500 hover:bg-accent-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors">
      Apply Now →
    </a>
  </div>
</nav>

<!-- ── HERO ───────────────────────────────────────────────── -->
<section class="hero-gradient pt-20 pb-16 md:pb-24 text-white">
  <div class="max-w-6xl mx-auto px-4 pt-8">
    <div class="grid md:grid-cols-2 gap-12 items-center">
      <!-- Left: Copy -->
      <div>
        <span class="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-4">
          <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          ${badge}
        </span>
        <h1 class="text-3xl md:text-5xl font-black leading-tight mb-4">${h1}</h1>
        <p class="text-white/85 text-lg mb-6">${sub}</p>
        <ul class="space-y-2 mb-8">
          ${['All credit types welcome','2-minute application','No hidden fees','Funds next business day'].map(b =>
            `<li class="flex items-center gap-2 text-white/90 text-sm font-medium">
              <svg class="w-5 h-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
              ${b}
            </li>`
          ).join('\n          ')}
        </ul>
      </div>

      <!-- Right: Form Card -->
      <div id="apply" class="bg-white text-gray-900 rounded-2xl shadow-2xl p-7">
        <p class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">How much do you need?</p>
        <p class="text-4xl font-black text-primary-700 mb-3" id="amtDisplay">$${midAmount.toLocaleString()}</p>
        <input type="range" id="amtSlider" min="${amountMin}" max="${amountMax}" value="${midAmount}" step="100" class="w-full mb-1" />
        <div class="flex justify-between text-xs text-gray-400 font-medium mb-5">
          <span>$${amountMin.toLocaleString()}</span>
          <span>$${amountMax.toLocaleString()}</span>
        </div>
        <label class="block text-sm font-bold text-gray-600 mb-1.5">Your ZIP Code</label>
        <input type="text" id="zipInput" inputmode="numeric" maxlength="5" placeholder="e.g. 90210"
          class="w-full border-2 border-gray-200 focus:border-primary-500 rounded-xl px-4 py-3 text-base font-semibold outline-none mb-4 transition-colors" />
        <button id="ctaBtn" class="w-full bg-accent-500 hover:bg-accent-600 text-white font-black text-lg py-4 rounded-xl transition-colors shadow-lg">
          ${cta} →
        </button>
        <p class="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
          Won't affect your credit score
        </p>
      </div>
    </div>
  </div>
</section>

<!-- ── TRUST STRIP ─────────────────────────────────────────── -->
<section class="bg-gray-50 border-b border-gray-100 py-6">
  <div class="max-w-5xl mx-auto px-4">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
      ${[['⭐','4.8/5 Rating','5,200+ reviews'],['🔒','256-bit SSL','Bank-level security'],['⚡','Fast Approval','Results in minutes'],['✅','No Hard Pull','Soft inquiry only']].map(([icon,title,sub]) =>
        `<div class="py-2">
          <div class="text-2xl mb-1">${icon}</div>
          <div class="font-bold text-sm text-gray-800">${title}</div>
          <div class="text-xs text-gray-500">${sub}</div>
        </div>`
      ).join('\n      ')}
    </div>
  </div>
</section>

<!-- ── HOW IT WORKS ────────────────────────────────────────── -->
<section class="py-16 bg-white">
  <div class="max-w-5xl mx-auto px-4 text-center">
    <span class="inline-block bg-primary-50 text-primary-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-3">How It Works</span>
    <h2 class="text-2xl md:text-3xl font-black mb-10">Get Funded in 3 Simple Steps</h2>
    <div class="grid md:grid-cols-3 gap-6">
      ${[['📝','Apply Online','Fill out our 2-minute form. No impact on your credit score.'],
         ['🔄','Get Matched','Our network of lenders competes for you.'],
         ['💵','Get Funded','Accept your offer. Funds as fast as next business day.']].map(([icon,title,desc], i) =>
        `<div class="card-hover bg-gray-50 rounded-2xl p-8">
          <div class="w-12 h-12 bg-primary-100 text-primary-700 rounded-xl flex items-center justify-center text-2xl mx-auto mb-4">${icon}</div>
          <div class="w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center font-black text-sm mx-auto mb-3">${i+1}</div>
          <h3 class="font-bold text-lg mb-2">${title}</h3>
          <p class="text-gray-500 text-sm">${desc}</p>
        </div>`
      ).join('\n      ')}
    </div>
  </div>
</section>

<!-- ── FEATURES ────────────────────────────────────────────── -->
<section class="py-16 bg-gray-50">
  <div class="max-w-5xl mx-auto px-4">
    <div class="text-center mb-10">
      <span class="inline-block bg-primary-50 text-primary-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-3">Why Choose Us</span>
      <h2 class="text-2xl md:text-3xl font-black">Built for Real People</h2>
    </div>
    <div class="grid md:grid-cols-2 gap-5">
      ${[['⚡','Fast Approval','Get a decision in minutes, not days. We know emergencies can\'t wait.'],
         ['🔒','Bank-Level Security','256-bit encryption. Your data is never sold or shared without consent.'],
         ['✅','Transparent Terms','See your rate before you commit. No hidden fees or surprises.'],
         ['👥','All Credit Welcome','Options available for excellent credit or those rebuilding.']].map(([icon,title,desc]) =>
        `<div class="card-hover flex gap-4 bg-white rounded-2xl p-6 border border-gray-100">
          <div class="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">${icon}</div>
          <div>
            <h3 class="font-bold mb-1">${title}</h3>
            <p class="text-gray-500 text-sm">${desc}</p>
          </div>
        </div>`
      ).join('\n      ')}
    </div>
  </div>
</section>

<!-- ── TESTIMONIALS ────────────────────────────────────────── -->
<section class="py-16 bg-white">
  <div class="max-w-5xl mx-auto px-4 text-center">
    <span class="inline-block bg-primary-50 text-primary-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-3">Reviews</span>
    <h2 class="text-2xl md:text-3xl font-black mb-10">What Our Customers Say</h2>
    <div class="grid md:grid-cols-3 gap-6">
      ${[['Sarah M.','Texas','⭐⭐⭐⭐⭐','Got approved within 10 minutes and money was in my account the next morning. Incredibly fast!'],
         ['James R.','Florida','⭐⭐⭐⭐⭐','No hard credit check made me comfortable applying. The process was totally transparent.'],
         ['Maria G.','California','⭐⭐⭐⭐⭐','After being turned down elsewhere, this service matched me with a lender right away.']].map(([name,loc,stars,text]) =>
        `<div class="card-hover bg-gray-50 rounded-2xl p-6 text-left">
          <div class="text-sm mb-3">${stars}</div>
          <p class="text-gray-700 text-sm mb-4 italic">"${text}"</p>
          <div class="font-bold text-sm">${name}</div>
          <div class="text-xs text-gray-400">${loc}</div>
        </div>`
      ).join('\n      ')}
    </div>
  </div>
</section>

<!-- ── FAQ ────────────────────────────────────────────────── -->
<section class="py-16 bg-gray-50">
  <div class="max-w-3xl mx-auto px-4">
    <div class="text-center mb-10">
      <span class="inline-block bg-primary-50 text-primary-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-3">FAQ</span>
      <h2 class="text-2xl md:text-3xl font-black">Frequently Asked Questions</h2>
    </div>
    <div class="space-y-3">
      ${[['How quickly can I get approved?','Most applicants receive a decision within minutes. Funds can arrive as fast as the next business day after accepting an offer.'],
         ['Will applying affect my credit score?','No. Checking your rate uses a soft inquiry only. A hard inquiry may occur only if you accept an offer from a lender.'],
         ['Are there any hidden fees?','All fees are clearly disclosed before you accept an offer. There are no application or origination fees charged by this service.'],
         ['What are the loan amounts and terms?','Loan amounts range from $${amountMin.toLocaleString()} to $${amountMax.toLocaleString()} with APR from ${aprMin}% to ${aprMax}% and terms from 3 to 60 months.'],
         ['Who is eligible to apply?','US citizens or residents, 18+, with a valid bank account and a source of regular income.']].map(([q,a], i) =>
        `<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button class="faq-btn w-full flex justify-between items-center px-6 py-4 font-bold text-left hover:bg-gray-50 transition-colors" data-idx="${i}">
            <span>${q}</span>
            <svg class="faq-icon w-5 h-5 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div class="faq-answer px-6">
            <p class="text-gray-600 text-sm pb-4">${a}</p>
          </div>
        </div>`
      ).join('\n      ')}
    </div>
  </div>
</section>

<!-- ── CTA BANNER ──────────────────────────────────────────── -->
<section class="py-16 bg-primary-700 text-white text-center">
  <div class="max-w-2xl mx-auto px-4">
    <h2 class="text-2xl md:text-3xl font-black mb-3">Ready to Get Started?</h2>
    <p class="text-white/80 mb-7">Join thousands who found a smarter way to borrow.</p>
    <a href="#apply" class="inline-block bg-accent-500 hover:bg-accent-600 text-white font-black text-lg px-10 py-4 rounded-xl transition-colors shadow-lg">
      ${cta} →
    </a>
  </div>
</section>

<!-- ── APR TABLE ───────────────────────────────────────────── -->
<section class="py-10 bg-white">
  <div class="max-w-4xl mx-auto px-4">
    ${aprTableHTML(complianceConfig)}
  </div>
</section>

<!-- ── FOOTER ──────────────────────────────────────────────── -->
<footer class="bg-gray-900 text-gray-400 py-10">
  <div class="max-w-5xl mx-auto px-4">
    <div class="grid md:grid-cols-3 gap-8 mb-8">
      <div>
        <div class="font-black text-white text-lg mb-2">${brand}</div>
        <p class="text-sm">${sub.slice(0, 80)}...</p>
        <div class="text-xs mt-3">${phone}</div>
        <div class="text-xs">${email}</div>
      </div>
      <div>
        <div class="font-bold text-white mb-3 text-sm uppercase tracking-wide">Legal</div>
        <ul class="space-y-1.5 text-sm">
          <li><button onclick="openPopup('privacyPopup')" class="hover:text-white transition-colors">Privacy Policy</button></li>
          <li><button onclick="openPopup('termsPopup')" class="hover:text-white transition-colors">Terms of Service</button></li>
          <li><button onclick="openPopup('disclPopup')" class="hover:text-white transition-colors">Disclosures</button></li>
          <li><button onclick="openPopup('contactPopup')" class="hover:text-white transition-colors">Contact Us</button></li>
        </ul>
      </div>
      <div>
        <div class="font-bold text-white mb-3 text-sm uppercase tracking-wide">Trust</div>
        <div class="text-sm space-y-1">
          <div>🔒 SSL Secured</div>
          <div>✅ Soft Credit Pull</div>
          <div>💰 No Upfront Fees</div>
        </div>
      </div>
    </div>
    <div class="border-t border-gray-800 pt-6 text-xs">
      <div class="max-w-3xl">
        ${disclaimerHTML(complianceConfig)}
      </div>
      <p class="mt-3">© ${year} ${brand}. All rights reserved.</p>
    </div>
  </div>
</footer>

<!-- ── LEGAL MODALS ────────────────────────────────────────── -->
${legalModalsHTML(complianceConfig)}

<!-- ── SCRIPTS ─────────────────────────────────────────────── -->
<script>
(function(){
  // ── Slider ──
  var slider = document.getElementById('amtSlider');
  var display = document.getElementById('amtDisplay');
  if(slider && display){
    slider.addEventListener('input', function(){
      display.textContent = '$' + Number(this.value).toLocaleString();
    });
  }

  // ── ZIP input ──
  var zipIn = document.getElementById('zipInput');
  if(zipIn){
    zipIn.addEventListener('input', function(){
      this.value = this.value.replace(/\\D/g,'').slice(0,5);
    });
  }

  // ── CTA tracking + redirect ──
  var ctaBtn = document.getElementById('ctaBtn');
  var formStartFired = false;
  document.getElementById('apply').addEventListener('click', function(){
    if(!formStartFired){
      formStartFired = true;
      ${conversionId && formStartLabel ? `gtag('event','conversion',{send_to:'${conversionId}/${formStartLabel}'});` : ''}
    }
  });
  if(ctaBtn){
    ctaBtn.addEventListener('click', function(){
      var zip = zipIn ? zipIn.value : '';
      var amt = slider ? slider.value : '';
      ${conversionId && formSubmitLabel ? `gtag('event','conversion',{send_to:'${conversionId}/${formSubmitLabel}'});` : ''}
      var url = ${JSON.stringify(aid ? `https://api.leadsgate.com/v1/apply?aid=${aid}` : redirectUrl)};
      if(zip) url += (url.includes('?')?'&':'?') + 'zip=' + zip;
      if(amt) url += '&amount=' + amt;
      window.location.href = url;
    });
  }

  // ── FAQ accordion ──
  document.querySelectorAll('.faq-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var answer = this.nextElementSibling;
      var icon = this.querySelector('.faq-icon');
      var isOpen = answer.classList.contains('open');
      document.querySelectorAll('.faq-answer').forEach(function(a){ a.classList.remove('open'); });
      document.querySelectorAll('.faq-icon').forEach(function(i){ i.style.transform = ''; });
      if(!isOpen){
        answer.classList.add('open');
        icon.style.transform = 'rotate(180deg)';
      }
    });
  });

  // ── Scroll depth pixel ──
  var depths = {};
  window.addEventListener('scroll', function(){
    var pct = Math.round(100*(window.scrollY+window.innerHeight)/document.documentElement.scrollHeight);
    [25,50,75,100].forEach(function(d){
      if(pct>=d && !depths[d]){ depths[d]=true; }
    });
  },{passive:true});
})();

${modalJS()}
</script>

<!-- Flowbite JS -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/flowbite/2.3.0/flowbite.min.js"></script>
</body>
</html>`;

  return files;
}
