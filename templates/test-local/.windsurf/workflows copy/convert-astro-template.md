## Goal
Convert any Astro landing page template so all hardcoded text/color values are replaced with `import.meta.env.PUBLIC_*` variables  making it compatible with the GitHub Actions deploy pipeline.



## Wizard Structure Mapping
This workflow must stay aligned with the actual `TemplateGeneratorModal` structure in the app.

### Mode selector
### Which Wizard mode to use
- Use `blank` when the Astro template is being created inside the system from the Wizard itself.
- Use `from-template` when starting from a template that already exists in the system.
- Use `from-zip` when the Astro template was created externally with tools like `bolt` and then packaged for import.
The wizard has 3 modes:
- `blank` = create a new Astro template from scratch
- `from-template` = clone from an existing template in the system
- `from-zip` = import a ZIP that contains template files

### Blank Canvas flow
The `blank` mode uses these steps:
1. `info` -> `StepTemplateInfo`
2. `design` -> `StepTemplateDesign`
3. `features` -> `StepTemplateFeatures`
4. `code` -> `StepTemplateCode`
5. `review` -> `StepTemplateReview`

In this mode, the generator should:
- collect template metadata from info/design/features steps
- generate Astro files in the code step
- validate Astro structure before entering review
- carry `generatedFiles`, `templateFormat`, and `templateValidation` into review

### Clone Template flow
The `from-template` mode uses these steps:
1. `from-dir` -> `StepTemplateFromDir`
2. `review` -> `StepTemplateReview`

In this mode, the wizard should preserve the imported template file map and pass it directly into review/save flow.

### ZIP Import flow
The `from-zip` mode uses these steps:
1. `from-zip` -> `StepTemplateFromZip`
2. `review` -> `StepTemplateReview`

In this mode, the wizard should:
- parse the ZIP
- normalize paths
- strip single-root wrapper folders if needed
- detect template format
- validate Astro structure
- pass `sourceCode`, `files`, `format`, and `validation` into review

### Wizard state fields
The workflow should stay aligned with these important wizard state fields:
- `mode`
- `step`
- `templateName`
- `templateDescription`
- `category`
- `badge`
- `newFolderId`
- `sourceTemplate`
- `colorId`
- `primaryColor`
- `accentColor`
- `fontId`
- `heroStyle`
- `layout`
- `hasHeroForm`
- `hasCalculator`
- `hasTestimonials`
- `hasFAQ`
- `hasTrustBadges`
- `hasDarkMode`
- `customCss`
- `customJs`
- `includeTracking`
- `templateFormat`
- `templateValidation`
- `generatedCode`
- `generatedFiles`

### Review step expectations
The workflow should assume that `StepTemplateReview` is the final checkpoint before save.
At this point the template should already have:
- `generatedCode`
- `generatedFiles`
- `templateFormat`
- `templateValidation`

The review step should be able to support:
- AI description generation
- final metadata edits
- save to DB
- Astro ZIP export when file map exists

### Save flow expectations
The wizard save flow should persist a template payload with:
- `name`
- `description`
- `category`
- `badge`
- `format`
- `sourceCode`
- `files`

This workflow must remain compatible with the actual Wizard structure above. If the Wizard step IDs, modes, or saved state shape change in code, this workflow should be updated too.

## Step 1: Read the target template file

Read `templates/{TEMPLATE_ID}/src/pages/index.astro` (or the file the user specifies).

## Step 2: Add variable declarations to frontmatter

At the very top of the `---` frontmatter block, add these lines (if not already present):

