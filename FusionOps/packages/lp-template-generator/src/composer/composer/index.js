/**
 * Variant Composition Engine
 * 1. Selects blocks (random or from config)
 * 2. Checks anti-correlation (< 30% overlap with existing LPs in same MCC)
 * 3. Assembles full HTML page
 * 4. Returns files object compatible with existing generator.js API
 */

import { ALL_BLOCKS, BLOCK_IDS, getCombinationCount } from '../blocks/index.js';
import { resolveTheme, generateThemeCSS, getThemeCombinationCount } from '../themes/index.js';

// ─── Block Selection ────────────────────────────────────────

/**
 * Select blocks — uses config values if set, otherwise random
 */
function selectBlocks(site) {
  return {
    heroId:    site.heroBlock    || randFrom(BLOCK_IDS.heroes),
    formId:    site.formBlock    || randFrom(BLOCK_IDS.forms),
    trustId:   site.trustBlock   || randFrom(BLOCK_IDS.trust),
    benefitId: site.benefitBlock || randFrom(BLOCK_IDS.benefits),
    hiwId:     site.hiwBlock     || randFrom(BLOCK_IDS.hiw),
    faqId:     site.faqBlock     || randFrom(BLOCK_IDS.faq),
    ctaId:     site.ctaBlock     || randFrom(BLOCK_IDS.cta),
    aprId:     site.aprBlock     || randFrom(['APRDisclosureBox', 'APRDisclosureInline']),
    footerId:  site.footerBlock  || randFrom(['LegalFooterFull', 'LegalFooterCompact']),
  };
}

/**
 * Compute structural hash (fingerprint) from block selection
 * Used for similarity detection
 */
