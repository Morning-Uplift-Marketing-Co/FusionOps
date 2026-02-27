/**
 * Astro LP Project Generator
 * Generates a complete Astro project file map from a site config.
 * Each key is a file path, each value is the file content string.
 */

import { COLORS, FONTS, RADIUS, LOAN_TYPES } from "../constants/index.js";

function hslStr(arr) {
  return `hsl(${arr[0]}, ${arr[1]}%, ${arr[2]}%)`;
}

/**
 * Generate a complete Astro project as { [filepath]: content }
 */
export function generateAstroProject(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const r = RADIUS.find(x => x.id === site.radius) || RADIUS[2];
  const brand = site.brand || "LoanBridge";
  const loanLabel = LOAN_TYPES.find(l => l.id === site.loanType)?.label || "Personal Loans";
  const h1 = site.h1 || `Fast ${loanLabel} Up To $${(site.amountMax || 5000).toLocaleString()}`;
  const cta = site.cta || "Check Your Rate";
  const sub = site.sub || "Get approved in minutes. Funds as fast as next business day.";
  const companyName = brand;
  const domain = site.domain || "example.com";

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
      Image: false, // Handled by astro:assets
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
PUBLIC_AID=${site.aid || ""}
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

/* Screen-reader only utility */
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

/* Skip-to-content link */
.skip-link {
  position: fixed; top: 0; left: 0; z-index: 100;
  background: var(--color-primary); color: #fff;
  padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: 700;
  transform: translateY(-100%); transition: transform 0.2s;
}
.skip-link:focus { transform: translateY(0); outline: 3px solid var(--color-accent); outline-offset: 2px; }

/* Global focus-visible styles */
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

  <!-- DNS Prefetch and Preconnect -->
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

  <!-- Layer 1: gtag.js — Google Ads conversion only -->
  {conversionId && (
    <>
      <script async src={\`https://www.googletagmanager.com/gtag/js?id=\${conversionId}\`}></script>
      <script is:inline define:vars={{ conversionId }}>
        window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',conversionId);
      </script>
    </>
  )}

  <!-- Non-blocking font loading with Preload -->
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

  <!-- Layer 2: First-party pixel (sendBeacon to t.{domain}/e) -->
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
  min = ${site.amountMin || 500},
  max = ${site.amountMax || 35000},
  step = 500,
  defaultValue = ${Math.round(((site.amountMin || 500) + (site.amountMax || 35000)) / 2)},
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
     section>

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
    // Delayed tracking to improve TBT and interactivity
    window.addEventListener('load', function() {
      setTimeout(function() {
        if (typeof window.initTracking === 'function') window.initTracking();
        console.log('Performance tracking deferred');
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
PUBLIC_AID=14881
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

/**
 * Generate PDL Loans V1 Template
 * Based on elastic-credits-v4 template - Zero-JS architecture
 * Features: Hero form, trust badges, calculator, FAQ, full compliance footer
 */
export function generatePDLLoansV1(site) {
  console.log("[generatePDLLoansV1] Starting template generation for:", {
    brand: site.brand,
    templateId: site.templateId,
    colorId: site.colorId
  });

  const c = COLORS.find(x => x.id === site.colorId) || COLORS[3];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS.find(x => x.id === 'dm-sans') || FONTS[0];
  const brand = site.brand || "ElasticCredits";
  const loanLabel = LOAN_TYPES.find(l => l.id === site.loanType)?.label || "Personal Loans";
  const h1 = site.h1 || "A Smarter Way";
  const h1span = site.h1span || "to Borrow";
  const sub = site.sub || "Get approved in minutes. Funds as fast as next business day.";
  const badge = site.badge || "4,200+ funded this month";
  const cta = site.cta || "Check My Rate";
  const companyName = brand;
  const domain = site.domain || "example.com";
  const amountMin = site.amountMin || 100;
  const amountMax = site.amountMax || 5000;
  const aprMin = site.aprMin || 5.99;
  const aprMax = site.aprMax || 35.99;

  const files = {};

  // ─── package.json ───────────────────────────────────────────
  files["package.json"] = JSON.stringify({
    name: brand.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-pdl-loans",
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
      "@astrojs/react": "^4.2.0",
      "@astrojs/tailwind": "^6.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
    devDependencies: {
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      tailwindcss: "^3.4.17",
      typescript: "^5.7.0",
    },
  }, null, 2);

  // ─── astro.config.mjs ──────────────────────────────────────
  files["astro.config.mjs"] = `import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'static',
  site: process.env.SITE_URL || 'https://${domain}',
  build: {
    assets: '_assets',
  },
  vite: {
    build: {
      sourcemap: false,
      minify: 'terser',
      cssMinify: true,
    }
  },
});
`;

  // ─── tsconfig.json ─────────────────────────────────────────
  files["tsconfig.json"] = JSON.stringify({
    extends: "astro/tsconfigs/strict",
    compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } },
  }, null, 2);

  // ─── tailwind.config.mjs ───────────────────────────────────
  files["tailwind.config.mjs"] = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1200px' },
    },
    extend: {
      fontFamily: {
        sans: ['${f.family.replace(/"/g, '')}', 'system-ui', 'sans-serif'],
        display: ['${f.family.replace(/"/g, '')}', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        sm: '0 1px 2px 0 hsl(350 75% 38% / 0.05)',
        md: '0 4px 6px -1px hsl(350 75% 38% / 0.1), 0 2px 4px -2px hsl(350 75% 38% / 0.1)',
        lg: '0 10px 15px -3px hsl(350 75% 38% / 0.1), 0 4px 6px -4px hsl(350 75% 38% / 0.1)',
        xl: '0 20px 25px -5px hsl(350 75% 38% / 0.1), 0 8px 10px -6px hsl(350 75% 38% / 0.1)',
        cta: '0 4px 14px 0 hsl(40 90% 55% / 0.4)',
        card: '0 10px 15px -3px hsl(350 75% 38% / 0.08), 0 4px 6px -4px hsl(350 75% 38% / 0.06)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, hsl(350 75% 38%) 0%, hsl(350 75% 28%) 100%)',
        'cta-gradient': 'linear-gradient(135deg, hsl(40 90% 55%) 0%, hsl(40 90% 45%) 100%)',
        'success-gradient': 'linear-gradient(135deg, hsl(200 70% 45%) 0%, hsl(200 70% 39%) 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.75)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
`;

  // ─── .env ──────────────────────────────────────────────────
  files[".env"] = `SITE_URL=https://${domain}
PUBLIC_SITE_NAME=${brand}
PUBLIC_COMPANY_NAME=${companyName}
`;

  // ─── src/styles/global.css ─────────────────────────────────
  files["src/styles/global.css"] = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
}

@layer base {
  :root {
    --primary: ${c.p[0]} ${c.p[1]}% ${c.p[2]}%;
    --primary-foreground: 0 0% 100%;
    --secondary: ${c.s[0]} ${c.s[1]}% ${c.s[2]}%;
    --secondary-foreground: 0 0% 100%;
    --accent: ${c.a[0]} ${c.a[1]}% ${c.a[2]}%;
    --accent-foreground: 0 0% 100%;
    --background: ${c.bg[0]} ${c.bg[1]}% ${c.bg[2]}%;
    --foreground: ${c.fg[0]} ${c.fg[1]}% ${c.fg[2]}%;
    --card: 0 0% 100%;
    --card-foreground: ${c.fg[0]} ${c.fg[1]}% ${c.fg[2]}%;
    --muted: ${c.bg[0]} ${c.bg[1]}% 95%;
    --muted-foreground: ${c.fg[0]} 16% 47%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: ${c.bg[0]} 32% 91%;
    --input: ${c.bg[0]} 32% 91%;
    --ring: ${c.p[0]} ${c.p[1]}% ${c.p[2]}%;
    --radius: 1rem;
  }

  * {
    border-color: hsl(var(--border));
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: '${f.family.replace(/"/g, '')}', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer components {
  .btn-cta {
    @apply inline-flex items-center justify-center gap-2
      text-white font-bold text-lg
      h-14 px-8 rounded-xl
      shadow-cta
      transition-all duration-200
      hover:shadow-xl
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
      active:scale-[0.98]
      disabled:opacity-50 disabled:pointer-events-none;
    background: linear-gradient(135deg, hsl(40 90% 55%) 0%, hsl(40 90% 45%) 100%);
  }
  .btn-cta:hover {
    transform: scale(1.02);
  }

  .card-elevated {
    @apply bg-card rounded-xl border border-border shadow-card p-6
      transition-all duration-300
      hover:shadow-lg;
  }
  .card-elevated:hover {
    transform: translateY(-2px);
  }

  .section-padding {
    @apply py-16 md:py-24;
  }

  .glass-card {
    @apply bg-white/80 border border-white/60 rounded-2xl shadow-lg;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .faq-details[open] {
    @apply border-primary/20 shadow-sm;
    background: hsl(var(--primary) / 0.02);
  }

  .faq-details summary::-webkit-details-marker,
  .faq-details summary::marker {
    display: none;
  }

  .faq-details summary {
    list-style: none;
  }
}
`;

  // ─── src/layouts/Layout.astro ──────────────────────────────
  files["src/layouts/Layout.astro"] = `---
import '../styles/global.css';

interface Props {
  title?: string;
  description?: string;
  canonicalUrl?: string;
}

const {
  title = '${brand} — Personal Loans $${amountMin}-$${amountMax} | Fast Approval',
  description = '${sub}',
  canonicalUrl = 'https://${domain}',
} = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title}</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="canonical" href={canonicalUrl} />

    <!-- Open Graph -->
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:site_name" content="${brand}" />
    <meta property="og:locale" content="en_US" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=${f.import}&display=swap" />
    <link href="https://fonts.googleapis.com/css2?family=${f.import}&display=swap" rel="stylesheet" media="print" onload="this.media='all'" />
    <noscript><link href="https://fonts.googleapis.com/css2?family=${f.import}&display=swap" rel="stylesheet" /></noscript>

    <!-- GTM dataLayer -->
    <script is:inline>
      window.dataLayer = window.dataLayer || [];
    </script>

    <!-- Critical inline font fallback -->
    <style is:inline>
      body { font-family: '${f.family.replace(/"/g, '')}', system-ui, -apple-system, sans-serif; }
    </style>

    <!-- Schema.org FinancialProduct -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FinancialProduct",
      "name": "${brand} Personal Loan",
      "description": "Personal loans from $${amountMin} to $${amountMax} with fast approval",
      "provider": {
        "@type": "FinancialService",
        "name": "${brand}",
        "url": "https://${domain}"
      },
      "annualPercentageRate": {
        "@type": "QuantitativeValue",
        "minValue": ${aprMin},
        "maxValue": ${aprMax},
        "unitCode": "P1"
      },
      "amount": {
        "@type": "MonetaryAmount",
        "minValue": ${amountMin},
        "maxValue": ${amountMax},
        "currency": "USD"
      },
      "feesAndCommissionsSpecification": "No hidden fees. APR varies based on creditworthiness."
    }
    </script>
  </head>
  <body class="min-h-screen bg-background text-foreground antialiased">
    <slot />
  </body>
</html>
`;

  // ─── src/components/Icon.astro ───────────────────────────────
  files["src/components/Icon.astro"] = `---
interface Props {
  name: 'check-circle' | 'shield-check' | 'star';
  class?: string;
}
const { name, class: className = '' } = Astro.props;
---

{name === 'check-circle' && (
  <svg class={className} viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
)}

{name === 'shield-check' && (
  <svg class={className} viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
)}

{name === 'star' && (
  <svg class={className} viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
)}
`;

  // ─── src/components/Header.astro ────────────────────────────
  files["src/components/Header.astro"] = `---
// Static Header – zero client JS
---

<header class="fixed top-0 inset-x-0 z-50 border-b border-border/50" style="background:hsl(var(--background) / 0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)">
  <nav aria-label="Main navigation" class="container flex items-center justify-between h-16">
    <a href="/" class="flex items-center gap-2 group">
      <div class="w-9 h-9 rounded-lg bg-hero-gradient flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
        <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <span class="text-xl font-bold text-foreground">
        ${brand}
      </span>
    </a>

    <div class="flex items-center gap-4">
      <div class="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
        <svg class="w-4 h-4 text-secondary" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
        <span>256-bit Secured</span>
      </div>
      <a href="#apply" aria-label="Apply for a loan now" class="btn-cta !h-10 !px-5 !text-sm !rounded-lg !shadow-sm hover:!shadow-cta">
        Apply Now
      </a>
    </div>
  </nav>
</header>
`;

  // ─── src/components/Footer.astro ────────────────────────────
  const year = new Date().getFullYear();
  files["src/components/Footer.astro"] = `---
// Footer with full compliance
---

<footer role="contentinfo" class="bg-card border-t border-border mt-auto">
  <div class="container section-padding">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
      <div class="col-span-2 md:col-span-1">
        <a href="/" class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-hero-gradient flex items-center justify-center">
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span class="text-lg font-bold text-foreground">${brand}</span>
        </a>
        <p class="text-sm text-muted-foreground leading-relaxed">Connecting you with trusted lenders for personal installment loans up to $${amountMax.toLocaleString()}.</p>
      </div>
      <nav aria-label="Company links">
        <h3 class="text-sm font-semibold text-foreground mb-3">Company</h3>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="#how-it-works" class="hover:text-foreground transition-colors">How It Works</a></li>
          <li><a href="#calculator" class="hover:text-foreground transition-colors">Calculator</a></li>
          <li><a href="#faq" class="hover:text-foreground transition-colors">FAQ</a></li>
        </ul>
      </nav>
      <nav aria-label="Legal links">
        <h3 class="text-sm font-semibold text-foreground mb-3">Legal</h3>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/privacy" class="hover:text-foreground transition-colors">Privacy Policy</a></li>
          <li><a href="/terms" class="hover:text-foreground transition-colors">Terms of Service</a></li>
          <li><a href="/disclosures" class="hover:text-foreground transition-colors">Disclosures</a></li>
        </ul>
      </nav>
      <nav aria-label="Support links">
        <h3 class="text-sm font-semibold text-foreground mb-3">Support</h3>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="mailto:support@${domain}" class="hover:text-foreground transition-colors">Contact Us</a></li>
          <li><a href="/licensing" class="hover:text-foreground transition-colors">Licensing</a></li>
        </ul>
      </nav>
    </div>

    <!-- Compliance -->
    <div class="border-t border-border pt-8 space-y-4 text-xs text-muted-foreground leading-relaxed">
      <p><strong class="text-foreground/70">Representative Example:</strong> For example, a $2,500 personal loan with a 24-month term at 19.9% APR would have monthly payments of approximately $127.12. Total repayment: $3,050.88. Finance charge: $550.88.</p>
      <p><strong class="text-foreground/70">APR Disclosure:</strong> Rates between ${aprMin}% and ${aprMax}% APR. Your actual rate depends on credit score, requested amount, term length, and credit history. Lowest rates available to the most qualified borrowers.</p>
      <p>${companyName} operates as a lead generator and is not a direct lender. We match consumers with lending partners. Not all applicants will qualify for the full amount.</p>
      <div class="pt-4 border-t border-border flex flex-col md:flex-row items-center justify-between gap-2">
        <p>&copy; ${year} ${companyName}. All rights reserved.</p>
      </div>
    </div>
  </div>
</footer>
`;

  // ─── src/components/HeroFormStatic.astro ─────────────────────
  files["src/components/HeroFormStatic.astro"] = `---
// Pure Astro component - ZERO client JS framework needed
---

<div class="w-full max-w-md mx-auto">
  <form id="hero-form" class="glass-card p-6 md:p-8 space-y-6">
    <div>
      <label class="block text-sm font-semibold text-foreground mb-3">How much do you need?</label>
      <div class="grid grid-cols-4 gap-2 mb-3" id="amount-btns">
        <button type="button" data-amount="1000" class="amt-btn py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground">$1K</button>
        <button type="button" data-amount="2000" class="amt-btn py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 bg-primary text-primary-foreground shadow-md scale-[1.02]">$2K</button>
        <button type="button" data-amount="3000" class="amt-btn py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground">$3K</button>
        <button type="button" data-amount="5000" class="amt-btn py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground">$5K</button>
      </div>
      <input type="range" id="amount-slider" min="${amountMin}" max="${amountMax}" step="100" value="2000" aria-label="Loan amount"
        class="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
          [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer" />
      <div class="flex justify-between text-xs text-muted-foreground mt-1">
        <span>$${amountMin}</span>
        <span id="amount-display" class="text-base font-bold text-foreground">$2,000</span>
        <span>$${amountMax}</span>
      </div>
    </div>

    <div>
      <label for="zip" class="block text-sm font-semibold text-foreground mb-2">Your ZIP Code</label>
      <input id="zip" type="text" inputmode="numeric" maxlength="5" placeholder="e.g. 90210"
        class="w-full h-12 px-4 rounded-lg border border-input bg-background text-foreground
          text-base font-medium placeholder:text-muted-foreground/60
          focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
      <p id="zip-error" class="text-sm text-destructive mt-1.5 hidden"></p>
    </div>

    <button type="submit" aria-label="Check my personalized loan rate" class="btn-cta w-full group">
      <span>${cta}</span>
      <svg class="w-5 h-5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
      </svg>
    </button>

    <p class="text-xs text-muted-foreground text-center leading-relaxed">
      <svg class="inline w-3.5 h-3.5 text-secondary mr-1 -mt-0.5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
      Won't affect your credit score
    </p>
  </form>
</div>

<script is:inline>
(function(){
  var amount = 2000;
  var slider = document.getElementById('amount-slider');
  var display = document.getElementById('amount-display');
  var btns = document.querySelectorAll('.amt-btn');
  var form = document.getElementById('hero-form');
  var zipInput = document.getElementById('zip');
  var zipErr = document.getElementById('zip-error');

  function fmt(n){ return '$' + n.toLocaleString(); }

  function setAmount(v){
    amount = v;
    slider.value = v;
    display.textContent = fmt(v);
    btns.forEach(function(b){
      var a = parseInt(b.dataset.amount);
      if(a === v){
        b.className = 'amt-btn py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 bg-primary text-primary-foreground shadow-md scale-[1.02]';
      } else {
        b.className = 'amt-btn py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground';
      }
    });
  }

  btns.forEach(function(b){
    b.addEventListener('click', function(){ setAmount(parseInt(b.dataset.amount)); });
  });

  slider.addEventListener('input', function(){ setAmount(parseInt(slider.value)); });

  zipInput.addEventListener('input', function(){
    zipInput.value = zipInput.value.replace(/\\D/g,'').slice(0,5);
    zipErr.classList.add('hidden');
  });

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var zip = zipInput.value;
    if(!/^\\d{5}$/.test(zip)){
      zipErr.textContent = 'Enter a valid 5-digit ZIP code';
      zipErr.classList.remove('hidden');
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event:'generate_lead_start', conversion_value:amount, currency:'USD' });
    var p = new URLSearchParams(window.location.search);
    p.set('amount', amount);
    p.set('zip', zip);
    window.location.href = '/apply?' + p.toString();
  });
})();
</script>
`;

  // ─── src/components/TrustBadges.astro ──────────────────────
  files["src/components/TrustBadges.astro"] = `---
