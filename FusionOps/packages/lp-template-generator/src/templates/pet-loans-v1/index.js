/**
 * Pet Loans V1 Template Generator
 * Pet care financing LP with hero form, calculator, FAQ, testimonials
 * Multi-file Astro project with Tailwind CSS, zero-JS static components + React apply form
 */

import { COLORS, FONTS } from '../../core/template-registry.js';

export function generate(site) {
  const c = COLORS.find(x => x.id === site.colorId) || COLORS[3];
  const f = FONTS.find(x => x.id === site.fontId) || FONTS.find(x => x.id === 'dm-sans') || FONTS[0];
  const brand = site.brand || "PetLoansPro";
  const domain = site.domain || "petloanspro.com";
  const h1 = site.h1 || "A Smarter Way";
  const h1span = site.h1span || "to Borrow";
  const sub = site.sub || "Get approved in minutes. Funds as fast as next business day. Direct deposit to your bank account.";
  const badge = site.badge || "4,200+ funded this month";
  const cta = site.cta || "Check My Rate";
  const loanLabel = site.loanLabel || "Pet Care Financing";
  const amountMin = site.amountMin || 100;
  const amountMax = site.amountMax || 5000;
  const aprMin = site.aprMin || 5.99;
  const aprMax = site.aprMax || 35.99;
  const email = site.email || `support@${domain}`;

  // Tracking configs
  const aid = site.aid || "14881";
  const network = site.network || "LeadsGate";
  const redirectUrl = site.redirectUrl || "#";
  const voluumId = site.voluumId || "";
  const voluumDomain = site.voluumDomain || "";
  const conversionId = site.conversionId || "";
  const formStartLabel = site.formStartLabel || "";
  const formSubmitLabel = site.formSubmitLabel || "";

  // Color HSL values for CSS variables
  const pH = c.p?.[0] ?? 217;
  const pS = c.p?.[1] ?? 91;
  const pL = c.p?.[2] ?? 35;
  const primary = `${pH} ${pS}% ${pL}%`;

  // Font
  const fontFamily = f.name || 'DM Sans';
  const fontUrl = f.url || 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&display=swap';

  return {
    'package.json': `{
  "name": "${brand.toLowerCase().replace(/[^a-z0-9]/g, '-')}-lp",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "@astrojs/react": "^4.2.0",
    "@astrojs/tailwind": "^6.0.0",
    "astro": "^5.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^3.4.17"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}`,

    'astro.config.mjs': `import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  output: 'static',
  build: {
    inlineStylesheets: 'always',
  },
});`,

    'tsconfig.json': `{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}`,

    'tailwind.config.mjs': `/** @type {import('tailwindcss').Config} */
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
        sans: ['"${fontFamily}"', 'system-ui', 'sans-serif'],
        display: ['"${fontFamily}"', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        sm: '0 1px 2px 0 hsl(${primary} / 0.05)',
        md: '0 4px 6px -1px hsl(${primary} / 0.1), 0 2px 4px -2px hsl(${primary} / 0.1)',
        lg: '0 10px 15px -3px hsl(${primary} / 0.1), 0 4px 6px -4px hsl(${primary} / 0.1)',
        xl: '0 20px 25px -5px hsl(${primary} / 0.1), 0 8px 10px -6px hsl(${primary} / 0.1)',
        cta: '0 4px 14px 0 hsl(15 92% 62% / 0.4)',
        card: '0 10px 15px -3px hsl(${primary} / 0.08), 0 4px 6px -4px hsl(${primary} / 0.06)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, hsl(${primary}) 0%, hsl(${pH} ${pS}% ${Math.max(pL - 10, 10)}%) 100%)',
        'cta-gradient': 'linear-gradient(135deg, hsl(15 92% 62%) 0%, hsl(15 92% 52%) 100%)',
        'success-gradient': 'linear-gradient(135deg, hsl(158 64% 42%) 0%, hsl(158 64% 36%) 100%)',
        'trust-gradient': 'linear-gradient(180deg, hsl(210 40% 98%) 0%, hsl(210 40% 96%) 100%)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shake: { '0%, 100%': { transform: 'translateX(0)' }, '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' }, '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' } },
        'pulse-soft': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(0.75)' } },
        'spin-slow': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'slide-up': 'slide-up 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.2s ease-out forwards',
        shake: 'shake 0.4s ease-in-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'spin-slow': 'spin-slow 1.5s linear infinite',
      },
    },
  },
  plugins: [],
};`,

    'src/styles/global.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0;
  }
}

