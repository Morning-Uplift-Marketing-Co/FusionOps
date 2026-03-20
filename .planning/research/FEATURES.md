# Feature Landscape: Landing Page Factory

**Domain:** Internal PPC landing page factory for templated deployment at scale
**Researched:** 2026-03-20
**Analysis:** Existing codebase, domain patterns (template-preview-runtime.js, template-analyzer.js), and mature LP factory patterns

---

## Table Stakes

Features users expect. Missing = product feels incomplete or unsafe.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Template Variable Injection** | Imported templates use framework-specific env syntax (Astro `import.meta.env.PUBLIC_*`, Vite `.env`); must be replaced with site config values (brand, h1, domain, tracking IDs) | Medium | Currently BROKEN for imported templates — fallback values leak instead of wizard values |
| **Tracking Pixel Integration** | Core value: link form submits & CTA clicks to Voluum/Google Ads; pixel markers must be injected into every deployed page | Medium | Existing: pixel injection in template-router.js; needs formalization for imported templates |
| **Google Ads Conversion Tracking** | Required for PPC campaigns; must inject gtag() calls + conversion ID markers | Medium | dataLayer + gtag() stubs exist in template-preview-runtime.js |
| **Multi-Format Build Support** | Templates come from Astro, Vite/React, static HTML; all must build to static files for Cloudflare Pages | High | Astro works; Vite/React requires build step (CI/CD); HTML static is passthrough |
| **Wizard-Driven Configuration** | User selects product, brand colors, copy, tracking IDs via form; injects into template | Medium | Existing workflow; needs to adapt to template capabilities (not all templates support calculators, etc.) |
| **Quality Check / Build Validation** | Detect missing viewport, tracking markers, Astro expression leaks, broken form handlers before deploy | Medium | Existing: manual checks; needs automation |
| **Preview Before Deploy** | Show what the deployed page will look like, with wizard values injected | Medium | Started: template-preview-runtime.js renders HTML with injected tracking stubs + CSS variables |
| **Deploy to Cloudflare Pages** | Core platform; must work reliably for all template formats | Low | Existing and working |
| **Backwards Compatibility** | Existing module-based templates (classic, pdl-loans-v1, etc.) must keep working when new features are added | High | CRITICAL: new variable injection, capability detection, anti-fingerprint must not break ~15 existing templates |

---

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Capability-Aware Wizard** | Auto-detect template capabilities (supports calculator? section reorder? custom CTAs?) via analyzer + manifest override; show/hide wizard steps accordingly. Don't ask for "calculator settings" if the template doesn't have a calculator. | Medium-High | Saves operator time; handles unpredictable imported templates. Auto-detect covers unknown templates; manifest covers known ones. Currently not implemented. |
| **Anti-Fingerprinting (HTML/CSS Randomization)** | Randomize CSS class names, DOM structure, spacing, attribute order per deployment so Google Ads can't link multiple domains back to the same template origin. Each site gets unique fingerprint. | High | Currently not implemented; critical for scaling past 10-15 domains. Industry pattern: Perplexity, ManyChat, and other mass-deployment tools use this. |
| **Template Preview Live Rendering** | Show a live iframe preview of the template with wizard-configured values (brand, colors, copy, tracking stubs). Not just static image. | Medium | Partial: template-preview-runtime.js can build HTML; UI integration needed. Blocks CSS-in-JS and framework compilation (Vite/React need build step). |
| **Multi-Framework Support** | Handle Astro, Vite/React, static HTML, and eventually Next.js (v2). Build to static for all. | High | Analyzer detects framework; entry resolver finds renderable files; preview-runtime injects dependencies. Foundation exists; needs CI/CD integration for build-required templates. |
| **CSS Variable Injection (Theming)** | Instead of string replacement of ${brand.color}, inject CSS variables via cascading <style> block. Works with Tailwind CDN, shadcn/ui, custom theme systems. | Low | Implemented in template-preview-runtime.js; uses :root variables + theme overrides. |
| **Intelligent Dependency Injection** | Auto-detect Tailwind, Lucide, shadcn/ui, Google Fonts; inject via CDN for preview; handle missing critical deps. | Medium | Implemented in template-analyzer.js + template-preview-runtime.js; KNOWN_DEPS array covers 5+ libraries. |
| **Template Registry Manifest** | Simple JSON manifest per template declaring: entry point, capabilities (calculator, forms), variables to inject, required env vars. Replaces hardcoded template-router.js mappings. | Low | Started: template-adapter.ts, template-feature-matrix.ts; needs schema formalization. |
| **Lighthouse 95+ Enforcement** | Every deployed page auto-checked for performance; fail if LH score < 95. Catch before going live. | Low-Medium | Requirement in PROJECT.md; not yet implemented. |
| **Form Handler / Lead Capture** | Deployed pages must route form submits to correct endpoint (LeadsGate, direct POST, etc.). Error handling if endpoint is down. | Low | Existing: form handlers in templates; needs centralization. |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Next.js Deployment** | Requires Cloudflare `@astrojs/cloudflare` adapter + special config. Out of scope for v1. | Defer to v2; use Astro as primary framework for SSG. |
| **Batch / Scheduled Deployment** | "Deploy 50 sites every Monday morning." Overcomplicates pipeline; current manual per-domain workflow is fine at 5-6/week scale. | Keep manual control; scale to batch automation only when velocity exceeds 20/week. |
| **Multi-Deployer Support** | Support Vercel, S3, VPS in addition to Cloudflare. Each adds complexity. | Commit to Cloudflare Pages; it handles static + serverless well. |
| **Real-Time Collaboration** | Multiple operators editing the same site config simultaneously. Single-operator tool is sufficient. | Keep single-session design; use version history for transparency. |
| **Mobile App** | Native iOS/Android app for template management. Web dashboard + browser preview is sufficient. | Web-only; use responsive design if mobile browsing is needed. |
| **Template Sharing Marketplace** | Community upload templates, rate, fork, purchase. Governance + moderation overhead. | Curate templates internally; import from known sources (Bolt.new, Loveable, internal repo). |
| **A/B Test Variants** | Auto-deploy 2 versions of a site with traffic split for conversion testing. | Operator can manually clone + deploy 2 sites; Voluum handles split traffic. |
| **CMS / Content Management** | After deployment, allow editing copy/images without re-importing. | Each site is immutable after deploy; new copy = new import + redeploy. |