import Icon from "./Icon.astro";

interface Props {
    className?: string;
    showDivider?: boolean;
}

const { className = "", showDivider = true } = Astro.props;
---

<div
    class={\`flex flex-wrap justify-center gap-x-8 gap-y-6 items-center \${className}\`}
>
    <!-- Funded Volume -->
    <div
        class="flex items-center gap-3 group transition-transform hover:scale-105 duration-200"
    >
        <div class="flex -space-x-3">
            <div
                class="w-9 h-9 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-bold text-muted-foreground shadow-sm"
            >
                J
            </div>
            <div
                class="w-9 h-9 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-bold text-muted-foreground shadow-sm"
            >
                M
            </div>
            <div
                class="w-9 h-9 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-bold text-muted-foreground shadow-sm"
            >
                S
            </div>
            <div
                class="w-9 h-9 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-bold text-muted-foreground shadow-sm"
            >
                K
            </div>
        </div>
        <div class="flex flex-col">
            <span class="text-sm font-bold text-foreground leading-tight"
                >15,000+</span
            >
            <span
                class="text-[11px] uppercase tracking-wider text-muted-foreground font-medium"
                >Loans Funded</span
            >
        </div>
    </div>

    {showDivider && <div class="h-8 w-px bg-border hidden md:block" />}

    <!-- Ratings -->
    <div
        class="flex items-center gap-3 group transition-transform hover:scale-105 duration-200"
    >
        <div class="flex gap-0.5">
            <Icon name="star" class="w-4 h-4 text-amber-400 fill-amber-400" />
            <Icon name="star" class="w-4 h-4 text-amber-400 fill-amber-400" />
            <Icon name="star" class="w-4 h-4 text-amber-400 fill-amber-400" />
            <Icon name="star" class="w-4 h-4 text-amber-400 fill-amber-400" />
            <Icon name="star" class="w-4 h-4 text-amber-400 fill-amber-400" />
        </div>
        <div class="flex flex-col">
            <span class="text-sm font-bold text-foreground leading-tight"
                >4.8/5 Rating</span
            >
            <span
                class="text-[11px] uppercase tracking-wider text-muted-foreground font-medium"
                >Google & Trustpilot</span
            >
        </div>
    </div>

    {showDivider && <div class="h-8 w-px bg-border hidden md:block" />}

    <!-- Security -->
    <div
        class="flex items-center gap-3 group transition-transform hover:scale-105 duration-200"
    >
        <div
            class="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner"
        >
            <Icon name="shield-check" class="w-6 h-6" />
        </div>
        <div class="flex flex-col">
            <span class="text-sm font-bold text-foreground leading-tight"
                >256-bit Secured</span
            >
            <span
                class="text-[11px] uppercase tracking-wider text-muted-foreground font-medium"
                >Bank-Level Security</span
            >
        </div>
    </div>

    {showDivider && <div class="h-8 w-px bg-border hidden md:block" />}

    <!-- SSL/Verified -->
    <div
        class="flex items-center gap-3 group transition-transform hover:scale-105 duration-200"
    >
        <div
            class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"
        >
            <svg
                class="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
        </div>
        <div class="flex flex-col">
            <span class="text-sm font-bold text-foreground leading-tight"
                >Verified SSL</span
            >
            <span
                class="text-[11px] uppercase tracking-wider text-muted-foreground font-medium"
                >Encrypted Data</span
            >
        </div>
    </div>
</div>
`;

  // ─── src/components/CalcStatic.astro ────────────────────────
  files["src/components/CalcStatic.astro"] = `---
// Pure Astro - zero framework JS
---

<div id="calc-root">
  <div class="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8">
    <div class="mb-8">
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm font-medium text-muted-foreground">Loan Amount</span>
        <span id="calc-amount" class="text-2xl font-bold text-foreground">$2,000</span>
      </div>
      <input type="range" id="calc-slider" min="${amountMin}" max="${amountMax}" step="100" value="2000" aria-label="Loan amount"
        class="w-full h-2.5 bg-muted rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
          [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer" />
      <div class="flex justify-between text-xs text-muted-foreground mt-2">
        <span>$${amountMin}</span><span>$${amountMax}</span>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="relative rounded-xl p-5 border bg-secondary/5 border-secondary/30 ring-1 ring-secondary/20 shadow-md">
        <span class="absolute -top-2.5 left-4 px-2.5 py-0.5 text-white text-xs font-bold rounded-full shadow-sm" style="background:linear-gradient(135deg,hsl(200 70% 45%),hsl(200 70% 39%))">0% Interest</span>
        <p class="text-sm font-semibold text-muted-foreground mb-1">Pay in 5</p>
        <p class="text-3xl font-bold text-foreground mb-1">$<span id="tier1">400</span><span class="text-sm font-normal text-muted-foreground">/mo</span></p>
      </div>
      <div class="relative rounded-xl p-5 border bg-muted/30 border-border hover:border-primary/20 hover:shadow-sm">
        <p class="text-sm font-semibold text-muted-foreground mb-1">12 Months</p>
        <p class="text-3xl font-bold text-foreground mb-1">$<span id="tier2">181</span><span class="text-sm font-normal text-muted-foreground">/mo</span></p>
        <p class="text-xs text-muted-foreground">15% APR</p>
      </div>
      <div class="relative rounded-xl p-5 border bg-muted/30 border-border hover:border-primary/20 hover:shadow-sm">
        <p class="text-sm font-semibold text-muted-foreground mb-1">24 Months</p>
        <p class="text-3xl font-bold text-foreground mb-1">$<span id="tier3">110</span><span class="text-sm font-normal text-muted-foreground">/mo</span></p>
        <p class="text-xs text-muted-foreground">28% APR</p>
      </div>
    </div>
    <div class="mt-6 text-center">
      <a href="#apply" aria-label="Get my personalized loan rate" class="btn-cta inline-flex">Get My Personalized Rate</a>
    </div>
  </div>
</div>

<script is:inline>
(function(){
  var slider = document.getElementById('calc-slider');
  var display = document.getElementById('calc-amount');
  var t1 = document.getElementById('tier1');
  var t2 = document.getElementById('tier2');
  var t3 = document.getElementById('tier3');

  function calc(amt, months, apr){
    if(apr === 0) return Math.round(amt / months);
    var r = apr / 100 / 12;
    return Math.round((amt * r * Math.pow(1+r,months)) / (Math.pow(1+r,months)-1));
  }

  slider.addEventListener('input', function(){
    var a = parseInt(slider.value);
    display.textContent = '$' + a.toLocaleString();
    t1.textContent = calc(a, 5, 0);
    t2.textContent = calc(a, 12, 15);
    t3.textContent = calc(a, 24, 28);
  });
})();
</script>
`;

  // ─── src/components/FAQStatic.astro ─────────────────────────
  files["src/components/FAQStatic.astro"] = `---
const faqs = [
  { q: 'Will checking my rate affect my credit score?', a: 'No. We use a soft credit inquiry which does not affect your credit score. A hard inquiry may occur only if you proceed with a loan offer.' },
  { q: 'How much can I borrow?', a: 'Loan amounts range from $${amountMin} to $${amountMax} depending on your state, credit profile, and lender terms.' },
  { q: 'How fast can I get funded?', a: 'Many lenders offer next-business-day funding once approved. Some may fund same day.' },
  { q: 'What are the interest rates?', a: 'APR ranges from ${aprMin}% to ${aprMax}% depending on your credit profile, loan amount, and term.' },
  { q: 'Can I repay my loan early?', a: 'Most lenders allow early repayment without prepayment penalties, saving you money on interest.' },
  { q: 'What do I need to apply?', a: 'Be 18+, have a valid U.S. bank account, steady income, and a valid email and phone number.' },
];
---

<div class="space-y-3">
  {faqs.map((f, i) => (
    <details class="faq-details group rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:border-primary/10" open={i === 0}>
      <summary class="flex items-center justify-between p-5 cursor-pointer">
        <span class="text-sm font-semibold text-foreground pr-4">{f.q}</span>
        <svg class="w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-300 group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div class="px-5 pb-5">
        <p class="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
      </div>
    </details>
  ))}
</div>
`;

  // ─── src/pages/apply.astro ─────────────────────────────────
  files["src/pages/apply.astro"] = `---
import Layout from "../layouts/Layout.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import TrustBadges from "../components/TrustBadges.astro";
---

<Layout title="Apply - ${brand}">
  <Header />

  <main class="pt-16">
    <section
      class="min-h-[80vh] flex items-center justify-center section-padding"
      style="background:linear-gradient(180deg,hsl(350 15% 97%) 0%,hsl(350 15% 95%) 100%)"
    >
      <div class="container max-w-lg text-center">
        <div class="mb-6">
          <div
            class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
            style="background:hsl(200 70% 45% / 0.1);border:1px solid hsl(200 70% 45% / 0.2)"
          >
            <svg
              class="w-4 h-4 text-secondary"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"></path>
            </svg>
            <span class="text-sm font-medium text-secondary"
              >Soft credit check only</span
            >
          </div>
          <h1 class="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Complete Your Application
          </h1>
          <p class="text-muted-foreground">
            Just a few more details to see your personalized rates.
          </p>
        </div>

        <!-- Lead form would be loaded here via iframe/script -->
        <div class="bg-card rounded-2xl border border-border shadow-card p-8">
          <div id="lead-form-container" class="min-h-[300px] flex items-center justify-center">
            <p class="text-muted-foreground">Loading application form...</p>
          </div>
        </div>

        <div class="mt-12 pt-8 border-t border-border">
          <TrustBadges showDivider={false} className="gap-y-8" />
        </div>
      </div>
    </section>
  </main>

  <Footer />
</Layout>
`;

  // ─── src/pages/index.astro ──────────────────────────────────
  files["src/pages/index.astro"] = `---
import Layout from "../layouts/Layout.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import HeroFormStatic from "../components/HeroFormStatic.astro";
import CalcStatic from "../components/CalcStatic.astro";
import FAQStatic from "../components/FAQStatic.astro";
import TrustBadges from "../components/TrustBadges.astro";
---

<Layout>
  <!-- Skip Link -->
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
  >
    Skip to content
  </a>
  <Header />
  <main id="main-content" class="pt-16">
    <!-- HERO -->
    <section
      id="apply"
      aria-label="Loan application"
      class="relative overflow-hidden text-white section-padding"
      style="background:linear-gradient(135deg,hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}%) 0%,hsl(${c.p[0]} ${c.p[1]}% ${Math.max(c.p[2] - 10, 20)}%) 100%)"
    >
      <div
        class="absolute top-0 right-0 pointer-events-none"
        style="width:500px;height:500px;border-radius:50%;filter:blur(64px);background:rgba(255,255,255,0.05);transform:translate(25%,-50%);contain:strict"
      >
      </div>
      <div
        class="absolute bottom-0 left-0 pointer-events-none"
        style="width:400px;height:400px;border-radius:50%;filter:blur(64px);background:hsl(${c.a[0]} ${c.a[1]}% ${c.a[2]}% / 0.1);transform:translate(-25%,33%);contain:strict"
      >
      </div>
      <div class="container relative z-10">
        <div class="max-w-2xl mx-auto text-center">
          <div
            class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
            style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2)"
          >
            <div class="w-2 h-2 rounded-full bg-secondary animate-pulse-soft">
            </div>
            <span class="text-sm font-medium text-white/90"
              >${badge}</span
            >
          </div>
          <h1
            class="text-4xl md:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] mb-6"
          >
            ${h1}<br /><span class="text-accent">${h1span}</span>
          </h1>
          <p class="text-lg md:text-xl text-white/70 max-w-lg mx-auto mb-8">
            ${sub}
          </p>
          <div class="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-10">
            <div class="flex items-center gap-2 text-sm text-white/70">
              <svg
                class="w-5 h-5 text-secondary"
                viewBox="0 0 20 20"
                fill="currentColor"
                ><path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"></path></svg
              ><span>All Credit Welcome</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-white/70">
              <svg
                class="w-5 h-5 text-secondary"
                viewBox="0 0 20 20"
                fill="currentColor"
                ><path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"></path></svg
              ><span>2-Minute Application</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-white/70">
              <svg
                class="w-5 h-5 text-secondary"
                viewBox="0 0 20 20"
                fill="currentColor"
                ><path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"></path></svg
              ><span>No Hidden Fees</span>
            </div>
          </div>
          <div class="max-w-md mx-auto">
            <HeroFormStatic />
          </div>
        </div>
      </div>
    </section>
    <!-- TRUST BADGES -->
    <section class="bg-card border-b border-border">
      <div class="container py-8">
        <TrustBadges />
      </div>
    </section>
    <!-- FAQ -->
    <section
      id="faq"
      role="region"
      aria-labelledby="faq-heading"
      class="section-padding"
    >
      <div class="container max-w-2xl">
        <div class="text-center mb-10">
          <span
            class="inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider mb-4"
            style="background:hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}% / 0.05);color:hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}%)"
            >FAQ</span
          >
          <h2
            id="faq-heading"
            class="text-3xl md:text-4xl font-bold text-foreground mb-3"
          >
            Common Questions
          </h2>
        </div>
        <FAQStatic />
      </div>
    </section>
    <!-- HOW IT WORKS -->
    <section
      id="how-it-works"
      role="region"
      aria-labelledby="how-it-works-heading"
      class="section-padding"
      style="background:linear-gradient(180deg,hsl(350 15% 97%) 0%,hsl(350 15% 95%) 100%)"
    >
      <div class="container">
        <div class="text-center mb-12">
          <span
            class="inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider mb-4"
            style="background:hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}% / 0.05);color:hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}%)"
            >How It Works</span
          >
          <h2
            id="how-it-works-heading"
            class="text-3xl md:text-4xl font-bold text-foreground mb-3"
          >
            Get Funded in 3 Simple Steps
          </h2>
          <p class="text-muted-foreground max-w-xl mx-auto">
            No paperwork. No waiting in line. Everything happens online.
          </p>
        </div>
        <div class="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div class="card-elevated text-center">
            <div
              class="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style="background:hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}% / 0.1)"
            >
              <svg
                class="w-7 h-7 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path
                  d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
                ></path><polyline points="14 2 14 8 20 8"></polyline><line
                  x1="16"
                  y1="13"
                  x2="8"
                  y2="13"></line><line x1="16" y1="17" x2="8" y2="17"
                ></line></svg
              >
            </div>
            <div
              class="w-8 h-8 mx-auto -mt-8 mb-2 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shadow-md"
            >
              1
            </div>
            <h3 class="text-lg font-bold text-foreground mb-2">Apply Online</h3>
            <p class="text-sm text-muted-foreground">
              Fill out our simple 2-minute form. No impact on your credit score.
            </p>
          </div>
          <div class="card-elevated text-center">
            <div
              class="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style="background:hsl(${c.s[0]} ${c.s[1]}% ${c.s[2]}% / 0.1)"
            >
              <svg
                class="w-7 h-7 text-secondary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline
                  points="22 4 12 14.01 9 11.01"></polyline></svg
              >
            </div>
            <div
              class="w-8 h-8 mx-auto -mt-8 mb-2 rounded-full bg-secondary text-white text-sm font-bold flex items-center justify-center shadow-md"
            >
              2
            </div>
            <h3 class="text-lg font-bold text-foreground mb-2">Get Approved</h3>
            <p class="text-sm text-muted-foreground">
              Receive personalized loan offers from trusted lenders in seconds.
            </p>
          </div>
          <div class="card-elevated text-center">
            <div
              class="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style="background:hsl(${c.a[0]} ${c.a[1]}% ${c.a[2]}% / 0.1)"
            >
              <svg
                class="w-7 h-7 text-accent"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><rect x="1" y="4" width="22" height="16" rx="2" ry="2"
                ></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg
              >
            </div>
            <div
              class="w-8 h-8 mx-auto -mt-8 mb-2 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center shadow-md"
            >
              3
            </div>
            <h3 class="text-lg font-bold text-foreground mb-2">Get Funded</h3>
            <p class="text-sm text-muted-foreground">
              Accept your offer and receive funds as fast as the next business
              day.
            </p>
          </div>
        </div>
      </div>
    </section>
    <!-- CALCULATOR -->
    <section
      id="calculator"
      role="region"
      aria-labelledby="calculator-heading"
      class="section-padding"
    >
      <div class="container max-w-3xl">
        <div class="text-center mb-10">
          <span
            class="inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider mb-4"
            style="background:hsl(${c.a[0]} ${c.a[1]}% ${c.a[2]}% / 0.05);color:hsl(${c.a[0]} ${c.a[1]}% ${c.a[2]}%)"
            >Payment Calculator</span
          >
          <h2
            id="calculator-heading"
            class="text-3xl md:text-4xl font-bold text-foreground mb-3"
          >
            Estimate Your Monthly Payment
          </h2>
          <p class="text-muted-foreground">
            See how affordable your loan could be.
          </p>
        </div>
        <CalcStatic />
      </div>
    </section>
    <!-- FEATURES -->
    <section
      id="features"
      role="region"
      aria-labelledby="features-heading"
      class="section-padding"
      style="background:linear-gradient(180deg,hsl(350 15% 97%) 0%,hsl(350 15% 95%) 100%)"
    >
      <div class="container">
        <div class="text-center mb-12">
          <span
            class="inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider mb-4"
            style="background:hsl(${c.s[0]} ${c.s[1]}% ${c.s[2]}% / 0.05);color:hsl(${c.s[0]} ${c.s[1]}% ${c.s[2]}%)"
            >Why ${brand}</span
          >
          <h2
            id="features-heading"
            class="text-3xl md:text-4xl font-bold text-foreground"
          >
            Built Around Trust
          </h2>
        </div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="card-elevated text-center">
            <div
              class="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center"
              style="background:hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}% / 0.1)"
            >
              <svg
                class="w-6 h-6 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><circle cx="12" cy="12" r="10"></circle><polyline
                  points="12 6 12 12 16 14"></polyline></svg
              >
            </div><h3 class="font-bold text-foreground mb-1.5">
              Fast Decisions
            </h3><p class="text-sm text-muted-foreground">
              Get your decision in minutes, not days.
            </p>
          </div>
          <div class="card-elevated text-center">
            <div
              class="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center"
              style="background:hsl(${c.s[0]} ${c.s[1]}% ${c.s[2]}% / 0.1)"
            >
              <svg
                class="w-6 h-6 text-secondary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                ></path></svg
              >
            </div><h3 class="font-bold text-foreground mb-1.5">
              No Hidden Fees
            </h3><p class="text-sm text-muted-foreground">
              Transparent terms with clear pricing upfront.
            </p>
          </div>
          <div class="card-elevated text-center">
            <div
              class="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center"
              style="background:hsl(${c.a[0]} ${c.a[1]}% ${c.a[2]}% / 0.1)"
            >
              <svg
                class="w-6 h-6 text-accent"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                ></path><circle cx="9" cy="7" r="4"></circle><path
                  d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path
                  d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg
              >
            </div><h3 class="font-bold text-foreground mb-1.5">
              All Credit Types
            </h3><p class="text-sm text-muted-foreground">
              Lenders who consider all credit histories.
            </p>
          </div>
          <div class="card-elevated text-center">
            <div
              class="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center"
              style="background:hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}% / 0.1)"
            >
              <svg
                class="w-6 h-6 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><rect x="1" y="4" width="22" height="16" rx="2" ry="2"
                ></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg
              >
            </div><h3 class="font-bold text-foreground mb-1.5">
              Direct Deposit
            </h3><p class="text-sm text-muted-foreground">
              Funds deposited straight to your bank account.
            </p>
          </div>
        </div>
      </div>
    </section>
    <!-- FINAL CTA -->
    <section
      class="section-padding relative overflow-hidden text-white"
      style="background:linear-gradient(135deg,hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}%) 0%,hsl(${c.p[0]} ${c.p[1]}% ${Math.max(c.p[2] - 10, 20)}%) 100%)"
    >
      <div class="container relative z-10 text-center max-w-2xl">
        <h2 class="text-3xl md:text-4xl font-bold mb-4">
          Ready to Get Started?
        </h2>
        <p class="text-lg text-white/70 mb-8">
          Join thousands who've found a smarter way to borrow.
        </p>
        <a href="#apply" class="btn-cta inline-flex text-xl !h-16 !px-10"
          >${cta} <svg
            class="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg
          ></a
        >
        <p class="text-sm text-white/50 mt-4">
          No impact on your credit score &bull; 100% free to check
        </p>
      </div>
    </section>
  </main>
  <Footer />
</Layout>
`;

  // ─── README.md ─────────────────────────────────────────────
  files["README.md"] = `# ${brand} — PDL Loans V1

Astro static landing page for ${loanLabel}. Built with zero-JS architecture for maximum performance.

## Features

- **Zero-JS Architecture**: Pure Astro components with minimal inline scripts
- **Hero Form**: Interactive loan amount selector with ZIP code input
- **Trust Badges**: Social proof with funded count, ratings, and security indicators
- **Calculator**: Payment estimator with multiple term options
- **FAQ Accordion**: Native <details> elements for accessibility
- **Full Compliance**: Representative example, APR disclosure, and footer disclaimers

## Quick Start

\`\`\`bash
npm install
npm run dev      # Dev server at localhost:4321
npm run build    # Build to dist/
npm run preview  # Preview built site
\`\`\`

## Configuration

Edit .env to configure:

\`\`\`
SITE_URL=https://${domain}
PUBLIC_SITE_NAME=${brand}
PUBLIC_COMPANY_NAME=${companyName}
\`\`\`

## Template Details

- **Loan Amount**: $${amountMin} - $${amountMax}
- **APR Range**: ${aprMin}% - ${aprMax}%
- **Color Scheme**: ${c.id} (primary: hsl(${c.p.join(', ')}%))
- **Font**: ${f.name}

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

/**
 * Generate Lander Core Template (PDL Loans V2)
 * Based on elastic-credits-v4 template - Modern, high-conversion design
 */
export function generateLanderCore(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[0];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS[0];
  const brand = site.brand || "LoanConnect";
  const domain = site.domain || "example.com";
  const h1 = site.h1 || "Find Your Best Personal Loan";
  const h1span = site.h1span || "Get funded today.";
  const sub = site.sub || "Compare offers from top lenders in seconds. No impact to your credit score.";
  const cta = site.cta || "Check My Rate";
  const badge = site.badge || "Trusted by 15,000+ borrowers";
  const amountMin = site.amountMin || 100;
  const amountMax = site.amountMax || 5000;
  const aprMin = site.aprMin || 5.99;
  const aprMax = site.aprMax || 35.99;
  const companyName = site.companyName || brand;

  const files = {};

  // package.json
  files["package.json"] = JSON.stringify({
    name: brand.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-v2",
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "astro dev",
      start: "astro dev",
      build: "astro build",
      preview: "astro preview",
      astro: "astro"
    },
    dependencies: {
      "astro": "^5.2.0",
      "@astrojs/tailwind": "^6.0.0",
      "tailwindcss": "^3.4.17",
    }
  }, null, 2);

  // astro.config.mjs
  files["astro.config.mjs"] = `import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
  site: process.env.SITE_URL || 'https://${domain}',
});`;

  // tailwind.config.mjs
  files["tailwind.config.mjs"] = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        xl: "var(--radius)",
        "2xl": "calc(var(--radius) + 4px)",
      },
      boxShadow: {
        card: "0 10px 40px -10px rgba(0,0,0,0.08)",
        elevated: "0 20px 60px -12px rgba(0,0,0,0.12)",
      },
      animation: {
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        }
      }
    },
  },
  plugins: [],
};`;

  // src/styles/global.css
  files["src/styles/global.css"] = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --primary: ${c.p[0]} ${c.p[1]}% ${c.p[2]}%;
    --primary-foreground: 0 0% 100%;
    --secondary: ${c.s[0]} ${c.s[1]}% ${c.s[2]}%;
    --secondary-foreground: 0 0% 100%;
    --accent: ${c.a[0]} ${c.a[1]}% ${c.a[2]}%;
    --accent-foreground: 0 0% 100%;
    --background: ${c.bg[0]} ${c.bg[1]}% ${c.bg[2]}%;
    --foreground: ${c.fg[0]} ${c.fg[1]}% ${c.fg[2]}%;
    --card: 0 0% 100%;
    --card-foreground: ${c.fg[0]} ${c.fg[1]}% ${c.fg[2]}%;
    --muted: ${c.bg[0]} ${c.bg[1]}% ${Math.max(c.bg[2] - 2, 90)}%;
    --muted-foreground: 215 16% 47%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: ${c.p[0]} ${c.p[1]}% ${c.p[2]}%;
    --radius: 1rem;
  }
}

