import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  const c = COLORS.find((x) => x.id === site.colorId) || COLORS[2];
  const f = FONTS.find((x) => x.id === site.fontId) || FONTS[0];
  const brand = site.brand || 'Pet Care Golden';
  const domain = site.domain || 'example.com';
  const cta = site.cta || 'Get Pet Financing';
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
  <title>${brand} - Pet Financing</title>
  <meta name="description" content="Flexible pet care financing for emergencies and planned procedures." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=${f.import}&display=swap" rel="stylesheet" />
  <style>
    :root { --color-primary:${p}; --color-secondary:${pDark}; --color-accent:#f59e0b; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:${f.family}; color:#102a1f; background:#f0fdf4; }
    .wrap { width:min(1080px,92vw); margin:0 auto; }
    .hero { padding:50px 0 24px; }
    .badge { display:inline-flex; padding:6px 10px; border-radius:999px; background:#dcfce7; border:1px solid #bbf7d0; font-size:12px; margin-bottom:10px; }
    h1 { font-size:clamp(30px,5vw,52px); line-height:1.05; margin-bottom:10px; }
    .sub { color:#3f6212; max-width:700px; margin-bottom:16px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .card { background:#fff; border:1px solid #dcfce7; border-radius:16px; padding:16px; }
    .services { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-top:10px; }
    .svc { border:1px solid #dcfce7; border-radius:10px; padding:10px; font-size:12px; text-align:center; }
    .cta { border:0; border-radius:12px; background:linear-gradient(135deg,var(--color-primary),var(--color-secondary)); color:#fff; padding:12px 16px; font-weight:800; cursor:pointer; }
    .apply { display:flex; flex-direction:column; gap:8px; }
    .apply input { padding:10px; border:1px solid #bbf7d0; border-radius:10px; }
    .faq { margin-top:24px; }
    .faq .q { font-weight:700; margin-top:10px; }
    .foot { color:#3f6212; font-size:12px; padding:18px 0 34px; }
    @media (max-width:900px){ .grid,.services { grid-template-columns:1fr; } }
  </style>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    ${conversionId ? `gtag('js', new Date()); gtag('config', '${conversionId}');` : ''}
    function track(name){
      try { gtag('event', name); } catch (_e) {}
      try { navigator.sendBeacon('https://t.${domain}/e', JSON.stringify({ e:name, d:'${domain}', ts:Date.now() })); } catch (_e) {}
    }
    function submitPet(ev){
      ev.preventDefault();
      track('${formStartLabel}');
      track('${formSubmitLabel}');
      alert('We found financing options for your pet care.');
    }
  </script>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="badge">🐾 Trusted by pet families</div>
      <h1>Pet care now, payments over time</h1>
      <p class="sub">Get matched with financing for emergencies, surgery, dental work, and wellness care.</p>
      <div class="grid">
        <div class="card">
          <b>Common uses</b>
          <div class="services">
            <div class="svc">Emergency Vet</div>
            <div class="svc">Surgery</div>
            <div class="svc">Dental Care</div>
            <div class="svc">Medications</div>
          </div>
        </div>
        <form class="card apply" onsubmit="submitPet(event)">
          <input type="email" required placeholder="Email" />
          <input type="text" required placeholder="ZIP code" />
          <button class="cta" type="submit">${cta}</button>
        </form>
      </div>
      <div class="faq">
        <div class="q">Will this impact my credit?</div><p>Checking options uses a soft inquiry only.</p>
        <div class="q">How fast is approval?</div><p>Most users see options within minutes.</p>
      </div>
    </section>
    <footer class="foot">${brand} is not a direct lender and does not make credit decisions.</footer>
  </main>
</body>
</html>`;
  return files;
}