---

## Feature Dependencies

```
Wizard Configuration
    ↓
Template Analyzer (framework + dependencies detection)
    ↓
Capability-Aware Wizard (auto-adapt steps based on template)
    ├→ Template Preview (inject wizard values, render iframe)
    └→ Quality Checks (validate tracking markers, viewport, etc.)
        ↓
Build Pipeline (Astro compile, Vite compile, HTML passthrough)
    ↓
Anti-Fingerprint Transform (randomize CSS/HTML before build)
    ↓
Deploy to Cloudflare Pages
    ↓
Post-Deploy Validation (Lighthouse, ping pixel, verify tracking)
```

**Critical paths:**
- **Variable injection** blocks preview, deployment
- **Capability detection** blocks wizard adaptation
- **Anti-fingerprint** blocks scaling past ~15 domains (Google Ads detection)
- **Multi-format support** blocks support for Vite/React templates (currently ~20% of imports)

---

## MVP Recommendation

**Phase 1 (Immediate):** Fix variable injection + basic preview
1. ✓ Framework detection & entry resolution (done: template-analyzer.js)
2. ✓ HTML extraction & CSS variable injection (done: template-preview-runtime.js)
3. **FIX:** Apply `PUBLIC_*` env vars to Astro templates during build (currently leaking fallbacks)
4. **ADD:** Preview modal in wizard step 5 (Review) — iframe with buildPreviewHtml()
5. **ADD:** Quality checks before deploy (viewport meta, tracking markers, Astro leaks)

**Phase 2 (1-2 weeks):** Capability detection + anti-fingerprint foundation
6. **ADD:** Template capability manifest (entry point, supported features, required vars)
7. **ADD:** Wizard step adaptation (show calculator settings only if template supports it)
8. **ADD:** CSS class randomization (replace `btn-primary` with `_a7f2k_btn` per site)
9. **ADD:** HTML structure variation (reorder non-semantic DOM elements)

**Phase 3 (2-4 weeks):** Scale to 50+ domains
10. **ADD:** CI/CD integration for Vite/React builds (GitHub Actions compile → static)
11. **ADD:** Automated Lighthouse checks (fail if < 95)
12. **ADD:** Post-deploy validation (pixel firing, gtag() registering)

**Defer to v2:**
- Next.js support
- Batch deployment automation
- Template marketplace

---

## Feature Implementation Patterns

### 1. Variable Injection Strategy

**Problem:** Imported templates from Bolt.new/Loveable use `import.meta.env.PUBLIC_*` (Astro) or `.env.local` (Vite). When deployed to Cloudflare, env vars don't get injected unless explicitly set in the build environment.

**Recommended approach:**
- **Astro templates:** Build with `PUBLIC_*` vars set in environment during Cloudflare Pages build
- **Vite/React templates:** Compile locally → output static files → inject variables via HTML manipulation (string replacement or dom-parser)
- **Static HTML:** Direct string replacement of placeholders (`{brand}`, `${brand}`, `{{brand}}`)