@layer components {
  .section-padding { @apply py-12 md:py-24 px-4 md:px-6; }
  .btn-cta {
    @apply h-14 px-8 rounded-xl bg-primary text-primary-foreground font-bold shadow-card 
    hover:scale-[1.02] hover:shadow-elevated active:scale-[0.98] transition-all duration-200
    flex items-center justify-center gap-2;
  }
  .glass-card {
    @apply bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-card;
  }
  .card-elevated {
    @apply bg-card border border-border rounded-2xl p-6 shadow-card transition-all duration-300 hover:shadow-elevated hover:border-primary/10;
  }
}`;

  // src/layouts/Layout.astro
  files["src/layouts/Layout.astro"] = `---
import '../styles/global.css';

interface Props {
  title?: string;
  description?: string;
}

const {
  title = '${brand} — Personal Loans up to $${amountMax.toLocaleString()}',
  description = '${sub}',
} = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="${f.import || 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'}" rel="stylesheet" />
    <style is:inline>
      body { font-family: '${f.family}', system-ui, sans-serif; }
    </style>
  </head>
  <body class="min-h-screen bg-background text-foreground antialiased overflow-x-hidden">
    <slot />
  </body>
</html>`;

  // src/components/Header.astro
  files["src/components/Header.astro"] = `---
