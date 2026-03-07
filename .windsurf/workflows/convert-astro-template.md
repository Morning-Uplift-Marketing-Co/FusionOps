---
description: Convert existing Astro template to accept dynamic variables from Wizard (import.meta.env.PUBLIC_*)
---

## Goal
Convert any Astro landing page template so all hardcoded text/color values are replaced with `import.meta.env.PUBLIC_*` variables — making it compatible with the GitHub Actions deploy pipeline.

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
const conversionId   = import.meta.env.PUBLIC_CONVERSIONID   || '';
const voluumId       = import.meta.env.PUBLIC_VOLUUMID       || '';
const voluumDomain   = import.meta.env.PUBLIC_VOLUUMDOMAIN   || 'track.vlm.icu';
const colorId        = import.meta.env.PUBLIC_COLORID        || 'ocean';
const fontId         = import.meta.env.PUBLIC_FONTID         || 'dm-sans';
const radiusId       = import.meta.env.PUBLIC_RADIUS         || 'rounded';
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
  ruby:     { p:[350,72,42],  s:[25,90,55],   a:[200,75,45],  bg:[350,20,97],  fg:[350,45,12] },
  slate:    { p:[215,25,35],  s:[160,55,42],  a:[25,88,58],   bg:[215,15,97],  fg:[215,30,12] },
  coral:    { p:[16,80,50],   s:[195,65,42],  a:[280,55,55],  bg:[16,30,97],   fg:[16,50,12]  },
  teal:     { p:[175,65,38],  s:[280,55,48],  a:[35,90,55],   bg:[175,25,97],  fg:[175,45,11] },
  plum:     { p:[270,55,40],  s:[150,55,42],  a:[20,88,58],   bg:[270,15,97],  fg:[270,40,12] },
};
const FONT_MAP = {
  'dm-sans':       { import: 'DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700', family: '"DM Sans", system-ui, sans-serif' },
  'plus-jakarta':  { import: 'Plus+Jakarta+Sans:wght@400;600;700',               family: '"Plus Jakarta Sans", system-ui, sans-serif' },
  'outfit':        { import: 'Outfit:wght@400;500;600;700',                       family: '"Outfit", system-ui, sans-serif' },
  'manrope':       { import: 'Manrope:wght@400;500;600;700',                      family: '"Manrope", system-ui, sans-serif' },
  'inter':         { import: 'Inter:wght@400;500;600;700',                        family: '"Inter", system-ui, sans-serif' },
  'space-grotesk': { import: 'Space+Grotesk:wght@400;500;600;700',               family: '"Space Grotesk", system-ui, sans-serif' },
};
const RADIUS_MAP = { sharp:'0rem', subtle:'0.375rem', rounded:'0.75rem', pill:'1.5rem' };
const pal  = COLOR_MAP[colorId]   || COLOR_MAP['ocean'];
const font = FONT_MAP[fontId]     || FONT_MAP['dm-sans'];
const rad  = RADIUS_MAP[radiusId] || '0.75rem';
const hsl  = (h,s,l) => `${h} ${s}% ${l}%`;
const cssVars = `--primary:${hsl(...pal.p)};--secondary:${hsl(...pal.s)};--accent:${hsl(...pal.a)};--background:${hsl(...pal.bg)};--foreground:${hsl(...pal.fg)};--radius:${rad};`;
---