@layer base {
  :root {
    --background: 210 40% 98%;
    --foreground: 222 47% 11%;
    --primary: ${primary};
    --primary-foreground: 0 0% 100%;
    --secondary: 158 64% 42%;
    --secondary-foreground: 0 0% 100%;
    --accent: 15 92% 62%;
    --accent-foreground: 0 0% 100%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: ${primary};
    --radius: 0.75rem;
  }
  * { border-color: hsl(var(--border)); }
  html { scroll-behavior: smooth; }
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: '${fontFamily}', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer components {
  .btn-cta {
    @apply inline-flex items-center justify-center gap-2 text-white font-bold text-lg h-14 px-8 rounded-xl shadow-cta transition-all duration-200 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none;
    background: linear-gradient(135deg, hsl(15 92% 62%) 0%, hsl(15 92% 52%) 100%);
  }
  .btn-cta:hover { transform: scale(1.02); }
  .card-elevated {
    @apply bg-card rounded-xl border border-border shadow-card p-6 transition-all duration-300 hover:shadow-lg;
  }
  .card-elevated:hover { transform: translateY(-2px); }
  .section-padding { @apply py-16 md:py-24; }
  .glass-card {
    @apply bg-white/80 border border-white/60 rounded-2xl shadow-lg;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .faq-details[open] { @apply border-primary/20 shadow-sm; background: hsl(var(--primary) / 0.02); }
  .faq-details summary::-webkit-details-marker, .faq-details summary::marker { display: none; }
  .faq-details summary { list-style: none; }
}`,

    'src/lib/tracking.ts': `export function pushDataLayer(event: string, data?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({ event, ...data });
  }
}

export function getUrlParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  const r: Record<string, string> = {};
  p.forEach((v, k) => { r[k] = v; });
  return r;
}`,

    'src/layouts/Layout.astro': `---
import '../styles/global.css';

interface Props {
  title?: string;
  description?: string;
  canonicalUrl?: string;
}

const {
  title = '${brand} – ${loanLabel} $${amountMin.toLocaleString()}-$${amountMax.toLocaleString()} | Fast Approval',
  description = 'Get ${loanLabel.toLowerCase()} from $${amountMin.toLocaleString()} to $${amountMax.toLocaleString()} with flexible repayment. All credit types welcome. Apply online in 2 minutes.',
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
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonicalUrl} />
    <meta property="og:site_name" content="${brand}" />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preload" as="style" href="${fontUrl}" />
    <link href="${fontUrl}" rel="stylesheet" media="print" onload="this.media='all'" />
    <noscript><link href="${fontUrl}" rel="stylesheet" /></noscript>
    <script is:inline>window.dataLayer = window.dataLayer || [];</script>
    <style is:inline>body { font-family: '${fontFamily}', system-ui, -apple-system, sans-serif; }</style>
${conversionId ? `    <!-- Google Ads gtag -->
    <script is:inline async src="https://www.googletagmanager.com/gtag/js?id=${conversionId}"></script>
    <script is:inline>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${conversionId}');
    </script>` : ''}