export function computeBlockHash(blockSelection) {
  const keys = Object.values(blockSelection).sort().join('|');
  let hash = 0;
  for (let i = 0; i < keys.length; i++) {
    hash = ((hash << 5) - hash) + keys.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Jaccard similarity between two block selections
 * Returns 0.0–1.0
 */
export function computeSimilarity(selA, selB) {
  const setA = new Set(Object.values(selA));
  const setB = new Set(Object.values(selB));
  const intersection = [...setA].filter(v => setB.has(v)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Anti-correlation check against existing LP block hashes
 * @param {object} candidate - block selection to check
 * @param {string[]} existingHashes - structural hashes of active LPs in same MCC
 * @param {number} threshold - max similarity allowed (default 0.30)
 */
export function passesAntiCorrelation(candidate, existingHashes = [], threshold = 0.30) {
  // No existing LPs — always passes
  if (existingHashes.length === 0) return { pass: true, maxSimilarity: 0 };

  // existingHashes can be either string hashes or block selection objects
  // For full check, pass block selection objects
  if (typeof existingHashes[0] === 'object') {
    let maxSim = 0;
    for (const existing of existingHashes) {
      const sim = computeSimilarity(candidate, existing);
      if (sim > maxSim) maxSim = sim;
      if (sim > threshold) return { pass: false, maxSimilarity: sim };
    }
    return { pass: true, maxSimilarity: maxSim };
  }

  // Hash-only mode — less precise but fast
  const candidateHash = computeBlockHash(candidate);
  const isExact = existingHashes.includes(candidateHash);
  return { pass: !isExact, maxSimilarity: isExact ? 1.0 : 0 };
}

// ─── HTML Assembler ─────────────────────────────────────────

/**
 * Assemble full HTML page from blocks + theme
 */
function assemblePage(blocks, theme, site, meta = {}) {
  const heroFn    = ALL_BLOCKS.heroes[blocks.heroId];
  const formFn    = ALL_BLOCKS.forms[blocks.formId];
  const trustFn   = ALL_BLOCKS.trust[blocks.trustId];
  const benefitFn = ALL_BLOCKS.benefits[blocks.benefitId];
  const hiwFn     = ALL_BLOCKS.hiw[blocks.hiwId];
  const faqFn     = ALL_BLOCKS.faq[blocks.faqId];
  const ctaFn     = ALL_BLOCKS.cta[blocks.ctaId];
  const aprFn     = ALL_BLOCKS.legal[blocks.aprId];
  const footerFn  = ALL_BLOCKS.legal[blocks.footerId];

  // HeroSplit needs form injected into right column
  const isSplit = blocks.heroId === 'HeroSplit';
  const heroHTML = heroFn ? heroFn(site, theme) : '';
  const formHTML = formFn ? formFn(site, theme) : '';

  const mainContent = isSplit
    ? heroHTML.replace('<!-- Form block injected here by assembler -->', formHTML)
    : heroHTML + '\n' + formHTML;

  const themeCSS = generateThemeCSS(theme);
  const buildId = meta.buildId || Math.random().toString(36).slice(2, 10);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${site.h1 || site.brand} | ${site.brand}</title>
  <meta name="description" content="${site.sub || `${site.brand} — Get up to $${Number(site.amountMax).toLocaleString()} fast`}">
  <meta name="robots" content="noindex, nofollow">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${theme.fontImport}&display=swap" rel="stylesheet">

  <!-- Voluum Lander Tracking -->
  <meta http-equiv="delegate-ch" content="sec-ch-ua https://trk.${site.voluumDomain || 'YOURDOMAIN.com'}; sec-ch-ua-mobile https://trk.${site.voluumDomain || 'YOURDOMAIN.com'}; sec-ch-ua-platform https://trk.${site.voluumDomain || 'YOURDOMAIN.com'}">
  <style>.dtpcnt{opacity:0;}</style>
  <script>
  (function(e,d,k,n,u,v,g,w,C,f,p,x,D,c,q,r,h,t,y,G,z){function A(){for(var a=d.querySelectorAll(".dtpcnt"),b=0,l=a.length;b<l;b++)a[b][w]=a[b][w].replace(/(^|\\s+)dtpcnt($|\\s+)/g,"")}z="https:"===e.location.protocol?"secure; ":"";e[f]||(e[f]=function(){(e[f].q=e[f].q||[]).push(arguments)},setTimeout(function(){c=d.createElement("script");q=d.scripts[0];c.defer=1;c.src=x+(-1===x.indexOf("?")?"?":"&")+"lpref="+n(d.referrer)+"&lpurl="+n(location[g])+"&lpt="+n(d.title)+"&vtm="+(new Date).getTime();c[C]=function(){A()};q.parentNode.insertBefore(c,q)},0),setTimeout(A,7e3))})(window,document,localStorage,encodeURIComponent,"onreadystatechange","links","href","className","onerror","dtpCallback",0,"https://trk.${site.voluumDomain || 'YOURDOMAIN.com'}/d/.js","savedCep");
  <\/script>
  <noscript><link href="https://trk.${site.voluumDomain || 'YOURDOMAIN.com'}/d/.js?noscript=true" rel="stylesheet"/></noscript>

  <!-- gtag AW-only -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${site.conversionId || 'AW-XXXXXXXXX'}"><\/script>
  <script>
    window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
    gtag('js',new Date());gtag('config','${site.conversionId || 'AW-XXXXXXXXX'}');
  <\/script>

  <!-- Custom First-Party Pixel -->
  <script>
  function pixel(ev,data){try{var p=JSON.stringify(Object.assign({e:ev,ts:Date.now(),url:location.href},data||{}));navigator.sendBeacon?navigator.sendBeacon('https://t.${site.domain || 'YOURDOMAIN.com'}/e',p):(new XMLHttpRequest).open('POST','https://t.${site.domain || 'YOURDOMAIN.com'}/e',true);}catch(e){}}
  (function(){var p=new URLSearchParams(location.search);pixel('pv',{ref:document.referrer,gclid:p.get('gclid')||'',clickid:p.get('clickid')||'',cpid:p.get('cpid')||'',lpid:p.get('lpid')||''});})();
  <\/script>

  <!-- Theme + Base CSS -->
  <style>
${themeCSS}

/* ── Base ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--font-body);color:var(--color-fg);background:var(--color-bg);line-height:1.6}
a{color:var(--color-primary);text-decoration:none}
a:hover{text-decoration:underline}
img{max-width:100%;height:auto}

/* ── Layout ── */
.b-container{max-width:var(--max-width);margin:0 auto;padding:0 1.5rem}
.b-section-title{font-family:var(--font-heading);font-size:clamp(1.5rem,4vw,2rem);font-weight:700;text-align:center;margin-bottom:2rem;color:var(--color-fg)}

/* ── Buttons ── */
.b-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;font-family:var(--font-heading);font-weight:600;border:none;cursor:pointer;text-decoration:none;transition:all .2s;border-radius:var(--radius);box-shadow:var(--btn-shadow)}
.b-btn--primary{background:var(--color-primary);color:#fff;padding:.75rem 1.75rem}
.b-btn--primary:hover{background:var(--color-primary-dark);transform:translateY(-1px)}
.b-btn--white{background:#fff;color:var(--color-primary);padding:.75rem 1.75rem}
.b-btn--neon{background:var(--color-accent);color:#fff;padding:.75rem 1.75rem}
.b-btn--lg{padding:1rem 2.25rem;font-size:1.1rem}
.b-btn--sm{padding:.5rem 1rem;font-size:.875rem}
.b-btn--wide{width:100%;max-width:360px}
.b-btn--form{padding:.75rem 1.25rem;white-space:nowrap}

/* ── Badge ── */
.b-badge{display:inline-block;background:var(--color-primary-light);color:var(--color-primary-dark);font-size:.75rem;font-weight:700;padding:.25rem .75rem;border-radius:9999px;letter-spacing:.04em;margin-bottom:.75rem}
.b-badge--contrast{background:var(--color-accent);color:#fff}
.b-badge--glass{background:rgba(255,255,255,.2);color:#fff;backdrop-filter:blur(4px)}
.b-badge--warm{background:#fff3e0;color:#e65100}
.b-badge--neon{background:var(--color-accent);color:#fff}

/* ── Hero Variants ── */
.b-hero{padding:clamp(3rem,8vw,5rem) 1.5rem}
.b-hero__inner{max-width:var(--max-width);margin:0 auto;text-align:var(--hero-align)}
.b-hero__h1{font-family:var(--font-heading);font-size:clamp(2rem,5vw,3.25rem);font-weight:700;line-height:1.15;margin-bottom:1rem;color:var(--color-fg)}
.b-hero__h1--xl{font-size:clamp(2.25rem,5.5vw,3.75rem)}
.b-hero__h1--light{color:#fff}
.b-hero__sub{font-size:clamp(1rem,2.5vw,1.2rem);color:var(--color-muted);margin-bottom:1.75rem;max-width:560px}
.b-hero__sub--light{color:rgba(255,255,255,.85)}
.b-hero__sub--muted{color:rgba(255,255,255,.7)}
.b-hero__cta-wrap{display:flex;flex-direction:column;align-items:var(--hero-align);gap:.75rem}
.b-hero__note{font-size:.8rem;color:var(--color-muted)}

/* HeroBold */
.b-hero--bold{border-top:4px solid var(--color-primary)}
.b-hero__stats{display:flex;gap:1.5rem;margin:.5rem 0 1.5rem;flex-wrap:wrap;justify-content:var(--hero-align)}
.b-stat{display:flex;flex-direction:column;align-items:center}
.b-stat__num{font-family:var(--font-heading);font-size:1.5rem;font-weight:700;color:var(--color-primary)}
.b-stat__label{font-size:.7rem;color:var(--color-muted);text-transform:uppercase;letter-spacing:.06em}
.b-stat__div{width:1px;background:var(--color-border)}

/* HeroSplit */
.b-hero--split .b-hero__inner{display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:start;text-align:left}
.b-checklist{list-style:none;margin:.5rem 0 1.5rem;display:flex;flex-direction:column;gap:.5rem;font-size:.95rem}

/* HeroGradient */
.b-hero--gradient{position:relative;overflow:hidden}
.b-hero__gradient-bg{position:absolute;inset:0;background:linear-gradient(135deg,var(--color-primary) 0%,var(--color-primary-dark) 100%);z-index:0}
.b-hero--gradient .b-hero__inner{position:relative;z-index:1}
.b-hero__inner--card{background:rgba(255,255,255,.1);border-radius:1rem;padding:2.5rem;backdrop-filter:blur(8px)}
.b-hero__amount-display{display:flex;flex-direction:column;align-items:center;margin:1rem 0}
.b-hero__amount-label{font-size:.85rem;color:rgba(255,255,255,.75)}
.b-hero__amount-value{font-family:var(--font-heading);font-size:2.5rem;font-weight:700;color:#fff}

/* HeroPetCare */
.b-hero__emoji{font-size:3rem;margin-bottom:.5rem}
.b-hero__trust-row{display:flex;gap:1.25rem;flex-wrap:wrap;justify-content:var(--hero-align);font-size:.85rem;margin-bottom:1.5rem;color:var(--color-muted)}

/* HeroMinimalDark */
.b-hero--dark{background:hsl(220 20% 12%)}
.b-hero__metrics{display:flex;gap:2rem;margin:1rem 0 1.75rem;flex-wrap:wrap;justify-content:var(--hero-align)}
.b-metric{display:flex;flex-direction:column;align-items:center}
.b-metric__val{font-family:var(--font-heading);font-size:1.4rem;font-weight:700;color:var(--color-accent)}
.b-metric__key{font-size:.7rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.06em}

/* ── Form Blocks ── */
.b-form{background:#fff;border:1px solid var(--color-border);border-radius:calc(var(--radius)*2);padding:1.75rem;box-shadow:var(--card-shadow)}
.b-form__header{margin-bottom:1.25rem;text-align:center}
.b-form__title{font-family:var(--font-heading);font-size:1.25rem;font-weight:700;color:var(--color-fg)}
.b-form__sub{font-size:.8rem;color:var(--color-muted);margin-top:.25rem}
.b-form__label{font-size:.85rem;font-weight:600;color:var(--color-muted);margin-bottom:.5rem;text-align:center}
.b-form__row{display:flex;gap:.5rem}
.b-form__input{flex:1;padding:.75rem 1rem;border:1.5px solid var(--color-border);border-radius:var(--radius);font-family:var(--font-body);font-size:1rem;outline:none;transition:border-color .15s}
.b-form__input:focus{border-color:var(--color-primary)}
.b-form__input--zip{max-width:160px}
.b-form__note{font-size:.72rem;color:var(--color-muted);margin-top:.75rem;text-align:center}
.b-form__amount-row{text-align:center;margin-bottom:.5rem}
.b-form__amount-display{font-family:var(--font-heading);font-size:2rem;font-weight:700;color:var(--color-primary)}
.b-form__slider{width:100%;accent-color:var(--color-primary);margin:.25rem 0}
.b-form__slider-labels{display:flex;justify-content:space-between;font-size:.75rem;color:var(--color-muted)}
.b-form--lg-embed{max-width:480px;margin:0 auto}

/* ── Trust ── */
.b-trust{padding:1.5rem 0;background:var(--color-bg)}
.b-trust__row{display:flex;gap:1.5rem;flex-wrap:wrap;justify-content:center;align-items:center}
.b-trust__item{display:flex;align-items:center;gap:.4rem;font-size:.85rem;color:var(--color-muted)}
.b-trust__icon{font-size:1rem}
.b-trust__stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1.5rem}
.b-trust__stat{text-align:center}
.b-trust__stat-num{font-family:var(--font-heading);font-size:1.75rem;font-weight:700;color:var(--color-primary);display:block}
.b-trust__stat-label{font-size:.75rem;color:var(--color-muted)}
.b-testimonials{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem}
.b-testimonial{background:#fff;border:1px solid var(--color-border);border-radius:var(--radius);padding:1.25rem;box-shadow:var(--card-shadow)}
.b-testimonial__stars{color:#f59e0b;font-size:.9rem;margin-bottom:.5rem}
.b-testimonial__text{font-size:.9rem;color:var(--color-fg);margin-bottom:.5rem;font-style:italic}
.b-testimonial__author{font-size:.75rem;color:var(--color-muted);font-weight:600}
.b-trust__logos{display:flex;gap:1.25rem;flex-wrap:wrap;justify-content:center}
.b-trust__logo{width:44px;height:44px;border-radius:6px;background:var(--color-primary-light);display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:800;color:var(--color-primary-dark);border:1px solid var(--color-border)}
.b-trust__label{font-size:.75rem;color:var(--color-muted);text-align:center;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.75rem}

/* ── Benefits ── */
.b-benefits{padding:var(--section-padding) 0}
.b-benefits__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--gap)}
.b-benefit-card{background:#fff;border:1px solid var(--color-border);border-radius:var(--radius);padding:1.5rem;box-shadow:var(--card-shadow);text-align:center}
.b-benefit-card__icon{font-size:1.75rem;margin-bottom:.75rem}
.b-benefit-card__title{font-family:var(--font-heading);font-weight:700;margin-bottom:.4rem;color:var(--color-fg)}
.b-benefit-card__desc{font-size:.875rem;color:var(--color-muted)}
.b-benefits__list{display:flex;flex-direction:column;gap:1.25rem;max-width:600px;margin:0 auto}
.b-benefit-row{display:flex;gap:1rem;align-items:flex-start}
.b-benefit-row__icon{font-size:1.5rem;flex-shrink:0;margin-top:.1rem}
.b-benefit-row__title{font-family:var(--font-heading);font-weight:700;margin-bottom:.2rem}
.b-benefit-row__desc{font-size:.875rem;color:var(--color-muted)}
.b-benefits__cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--gap)}
.b-bcard{background:#fff;border:1px solid var(--color-border);border-radius:var(--radius);padding:1.5rem;box-shadow:var(--card-shadow)}
.b-bcard--primary{background:var(--color-primary);color:#fff}
.b-bcard--primary .b-bcard__desc{color:rgba(255,255,255,.8)}
.b-bcard__num{font-family:var(--font-heading);font-size:1.5rem;font-weight:700;opacity:.3;margin-bottom:.5rem}
.b-bcard__title{font-family:var(--font-heading);font-weight:700;margin-bottom:.4rem}
.b-bcard__desc{font-size:.875rem;color:var(--color-muted)}

/* ── HowItWorks ── */
.b-hiw{padding:var(--section-padding) 0;background:var(--color-primary-light)}
.b-hiw__steps{display:flex;align-items:center;justify-content:center;gap:1rem;flex-wrap:wrap}
.b-hiw__step{text-align:center;max-width:200px}
.b-hiw__num{width:48px;height:48px;border-radius:50%;background:var(--color-primary);color:#fff;font-family:var(--font-heading);font-size:1.25rem;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto .75rem}
.b-hiw__title{font-family:var(--font-heading);font-weight:700;margin-bottom:.3rem}
.b-hiw__desc{font-size:.85rem;color:var(--color-muted)}
.b-hiw__arrow{font-size:1.5rem;color:var(--color-primary);opacity:.5}
.b-hiw__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--gap)}
.b-hiw__card{background:#fff;border-radius:var(--radius);padding:1.5rem;box-shadow:var(--card-shadow)}
.b-hiw__card-num{font-family:var(--font-heading);font-size:2rem;font-weight:700;color:var(--color-primary);opacity:.3;margin-bottom:.5rem}
.b-hiw__card-title{font-family:var(--font-heading);font-weight:700;margin-bottom:.4rem}
.b-hiw__card-desc{font-size:.85rem;color:var(--color-muted)}

/* ── FAQ ── */
.b-faq{padding:var(--section-padding) 0}
.b-faq__list{max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:.5rem}
.b-faq__item{border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden}
.b-faq__q{padding:1rem 1.25rem;font-family:var(--font-heading);font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center}
.b-faq__q::after{content:'+';}
details[open] .b-faq__q::after{content:'−';}
.b-faq__a{padding:.75rem 1.25rem 1rem;font-size:.9rem;color:var(--color-muted);border-top:1px solid var(--color-border)}
.b-faq__simple-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--gap);max-width:760px;margin:0 auto}
.b-faq__simple-item{background:#fff;border:1px solid var(--color-border);border-radius:var(--radius);padding:1.25rem}
.b-faq__simple-q{font-weight:600;margin-bottom:.4rem;font-size:.9rem}
.b-faq__simple-a{font-size:.85rem;color:var(--color-muted)}

/* ── CTA ── */
.b-cta{padding:var(--section-padding) 0;background:var(--color-primary)}
.b-cta__inner{text-align:center}
.b-cta__title{font-family:var(--font-heading);font-size:clamp(1.5rem,4vw,2rem);font-weight:700;color:#fff;margin-bottom:.75rem}
.b-cta__sub{color:rgba(255,255,255,.8);margin-bottom:1.5rem}
.b-cta-float{position:fixed;bottom:1rem;right:1rem;z-index:999;background:#fff;border:1px solid var(--color-border);border-radius:var(--radius);padding:.75rem 1rem;box-shadow:0 4px 16px rgba(0,0,0,.15)}
.b-cta-float__inner{display:flex;align-items:center;gap:.75rem}
.b-cta-float__text{font-size:.8rem;color:var(--color-fg);font-weight:600}

/* ── APR + Legal ── */
.b-apr{padding:1rem 1.5rem;background:hsl(0 0% 96%);border-radius:var(--radius);font-size:.75rem;color:var(--color-muted);line-height:1.6}
.b-apr--box{border:1px solid var(--color-border);margin:1.5rem auto;max-width:var(--max-width)}
.b-apr--inline{text-align:center;max-width:var(--max-width);margin:1rem auto}
.b-footer{padding:2rem 0;background:hsl(220 15% 15%);color:rgba(255,255,255,.6);margin-top:2rem}
.b-footer--compact .b-container{text-align:center;font-size:.8rem}
.b-footer__brand{font-weight:600;margin-bottom:.5rem;color:rgba(255,255,255,.8)}
.b-footer__nav{display:flex;gap:1.25rem;flex-wrap:wrap;margin:.75rem 0;font-size:.8rem}
.b-footer__nav a{color:rgba(255,255,255,.6);text-decoration:none}
.b-footer__nav a:hover{color:#fff}
.b-footer__disclaimer{font-size:.72rem;line-height:1.7;color:rgba(255,255,255,.4);max-width:820px}
.b-footer__disc{color:rgba(255,255,255,.4);margin-top:.4rem}

/* ── Responsive ── */
@media(max-width:768px){
  .b-hero--split .b-hero__inner{grid-template-columns:1fr}
  .b-hero__stats,.b-hero__metrics{justify-content:center}
  .b-btn--wide{width:100%}
  .b-cta-float{left:1rem;right:1rem}
  .b-cta-float__inner{justify-content:space-between}
}
  </style>
</head>
<body>
<!-- build:${buildId} blocks:${Object.values(blocks).join(',')} theme:${theme.color.id}+${theme.font.id} -->

${mainContent}

${trustFn ? trustFn(site, theme) : ''}
${benefitFn ? benefitFn(site, theme) : ''}
${hiwFn ? hiwFn(site, theme) : ''}
${ctaFn ? ctaFn(site, theme) : ''}
${faqFn ? faqFn(site, theme) : ''}
${aprFn ? `<div class="b-container">${aprFn(site, theme)}</div>` : ''}
${footerFn ? footerFn(site, theme) : ''}

<!-- Scroll + time tracking -->
<script>
(function(){
  var sd={},tl=[30,60];
  window.addEventListener('scroll',function(){
    var p=Math.round(window.scrollY/(document.body.scrollHeight-window.innerHeight)*100);
    [25,50,75,100].forEach(function(d){if(p>=d&&!sd[d]){sd[d]=true;if(typeof pixel==='function')pixel('scroll',{depth:d});}});
  },{passive:true});
  tl.forEach(function(s){setTimeout(function(){if(typeof pixel==='function')pixel('top',{seconds:s});},s*1000);});
})();
<\/script>
</body>
</html>`;
}

// ─── Main Compose Function ──────────────────────────────────

/**
 * Generate a composed LP
 * @param {object} site - normalized site config
 * @param {object} options
 * @param {string[]} options.existingSelections - block selections of active LPs in same MCC
 * @param {number}   options.maxRetries - anti-correlation retry limit (default 5)
 * @returns {{ files, blockSelection, theme, hash, similarityScore }}
 */
export function compose(site, options = {}) {
  const { existingSelections = [], maxRetries = 5 } = options;

  let blockSelection;
  let antiCorResult;
  let attempts = 0;

  // Retry loop for anti-correlation
  do {
    blockSelection = selectBlocks(site);
    antiCorResult = passesAntiCorrelation(blockSelection, existingSelections);
    attempts++;
  } while (!antiCorResult.pass && attempts < maxRetries);

  const theme = resolveTheme({
    colorId:   site.colorId,
    fontId:    site.fontId,
    spacingId: site.spacingId,
    layoutId:  site.layoutId,
    shadowId:  site.shadowId,
  });

  const hash = computeBlockHash(blockSelection);
  const buildId = `${hash.slice(0,6)}-${Date.now().toString(36)}`;

  const indexHtml = assemblePage(blockSelection, theme, site, { buildId });

  return {
    files: {
      'index.html':     indexHtml,
      'privacy/index.html': generatePrivacyPage(site, theme),
      'terms/index.html':   generateTermsPage(site, theme),
    },
    blockSelection,
    theme: {
      colorId:   theme.color.id,
      fontId:    theme.font.id,
      spacingId: theme.spacing.id,
      layoutId:  theme.layout.id,
      shadowId:  theme.shadow.id,
    },
    hash,
    buildId,
    attempts,
    passedAntiCorrelation: antiCorResult.pass,
    maxSimilarity: antiCorResult.maxSimilarity,
  };
}

// ─── Combination Stats ──────────────────────────────────────

export function getCompositionStats() {
  const blockCombos = getCombinationCount();
  const themeCombos = getThemeCombinationCount();
  return {
    blockCombinations: blockCombos,
    themeCombinations: themeCombos,
    totalCombinations: blockCombos * themeCombos,
    blockCounts: Object.fromEntries(
      Object.entries(BLOCK_IDS).map(([k, v]) => [k, v.length])
    ),
  };
}

// ─── Support Pages ──────────────────────────────────────────

function generatePrivacyPage(site, theme) {
  const themeCSS = generateThemeCSS(theme);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy Policy | ${site.brand}</title><link href="https://fonts.googleapis.com/css2?family=${theme.fontImport}&display=swap" rel="stylesheet"><style>${themeCSS}body{font-family:var(--font-body);color:var(--color-fg);background:var(--color-bg);padding:3rem 1.5rem;max-width:760px;margin:0 auto;line-height:1.7}h1,h2{font-family:var(--font-heading);margin:1.5rem 0 .75rem}p{margin-bottom:1rem;color:var(--color-muted)}</style></head><body><h1>Privacy Policy</h1><p>Last updated: ${new Date().toLocaleDateString()}</p><p>${site.brand} ("we", "us", or "our") is committed to protecting your personal information. This policy describes how we collect, use, and share information when you use our service.</p><h2>Information We Collect</h2><p>We collect information you provide when completing our form, including name, address, income, and financial information necessary to match you with potential lenders.</p><h2>How We Use Information</h2><p>We use your information to connect you with lenders in our network who may be able to provide you with a loan. We may share your information with third-party lenders and marketing partners.</p><h2>Contact Us</h2><p>For privacy inquiries, please contact us through our website.</p><p><a href="/">← Back to Home</a></p></body></html>`;
}

function generateTermsPage(site, theme) {
  const themeCSS = generateThemeCSS(theme);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terms of Use | ${site.brand}</title><link href="https://fonts.googleapis.com/css2?family=${theme.fontImport}&display=swap" rel="stylesheet"><style>${themeCSS}body{font-family:var(--font-body);color:var(--color-fg);background:var(--color-bg);padding:3rem 1.5rem;max-width:760px;margin:0 auto;line-height:1.7}h1,h2{font-family:var(--font-heading);margin:1.5rem 0 .75rem}p{margin-bottom:1rem;color:var(--color-muted)}</style></head><body><h1>Terms of Use</h1><p>Last updated: ${new Date().toLocaleDateString()}</p><p>By using ${site.brand}, you agree to these terms. ${site.brand} is not a lender. We connect consumers with potential lenders. We do not make credit decisions or guarantee loan approval.</p><h2>Disclaimer</h2><p>APR range: ${site.aprMin}%–${site.aprMax}%. Not available in all states. Please review all lender terms before accepting any loan offer.</p><p><a href="/">← Back to Home</a></p></body></html>`;
}

function randFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