```astro
const brand          = import.meta.env.PUBLIC_BRAND          || 'Your Brand';
const domain         = import.meta.env.PUBLIC_DOMAIN         || 'example.com';
const h1             = import.meta.env.PUBLIC_H1             || 'Get Up to $5,000 Today';
const sub            = import.meta.env.PUBLIC_SUB            || 'Fast approval. No hard credit check.';
const cta            = import.meta.env.PUBLIC_CTA            || 'Apply Now';
const phone          = import.meta.env.PUBLIC_PHONE          || '';
const email          = import.meta.env.PUBLIC_EMAIL          || `support@${import.meta.env.PUBLIC_DOMAIN || 'example.com'}`;
const address        = import.meta.env.PUBLIC_ADDRESS        || '';
const aid            = import.meta.env.PUBLIC_AID            || '';
const amountMin      = import.meta.env.PUBLIC_AMOUNTMIN      || '100';
const amountMax      = import.meta.env.PUBLIC_AMOUNTMAX      || '5000';
const amountMinRaw   = String(Number((amountMin).replace(/[^0-9.]/g,'')) || 100);
const amountMaxRaw   = String(Number((amountMax).replace(/[^0-9.]/g,'')) || 5000);
const primaryColor   = import.meta.env.PUBLIC_PRIMARYCOLOR   || '#3b5bdb';
const accentColor    = import.meta.env.PUBLIC_ACCENTCOLOR    || '#f97316';
const aprMin         = import.meta.env.PUBLIC_APRMIN         || '5.99';
const aprMax         = import.meta.env.PUBLIC_APRMAX         || '35.99';
const conversionId      = import.meta.env.PUBLIC_CONVERSIONID      || '';
const formStartLabel    = import.meta.env.PUBLIC_FORMSTARTLABEL   || '';
const formSubmitLabel   = import.meta.env.PUBLIC_FORMSUBMITLABEL  || '';
const voluumId          = import.meta.env.PUBLIC_VOLUUMID          || '';
const voluumDomain      = import.meta.env.PUBLIC_VOLUUMDOMAIN      || '';
const voluumClickUrl    = import.meta.env.PUBLIC_VOLUUM_CLICK_URL  || '';
const ctaHref           = voluumClickUrl || '#apply';
const colorId           = import.meta.env.PUBLIC_COLORID           || 'ocean';
const fontId            = import.meta.env.PUBLIC_FONTID            || 'dm-sans';
const radiusId          = import.meta.env.PUBLIC_RADIUS            || 'rounded';
```

## Step 3: Replace hardcoded values in HTML

Make surgical replacements only — do NOT change layout, CSS structure, or component logic:

| What to replace | Replace with | Notes |
|---|---|---|
| Brand/site name | `{brand}` | |
| `<title>` text | `{brand} — ...` | |
| Hero h1 headline | `{h1}` | |
| Sub-headline / description | `{sub}` | |
| CTA button text | `{cta}` | |
| Dollar amount display | `${amountMax}` or `${amountMin}` | With $ prefix |
| Slider `min` attribute | `{amountMinRaw}` | Plain integer, no $ |
| Slider `max` attribute | `{amountMaxRaw}` | Plain integer, no $ |
| Phone number | `{phone}` | Wrap in `{phone && <a href={...}>{phone}</a>}` if needed |
| Email | `{email}` | |
| Affiliate ID / AID | `{aid}` | |
| Primary color (inline CSS) | `{primaryColor}` | e.g. `style={\`color: ${primaryColor}\`}` |
| Accent/button color | `{accentColor}` | |
| APR range | `{aprMin}% – {aprMax}%` | |

## Step 4: Handle `<style>` block colors

If the template uses hardcoded hex colors inside `<style>` tags, convert them to CSS custom properties injected via a `<style>` tag in the HTML section:

```astro
<style define:vars={{ primaryColor, accentColor }}>
  :root {
    --color-primary: var(--primaryColor);
    --color-accent: var(--accentColor);
  }
  /* rest of styles unchanged */
</style>
```

Or move color values to inline styles on the root element.

## Step 4b: Add design token CSS vars (colorId/fontId/radius)

If the template uses a `Layout.astro` file, add the color palette lookup table and inject CSS vars into `:root`. Use the COLORS/FONTS tables from `src/constants/index.js`:

