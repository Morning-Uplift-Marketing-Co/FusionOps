/**
 * HowItWorks Blocks
 */
export function HowItWorks3Step(site, theme) {
  return `
  <section class="b-hiw">
    <div class="b-container">
      <h2 class="b-section-title">How It Works</h2>
      <div class="b-hiw__steps">
        <div class="b-hiw__step"><div class="b-hiw__num">1</div><div class="b-hiw__title">Apply Online</div><div class="b-hiw__desc">Complete our short, secure form in under 2 minutes</div></div>
        <div class="b-hiw__arrow">→</div>
        <div class="b-hiw__step"><div class="b-hiw__num">2</div><div class="b-hiw__title">Get Matched</div><div class="b-hiw__desc">We instantly match you with lenders in our network</div></div>
        <div class="b-hiw__arrow">→</div>
        <div class="b-hiw__step"><div class="b-hiw__num">3</div><div class="b-hiw__title">Receive Funds</div><div class="b-hiw__desc">Funds deposited directly to your account</div></div>
      </div>
    </div>
  </section>`;
}

export function HowItWorks4Step(site, theme) {
  const steps = [
    { n: '01', t: 'Fill the Form', d: 'Share basic details — takes under 2 minutes' },
    { n: '02', t: 'Review Offers', d: 'See real rates from multiple lenders at once' },
    { n: '03', t: 'Choose & Accept', d: 'Pick the terms that best fit your situation' },
    { n: '04', t: 'Get Funded', d: 'Money hits your account as fast as next business day' },
  ];
  return `
  <section class="b-hiw b-hiw--4step">
    <div class="b-container">
      <h2 class="b-section-title">Your Path to Funding</h2>
      <div class="b-hiw__grid">
        ${steps.map(s => `
        <div class="b-hiw__card">
          <div class="b-hiw__card-num">${s.n}</div>
          <div class="b-hiw__card-title">${s.t}</div>
          <div class="b-hiw__card-desc">${s.d}</div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
}

export const HOWIТWORKS = { HowItWorks3Step, HowItWorks4Step };
export const HIW_IDS = Object.keys(HOWIТWORKS);

// ─────────────────────────────────────────────────────────────
/**
 * FAQ Blocks
 */
export function FAQAccordion(site, theme) {
  const faqs = [
    { q: `How much can I borrow?`, a: `You may be eligible to borrow from $${Number(site.amountMin).toLocaleString()} up to $${Number(site.amountMax).toLocaleString()} depending on your creditworthiness and the lender's criteria.` },
    { q: 'Will applying affect my credit score?', a: 'Submitting this form does not affect your credit score. Some lenders may perform a soft inquiry to pre-qualify you.' },
    { q: 'How fast can I get funded?', a: 'Once you accept an offer and complete the lender\'s process, funds can be deposited as fast as the next business day.' },
    { q: 'What credit score do I need?', a: 'We work with lenders who accept all credit backgrounds. Your credit score is only one factor they consider.' },
    { q: 'Is my information secure?', a: 'Yes. We use 256-bit SSL encryption and follow strict data protection standards to keep your information safe.' },
  ];
  return `
  <section class="b-faq">
    <div class="b-container">
      <h2 class="b-section-title">Frequently Asked Questions</h2>
      <div class="b-faq__list">
        ${faqs.map((f, i) => `
        <details class="b-faq__item" ${i === 0 ? 'open' : ''}>
          <summary class="b-faq__q">${f.q}</summary>
          <div class="b-faq__a">${f.a}</div>
        </details>`).join('')}
      </div>
    </div>
  </section>`;
}

export function FAQSimple(site, theme) {
  const faqs = [
    { q: 'Is there a fee to apply?', a: 'No. Our service is completely free to use.' },
    { q: 'What if I have bad credit?', a: 'Many lenders in our network specialize in working with all credit types.' },
    { q: 'How long does approval take?', a: 'Most decisions happen within minutes of submitting your application.' },
  ];
  return `
  <section class="b-faq b-faq--simple">
    <div class="b-container">
      <h2 class="b-section-title">Got Questions?</h2>
      <div class="b-faq__simple-grid">
        ${faqs.map(f => `
        <div class="b-faq__simple-item">
          <div class="b-faq__simple-q">Q: ${f.q}</div>
          <div class="b-faq__simple-a">A: ${f.a}</div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
}