// Static Header
---
<header class="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
  <nav aria-label="Main navigation" class="container mx-auto flex items-center justify-between h-16 px-4">
    <a href="/" class="flex items-center gap-2 group">
      <div class="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
        <svg class="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <span class="text-xl font-bold text-foreground">${brand}</span>
    </a>
    <div class="flex items-center gap-4">
      <div class="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
        <svg class="w-4 h-4 text-secondary" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
        <span>256-bit Secured</span>
      </div>
      <a href="#apply" class="btn-cta !h-10 !px-5 !text-sm !rounded-lg !shadow-sm">Apply Now</a>
    </div>
  </nav>
</header>`;

  // src/components/Footer.astro
  files["src/components/Footer.astro"] = `---
const year = new Date().getFullYear();
---
<footer class="bg-card border-t border-border py-12 px-4 mt-auto">
  <div class="container mx-auto">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
      <div class="col-span-2 md:col-span-1">
        <span class="text-lg font-bold text-foreground mb-4 block">${brand}</span>
        <p class="text-sm text-muted-foreground leading-relaxed">Trusted connecting service for ${brand} installments up to $${amountMax.toLocaleString()}.</p>
      </div>
      <nav>
        <h3 class="font-semibold mb-3">Company</h3>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="#how-it-works" class="hover:text-primary transition-colors">How It Works</a></li>
          <li><a href="#calculator" class="hover:text-primary transition-colors">Calculator</a></li>
          <li><a href="#faq" class="hover:text-primary transition-colors">FAQ</a></li>
        </ul>
      </nav>
      <nav>
        <h3 class="font-semibold mb-3">Legal</h3>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/privacy" class="hover:text-primary transition-colors">Privacy Policy</a></li>
          <li><a href="/terms" class="hover:text-primary transition-colors">Terms of Service</a></li>
          <li><a href="/disclosures" class="hover:text-primary transition-colors">Disclosures</a></li>
        </ul>
      </nav>
      <nav>
        <h3 class="font-semibold mb-3">Support</h3>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="mailto:support@${domain}" class="hover:text-primary transition-colors">Contact Us</a></li>
          <li><a href="/licensing" class="hover:text-primary transition-colors">Licensing</a></li>
        </ul>
      </nav>
    </div>
    <div class="border-t border-border pt-8 text-xs text-muted-foreground space-y-4">
      <p><strong>APR Disclosure:</strong> Rates between ${aprMin}% and ${aprMax}% APR. Your rate depends on credit score, amount, and term.</p>
      <p>${brand} is a lead generator, not a lender. Decisions are made only by the lending partner.</p>
      <p>© {year} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</footer>`;

  // src/components/Icon.astro
  files["src/components/Icon.astro"] = `---