```astro
---
// In Layout.astro frontmatter — add after existing env var declarations:
const COLOR_MAP = {
  ocean:    { p:[217,91,35],  s:[158,64,42],  a:[15,92,62],   bg:[210,40,98],  fg:[222,47,11] },
  forest:   { p:[152,68,28],  s:[45,93,47],   a:[350,80,55],  bg:[140,20,97],  fg:[150,40,10] },
  midnight: { p:[235,70,42],  s:[170,60,45],  a:[25,95,58],   bg:[230,25,97],  fg:[235,50,12] },
  ruby:     { p:[350,75,38],  s:[200,70,45],  a:[40,90,55],   bg:[350,15,97],  fg:[350,40,12] },
  slate:    { p:[215,25,35],  s:[160,50,42],  a:[15,85,55],   bg:[210,15,97],  fg:[215,30,12] },
  coral:    { p:[12,76,42],   s:[185,60,40],  a:[265,65,55],  bg:[20,30,97],   fg:[15,40,12]  },
  teal:     { p:[180,65,30],  s:[280,55,55],  a:[35,90,55],   bg:[175,20,97],  fg:[180,40,10] },
  plum:     { p:[270,55,40],  s:[150,55,42],  a:[20,88,58],   bg:[270,15,97],  fg:[270,40,12] },
};
const FONT_MAP = {
  'dm-sans':       { import: 'DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700', family: '"DM Sans", system-ui, sans-serif' },
  'plus-jakarta':  { import: 'Plus+Jakarta+Sans:wght@400;600;700',               family: '"Plus Jakarta Sans", system-ui, sans-serif' },
  'outfit':        { import: 'Outfit:wght@400;500;600;700',                       family: '"Outfit", system-ui, sans-serif' },
  'manrope':       { import: 'Manrope:wght@400;500;600;700',                      family: '"Manrope", system-ui, sans-serif' },
  'inter':         { import: 'Inter:wght@400;500;600;700',                        family: '"Inter", system-ui, sans-serif' },
  'sora':          { import: 'Sora:wght@400;500;600;700',                        family: '"Sora", system-ui, sans-serif' },
  'figtree':       { import: 'Figtree:wght@400;500;600;700',                      family: '"Figtree", system-ui, sans-serif' },
  'space-grotesk': { import: 'Space+Grotesk:wght@400;500;600;700',               family: '"Space Grotesk", system-ui, sans-serif' },
};
const RADIUS_MAP = { sharp:'0rem', subtle:'0.375rem', rounded:'0.75rem', pill:'1.5rem' };
const pal  = colorId === 'custom' ? null : (COLOR_MAP[colorId] || COLOR_MAP['ocean']);
// When colorId === 'custom': use primaryColor/accentColor hex directly (set by wizard Custom picker)
// When preset: derive from COLOR_MAP HSL values as usual
const hsl  = (h,s,l) => `${h} ${s}% ${l}%`;
// colorId === "custom": inject hex vars; preset: use HSL from COLOR_MAP
const cssVars = pal
  ? `--primary:${hsl(...pal.p)};--secondary:${hsl(...pal.s)};--accent:${hsl(...pal.a)};--background:${hsl(...pal.bg)};--foreground:${hsl(...pal.fg)};--radius:${rad};`
  : `--primary-custom:${primaryColor};--accent-custom:${accentColor};--radius:${rad};`;
---

<!-- In HTML <head> — replace font link + body style: -->
<link href={`https://fonts.googleapis.com/css2?family=${font.import}&display=swap`} rel="stylesheet" media="print" onload="this.media='all'" />
<style is:inline set:html={`:root { ${cssVars} } body { font-family: ${font.family}; }`}></style>
```

## Step 4c: Add tracking scripts (Google Ads + Voluum)

> ⚠️ **Cloudflare Rocket Loader** changes `type` on every `<script>` tag to `type="xxxx-text/javascript"`, breaking execution. **ALL** `<script is:inline>` tags MUST have `data-cfasync="false"`.

> ⚠️ **`Fragment set:html` in `<head>`** — Astro sanitizes `<script>` tags inside `set:html` in head context. Use direct conditional `{condition && <script is:inline ...>}` instead.

In `Layout.astro` `<head>`, add:

```astro
{conversionId && (
  <script data-cfasync="false" async src={`https://www.googletagmanager.com/gtag/js?id=${conversionId}`} is:inline></script>
)}
{conversionId && (
  <script data-cfasync="false" is:inline define:vars={{ conversionId, formStartLabel, formSubmitLabel }}>
    (function(){
      function gtag(){window.dataLayer=window.dataLayer||[];window.dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', conversionId);
      window.__gtagConversionId = conversionId;
      window.__formStartLabel   = formStartLabel;
      window.__formSubmitLabel  = formSubmitLabel;
    })();
  </script>
)}

{/* Voluum — use dtpCallback (NOT vp.js — vp.js does NOT handle click_id/cookies/cep) */}
{voluumDomain && <meta http-equiv="delegate-ch" content={`sec-ch-ua https://${voluumDomain}; sec-ch-ua-mobile https://${voluumDomain}; sec-ch-ua-arch https://${voluumDomain}; sec-ch-ua-model https://${voluumDomain}; sec-ch-ua-platform https://${voluumDomain}; sec-ch-ua-platform-version https://${voluumDomain}; sec-ch-ua-bitness https://${voluumDomain}; sec-ch-ua-full-version-list https://${voluumDomain}; sec-ch-ua-full-version https://${voluumDomain}`} />}
{voluumDomain && <style is:inline>{`.dtpcnt{opacity:0;}`}</style>}
{voluumDomain && (
  <script data-cfasync="false" is:inline define:vars={{ voluumDomain }}>
  (function(e,d,k,n,u,v,g,w,C,f,p,x,D,c,q,r,h,t,y,G,z){function A(){for(var a=d.querySelectorAll(".dtpcnt"),b=0,l=a.length;b<l;b++)a[b][w]=a[b][w].replace(/(^|\s+)dtpcnt($|\s+)/g,"")}function E(a,b,l,F){var m=new Date;m.setTime(m.getTime()+(F||864E5));d.cookie=a+"="+b+"; "+l+"samesite=Strict; expires="+m.toGMTString()+"; path=/";k.setItem(a,b);k.setItem(a+"-expires",m.getTime())}function B(a){var b=d.cookie.match(new RegExp("(^| )"+a+"=([^;]+)"));return b?b.pop():k.getItem(a+"-expires")&&+k.getItem(a+"-expires")>(new Date).getTime()?k.getItem(a):null}z="https:"===e.location.protocol?"secure; ":"";e[f]||(e[f]=function(){(e[f].q=e[f].q||[]).push(arguments)},r=d[u],d[u]=function(){r&&r.apply(this,arguments);if(e[f]&&!e[f].hasOwnProperty("params")&&/loaded|interactive|complete/.test(d.readyState))for(;c=d[v][p++];)/\/?click\/?($|(\/[0-9]+)?$)/.test(c.pathname)&&(c[g]="javascrip"+e.postMessage.toString().slice(4,5)+":"+f+'.l="'+c[g]+'",void 0')},setTimeout(function(){(t=RegExp("[?&]cpid(=([^&#]*)|&|#|$)").exec(e.location.href))&&t[2]&&(h=t[2],y=B("vl-"+h));var a=B("vl-cep"),b=location[g];if("savedCep"===D&&a&&(!h||"undefined"===typeof h)&&0>b.indexOf("cep=")){var l=-1<b.indexOf("?")?"&":"?";b+=l+a}c=d.createElement("script");q=d.scripts[0];c.defer=1;c.src="https://"+voluumDomain+"/d/.js?lpref="+n(d.referrer)+"&lpurl="+n(b)+"&lpt="+n(d.title)+"&vtm="+(new Date).getTime()+(y?"&uw=no":"");c[C]=function(){for(p=0;c=d[v][p++];)/dtpCallback\.l/.test(c[g])&&(c[g]=decodeURIComponent(c[g]).match(/dtpCallback\.l="([^"]+)/)[1]);A()};q.parentNode.insertBefore(c,q);h&&E("vl-"+h,"1",z)},0),setTimeout(A,7E3))})(window,document,localStorage,encodeURIComponent,"onreadystatechange","links","href","className","onerror","dtpCallback",0,0,"savedCep");
  </script>
)}
{voluumDomain && (
  <noscript><link href={`https://${voluumDomain}/d/.js?noscript=true&lpurl=`} rel="stylesheet"/></noscript>
)}
```

Also add `data-cfasync="false"` to ALL other `<script is:inline>` tags in:
- `Layout.astro` body scripts (fpPixel, etc.)
- `index.astro` (form submit handler)
- All components: `StickyMobileCta.astro`, `LegalModal.astro`, `LoanCalculator.astro`, etc.

**Required env vars in `deploy-lp.yml`** — verify these lines exist in the `.env` writer step:
```js
'PUBLIC_FORMSTARTLABEL='  + JSON.stringify(c.gtagFormStartLabel||c.formStartLabel||''),
'PUBLIC_FORMSUBMITLABEL=' + JSON.stringify(c.gtagFormSubmitLabel||c.formSubmitLabel||''),
'PUBLIC_VOLUUMDOMAIN='    + JSON.stringify(c.voluumDomain||''),
'PUBLIC_VOLUUM_CLICK_URL='+ JSON.stringify(c.voluumClickUrl||''),
```

**`voluumDomain` default** — set to `''` not `'track.vlm.icu'` to avoid rendering Voluum script for sites that don't use Voluum:
```astro
const voluumDomain = import.meta.env.PUBLIC_VOLUUMDOMAIN || '';
```

## Step 4c-ii: Form submit CTA redirect to Voluum

The ZIP form submit script in `index.astro` MUST redirect to `ctaHref` (Voluum URL), not hardcoded `/apply`. Use `define:vars` to inject:

```astro
<script data-cfasync="false" is:inline define:vars={{ ctaHref }}>
  (() => {
    // ... form validation logic ...
    form.addEventListener("submit", (event) => {
      // ... validation ...
      const current = new URLSearchParams(window.location.search);
      current.set("zip", zip);
      // ✅ redirect to Voluum if configured, else /apply
      const dest = ctaHref && ctaHref !== '#apply'
        ? ctaHref + (ctaHref.includes('?') ? '&' : '?') + current.toString()
        : `/apply?${current.toString()}`;
      window.location.assign(dest);
    });
  })();