**How mature LP builders handle it:**
- Unspoken.ai, Carrd, Webflow: templates have named "variable slots" in visual builder; injection happens at export time
- Leadpages: uses template engine (Liquid/Jinja) for variable substitution
- BuildFire: uses `.env` file as contract between template and deployer

**Recommended for LP Factory:** CSS variable cascading (already implemented in template-preview-runtime.js) + explicit `PUBLIC_*` build-time injection for Astro + post-build HTML rewriting for Vite/React.

---

### 2. Anti-Fingerprinting Techniques

**Problem:** Deployed sites must appear unique to Google Ads ML detection. If 10 sites share the same HTML structure, GA can link them back to a single template.

**Industry techniques:**

| Technique | Effort | Effectiveness | Notes |
|-----------|--------|---------------|-------|
| **CSS Class Randomization** | Low | HIGH | Rename `btn-primary` → `_x7q2m` per site; breaks GA CSS selector tracking |
| **HTML Attribute Randomization** | Low | HIGH | Add/remove `data-*` attributes, reorder attributes, random `id` suffixes |
| **DOM Structure Variation** | Medium | HIGH | Reorder non-semantic elements (spacing divs, decorative elements), swap flex/grid, adjust padding |
| **Stylistic Variation** | Medium | MEDIUM | Vary font sizes ±5%, colors ±10 HSL, border radius ±2px per site |
| **Timing Injection** | Low | LOW | Add random delays to event tracking (GA sees slightly different timing per domain) |
| **Script Injection Order** | Low | LOW | Randomize order of `<script>` tags in `<head>` |

**Recommended for LP Factory (MVP):**
1. **CSS class randomization** — Easy + high impact. Use deterministic seeding per `siteId` so rebuilds are consistent.
2. **HTML structure variation** — Swap decorative elements, adjust grid-cols, randomize spacing divs.
3. **Attribute randomization** — Add random `data-*` attributes to key elements.

**Implementation:**
```javascript
// Deterministic random based on siteId
function getRandomSuffix(siteId) {
  const hash = siteId.split('').reduce((h, c) => h + c.charCodeAt(0), 0);
  return '_' + hash.toString(36).slice(-6); // _a7f2k
}

// Before deploy, run HTML through transform
function randomizeFingerprint(html, siteId) {
  const suffix = getRandomSuffix(siteId);
  // Replace class names
  html = html.replace(/class="([^"]*)"/g, (m, classes) => {
    const renamed = classes.split(' ')
      .map(c => c.startsWith('_') ? c : c + suffix)
      .join(' ');
    return `class="${renamed}"`;
  });
  // Add random data attributes
  html = html.replace(/<(button|a|div|section)[^>]*>/g, (m) => {
    const attr = `data-rnd="${randomData(siteId)}"`;
    return m.slice(0, -1) + ' ' + attr + '>';
  });
  return html;
}
```

---

### 3. Capability-Aware Template System

**Problem:** Imported templates are unpredictable. Some have calculators, some don't. Some support section reordering, some have hardcoded layouts. Wizard currently assumes all templates have the same features.

**How mature builders handle it:**

| Platform | Pattern | Notes |
|----------|---------|-------|
| Webflow | Visual builder auto-detects inputs/forms, allows user to bind to any data source | Always detectable; user controls via UI |
| Leadpages | Template declares capabilities in metadata; wizard adapts (show form fields only if template has form) | Explicit manifest |
| Unbounce | AI-driven layout detection; auto-maps user inputs to detected fields | Smart but requires training |

**Recommended for LP Factory:**

**Two-tier detection:**
1. **Auto-detect (scoring-based):** Analyzer scans for:
   - Calculator: Look for `<input type="range">`, `Math.` in scripts, or component named `Calculator`
   - Forms: Count `<form>` or `<input type="text">` elements
   - Sections: Count `<section>` tags; if > 3, likely supports reorder
   - CTAs: Count `<button>` or `<a href="#apply">` elements
   - Images: Count `<img>` or `background-image`

2. **Manifest override:** Template can include `.template-manifest.json`:
   ```json
   {
     "id": "pet-loans-v1",
     "entry": "src/pages/index.astro",
     "capabilities": {
       "calculator": true,
       "sectionReorder": false,
       "customCtas": true,
       "imageUpload": true,
       "requiredSections": ["hero", "form", "social-proof"]
     },
     "variables": {
       "brand": "text",
       "h1": "textarea",
       "amountMin": "number",
       "amountMax": "number",
       "primaryColor": "color"
     }
   }
   ```

