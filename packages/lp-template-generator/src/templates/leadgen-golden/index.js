import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  const c = COLORS.find((x) => x.id === site.colorId) || COLORS[4];
  const f = FONTS.find((x) => x.id === site.fontId) || FONTS[0];
  const brand = site.brand || 'LeadGen Golden';
  const domain = site.domain || 'example.com';
  const cta = site.cta || 'Get My Free Quote';
  const conversionId = site.conversionId || site.gtagId || '';
  const formStartLabel = site.formStartLabel || 'form_start';
  const formSubmitLabel = site.formSubmitLabel || 'form_submit';
  const p = `hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}%)`;
  const pDark = `hsl(${c.p[0]} ${c.p[1]}% ${Math.max(c.p[2] - 12, 10)}%)`;

  const files = {};
  files['src/pages/index.astro'] = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brand} - Free Quote</title>
  <meta name="description" content="High-converting lead generation page with first-party tracking baseline." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=${f.import}&display=swap" rel="stylesheet" />
  <style>
    :root { --color-primary:${p}; --color-secondary:${pDark}; --color-accent:#14b8a6; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:${f.family}; background:#0f172a; color:#e2e8f0; }
    .wrap { width:min(1060px,92vw); margin:0 auto; }
    .hero { padding:56px 0; display:grid; grid-template-columns:1.1fr .9fr; gap:20px; align-items:center; }
    h1 { font-size:clamp(34px,5vw,58px); line-height:1.03; margin-bottom:10px; }
    .sub { color:#94a3b8; margin-bottom:14px; }
    .chips { display:flex; gap:8px; flex-wrap:wrap; }
    .chips span { border:1px solid #334155; border-radius:999px; padding:6px 10px; font-size:12px; }
    .card { background:#111827; border:1px solid #1f2937; border-radius:16px; padding:16px; }
    .form { display:flex; flex-direction:column; gap:10px; }
    .form input, .form select { padding:10px; border:1px solid #334155; border-radius:10px; background:#0b1220; color:#e2e8f0; }
    .cta { border:0; border-radius:12px; padding:12px 14px; background:linear-gradient(135deg,var(--color-primary),var(--color-secondary)); color:#fff; font-weight:800; cursor:pointer; }
    .proof { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:16px 0; }
    .proof div { background:#0b1220; border:1px solid #1e293b; border-radius:12px; padding:12px; text-align:center; font-size:12px; }
    .foot { color:#64748b; font-size:12px; padding-bottom:32px; }
    @media (max-width:900px){ .hero,.proof { grid-template-columns:1fr; } }
  </style>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    ${conversionId ? `gtag('js', new Date()); gtag('config', '${conversionId}');` : ''}
    function track(name){
      try { gtag('event', name); } catch (_e) {}
      try { navigator.sendBeacon('https://t.${domain}/e', JSON.stringify({ e:name, d:'${domain}', ts:Date.now() })); } catch (_e) {}
    }
    function submitLeadgen(ev){
      ev.preventDefault();
      track('${formStartLabel}');
      track('${formSubmitLabel}');
      alert('Your quote request has been submitted.');
    }
  </script>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div>
        <h1>One form. Better offers.</h1>
        <p class="sub">Capture and qualify leads with a fast, mobile-first funnel that is deploy-safe for workers.</p>
        <div class="chips"><span>Fast load</span><span>Mobile first</span><span>Tracked</span></div>
      </div>
      <div class="card">
        <form class="form" onsubmit="submitLeadgen(event)">
          <input type="text" placeholder="Full name" required />
          <input type="email" placeholder="Email" required />
          <select required>
            <option value="">Select need</option>
            <option>Insurance</option>
            <option>Loans</option>
            <option>Home services</option>
          </select>
          <button class="cta" type="submit">${cta}</button>
        </form>
      </div>
    </section>
    <section class="proof">
      <div><b>+38%</b><br/>form completion</div>
      <div><b>2.4s</b><br/>mobile load time</div>
      <div><b>99.9%</b><br/>deploy success</div>
    </section>
    <footer class="foot">${brand} acts as a marketing and matching service.</footer>
  </main>
</body>
</html>`;
  return files;
}

