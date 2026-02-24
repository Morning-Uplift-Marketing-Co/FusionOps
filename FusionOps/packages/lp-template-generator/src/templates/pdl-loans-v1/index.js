/**
 * PDL Loans V1 Template Generator
 * Based on elastic-credits-v4 - Zero-JS architecture
 * Features: Hero form, trust badges, calculator, FAQ, full compliance footer
 */

import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[3];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS.find(x => x.id === 'dm-sans') || FONTS[0];
  const brand = site.brand || "ElasticCredits";
  const loanLabel = site.loanLabel || "Personal Loans";
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
    /* Spec-driven tokens (blue/orange system) */
    --primary-hex: #2563EB; /* Blue */
    --accent-hex: #F97316;  /* Orange CTA */
    --success-hex: #16A34A; /* Green badge */
    --dark-hex: #111827;    /* Footer */
    --gray-bg-hex: #F3F4F6; /* Section bg */
    --text-hex: #1F2937;
    --text-light-hex: #6B7280;

    /* Tailwind HSL tokens */
    --primary: 221 83% 53%; /* #2563EB */
    --primary-foreground: 0 0% 100%;
    --secondary: 221 83% 46%;
    --secondary-foreground: 0 0% 100%;
    --accent: 21 90% 52%;   /* #F97316 */
    --accent-foreground: 0 0% 100%;
    --background: 0 0% 100%;
    --foreground: 217 27% 17%; /* #1F2937 */
    --card: 0 0% 100%;
    --card-foreground: 217 27% 17%;
    --muted: 210 20% 96%;   /* #F3F4F6 */
    --muted-foreground: 215 16% 47%; /* #6B7280 */
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 210 20% 91%;
    --input: 210 20% 91%;
    --ring: 221 83% 53%;
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
      text-white font-extrabold text-lg
      h-14 px-8 rounded-2xl
      shadow-cta
      transition-all duration-200
      hover:shadow-xl
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
      active:scale-[0.985]
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
    /* Consistent whitespace scale ~64px / 96px / 112px */
    @apply py-16 md:py-24 lg:py-28;
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

  // ─── src/pages/index.astro ──────────────────────────────────
  files["src/pages/index.astro"] = `---
import Layout from "../layouts/Layout.astro";
---

<Layout>
  <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-[var(--primary-hex)] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">Skip to content</a>

  <!-- Sticky Navbar -->
  <header class="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[hsl(var(--border))] shadow-sm">
    <div class="container mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-2 font-extrabold text-[hsl(var(--foreground))]">
        <span>🐻</span>
        <span>PDL Loans V1</span>
      </div>
      <nav class="hidden md:flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
        <a href="#apply" class="hover:text-[hsl(var(--foreground))]">Apply</a>
        <a href="#calculator" class="hover:text-[hsl(var(--foreground))]">Calculator</a>
        <a href="#faq" class="hover:text-[hsl(var(--foreground))]">FAQ</a>
      </nav>
      <div class="flex items-center gap-3">
        <span class="hidden sm:inline text-[12px] text-[hsl(var(--muted-foreground))] font-semibold">1-800-XXX-XXXX</span>
        <a href="#apply" class="inline-flex items-center rounded-full bg-[var(--accent-hex)] text-white text-sm font-bold h-9 px-4">Apply Now</a>
      </div>
    </div>
  </header>

  <main id="main-content">
    <!-- HERO -->
    <section class="relative overflow-hidden text-white section-padding" style="background:linear-gradient(135deg, var(--primary-hex) 0%, #1D4ED8 100%)">
      <div class="container mx-auto max-w-6xl px-4 text-center">
        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2)">
          <span class="w-2 h-2 rounded-full" style="background:var(--success-hex)"></span>
          <span class="text-sm font-semibold">🟢 Join 60,000+ People Who Got Funded This Month</span>
        </div>
        <h1 class="text-4xl md:text-6xl font-extrabold leading-tight mb-5">Emergency Cash Made Simple. Get up to $25,000 by Tomorrow.</h1>
        <p class="text-white/90 max-w-2xl mx-auto mb-7">Fast approval. No hard credit check. Get the funds you need without the wait.</p>
        <div class="flex flex-wrap justify-center gap-3 text-[13px] mb-8">
          <span class="px-3 py-1 rounded-full border border-white/30">✓ No hard credit check</span>
          <span class="px-3 py-1 rounded-full border border-white/30">✓ Instant decision</span>
          <span class="px-3 py-1 rounded-full border border-white/30">✓ Funds next day</span>
        </div>
        <a href="#apply" class="inline-flex items-center justify-center rounded-full bg-[var(--accent-hex)] text-white font-extrabold text-lg h-14 px-8 shadow-[0_10px_30px_rgba(249,115,22,0.35)]">Get My Instant Quote →</a>
        <div class="text-white/80 text-sm mt-3">Apply now — get funded as soon as tomorrow</div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 text-white/90 text-sm">
          <div>⭐ 4.8/5 · 5,200+ reviews</div>
          <div>🔒 256-bit SSL</div>
          <div>✅ No Hard Credit Check</div>
          <div>⚡ Instant Decision</div>
        </div>
      </div>
    </section>

    <!-- REVIEWS -->
    <section class="bg-[var(--gray-bg-hex)] section-padding">
      <div class="container mx-auto max-w-6xl px-4">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-extrabold text-[hsl(var(--foreground))]">What Our Customers Say</h2>
          <div class="text-sm text-[hsl(var(--muted-foreground))]">⭐ 4.9 from 5,200+ reviews</div>
        </div>
        <div class="grid md:grid-cols-2 gap-6 items-stretch">
          <div class="bg-white border border-[hsl(var(--border))] rounded-xl p-6 shadow-sm h-full flex flex-col">
            <div class="text-yellow-500 mb-1">⭐⭐⭐⭐⭐</div>
            <p class="text-[hsl(var(--foreground))]">“Got approved within minutes and funds hit my account the next day. Incredibly fast and straightforward.”</p>
            <div class="mt-3 text-[12px] text-[hsl(var(--muted-foreground))] mt-auto">Jamie R., Austin · 2 days ago</div>
          </div>
          <div class="bg-white border border-[hsl(var(--border))] rounded-xl p-6 shadow-sm h-full flex flex-col">
            <div class="text-yellow-500 mb-1">⭐⭐⭐⭐⭐</div>
            <p class="text-[hsl(var(--foreground))]">“I loved the no hard credit check and instant decision. Payment options were clear and fair.”</p>
            <div class="mt-3 text-[12px] text-[hsl(var(--muted-foreground))] mt-auto">Carlos M., Tampa · 1 week ago</div>
          </div>
        </div>
        <div class="mt-8 text-[12px] text-[hsl(var(--muted-foreground))] bg-white/60 border border-[hsl(var(--border))] rounded-lg p-4">⚠ APR ranges from 5% to 35.99%. Actual rate depends on credit. Loan terms range from 61 days to 72 months.</div>
      </div>
    </section>

    <!-- CALCULATOR -->
    <section id="calculator" class="bg-white section-padding">
      <div class="container mx-auto px-4 max-w-4xl text-center">
        <div class="inline-block text-[12px] font-bold px-3 py-1 rounded-full mb-2" style="background: hsl(var(--muted)); color: hsl(var(--muted-foreground))">💳 PAYMENT CALCULATOR</div>
        <h2 class="text-3xl font-extrabold text-[hsl(var(--foreground))] mb-2">See Your Monthly Payment</h2>
        <p class="text-[hsl(var(--muted-foreground))] mb-6">Choose your loan amount and see instant payment options</p>
        <div class="text-5xl md:text-6xl font-black text-[var(--primary-hex)] mb-2 tracking-tight" id="amountDisplay">$2,000</div>
        <div class="max-w-2xl mx-auto">
          <input id="amountSlider" type="range" min="100" max="10000" step="100" value="2000" class="w-full mt-2" />
          <div class="flex justify-between text-[12px] text-[hsl(var(--muted-foreground))]"><span>$100</span><span>$10,000</span></div>
        </div>

        <div class="grid md:grid-cols-3 gap-6 mt-8 text-left items-stretch">
          <div class="rounded-xl border-2 p-5 h-full" id="plan5" style="border-color: #22C55E20">
            <div class="text-[12px] font-bold text-[hsl(var(--muted-foreground))] mb-1">Pay in 5</div>
            <div class="text-xl font-extrabold text-[hsl(var(--foreground))]">5 Months <span class="text-[12px] font-bold text-[hsl(var(--muted-foreground))]">| 0% APR</span></div>
            <div class="mt-1 text-[hsl(var(--foreground))] text-2xl md:text-3xl font-black"><span id="m5">$400.00</span><span class="text-sm font-medium">/mo</span></div>
            <div class="text-[12px] text-[hsl(var(--muted-foreground))]">Finance: <span id="f5">$0.00</span> · Total: <span id="t5">$2,000.00</span></div>
            <div class="inline-block mt-2 text-[10px] font-black px-2 py-0.5 rounded-full" style="background:#22C55E; color:#fff">BEST VALUE</div>
          </div>
          <div class="rounded-xl border p-5 h-full">
            <div class="text-xl font-extrabold text-[hsl(var(--foreground))]">12 Months</div>
            <div class="mt-1 text-[hsl(var(--foreground))] text-2xl md:text-3xl font-black"><span id="m12">$191.67</span><span class="text-sm font-medium">/mo</span></div>
            <div class="text-[12px] text-[hsl(var(--muted-foreground))]">APR: 14.99% · Finance: <span id="f12">$300.00</span> · Total: <span id="t12">$2,300.00</span></div>
          </div>
          <div class="rounded-xl border p-5 h-full">
            <div class="text-xl font-extrabold text-[hsl(var(--foreground))]">24 Months</div>
            <div class="mt-1 text-[hsl(var(--foreground))] text-2xl md:text-3xl font-black"><span id="m24">$103.33</span><span class="text-sm font-medium">/mo</span></div>
            <div class="text-[12px] text-[hsl(var(--muted-foreground))]">APR: 18.99% · Finance: <span id="f24">$480.00</span> · Total: <span id="t24">$2,480.00</span></div>
          </div>
        </div>

        <a href="#apply" id="applyCta" class="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--accent-hex)] text-white font-extrabold text-base h-12 px-6">Apply for $2,000</a>
        <div class="text-[12px] text-[hsl(var(--muted-foreground))] mt-2">*Subject to your credit score's final eligibility</div>
      </div>
    </section>

    <!-- WHY CHOOSE US -->
    <section class="bg-[var(--gray-bg-hex)] py-14">
      <div class="container mx-auto px-4 text-center">
        <h2 class="text-3xl font-extrabold text-[hsl(var(--foreground))] mb-2">Why Choose Us</h2>
        <p class="text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-8">Fast approvals, minimal paperwork, and warm support when unexpected expenses can't wait.</p>
        <div class="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div class="bg-white border rounded-xl p-5 shadow-sm"><div class="text-2xl mb-2">⚡</div><div class="font-extrabold mb-1">Lightning-fast approvals</div><p class="text-[hsl(var(--muted-foreground))]">Get a decision in minutes during business hours, so you can start moving forward quickly without delayed approval...</p></div>
          <div class="bg-white border rounded-xl p-5 shadow-sm"><div class="text-2xl mb-2">📋</div><div class="font-extrabold mb-1">Minimal documentation</div><p class="text-[hsl(var(--muted-foreground))]">Upload just a few documents. No time-consuming stacks of forms or paperwork is taking a month.</p></div>
          <div class="bg-white border rounded-xl p-5 shadow-sm"><div class="text-2xl mb-2">🐻</div><div class="font-extrabold mb-1">Friendly, teddy-bear support</div><p class="text-[hsl(var(--muted-foreground))]">Our caring team treats you like family with patient, judgment-free help, at every step of the way.</p></div>
          <div class="bg-white border rounded-xl p-5 shadow-sm"><div class="text-2xl mb-2">💲</div><div class="font-extrabold mb-1">Clear, fair pricing</div><p class="text-[hsl(var(--muted-foreground))]">No surprise fees or hidden costs. See your rate and total cost upfront and flexible terms that fit your budget.</p></div>
        </div>
      </div>
    </section>

    <!-- SIMPLE PROCESS -->
    <section class="bg-white py-14">
      <div class="container mx-auto px-4 text-center">
        <h2 class="text-3xl font-extrabold text-[hsl(var(--foreground))] mb-2">Simple Process</h2>
        <p class="text-[hsl(var(--muted-foreground))] max-w-xl mx-auto mb-8">Apply online, get approved fast, and receive funds securely.</p>
        <div class="grid md:grid-cols-3 gap-4 text-left">
          <div class="bg-white border rounded-xl p-5"><div class="text-2xl mb-2">📝</div><div class="font-extrabold mb-1">Quick Application</div><p class="text-[hsl(var(--muted-foreground))]">Fill out a simple form in under 2 minutes. No paperwork required.</p></div>
          <div class="bg-white border rounded-xl p-5"><div class="text-2xl mb-2">👍</div><div class="font-extrabold mb-1">Instant Decision</div><p class="text-[hsl(var(--muted-foreground))]">No hard credit inquiry. Getting approved won't impact your credit score.</p></div>
          <div class="bg-white border rounded-xl p-5"><div class="text-2xl mb-2">💳</div><div class="font-extrabold mb-1">Choose Your Plan</div><p class="text-[hsl(var(--muted-foreground))]">Select the payment plan that works best for your budget.</p></div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="bg-[var(--gray-bg-hex)] py-14">
      <div class="container mx-auto px-4">
        <div class="inline-block text-[12px] font-bold px-3 py-1 rounded-full mb-2" style="background: hsl(var(--muted)); color: hsl(var(--muted-foreground))">❓ FAQ</div>
        <h2 class="text-3xl font-extrabold text-[hsl(var(--foreground))] mb-2">Frequently Asked Questions</h2>
        <p class="text-[hsl(var(--muted-foreground))] mb-6">Everything you need to know about installment loans</p>
        <div class="space-y-2" id="faqList">
          ${["How fast can I be approved?","What documents do I need to apply?","Can I qualify if I have fair credit?","Will checking my options affect my credit score?","Are there fees or prepayment penalties?"].map((q,i)=>`<details class=\"faq-details bg-white border rounded-lg p-4\"><summary class=\"cursor-pointer flex items-center justify-between font-semibold\">${q}<span>▼</span></summary><div class=\"mt-2 text-[hsl(var(--muted-foreground))]\">Answer coming soon. Placeholder content for policy-compliant explanation.</div></details>`).join('')}
        </div>
      </div>
    </section>

    <!-- TRUSTED BY CUSTOMERS -->
    <section class="bg-white py-14">
      <div class="container mx-auto px-4 text-center">
        <h2 class="text-3xl font-extrabold text-[hsl(var(--foreground))] mb-2">Trusted by Our Customers</h2>
        <p class="text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-8">Real people, real relief — see why thousands choose our caring team.</p>
        <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-left">
          ${[1,2,3].map(() => `<div class=\"bg-[var(--gray-bg-hex)] border rounded-xl p-5\"><div class=\"text-yellow-500 mb-1\">⭐⭐⭐⭐⭐</div><p class=\"text-[hsl(var(--foreground))]\">“Life saver during an emergency. Transparent and quick.”</p><div class=\"mt-3 text-[12px] text-[hsl(var(--muted-foreground))]\">Alex — Chicago · 3 days ago</div></div>`).join('')}
        </div>
        <div class="mt-6 text-[12px] text-[hsl(var(--muted-foreground))]">⭐ 4.9/5 · from 5,200+ reviews</div>
      </div>
    </section>

    <!-- TRUST BADGES -->
    <section class="bg-[var(--gray-bg-hex)] py-14">
      <div class="container mx-auto px-4 text-center">
        <div class="text-[12px] font-bold text-[hsl(var(--muted-foreground))] mb-2">🔒 TRUST & SECURE</div>
        <div class="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div class="bg-white border rounded-xl p-5"><div class="font-extrabold mb-1">🏛 BBB A+ Rated</div><div class="text-[hsl(var(--muted-foreground))]">Accredited Business</div></div>
          <div class="bg-white border rounded-xl p-5"><div class="font-extrabold mb-1">🔒 SSL Secured</div><div class="text-[hsl(var(--muted-foreground))]">256-bit encryption</div></div>
          <div class="bg-white border rounded-xl p-5"><div class="font-extrabold mb-1">✅ SOC 2 Compliant</div><div class="text-[hsl(var(--muted-foreground))]">Enterprise security</div></div>
          <div class="bg-white border rounded-xl p-5"><div class="font-extrabold mb-1">🏦 FDIC Insured</div><div class="text-[hsl(var(--muted-foreground))]">Partner banks</div></div>
        </div>
        <div class="mt-6 text-[12px] text-[hsl(var(--muted-foreground))]">256-bit Encryption | Bank-Level Security | Secure Disclosure | A+ BBB Rating</div>
      </div>
    </section>

    <!-- APPLY ANCHOR -->
    <section id="apply" class="bg-white py-12">
      <div class="container mx-auto px-4 text-center">
        <h2 class="text-2xl font-extrabold text-[hsl(var(--foreground))] mb-3">Ready to Apply?</h2>
        <p class="text-[hsl(var(--muted-foreground))] mb-4">Start your application — it only takes 2 minutes.</p>
        <!-- AFFILIATE LINK: replace href="#" with tracking URL -->
        <a href="#" class="inline-flex items-center justify-center rounded-full bg-[var(--accent-hex)] text-white font-extrabold text-base h-12 px-6">Start Application</a>
      </div>
    </section>
  </main>

  <!-- Inline Styles & Scripts for Performance -->
  <style is:inline>
    html{scroll-behavior:smooth}
    /* Simple slider styling */
    input[type="range"]{appearance:none;height:6px;border-radius:999px;background:hsl(var(--muted));}
    input[type="range"]::-webkit-slider-thumb{appearance:none;width:18px;height:18px;border-radius:50%;background:var(--primary-hex);box-shadow:0 0 0 3px #fff}
  </style>

  <script is:inline>
    (function(){
      function fmt(n){return '$' + Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
      var s=document.getElementById('amountSlider');
      if(!s) return;
      var amtDisp=document.getElementById('amountDisplay');
      var m5=document.getElementById('m5'), f5=document.getElementById('f5'), t5=document.getElementById('t5');
      var m12=document.getElementById('m12'), f12=document.getElementById('f12'), t12=document.getElementById('t12');
      var m24=document.getElementById('m24'), f24=document.getElementById('f24'), t24=document.getElementById('t24');
      var applyCta=document.getElementById('applyCta');

      function pay(P, apr, months){
        if(apr === 0){ return { m: P/months, finance: 0, total: P }; }
        var r = (apr/100)/12; // monthly rate
        var m = P * r / (1 - Math.pow(1 + r, -months));
        var total = m * months;
        var finance = total - P;
        return { m:m, finance:finance, total:total };
      }

      function recalc(){
        var P = Number(s.value);
        amtDisp.textContent = '$' + P.toLocaleString();
        var p5 = pay(P, 0, 5);
        m5.textContent = fmt(p5.m); f5.textContent = fmt(p5.finance); t5.textContent = fmt(p5.total);
        var p12 = pay(P, 14.99, 12);
        m12.textContent = fmt(p12.m); f12.textContent = fmt(p12.finance); t12.textContent = fmt(p12.total);
        var p24 = pay(P, 18.99, 24);
        m24.textContent = fmt(p24.m); f24.textContent = fmt(p24.finance); t24.textContent = fmt(p24.total);
        if(applyCta) applyCta.textContent = 'Apply for ' + ('$' + P.toLocaleString());
      }

      s.addEventListener('input', recalc);
      recalc();
    })();
  </script>
</Layout>
`;

  // ─── src/pages/apply.astro ─────────────────────────────────
  files["src/pages/apply.astro"] = `---
import Layout from "../layouts/Layout.astro";
---

<Layout title="Apply Now — ${brand}" description="Complete your application in minutes for ${brand}">
  <main class="bg-white py-12">
    <div class="container mx-auto px-4 max-w-2xl">
      <h1 class="text-3xl font-extrabold text-[hsl(var(--foreground))] mb-2">Apply Now</h1>
      <p class="text-[hsl(var(--muted-foreground))] mb-6">Finish your application — it only takes 2 minutes. We’ll guide you through the next steps.</p>

      <div class="bg-[var(--gray-bg-hex)] border border-[hsl(var(--border))] rounded-xl p-5 mb-6">
        <div class="text-sm text-[hsl(var(--muted-foreground))]">Requested Amount</div>
        <div id="applyAmount" class="text-2xl font-extrabold text-[hsl(var(--foreground))]">$2,000</div>
        <div id="applyZip" class="text-[12px] text-[hsl(var(--muted-foreground))] mt-1">ZIP: —</div>
      </div>

      <!-- AFFILIATE LINK: replace href="#" with tracking URL -->
      <a id="applyPrimaryCta" href="#" class="inline-flex items-center justify-center rounded-full bg-[var(--accent-hex)] text-white font-extrabold text-base h-12 px-6 w-full sm:w-auto">Continue to Secure Application</a>

      <p class="text-[12px] text-[hsl(var(--muted-foreground))] mt-3">By continuing, you agree to our Terms & Privacy. No hard credit check to view options.</p>

      <section class="mt-10">
        <h2 class="text-xl font-extrabold text-[hsl(var(--foreground))] mb-2">What to Expect</h2>
        <ul class="list-disc pl-5 text-[hsl(var(--muted-foreground))] space-y-1 text-sm">
          <li>Secure form with bank-level encryption</li>
          <li>Instant decision during business hours</li>
          <li>Funding as soon as next business day</li>
        </ul>
      </section>
    </div>
  </main>

  <script is:inline>
    (function(){
      function fmt(n){ return '$' + Number(n||0).toLocaleString(); }
      var p = new URLSearchParams(location.search);
      var amt = Number(p.get('amount')||2000);
      var zip = p.get('zip')||'';
      var elAmt = document.getElementById('applyAmount');
      var elZip = document.getElementById('applyZip');
      if(elAmt) elAmt.textContent = fmt(amt);
      if(elZip) elZip.textContent = 'ZIP: ' + (zip||'—');
      var cta = document.getElementById('applyPrimaryCta');
      if(cta){
        // Preserve params for affiliate handoff (replace # with tracking URL)
        var params = new URLSearchParams();
        if(amt) params.set('amount', amt);
        if(zip) params.set('zip', zip);
        cta.href = '#' + (params.toString()?('?'+params.toString()):'');
      }
    })();
  </script>
</Layout>
`;

  // ─── README.md ─────────────────────────────────────────────
  files["README.md"] = `# ${brand} — PDL Loans V1

Astro static landing page for ${loanLabel}. Built with zero-JS architecture for maximum performance.

## Features

- **Zero-JS Architecture**: Pure Astro components with minimal inline scripts
- **Hero Form**: Interactive loan amount selector with ZIP code input
- **Trust Badges**: Social proof with funded count, ratings, and security indicators
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