</script>
```

## Step 4d: Add First-Party Pixel (pixel worker endpoint + GET beacon)

**Architecture rule (permanent):** Pixel events always go to `https://t.{domain}/e` (Cloudflare Worker), NOT to `/e` on the apex/www host. The apex `/e` returns 404 on static deploys (Cloudflare Pages, Netlify). The `src/pages/e.ts` file is kept as a dev-only fallback only.

**1. Create `src/pages/e.ts`** in the template (dev fallback only — not used in production):

```typescript
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.text();
    const payload = JSON.parse(body);
    console.log('[pixel]', payload);
  } catch (_) {}
  return new Response(null, { status: 204 });
};

export const GET: APIRoute = () => {
  return new Response(null, { status: 204 });
};
```

**2. Add pixel GET beacon block in `Layout.astro` body** (before scroll/time tracking):

```astro
<!-- First-Party Pixel: GET beacon to t.{domain}/e (pixel worker) -->
<script is:inline>
(function(){
  var PX_ENDPOINT = 'https://t.' + window.location.hostname + '/e';
  function sendPixelBeacon(payload) {
    try {
      var q = new URLSearchParams();
      Object.keys(payload || {}).forEach(function(k){
        var v = payload[k];
        if (v !== undefined && v !== null) q.set(k, String(v));
      });
      var i = new Image(1, 1);
      i.src = PX_ENDPOINT + '?' + q.toString();
    } catch(_) {}
  }
  function fpPixel(eventName, extra) {
    var payload = Object.assign({ e: eventName, d: window.location.hostname, ts: Date.now() }, extra || {});
    sendPixelBeacon(payload);
  }
  if (!window.__fpPageTracked) {
    window.__fpPageTracked = true;
    fpPixel('pv');
  }
  window.__fpPixel = fpPixel;
})();
</script>
```

