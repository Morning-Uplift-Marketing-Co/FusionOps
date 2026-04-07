import { c as createComponent, m as maybeRenderHead, a as renderTemplate, r as renderComponent, f as renderSlot, g as renderHead, d as defineScriptVars, u as unescapeHTML, b as addAttribute, e as createAstro } from './astro/server.CAOn7qq1.js';
import 'kleur/colors';
/* empty css                        */
import 'clsx';

const $$ConsentBanner = createComponent(($$result, $$props, $$slots) => {
  const brand = "We";
  return renderTemplate`${maybeRenderHead()}<div id="consent-banner" role="dialog" aria-label="Cookie consent" aria-live="polite" class="consent-banner fixed bottom-0 left-0 right-0 z-[300] px-4 py-4 md:px-6 md:py-5 border-t border-border/60" style="display:none;" data-astro-cid-2effgw6e> <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between" data-astro-cid-2effgw6e> <div class="flex items-start gap-3 flex-1 min-w-0" data-astro-cid-2effgw6e> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="hsl(170 51% 40%)" stroke-width="2" stroke-linecap="round" class="flex-shrink-0 mt-0.5" aria-hidden="true" data-astro-cid-2effgw6e> <circle cx="12" cy="12" r="10" data-astro-cid-2effgw6e></circle><path d="M12 8v4" data-astro-cid-2effgw6e></path><path d="M12 16h.01" data-astro-cid-2effgw6e></path> </svg> <p class="text-foreground/70 text-xs leading-relaxed" data-astro-cid-2effgw6e> ${brand} uses cookies and Google Analytics to measure site performance and improve your experience. Your data is never sold.
<button data-popup="Privacy Policy" class="underline hover:text-foreground/90 transition-colors ml-1" data-astro-cid-2effgw6e>Privacy Policy</button> </p> </div> <div class="flex items-center gap-2 flex-shrink-0" data-astro-cid-2effgw6e> <button id="consent-reject" class="px-4 py-2 rounded-lg text-xs font-semibold text-foreground/60 hover:text-foreground/80 border border-border hover:border-border/80 transition-colors" data-astro-cid-2effgw6e>
Decline
</button> <button id="consent-accept" class="px-5 py-2 rounded-lg text-xs font-semibold text-white transition-colors" style="background: hsl(170 51% 40%);" data-astro-cid-2effgw6e>
Accept All
</button> </div> </div> </div>  `;
}, "/home/project/src/components/ConsentBanner.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Astro = createAstro();
const $$Layout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Layout;
  const brand = "${brand}";
  const conversionId = "${conversionId}";
  const siteUrl = "${siteUrl}";
  const aprMin = "5.99";
  const aprMax = "34.99";
  const amtMin = "200";
  const amtMax = "5000";
  const phone = "";
  const email = "";
  const {
    title = `${brand} — Fixed-Rate Installment Loans Up to $5,000`,
    description = `Compare fixed-rate installment loan offers from $500 to $5,000. Rates from ${"5.99"}% APR. Soft credit check only — no impact to your score. Funds deposited as fast as the next business day.`,
    ogTitle = title,
    ogDescription = `Need up to $5,000 with a payment you can plan around? Check your rate in 3 minutes. Fixed monthly payments, no prepayment penalty, and funds arrive fast.`,
    ogImage = `${siteUrl}/og.png`
  } = Astro2.props;
  const canonicalUrl = siteUrl;
  return renderTemplate(_a || (_a = __template(['<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>', '</title><meta name="description"', '><link rel="canonical"', '><meta property="og:type" content="website"><meta property="og:site_name"', '><meta property="og:url"', '><meta property="og:title"', '><meta property="og:description"', '><meta property="og:image"', '><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title"', '><meta name="twitter:description"', '><meta name="twitter:image"', `><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="apple-touch-icon" href="/favicon.svg"><!-- Critical resource hints --><link rel="dns-prefetch" href="https://www.googletagmanager.com"><link rel="dns-prefetch" href="https://bolt.new"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><!-- Preload critical static assets --><link rel="preload" href="/zip-cities.json" as="fetch" type="application/json" crossorigin><!-- Optimized font loading with font-display swap --><link rel="preload" as="style" fetchpriority="high" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap" media="print" onload="this.media='all'">`, '<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap"></noscript><script type="application/ld+json">', "</script><script>(function(){", "\n    window.dataLayer = window.dataLayer || [];\n    function gtag(){dataLayer.push(arguments);}\n    gtag('consent', 'default', {\n      'ad_storage': 'denied',\n      'ad_user_data': 'denied',\n      'ad_personalization': 'denied',\n      'analytics_storage': 'denied',\n      'wait_for_update': 500\n    });\n    (window.requestIdleCallback || function(cb){ setTimeout(cb, 1); })(function() {\n      var s = document.createElement('script');\n      s.async = true;\n      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + conversionId;\n      s.onload = function() {\n        gtag('js', new Date());\n        gtag('config', conversionId);\n      };\n      document.head.appendChild(s);\n    });\n  })();</script>", '</head> <body class="bg-background text-foreground antialiased"> ', " ", " </body></html>"])), title, addAttribute(description, "content"), addAttribute(canonicalUrl, "href"), addAttribute(brand, "content"), addAttribute(canonicalUrl, "content"), addAttribute(ogTitle, "content"), addAttribute(ogDescription, "content"), addAttribute(ogImage, "content"), addAttribute(ogTitle, "content"), addAttribute(ogDescription, "content"), addAttribute(ogImage, "content"), maybeRenderHead(), unescapeHTML(JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": brand,
      "url": siteUrl,
      "telephone": phone,
      "email": email,
      "sameAs": [siteUrl]
    },
    {
      "@context": "https://schema.org",
      "@type": "LoanOrCredit",
      "name": `${brand} Veterinary Installment Loan`,
      "loanTerm": { "@type": "QuantitativeValue", "minValue": 2, "maxValue": 60, "unitCode": "MON" },
      "amount": { "@type": "MonetaryAmount", "minValue": amtMin, "maxValue": amtMax, "currency": "USD" },
      "annualPercentageRate": { "@type": "QuantitativeValue", "minValue": aprMin, "maxValue": aprMax },
      "provider": { "@type": "Organization", "name": brand, "url": siteUrl }
    }
  ])), defineScriptVars({ conversionId }), renderHead(), renderSlot($$result, $$slots["default"]), renderComponent($$result, "ConsentBanner", $$ConsentBanner, {}));
}, "/home/project/src/layouts/Layout.astro", void 0);

export { $$Layout as $ };