<!-- In HTML <head> — replace font link + body style: -->
<link href={`https://fonts.googleapis.com/css2?family=${font.import}&display=swap`} rel="stylesheet" media="print" onload="this.media='all'" />
<style is:inline set:html={`:root { ${cssVars} } body { font-family: ${font.family}; }`}></style>
```

## Step 4c: Add tracking scripts (Google Ads + Voluum)

In `Layout.astro` `<head>`, add after `dataLayer` initialization:

```astro
{conversionId && (
  <>
    <script is:inline async src={`https://www.googletagmanager.com/gtag/js?id=${conversionId}`}></script>
    <script is:inline define:vars={{ conversionId }}>
      function gtag(){window.dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', conversionId);
    </script>
  </>
)}
{voluumId && (
  <script is:inline define:vars={{ voluumId, voluumDomain }}>
    var vpv = document.createElement('script');
    vpv.src = 'https://' + voluumDomain + '/scripts/' + voluumId + '/vp.js';
    document.head.appendChild(vpv);
  </script>
)}
```

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
</head>
<body data-aid={aid}>
<script is:inline>
window.dataLayer = window.dataLayer || [];

var SafeStorage = {
  _mem: {},
  set: function(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { this._mem[k] = v; } },
  get: function(k) { try { return sessionStorage.getItem(k); } catch (e) { return this._mem[k] || null; } }
};

function getVoluumClickId() {
  var urlParams = new URLSearchParams(window.location.search);
  var cid = urlParams.get('cid') || urlParams.get('click_id');
  if (cid) SafeStorage.set('voluum_cid', cid);
  return SafeStorage.get('voluum_cid') || cid || '';
}

var aid = document.body.getAttribute('data-aid') || '';

var _lg_form_init_ = {
  aid: aid,
  template: "fresh",
  ref: window.location.hostname,
  click_id: getVoluumClickId(),

  onFormLoad: function() {
    console.log('📋 LeadsGate form loaded');
    window.dataLayer.push({
      'event': 'leadsgate_form_start',
      'clickId': getVoluumClickId(),
      'gclid': SafeStorage.get('google_gclid'),
      'timestamp': new Date().toISOString()
    });
  },

  onStepChange: function(step) {
    console.log('📊 Form step:', step);
    window.dataLayer.push({
      'event': 'leadsgate_form_progress',
      'step': step,
      'clickId': getVoluumClickId()
    });
  },

  onSubmit: function() {
    console.log('📤 Form submitted');
    window.dataLayer.push({
      'event': 'leadsgate_form_submit',
      'clickId': getVoluumClickId(),
      'timestamp': new Date().toISOString()
    });
  },

  onSuccess: function(data) {
    console.log('✅ LeadsGate Response:', data);

    var voluumCid = getVoluumClickId();
    var googleGclid = SafeStorage.get('google_gclid');

    var type = data.type;
    var leadId = data.lead_id;
    var payout = data.price || 0;

    var status = 'pending';
    if (type === 'soldLead') status = 'approved';
    else if (type === 'rejectLead') status = 'declined';

    var finalPayout = payout > 0 ? payout : (status === 'declined' ? 5.00 : 50.00);

    console.log('📊 Parsed:', { type: type, status: status, leadId: leadId, payout: finalPayout });

    var conversionData = {
      transaction_id: leadId,
      value: finalPayout,
      currency: 'USD',
      status: status,
      type: type,
      click_id: voluumCid,
      gclid: googleGclid,
      created: data.created
    };

    window.dataLayer.push({
      'event': 'lead_conversion_all',
      'leadData': conversionData,
      'conversionValue': finalPayout,
      'leadStatus': status,
      'leadType': type,
      'transactionId': leadId,
      'clickId': voluumCid,
      'gclid': googleGclid
    });

    console.log('✅ All leads tracked:', status, 'Type:', type, 'Payout:', finalPayout);

    if (type === 'soldLead') {
      window.dataLayer.push({
        'event': 'lead_conversion_approved',
        'leadData': conversionData,
        'conversionValue': finalPayout,
        'transactionId': leadId,
        'clickId': voluumCid,
        'gclid': googleGclid
      });
      console.log('✅ Approved lead tracked | Payout:', finalPayout);
    }

    if (type === 'rejectLead') {
      window.dataLayer.push({
        'event': 'lead_declined',
        'leadData': conversionData,
        'conversionValue': finalPayout,
        'transactionId': leadId,
        'clickId': voluumCid,
        'gclid': googleGclid
      });
      console.log('⚠️ Declined lead tracked | Payout:', finalPayout);
    }

    if (type === 'newLead') {
      window.dataLayer.push({
        'event': 'lead_pending',
        'leadData': conversionData,
        'conversionValue': finalPayout,
        'transactionId': leadId,
        'clickId': voluumCid,
        'gclid': googleGclid
      });
      console.log('⏳ Pending lead tracked | Payout:', finalPayout);
    }

    console.log('✅ Tracking complete for Lead ID:', leadId);
  }
};

var script = document.createElement('script');
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
- Container `<div id="_lg_form_"></div>` must exist in DOM before script runs
- SDK URL: `https://apikeep.com/form/applicationInit.js` (not form.leadsgate.com)
- `PUBLIC_AID` is injected by CI build from deploy config `aid` field (set in Wizard → Tracking → LeadsGate AID)

## Notes
- This workflow only modifies `index.astro`, `apply.astro` and optionally `tsconfig.json`
- Do NOT modify `astro.config.mjs`, `package.json`, or any other files
- Do NOT add React or any new dependencies
- The deploy pipeline (GitHub Actions) injects all PUBLIC_* values via `.env` before `npm run build`
- **Gen Reviews** button in Wizard → Step 5 (Copy) generates 3 unique category-aware reviews via Gemini — regenerate anytime before deploy
- **Voluum CTA**: if `PUBLIC_VOLUUM_CLICK_URL` is set, use it as `href` for all CTA buttons; fallback to `#apply`
