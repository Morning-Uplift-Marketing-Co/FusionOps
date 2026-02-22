import { COLORS, FONTS, RADIUS, LOAN_TYPES } from "../constants";

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  // Only allow http, https, and anchor protocols
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('#') || trimmed.startsWith('/')) {
    return esc(trimmed);
  }
  return '#';
}

function validConversionId(id) {
  return id && /^AW-\d+$/i.test(id);
}

// Real US business addresses (coworking/virtual office locations verifiable on Google Maps)
const BUSINESS_ADDRESSES = [
  { street: "1209 Orange St", city: "Wilmington", state: "DE", zip: "19801" },
  { street: "251 Little Falls Dr", city: "Wilmington", state: "DE", zip: "19808" },
  { street: "8 The Green, Ste A", city: "Dover", state: "DE", zip: "19901" },
  { street: "30 N Gould St, Ste R", city: "Sheridan", state: "WY", zip: "82801" },
  { street: "1603 Capitol Ave, Ste 310", city: "Cheyenne", state: "WY", zip: "82001" },
  { street: "5830 E 2nd St, Ste 7000", city: "Casper", state: "WY", zip: "82609" },
  { street: "1007 N Orange St, 4th Fl", city: "Wilmington", state: "DE", zip: "19801" },
  { street: "16192 Coastal Hwy", city: "Lewes", state: "DE", zip: "19958" },
  { street: "108 West 13th St", city: "Wilmington", state: "DE", zip: "19801" },
  { street: "1712 Pioneer Ave, Ste 500", city: "Cheyenne", state: "WY", zip: "82001" },
  { street: "99 Wall St, Ste 5868", city: "New York", state: "NY", zip: "10005" },
  { street: "8 The Green, Ste 14095", city: "Dover", state: "DE", zip: "19901" },
];

function pickAddress(siteId) {
  // Deterministic selection based on site ID hash
  let hash = 0;
  const id = siteId || 'default';
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return BUSINESS_ADDRESSES[Math.abs(hash) % BUSINESS_ADDRESSES.length];
}

export function generateApplyPage(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const brand = esc(site.brand || "LoanBridge");
  const loanLabel = LOAN_TYPES.find(l => l.id === site.loanType)?.label || "Personal Loans";
  const hasGads = validConversionId(site.conversionId);

  const fingerprint = `${site.id?.slice(0, 8) || 'xxxx'}-${Date.now().toString(36)}`;

  // Determine form content — priority: aid (auto LeadsGate) > formEmbed (raw paste) > redirectUrl
  let formContent;
  if (site.aid?.trim()) {
    // Auto-generate LeadsGate form with full tracking callbacks (Module 2 spec)
    formContent = `<script type="text/javascript">
var clickid=new URLSearchParams(window.location.search).get('clickid')||'';
var formStartFired=sessionStorage.getItem('_fs')==='1';
var _lg_form_init_={
  aid:"${esc(site.aid)}",
  template:"fresh",
  click_id:clickid,
  onFormLoad:function(){
    if(!formStartFired){formStartFired=true;sessionStorage.setItem('_fs','1');${hasGads ? `gtag('event','conversion',{send_to:'${site.conversionId}/${esc(site.formStartLabel || '')}'});` : ''}}
    if(window.__pixel)__pixel('fl');
  },
  onStepChange:function(step){if(window.__pixel)__pixel('step',{step:step});},
  onSubmit:function(){
    ${hasGads ? `gtag('event','conversion',{send_to:'${site.conversionId}/${esc(site.formSubmitLabel || '')}'});` : ''}
    if(window.__pixel)__pixel('fs',{clickid:clickid});
  },
  onSuccess:function(response){
    if(window.__pixel)__pixel('success',{clickid:clickid,lead_id:response&&response.lead_id||''});
  }
};
</script>
<script type="text/javascript" async="true" src="https://apikeep.com/form/applicationInit.js"></script>
<div id="_lg_form_"></div>`;
  } else if (site.formEmbed?.trim()) {
    formContent = /<(script|div|iframe|form|link)/i.test(site.formEmbed)
      ? site.formEmbed
      : `<script>${site.formEmbed}</script>`;
  } else if (site.redirectUrl?.trim()) {
    formContent = `<script>window.location.href=${JSON.stringify(sanitizeUrl(site.redirectUrl))};</script>`;
  } else {
    formContent = `<p style="text-align:center;padding:40px;color:#999">No form configured.</p>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Apply - ${brand}</title>
<meta name="robots" content="noindex,nofollow">
<!-- v2|${site.id || 'x'}|${fingerprint} -->
${hasGads ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${site.conversionId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${site.conversionId}');</script>` : '<!-- No Google Ads conversion ID configured -->'}
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:${f.family},system-ui,sans-serif;background:hsl(${c.bg[0]},${c.bg[1]}%,${c.bg[2]}%);min-height:100vh}</style>
</head>
<body>
<script>(function(){var PX='https://t.'+window.location.hostname+'/e';var sid=crypto.randomUUID();var up=new URLSearchParams(window.location.search);var cid=up.get('clickid')||'';var gid=up.get('gclid')||'';function fire(e,d){var p=new URLSearchParams({e:e,sid:sid,cid:cid,gid:gid,ts:Date.now(),url:window.location.pathname,ref:document.referrer});if(d)for(var k in d)p.set(k,d[k]);navigator.sendBeacon(PX,p);}window.__pixel=fire;fire('pv',{ua:navigator.userAgent,sw:screen.width,sh:screen.height});})();</script>
${formContent}
</body>
</html>`;
}

export function generateAstrodeckLoanPreview(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const brand = esc(site.brand || "LoanBridge");
  const loanLabel = LOAN_TYPES.find(l => l.id === site.loanType)?.label || "Personal Loans";
  const h1 = esc(site.h1 || `Get ${loanLabel} up to $${(site.amountMax || 5000).toLocaleString()}`);
  const sub = esc(site.sub || "Compare lender offers in minutes with no impact to your credit score.");
  const badge = esc(site.badge || "No Credit Impact");
  const cta = esc(site.cta || "See My Options");
  const midAmount = Math.round(((site.amountMin || 100) + (site.amountMax || 5000)) / 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand} — AstroDeck Loan Preview</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:${f.family},system-ui,sans-serif;background:hsl(${c.bg[0]},${c.bg[1]}%,${c.bg[2]}%);color:hsl(${c.fg[0]},${c.fg[1]}%,${c.fg[2]}%)}
.hero{padding:56px 20px 26px;background:linear-gradient(180deg,hsl(${c.p[0]},${Math.max(c.p[1] - 25, 25)}%,96%),hsl(${c.bg[0]},${c.bg[1]}%,${c.bg[2]}%))}
.container{max-width:980px;margin:0 auto}
.badge{display:inline-flex;background:hsl(${c.p[0]},${c.p[1]}%,${Math.min(c.p[2] + 45, 90)}%);color:hsl(${c.p[0]},${c.p[1]}%,${Math.max(c.p[2] - 8, 20)}%);padding:6px 12px;border-radius:999px;font-weight:700;font-size:12px;margin-bottom:14px}
h1{font-size:clamp(30px,4.2vw,52px);line-height:1.1;letter-spacing:-.02em;max-width:720px}
.sub{margin-top:12px;font-size:16px;opacity:.85;max-width:680px}
.grid{display:grid;grid-template-columns:1.05fr .95fr;gap:20px;padding:0 20px 28px}
.card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.08);padding:18px}
.k{font-size:12px;color:#6b7280;margin-bottom:6px}.amt{font-size:34px;font-weight:800;color:hsl(${c.p[0]},${c.p[1]}%,${c.p[2]}%);margin-bottom:10px}
input[type=range]{width:100%}.zip{display:flex;gap:8px;margin-top:10px}.zip input{flex:1;border:1px solid #d1d5db;border-radius:12px;padding:12px 14px;font-weight:600}
.btn{border:none;border-radius:12px;padding:12px 16px;background:hsl(${c.s[0]},${c.s[1]}%,${c.s[2]}%);color:#fff;font-weight:800;cursor:pointer;white-space:nowrap}
.trust{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.t{background:#fff;border:1px solid rgba(0,0,0,.07);padding:10px;border-radius:12px;font-size:12px;text-align:center}
@media(max-width:860px){.grid{grid-template-columns:1fr}.trust{grid-template-columns:1fr 1fr 1fr}}
</style>
</head>
<body>
  <section class="hero"><div class="container"><div class="badge">${badge}</div><h1>${h1}</h1><p class="sub">${sub}</p></div></section>
  <section class="container grid">
    <div class="card">
      <div class="k">Loan Type</div><div style="font-weight:700;margin-bottom:8px">${loanLabel}</div>
      <div class="k">How it works</div>
      <ol style="padding-left:18px;line-height:1.8;font-size:14px"><li>Choose your amount</li><li>Enter ZIP code</li><li>See your matched options</li></ol>
      <div class="trust"><div class="t">🔒 SSL Secured</div><div class="t">⏱ 2-Min Form</div><div class="t">✅ Soft Pull</div></div>
    </div>
    <div class="card">
      <div class="k">Estimated amount</div><div class="amt">$${midAmount.toLocaleString()}</div>
      <input type="range" min="${site.amountMin || 100}" max="${site.amountMax || 5000}" value="${midAmount}" step="100" />
      <div class="zip"><input type="text" placeholder="ZIP Code" maxlength="5"><button class="btn">${cta}</button></div>
      <div style="margin-top:10px;font-size:11px;color:#6b7280">Preview: AstroDeck Loan template style</div>
    </div>
  </section>
</body>
</html>`;
}