> **Why GET beacon, not `navigator.sendBeacon` or `fetch`?**
> `sendBeacon('/e', ...)` and `fetch('/e', ...)` both fail on apex/www static hosts (404/405).
> An `<img src="https://t.{domain}/e?...">` GET fires cross-origin without CORS, is fire-and-forget, and is handled by the Cloudflare Worker at `t.{domain}/*`.

**3. In form submit handler**, fire `fpPixel` and gtag conversion label:

```js
// After dataLayer.push({ event: 'form_start', ... })
try {
  var cid = window.__gtagConversionId;
  var lbl = window.__formStartLabel;
  if (cid && lbl && typeof gtag === 'function') {
    gtag('event', 'conversion', { send_to: cid + '/' + lbl, value: amount, currency: 'USD' });
  }
} catch(_) {}
if (typeof window.__fpPixel === 'function') { window.__fpPixel('form_start', { amount: amount }); }
```

**4. Pixel infrastructure required per domain (auto-provisioned on deploy):**

Cloudflare must have for each domain:
- DNS A record: `t.{domain}` → `192.0.2.1` (Proxied = ON)
- Workers Route: `t.{domain}/*`  `lp-factory-pixel` worker script

Both are automatically provisioned by `ensurePixelSubdomain()` on every Cloudflare Pages deploy.
After deploy, the system health-checks `https://t.{domain}/e` — if non-2xx, a warning is shown in the wizard.

## Step 4e: CTA buttons — use `ctaHref`

All CTA `<a>` buttons (hero + final CTA section) must use `{ctaHref}` not hard-coded `#apply`:

```astro
<a href={ctaHref} class="btn-cta ...">{cta}</a>
```

`ctaHref = voluumClickUrl || '#apply'` — when `PUBLIC_VOLUUM_CLICK_URL` is set, clicks go to Voluum; otherwise scroll to `#apply`.

## Step 5: Verify

Check that:
- `---` frontmatter block opens and closes correctly
- All `{variable}` expressions are inside JSX/HTML (not inside `---`)
- No bare `$` without a variable (e.g. `$5,000` should be `${amountMax}`)
- `amountMinRaw` / `amountMaxRaw` used for HTML `min=` / `max=` attributes
- `amountMin` / `amountMax` used for display text (may have commas)

## Step 6: Add tsconfig.json if missing

