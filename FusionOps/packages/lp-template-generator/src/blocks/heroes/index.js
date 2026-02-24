/**
 * Hero Blocks
 * Each function receives (site, theme) → returns HTML string
 * site = normalized config from schema.js
 * theme = resolved theme tokens from themes/index.js
 */

// ─── HeroMinimal ────────────────────────────────────────────
// Single column, centered, clean — high trust signal
export function HeroMinimal(site, theme) {
  return `
  <section class="b-hero b-hero--minimal">
    <div class="b-hero__inner">
      ${site.badge ? `<div class="b-badge">${site.badge}</div>` : ''}
      <h1 class="b-hero__h1">${site.h1}</h1>
      <p class="b-hero__sub">${site.sub || `Get up to <strong>$${Number(site.amountMax).toLocaleString()}</strong> — check your rate in minutes`}</p>
      <div class="b-hero__cta-wrap">
        <a href="${site.voluumClickUrl || '#form'}" class="b-btn b-btn--primary b-btn--lg">${site.cta}</a>
        <p class="b-hero__note">No credit impact &nbsp;·&nbsp; 2-minute process &nbsp;·&nbsp; All credit welcome</p>
      </div>
    </div>
  </section>`;
}

// ─── HeroBold ───────────────────────────────────────────────
// Large headline, accent color background strip, high urgency
export function HeroBold(site, theme) {
  return `
  <section class="b-hero b-hero--bold">
    <div class="b-hero__accent-bar"></div>
    <div class="b-hero__inner">
      ${site.badge ? `<div class="b-badge b-badge--contrast">${site.badge}</div>` : ''}
      <h1 class="b-hero__h1 b-hero__h1--xl">
        ${site.h1span ? `${site.h1} <span class="b-accent">${site.h1span}</span>` : site.h1}
      </h1>
      <p class="b-hero__sub">${site.sub || 'Fast decisions. Real money. No runaround.'}</p>
      <div class="b-hero__stats">
        <div class="b-stat"><span class="b-stat__num">$${Number(site.amountMax).toLocaleString()}</span><span class="b-stat__label">Max Amount</span></div>
        <div class="b-stat__div"></div>
        <div class="b-stat"><span class="b-stat__num">${site.aprMin}%</span><span class="b-stat__label">Rates From</span></div>
        <div class="b-stat__div"></div>
        <div class="b-stat"><span class="b-stat__num">300+</span><span class="b-stat__label">Lenders</span></div>
      </div>
      <a href="${site.voluumClickUrl || '#form'}" class="b-btn b-btn--primary b-btn--lg b-btn--wide">${site.cta}</a>
    </div>
  </section>`;
}

// ─── HeroSplit ──────────────────────────────────────────────
// Left: copy / Right: form placeholder (form block fills the right)
// Returns only the left side — assembler wraps both in split layout
export function HeroSplit(site, theme) {
  return `
  <section class="b-hero b-hero--split">
    <div class="b-hero__split-left">
      ${site.badge ? `<div class="b-badge">${site.badge}</div>` : ''}
      <h1 class="b-hero__h1">${site.h1}</h1>
      <p class="b-hero__sub">${site.sub || `Borrow up to $${Number(site.amountMax).toLocaleString()} with flexible repayment options`}</p>
      <ul class="b-checklist">
        <li>✓ Rates from ${site.aprMin}% APR</li>
        <li>✓ Decisions in minutes</li>
        <li>✓ No prepayment penalty</li>
        <li>✓ All credit types considered</li>
      </ul>
    </div>
    <div class="b-hero__split-right" id="form-anchor">
      <!-- Form block injected here by assembler -->
    </div>
  </section>`;
}

// ─── HeroGradient ───────────────────────────────────────────
// Full-width gradient background, floating card effect
export function HeroGradient(site, theme) {
  return `
  <section class="b-hero b-hero--gradient">
    <div class="b-hero__gradient-bg"></div>
    <div class="b-hero__inner b-hero__inner--card">
      ${site.badge ? `<div class="b-badge b-badge--glass">${site.badge}</div>` : ''}
      <h1 class="b-hero__h1 b-hero__h1--light">${site.h1}</h1>
      <p class="b-hero__sub b-hero__sub--light">${site.sub || 'The smarter way to get the cash you need'}</p>
      <div class="b-hero__amount-display">
        <span class="b-hero__amount-label">Borrow up to</span>
        <span class="b-hero__amount-value">$${Number(site.amountMax).toLocaleString()}</span>
      </div>
      <a href="${site.voluumClickUrl || '#form'}" class="b-btn b-btn--white b-btn--lg">${site.cta}</a>
    </div>
  </section>`;
}

// ─── HeroPetCare ────────────────────────────────────────────
// Warm emotional tone for pet financing vertical
export function HeroPetCare(site, theme) {
  return `
  <section class="b-hero b-hero--petcare">
    <div class="b-hero__inner">
      <div class="b-hero__emoji">🐾</div>
      ${site.badge ? `<div class="b-badge b-badge--warm">${site.badge}</div>` : ''}
      <h1 class="b-hero__h1">${site.h1 || 'Pet Care Financing — Because They Deserve the Best'}</h1>
      <p class="b-hero__sub">${site.sub || `Cover vet bills up to $${Number(site.amountMax).toLocaleString()} with flexible monthly payments`}</p>
      <div class="b-hero__trust-row">
        <span>🏥 Any vet accepted</span>
        <span>⚡ Instant decisions</span>
        <span>💳 No prepayment fees</span>
      </div>
      <a href="${site.voluumClickUrl || '#form'}" class="b-btn b-btn--primary b-btn--lg">${site.cta}</a>
    </div>
  </section>`;
}

// ─── HeroMinimalDark ────────────────────────────────────────
// Dark background, fintech aesthetic
export function HeroMinimalDark(site, theme) {
  return `
  <section class="b-hero b-hero--dark">
    <div class="b-hero__inner">
      ${site.badge ? `<div class="b-badge b-badge--neon">${site.badge}</div>` : ''}
      <h1 class="b-hero__h1 b-hero__h1--light">${site.h1}</h1>
      <p class="b-hero__sub b-hero__sub--muted">${site.sub || 'Fast, flexible financing — apply in under 2 minutes'}</p>
      <div class="b-hero__metrics">
        <div class="b-metric"><span class="b-metric__val">$${Number(site.amountMax).toLocaleString()}</span><span class="b-metric__key">Available</span></div>
        <div class="b-metric"><span class="b-metric__val">${site.aprMin}–${site.aprMax}%</span><span class="b-metric__key">APR Range</span></div>
        <div class="b-metric"><span class="b-metric__val">2 min</span><span class="b-metric__key">To Apply</span></div>
      </div>
      <a href="${site.voluumClickUrl || '#form'}" class="b-btn b-btn--neon b-btn--lg">${site.cta}</a>
    </div>
  </section>`;
}

// Registry
export const HEROES = {
  HeroMinimal,
  HeroBold,
  HeroSplit,
  HeroGradient,
  HeroPetCare,
  HeroMinimalDark,
};

export const HERO_IDS = Object.keys(HEROES);