export function generatePDLLoansV1Preview(site) {
  const brand = esc(site.brand || "PDL Loans V1");
  const amountMin = site.amountMin || 100;
  const amountMax = site.amountMax || 10000;
  const heroCap = 25000;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${brand} — Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <style>
    :root{
      --primary:#2563EB;--accent:#F97316;--success:#16A34A;--dark:#111827;--gray:#F3F4F6;--text:#1F2937;--text-light:#6B7280
    }
    *{box-sizing:border-box}html{scroll-behavior:smooth}
    body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:var(--text);background:#fff}
    .container{max-width:1100px;margin:0 auto;padding:0 16px}
    .sticky{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.95);backdrop-filter:blur(6px);border-bottom:1px solid #e5e7eb}
    .nav{display:flex;align-items:center;justify-content:space-between;height:56px}
    .nav .left{display:flex;align-items:center;gap:8px;font-weight:900}
    .nav .right{display:flex;align-items:center;gap:12px}
    .btn{display:inline-flex;align-items:center;justify-content:center;font-weight:800;border-radius:999px}
    .btn-cta{background:var(--accent);color:#fff;height:36px;padding:0 16px;box-shadow:0 8px 20px rgba(249,115,22,.35)}
    .hero{color:#fff;background:linear-gradient(135deg,var(--primary) 0%, #1D4ED8 100%);padding:64px 0}
    .pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.12);font-size:13px;font-weight:700}
    h1{font-size:clamp(32px,5vw,48px);line-height:1.1;margin:16px 0 8px;font-weight:900}
    .sub{opacity:.95;max-width:720px;margin:0 auto 16px}
    .tpills{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:12px 0 24px}
    .tpills span{border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:6px 10px;font-size:13px}
    .cta{height:56px;padding:0 28px}
    .trustrow{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-width:720px;margin:20px auto 0;opacity:.95}
    .trustrow div{font-size:14px}
    .sec{padding:56px 0}
    .gray{background:var(--gray)}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 2px 10px rgba(17,24,39,.05);padding:16px}
    .grid2{display:grid;grid-template-columns:1fr;gap:12px}
    @media (min-width:768px){.grid2{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .calc .amount{font-weight:900;color:var(--primary);font-size:36px}
    input[type=range]{width:100%;appearance:none;height:6px;border-radius:999px;background:#e5e7eb;margin:8px 0}
    input[type=range]::-webkit-slider-thumb{appearance:none;width:18px;height:18px;border-radius:50%;background:var(--primary);border:3px solid #fff;box-shadow:0 0 0 2px rgba(37,99,235,.2)}
    .plans{display:grid;grid-template-columns:1fr;gap:12px;margin-top:16px}
    @media (min-width:768px){.plans{grid-template-columns:repeat(3,minmax(0,1fr))}}
    .plan{border:1px solid #e5e7eb;border-radius:14px;padding:14px}
    .best{border:2px solid rgba(34,197,94,.2)}.badge{display:inline-block;background:#22C55E;color:#fff;border-radius:999px;font-size:10px;font-weight:900;padding:2px 6px;margin-top:6px}
    details{border:1px solid #e5e7eb;border-radius:10px;padding:12px;background:#fff}
    summary{cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-weight:700}
    footer{background:var(--dark);color:#9CA3AF;padding:40px 0;margin-top:8px}
    footer .brand{color:#fff;font-weight:900}
  </style>
</head>
<body>
  <header class="sticky"><div class="container nav"><div class="left"><span>🐻</span><span>${brand}</span></div><div class="right"><span style="font-size:12px;color:#6B7280;font-weight:700" class="hide-sm">1-800-XXX-XXXX</span><a href="#apply" class="btn btn-cta">Apply Now</a></div></div></header>
  <section class="hero"><div class="container" style="text-align:center">
    <div class="pill">🟢 Join 60,000+ People Who Got Funded This Month</div>
    <h1>Emergency Cash Made Simple. Get up to $${heroCap.toLocaleString()} by Tomorrow.</h1>
    <p class="sub">Fast approval. No hard credit check. Get the funds you need without the wait.</p>
    <div class="tpills"><span>✓ No hard credit check</span><span>✓ Instant decision</span><span>✓ Funds next day</span></div>
    <a href="#apply" class="btn btn-cta cta">Get My Instant Quote →</a>
    <div style="opacity:.9;margin-top:8px;font-size:14px">Apply now — get funded as soon as tomorrow</div>
    <div class="trustrow"><div>⭐ 4.8/5 · 5,200+ reviews</div><div>🔒 256-bit SSL</div><div>✅ No Hard Credit Check</div><div>⚡ Instant Decision</div></div>
  </div></section>

  <section class="sec gray"><div class="container">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><h2 style="margin:0;font-weight:900">What Our Customers Say</h2><div style="font-size:14px;color:#6B7280">⭐ 4.9 from 5,200+ reviews</div></div>
    <div class="grid2">
      <div class="card"><div style="color:#F59E0B;margin-bottom:4px">⭐⭐⭐⭐⭐</div><p>“Got approved within minutes and funds hit my account the next day. Incredibly fast and straightforward.”</p><div style="margin-top:8px;font-size:12px;color:#6B7280">Jamie R., Austin · 2 days ago</div></div>
      <div class="card"><div style="color:#F59E0B;margin-bottom:4px">⭐⭐⭐⭐⭐</div><p>“I loved the no hard credit check and instant decision. Payment options were clear and fair.”</p><div style="margin-top:8px;font-size:12px;color:#6B7280">Carlos M., Tampa · 1 week ago</div></div>
    </div>
    <div class="card" style="margin-top:12px;background:#fff;opacity:.95">⚠ APR ranges from 5% to 35.99%. Actual rate depends on credit. Loan terms range from 61 days to 72 months.</div>
  </div></section>

  <section class="sec"><div class="container calc" style="text-align:center">
    <div style="display:inline-block;font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;background:#F3F4F6;color:#6B7280;margin-bottom:6px">💳 PAYMENT CALCULATOR</div>
    <h2 style="margin:6px 0 4px;font-weight:900">See Your Monthly Payment</h2>
    <p style="color:#6B7280;margin:0 0 8px">Choose your loan amount and see instant payment options</p>
    <div class="amount" id="amtDisp">$${(2000).toLocaleString()}</div>
    <div style="max-width:680px;margin:0 auto">
      <input id="amt" type="range" min="${amountMin}" max="${amountMax}" step="100" value="2000" />
      <div style="display:flex;justify-content:space-between;color:#6B7280;font-size:12px"><span>$${amountMin}</span><span>$${amountMax.toLocaleString()}</span></div>
    </div>
    <div class="plans">
      <div class="plan best"><div style="font-size:12px;color:#6B7280;margin-bottom:4px">Pay in 5</div><div style="font-weight:900;font-size:18px">5 Months <span style="font-size:12px;color:#6B7280">| 0% APR</span></div><div><span id="m5">$400.00</span>/mo</div><div style="font-size:12px;color:#6B7280">Finance: <span id="f5">$0.00</span> · Total: <span id="t5">$2,000.00</span></div><span class="badge">BEST VALUE</span></div>
      <div class="plan"><div style="font-weight:900;font-size:18px">12 Months</div><div><span id="m12">$191.67</span>/mo</div><div style="font-size:12px;color:#6B7280">APR: 14.99% · Finance: <span id="f12">$300.00</span> · Total: <span id="t12">$2,300.00</span></div></div>
      <div class="plan"><div style="font-weight:900;font-size:18px">24 Months</div><div><span id="m24">$103.33</span>/mo</div><div style="font-size:12px;color:#6B7280">APR: 18.99% · Finance: <span id="f24">$480.00</span> · Total: <span id="t24">$2,480.00</span></div></div>
    </div>
    <a href="#apply" id="applyCta" class="btn btn-cta" style="margin-top:12px;height:48px;padding:0 20px">Apply for $2,000</a>
    <div style="color:#6B7280;font-size:12px;margin-top:6px">*Subject to your credit score's final eligibility</div>
  </div></section>

  <section class="sec gray"><div class="container" style="text-align:center">
    <h2 style="margin:0 0 8px;font-weight:900">Why Choose Us</h2>
    <p style="color:#6B7280;max-width:680px;margin:0 auto 16px">Fast approvals, minimal paperwork, and warm support when unexpected expenses can't wait.</p>
    <div class="grid2">
      <div class="card"><div style="font-size:24px;margin-bottom:6px">⚡</div><div style="font-weight:900">Lightning-fast approvals</div><p style="color:#6B7280">Get a decision in minutes during business hours, so you can start moving forward quickly without delayed approval...</p></div>
      <div class="card"><div style="font-size:24px;margin-bottom:6px">📋</div><div style="font-weight:900">Minimal documentation</div><p style="color:#6B7280">Upload just a few documents. No time-consuming stacks of forms or paperwork is taking a month.</p></div>
      <div class="card"><div style="font-size:24px;margin-bottom:6px">🐻</div><div style="font-weight:900">Friendly, teddy-bear support</div><p style="color:#6B7280">Our caring team treats you like family with patient, judgment-free help, at every step of the way.</p></div>
      <div class="card"><div style="font-size:24px;margin-bottom:6px">💲</div><div style="font-weight:900">Clear, fair pricing</div><p style="color:#6B7280">No surprise fees or hidden costs. See your rate and total cost upfront and flexible terms that fit your budget.</p></div>
    </div>
  </div></section>

  <section class="sec" id="faq"><div class="container">
    <div style="display:inline-block;font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;background:#F3F4F6;color:#6B7280;margin-bottom:6px">❓ FAQ</div>
    <h2 style="margin:6px 0 4px;font-weight:900">Frequently Asked Questions</h2>
    <p style="color:#6B7280;margin:0 0 8px">Everything you need to know about installment loans</p>
    ${["How fast can I be approved?","What documents do I need to apply?","Can I qualify if I have fair credit?","Will checking my options affect my credit score?","Are there fees or prepayment penalties?"].map(q=>`<details><summary>${q}<span>▼</span></summary><div style=\"color:#6B7280;margin-top:6px\">Answer coming soon. Placeholder content.</div></details>`).join('')}
  </div></section>

  <section class="sec gray"><div class="container" style="text-align:center">
    <div style="font-size:12px;font-weight:800;color:#6B7280;margin-bottom:8px">🔒 TRUST & SECURE</div>
    <div class="grid2">
      <div class="card"><div style="font-weight:900">🏛 BBB A+ Rated</div><div style="color:#6B7280">Accredited Business</div></div>
      <div class="card"><div style="font-weight:900">🔒 SSL Secured</div><div style="color:#6B7280">256-bit encryption</div></div>
      <div class="card"><div style="font-weight:900">✅ SOC 2 Compliant</div><div style="color:#6B7280">Enterprise security</div></div>
      <div class="card"><div style="font-weight:900">🏦 FDIC Insured</div><div style="color:#6B7280">Partner banks</div></div>
    </div>
    <div style="color:#6B7280;font-size:12px;margin-top:8px">256-bit Encryption | Bank-Level Security | Secure Disclosure | A+ BBB Rating</div>
  </div></section>

  <section class="sec" id="apply"><div class="container" style="text-align:center">
    <h2 style="margin:0 0 6px;font-weight:900">Ready to Apply?</h2>
    <p style="color:#6B7280;margin:0 0 12px">Start your application — it only takes 2 minutes.</p>
    <!-- AFFILIATE LINK: replace href="#" with tracking URL -->
    <a href="#" class="btn btn-cta" style="height:48px;padding:0 20px">Start Application</a>
  </div></section>

  <footer><div class="container"><div class="brand">${brand}</div><div style="margin-top:6px;font-size:12px">Lending: [lender disclosure text] | Available States: [state list] | Powered & Trusted by: [partners]</div><div style="margin-top:16px;font-size:12px">© ${new Date().getFullYear()} ${brand}. All rights reserved.</div></div></footer>

  <script>
    (function(){
      function fmt(n){return '$'+Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
      var s=document.getElementById('amt'); if(!s) return;
      var d=document.getElementById('amtDisp');
      var m5=document.getElementById('m5'), f5=document.getElementById('f5'), t5=document.getElementById('t5');
      var m12=document.getElementById('m12'), f12=document.getElementById('f12'), t12=document.getElementById('t12');
      var m24=document.getElementById('m24'), f24=document.getElementById('f24'), t24=document.getElementById('t24');
      var apply=document.getElementById('applyCta');
      function pay(P, apr, n){ if(apr===0) return {m:P/n, finance:0, total:P}; var r=(apr/100)/12; var m=P*r/(1-Math.pow(1+r,-n)); var total=m*n; return {m, finance: total-P, total}; }
      function rec(){ var P=Number(s.value); d.textContent='$'+P.toLocaleString(); var p5=pay(P,0,5); if(m5){m5.textContent=fmt(p5.m); f5.textContent=fmt(p5.finance); t5.textContent=fmt(p5.total);} var p12=pay(P,14.99,12); if(m12){m12.textContent=fmt(p12.m); f12.textContent=fmt(p12.finance); t12.textContent=fmt(p12.total);} var p24=pay(P,18.99,24); if(m24){m24.textContent=fmt(p24.m); f24.textContent=fmt(p24.finance); t24.textContent=fmt(p24.total);} if(apply){apply.textContent='Apply for ' + ('$'+P.toLocaleString());}}
      s.addEventListener('input', rec); rec();
    })();
  </script>
</body>
</html>`;
}

export function generateLanderCorePreview(site) {
  const c = COLORS.find(x => x.id === (site.colorId || 'ocean')) || COLORS[0];
  const f = FONTS.find(x => x.id === (site.fontId || 'dm-sans')) || FONTS[0];
  const brand = esc(site.brand || "LoanConnect");
  const h1 = esc(site.h1 || "Find Your Best Personal Loan");
  const h1span = esc(site.h1span || "Get funded today.");
  const sub = esc(site.sub || "Compare offers from top lenders in seconds. No impact to your credit score.");
  const cta = esc(site.cta || "Check My Rate");
  const badge = esc(site.badge || "Trusted by 15,000+ borrowers");
  const amountMin = site.amountMin || 100;
  const amountMax = site.amountMax || 5000;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand} — Preview</title>
<style>
:root {
  --primary: ${c.p[0]} ${c.p[1]}% ${c.p[2]}%;
  --secondary: ${c.s[0]} ${c.s[1]}% ${c.s[2]}%;
  --background: ${c.bg[0]} ${c.bg[1]}% ${c.bg[2]}%;
  --foreground: ${c.fg[0]} ${c.fg[1]}% ${c.fg[2]}%;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'${f.family.replace(/"/g, '')}',system-ui,sans-serif;background:hsl(var(--background));color:hsl(var(--foreground));line-height:1.5}
.nav{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:rgba(255,255,255,0.8);backdrop-filter:blur(12px);position:fixed;top:0;width:100%;z-index:50;border-bottom:1px solid rgba(0,0,0,0.05)}
.brand{font-size:20px;font-weight:800;color:hsl(var(--primary))}
.hero{padding:120px 24px 80px;text-align:center;background:linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%);color:#fff;overflow:hidden;position:relative}
.badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:99px;font-size:12px;font-weight:700;text-transform:uppercase;margin-bottom:24px}
h1{font-size:clamp(32px,5vw,56px);font-weight:800;line-height:1.1;margin-bottom:24px}
h1 span{color:hsl(var(--secondary))}
.sub{font-size:18px;max-width:600px;margin:0 auto 40px;opacity:0.9}
.card{background:#fff;padding:32px;border-radius:24px;box-shadow:0 20px 50px rgba(0,0,0,0.15);max-width:440px;margin:0 auto;color:hsl(var(--foreground))}
.amt-display{font-size:36px;font-weight:800;color:hsl(var(--primary));margin-bottom:12px}
.slider{width:100%;height:8px;background:#e5e7eb;border-radius:99px;appearance:none;margin-bottom:24px}
.slider::-webkit-slider-thumb{appearance:none;width:24px;height:24px;background:hsl(var(--primary));border-radius:99px;cursor:pointer;border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.1)}
.btn{display:block;width:100%;padding:18px;background:hsl(var(--primary));color:#fff;font-weight:800;font-size:18px;border:none;border-radius:12px;cursor:pointer;box-shadow:0 10px 20px rgba(0,0,0,0.1);transition:transform 0.2s}
.trust-section{padding:40px 24px;border-bottom:1px solid rgba(0,0,0,0.05);text-align:center}
.trust-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:32px;max-width:900px;margin:0 auto}
.t-item{display:flex;flex-direction:column;align-items:center;gap:4px}
.t-bold{font-weight:800;font-size:14px}
.t-small{font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:600}
.calc-section{padding:80px 24px;background:rgba(0,0,0,0.02)}
.calc-card{background:#fff;border:1px solid rgba(0,0,0,0.05);padding:32px;border-radius:24px;max-width:800px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.03)}
.calc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-top:32px}
.tier{padding:20px;border-radius:16px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.03);text-align:center}
.tier-p{font-size:24px;font-weight:800}
</style>
</head>
<body>
<nav class="nav"><div class="brand">${brand}</div><div style="font-size:12px;font-weight:600;color:#6b7280">🔒 256-bit Secure</div></nav>
<section class="hero">
  <div class="badge">● ${badge}</div>
  <h1>${h1}<br><span>${h1span}</span></h1>
  <p class="sub">${sub}</p>
  <div class="card">
    <div style="font-size:14px;font-weight:700;margin-bottom:8px;color:#6b7280">How much do you need?</div>
    <div class="amt-display">$${amountMax.toLocaleString()}</div>
    <input type="range" class="slider" min="${amountMin}" max="${amountMax}" value="${amountMax}">
    <input type="text" placeholder="ZIP Code" style="width:100%;padding:14px;border:1px solid #d1d5db;border-radius:12px;margin-bottom:20px;font-size:16px">
    <button class="btn">${cta}</button>
  </div>
</section>
<section class="trust-section">
  <div class="trust-grid">
    <div class="t-item"><div class="t-bold">15,000+</div><div class="t-small">Loans Funded</div></div>
    <div class="t-item"><div class="t-bold">4.8/5 Rating</div><div class="t-small">Google Reviews</div></div>
    <div class="t-item"><div class="t-bold">Bank-Level</div><div class="t-small">Security</div></div>
  </div>
</section>
<section class="calc-section">
  <div style="text-align:center;margin-bottom:40px"><h2 style="font-size:28px;font-weight:800">Payment Estimator</h2></div>
  <div class="calc-card">
    <div style="display:flex;justify-content:space-between;margin-bottom:12px"><span style="font-weight:600">Amount</span><span style="font-weight:800;color:hsl(var(--primary))">$${amountMax.toLocaleString()}</span></div>
    <input type="range" class="slider" min="${amountMin}" max="${amountMax}" value="${amountMax}">
    <div class="calc-grid">
      <div class="tier"><div style="font-size:12px;color:#6b7280;margin-bottom:4px">Pay in 6</div><div class="tier-p">$${Math.round(amountMax / 6)}<span style="font-size:14px;font-weight:400">/mo</span></div></div>
      <div class="tier"><div style="font-size:12px;color:#6b7280;margin-bottom:4px">12 Months</div><div class="tier-p">$${Math.round(amountMax * 1.1 / 12)}<span style="font-size:14px;font-weight:400">/mo</span></div><div style="font-size:10px;color:#999">15% APR</div></div>
      <div class="tier"><div style="font-size:12px;color:#6b7280;margin-bottom:4px">24 Months</div><div class="tier-p">$${Math.round(amountMax * 1.25 / 24)}<span style="font-size:14px;font-weight:400">/mo</span></div><div style="font-size:10px;color:#999">28% APR</div></div>
    </div>
  </div>
</section>
</body>
</html>`;
}

export function generateLP(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const r = RADIUS.find(x => x.id === site.radius) || RADIUS[2];
  const brand = esc(site.brand || "LoanBridge");
  const loanLabel = LOAN_TYPES.find(l => l.id === site.loanType)?.label || "Personal Loans";
  const h1 = esc(site.h1 || `Fast ${loanLabel} Up To $${(site.amountMax || 5000).toLocaleString()}`);
  const badge = esc(site.badge || "Trusted by 15,000+ borrowers");
  const cta = esc(site.cta || "Check Your Rate");
  const sub = esc(site.sub || "Get approved in minutes. Funds as fast as next business day.");
  const midAmount = Math.round(((site.amountMin || 100) + (site.amountMax || 5000)) / 2);

  // Fingerprint for tracking only
  const fingerprint = `${site.id?.slice(0, 8) || 'xxxx'}-${Date.now().toString(36)}`;
  const cssVarPrefix = 'lp';
  const hasGads = validConversionId(site.conversionId);

  // Dynamic meta generation — minimal for fast FCP
  const metaTags = [
    `<meta charset="UTF-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1.0">`,
    `<title>${brand} – ${loanLabel} | Fast Approval</title>`,
    `<meta name="description" content="${sub}">`,
    `<meta name="theme-color" content="hsl(${c.p[0]},${c.p[1]}%,${c.p[2]}%)">`,
    `<meta name="robots" content="${site.noindex ? 'noindex,nofollow' : 'index,follow'}">`,
    `<meta property="og:title" content="${brand} — ${loanLabel}">`,
    `<meta property="og:description" content="${sub}">`,
    `<meta property="og:image" content="${site.ogImageDataUrl || `https://${site.domain || 'example.com'}/og.jpg`}">`,
    `<meta property="og:url" content="https://${site.domain || 'example.com'}/">`,
    `<meta property="og:type" content="website">`,
    `<link rel="canonical" href="https://${site.domain || 'example.com'}/">`,
    site.faviconDataUrl
      ? `<link rel="icon" href="${site.faviconDataUrl}" type="image/svg+xml">`
      : `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='hsl(${c.p[0]},${c.p[1]}%25,${c.p[2]}%25)'/><text x='32' y='44' text-anchor='middle' font-family='system-ui' font-size='36' font-weight='800' fill='white'>${brand[0]}</text></svg>" type="image/svg+xml">`,
    `<!-- v2|${site.id || 'x'}|${fingerprint} -->`,
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
${metaTags}
${hasGads ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${site.conversionId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${site.conversionId}');</script>` : ''}
<style>:root{--${cssVarPrefix}-p:${c.p[0]} ${c.p[1]}% ${c.p[2]}%;--${cssVarPrefix}-s:${c.s[0]} ${c.s[1]}% ${c.s[2]}%;--${cssVarPrefix}-a:${c.a[0]} ${c.a[1]}% ${c.a[2]}%;--${cssVarPrefix}-bg:${c.bg[0]} ${c.bg[1]}% ${c.bg[2]}%;--${cssVarPrefix}-fg:${c.fg[0]} ${c.fg[1]}% ${c.fg[2]}%;--${cssVarPrefix}-radius:${r.v}}*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;text-size-adjust:100%}body{font-family:${f.family},system-ui,-apple-system,sans-serif;background:hsl(var(--${cssVarPrefix}-bg));color:hsl(var(--${cssVarPrefix}-fg));-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;font-size:1rem;line-height:1.5}img,svg{display:block;max-width:100%;height:auto}a{color:inherit;text-decoration:none}a:focus-visible,.btn:focus-visible,input:focus-visible{outline:3px solid hsl(var(--${cssVarPrefix}-p));outline-offset:2px;border-radius:4px}.container{width:100%;max-width:1120px;margin:0 auto;padding:0 20px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;border-radius:var(--${cssVarPrefix}-radius);font-weight:700;font-size:1rem;border:none;cursor:pointer;transition:transform .2s,box-shadow .2s;text-decoration:none;min-height:48px;min-width:48px;line-height:1.2}.btn-cta{background:linear-gradient(135deg,hsl(var(--${cssVarPrefix}-a)),hsl(var(--${cssVarPrefix}-a)/.85));color:#fff;box-shadow:0 4px 16px hsl(var(--${cssVarPrefix}-a)/.3)}.btn-cta:hover,.btn-cta:focus-visible{transform:translateY(-1px);box-shadow:0 6px 24px hsl(var(--${cssVarPrefix}-a)/.4)}.btn-cta:active{transform:translateY(0)}.card{background:#fff;border:1px solid hsl(var(--${cssVarPrefix}-fg)/.08);border-radius:var(--${cssVarPrefix}-radius);padding:20px}header{position:fixed;top:0;left:0;right:0;z-index:50;background:rgba(255,255,255,.97);border-bottom:1px solid hsl(var(--${cssVarPrefix}-fg)/.06);contain:layout style}header nav{display:flex;align-items:center;justify-content:space-between;height:60px}header .btn-cta{display:none}@media(min-width:768px){header .btn-cta{display:inline-flex}}.hero{padding:80px 0 40px;background:linear-gradient(135deg,hsl(var(--${cssVarPrefix}-p)),hsl(var(--${cssVarPrefix}-p)/.7));color:#fff;position:relative;overflow:hidden;text-align:center}.hero .grid{display:grid;grid-template-columns:1fr;gap:32px;align-items:center}.badge{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);font-size:.8125rem;color:rgba(255,255,255,.95);margin-bottom:16px}.badge .dot{width:8px;height:8px;border-radius:50%;background:hsl(var(--${cssVarPrefix}-s));animation:pulse 2s infinite}@media(prefers-reduced-motion:reduce){.badge .dot{animation:none}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}h1{font-size:clamp(1.75rem,8vw,3.25rem);font-weight:800;line-height:1.1;margin-bottom:16px;text-wrap:balance}h1 .accent{color:hsl(var(--${cssVarPrefix}-a))}.hero p{font-size:1rem;color:rgba(255,255,255,.8);margin:0 auto 24px;max-width:480px;text-wrap:pretty}.form-card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:var(--${cssVarPrefix}-radius);padding:24px;text-align:left}.form-card h2{font-size:1.125rem;font-weight:700;margin-bottom:4px}.slider-wrap{margin-bottom:20px}.slider-label{display:flex;justify-content:space-between;font-size:.8125rem;margin-bottom:8px}.slider-amount{font-size:1.625rem;font-weight:800;color:hsl(var(--${cssVarPrefix}-a))}input[type=range]{width:100%;height:8px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.15);border-radius:4px;outline:none;cursor:pointer}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:28px;height:28px;border-radius:50%;background:hsl(var(--${cssVarPrefix}-a));cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid #fff}input[type=range]::-moz-range-thumb{width:28px;height:28px;border-radius:50%;background:hsl(var(--${cssVarPrefix}-a));cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid #fff}input[type=range]:focus-visible{outline:3px solid hsl(var(--${cssVarPrefix}-a));outline-offset:2px}.zip-group{margin-top:4px}.zip-input-wrap{display:flex;border-radius:var(--${cssVarPrefix}-radius);overflow:hidden;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.15)}.zip-input-wrap input{flex:1;padding:16px;border:none;background:#fff;color:#1a1a2e;font-size:1rem;font-weight:600;outline:none;min-width:0}.zip-input-wrap input::placeholder{color:#999;font-weight:400}.zip-cta{border:none;padding:16px 28px;font-size:.9375rem;font-weight:700;white-space:nowrap;border-radius:0;cursor:pointer;background:hsl(var(--${cssVarPrefix}-a));color:#fff;transition:opacity .15s}.zip-cta:hover{opacity:.9}.zip-error{font-size:.75rem;color:#fca5a5;margin-top:6px;min-height:18px}.form-trust-note{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;font-size:.75rem;color:rgba(255,255,255,.8);font-weight:600}@media(max-width:480px){.zip-input-wrap{flex-direction:column}.zip-cta{border-radius:0;padding:14px}}.checks{display:flex;flex-direction:column;gap:12px;margin-bottom:20px;align-items:center}.checks li{display:flex;align-items:center;gap:6px;font-size:.8125rem;color:rgba(255,255,255,.8);list-style:none}.check-icon{color:hsl(var(--${cssVarPrefix}-s))}</style>
</head>
<body>

<header role="banner"><div class="container"><nav aria-label="Main navigation">
  <a href="/" aria-label="${brand} homepage" style="font-weight:700">${brand}</a>
  <a href="apply.html" class="btn btn-cta" style="padding:10px 20px;font-size:.875rem">${cta}</a>
</nav></div></header>

<main id="main-content">

<section class="hero" aria-labelledby="hero-heading"><div class="container"><div class="grid">
  <div>
    <p class="badge" aria-label="Trust indicator"><span class="dot" aria-hidden="true"></span> ${badge}</p>
    <h1 id="hero-heading">${h1.replace(/(\$[\d,]+)/g, '<span class="accent">$1</span>')}</h1>
    <p>${sub}</p>
    <ul class="checks" aria-label="Key benefits" role="list">
      <li><span class="check-icon" aria-hidden="true">✓</span> All Credit Welcome</li>
      <li><span class="check-icon" aria-hidden="true">✓</span> 2-Min Application</li>
      <li><span class="check-icon" aria-hidden="true">✓</span> No Hidden Fees</li>
    </ul>
  </div>
  <div class="form-card" role="form" aria-labelledby="form-heading">
    <h2 id="form-heading">How much do you need?</h2>
    <div class="slider-wrap">
      <div class="slider-label"><label for="loan-amount">Amount</label></div>
      <output id="amount-display" class="slider-amount" for="loan-amount" aria-live="polite">$${midAmount.toLocaleString()}</output>
      <input type="range" id="loan-amount" name="amount" min="${site.amountMin || 100}" max="${site.amountMax || 5000}" value="${midAmount}" step="100"
        aria-label="Loan amount from $${(site.amountMin || 100).toLocaleString()} to $${(site.amountMax || 5000).toLocaleString()}"
        aria-valuemin="${site.amountMin || 100}" aria-valuemax="${site.amountMax || 5000}" aria-valuenow="${midAmount}"
        aria-valuetext="$${midAmount.toLocaleString()}">
    </div>
    <div class="zip-group">
      <div class="zip-input-wrap">
        <input type="text" id="zip-input" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" placeholder="Zip Code" autocomplete="postal-code" aria-label="Enter your 5-digit zip code">
        <button type="button" id="zip-btn" class="btn btn-cta zip-cta" aria-label="${cta}">
          ${cta} →
        </button>
      </div>
      <div id="zip-error" class="zip-error" role="alert" aria-live="polite"></div>
    </div>
    <div class="form-trust-note">🔒 256-bit SSL • Won't affect credit score</div>
  </div>
</div></div></section>

<section class="trust-badges" aria-label="Trust badges"><div class="container"><div class="wrap">
  <div class="trust-badge"><strong>🔒 SSL Secured</strong></div>
  <div class="trust-badge"><strong>💰 No Upfront Fees</strong></div>
  <div class="trust-badge"><strong>✅ Soft Credit Pull</strong></div>
  <div class="trust-badge"><strong>🛡️ Licensed Partners</strong></div>
</div></div></section>

<section id="how-it-works" aria-labelledby="steps-heading"><div class="container">
  <div class="section-title">
    <span class="tag">How It Works</span>
    <h2 id="steps-heading">Get Funded in 3 Simple Steps</h2>
    <p>No paperwork. No waiting. Everything happens online.</p>
  </div>
  <ol class="steps" role="list" style="list-style:none">
    <li class="step card"><div class="icon" aria-hidden="true">📝</div><div class="num" aria-hidden="true">1</div><h3>Apply Online</h3><p>Fill out our simple 2-minute form. No impact on your credit score.</p></li>
    <li class="step card"><div class="icon" aria-hidden="true">🔄</div><div class="num" aria-hidden="true">2</div><h3>Get Matched</h3><p>Our network of lenders competes to offer you the best rate.</p></li>
    <li class="step card"><div class="icon" aria-hidden="true">💵</div><div class="num" aria-hidden="true">3</div><h3>Get Funded</h3><p>Accept your offer and receive funds as fast as next business day.</p></li>
  </ol>
</div></section>

<section style="background:#fff" aria-labelledby="benefits-heading"><div class="container">
  <div class="section-title">
    <span class="tag">Why ${brand}</span>
    <h2 id="benefits-heading">Built for Real People</h2>
    <p>We make borrowing simple, transparent, and stress-free.</p>
  </div>
  <ul class="benefits" role="list" style="list-style:none">
    <li class="card benefit"><div style="font-size:2rem;margin-bottom:12px" aria-hidden="true">⚡</div><h3>Fast Approval</h3><p>Get a decision in minutes, not days.</p></li>
    <li class="card benefit"><div style="font-size:2rem;margin-bottom:12px" aria-hidden="true">🔒</div><h3>Bank-Level Security</h3><p>256-bit encryption. We never sell your info.</p></li>
    <li class="card benefit"><div style="font-size:2rem;margin-bottom:12px" aria-hidden="true">✅</div><h3>Transparent Terms</h3><p>No hidden fees. See your rate before you commit.</p></li>
    <li class="card benefit"><div style="font-size:2rem;margin-bottom:12px" aria-hidden="true">👥</div><h3>All Credit Welcome</h3><p>Options for excellent or rebuilding credit.</p></li>
  </ul>
</div></section>

<section aria-labelledby="cta-heading"><div class="container">
  <div class="cta-section">
    <h2 id="cta-heading">Ready to Get Started?</h2>
    <p>Join thousands who've found a smarter way to borrow.</p>
    <a href="apply.html" class="btn btn-cta" style="font-size:1.125rem;padding:16px 40px">${cta}</a>
  </div>
</div></section>

</main>

<footer role="contentinfo"><div class="container">
  <div class="footer-grid">
    <div>
      <a href="/" style="display:flex;align-items:center;gap:8px;margin-bottom:12px" aria-label="${brand} homepage"><span style="font-weight:700">${brand}</span></a>
      <p style="font-size:.8125rem;color:hsl(var(--${cssVarPrefix}-fg)/.5);line-height:1.6">Trusted lenders for ${loanLabel.toLowerCase()} up to $${(site.amountMax || 5000).toLocaleString()}.</p>
      ${(() => { const addr = site.address || pickAddress(site.id); return `<address style="font-style:normal;font-size:.75rem;color:hsl(var(--${cssVarPrefix}-fg)/.4);margin-top:10px">${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}</address>`; })()}
    </div>
    <nav aria-label="Company links"><h4>Company</h4><a href="#how-it-works">How It Works</a><a href="apply.html">Apply Now</a></nav>
    <nav aria-label="Legal links"><h4>Legal</h4><a href="#" data-modal="privacy">Privacy Policy</a><a href="#" data-modal="terms">Terms of Service</a><a href="#" data-modal="disclosures">Disclosures</a><a href="#" data-modal="nmls">NMLS Consumer Access</a></nav>
    <div><h4>Support</h4><a href="mailto:${esc(site.email || "support@" + (site.domain || "example.com"))}">${esc(site.email || "Contact Us")}</a></div>
  </div>
  <div class="compliance">
    <p><strong>APR:</strong> ${site.aprMin || 5.99}%–${site.aprMax || 35.99}%. Example: $1,000 over 12 mo at ${site.aprMin || 5.99}% = $90.26/mo ($1,083.12 total). ${brand} is NOT a lender. &copy; ${new Date().getFullYear()} ${brand}.</p>
  </div>
</div></footer>

<!-- Reusable Legal Modal -->
<div class="modal-overlay" id="legal-modal" role="dialog" aria-labelledby="legal-modal-title" aria-modal="true">
  <div class="modal">
    <div class="modal-header"><h3 id="legal-modal-title">Legal</h3><button class="modal-close" aria-label="Close">&times;</button></div>
    <div class="modal-body" id="legal-modal-body"></div>
  </div>
</div>

<style>section{padding:48px 0;contain:layout style}.section-title{text-align:center;margin-bottom:32px;padding:0 20px}.section-title .tag{display:inline-block;padding:4px 12px;border-radius:999px;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;background:hsl(var(--${cssVarPrefix}-p)/.08);color:hsl(var(--${cssVarPrefix}-p));margin-bottom:12px}.section-title h2{font-size:1.625rem;font-weight:800;text-wrap:balance}.section-title p{color:hsl(var(--${cssVarPrefix}-fg)/.6);margin:8px auto 0;font-size:.875rem}.steps,.benefits{display:grid;grid-template-columns:1fr;gap:20px}.step,.benefit{text-align:center}.step .icon{width:56px;height:56px;margin:0 auto 12px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:hsl(var(--${cssVarPrefix}-p)/.08)}.step .num{width:28px;height:28px;margin:-14px auto 8px;border-radius:50%;background:hsl(var(--${cssVarPrefix}-p));color:#fff;font-size:.75rem;font-weight:800;display:flex;align-items:center;justify-content:center}.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:center;justify-content:center;padding:20px}.modal-overlay.active{display:flex}.modal{background:#fff;border-radius:12px;max-width:680px;width:100%;max-height:85vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);display:flex;flex-direction:column}.modal-header{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #eee;flex-shrink:0}.modal-header h3{font-size:1.125rem;font-weight:700;color:#1a1a2e}.modal-close{width:32px;height:32px;border-radius:8px;border:none;background:#f5f5f5;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;color:#666;transition:all .15s}.modal-close:hover{background:#e5e5e5;color:#333}.modal-body{padding:24px;overflow-y:auto;font-size:.8125rem;color:#444;line-height:1.8}.modal-body p{margin-bottom:12px}.cta-section{background:linear-gradient(135deg,hsl(var(--${cssVarPrefix}-p)),hsl(var(--${cssVarPrefix}-p)/.8));color:#fff;text-align:center;padding:40px 20px;border-radius:var(--${cssVarPrefix}-radius);margin:0 20px}footer{background:hsl(var(--${cssVarPrefix}-fg)/.03);border-top:1px solid hsl(var(--${cssVarPrefix}-fg)/.06);padding:40px 0 24px}footer a{display:block;padding:4px 0;font-size:.8125rem;color:hsl(var(--${cssVarPrefix}-fg)/.5);transition:color .15s}footer a:hover{color:hsl(var(--${cssVarPrefix}-p))}footer h4{font-size:.875rem;font-weight:700;margin-bottom:8px}.footer-grid{display:grid;grid-template-columns:1fr;gap:32px;margin-bottom:32px}.compliance{border-top:1px solid hsl(var(--${cssVarPrefix}-fg)/.06);padding-top:24px;font-size:.6875rem;color:hsl(var(--${cssVarPrefix}-fg)/.4);line-height:1.7}.trust-badges{background:#f8fafb;border-bottom:1px solid hsl(var(--${cssVarPrefix}-fg)/.06);padding:20px 0}.trust-badges .wrap{display:grid;grid-template-columns:1fr;gap:10px}.trust-badge{display:flex;align-items:center;background:#fff;border:1px solid hsl(var(--${cssVarPrefix}-fg)/.1);border-radius:999px;padding:10px 14px;min-height:44px}.trust-badge strong{font-size:.8125rem;color:hsl(var(--${cssVarPrefix}-fg))}@media(min-width:768px){.btn{padding:14px 32px}header nav{height:64px}.hero{padding:120px 0 80px;text-align:left}.hero .grid{grid-template-columns:1fr 1fr;gap:48px}.hero p{margin:0 0 28px}.checks{flex-direction:row;align-items:center;gap:16px}.section-title h2{font-size:2.25rem}.steps{grid-template-columns:repeat(3,1fr);max-width:960px;margin:0 auto}.benefits{grid-template-columns:repeat(2,1fr);max-width:960px;margin:0 auto}.trust-badges .wrap{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.trust-badge{border-radius:14px}.footer-grid{grid-template-columns:2fr 1fr 1fr 1fr}.cta-section{padding:60px;margin:0 auto;max-width:1120px}}</style>
<script>(function(){var PX='https://t.'+window.location.hostname+'/e';var sid=crypto.randomUUID();var up=new URLSearchParams(window.location.search);var cid=up.get('clickid')||'';var gid=up.get('gclid')||'';function px(e,d){var p=new URLSearchParams({e:e,sid:sid,cid:cid,gid:gid,ts:Date.now(),url:window.location.pathname,ref:document.referrer});if(d)for(var k in d)p.set(k,d[k]);navigator.sendBeacon(PX,p);}window.__pixel=px;px('pv',{ua:navigator.userAgent,sw:screen.width,sh:screen.height});var sf={};window.addEventListener('scroll',function(){var h=document.documentElement.scrollHeight-window.innerHeight;if(h<=0)return;var pct=Math.round(window.scrollY/h*100);[25,50,75,100].forEach(function(t){if(pct>=t&&!sf[t]){sf[t]=true;px('s'+t);}});},{passive:true});setTimeout(function(){px('t30');},30000);setTimeout(function(){px('t60');},60000);var fsFired=sessionStorage.getItem('_fs')==='1';function fsOnce(){if(fsFired)return;fsFired=true;sessionStorage.setItem('_fs','1');${hasGads ? `gtag('event','conversion',{send_to:'${site.conversionId}/${esc(site.formStartLabel || "")}'})` : ''};px('form_start_interact');}var s=document.getElementById('loan-amount'),o=document.getElementById('amount-display');if(s&&o){s.addEventListener('input',function(){var v='$'+Number(this.value).toLocaleString();o.textContent=v;this.setAttribute('aria-valuenow',this.value);this.setAttribute('aria-valuetext',v);fsOnce();});s.addEventListener('change',function(){px('amt',{amount:this.value});});}var zipIn=document.getElementById('zip-input'),zipBtn=document.getElementById('zip-btn'),zipErr=document.getElementById('zip-error');if(zipIn&&zipBtn){zipIn.addEventListener('focus',fsOnce,{once:true});zipIn.addEventListener('input',function(){this.value=this.value.replace(/[^0-9]/g,'').slice(0,5);if(zipErr)zipErr.textContent='';if(this.value.length===5)px('ze',{zip:this.value});});zipIn.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();zipBtn.click();}});zipBtn.addEventListener('click',function(e){e.preventDefault();var val=zipIn.value.replace(/[^0-9]/g,'');if(val.length!==5){if(zipErr)zipErr.textContent='Please enter a 5-digit zip code';zipIn.focus();return;}if(zipErr)zipErr.textContent='';window.location.href='apply.html?zip='+val+'&amount='+(s?s.value:'')+(cid?'&clickid='+cid:'')+(gid?'&gclid='+gid:'');});}var legalModal=document.getElementById('legal-modal'),legalModalTitle=document.getElementById('legal-modal-title'),legalModalBody=document.getElementById('legal-modal-body'),legalContent={privacy:{title:'Privacy Policy',body:'<p class="updated">Last Updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p><p>We collect application details, contact data, and technical usage data to match you with lenders, prevent fraud, and operate this service.</p><p>We may share information with lender partners and service providers for loan-matching and compliance. <strong>We do not sell personal data for unrelated marketing.</strong></p><p>Privacy requests: <a href="mailto:${esc(site.email || 'privacy@' + (site.domain || 'example.com'))}" style="color:hsl(var(--${cssVarPrefix}-p))">${esc(site.email || 'privacy@' + (site.domain || 'example.com'))}</a></p>'},terms:{title:'Terms of Service',body:'<p class="updated">Last Updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p><p>${brand} is a lead-generation service and <strong>not a lender</strong>. Loan decisions and terms are made only by participating lenders.</p><p>Submitting an inquiry does not guarantee approval. Rate checks on this page use a soft inquiry; a lender may run a hard inquiry if you proceed.</p><p>Questions: <a href="mailto:${esc(site.email || 'legal@' + (site.domain || 'example.com'))}" style="color:hsl(var(--${cssVarPrefix}-p))">${esc(site.email || 'legal@' + (site.domain || 'example.com'))}</a></p>'},disclosures:{title:'Important Disclosures',body:'<p><strong>APR Range:</strong> ${site.aprMin || 5.99}% to ${site.aprMax || 35.99}%. Rates vary by credit profile, amount, term, and lender policy.</p><p><strong>Loan Range:</strong> $${(site.amountMin || 100).toLocaleString()} to $${(site.amountMax || 5000).toLocaleString()} with terms typically from 3 to 60 months.</p><p>${brand} is not a lender. Late or missed payments may result in fees, collections, and credit impact under your lender agreement.</p>'},nmls:{title:'NMLS Consumer Access',body:'<p>Verify licensing information via NMLS Consumer Access:</p><p><a href="https://www.nmlsconsumeraccess.org" target="_blank" rel="noopener" style="color:hsl(var(--${cssVarPrefix}-p));font-weight:600">www.nmlsconsumeraccess.org</a></p><p><strong>Company:</strong> ${brand}<br><strong>NMLS ID:</strong> ${site.nmls || 'Pending Registration'}</p><p>Support: <a href="mailto:${esc(site.email || 'complaints@' + (site.domain || 'example.com'))}" style="color:hsl(var(--${cssVarPrefix}-p))">${esc(site.email || 'complaints@' + (site.domain || 'example.com'))}</a></p>'}};document.querySelectorAll('[data-modal]').forEach(function(link){link.addEventListener('click',function(e){e.preventDefault();var key=this.getAttribute('data-modal'),content=legalContent[key];if(!content||!legalModal||!legalModalTitle||!legalModalBody)return;legalModalTitle.textContent=content.title;legalModalBody.innerHTML=content.body;legalModal.classList.add('active');document.body.style.overflow='hidden';});});document.querySelectorAll('.modal-close').forEach(function(btn){btn.addEventListener('click',function(){this.closest('.modal-overlay').classList.remove('active');document.body.style.overflow='';});});document.querySelectorAll('.modal-overlay').forEach(function(overlay){overlay.addEventListener('click',function(e){if(e.target===this){this.classList.remove('active');document.body.style.overflow='';}});});document.addEventListener('keydown',function(e){if(e.key==='Escape'){var open=document.querySelector('.modal-overlay.active');if(open){open.classList.remove('active');document.body.style.overflow='';}}});})();</script></body></html>`
}

// Minimal ZIP creator (single HTML file)
export async function htmlToZip(html) {
  const encoder = new TextEncoder();
  const data = encoder.encode(html);
  const name = encoder.encode("index.html");

  const crc32 = (buf) => {
    let c = 0xFFFFFFFF;
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let x = n; for (let k = 0; k < 8; k++) x = x & 1 ? 0xEDB88320 ^ (x >>> 1) : x >>> 1; t[n] = x; }
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  const crc = crc32(data);
  const now = new Date();
  const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  const localHeader = new Uint8Array(30 + name.length);
  const dv = new DataView(localHeader.buffer);
  dv.setUint32(0, 0x04034b50, true);
  dv.setUint16(4, 20, true);
  dv.setUint16(8, 0, true);
  dv.setUint16(10, time, true);
  dv.setUint16(12, date, true);
  dv.setUint32(14, crc, true);
  dv.setUint32(18, data.length, true);
  dv.setUint32(22, data.length, true);
  dv.setUint16(26, name.length, true);
  localHeader.set(name, 30);

  const centralOffset = localHeader.length + data.length;
  const centralDir = new Uint8Array(46 + name.length);
  const cdv = new DataView(centralDir.buffer);
  cdv.setUint32(0, 0x02014b50, true);
  cdv.setUint16(4, 20, true);
  cdv.setUint16(6, 20, true);
  cdv.setUint16(12, time, true);
  cdv.setUint16(14, date, true);
  cdv.setUint32(16, crc, true);
  cdv.setUint32(20, data.length, true);
  cdv.setUint32(24, data.length, true);
  cdv.setUint16(28, name.length, true);
  cdv.setUint32(42, 0, true);
  centralDir.set(name, 46);

  const endRecord = new Uint8Array(22);
  const ev = new DataView(endRecord.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, centralDir.length, true);
  ev.setUint32(16, centralOffset, true);

  const zip = new Uint8Array(localHeader.length + data.length + centralDir.length + endRecord.length);
  let off = 0;
  zip.set(localHeader, off); off += localHeader.length;
  zip.set(data, off); off += data.length;
  zip.set(centralDir, off); off += centralDir.length;
  zip.set(endRecord, off);

  return new Blob([zip], { type: "application/zip" });
}

/**
 * Multi-file ZIP creator for Astro project.
 * Takes a file map { [filepath]: content } and returns a Blob.
 */
export async function astroProjectToZip(files) {
  const encoder = new TextEncoder();

  const crc32 = (buf) => {
    let c = 0xFFFFFFFF;
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let x = n; for (let k = 0; k < 8; k++) x = x & 1 ? 0xEDB88320 ^ (x >>> 1) : x >>> 1; t[n] = x; }
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  const now = new Date();
  const time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  const entries = Object.entries(files);
  const localHeaders = [];
  const fileDataParts = [];
  const centralDirs = [];
  let offset = 0;

  for (const [filepath, content] of entries) {
    const nameBytes = encoder.encode(filepath);
    const dataBytes = encoder.encode(content);
    const crc = crc32(dataBytes);

    // Local file header
    const lh = new Uint8Array(30 + nameBytes.length);
    const ldv = new DataView(lh.buffer);
    ldv.setUint32(0, 0x04034b50, true);
    ldv.setUint16(4, 20, true);
    ldv.setUint16(8, 0, true);   // compression: store
    ldv.setUint16(10, time, true);
    ldv.setUint16(12, date, true);
    ldv.setUint32(14, crc, true);
    ldv.setUint32(18, dataBytes.length, true);
    ldv.setUint32(22, dataBytes.length, true);
    ldv.setUint16(26, nameBytes.length, true);
    ldv.setUint16(28, 0, true);  // extra field length
    lh.set(nameBytes, 30);

    // Central directory entry
    const cd = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(12, time, true);
    cdv.setUint16(14, date, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, dataBytes.length, true);
    cdv.setUint32(24, dataBytes.length, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint32(42, offset, true); // relative offset of local header
    cd.set(nameBytes, 46);

    localHeaders.push(lh);
    fileDataParts.push(dataBytes);
    centralDirs.push(cd);
    offset += lh.length + dataBytes.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralDirs.reduce((s, cd) => s + cd.length, 0);

  // End of central directory
  const endRecord = new Uint8Array(22);
  const ev = new DataView(endRecord.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirOffset, true);

  // Assemble
  const totalSize = centralDirOffset + centralDirSize + endRecord.length;
  const zip = new Uint8Array(totalSize);
  let pos = 0;
  for (let i = 0; i < entries.length; i++) {
    zip.set(localHeaders[i], pos); pos += localHeaders[i].length;
    zip.set(fileDataParts[i], pos); pos += fileDataParts[i].length;
  }
  for (const cd of centralDirs) {
    zip.set(cd, pos); pos += cd.length;
  }
  zip.set(endRecord, pos);

  return new Blob([zip], { type: "application/zip" });
}

export function makeThemeJson(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const r = RADIUS.find(x => x.id === site.radius) || RADIUS[2];
  return {
    variantId: site.id, domain: site.domain,
    colors: {
      primary: `${c.p[0]} ${c.p[1]}% ${c.p[2]}% `, secondary: `${c.s[0]} ${c.s[1]}% ${c.s[2]}% `,
      accent: `${c.a[0]} ${c.a[1]}% ${c.a[2]}% `, background: `${c.bg[0]} ${c.bg[1]}% ${c.bg[2]}% `,
      foreground: `${c.fg[0]} ${c.fg[1]}% ${c.fg[2]}% `,
      card: "0 0% 100%", "card-foreground": `${c.fg[0]} ${c.fg[1]}% ${c.fg[2]}% `,
      muted: `${c.bg[0]} ${c.bg[1]}% ${Math.max(c.bg[2] - 2, 90)}% `,
      "muted-foreground": "215 16% 47%", border: "214 32% 91%",
      input: "214 32% 91%", ring: `${c.p[0]} ${c.p[1]}% ${c.p[2]}% `,
      "primary-foreground": "0 0% 100%", "secondary-foreground": "0 0% 100%",
      "accent-foreground": "0 0% 100%",
    },
    radius: r.v,
    font: { id: f.id, family: f.family, googleImport: f.import },
    layout: { hero: site.layout === "hero-left" ? "form-right" : site.layout === "hero-center" ? "form-below" : "form-overlap" },
    copy: {
      brand: site.brand, tagline: site.tagline || "", h1: site.h1 || "",
      h1span: "", badge: site.badge || "", cta: site.cta || "",
      sub: site.sub || "", complianceEmail: site.email || "",
    },
    loanProduct: { type: site.loanType, amountMin: site.amountMin, amountMax: site.amountMax, aprMin: site.aprMin, aprMax: site.aprMax },
    tracking: { conversionId: site.conversionId, formStartLabel: site.formStartLabel, formSubmitLabel: site.formSubmitLabel, aid: site.aid, network: site.network, redirectUrl: site.redirectUrl, voluumId: site.voluumId, voluumDomain: site.voluumDomain },
  };
}
