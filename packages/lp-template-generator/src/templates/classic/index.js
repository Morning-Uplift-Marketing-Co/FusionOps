/**
 * Classic Template Generator
 * Simple, clean landing page template
 */

import { COLORS, FONTS, RADIUS } from '../../core/template-registry.js';

function hslStr(arr) {
  return `hsl(${arr[0]}, ${arr[1]}%, ${arr[2]}%)`;
}

export function generate(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const r = RADIUS.find(x => x.id === site.radius) || RADIUS[2];
  const brand = site.brand || "LoanBridge";
  const loanLabel = site.loanLabel || "Personal Loans";
  const h1 = site.h1 || `Fast ${loanLabel} Up To $${(site.amountMax || 5000).toLocaleString()}`;
  const cta = site.cta || "Check Your Rate";
  const sub = site.sub || "Get approved in minutes. Funds as fast as next business day.";
  const companyName = brand;
  const domain = site.domain || "example.com";
  const amountMin = site.amountMin || 500;
  const amountMax = site.amountMax || 35000;
  const aid = site.aid || "";

  const files = {};

  // ─── package.json ───────────────────────────────────────────
  files["package.json"] = JSON.stringify({
    name: brand.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-lp",
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "astro dev",
      build: "astro build",
      preview: "astro preview",
    },
    dependencies: {
      astro: "^5.2.0",
      "@astrojs/sitemap": "^3.2.0",
      "astro-compress": "^2.3.0",
    },
    devDependencies: {
      "@tailwindcss/vite": "^4.0.0",
      tailwindcss: "^4.0.0",
      typescript: "^5.7.0",
    },
  }, null, 2);

  // ─── astro.config.mjs ──────────────────────────────────────
  files["astro.config.mjs"] = `import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'https://${domain}',
  build: {
    assets: '_assets',
    inlineStylesheets: 'always',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      sourcemap: false,
      minify: 'terser',
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) return 'vendor';
          }
        }
      }
    }
  },
  integrations: [
    sitemap(),
    compress({
      CSS: true,
      HTML: {
        removeAttributeQuotes: false,
        removeComments: true,
        collapseWhitespace: true,
        minifyJS: true,
        minifyCSS: true
      },
      Image: false,
      JavaScript: true,
      SVG: true
    }),
  ],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport'
  },
});
`;

  // ─── tsconfig.json ─────────────────────────────────────────
  files["tsconfig.json"] = JSON.stringify({
    extends: "astro/tsconfigs/strict",
    compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } },
  }, null, 2);

  // ─── .env ──────────────────────────────────────────────────
  files[".env"] = `SITE_URL=https://${domain}
PUBLIC_SITE_NAME=${brand}
PUBLIC_COMPANY_NAME=${companyName}
PUBLIC_CONVERSION_ID=${site.conversionId || ""}
PUBLIC_FORM_START_LABEL=${site.formStartLabel || ""}
PUBLIC_FORM_SUBMIT_LABEL=${site.formSubmitLabel || ""}
PUBLIC_AID=${aid}
PUBLIC_VOLUUM_DOMAIN=${site.voluumDomain || ""}
`;

  // ─── src/styles/global.css ─────────────────────────────────
  files["src/styles/global.css"] = `@import "tailwindcss";

:root {
  --color-primary: ${hslStr(c.p)};
  --color-primary-hover: ${hslStr([c.p[0], c.p[1], Math.max(c.p[2] - 5, 10)])};
  --color-secondary: ${hslStr(c.s)};
  --color-accent: ${hslStr(c.a)};
  --color-surface: ${hslStr(c.bg)};
  --color-surface-alt: ${hslStr([c.bg[0], c.bg[1], Math.max(c.bg[2] - 2, 90)])};
  --color-text: ${hslStr(c.fg)};
  --color-text-muted: ${hslStr([c.fg[0], Math.max(c.fg[1] - 20, 10), Math.min(c.fg[2] + 30, 60)])};
  --color-border: ${hslStr([c.bg[0], Math.min(c.bg[1] + 10, 40), Math.max(c.bg[2] - 7, 85)])};
  --color-danger: hsl(0, 84%, 60%);
  --font-sans: ${f.family}, system-ui, -apple-system, sans-serif;
  --radius-sm: 0.375rem;
  --radius-md: ${r.v};
  --radius-lg: 0.75rem;
  color-scheme: light;
}

html {
  font-family: var(--font-sans);
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

body {
  color: var(--color-text);
  background: var(--color-surface);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.5;
}

img, svg { display: block; max-width: 100%; height: auto; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

.skip-link {
  position: fixed; top: 0; left: 0; z-index: 100;
  background: var(--color-primary); color: #fff;
  padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: 700;
  transform: translateY(-100%); transition: transform 0.2s;
}
.skip-link:focus { transform: translateY(0); outline: 3px solid var(--color-accent); outline-offset: 2px; }

a:focus-visible,
button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
[tabindex]:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--color-border);
  outline: none;
  cursor: pointer;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
input[type="range"]::-moz-range-thumb {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
input[type="range"]:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
}
`;

  // ─── src/layouts/BaseLayout.astro ──────────────────────────
  files["src/layouts/BaseLayout.astro"] = `---
interface Props {
  title: string;
  description: string;
  canonical?: string;
  conversionId?: string;
  voluumDomain?: string;
  noindex?: boolean;
}

const {
  title,
  description,
  canonical,
  conversionId = '',
  voluumDomain = '',
  noindex = false,
} = Astro.props;

const canonicalUrl = canonical || Astro.url.href;
---

<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content={description} />
  <meta name="theme-color" content="${hslStr(c.p)}" />
  <meta name="color-scheme" content="light" />
  <title>{title}</title>
  <link rel="canonical" href={canonicalUrl} />
  {noindex && <meta name="robots" content="noindex, nofollow" />}

  <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
  <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

  {voluumDomain && (
    <>
      <link rel="dns-prefetch" href={\`https://\${voluumDomain}\`} />
      <link rel="preconnect" href={\`https://\${voluumDomain}\`} crossorigin />
    </>
  )}

  {conversionId && (
    <>
      <script async src={\`https://www.googletagmanager.com/gtag/js?id=\${conversionId}\`}></script>
      <script is:inline define:vars={{ conversionId }}>
        window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',conversionId);
      </script>
    </>
  )}

  <link rel="preload" href={\`https://fonts.googleapis.com/css2?family=${f.import}&display=swap\`} as="style" />
  <link href={\`https://fonts.googleapis.com/css2?family=${f.import}&display=swap\`} rel="stylesheet" media="print" onload="this.media='all'" />
  <noscript><link href={\`https://fonts.googleapis.com/css2?family=${f.import}&display=swap\`} rel="stylesheet" /></noscript>

  <style is:global>
    @import '../styles/global.css';
  </style>

  {voluumDomain && (
    <script is:inline define:vars={{ voluumDomain }}>
      (function(){ var i = new Image(1,1); i.src = 'https://' + voluumDomain + '/impression?'; })();
    </script>
  )}
</head>
<body class="min-h-screen bg-[var(--color-surface)]">

  <script is:inline>
    (function(){
      var PX='https://t.'+window.location.hostname+'/e';
      var sid=crypto.randomUUID();
      var up=new URLSearchParams(window.location.search);
      var cid=up.get('clickid')||up.get('click_id')||up.get('cid')||'';
      var gid=up.get('gclid')||'';
      if(cid)sessionStorage.setItem('click_id',cid);
      if(gid)sessionStorage.setItem('gclid',gid);
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(function(k){var v=up.get(k);if(v)sessionStorage.setItem(k,v);});
      function fire(e,d){var p=new URLSearchParams({e:e,sid:sid,cid:cid,gid:gid,ts:Date.now(),url:window.location.pathname,ref:document.referrer});if(d)for(var k in d)p.set(k,d[k]);navigator.sendBeacon(PX,p);}
      window.__pixel=fire;
      fire('pv',{ua:navigator.userAgent,sw:screen.width,sh:screen.height});
      var sf={};window.addEventListener('scroll',function(){var h=document.documentElement.scrollHeight-window.innerHeight;if(h<=0)return;var pct=Math.round(window.scrollY/h*100);[25,50,75,100].forEach(function(t){if(pct>=t&&!sf[t]){sf[t]=true;fire('s'+t);}});},{passive:true});
      setTimeout(function(){fire('t30');},30000);setTimeout(function(){fire('t60');},60000);
    })();
  </script>

  <slot />
</body>
</html>
`;

  // ─── src/components/AmountSlider.astro ─────────────────────
  files["src/components/AmountSlider.astro"] = `---
interface Props {
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  id?: string;
}
const {
  label = 'How much do you need?',
  min = ${amountMin},
  max = ${amountMax},
  step = 500,
  defaultValue = ${Math.round((amountMin + amountMax) / 2)},
  id = 'amount-slider',
} = Astro.props;
---

<div class="w-full max-w-md mx-auto" role="group" aria-labelledby={\`\${id}-label\`}>
  {label && <label id={\`\${id}-label\`} for={id} class="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}
  <div class="text-center mb-4">
    <output id={\`\${id}-display\`} for={id} class="text-3xl font-bold text-[var(--color-primary)]" aria-live="polite">
      \${defaultValue.toLocaleString()}
    </output>
  </div>
  <input type="range" id={id} name="amount" min={min} max={max} step={step} value={defaultValue}
    class="w-full h-2 rounded-lg cursor-pointer"
    aria-label={\`Loan amount from $\${min.toLocaleString()} to $\${max.toLocaleString()}\`}
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={defaultValue}
    aria-valuetext={\`$\${defaultValue.toLocaleString()}\`} />
  <div class="flex justify-between text-xs text-gray-500 mt-1" aria-hidden="true">
    <span>\${min.toLocaleString()}</span>
    <span>\${max.toLocaleString()}</span>
  </div>
</div>

<script define:vars={{ id, defaultValue }}>
  (function() {
    const slider = document.getElementById(id);
    const display = document.getElementById(id + '-display');
    if (!slider || !display) return;
    function formatAmount(val) { return '$' + Number(val).toLocaleString(); }
    function update(val) {
      display.textContent = formatAmount(val);
      slider.setAttribute('aria-valuenow', val);
      slider.setAttribute('aria-valuetext', formatAmount(val));
      sessionStorage.setItem('amount', val.toString());
    }
    slider.addEventListener('input', function(e) { update(e.target.value); });
    const stored = sessionStorage.getItem('amount');
    if (stored) { slider.value = stored; update(stored); }
    else { update(defaultValue); }
  })();
</script>
`;

  // ─── src/components/ZipInput.astro ─────────────────────────
  files["src/components/ZipInput.astro"] = `---
interface Props {
  label?: string;
  placeholder?: string;
  id?: string;
}
const { label = 'Enter your ZIP code', placeholder = '00000', id = 'zip-input' } = Astro.props;
---

<div class="w-full max-w-sm mx-auto">
  {label && <label for={id} class="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}
  <input type="text" id={id} name="zip" inputmode="numeric" pattern="[0-9]{5}" maxlength="5"
    autocomplete="postal-code" placeholder={placeholder} required
    class="w-full px-4 py-3 text-lg text-center tracking-widest border-2 border-gray-300 rounded-lg
           focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20
           focus:outline-none transition-colors duration-150"
    aria-label="5-digit ZIP code" />
  <p id={\`\${id}-error\`} class="mt-1 text-sm text-red-600 hidden" role="alert">Please enter a valid 5-digit ZIP code</p>
</div>

<script define:vars={{ id }}>
  (function() {
    const input = document.getElementById(id);
    const error = document.getElementById(id + '-error');
    if (!input) return;
    input.addEventListener('input', function(e) {
      e.target.value = e.target.value.replace(/\\D/g, '').slice(0, 5);
      if (e.target.value.length === 5) { error.classList.add('hidden'); sessionStorage.setItem('zip', e.target.value); }
      else { sessionStorage.removeItem('zip'); }
    });
    input.addEventListener('blur', function(e) {
      if (e.target.value.length > 0 && e.target.value.length !== 5) error.classList.remove('hidden');
      else error.classList.add('hidden');
    });
    const stored = sessionStorage.getItem('zip');
    if (stored && stored.length === 5) input.value = stored;
  })();
</script>
`;

  // ─── src/components/CTAButton.astro ────────────────────────
  files["src/components/CTAButton.astro"] = `---
interface Props {
  text?: string;
  leadsGateFormId: string;
  id?: string;
}
const {
  text = '${cta}',
  leadsGateFormId,
  id = 'cta-button',
} = Astro.props;
---

<div class="w-full max-w-sm mx-auto">
  <button id={id} type="button"
    class="w-full py-4 px-6 text-lg font-bold text-white rounded-lg
           bg-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/90
           active:scale-[0.98] transition-all duration-150
           focus:outline-none focus:ring-4 focus:ring-[var(--color-secondary)]/30
           disabled:opacity-50 disabled:cursor-not-allowed"
    aria-label={text}>{text}</button>
  <p id={\`\${id}-error\`} class="mt-2 text-sm text-center text-red-600 hidden" role="alert">Please enter a valid ZIP code first</p>
  <div id="leadsgate-container" class="mt-4 hidden"></div>
</div>

<script define:vars={{ id, leadsGateFormId }}>
  (function() {
    var btn = document.getElementById(id);
    var error = document.getElementById(id + '-error');
    var container = document.getElementById('leadsgate-container');
    if (!btn) return;
    var loaded = false;
    var clickId = sessionStorage.getItem('click_id') || '';
    var convId = (window.__CONVERSION_ID__) || '';
    var fsLabel = (window.__FORM_START_LABEL__) || '';
    var fsubLabel = (window.__FORM_SUBMIT_LABEL__) || '';
    var fsFired = sessionStorage.getItem('_fs') === '1';
    btn.addEventListener('click', function() {
      var zip = sessionStorage.getItem('zip');
      if (!zip || zip.length !== 5) {
        error.classList.remove('hidden');
        var zi = document.getElementById('zip-input'); if (zi) zi.focus();
        return;
      }
      error.classList.add('hidden');
      if (window.__pixel) window.__pixel('cta',{zip:zip,amount:sessionStorage.getItem('amount')||''});
      btn.disabled = true; btn.textContent = 'Loading...';
      if (!loaded) loadLG(zip, sessionStorage.getItem('amount') || '', clickId);
    });
    function loadLG(zip, amount, cid) {
      loaded = true; container.classList.remove('hidden');
      window._lg_form_init_ = {
        aid: leadsGateFormId,
        template: 'fresh',
        click_id: cid,
        onFormLoad: function() {
          if (!fsFired) { fsFired = true; sessionStorage.setItem('_fs','1'); if (convId && fsLabel && typeof gtag === 'function') gtag('event','conversion',{send_to:convId+'/'+fsLabel}); }
          if (window.__pixel) window.__pixel('fl');
        },
        onStepChange: function(step) { if (window.__pixel) window.__pixel('step',{step:step}); },
        onSubmit: function() {
          if (convId && fsubLabel && typeof gtag === 'function') gtag('event','conversion',{send_to:convId+'/'+fsubLabel});
          if (window.__pixel) window.__pixel('fs',{clickid:cid});
        },
        onSuccess: function(response) {
          if (window.__pixel) window.__pixel('success',{clickid:cid,lead_id:response&&response.lead_id||''});
        }
      };
      var s = document.createElement('script');
      s.src = 'https://apikeep.com/form/applicationInit.js'; s.async = true;
      s.onerror = function() { btn.disabled = false; btn.textContent = '${cta}'; loaded = false; container.classList.add('hidden'); error.textContent = 'Failed to load. Please try again.'; error.classList.remove('hidden'); };
      document.body.appendChild(s);
    }
  })();
</script>
`;

  // ─── src/components/ComplianceBlock.astro ───────────────────
  files["src/components/ComplianceBlock.astro"] = `---
interface Props {
  companyName?: string;
  aprMin?: number;
  aprMax?: number;
  apDisclosure?: boolean;
  stateDisclosures?: boolean;
}
const {
  companyName = '${companyName}',
  aprMin = ${site.aprMin || 5.99},
  aprMax = ${site.aprMax || 35.99},
  apDisclosure = true,
  stateDisclosures = true,
} = Astro.props;
---

<footer class="w-full max-w-2xl mx-auto mt-12 px-4 pb-8" role="contentinfo" aria-label="Legal disclosures">
  <div class="border-t border-gray-200 pt-6">
    <div class="text-xs text-gray-500 leading-relaxed space-y-3" role="note">
      {apDisclosure && (
        <p><strong>APR Disclosure:</strong> Some lenders may offer loans with an Annual Percentage Rate (APR) between {aprMin}% and {aprMax}%. The APR depends on your credit score, income, debt, loan amount, and credit history. Only borrowers with excellent credit qualify for the lowest rates. All loans subject to credit review and approval.</p>
      )}
      <p><strong>Not a Lender:</strong> {companyName} is not a lender, does not broker loans, and does not make credit decisions. {companyName} provides a free service to connect consumers with lenders who may offer them loans.</p>
      <p><strong>Credit Impact:</strong> Checking your rate will not affect your credit score. If you accept a loan offer, the lender will conduct a hard credit inquiry which may impact your score.</p>
      {stateDisclosures && (
        <p><strong>State Disclosures:</strong> Loans may not be available in all states. Availability and terms depend on your state of residence and applicable laws.</p>
      )}
      <p class="pt-2 text-gray-400"><small>&copy; {new Date().getFullYear()} {companyName}. All rights reserved.</small></p>
    </div>
  </div>
</footer>
`;

  // ─── src/lib/tracking.ts ───────────────────────────────────
  files["src/lib/tracking.ts"] = `const STORAGE_KEYS = ['zip', 'amount', 'click_id', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'] as const;
type StorageKey = typeof STORAGE_KEYS[number];

export function setTrackingValue(key: StorageKey, value: string): void { sessionStorage.setItem(key, value); }
export function getTrackingValue(key: StorageKey): string { return sessionStorage.getItem(key) || ''; }
export function getTrackingData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of STORAGE_KEYS) { const v = sessionStorage.getItem(key); if (v) data[key] = v; }
  return data;
}
export function firePixel(event: string, extra?: Record<string, string>): void {
  if (typeof (window as any).__pixel === 'function') { (window as any).__pixel(event, extra); }
}
`;

  // ─── src/pages/index.astro ─────────────────────────────────
  files["src/pages/index.astro"] = `---
import BaseLayout from '../layouts/BaseLayout.astro';
import ZipInput from '../components/ZipInput.astro';
import AmountSlider from '../components/AmountSlider.astro';
import CTAButton from '../components/CTAButton.astro';
import ComplianceBlock from '../components/ComplianceBlock.astro';

const conversionId = import.meta.env.PUBLIC_CONVERSION_ID || '';
const formStartLabel = import.meta.env.PUBLIC_FORM_START_LABEL || '';
const formSubmitLabel = import.meta.env.PUBLIC_FORM_SUBMIT_LABEL || '';
const aid = import.meta.env.PUBLIC_AID || '';
const voluumDomain = import.meta.env.PUBLIC_VOLUUM_DOMAIN || '';
const companyName = import.meta.env.PUBLIC_COMPANY_NAME || '${companyName}';
const siteName = import.meta.env.PUBLIC_SITE_NAME || '${brand}';
---

<BaseLayout
  title={\`\${siteName} — ${loanLabel}\`}
  description="${sub}"
  conversionId={conversionId}
  voluumDomain={voluumDomain}
  noindex={true}
>
  <script is:inline define:vars={{ conversionId, formStartLabel, formSubmitLabel }}>
    window.__CONVERSION_ID__=conversionId;window.__FORM_START_LABEL__=formStartLabel;window.__FORM_SUBMIT_LABEL__=formSubmitLabel;
  </script>
  <main id="main-content" class="flex flex-col items-center px-4 py-8 sm:py-12">

    <!-- Hero -->
    <section class="w-full max-w-lg text-center mb-8" aria-labelledby="hero-heading">
      <h1 id="hero-heading" class="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 leading-tight" style="text-wrap:balance">
        ${h1}
      </h1>
      <p class="text-base sm:text-lg text-gray-600 leading-relaxed" style="text-wrap:pretty">
        ${sub}
      </p>
    </section>

    <!-- Trust Indicators -->
    <section class="w-full max-w-md mb-8" aria-label="Trust indicators">
      <ul class="flex justify-center gap-6 text-center text-sm text-gray-500 list-none p-0 m-0" role="list">
        <li class="flex flex-col items-center">
          <svg class="w-6 h-6 mb-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" loading="lazy"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          <span>256-bit SSL</span>
        </li>
        <li class="flex flex-col items-center">
          <svg class="w-6 h-6 mb-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" loading="lazy"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>2-Min Process</span>
        </li>
        <li class="flex flex-col items-center">
          <svg class="w-6 h-6 mb-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" loading="lazy"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>No Credit Impact</span>
        </li>
      </ul>
    </section>

    <!-- Form Card -->
    <section class="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-100 p-6 sm:p-8 mb-8" aria-labelledby="form-heading" role="form">
      <h2 id="form-heading" class="sr-only">Loan Application Form</h2>
      <div class="space-y-6">
        <div>
          <div class="flex items-center gap-2 mb-4">
            <span class="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-sm font-bold" aria-hidden="true">1</span>
            <span class="text-sm font-semibold text-gray-700">Choose your amount</span>
          </div>
          <AmountSlider />
        </div>
        <div>
          <div class="flex items-center gap-2 mb-4">
            <span class="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-sm font-bold" aria-hidden="true">2</span>
            <span class="text-sm font-semibold text-gray-700">Enter your ZIP code</span>
          </div>
          <ZipInput />
        </div>
        <div class="pt-2">
          <CTAButton leadsGateFormId={aid} />
        </div>
      </div>
      <p class="mt-4 text-xs text-gray-400 text-center">
        By clicking "${cta}" you agree to our
        <a href="/terms" class="underline hover:text-gray-600 focus-visible:text-gray-600">Terms</a> and
        <a href="/privacy" class="underline hover:text-gray-600 focus-visible:text-gray-600">Privacy Policy</a>.
        Checking rates won't affect your credit score.
      </p>
    </section>

    <!-- How It Works -->
    <section class="w-full max-w-lg mb-8" aria-labelledby="how-it-works-heading">
      <h2 id="how-it-works-heading" class="text-xl font-bold text-center text-gray-900 mb-6">How It Works</h2>
      <ol class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center list-none p-0 m-0" role="list">
        <li class="p-4">
          <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-50 flex items-center justify-center" aria-hidden="true">
            <svg class="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" loading="lazy"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-800 mb-1">Fill Out Form</h3>
          <p class="text-xs text-gray-500">Answer a few quick questions about your loan needs.</p>
        </li>
        <li class="p-4">
          <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-50 flex items-center justify-center" aria-hidden="true">
            <svg class="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" loading="lazy"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-800 mb-1">Get Matched</h3>
          <p class="text-xs text-gray-500">We connect you with lenders competing for your business.</p>
        </li>
        <li class="p-4">
          <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-50 flex items-center justify-center" aria-hidden="true">
            <svg class="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" loading="lazy"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-800 mb-1">Choose Your Offer</h3>
          <p class="text-xs text-gray-500">Compare rates and terms, then pick the best deal for you.</p>
        </li>
      </ol>
    </section>

    <ComplianceBlock companyName={companyName} />
  </main>

  <script is:inline>
    window.addEventListener('load', function() {
      setTimeout(function() {
        if (typeof window.initTracking === 'function') window.initTracking();
      }, 2000);
    });
  </script>
</BaseLayout>
`;

  // ─── README.md ─────────────────────────────────────────────
  files["README.md"] = `# ${brand} — Landing Page

Astro static landing page for ${loanLabel}.

## Quick Start

\`\`\`bash
npm install
npm run dev      # Dev server at localhost:4321
npm run build    # Build to dist/
npm run preview  # Preview built site
\`\`\`

## Configuration

Edit .env to configure tracking and API keys:

\`\`\`
SITE_URL=https://${domain}
PUBLIC_SITE_NAME=${brand}
PUBLIC_COMPANY_NAME=${companyName}
PUBLIC_CONVERSION_ID=AW-123456789
PUBLIC_FORM_START_LABEL=AbCdEfGhIjK
PUBLIC_FORM_SUBMIT_LABEL=XyZaBcDeFgH
PUBLIC_AID=${aid}
PUBLIC_VOLUUM_DOMAIN=trk.yourdomain.com
\`\`\`

## Deploy

\`\`\`bash
# Cloudflare Pages
npx wrangler pages deploy dist/

# Netlify
npx netlify deploy --prod --dir=dist

# Any static host
# Upload the contents of dist/ folder
\`\`\`
`;

  return files;
}
