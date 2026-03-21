## Goal
Convert any Astro landing page template so all hardcoded text/color values are replaced with `import.meta.env.PUBLIC_*` variables making it compatible with the GitHub Actions deploy pipeline.

**Updated: March 21, 2026** - Synced with TEMPLATE-PROMPT.md v2. Fixed LeadsGate hooks API, Quality Gate levels, and template ID convention.

## Template ID Convention

All template IDs MUST follow the pattern: `{source}-{niche}-{number}`

| Part | Values |
|------|--------|
| source | `bolt`, `lov`, `mcp`, `custom`, `zip` |
| niche | `loan`, `pet`, `finance`, `general` |
| number | `01`, `02`, `03`... auto-increment |

Examples: `bolt-loan-01`, `lov-loan-02`, `mcp-pet-01`

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

Make surgical replacements only -- do NOT change layout, CSS structure, or component logic:

| What to replace | Replace with | Notes |
|---|---|---|
| Brand/site name | `{brand}` | |
| `<title>` text | `{brand} -- ...` | |
| Hero h1 headline | `{h1}` | |
| Sub-headline / description | `{sub}` | |
| CTA button text | `{cta}` | |
| Dollar amount display | `${amountMax}` or `${amountMin}` | With $ prefix |
| Slider `min` attribute | `{amountMinRaw}` | Plain integer, no $ |
| Slider `max` attribute | `{amountMaxRaw}` | Plain integer, no $ |
| Phone number | `{phone}` | Wrap in `{phone && <a href={...}>{phone}</a>}` if needed |
| Email | `{email}` | |
| Affiliate ID / AID | `{aid}` | |
| Primary color (inline CSS) | `{primaryColor}` | e.g. `style={`color: ${primaryColor}`}` |
| Accent/button color | `{accentColor}` | |
| APR range | `{aprMin}% - {aprMax}%` | |

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
// In Layout.astro frontmatter -- add after existing env var declarations:
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
const hsl  = (h,s,l) => `${h} ${s}% ${l}%`;
const cssVars = pal
  ? `--primary:${hsl(...pal.p)};--secondary:${hsl(...pal.s)};--accent:${hsl(...pal.a)};--background:${hsl(...pal.bg)};--foreground:${hsl(...pal.fg)};--radius:${rad};`
  : `--primary-custom:${primaryColor};--accent-custom:${accentColor};--radius:${rad};`;
---

<!-- In HTML <head> -- replace font link + body style: -->
<link href={`https://fonts.googleapis.com/css2?family=${font.import}&display=swap`} rel="stylesheet" media="print" onload="this.media='all'" />
<style is:inline set:html={`:root { ${cssVars} } body { font-family: ${font.family}; }`}></style>
```

## Step 4c: Tracking scripts -- PIPELINE HANDLES THIS

> **IMPORTANT**: Do NOT manually add tracking scripts (Google Ads, Voluum, pixel) to templates.
> The CI build pipeline (`inject-tracking.mjs`) injects all tracking automatically.
> This section is reference-only for understanding what gets injected.

What the pipeline injects:
- Google Ads gtag.js + config + conversion labels
- Voluum dtpCallback script
- First-party pixel (GET beacon to `https://t.{domain}/e`)
- GCLID/UTM/click_id sessionStorage capture
- Scroll depth + time-on-page micro-conversions
- Amount slider + ZIP input tracking

All `<script>` tags injected by the pipeline include `data-cfasync="false"` for Cloudflare Rocket Loader bypass.

## Step 4d: CTA buttons -- use `ctaHref`

All CTA `<a>` buttons (hero + final CTA section) must use `{ctaHref}` not hard-coded `#apply`:

```astro
<a href={ctaHref} class="btn-cta ...">{cta}</a>
```

`ctaHref = voluumClickUrl || '#apply'` -- when `PUBLIC_VOLUUM_CLICK_URL` is set, clicks go to Voluum; otherwise scroll to `#apply`.

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

<!-- In HTML -- replace hardcoded review cards: -->
{reviews.length > 0 && reviews.map((r) => (
  <div class="review-card">
    <div class="reviewer">{r.name} -- {r.location}</div>
    <p>"{r.text}"</p>
    <div class="stars">{"*".repeat(r.rating || 5)} {r.rating || 5}.0</div>
  </div>
))}
```

The workflow injects `PUBLIC_REVIEWS` as a JSON string from the deploy config `reviews` array.

## Step 8: Apply page -- PIPELINE GENERATES THIS

> **IMPORTANT**: Do NOT create `apply.astro` manually.
> The CI build pipeline generates the apply page with LeadsGate form automatically.
> It includes all hooks (onFormLoad, onStepChange, onSubmit, onLeadSold, onLeadRejected, onLeadFinished),
> SafeStorage, click_id handling, and MutationObserver fallback.

If the template already has an apply.astro, **delete it** -- the pipeline version is always up-to-date.

## Step 9: Pipeline-injected files -- DO NOT CREATE MANUALLY

The CI build pipeline auto-creates these files. Do NOT include them in templates:

| File | Purpose | Created by |
|------|---------|-----------|
| `src/pages/apply.astro` | LeadsGate form page | `inject-tracking.mjs` |
| `src/pages/e.ts` | Pixel GET beacon endpoint | `inject-tracking.mjs` |
| `src/pages/robots.txt.ts` | SEO robots.txt | `inject-tracking.mjs` |
| `public/_headers` | CF security headers | `inject-tracking.mjs` |

## Quality Gate -- Two Levels

Quality Gate checks are split into two levels:

### Import-time checks (template must pass these)
- `<meta name="viewport">` with width=device-width
- `--primary` CSS variable declaration
- "Payment Calculator" section
- `<table>` with "Representative APR"
- No "guaranteed approval" copy
- Uses `bg-primary` / `text-primary` not hardcoded colors

### Deploy-time checks (pipeline handles these)
- First-party pixel marker
- Google Ads tracking markers
- Voluum tracking
- apply.astro presence
- `e.ts`, `robots.txt.ts`, `_headers` presence

Templates should NOT fail import Quality Gate for deploy-time concerns.

## Notes
- This workflow modifies `index.astro` and `Layout.astro` only
- Do NOT modify `astro.config.mjs`, `package.json`, or any other files
- Do NOT add React or any new dependencies
- The deploy pipeline (GitHub Actions) injects all PUBLIC_* values via `.env` before `npm run build`
- **Gen Reviews** button in Wizard generates 3 unique category-aware reviews via Gemini
- **Voluum CTA**: always use `ctaHref = voluumClickUrl || '#apply'`

## Preview Compatibility Rules (Wizard Live Preview)

The wizard renders a live HTML preview of the template using `astroToHtmlPreview()`. For the preview to work correctly:

1. **All content variables MUST use `import.meta.env.PUBLIC_*`** in frontmatter -- NOT hardcoded strings.

2. **All colors MUST use CSS custom properties** (`var(--primary)`, `var(--accent)`, `var(--background)`) -- NOT hardcoded hex/hsl values in inline styles.

3. **CSS `--primary`, `--accent`, `--secondary`, `--background`, `--foreground`, `--radius`** must be declared in `:root` in `global.css` using space-separated HSL values (shadcn convention: `--primary: 217 91% 35%`).

4. **Font**: declare `font-family` on `body` using `var(--font-family)` or set it from `PUBLIC_FONTID`. The preview injector overrides `body { font-family: ... !important }` based on the wizard's Font selection.

The preview engine auto-substitutes all `{varName}` expressions where `varName` was declared from `import.meta.env.PUBLIC_*` in any `.astro` file in the template bundle.