If `templates/{TEMPLATE_ID}/tsconfig.json` does not exist, create it:

```json
{
  "extends": "astro/tsconfigs/base"
}
```

## Step 7: Inject reviews into template (if template has testimonials section)

If the template has a hardcoded testimonials/reviews section, replace it with dynamic reviews from `PUBLIC_REVIEWS` env var:

```astro
---
// In Layout.astro or index.astro frontmatter:
const reviewsRaw = import.meta.env.PUBLIC_REVIEWS || '[]';
let reviews = [];
try { reviews = JSON.parse(reviewsRaw); } catch (_) {}
---

<!-- In HTML — replace hardcoded review cards: -->
{reviews.length > 0 && reviews.map((r) => (
  <div class="review-card">
    <div class="reviewer">{r.name} — {r.location}</div>
    <p>"{r.text}"</p>
    <div class="stars">{"★".repeat(r.rating || 5)} {r.rating || 5}.0</div>
  </div>
))}
```

The workflow injects `PUBLIC_REVIEWS` as a JSON string from the deploy config `reviews` array (generated by the **✨ Gen Reviews** button in Wizard Step 5 → Copy).

## Step 8: Create apply.astro (LeadsGate form — standalone, no layout)

Create `templates/{TEMPLATE_ID}/src/pages/apply.astro` with ONLY the LeadsGate form. No header, no footer, no nav, no Layout wrapper — just the bare form page.

**LeadsGate has no installable SDK.** The form is loaded by setting `window._lg_form_init_` config object then injecting `https://apikeep.com/form/applicationInit.js` via `document.createElement('script')`. The script auto-renders into `<div id="_lg_form_">`.

> ⚠️ **LeadsGate NEW hooks API (updated Mar 8, 2026)** — callbacks ต้องอยู่ใน `hooks: {}` object ไม่ใช่ top-level
> - `hooks.onFormLoad()` — form mounted
> - `hooks.onStepChange(data)` → `data.step`
> - `hooks.onSubmit()` — form submitted
> - `hooks.onLeadSold(data)` → `data.leadId`, `data.price` — approved lead
> - `hooks.onLeadRejected(data)` → `data.leadId`, `data.price` — declined lead
> - `hooks.onLeadFinished(data)` → `data.leadId`, `data.price` — pending/new lead

Replace `AID_HERE` with `import.meta.env.PUBLIC_AID`.

