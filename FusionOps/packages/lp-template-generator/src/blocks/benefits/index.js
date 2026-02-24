/**
 * Benefits Blocks
 */
export function BenefitsGrid(site, theme) {
  const items = [
    { icon: '⚡', title: 'Fast Decisions', desc: 'Get a lending decision in minutes, not days' },
    { icon: '💰', title: `Up to $${Number(site.amountMax).toLocaleString()}`, desc: 'Flexible amounts to fit your exact needs' },
    { icon: '📅', title: 'Flexible Terms', desc: 'Choose repayment schedules that work for you' },
    { icon: '🔒', title: 'Secure & Private', desc: '256-bit encryption protects your data' },
    { icon: '✅', title: 'All Credit Welcome', desc: 'We work with all credit backgrounds' },
    { icon: '📞', title: '24/7 Support', desc: 'Real help whenever you need it' },
  ];
  return `
  <section class="b-benefits b-benefits--grid">
    <div class="b-container">
      <h2 class="b-section-title">Why Choose Us</h2>
      <div class="b-benefits__grid">
        ${items.map(i => `
        <div class="b-benefit-card">
          <div class="b-benefit-card__icon">${i.icon}</div>
          <div class="b-benefit-card__title">${i.title}</div>
          <div class="b-benefit-card__desc">${i.desc}</div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
}

export function BenefitsStacked(site, theme) {
  const items = [
    { icon: '⚡', title: 'Quick Approval', desc: `Apply for up to $${Number(site.amountMax).toLocaleString()} — see your options in minutes` },
    { icon: '🏦', title: '300+ Lenders', desc: 'Our network gives you access to more competitive rates' },
    { icon: '🔐', title: 'Bank-Level Security', desc: 'Your information is protected with military-grade encryption' },
    { icon: '📱', title: '100% Online', desc: 'No paperwork, no branch visits — everything handled digitally' },
  ];
  return `
  <section class="b-benefits b-benefits--stacked">
    <div class="b-container">
      <h2 class="b-section-title">Built Around You</h2>
      <div class="b-benefits__list">
        ${items.map(i => `
        <div class="b-benefit-row">
          <div class="b-benefit-row__icon">${i.icon}</div>
          <div class="b-benefit-row__body">
            <div class="b-benefit-row__title">${i.title}</div>
            <div class="b-benefit-row__desc">${i.desc}</div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;
}

export function BenefitsCards(site, theme) {
  return `
  <section class="b-benefits b-benefits--cards">
    <div class="b-container">
      <h2 class="b-section-title">Everything You Need</h2>
      <div class="b-benefits__cards">
        <div class="b-bcard b-bcard--primary">
          <div class="b-bcard__num">01</div>
          <div class="b-bcard__title">Simple Application</div>
          <div class="b-bcard__desc">Fill out one short form — no faxing, no paperwork</div>
        </div>
        <div class="b-bcard">
          <div class="b-bcard__num">02</div>
          <div class="b-bcard__title">Instant Match</div>
          <div class="b-bcard__desc">We match you to lenders most likely to approve your request</div>
        </div>
        <div class="b-bcard">
          <div class="b-bcard__num">03</div>
          <div class="b-bcard__title">Fast Funding</div>
          <div class="b-bcard__desc">Funds deposited as fast as the next business day</div>
        </div>
      </div>
    </div>
  </section>`;
}

export const BENEFITS = { BenefitsGrid, BenefitsStacked, BenefitsCards };
export const BENEFIT_IDS = Object.keys(BENEFITS);