${voluumId ? `    <!-- Voluum -->
    <script is:inline>
      var vpv = document.createElement('script');
      vpv.src = 'https://${voluumDomain || 'track.vlm.icu'}/scripts/${voluumId}/vp.js';
      document.head.appendChild(vpv);
    </script>` : ''}
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FinancialProduct",
      "name": "${brand} ${loanLabel}",
      "description": "${loanLabel} from $${amountMin.toLocaleString()} to $${amountMax.toLocaleString()} with fast approval",
      "provider": { "@type": "FinancialService", "name": "${brand}", "url": "https://${domain}" },
      "annualPercentageRate": { "@type": "QuantitativeValue", "minValue": ${aprMin}, "maxValue": ${aprMax}, "unitCode": "P1" },
      "amount": { "@type": "MonetaryAmount", "minValue": ${amountMin}, "maxValue": ${amountMax}, "currency": "USD" },
      "feesAndCommissionsSpecification": "No hidden fees. APR varies based on creditworthiness."
    }
    </script>
  </head>
  <body class="min-h-screen bg-background text-foreground antialiased">
    <slot />
  </body>
</html>`,

    'src/components/Header.astro': `---
// Static Header – zero client JS
---

<header class="fixed top-0 inset-x-0 z-50 border-b border-border/50" style="background:hsl(var(--background) / 0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)">
  <nav aria-label="Main navigation" class="container flex items-center justify-between h-16">
    <a href="/" class="flex items-center gap-2 group">
      <div class="w-9 h-9 rounded-lg bg-hero-gradient flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
        <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
      <a href="#apply" aria-label="Apply for a loan now" class="btn-cta !h-10 !px-5 !text-sm !rounded-lg !shadow-sm hover:!shadow-cta">
        ${cta}
      </a>
    </div>
  </nav>
</header>`,

    'src/components/Footer.astro': `---
const year = new Date().getFullYear();
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
        <p class="text-sm text-muted-foreground leading-relaxed">Connecting you with trusted lenders for ${loanLabel.toLowerCase()} up to $${amountMax.toLocaleString()}.</p>
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
          <li><a href="mailto:${email}" class="hover:text-foreground transition-colors">Contact Us</a></li>
          <li><a href="/licensing" class="hover:text-foreground transition-colors">Licensing</a></li>
        </ul>
      </nav>
    </div>
    <div class="border-t border-border pt-8 space-y-4 text-xs text-muted-foreground leading-relaxed">
      <p><strong class="text-foreground/70">Representative Example:</strong> A $1,000 loan repaid over 12 monthly installments at 15% APR would result in 12 monthly payments of $90.26. Total amount payable: $1,083.12. Total interest: $83.12. Minimum repayment period: 61 days. Maximum repayment period: 24 months.</p>
      <p><strong class="text-foreground/70">APR Disclosure:</strong> Annual Percentage Rate (APR) ranges from ${aprMin}% to ${aprMax}%. APR depends on credit score, loan amount, loan term, credit usage and history. Only the most creditworthy applicants qualify for the lowest rates.</p>
      <p>${brand} is NOT a lender and does not make loan or credit decisions. ${brand} connects interested persons with a lender from its network of approved lenders. Not all lenders can provide loan amounts up to $${amountMax.toLocaleString()}. Cash transfer times may vary. Repayment terms vary by lender and local laws.</p>
      <p>Loans issued by WebBank, Member FDIC. Checking your rate won't affect your credit score.</p>
      <div class="pt-4 border-t border-border flex flex-col md:flex-row items-center justify-between gap-2">
        <p>&copy; {year} ${brand}. All rights reserved.</p>
      </div>
    </div>
  </div>