**Wizard adaptation:**
- Step 2 (Product): Show "Does this template need a loan calculator?" → YES/NO (preset by analyzer, override via manifest)
- Step 3 (Brand): Show only variables declared in manifest
- Step 4 (Copy): Show text/textarea fields; calculators auto-populate with templates defaults
- Step 5 (Design): Show "Reorder sections?" only if `sectionReorder: true`

---

### 4. Template Preview Spec

**What's table stakes for preview?**

| Aspect | Requirement | Rationale |
|--------|-------------|-----------|
| **Coverage** | Show rendered HTML, not screenshot or mockup | Actual output, catches real bugs (broken forms, missing images) |
| **Variables** | Apply wizard values (brand, colors, copy, amounts) | Verify theming + text fit |
| **Tracking Stubs** | Inject gtag() + __fusionopsTrack() so forms don't throw ReferenceError | Catch missing tracking hooks |
| **Dependencies** | Load Tailwind CDN, Lucide icons, Google Fonts | Styling should render correctly |
| **Refresh Speed** | < 2 seconds from "save wizard config" to preview update | Operator feedback loop |
| **Responsive** | Show mobile + desktop breakpoints (iframe toggle) | Verify mobile doesn't break |
| **Fallback for Build-Required** | Show placeholder if template needs compile (Vite/React) | Don't block preview; inform user of limitation |

**Already implemented in template-preview-runtime.js:**
- ✓ Tailwind CDN injection + CDN script guard
- ✓ CSS variable override via `:root` cascade
- ✓ Tracking stubs (gtag, __fusionopsTrack, dataLayer)
- ✓ Lucide icon UMD bundle for HTML-static templates
- ✓ Astro component inlining (up to 5 levels of nesting)
- ✓ Error fallback HTML

**Needed for MVP:**
- UI integration: modal or side panel in Wizard step 5
- Mobile toggle button to switch between 375px and 1200px viewport
- Auto-refresh on value change (real-time feedback)
- Capture console errors in iframe (log form handler failures)

---

## Phase-Specific Research Flags

| Phase Topic | Likely Issue | Mitigation |
|-------------|-------------|------------|
| **Variable Injection** | Env vars don't persist in Cloudflare Pages build environment | Test with actual CF Pages build; document required secrets in wrangler.toml |
| **CSS Randomization** | Inline styles + Tailwind class changes → styling breaks if not careful | Test on 3+ template formats; use regex for class name replacement, not string split |
| **Capability Detection** | Auto-detection has false positives (e.g., styling-related `<input>` detected as form field) | Require manual manifest override; mark auto-detect as "confidence: 0.7" to flag uncertain cases |
| **Astro Component Inlining** | Circular component imports break inlining (Component A includes B includes A) | Add depth limit (5) + cycle detection; fall back to placeholder if cycle found |
| **Lucide Icon Migration** | React `<Icon>` components don't work in HTML preview | Use UMD bundle (`lucide.min.js`) for HTML-static only; warn user for React templates |
| **Backwards Compatibility** | Anti-fingerprint transform breaks module templates if not careful | Test all 15 existing templates with randomization enabled; use feature flag to enable per-template |
| **Google Ads Detection** | Random IDs might trip ML detection if pattern is obvious | Use 3+ randomization vectors (class, attributes, structure) so fingerprint is harder to reverse-engineer |

---

## Gaps to Address

**Later research needed:**
- **Cloudflare build env spec:** Can we set `PUBLIC_*` vars via wrangler.toml or GitHub Actions secrets? Test required.
- **Anti-fingerprint effectiveness:** How much variation is needed to avoid GA ML clustering? Need competitive analysis of 3-5 mature tools.
- **Astro module system:** Can we safely compile imported Astro projects in CLI context without filesystem access? Current strategy assumes file extraction + local build.
- **Vite build optimization:** How to cache compiled assets for 50+ Vite templates without bloating CI/CD storage?
- **Lighthouse integration:** Tool choice? Lighthouse CLI vs APIs. Flaky? Need retry strategy.
- **Form handler fallback:** If LeadsGate is down, should we queue submissions or bounce? Error handling strategy for form POST failures.

---

## Sources

- **Codebase analysis:** `src/utils/template-analyzer.js`, `template-preview-runtime.js`, `template-router.js`
- **Existing implementations:** `src/adapters/template-adapter.ts`, `template-feature-matrix.ts`
- **PROJECT.md:** Validated requirements and known pain points
- **Domain knowledge:** Astro SSG patterns, Tailwind CDN, Cloudflare Pages deployment model
