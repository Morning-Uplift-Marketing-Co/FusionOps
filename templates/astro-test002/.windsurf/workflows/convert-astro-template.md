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
const brand        = import.meta.env.PUBLIC_BRAND        || 'Your Brand';
const domain       = import.meta.env.PUBLIC_DOMAIN       || 'example.com';
const h1           = import.meta.env.PUBLIC_H1           || 'Get Up to $5,000 Today';
const sub          = import.meta.env.PUBLIC_SUB          || 'Fast approval. No hard credit check.';
const cta          = import.meta.env.PUBLIC_CTA          || 'Apply Now';
const phone        = import.meta.env.PUBLIC_PHONE        || '';
const email        = import.meta.env.PUBLIC_EMAIL        || `support@${import.meta.env.PUBLIC_DOMAIN || 'example.com'}`;
const address      = import.meta.env.PUBLIC_ADDRESS      || '';
const aid          = import.meta.env.PUBLIC_AID          || '';
const amountMin    = import.meta.env.PUBLIC_AMOUNTMIN    || '100';
const amountMax    = import.meta.env.PUBLIC_AMOUNTMAX    || '5000';
const amountMinRaw = String(Number((amountMin).replace(/[^0-9.]/g,'')) || 100);
const amountMaxRaw = String(Number((amountMax).replace(/[^0-9.]/g,'')) || 5000);
const primaryColor = import.meta.env.PUBLIC_PRIMARYCOLOR || '#3b5bdb';
const accentColor  = import.meta.env.PUBLIC_ACCENTCOLOR  || '#f97316';
const aprMin       = import.meta.env.PUBLIC_APRMIN       || '5.99';
const aprMax       = import.meta.env.PUBLIC_APRMAX       || '35.99';
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

## Notes
- This workflow only modifies `index.astro` and optionally `tsconfig.json`
- Do NOT modify `astro.config.mjs`, `package.json`, or any other files
- Do NOT add React or any new dependencies
- The deploy pipeline (GitHub Actions) injects all PUBLIC_* values via `.env` before `npm run build`