interface Props {
  name: 'check-circle' | 'shield-check' | 'star';
  class?: string;
}
const { name, class: className = '' } = Astro.props;
---
{name === 'check-circle' && (
  <svg class={className} viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
)}
{name === 'shield-check' && (
  <svg class={className} viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
)}
{name === 'star' && (
  <svg class={className} viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
)}`;

  // src/components/TrustBadges.astro
  files["src/components/TrustBadges.astro"] = `---
import Icon from "./Icon.astro";
const { className = "" } = Astro.props;
---
<div class={\`flex flex-wrap justify-center gap-x-8 gap-y-6 items-center \${className}\`}>
    <div class="flex items-center gap-3">
        <div class="flex -space-x-2">
            <div class="w-8 h-8 rounded-full bg-muted border-2 border-background"></div>
            <div class="w-8 h-8 rounded-full bg-muted border-2 border-background"></div>
            <div class="w-8 h-8 rounded-full bg-muted border-2 border-background"></div>
        </div>
        <div class="flex flex-col">
            <span class="text-sm font-bold">15,000+</span>
            <span class="text-[10px] uppercase text-muted-foreground font-semibold">Loans Funded</span>
        </div>
    </div>
    <div class="flex items-center gap-3">
        <div class="flex gap-0.5"><Icon name="star" class="w-4 h-4 text-amber-400" /><Icon name="star" class="w-4 h-4 text-amber-400" /><Icon name="star" class="w-4 h-4 text-amber-400" /><Icon name="star" class="w-4 h-4 text-amber-400" /><Icon name="star" class="w-4 h-4 text-amber-400" /></div>
        <div class="flex flex-col"><span class="text-sm font-bold">4.8/5 Rating</span><span class="text-[10px] uppercase text-muted-foreground font-semibold">Google Reviews</span></div>
    </div>
    <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner"><Icon name="shield-check" class="w-5 h-5" /></div>
        <div class="flex flex-col"><span class="text-sm font-bold">Secured</span><span class="text-[10px] uppercase text-muted-foreground font-semibold">256-bit SSL</span></div>
    </div>
</div>`;

  // src/components/HeroFormStatic.astro
  files["src/components/HeroFormStatic.astro"] = `---
// Pure Astro component
---
<div class="w-full max-w-md mx-auto">
  <form id="hero-form" class="glass-card p-6 md:p-8 space-y-6">
    <div>
      <label class="block text-sm font-semibold text-foreground mb-3">How much do you need?</label>
      <div class="grid grid-cols-4 gap-2 mb-3" id="amount-btns">
        <button type="button" data-amount="1000" class="amt-btn py-2.5 rounded-lg text-sm font-semibold transition-all bg-muted text-muted-foreground">$1K</button>
        <button type="button" data-amount="2000" class="amt-btn py-2.5 rounded-lg text-sm font-semibold transition-all bg-primary text-primary-foreground shadow-md scale-[1.02]">$2K</button>
        <button type="button" data-amount="3000" class="amt-btn py-2.5 rounded-lg text-sm font-semibold transition-all bg-muted text-muted-foreground">$3K</button>
        <button type="button" data-amount="5000" class="amt-btn py-2.5 rounded-lg text-sm font-semibold transition-all bg-muted text-muted-foreground">$5K</button>
      </div>
      <input type="range" id="amount-slider" min="${amountMin}" max="${amountMax}" step="100" value="2000" class="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
      <div class="flex justify-between text-xs text-muted-foreground mt-1">
        <span>$${amountMin}</span><span id="amount-display" class="text-base font-bold text-foreground">$2,000</span><span>$${amountMax}</span>
      </div>
    </div>
    <div>
      <label for="zip" class="block text-sm font-semibold text-foreground mb-2">Your ZIP Code</label>
      <input id="zip" type="text" inputmode="numeric" maxlength="5" placeholder="e.g. 90210" class="w-full h-12 px-4 rounded-lg border border-input bg-background text-foreground" />
      <p id="zip-error" class="text-sm text-destructive mt-1.5 hidden"></p>
    </div>
    <button type="submit" class="btn-cta w-full"><span>${cta}</span></button>
    <p class="text-[10px] text-muted-foreground text-center">Won't affect your credit score</p>
  </form>
</div>
<script is:inline>
(function(){
  var amount = 2000;
  var slider = document.getElementById('amount-slider'), display = document.getElementById('amount-display');
  var btns = document.querySelectorAll('.amt-btn'), form = document.getElementById('hero-form');
  var zipIn = document.getElementById('zip'), zipErr = document.getElementById('zip-error');
  function sync(v){
    amount = v; slider.value = v; display.textContent = '$' + v.toLocaleString();
    btns.forEach(function(b){ b.className = (parseInt(b.dataset.amount) === v) ? 'amt-btn py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground shadow-md scale-[1.02]' : 'amt-btn py-2.5 rounded-lg text-sm font-semibold bg-muted text-muted-foreground'; });
  }
  btns.forEach(function(b){ b.addEventListener('click', function(){ sync(parseInt(b.dataset.amount)); }); });
  slider.addEventListener('input', function(){ sync(parseInt(slider.value)); });
  zipIn.addEventListener('input', function(){ zipIn.value = zipIn.value.replace(/\\D/g,'').slice(0,5); zipErr.classList.add('hidden'); });
  form.addEventListener('submit', function(e){
    e.preventDefault(); var zip = zipIn.value;
    if(!/^\\d{5}$/.test(zip)){ zipErr.textContent = 'Invalid ZIP'; zipErr.classList.remove('hidden'); return; }
    window.location.href = '/apply?amount=' + amount + '&zip=' + zip + window.location.search.replace('?','&');
  });
})();
</script>`;

  // src/components/CalcStatic.astro
  files["src/components/CalcStatic.astro"] = `---
// Calc
---
<div class="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8">
  <div class="mb-8">
    <div class="flex items-center justify-between mb-4">
      <span class="text-sm font-medium text-muted-foreground">Loan Amount</span>
      <span id="calc-amount" class="text-2xl font-bold text-foreground">$2,000</span>
    </div>
    <input type="range" id="calc-slider" min="${amountMin}" max="${amountMax}" step="100" value="2000" class="w-full h-2.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
    <div class="flex justify-between text-xs text-muted-foreground mt-2">
      <span>$${amountMin}</span><span>$${amountMax}</span>
    </div>
  </div>
  <div class="grid md:grid-cols-3 gap-4">
    <div class="rounded-xl p-5 border bg-primary/5 border-primary/20 text-center">
      <p class="text-xs font-semibold text-muted-foreground mb-1">Pay in 6</p>
      <p class="text-2xl font-bold text-foreground">$<span id="tier1">333</span><span class="text-xs font-normal">/mo</span></p>
    </div>
    <div class="rounded-xl p-5 border bg-muted/30 border-border text-center">
      <p class="text-xs font-semibold text-muted-foreground mb-1">12 Months</p>
      <p class="text-2xl font-bold text-foreground">$<span id="tier2">181</span><span class="text-xs font-normal">/mo</span></p>
    </div>
    <div class="rounded-xl p-5 border bg-muted/30 border-border text-center">
      <p class="text-xs font-semibold text-muted-foreground mb-1">24 Months</p>
      <p class="text-2xl font-bold text-foreground">$<span id="tier3">110</span><span class="text-xs font-normal">/mo</span></p>
    </div>
  </div>
</div>
<script is:inline>
(function(){
  var s = document.getElementById('calc-slider'), d = document.getElementById('calc-amount');
  var t1 = document.getElementById('tier1'), t2 = document.getElementById('tier2'), t3 = document.getElementById('tier3');
  function calc(a, m, r){ if(r===0)return Math.round(a/m); var p=r/100/12; return Math.round((a*p*Math.pow(1+p,m))/(Math.pow(1+p,m)-1)); }
  s.addEventListener('input', function(){
    var a = parseInt(this.value); d.textContent = '$' + a.toLocaleString();
    t1.textContent = calc(a, 6, 0); t2.textContent = calc(a, 12, 15); t3.textContent = calc(a, 24, 28);
  });
})();
</script>`;

  // src/components/FAQStatic.astro
  files["src/components/FAQStatic.astro"] = `---
const faqs = [
  { q: 'Will checking my rate affect my credit score?', a: 'No. We use a soft credit inquiry which does not affect your credit score.' },
  { q: 'How much can I borrow?', a: 'Amounts range from $${amountMin} to $${amountMax} based on eligibility.' },
  { q: 'How fast is funding?', a: 'Many lenders offer next-business-day funding.' }
];
---
<div class="space-y-3">
  {faqs.map((f, i) => (
    <details class="group rounded-xl border border-border bg-card overflow-hidden" open={i===0}>
      <summary class="p-5 cursor-pointer font-semibold text-sm flex justify-between uppercase tracking-tight">
        {f.q} <span>↓</span>
      </summary>
      <div class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</div>
    </details>
  ))}
</div>`;

  // src/pages/index.astro
  files["src/pages/index.astro"] = `---
import Layout from "../layouts/Layout.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import HeroFormStatic from "../components/HeroFormStatic.astro";
import CalcStatic from "../components/CalcStatic.astro";
import FAQStatic from "../components/FAQStatic.astro";
import TrustBadges from "../components/TrustBadges.astro";
---
<Layout>
  <Header />
  <main class="pt-16">
    <section class="relative section-padding overflow-hidden text-center" style="background:linear-gradient(135deg, hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}%) 0%, hsl(${c.p[0]} ${c.p[1]}% ${Math.max(c.p[2] - 10, 20)}%) 100%); color: white;">
      <div class="container mx-auto relative z-10">
        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 bg-white/10 border border-white/20">
          <span class="w-2 h-2 rounded-full bg-secondary animate-pulse-soft"></span>
          <span class="text-xs font-bold uppercase tracking-wider">${badge}</span>
        </div>
        <h1 class="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">${h1}<br/><span class="text-secondary">${h1span}</span></h1>
        <p class="text-lg opacity-80 max-w-xl mx-auto mb-10">${sub}</p>
        <HeroFormStatic />
      </div>
    </section>
    
    <section class="bg-card py-10 border-b border-border">
      <div class="container mx-auto"><TrustBadges /></div>
    </section>

    <section id="calculator" class="section-padding">
      <div class="container mx-auto max-w-3xl text-center">
        <h2 class="text-3xl font-bold mb-10">Estimate Your Payment</h2>
        <CalcStatic />
      </div>
    </section>

    <section id="faq" class="section-padding bg-muted/30">
      <div class="container mx-auto max-w-2xl text-center">
        <h2 class="text-3xl font-bold mb-10">Common Questions</h2>
        <FAQStatic />
      </div>
    </section>
  </main>
  <Footer />
</Layout>`;

  // src/pages/apply.astro
  files["src/pages/apply.astro"] = `---
import Layout from "../layouts/Layout.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
---
<Layout title="Apply - ${brand}">
  <Header />
  <main class="pt-16 min-h-[80vh] flex items-center justify-center bg-muted/30 px-4 py-12">
    <div class="container max-w-lg text-center">
       <h1 class="text-3xl font-bold mb-4">Complete Application</h1>
       <p class="text-muted-foreground mb-8">Loading your personalized matching form...</p>
       <div class="bg-card rounded-2xl border border-border p-8 shadow-card min-h-[300px] flex items-center justify-center">
          <div id="lead-form">Form Loading...</div>
       </div>
    </div>
  </main>
  <Footer />
</Layout>`;

  return files;
}