```astro
---
const aid = import.meta.env.PUBLIC_AID || '';
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Apply</title>
  <link rel="dns-prefetch" href="//apikeep.com" />
  <style>html,body{height:100%;min-height:100vh;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}body{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:24px 16px 48px;}#_lg_form_{width:100%;max-width:640px;}</style>
</head>
<body>
<script data-cfasync="false">
window.dataLayer = window.dataLayer || [];

function fpPixel(eventName, extra) {
  try {
    var endpoint = 'https://t.' + window.location.hostname + '/e';
    var payload = Object.assign({ e: eventName, d: window.location.hostname, ts: Math.floor(Date.now()/1000) }, extra || {});
    navigator.sendBeacon(endpoint, JSON.stringify(payload));
  } catch(_) {}
}

var SafeStorage = {
  _mem: {},
  set: function(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { this._mem[k] = v; } },
  get: function(k) { try { return sessionStorage.getItem(k); } catch (e) { return this._mem[k] || null; } }
};

function getCookie(name) {
  var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match.pop() : null;
}

function getVoluumClickId() {
  var urlParams = new URLSearchParams(window.location.search);
  // clickid = actual Voluum click ID passed on redirect from Voluum CTA
  // vlcid = set by dtpCallback; cid/click_id = legacy; cpid = campaign ID fallback
  var fromUrl = urlParams.get('vlcid') || urlParams.get('clickid') || urlParams.get('cid') || urlParams.get('click_id') || '';
  var fromStorage = SafeStorage.get('vlcid') || SafeStorage.get('voluum_cid') || '';
  var fromCookie = getCookie('vlcid') || '';
  var cpid = urlParams.get('cpid') || '';
  return fromUrl || fromStorage || fromCookie || cpid || '';
}

var _lg_form_init_ = {
  aid: "${aid}",
  template: "fresh",
  ref: window.location.hostname,
  click_id: getVoluumClickId(),

  hooks: {
    onFormLoad: function() {
      var cid = getVoluumClickId();
      fpPixel('lg_form_load', { click_id: cid });
      window.dataLayer.push({ 'event': 'leadsgate_form_start', 'clickId': cid, 'timestamp': new Date().toISOString() });
    },

    onStepChange: function(data) {
      var cid = getVoluumClickId();
      var step = data && data.step ? data.step : data;
      fpPixel('lg_step', { step: step, click_id: cid });
      window.dataLayer.push({ 'event': 'leadsgate_form_progress', 'step': step, 'clickId': cid });
    },

    onSubmit: function() {
      var cid = getVoluumClickId();
      fpPixel('lg_submit', { click_id: cid });
      window.dataLayer.push({ 'event': 'leadsgate_form_submit', 'clickId': cid, 'timestamp': new Date().toISOString() });
    },

    onLeadSold: function(data) {
      var cid = getVoluumClickId();
      var leadId = data && data.leadId;
      var payout = (data && data.price) || 50.00;
      fpPixel('lg_success', { click_id: cid, lead_id: leadId, status: 'approved', payout: payout });
      window.dataLayer.push({ 'event': 'lead_conversion_approved', 'transactionId': leadId, 'conversionValue': payout, 'clickId': cid });
      window.dataLayer.push({ 'event': 'lead_conversion_all', 'leadStatus': 'approved', 'transactionId': leadId, 'conversionValue': payout, 'clickId': cid });
    },

    onLeadRejected: function(data) {
      var cid = getVoluumClickId();
      var leadId = data && data.leadId;
      var payout = (data && data.price) || 5.00;
      fpPixel('lg_success', { click_id: cid, lead_id: leadId, status: 'declined', payout: payout });
      window.dataLayer.push({ 'event': 'lead_declined', 'transactionId': leadId, 'conversionValue': payout, 'clickId': cid });
      window.dataLayer.push({ 'event': 'lead_conversion_all', 'leadStatus': 'declined', 'transactionId': leadId, 'conversionValue': payout, 'clickId': cid });
    },

    onLeadFinished: function(data) {
      var cid = getVoluumClickId();
      var leadId = data && data.leadId;
      var payout = (data && data.price) || 0;
      fpPixel('lg_finished', { click_id: cid, lead_id: leadId, payout: payout });
      window.dataLayer.push({ 'event': 'lead_pending', 'transactionId': leadId, 'conversionValue': payout, 'clickId': cid });
      window.dataLayer.push({ 'event': 'lead_conversion_all', 'leadStatus': 'pending', 'transactionId': leadId, 'conversionValue': payout, 'clickId': cid });
    }
  }
};

// Fire pv on apply page load
(function() {
  var p = new URLSearchParams(window.location.search);
  var cid = p.get('clickid') || p.get('vlcid') || p.get('click_id') || p.get('cid') || p.get('cpid') || '';
  fpPixel('pv', cid ? { click_id: cid } : {});

  // MutationObserver fallback: fire lg_form_load when LeadsGate mounts the form
  // (in case hooks.onFormLoad fires before our object is read)
  var formLoadFired = false;
  var lgDiv = document.getElementById('_lg_form_');
  if (lgDiv) {
    var obs = new MutationObserver(function() {
      if (!formLoadFired && lgDiv.children.length > 0) {
        formLoadFired = true;
        obs.disconnect();
        fpPixel('lg_form_load', { click_id: getVoluumClickId(), source: 'observer' });
      }
    });
    obs.observe(lgDiv, { childList: true, subtree: true });
    setTimeout(function() {
      if (!formLoadFired) { formLoadFired = true; obs.disconnect(); fpPixel('lg_form_load', { click_id: getVoluumClickId(), source: 'timeout' }); }
    }, 10000);
  }
})();

var script = document.createElement('script');
script.setAttribute('data-cfasync', 'false');
script.type = 'text/javascript';
script.async = true;
script.src = 'https://apikeep.com/form/applicationInit.js';
document.body.appendChild(script);
</script>

<div id="_lg_form_"></div>
</body>
</html>
```

### Rules for apply.astro
- **No** `<Layout>`, header, footer, navigation — form only
- `_lg_form_init_` must be `var` (not `const`) for global scope
- Callbacks MUST be inside `hooks: {}` — **not** top-level (new LeadsGate API)
- `getVoluumClickId()` reads: `vlcid` → `clickid` → `cid` → `click_id` → `cpid` (in priority order)
- `clickid` (no underscore) = actual Voluum click_id passed via redirect URL
- Container `<div id="_lg_form_"></div>` must exist in DOM before script runs
- `data-cfasync="false"` on ALL `<script>` tags to bypass Cloudflare Rocket Loader
- SDK URL: `https://apikeep.com/form/applicationInit.js`
- `PUBLIC_AID` is injected by CI build from deploy config `aid` field

