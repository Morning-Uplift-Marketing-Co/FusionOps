import { COLORS, FONTS } from '../../core/template-registry.js';

function money(v) {
  return `$${Number(v || 0).toLocaleString()}`;
}

export function generate(site) {
  const c = COLORS.find((x) => x.id === site.colorId) || COLORS[1];
  const f = FONTS.find((x) => x.id === site.fontId) || FONTS[0];
  const brand = site.brand || 'Installment Golden';
  const domain = site.domain || 'example.com';
  const h1 = site.h1 || 'Predictable Monthly Payments';
  const sub = site.sub || 'Check installment offers in 2 minutes. No hard pull to check eligibility.';
  const cta = site.cta || 'Check My Rate';
  const amountMin = Number(site.amountMin || 1000);
  const amountMax = Number(site.amountMax || 12000);
  const amountMid = Math.round((amountMin + amountMax) / 2);
  const conversionId = site.conversionId || site.gtagId || '';
  const formStartLabel = site.formStartLabel || 'form_start';
  const formSubmitLabel = site.formSubmitLabel || 'form_submit';

  const p = `hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}%)`;
  const pDark = `hsl(${c.p[0]} ${c.p[1]}% ${Math.max(c.p[2] - 14, 10)}%)`;
  const a = `hsl(${c.a[0]} ${c.a[1]}% ${c.a[2]}%)`;

  const files = {};
  files['src/pages/index.astro'] = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brand} - Installment Loans</title>
  <meta name="description" content="${sub}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=${f.import}&display=swap" rel="stylesheet" />
  <style>
    :root { --color-primary:${p}; --color-secondary:${pDark}; --color-accent:${a}; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:${f.family}; color:#0f172a; background:#f8fafc; }
    .wrap { width:min(1080px,92vw); margin:0 auto; }
    .hero { padding:56px 0 24px; }
    h1 { font-size:clamp(32px,5vw,56px); line-height:1.05; margin-bottom:10px; }
    .sub { color:#475569; max-width:720px; margin-bottom:20px; }
    .hero-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:18px; }
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:18px; }
    .kpi { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
    .kpi > div { border:1px solid #e2e8f0; border-radius:12px; padding:10px; text-align:center; font-size:12px; }
    .kpi b { display:block; font-size:18px; color:var(--color-primary); }
    .cta { display:inline-flex; border:0; border-radius:12px; background:linear-gradient(135deg,var(--color-primary),var(--color-secondary)); color:#fff; padding:12px 16px; font-weight:800; cursor:pointer; text-decoration:none; }
    .amt { font-size:28px; font-weight:800; margin:10px 0; color:var(--color-primary); }
    input[type="range"] { width:100%; }
    .apply { margin-top:12px; display:flex; gap:10px; }
    .apply input { flex:1; padding:10px; border:1px solid #cbd5e1; border-radius:10px; }
    .section { padding:28px 0; }
    .grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .foot { color:#64748b; font-size:12px; padding:16px 0 36px; }
    @media (max-width: 920px) { .hero-grid, .kpi, .grid3 { grid-template-columns:1fr; } }
  </style>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    ${conversionId ? `gtag('js', new Date()); gtag('config', '${conversionId}');` : ''}
    function track(name){
      try { gtag('event', name); } catch (_e) {}
      try { navigator.sendBeacon('https://t.${domain}/e', JSON.stringify({ e:name, d:'${domain}', ts:Date.now() })); } catch (_e) {}
    }
    function updateAmount(v){
      const n = Number(v || ${amountMid});
      document.getElementById('amt').textContent = '$' + n.toLocaleString();
      document.getElementById('applyBtn').textContent = 'Apply for $' + n.toLocaleString();
    }
    function submitLead(ev){
      ev.preventDefault();
      track('${formStartLabel}');
      track('${formSubmitLabel}');
      alert('Thanks! We will connect you with installment offers.');
    }
  </script>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <h1>${h1}</h1>
      <p class="sub">${sub}</p>
      <div class="hero-grid">
        <div class="card">
          <div class="kpi">
            <div><b>No</b>Hard Pull</div>
            <div><b>2 min</b>Application</div>
            <div><b>24 hr</b>Funding</div>
          </div>
          <a class="cta" href="#apply" onclick="track('${formStartLabel}')">${cta}</a>
        </div>
        <form id="apply" class="card" onsubmit="submitLead(event)">
          <div>Loan Amount</div>
          <div class="amt" id="amt">${money(amountMid)}</div>
          <input type="range" min="${amountMin}" max="${amountMax}" step="100" value="${amountMid}" oninput="updateAmount(this.value)" />
          <div class="apply">
            <input type="email" required placeholder="you@email.com" />
            <button id="applyBtn" class="cta" type="submit">Apply for ${money(amountMid)}</button>
          </div>
        </form>
      </div>
    </section>
    <section class="section">
      <div class="grid3">
        <div class="card"><b>Fixed payments</b><p>Know your monthly amount upfront.</p></div>
        <div class="card"><b>Fast decision</b><p>Offers in minutes from partner lenders.</p></div>
        <div class="card"><b>Transparent terms</b><p>Review APR and fees before accepting.</p></div>
      </div>
    </section>
    <footer class="foot">${brand} is a marketing service and not a direct lender.</footer>
  </main>
</body>
</html>`;
  return files;
}