export const FAQS = { FAQAccordion, FAQSimple };
export const FAQ_IDS = Object.keys(FAQS);

// ─────────────────────────────────────────────────────────────
/**
 * CTA Blocks
 */
export function CTABanner(site, theme) {
  return `
  <section class="b-cta">
    <div class="b-container">
      <div class="b-cta__inner">
        <h2 class="b-cta__title">Ready to Get Started?</h2>
        <p class="b-cta__sub">Join thousands who found financing through our network</p>
        <a href="${site.voluumClickUrl || '#form'}" class="b-btn b-btn--primary b-btn--lg">${site.cta}</a>
      </div>
    </div>
  </section>`;
}

export function CTAFloating(site, theme) {
  return `
  <div class="b-cta-float" id="cta-float">
    <div class="b-cta-float__inner">
      <span class="b-cta-float__text">Get up to $${Number(site.amountMax).toLocaleString()} today</span>
      <a href="${site.voluumClickUrl || '#form'}" class="b-btn b-btn--primary b-btn--sm">${site.cta}</a>
    </div>
  </div>
  <script>
  (function(){
    var el=document.getElementById('cta-float');
    if(!el)return;
    el.style.display='none';
    window.addEventListener('scroll',function(){
      el.style.display=window.scrollY>400?'block':'none';
    },{passive:true});
  })();
  <\/script>`;
}

export const CTAS = { CTABanner, CTAFloating };
export const CTA_IDS = Object.keys(CTAS);

// ─────────────────────────────────────────────────────────────
/**
 * Legal / APR Disclosure Blocks
 * Required on every LP — Policy Gate enforces this
 */
export function APRDisclosureBox(site, theme) {
  return `
  <div class="b-apr b-apr--box">
    <p><strong>APR Disclosure:</strong> The Annual Percentage Rate (APR) for loans represented on this site ranges from <strong>${site.aprMin}% to ${site.aprMax}% APR</strong>. Actual APR depends on factors including credit score, loan amount, loan term, and lender. This site does not represent an offer or solicitation for loan products which are prohibited by any state law. Loan terms and rates are set solely by your lender. This is not a direct lender. Not available in all states.</p>
  </div>`;
}

export function APRDisclosureInline(site, theme) {
  return `
  <p class="b-apr b-apr--inline">APR: ${site.aprMin}%–${site.aprMax}%. Representative example: $1,000 borrowed at ${site.aprMin}% APR over 24 months = $${Math.round(1000 * (1 + site.aprMin/100 * 2)/24)}/mo. Not a direct lender. Subject to lender approval.</p>`;
}

export function LegalFooterFull(site, theme) {
  return `
  <footer class="b-footer">
    <div class="b-container">
      <p class="b-footer__brand">&copy; ${new Date().getFullYear()} ${site.brand}. All rights reserved.</p>
      <nav class="b-footer__nav">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Use</a>
        <a href="/rates">Rates &amp; Fees</a>
      </nav>
      <div class="b-footer__disclaimer">
        <p>${site.brand} is not a lender, loan broker, or agent for any lender or loan broker. We connect consumers with potential lenders or lending partners. This site does not constitute an offer or solicitation to lend. Lenders are solely responsible for loan terms, decisions, and interest rates. APR range: ${site.aprMin}%–${site.aprMax}%. Not available in all states. Residents of AR, NY, VT, WV, PA, and other states may not be eligible. Please review the lender's terms and conditions carefully.</p>
      </div>
    </div>
  </footer>`;
}

export function LegalFooterCompact(site, theme) {
  return `
  <footer class="b-footer b-footer--compact">
    <div class="b-container">
      <p>&copy; ${new Date().getFullYear()} ${site.brand} &nbsp;|&nbsp; <a href="/privacy">Privacy</a> &nbsp;|&nbsp; <a href="/terms">Terms</a></p>
      <p class="b-footer__disc">Not a direct lender. APR: ${site.aprMin}%–${site.aprMax}%. See <a href="/rates">Rates &amp; Fees</a>.</p>
    </div>
  </footer>`;
}

export const LEGAL = { APRDisclosureBox, APRDisclosureInline, LegalFooterFull, LegalFooterCompact };
export const LEGAL_IDS = Object.keys(LEGAL);
