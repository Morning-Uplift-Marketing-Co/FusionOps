/**
 * Installment Loans Template
 * ==========================
 * Mobile-first LP with hero form, calculator, FAQ, compliance.
 * Uses ALL shared modules — guaranteed consistent output.
 */

import { generateScaffold } from '../../shared/scaffold.js';
import { baseCSS, fontTags } from '../../shared/base-css.js';
import { aprTableHTML, disclaimerHTML, legalModalsHTML, modalCSS, modalJS, complianceCSS } from '../../shared/compliance.js';

export function generate(c) {
  const files = generateScaffold(c);
  const fmt = n => '$' + Number(n).toLocaleString();
  const amtBtns = [c.amountMin, Math.round(c.amountMin + (c.amountMax - c.amountMin) * 0.33), Math.round(c.amountMin + (c.amountMax - c.amountMin) * 0.66), c.amountMax];
  const fmtBtn = n => n >= 1000 ? `$${(n/1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : `$${n}`;

  files['src/pages/index.astro'] = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${c.brand} — ${c.loanLabel} up to ${fmt(c.amountMax)}</title>
  <meta name="description" content="${c.sub}"/>
  <meta name="robots" content="noindex,nofollow"/>
  ${fontTags(c)}
  <style>
    ${baseCSS(c)}

    /* ── Header ── */
    .header{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(26,26,46,.97);backdrop-filter:blur(12px);height:52px;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid rgba(255,255,255,.08)}
    .header-inner{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:1120px;margin:0 auto}
    .logo{font-size:17px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px}
    .logo-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent-glow)}

    /* ── Hero ── */
    .hero{padding:60px 0 32px;background:linear-gradient(170deg,#1a1a2e 0%,#0f3460 100%);color:#fff;position:relative;overflow:hidden}
    .hero::before{content:'';position:absolute;top:-100px;right:-80px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,hsla(${c.pH},${c.pS}%,${c.pL}%,.2) 0%,transparent 70%)}
    .hero-content{position:relative;z-index:2}
    .hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);padding:5px 12px;border-radius:50px;font-size:11px;font-weight:600;margin-bottom:12px}
    .hero-badge-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.7)}}
    .hero h1{font-size:26px;font-weight:800;line-height:1.1;letter-spacing:-.8px;margin-bottom:8px}
    .hero h1 .hl{background:linear-gradient(135deg,var(--accent),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .hero-sub{font-size:14px;opacity:.65;margin-bottom:16px}

    /* ── Hero Form ── */
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
    .form-trust{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:10px;font-size:10px;color:var(--muted)}

    /* ── Sections ── */
    .section{padding:48px 0}
    .section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--primary);margin-bottom:8px}
    .section-title{font-size:22px;font-weight:800;letter-spacing:-.8px;margin-bottom:12px;line-height:1.15}
    .section-desc{font-size:14px;color:var(--fg-sub);margin-bottom:28px}

    /* ── Steps ── */
    .steps-grid{display:flex;flex-direction:column;gap:16px}
    .step-card{display:flex;gap:16px;align-items:flex-start;background:var(--card);border-radius:14px;padding:20px;border:1px solid var(--border)}
    .step-num{width:38px;height:38px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,var(--primary),var(--primary-light));color:#fff;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px var(--primary-glow)}
    .step-card h3{font-size:15px;font-weight:700;margin-bottom:4px}
    .step-card p{font-size:13px;color:var(--fg-sub);line-height:1.5}

    /* ── Benefits ── */
    .benefits-grid{display:flex;flex-direction:column;gap:12px}
    .benefit-card{display:flex;gap:14px;background:var(--card);border-radius:14px;padding:18px;border:1px solid var(--border)}
    .benefit-icon{width:42px;height:42px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;background:linear-gradient(135deg,hsla(${c.pH},${c.pS}%,${c.pL}%,.08),hsla(${c.pH},${c.pS}%,${c.pL}%,.03))}
    .benefit-card h4{font-size:14px;font-weight:700;margin-bottom:3px}
    .benefit-card p{font-size:12px;color:var(--fg-sub);line-height:1.5}

    /* ── FAQ ── */
    .faq-item{border-bottom:1px solid var(--border)}
    .faq-q{width:100%;display:flex;align-items:center;justify-content:space-between;padding:16px 0;font-size:14px;font-weight:700;background:none;border:none;cursor:pointer;color:var(--fg);font-family:var(--font);text-align:left}
    .faq-icon{width:24px;height:24px;border-radius:50%;background:var(--bg-warm);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .3s;font-size:14px;color:var(--muted)}
    .faq-item.open .faq-icon{background:var(--primary);color:#fff;transform:rotate(45deg)}
    .faq-a{max-height:0;overflow:hidden;transition:max-height .35s ease;font-size:13px;color:var(--fg-sub);line-height:1.6}
    .faq-item.open .faq-a{max-height:300px;padding-bottom:16px}

    /* ── CTA ── */
    .cta-section{background:linear-gradient(170deg,#1a1a2e,#0f3460);padding:48px 0;text-align:center;color:#fff}
    .cta-section h2{font-size:22px;font-weight:800;margin-bottom:10px}
    .cta-section p{font-size:14px;opacity:.6;margin-bottom:20px}
    .btn-accent{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,var(--accent),var(--accent-dark));color:#1a1a2e;padding:14px 32px;border-radius:var(--radius-sm);font-size:16px;font-weight:800;border:none;cursor:pointer;box-shadow:0 4px 20px var(--accent-glow);font-family:var(--font);transition:all .25s}
    .btn-accent:hover{transform:translateY(-2px);box-shadow:0 8px 36px var(--accent-glow)}

    /* ── Footer ── */
    .footer{background:#1a1a2e;color:rgba(255,255,255,.5);padding:24px 0;text-align:center;font-size:11px;line-height:1.8}
    .footer a{color:rgba(255,255,255,.7);text-decoration:underline}
    .footer strong{color:rgba(255,255,255,.8)}

    /* ── Sticky CTA (mobile) ── */
    .sticky-cta{position:fixed;bottom:0;left:0;right:0;z-index:90;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border-top:1px solid var(--border);padding:10px 16px;display:flex;align-items:center;gap:12px;transform:translateY(100%);transition:transform .4s cubic-bezier(.16,1,.3,1)}
    .sticky-cta.visible{transform:translateY(0)}
    .sticky-cta-text{font-size:12px;font-weight:600;flex:1}
    .sticky-cta-text small{display:block;font-size:10px;color:var(--muted);font-weight:400}
    .sticky-cta .btn-sm{background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:800;border:none;cursor:pointer;font-family:var(--font);white-space:nowrap;box-shadow:0 3px 12px var(--primary-glow)}

    ${complianceCSS()}
    ${modalCSS()}

    /* ── Desktop ── */
    @media(min-width:769px){
      .hero{padding:120px 0 80px}
      .hero-grid{display:grid;grid-template-columns:1fr 440px;gap:56px;align-items:center}
      .hero h1{font-size:clamp(2.2rem,4vw,3.2rem)}
      .hero-sub{font-size:16px}
      .hero-form{padding:28px;border-radius:20px}
      .section{padding:72px 0}
      .section-title{font-size:clamp(1.6rem,3vw,2.2rem)}
      .steps-grid{flex-direction:row;gap:20px}
      .step-card{flex-direction:column;flex:1;padding:28px}
      .benefits-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
      .faq-list{max-width:680px;margin:0 auto}
      .sticky-cta{display:none}
    }
    @media(max-width:768px){
      .hero-grid{display:flex;flex-direction:column;gap:20px}
    }
  </style>
</head>
<body>
  <header class="header"><div class="header-inner">
    <a class="logo"><span class="logo-dot"></span> ${c.brand}</a>
  </div></header>

  <section class="hero" id="apply"><div class="container"><div class="hero-grid">
    <div class="hero-content" style="order:1">
      <div class="hero-badge"><span class="hero-badge-dot"></span> ${c.badge}</div>
      <h1>${c.h1.includes(' ') ? c.h1.replace(/(\S+)$/, '<span class="hl">$1</span>') : c.h1}</h1>
      <p class="hero-sub">${c.sub} Check your rate — no credit impact.</p>
    </div>
    <div style="order:0"><div class="hero-form">
      <div class="form-title">How much do you need?</div>
      <div class="form-subtitle">No impact on your credit score</div>
      <form id="heroForm">
        <div class="amount-grid" id="amountBtns">
          ${amtBtns.map((a, i) => `<button type="button" data-amount="${a}" class="amt-btn${i === 2 ? ' active' : ''}">${fmtBtn(a)}</button>`).join('\n          ')}
        </div>
        <input type="range" class="form-slider" id="amountSlider" min="${c.amountMin}" max="${c.amountMax}" step="100" value="${amtBtns[2]}"/>
        <div class="slider-labels"><span>${fmt(c.amountMin)}</span><span class="slider-current" id="sliderValue">${fmt(amtBtns[2])}</span><span>${fmt(c.amountMax)}</span></div>
        <div class="form-row">
          <div class="form-group"><label>Email</label><input type="email" class="form-input" placeholder="you@email.com" required/></div>
          <div class="form-group"><label>ZIP Code</label><input type="text" class="form-input" placeholder="00000" maxlength="5" pattern="[0-9]{5}" required/></div>
        </div>
        <button type="submit" class="form-submit">${c.cta} →</button>
        <div class="form-trust"><span>🔒 SSL Encrypted</span><span>🛡️ No credit impact</span></div>
      </form>
    </div></div>
  </div></div></section>

  <section class="section" id="how"><div class="container">
    <div class="section-label">● How It Works</div>
    <div class="section-title">Funded in 3 steps</div>
    <div class="steps-grid">
      <div class="step-card"><div class="step-num">1</div><div><h3>Check your rate</h3><p>2-minute form. See offers with no credit impact.</p></div></div>
      <div class="step-card"><div class="step-num">2</div><div><h3>Choose your terms</h3><p>Compare personalized offers. Pick the payment that fits.</p></div></div>
      <div class="step-card"><div class="step-num">3</div><div><h3>Get your funds</h3><p>Accept and receive funds next business day.</p></div></div>
    </div>
  </div></section>

  <section class="section" style="background:var(--bg-warm)"><div class="container">
    <div class="section-label">● Why Us</div>
    <div class="section-title">Built for real people</div>
    <div class="benefits-grid">
      <div class="benefit-card"><div class="benefit-icon">📊</div><div><h4>Fixed payments</h4><p>Same amount every month. No variable rates.</p></div></div>
      <div class="benefit-card"><div class="benefit-icon">🏦</div><div><h4>All credit welcome</h4><p>Our partners work with all credit profiles.</p></div></div>
      <div class="benefit-card"><div class="benefit-icon">🔒</div><div><h4>No prepayment fees</h4><p>Pay off early. Zero penalties.</p></div></div>
      <div class="benefit-card"><div class="benefit-icon">⚡</div><div><h4>Next-day funding</h4><p>Approved in minutes. Money by tomorrow.</p></div></div>
    </div>
  </div></section>

  <section class="section" id="faq"><div class="container">
    <div class="section-label">● FAQ</div>
    <div class="section-title">Common questions</div>
    <div class="faq-list">
      <div class="faq-item"><button class="faq-q">Will this affect my credit?<span class="faq-icon">+</span></button><div class="faq-a">No. Soft inquiry only. Hard pull only if you accept an offer.</div></div>
      <div class="faq-item"><button class="faq-q">What amounts are available?<span class="faq-icon">+</span></button><div class="faq-a">${fmt(c.amountMin)} to ${fmt(c.amountMax)} depending on creditworthiness.</div></div>
      <div class="faq-item"><button class="faq-q">How fast do I get the money?<span class="faq-icon">+</span></button><div class="faq-a">Same-day approval. Funds within 1 business day.</div></div>
      <div class="faq-item"><button class="faq-q">What are the rates?<span class="faq-icon">+</span></button><div class="faq-a">APR ${c.aprMin}%–${c.aprMax}% based on your profile.</div></div>
      <div class="faq-item"><button class="faq-q">Can I pay off early?<span class="faq-icon">+</span></button><div class="faq-a">Yes. No prepayment penalties.</div></div>
    </div>
  </div></section>

  <section class="cta-section"><div class="container">
    <h2>Ready to get started?</h2><p>Check your rate in under 2 minutes.</p>
    <a href="#apply" class="btn-accent">${c.cta} Now →</a>
  </div></section>

  <div class="compliance"><div class="container">
    <div class="compliance-text">${disclaimerHTML(c)}</div>
    ${aprTableHTML(c)}
    <div class="compliance-text" style="margin-top:24px"><strong>Privacy:</strong> By submitting you agree to our <a href="#" onclick="openPopup('privacyPopup');return false">Privacy Policy</a> and <a href="#" onclick="openPopup('termsPopup');return false">Terms</a>.</div>
  </div></div>

  <footer class="footer"><div class="container">
    <strong>${c.brand}</strong><br/>${c.address}<br/>
    <a href="tel:${c.phone}">${c.phone}</a> · <a href="mailto:${c.email}">${c.email}</a><br/>
    © ${new Date().getFullYear()} ${c.brand} · <a href="#" onclick="openPopup('privacyPopup');return false">Privacy</a> · <a href="#" onclick="openPopup('termsPopup');return false">Terms</a> · <a href="#" onclick="openPopup('disclPopup');return false">Disclosures</a>
  </div></footer>

  ${legalModalsHTML(c)}

  <div class="sticky-cta" id="stickyCta"><div class="sticky-cta-text">Loans up to ${fmt(c.amountMax)}<small>No credit impact</small></div><a href="#apply" class="btn-sm">${c.cta}</a></div>

  <script>
    ${modalJS()}
    const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
    const fmt=n=>'$'+Number(n).toLocaleString();
    const slider=$('#amountSlider'),sv=$('#sliderValue');
    function updateSlider(){sv.textContent=fmt(slider.value);$$('.amt-btn').forEach(b=>b.classList.toggle('active',+b.dataset.amount===+slider.value))}
    slider.addEventListener('input',updateSlider);
    $$('.amt-btn').forEach(b=>b.addEventListener('click',()=>{slider.value=b.dataset.amount;updateSlider()}));
    updateSlider();
    $$('.faq-q').forEach(q=>q.addEventListener('click',()=>{const it=q.closest('.faq-item'),w=it.classList.contains('open');$$('.faq-item.open').forEach(i=>i.classList.remove('open'));if(!w)it.classList.add('open')}));
    const sc=$('#stickyCta');
    window.addEventListener('scroll',()=>{sc.classList.toggle('visible',window.scrollY/(document.body.scrollHeight-window.innerHeight)>=.3)},{passive:true});
    $('#heroForm').addEventListener('submit',e=>{e.preventDefault();window.location.href='/apply?amount='+slider.value});
  </script>
</body>
</html>`;

  return files;
}
