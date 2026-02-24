/**
 * Trust Blocks
 */

export function TrustBadges(site, theme) {
  return `
  <section class="b-trust b-trust--badges">
    <div class="b-container">
      <div class="b-trust__row">
        <div class="b-trust__item"><span class="b-trust__icon">🔒</span><span>256-bit SSL</span></div>
        <div class="b-trust__item"><span class="b-trust__icon">⭐</span><span>300+ Lenders</span></div>
        <div class="b-trust__item"><span class="b-trust__icon">✓</span><span>No Credit Impact</span></div>
        <div class="b-trust__item"><span class="b-trust__icon">⚡</span><span>Instant Decision</span></div>
        <div class="b-trust__item"><span class="b-trust__icon">📋</span><span>FCRA Compliant</span></div>
      </div>
    </div>
  </section>`;
}

export function TrustStats(site, theme) {
  return `
  <section class="b-trust b-trust--stats">
    <div class="b-container">
      <div class="b-trust__stats-row">
        <div class="b-trust__stat"><span class="b-trust__stat-num">2M+</span><span class="b-trust__stat-label">Customers Helped</span></div>
        <div class="b-trust__stat"><span class="b-trust__stat-num">$${Number(site.amountMax).toLocaleString()}+</span><span class="b-trust__stat-label">Max Available</span></div>
        <div class="b-trust__stat"><span class="b-trust__stat-num">300+</span><span class="b-trust__stat-label">Lending Partners</span></div>
        <div class="b-trust__stat"><span class="b-trust__stat-num">4.8★</span><span class="b-trust__stat-label">Customer Rating</span></div>
      </div>
    </div>
  </section>`;
}

export function TrustTestimonials(site, theme) {
  const reviews = [
    { name: 'Sarah M.', loc: 'Texas', text: 'Got approved in minutes. The process was so much easier than I expected.', stars: 5 },
    { name: 'James K.', loc: 'Florida', text: 'Finally found a lender that worked with my credit situation. Highly recommend.', stars: 5 },
    { name: 'Linda R.', loc: 'California', text: 'Transparent rates, no hidden fees. Exactly what I needed.', stars: 4 },
  ];
  return `
  <section class="b-trust b-trust--testimonials">
    <div class="b-container">
      <h2 class="b-section-title">What Our Customers Say</h2>
      <div class="b-testimonials">
        ${reviews.map(r => `
        <div class="b-testimonial">
          <div class="b-testimonial__stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
          <p class="b-testimonial__text">"${r.text}"</p>
          <div class="b-testimonial__author">${r.name} · ${r.loc}</div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
}

export function TrustLogos(site, theme) {
  const logos = ['SSL', 'BBB', 'TRV', 'FCRA', 'NOR'];
  return `
  <section class="b-trust b-trust--logos">
    <div class="b-container">
      <p class="b-trust__label">Trusted &amp; Verified</p>
      <div class="b-trust__logos">
        ${logos.map(l => `<div class="b-trust__logo">${l}</div>`).join('')}
      </div>
    </div>
  </section>`;
}

export const TRUST = { TrustBadges, TrustStats, TrustTestimonials, TrustLogos };
export const TRUST_IDS = Object.keys(TRUST);
