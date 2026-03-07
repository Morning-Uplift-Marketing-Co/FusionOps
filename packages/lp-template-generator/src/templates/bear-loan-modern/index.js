/**
 * Bear Loan Modern Template
 * Inspired by modern "emergency cash" landing pages with calculator + social proof.
 */

import { COLORS, FONTS } from '../../core/template-registry.js';

function fmtMoney(value) {
  const n = Number(value || 0);
  return `$${n.toLocaleString()}`;
}

function monthlyPayment(principal, apr, months) {
  const p = Number(principal || 0);
  const r = Number(apr || 0) / 100 / 12;
  const m = Number(months || 12);
  if (!p || !m) return 0;
  if (r <= 0) return p / m;
  return (p * r * Math.pow(1 + r, m)) / (Math.pow(1 + r, m) - 1);
}

export function generate(site) {
  const c = COLORS.find((x) => x.id === site.colorId) || COLORS[1];
  const f = FONTS.find((x) => x.id === site.fontId) || FONTS[0];

  const brand = site.brand || 'Bear Loan Now';
  const domain = site.domain || 'example.com';
  const h1 = site.h1 || 'Emergency Cash Made Simple';
  const sub = site.sub || 'Get a decision in minutes with no hard credit check. Funds can arrive by next business day.';
  const cta = site.cta || 'Check Eligibility';
  const amountMin = Number(site.amountMin || 200);
  const amountMax = Number(site.amountMax || 10000);
  const aprMin = Number(site.aprMin || 0);
  const aprMax = Number(site.aprMax || 35.99);
  const email = site.email || `support@${domain}`;
  const redirectUrl = site.redirectUrl || '#apply';
  const conversionId = site.conversionId || site.gtagId || '';
  const formStartLabel = site.formStartLabel || 'form_start';
  const formSubmitLabel = site.formSubmitLabel || 'form_submit';
  const leadCount = site.leadCount || '50,000+';
  const reviewText = site.reviewText || '4.9/5 (5,000+ reviews)';

  const pH = c.p[0], pS = c.p[1], pL = c.p[2];
  const aH = c.a[0], aS = c.a[1], aL = c.a[2];
  const primary = `hsl(${pH} ${pS}% ${pL}%)`;
  const accent = `hsl(${aH} ${aS}% ${aL}%)`;
  const primaryDark = `hsl(${pH} ${pS}% ${Math.max(pL - 14, 12)}%)`;
  const bg = `hsl(${pH} 40% 8%)`;
  const bgSoft = `hsl(${pH} 30% 12%)`;

  const amountMid = Math.round((amountMin + amountMax) / 2);
  const plan5 = monthlyPayment(amountMid, 0, 5);
  const plan12 = monthlyPayment(amountMid, Math.max(aprMin + 15, 15.99), 12);
  const plan24 = monthlyPayment(amountMid, Math.max(aprMin + 20, 19.99), 24);

  const files = {};

  files['package.json'] = JSON.stringify({
    name: `${brand.toLowerCase().replace(/[^a-z0-9]/g, '-')}-lp`,
    version: '1.0.0',
    type: 'module',
    scripts: { dev: 'astro dev', build: 'astro build', preview: 'astro preview' },
    dependencies: { astro: '^5.2.0' },
  }, null, 2);

  files['astro.config.mjs'] = `import { defineConfig } from 'astro/config';
export default defineConfig({
  output: 'static',
  site: 'https://${domain}',
  build: { assets: '_assets' },
});
`;

  files['src/pages/index.astro'] = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brand} — ${h1}</title>
  <meta name="description" content="${sub}" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${f.import}&display=swap" rel="stylesheet">
  <style>
    :root { --bg:${bg}; --bg-soft:${bgSoft}; --primary:${primary}; --accent:${accent}; --text:#eff3ff; --muted:#a9b4d0; --card:rgba(255,255,255,.06); --bd:rgba(255,255,255,.16); }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:${f.family}; background: radial-gradient(1200px 400px at 10% -10%, rgba(120,119,255,.35), transparent), var(--bg); color:var(--text); line-height:1.45; }
    .wrap { width:min(1120px,92vw); margin:auto; }
    .hero { padding:56px 0 34px; }
    .tag { display:inline-flex; gap:8px; align-items:center; font-size:13px; padding:8px 12px; border:1px solid var(--bd); border-radius:999px; background:rgba(255,255,255,.04); }
    h1 { font-size:clamp(34px,6vw,62px); margin:16px 0 10px; line-height:1.03; letter-spacing:-.02em; }
    .sub { color:var(--muted); max-width:720px; font-size:17px; }
    .hero-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:20px; margin-top:26px; }
    .card { background:var(--card); border:1px solid var(--bd); border-radius:18px; padding:20px; backdrop-filter: blur(6px); }
    .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:16px; }
    .kpi { background:rgba(255,255,255,.04); border:1px solid var(--bd); border-radius:14px; padding:14px; text-align:center; font-size:13px; }
    .kpi b { display:block; font-size:20px; margin-bottom:4px; }
    .cta { display:inline-flex; margin-top:16px; border:none; background:linear-gradient(135deg,var(--primary),${primaryDark}); color:#fff; border-radius:12px; padding:14px 18px; font-weight:800; cursor:pointer; text-decoration:none; }
    .calc h3 { margin-bottom:10px; }
    .amount { font-size:28px; font-weight:800; margin:8px 0 10px; }
    .range { width:100%; }
    .plans { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:14px; }
    .plan { border:1px solid var(--bd); border-radius:12px; padding:10px; font-size:12px; background:rgba(255,255,255,.03); }
    .plan b { font-size:17px; display:block; margin:4px 0; }
    .section { padding:30px 0; }
    .title { font-size:28px; margin-bottom:12px; }
    .grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
    .muted { color:var(--muted); }
    .quote { font-size:14px; color:#d8dff5; margin-top:8px; }
    .foot { padding:26px 0 44px; color:var(--muted); font-size:12px; border-top:1px solid var(--bd); margin-top:20px; }
    .apply { margin-top:14px; display:flex; gap:10px; }
    .apply input { flex:1; background:rgba(255,255,255,.06); border:1px solid var(--bd); color:#fff; border-radius:10px; padding:12px; }
    @media (max-width: 900px) {
      .hero-grid, .kpis, .plans, .grid3 { grid-template-columns:1fr; }
      .hero { padding-top:30px; }
    }
  </style>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    gtag('js', new Date());
    ${conversionId ? `gtag('config', '${conversionId}');` : ''}
    function track(eventName){
      try {
        gtag('event', eventName, { event_category: 'lp', event_label: '${brand}' });
      } catch (_e) {}
      try {
        navigator.sendBeacon('https://t.${domain}/e', JSON.stringify({ e: eventName, d: '${domain}', ts: Date.now() }));
      } catch (_e) {}
    }
    function onApplyClick(ev){
      ev.preventDefault();
      track('${formStartLabel}');
      const email = document.getElementById('leadEmail')?.value || '';
      const url = '${redirectUrl}';
      if (url && url !== '#apply') {
        const sep = url.includes('?') ? '&' : '?';
        window.location.href = url + sep + 'email=' + encodeURIComponent(email);
        return;
      }
      alert('Thanks! We will connect you to loan options now.');
      track('${formSubmitLabel}');
    }
    function updateAmount(v){
      const amt = Number(v || ${amountMid});
      document.getElementById('loanAmount').textContent = '$' + amt.toLocaleString();
      document.getElementById('applyBtn').textContent = 'Apply for $' + amt.toLocaleString();
    }
  </script>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="tag">🐻 Join ${leadCount} People Funded This Month</div>
      <h1>${h1}. Get up to ${fmtMoney(amountMax)} by Tomorrow.</h1>
      <p class="sub">${sub}</p>
      <div class="hero-grid">
        <div class="card">
          <div class="kpis">
            <div class="kpi"><b>No</b>Hard Credit Check</div>
            <div class="kpi"><b>Instant</b>Decision</div>
            <div class="kpi"><b>Next Day</b>Funding</div>
          </div>
          <div class="quote">⭐ ${reviewText} · 🔒 256-bit SSL</div>
          <a href="#apply" class="cta" onclick="track('${formStartLabel}')">${cta}</a>
        </div>
        <div class="card calc" id="apply">
          <h3>See Your Monthly Payment</h3>
          <div class="muted">Loan Amount</div>
          <div id="loanAmount" class="amount">${fmtMoney(amountMid)}</div>
          <input class="range" type="range" min="${amountMin}" max="${amountMax}" step="100" value="${amountMid}" oninput="updateAmount(this.value)">
          <div class="plans">
            <div class="plan">Pay in 5<b>${fmtMoney(Math.round(plan5))}/mo</b>APR 0%</div>
            <div class="plan">12 Months<b>${fmtMoney(Math.round(plan12))}/mo</b>APR 15.99%</div>
            <div class="plan">24 Months<b>${fmtMoney(Math.round(plan24))}/mo</b>APR 19.99%</div>
          </div>
          <div class="apply">
            <input id="leadEmail" type="email" placeholder="Your email" required />
            <button id="applyBtn" class="cta" onclick="onApplyClick(event)">Apply for ${fmtMoney(amountMid)}</button>
          </div>
          <div class="muted" style="margin-top:8px;font-size:12px;">No impact on your credit score to check eligibility</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="title">Why Choose ${brand}</h2>
      <div class="grid3">
        <div class="card"><b>Lightning-Fast Approvals</b><p class="muted">Get a decision in minutes with our streamlined process.</p></div>
        <div class="card"><b>Minimal Documentation</b><p class="muted">Simple online application in under 2 minutes.</p></div>
        <div class="card"><b>Clear, Fair Pricing</b><p class="muted">No hidden fees, transparent terms before acceptance.</p></div>
      </div>
    </section>

    <section class="section">
      <h2 class="title">Simple 3-Step Process</h2>
      <div class="grid3">
        <div class="card"><b>1) Quick Application</b><p class="muted">Complete your details online in minutes.</p></div>
        <div class="card"><b>2) Instant Decision</b><p class="muted">Review your result right away.</p></div>
        <div class="card"><b>3) Choose Your Plan</b><p class="muted">Pick terms that match your budget.</p></div>
      </div>
    </section>

    <footer class="foot">
      <p>Representative APR range: ${aprMin}%–${aprMax}%. Loan terms vary by lender and applicant profile.</p>
      <p style="margin-top:8px;">${brand} is a marketing service, not a direct lender. Contact: ${email}</p>
    </footer>
  </main>
</body>
</html>`;

  return files;
}