## Step 9: Pre-deploy checklist — verify all tracking is wired

Before triggering deploy, confirm ALL of these are in the template:

| # | Check | File |
|---|---|---|
| 1 | `PUBLIC_FORMSTARTLABEL` + `PUBLIC_FORMSUBMITLABEL` declared | `Layout.astro` frontmatter |
| 2 | `window.__formStartLabel` / `window.__formSubmitLabel` exposed | `Layout.astro` gtag script |
| 3 | `src/pages/e.ts` exists (returns 204) | `src/pages/e.ts` |
| 4 | Pixel beacon uses `PX_ENDPOINT = 'https://t.' + hostname + '/e'` (NOT `/e` apex) | `Layout.astro` body |
| 5 | `window.__fpPixel = fpPixel` exposed globally | `Layout.astro` body |
| 6 | Form submit fires `gtag conversion` + `__fpPixel('form_start')` | `HeroFormStatic.astro` or form component |
| 7 | `voluumClickUrl` / `ctaHref` declared + used in all CTA `<a>` | `index.astro` |
| 8 | `PUBLIC_FORMSTARTLABEL`, `PUBLIC_FORMSUBMITLABEL`, `PUBLIC_VOLUUM_CLICK_URL` in `deploy-lp.yml` | `.github/workflows/deploy-lp.yml` |
| 9 | `robots.txt.ts` API route exists (not static `robots.txt`) | `src/pages/robots.txt.ts` |
| 10 | `public/_headers` security headers file exists | `public/_headers` |

**Tracking Test should show green for:**
- Google Ads: gtag.js loaded, Config initialized, Conversion ID set, form_start/form_submit labels present
- First-Party Pixel: Pixel Function Initialized, `t.{domain}/e` GET beacon fires on page load
- Voluum: Lander Script, Domain, Click URL in CTA
- URL Params: GCLID capture, Click ID, UTM
- Micro-conversions: form_start fires once, Amount Slider, ZIP Input

**Post-deploy pixel health gate:** After every Cloudflare Pages deploy, the system auto-pings `https://t.{domain}/e`. A warning is shown in the wizard if it returns non-2xx. If you see this warning, check that Cloudflare Workers Route `t.{domain}/*` → pixel worker exists.

## Notes
- This workflow modifies `index.astro`, `apply.astro`, `Layout.astro`, adds `src/pages/e.ts`, `src/pages/robots.txt.ts`, `public/_headers`
- Do NOT modify `astro.config.mjs`, `package.json`, or any other files
- Do NOT add React or any new dependencies
- The deploy pipeline (GitHub Actions) injects all PUBLIC_* values via `.env` before `npm run build`
- **Gen Reviews** button in Wizard → Step 5 (Copy) generates 3 unique category-aware reviews via Gemini — regenerate anytime before deploy
- **Voluum CTA**: always use `ctaHref = voluumClickUrl || '#apply'` — never hardcode `#apply` in CTA buttons

## Preview Compatibility Rules (Wizard Live Preview)

The wizard renders a live HTML preview of the template using `astroToHtmlPreview()`. For the preview to work correctly:

1. **All content variables MUST use `import.meta.env.PUBLIC_*`** in frontmatter — NOT hardcoded strings.
   ```astro
   const h1 = import.meta.env.PUBLIC_H1 || 'Your Headline';  ✅
   const h1 = 'Your Headline';                               ❌ (preview will be blank)
   ```

2. **All colors MUST use CSS custom properties** (`var(--primary)`, `var(--accent)`, `var(--background)`) — NOT hardcoded hex/hsl values in inline styles.
   ```astro
   style="background: hsl(var(--primary))"   ✅  (responds to Color Scheme picker)
   style="background: hsl(0 65% 32%)"        ❌  (ignores Color Scheme picker)
   ```

3. **CSS `--primary`, `--accent`, `--secondary`, `--background`, `--foreground`, `--radius`** must be declared in `:root` in `global.css` using space-separated HSL values (shadcn convention: `--primary: 217 91% 35%`).

4. **Font**: declare `font-family` on `body` using `var(--font-family)` or set it from `PUBLIC_FONTID`. The preview injector overrides `body { font-family: ... !important }` based on the wizard's Font selection.

The preview engine auto-substitutes all `{varName}` expressions where `varName` was declared from `import.meta.env.PUBLIC_*` in any `.astro` file in the template bundle.