</footer>`,

    'src/components/HeroFormStatic.astro': `---
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
        <button type="button" data-amount="${amountMax}" class="amt-btn py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground">$${(amountMax/1000).toFixed(0)}K</button>
      </div>
      <input type="range" id="amount-slider" min="${amountMin}" max="${amountMax}" step="100" value="2000" aria-label="Loan amount"
        class="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
          [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer" />
      <div class="flex justify-between text-xs text-muted-foreground mt-1">
        <span>$${amountMin.toLocaleString()}</span>
        <span id="amount-display" class="text-base font-bold text-foreground">$2,000</span>
        <span>$${amountMax.toLocaleString()}</span>
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
    window.dataLayer.push({ event:'form_start', conversion_value:amount, currency:'USD' });
${conversionId && formStartLabel ? `    if(typeof gtag==='function') gtag('event','conversion',{send_to:'${conversionId}/${formStartLabel}',value:amount,currency:'USD'});` : ''}
    var p = new URLSearchParams(window.location.search);
    p.set('amount', amount);
    p.set('zip', zip);
    window.location.href = '/apply?' + p.toString();
  });
})();
</script>`,

    'src/components/CalcStatic.astro': `---
// Pure Astro - zero framework JS
---

<div id="calc-root">
  <div class="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8">
    <div class="mb-8">
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm font-medium text-muted-foreground">Loan Amount</span>
        <span id="calc-amount" class="text-2xl font-bold text-foreground">$2,000</span>
      </div>
      <input type="range" id="calc-slider" min="${Math.max(amountMin, 200)}" max="${amountMax}" step="100" value="2000" aria-label="Loan amount"
        class="w-full h-2.5 bg-muted rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
          [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer" />
      <div class="flex justify-between text-xs text-muted-foreground mt-2">
        <span>$${Math.max(amountMin, 200).toLocaleString()}</span><span>$${amountMax.toLocaleString()}</span>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="relative rounded-xl p-5 border bg-secondary/5 border-secondary/30 ring-1 ring-secondary/20 shadow-md">
        <span class="absolute -top-2.5 left-4 px-2.5 py-0.5 text-white text-xs font-bold rounded-full shadow-sm" style="background:linear-gradient(135deg,hsl(158 64% 42%),hsl(158 64% 36%))">0% Interest</span>
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
</script>`,

    'src/components/FAQStatic.astro': `---
const faqs = [
  { q: 'Will checking my rate affect my credit score?', a: 'No. We use a soft credit inquiry which does not affect your credit score. A hard inquiry may occur only if you proceed with a loan offer.' },
  { q: 'How much can I borrow?', a: 'Loan amounts range from $${amountMin.toLocaleString()} to $${amountMax.toLocaleString()} depending on your state, credit profile, and lender terms.' },
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
</div>`,

    'src/components/Testimonials.astro': `---
const testimonials = [
  { initials: 'JM', name: 'John M.', location: 'Texas', text: 'Got approved in literally 2 minutes. Funds hit my account the next day. Exactly what I needed!', gradient: 'from-blue-500 to-purple-600' },
  { initials: 'SK', name: 'Sarah K.', location: 'California', text: 'The process was so simple. No hidden fees, and the rate was better than my credit card. Highly recommend!', gradient: 'from-emerald-500 to-teal-600' },
  { initials: 'RM', name: 'Robert M.', location: 'Florida', text: 'I was skeptical at first, but they delivered. Fast approval, clear terms, and great customer service.', gradient: 'from-orange-500 to-red-500' },
];
---

<div class="grid md:grid-cols-3 gap-6">
  {testimonials.map((t) => (
    <article class="bg-card rounded-2xl p-6 shadow-card border border-border transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <div class="flex items-center gap-3 mb-4">
        <div class={\`w-12 h-12 rounded-full bg-gradient-to-br \${t.gradient} flex items-center justify-center text-white font-bold text-sm shadow-md\`} aria-hidden="true">
          {t.initials}
        </div>
        <div>
          <p class="font-semibold text-foreground">{t.name}</p>
          <p class="text-sm text-muted-foreground">Verified Borrower &bull; {t.location}</p>
        </div>
      </div>
      <blockquote>
        <p class="text-muted-foreground leading-relaxed">"{t.text}"</p>
      </blockquote>
      <div class="flex items-center gap-2 mt-4" aria-label="5 out of 5 stars">
        <span class="text-amber-400 text-lg" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
        <span class="text-sm text-muted-foreground">5.0</span>
      </div>
    </article>
  ))}
</div>`,

    'src/components/EligibilityForm.tsx': `import { useState, useEffect } from 'react';

export default function EligibilityForm() {
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', zip: '', amount: '2000',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setFormData((prev) => ({
      ...prev,
      zip: p.get('zip') || prev.zip,
      amount: p.get('amount') || prev.amount,
    }));
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.firstName.trim()) e.firstName = 'Required';
    if (!formData.lastName.trim()) e.lastName = 'Required';
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(formData.email)) e.email = 'Valid email required';
    if (!/^\\d{10}$/.test(formData.phone.replace(/\\D/g, ''))) e.phone = '10-digit phone required';
    if (!/^\\d{5}$/.test(formData.zip)) e.zip = 'Valid ZIP required';
    const amt = Number(formData.amount);
    if (isNaN(amt) || amt < ${amountMin} || amt > ${amountMax}) e.amount = '$${amountMin.toLocaleString()} – $${amountMax.toLocaleString()}';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    (window as any).dataLayer?.push({
      event: 'form_submit',
      conversion_value: Number(formData.amount),
      currency: 'USD',
    });
${conversionId && formSubmitLabel ? `
    if(typeof (window as any).gtag==='function') (window as any).gtag('event','conversion',{send_to:'${conversionId}/${formSubmitLabel}',value:Number(formData.amount),currency:'USD'});` : ''}

    const params = new URLSearchParams(window.location.search);
    const url = new URL('${redirectUrl !== '#' ? redirectUrl : `https://${domain}/apply`}');
    Object.entries(formData).forEach(([k, v]) => url.searchParams.set(k, v));
    ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'cpid', 'click_id'].forEach((k) => {
      const v = params.get(k);
      if (v) url.searchParams.set(k, v);
    });

    await new Promise((r) => setTimeout(r, 1500));
    window.location.href = url.toString();
  };

  const update = (field: string, value: string) => {
    setFormData((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
  };

  const inputCls = (field: string) =>
    \`w-full h-11 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all \${
      errors[field] ? 'border-destructive' : 'border-input'
    }\`;

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8 space-y-4 text-left">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">First Name</label>
          <input type="text" value={formData.firstName} onChange={(e) => update('firstName', e.target.value)} className={inputCls('firstName')} placeholder="John" />
          {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Last Name</label>
          <input type="text" value={formData.lastName} onChange={(e) => update('lastName', e.target.value)} className={inputCls('lastName')} placeholder="Smith" />
          {errors.lastName && <p className="text-xs text-destructive mt-1">{errors.lastName}</p>}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Email</label>
        <input type="email" value={formData.email} onChange={(e) => update('email', e.target.value)} className={inputCls('email')} placeholder="john@example.com" />
        {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Phone</label>
        <input type="tel" inputMode="numeric" value={formData.phone} onChange={(e) => update('phone', e.target.value.replace(/\\D/g, '').slice(0, 10))} className={inputCls('phone')} placeholder="5551234567" />
        {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">ZIP Code</label>
          <input type="text" inputMode="numeric" maxLength={5} value={formData.zip} onChange={(e) => update('zip', e.target.value.replace(/\\D/g, '').slice(0, 5))} className={inputCls('zip')} placeholder="90210" />
          {errors.zip && <p className="text-xs text-destructive mt-1">{errors.zip}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Loan Amount</label>
          <input type="text" inputMode="numeric" value={formData.amount} onChange={(e) => update('amount', e.target.value.replace(/\\D/g, ''))} className={inputCls('amount')} placeholder="2000" />
          {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
        </div>
      </div>
      <button type="submit" disabled={submitting} className="btn-cta w-full !mt-6 disabled:opacity-60">
        {submitting ? (
          <><svg className="w-5 h-5 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg><span>Finding your best rate...</span></>
        ) : (
          <><span>${cta}</span><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></>
        )}
      </button>
      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        By submitting, you agree to our <a href="/terms" className="underline hover:text-foreground">Terms</a> and <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>. Checking your rate won't affect your credit score.
      </p>
    </form>
  );
}`,

    'src/pages/index.astro': `---
import Layout from '../layouts/Layout.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import HeroFormStatic from '../components/HeroFormStatic.astro';
import CalcStatic from '../components/CalcStatic.astro';
import FAQStatic from '../components/FAQStatic.astro';
import Testimonials from '../components/Testimonials.astro';
---

<Layout>
  <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">
    Skip to content
  </a>
  <Header />
  <main id="main-content" class="pt-16">
    <!-- HERO -->
    <section id="apply" aria-label="Loan application" class="relative overflow-hidden text-white section-padding" style="background:linear-gradient(135deg,hsl(${primary}) 0%,hsl(${pH} ${pS}% ${Math.max(pL - 10, 10)}%) 100%)">
      <div class="absolute top-0 right-0 pointer-events-none" style="width:500px;height:500px;border-radius:50%;filter:blur(64px);background:rgba(255,255,255,0.05);transform:translate(25%,-50%);contain:strict"></div>
      <div class="absolute bottom-0 left-0 pointer-events-none" style="width:400px;height:400px;border-radius:50%;filter:blur(64px);background:hsl(15 92% 62% / 0.1);transform:translate(-25%,33%);contain:strict"></div>
      <div class="container relative z-10">
        <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div class="text-center lg:text-left">
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2)">
              <div class="w-2 h-2 rounded-full bg-secondary animate-pulse-soft"></div>
              <span class="text-sm font-medium text-white/90">${badge}</span>
            </div>
            <h1 class="text-4xl md:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] mb-6">${h1}<br/><span class="text-accent">${h1span}</span></h1>
            <p class="text-lg md:text-xl text-white/70 max-w-lg mx-auto lg:mx-0 mb-8">${sub}</p>
            <div class="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-3">
              <div class="flex items-center gap-2 text-sm text-white/70"><svg class="w-5 h-5 text-secondary" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg><span>All Credit Welcome</span></div>
              <div class="flex items-center gap-2 text-sm text-white/70"><svg class="w-5 h-5 text-secondary" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg><span>2-Minute Application</span></div>
              <div class="flex items-center gap-2 text-sm text-white/70"><svg class="w-5 h-5 text-secondary" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg><span>No Hidden Fees</span></div>
            </div>
          </div>
          <HeroFormStatic />
        </div>
      </div>
    </section>
    <!-- SOCIAL PROOF -->
    <section class="bg-card border-b border-border">
      <div class="container py-6">
        <div class="flex flex-wrap justify-center gap-x-8 gap-y-4 items-center">
          <div class="flex items-center gap-2">
            <div class="flex -space-x-2">
              <div class="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-bold text-muted-foreground">J</div>
              <div class="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-bold text-muted-foreground">M</div>
              <div class="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-bold text-muted-foreground">S</div>
              <div class="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-bold text-muted-foreground">K</div>
            </div>
            <span class="text-sm text-muted-foreground"><strong class="text-foreground">15,000+</strong> loans funded</span>
          </div>
          <div class="h-6 w-px bg-border hidden md:block"></div>
          <div class="flex items-center gap-1.5">
            <svg class="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            <svg class="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            <svg class="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            <svg class="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            <svg class="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            <span class="text-sm text-muted-foreground ml-1"><strong class="text-foreground">4.8/5</strong> rating</span>
          </div>
          <div class="h-6 w-px bg-border hidden md:block"></div>
          <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
            <svg class="w-4 h-4 text-secondary" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            <span><strong class="text-foreground">256-bit</strong> encryption</span>
          </div>
        </div>
      </div>
    </section>
    <!-- HOW IT WORKS -->
    <section id="how-it-works" role="region" aria-labelledby="how-it-works-heading" class="section-padding" style="background:linear-gradient(180deg,hsl(210 40% 98%) 0%,hsl(210 40% 96%) 100%)">
      <div class="container">
        <div class="text-center mb-12">
          <span class="inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider mb-4" style="background:hsl(${primary} / 0.05);color:hsl(${primary})">How It Works</span>
          <h2 id="how-it-works-heading" class="text-3xl md:text-4xl font-bold text-foreground mb-3">Get Funded in 3 Simple Steps</h2>
          <p class="text-muted-foreground max-w-xl mx-auto">No paperwork. No waiting in line. Everything happens online.</p>
        </div>
        <div class="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div class="card-elevated text-center">
            <div class="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style="background:hsl(${primary} / 0.1)"><svg class="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
            <div class="w-8 h-8 mx-auto -mt-8 mb-2 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shadow-md">1</div>
            <h3 class="text-lg font-bold text-foreground mb-2">Apply Online</h3>
            <p class="text-sm text-muted-foreground">Fill out our simple 2-minute form. No impact on your credit score.</p>
          </div>
          <div class="card-elevated text-center">
            <div class="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style="background:hsl(158 64% 42% / 0.1)"><svg class="w-7 h-7 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
            <div class="w-8 h-8 mx-auto -mt-8 mb-2 rounded-full bg-secondary text-white text-sm font-bold flex items-center justify-center shadow-md">2</div>
            <h3 class="text-lg font-bold text-foreground mb-2">Get Approved</h3>
            <p class="text-sm text-muted-foreground">Receive personalized loan offers from trusted lenders in seconds.</p>
          </div>
          <div class="card-elevated text-center">
            <div class="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style="background:hsl(15 92% 62% / 0.1)"><svg class="w-7 h-7 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
            <div class="w-8 h-8 mx-auto -mt-8 mb-2 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center shadow-md">3</div>
            <h3 class="text-lg font-bold text-foreground mb-2">Get Funded</h3>
            <p class="text-sm text-muted-foreground">Accept your offer and receive funds as fast as the next business day.</p>
          </div>
        </div>
      </div>
    </section>
    <!-- CALCULATOR -->
    <section id="calculator" role="region" aria-labelledby="calculator-heading" class="section-padding">
      <div class="container max-w-3xl">
        <div class="text-center mb-10">
          <span class="inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider mb-4" style="background:hsl(15 92% 62% / 0.05);color:hsl(15 92% 62%)">Payment Calculator</span>
          <h2 id="calculator-heading" class="text-3xl md:text-4xl font-bold text-foreground mb-3">Estimate Your Monthly Payment</h2>
          <p class="text-muted-foreground">See how affordable your loan could be.</p>
        </div>
        <CalcStatic />
      </div>
    </section>
    <!-- FEATURES -->
    <section id="features" role="region" aria-labelledby="features-heading" class="section-padding" style="background:linear-gradient(180deg,hsl(210 40% 98%) 0%,hsl(210 40% 96%) 100%)">
      <div class="container">
        <div class="text-center mb-12">
          <span class="inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider mb-4" style="background:hsl(158 64% 42% / 0.05);color:hsl(158 64% 42%)">Why ${brand}</span>
          <h2 id="features-heading" class="text-3xl md:text-4xl font-bold text-foreground">Built Around Trust</h2>
        </div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="card-elevated text-center"><div class="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style="background:hsl(${primary} / 0.1)"><svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><h3 class="font-bold text-foreground mb-1.5">Fast Decisions</h3><p class="text-sm text-muted-foreground">Get your decision in minutes, not days.</p></div>
          <div class="card-elevated text-center"><div class="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style="background:hsl(158 64% 42% / 0.1)"><svg class="w-6 h-6 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><h3 class="font-bold text-foreground mb-1.5">No Hidden Fees</h3><p class="text-sm text-muted-foreground">Transparent terms with clear pricing upfront.</p></div>
          <div class="card-elevated text-center"><div class="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style="background:hsl(15 92% 62% / 0.1)"><svg class="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><h3 class="font-bold text-foreground mb-1.5">All Credit Types</h3><p class="text-sm text-muted-foreground">Lenders who consider all credit histories.</p></div>
          <div class="card-elevated text-center"><div class="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style="background:hsl(${primary} / 0.1)"><svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div><h3 class="font-bold text-foreground mb-1.5">Direct Deposit</h3><p class="text-sm text-muted-foreground">Funds deposited straight to your bank account.</p></div>
        </div>
      </div>
    </section>
    <!-- TESTIMONIALS -->
    <section id="testimonials" role="region" aria-labelledby="testimonials-heading" class="section-padding">
      <div class="container">
        <div class="text-center mb-12">
          <span class="inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider mb-4" style="background:hsl(${primary} / 0.05);color:hsl(${primary})">Customer Stories</span>
          <h2 id="testimonials-heading" class="text-3xl md:text-4xl font-bold text-foreground mb-3">Trusted by Thousands</h2>
          <p class="text-muted-foreground max-w-xl mx-auto">See what our customers are saying about their experience.</p>
        </div>
        <Testimonials />
      </div>
    </section>
    <!-- FAQ -->
    <section id="faq" role="region" aria-labelledby="faq-heading" class="section-padding">
      <div class="container max-w-2xl">
        <div class="text-center mb-10">
          <span class="inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider mb-4" style="background:hsl(${primary} / 0.05);color:hsl(${primary})">FAQ</span>
          <h2 id="faq-heading" class="text-3xl md:text-4xl font-bold text-foreground mb-3">Common Questions</h2>
        </div>
        <FAQStatic />
      </div>
    </section>
    <!-- FINAL CTA -->
    <section class="section-padding relative overflow-hidden text-white" style="background:linear-gradient(135deg,hsl(${primary}) 0%,hsl(${pH} ${pS}% ${Math.max(pL - 10, 10)}%) 100%)">
      <div class="container relative z-10 text-center max-w-2xl">
        <h2 class="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
        <p class="text-lg text-white/70 mb-8">Join thousands who've found a smarter way to borrow.</p>
        <a href="#apply" class="btn-cta inline-flex text-xl !h-16 !px-10">${cta} Now <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a>
        <p class="text-sm text-white/50 mt-4">No impact on your credit score &bull; 100% free to check</p>
      </div>
    </section>
  </main>
  <Footer />
</Layout>`,

    'src/pages/apply.astro': `---
import Layout from '../layouts/Layout.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import EligibilityForm from '../components/EligibilityForm.tsx';
---

<Layout title="Apply - ${brand}">
  <Header />
  <main class="pt-16">
    <section class="min-h-[80vh] flex items-center justify-center section-padding" style="background:linear-gradient(180deg,hsl(210 40% 98%) 0%,hsl(210 40% 96%) 100%)">
      <div class="container max-w-lg text-center">
        <div class="mb-6">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4" style="background:hsl(158 64% 42% / 0.1);border:1px solid hsl(158 64% 42% / 0.2)">
            <svg class="w-4 h-4 text-secondary" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <span class="text-sm font-medium text-secondary">Soft credit check only</span>
          </div>
          <h1 class="text-2xl md:text-3xl font-bold text-foreground mb-2">Complete Your Application</h1>
          <p class="text-muted-foreground">Just a few more details to see your personalized rates.</p>
        </div>
        <EligibilityForm client:load />
      </div>
    </section>
  </main>
  <Footer />
</Layout>`,
  };
}
