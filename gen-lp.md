# 🧙 AI Prompt: Generate LP Template for LP Factory

Use this prompt with any AI (Claude, GPT, etc.) to generate a new landing page template compatible with the LP Factory Template Generator system.

---

## Prompt

```
You are a landing page template generator for the "LP Factory" system — an Astro-based affiliate marketing LP builder.

Your job is to produce a SINGLE JavaScript file (index.js) that exports a `generate(site)` function. This function receives a `site` config object from the LP Wizard and returns a `files` object where each key is a file path and each value is the file content as a string.

## SYSTEM CONTRACT

### Import
import { COLORS, FONTS } from '../../core/template-registry.js';

### Function Signature
export function generate(site) {
  // ... build files ...
  return files; // { "path/to/file": "content string", ... }
}

### `site` Object Fields (all optional, provide defaults)

**Brand & Copy:**
- `site.brand` — Brand name (default: your template's brand)
- `site.domain` — Domain (default: "example.com")
- `site.h1` — Main headline
- `site.h1span` — Headline accent/span text (optional)
- `site.sub` — Subheadline
- `site.badge` — Badge text above headline (optional)
- `site.cta` — CTA button text
- `site.loanLabel` — Product label (e.g. "Personal Loans")
- `site.amountMin` / `site.amountMax` — Loan range
- `site.aprMin` / `site.aprMax` — APR range

**Design:**
- `site.colorId` — Color palette ID (lookup from COLORS array)
- `site.fontId` — Font ID (lookup from FONTS array)

**Tracking (from Wizard Step 5):**
- `site.aid` — LeadsGate Affiliate ID (default: "14881")
- `site.network` — Network name (default: "LeadsGate")
- `site.redirectUrl` — Post-form redirect URL
- `site.voluumId` — Voluum campaign ID (optional)
- `site.voluumDomain` — Voluum tracking domain (optional)
- `site.conversionId` — Google Ads conversion ID
- `site.formStartLabel` — form_start event label
- `site.formSubmitLabel` — form_submit event label

### COLORS Structure
{ id: 'blue', name: 'Ocean Blue', p: [210, 80, 52], s: [200, 70, 45], a: [180, 60, 45], bg: [210, 15, 97], fg: [210, 20, 20] }
// p = primary HSL, s = secondary HSL, a = accent HSL, bg = background HSL, fg = foreground HSL
// Usage in template literal: hsl(${c.p[0]} ${c.p[1]}% ${c.p[2]}%)

### FONTS Structure
{ id: 'dm-sans', name: 'DM Sans', family: "'DM Sans', system-ui, sans-serif", import: 'DM+Sans:wght@400;500;600;700&display=swap' }
// Usage: font-family in CSS, Google Fonts <link> with ${f.import}

### Required Output Files (keys in `files` object)
1. `package.json` — Use JSON.stringify({...}, null, 2), Astro ^5.2.0
2. `astro.config.mjs` — Static output, site URL from domain
3. `src/pages/index.astro` — Full HTML page with inline CSS + JS (NO external frameworks)
4. `README.md` — Template docs with features, config, tracking events, deploy instructions

### Tracking Architecture (MANDATORY)
LP Factory uses a zero-GTM, zero-GA4 architecture:
- Layer 1: window.dataLayer push only (NO gtag.js inline) — events: form_start, form_submit, page_view
- Layer 2: Custom first-party pixel via sendBeacon (optional, template doesn't need to implement)
- Layer 3: Voluum script (conditional, only if site.voluumId is set)

Include this tracking block in <head>:
<script>
  window.dataLayer = window.dataLayer || [];
  window.aid = "${aid}";
  window.network = "${network}";
  window.conversionId = "${conversionId}";
  window.formStartLabel = "${formStartLabel}";
  window.formSubmitLabel = "${formSubmitLabel}";
  window.redirectUrl = "${redirectUrl}";
</script>

And fire these events in the form handler:
window.dataLayer.push({ event: 'form_start', ... });  // on form focus/start
window.dataLayer.push({ event: 'form_submit', ... });  // on form submit
window.dataLayer.push({ event: 'page_view', ... });    // on page load

### Design Rules
- Mobile-first responsive design
- Above the fold must be pure HTML/CSS (no JS dependency for FCP)
- CTA buttons must be thumb-friendly (min 48px height, full-width on mobile)
- Compliance footer with placeholders for loan disclosures and privacy policy (US law)
- Zero external JS frameworks — vanilla JS only, inline in the HTML
- All styles must be inline <style> tags (no external CSS files)
- Use CSS custom properties derived from the COLORS object
- Use Google Fonts via <link> tag with the FONTS import string

### Code Style
- Use backtick template literals for file content strings
- Interpolate site.* variables directly (they're in scope inside generate())
- The entire file must be a single ES module with one named export: generate
- Keep the file self-contained — no imports except COLORS and FONTS from the registry

## YOUR TASK

Create a template for: **[DESCRIBE YOUR NICHE/DESIGN HERE]**

Example niches:
- "Home improvement loan bridge page with before/after slider"
- "Debt consolidation LP with savings calculator and testimonials"
- "Pet insurance comparison page with pricing cards"
- "Solar panel financing LP with ROI calculator"

Output the complete index.js file only. No explanations.
```

---

## After AI Generates the File

1. Save to `packages/lp-template-generator/src/templates/YOUR-TEMPLATE-ID/index.js`

2. Register in `packages/lp-template-generator/src/templates/index.js`:
   ```js
   import { generate as generateYourTemplate } from './your-template-id/index.js';

   registerTemplate('your-template-id', {
     name: 'Your Template Name',
     description: 'One-line description',
     badge: 'New',           // New | Popular | Stable | Beta | Advanced
     category: 'general',    // general | pdl | insurance | education
     generate: generateYourTemplate,
   });

   export { generate as generateYourTemplate } from './your-template-id/index.js';
   ```

3. Add to `src/utils/template-router.js` → `MODULE_TEMPLATE_IDS` array

4. The template will auto-appear in the Template Wizard's "Clone Existing" list
