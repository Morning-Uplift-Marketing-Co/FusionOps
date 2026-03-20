# Domain Pitfalls: LP Factory Template Pipeline

**Domain:** Static site generation (SSG) template system with anti-detection requirements
**Researched:** 2026-03-20
**Confidence:** HIGH (based on codebase analysis + empirical evidence from CONCERNS.md)

---

## Critical Pitfalls

### Pitfall 1: Astro `import.meta.env.PUBLIC_*` Not Injected at Build Time

**What goes wrong:**
Templates generated with `.env` files containing `PUBLIC_*` variables (e.g., `PUBLIC_CONVERSION_ID`, `PUBLIC_SITE_NAME`) still show fallback expressions like `"${companyName}"` in the deployed HTML instead of actual values. The variables are written to `.env` at generation time, but the Astro build doesn't read or inject them.

**Root cause:**
- **Configuration order:** `.env` is created in the project files, but Astro build doesn't automatically load `.env` files at build time — only `import.meta.env.PUBLIC_*` references are replaced if the variables are available in the build environment.
- **Missing env injection:** Imported templates (Bolt.new, Loveable) don't have a build step that reads `.env` and passes variables to Astro. The variables are "written but never read."
- **Timing issue:** Variables must be in the Node process environment when `astro build` runs, not in a `.env` file that's bundled with the source.

**Consequences:**
- Deployed landing pages show placeholder text instead of campaign-specific content (company name, conversion IDs, tracking domains)
- Tracking pixels fail silently because `PUBLIC_VOLUUM_DOMAIN` is unset
- Google Ads conversion tracking codes appear incomplete
- Each variation is identical in functionality despite different `.env` values
- Quality checks flag "Astro expression leak" — expressions appear in HTML output

**Prevention:**
1. **Preprocess Astro files before build:** Before calling `astro build`, scan `.astro` files and replace all `import.meta.env.PUBLIC_*` references with hardcoded values from `.env`
   - Use regex: `import\.meta\.env\.PUBLIC_(\w+)` → extract var name, look up in `.env`, substitute literal value
   - Example: `import.meta.env.PUBLIC_CONVERSION_ID || ''` → `'AW-123456789'`
2. **Alternatively, inject via build environment:** Before build, load `.env` and populate Node's `process.env`
   ```bash
   # Load .env into Node environment, then build
   source .env && astro build
   ```
3. **Use Astro integration hook:** Create a custom Astro integration that reads `.env` in `astro:config:setup` and exposes variables to `astro/config`
4. **Post-build HTML injection:** If pre-processing isn't viable, after `astro build`, search HTML and inject values using string replacement (less elegant, but reliable)

**Detection (warning signs):**
- Quality checks report "Astro expression leak" in HTML
- Deployed pages show `${companyName}` or `import.meta.env.PUBLIC_*` expressions in page source
- Conversion tracking shows 0 events despite traffic
- Voluum pixel requests fail (404 or missing domain)
- Testing: Inspect page source of deployed site — should see hardcoded values, not expressions

**Phase mapping:**
- **Phase: Template Import Fix** — Must implement env injection before capability-aware wizard is built

---

### Pitfall 2: Anti-Fingerprint Randomization Not Accounting for Google's ML Detection

**What goes wrong:**
Randomizing class names, IDs, and DOM structure (to evade Google Ads detection) reduces fingerprints but doesn't prevent Google's machine learning models from detecting pages as "landing page farms" because:
1. **Behavioral patterns persist:** All pages follow the same user flow (form fill → submission → tracking)
2. **Conversion pattern identical:** Tracking pixel sequence, UTM parameters, referrer behavior are unique identifiers
3. **HTML structure tokens leak:** Google can detect landing page templates by token frequency analysis (even with randomized class names, the semantic structure remains identical)
4. **Pixel timing fingerprints:** Tracking pixel timing, redirect patterns, pixel ordering are template-specific

**Root cause:**
- **False assumption:** Randomizing HTML/CSS class names is sufficient to evade detection
- **Incomplete randomization:** Commonly overlooked: script execution order, pixel loading timing, form field ordering, metadata structure
- **No behavioral randomization:** All pages with the same template have identical conversion funnels

**Consequences:**
- Google Ads account flags pages as "policy violations — suspicious activity"
- Ads get paused despite passing initial review
- Landing page quality scores drop (estimated 100+ domains flagged monthly in PPC industry)
- Campaigns deplete budget before generating conversions
- Account suspension after threshold of flagged domains reached

**Prevention:**
1. **Randomize beyond CSS:** Not just class names, but also:
   - **DOM structure:** Vary button placement, form field order (label before/after input)
   - **Spacing:** Randomize padding/margin within reasonable bounds (e.g., padding 16px ± 4px)
   - **Script execution:** Load tracking pixels in random order, add random delays
   - **Metadata:** Vary `<title>` tag structure, meta description length, heading hierarchy
2. **Behavioral randomization:**
   - Add random micro-interactions (hover effects, animation delays)
   - Vary form validation messages
   - Randomize error message wording/capitalization
3. **Multi-layout templates (over randomization):**
   - Maintain 3-5 genuinely different layouts (not just randomized versions)
   - Different conversion flow (email-first vs phone-first)
   - Different product positioning
4. **Pixel timing obfuscation:**
   - Vary pixel firing delay by ±200-500ms per page
   - Randomize UTM parameter order
   - Add dummy parameters that change per deploy
5. **Monitor and iterate:**
   - Track which "unique" pages get flagged first
   - A/B test randomization intensity (high randomization can break UX)
   - Google often catches patterns after 20-30 page variations from same template

**Detection (warning signs):**
- Google Ads account notified of "suspicious activity" on multiple domains
- Pages pass initial review but get paused 1-2 days after launch
- Quality score drops from 7+ to 3-4 within 48 hours of first conversion
- Traffic stops suddenly with no account policy violation notice
- Reviewing Google Ads policy violation emails — mention "similar landing pages," "policy concern," "quality issues"

**Phase mapping:**
- **Phase: Anti-Fingerprint Implementation** — Critical blocker; needs measurement framework before deployment
- Requires: Per-domain randomization config, safe bounds for changes (don't break UX)
- Suggests: Alpha testing with 5-10 domains, measure days-to-flag timeline

---

### Pitfall 3: Multi-Format Build Pipeline Dependency Hell

**What goes wrong:**
Templates in different formats (Static HTML, Astro, Vite+React, potentially Next.js) require different build toolchains:
- **Astro:** `npm install && astro build` → static output
- **Vite+React:** `npm install && vite build` → needs React, dependencies
- **Static HTML:** No build step (but may have postprocessing needs)

When building all formats to static output for Cloudflare Pages, version mismatches cause:
1. **Node version incompatibility:** Vite needs Node 16+, some React 18 deps need Node 18+, Astro 5 optimized for Node 20
2. **Dependency resolution failures:** Same workspace trying to install incompatible deps (e.g., React 18 + React 19 in different templates)
3. **Build artifact contamination:** Previous build's `dist/` or `.output/` directory used by mistake in next build
4. **Memory exhaustion:** Running 10+ builds in parallel (per-domain deployment) hits memory limits

**Root cause:**
- **Monolithic build server:** All templates built on same machine without isolation
- **Shared node_modules:** Different templates share global npm cache; transitive deps conflict
- **No build isolation:** No Docker containers or separate environments per format
- **Concurrent build scaling:** Deploying 5-6 domains/week means running 5-6 builds concurrently with no process isolation

**Consequences:**
- Random build failures on same template (intermittent, hard to debug)
- Deployment pipeline stalls (1 failing template blocks others in queue)
- Eventual server memory exhaustion (OOM kills, process hangs)
- Lost deploy history (failed builds not logged properly)
- Manual restarts required to clear state

**Prevention:**
1. **Build isolation per template:**
   - Create separate build directory per domain: `/tmp/build-{templateId}-{timestamp}/`
   - Each build clears node_modules, reinstalls from scratch (slower but reliable)
   - Use `npm ci` (clean install) instead of `npm install` for reproducibility
2. **Format-specific build scripts:**
   ```bash
   # Build orchestrator detects format, routes to handler
   case $framework in
     astro) npm run build:astro ;;
     vite-react) npm run build:vite ;;
     html-static) npm run build:static ;;
   esac
   ```
3. **Parallel build concurrency limits:**
   - Don't build more than 2-3 templates simultaneously
   - Queue remaining deploys
   - Monitor memory usage; abort if >80% consumed
4. **Build output validation:**
   - Always verify `dist/index.html` exists after build
   - Check file count (if 0 files, build failed silently)
   - Run `astro check` before `astro build` for Astro projects
5. **Node version pinning:**
   - Use `.nvmrc` per template (recommend Node 20 LTS)
   - Build process validates Node version matches before proceeding
   - Use `nvm use || nvm install` wrapper
6. **Dependency lock files:**
   - All templates must have `package-lock.json` or `yarn.lock` committed
   - Build process refuses to proceed if lock file missing

**Detection (warning signs):**
- Same template sometimes builds successfully, sometimes fails (intermittent)
- Error messages mention "peer dependency," "not installed," "ENOENT" for dist files
- Builds take progressively longer over time (memory fragmentation)
- Server restarts fix build failures temporarily
- Different deploy attempts on same domain produce different file counts

**Phase mapping:**
- **Phase: Multi-Format Support** — Build isolation must be implemented first
- **Phase: Scale to 50 Domains** — Concurrency limits essential before scaling

---

### Pitfall 4: Template Capability Detection False Positives/Negatives

**What goes wrong:**
Capability detection (auto-detecting what features a template supports) produces incorrect results:
- **False positive:** Template appears to support "custom form fields" when it only supports a hardcoded contact form
  - → Wizard shows "Configure form fields" step
  - → User configures 5 fields
  - → Deployed page ignores custom fields, shows hardcoded 2-field form
- **False negative:** Template actually supports brand colors but detection fails
  - → Wizard skips "Brand color" step
  - → User's color choice never applied
  - → Page deploys with default colors

**Root cause:**
- **Scoring-based detection:** Framework detection uses weighted signal matching (lines 109-135 in template-analyzer.js). Same approach applied to capability detection, but capabilities are more context-dependent
- **String pattern matching limitations:** Scanning for `"data-color"` attribute doesn't account for:
  - Hidden CSS variable declarations (nested in imports)
  - Dynamic color assignment (colors set via JavaScript, not CSS)
  - Conditional rendering (color support exists but only if certain config is present)
- **Manifest unreliability:** If template includes a `capability.json` manifest, it may be outdated or incorrect
- **High false positive cost:** Showing unsupported wizard steps wastes user time and creates frustration
- **High false negative cost:** Missing capabilities means user can't customize important aspects

**Consequences:**
- User experience degradation: Wizard shows irrelevant steps
- Deployment failures: Wizard stores unsupported config, template ignores it
- Support burden: Users report "changes don't apply" or "wrong colors deployed"
- Reduced uniqueness: Users can't customize when they should (false negatives)

**Prevention:**
1. **Multi-level capability detection (HIGH confidence required):**
   - **Level 1 (strongest):** Manifest file (`template-capabilities.json`) included with template
     ```json
     {
       "capabilities": {
         "customColors": true,
         "customFonts": true,
         "formFields": false,
         "customLayout": false
       }
     }
     ```
   - **Level 2 (medium):** Code inspection (same as current analyzer.js)
   - **Level 3 (weakest):** User override in wizard ("I know this template supports X")
2. **Conservative defaults (when uncertain):**
   - If detection confidence < 0.7, disable the capability
   - Show warning: "This template might not support custom colors. Verify the preview before deploying."
3. **Capability preview testing:**
   - When user configures a feature, preview it immediately
   - Preview template with config applied (use `template-preview-runtime.js`)
   - Show "Preview looks wrong? This template may not support this feature."
4. **Manifest over detection:**
   - If manifest exists, use it exclusively (ignore code inspection)
   - Recommend manifest as best practice: "Export template with capability manifest for better accuracy"
5. **Manual capability declaration in wizard:**
   - Last step before review: "Does this template support: custom colors? custom fonts? multiple form layouts?"
   - User can override auto-detection
   - Store user override in deploy config

**Detection (warning signs):**
- User reports "custom colors I set in wizard didn't apply" after deploy
- Wizard shows "Form fields" step but template doesn't expose form config
- Template detection shows <0.5 confidence (check analyzer.js output)
- Manifest file missing from imported template
- Same template sometimes works, sometimes doesn't (manifest not included in import)

**Phase mapping:**
- **Phase: Capability-Aware Wizard** — Implement multi-level detection strategy before release
- Dependency: Template analyzer must output `capabilityConfidence` score for each detected capability
- Suggests: Create `template-capabilities.json` schema, export with all future templates

---

## Moderate Pitfalls

### Pitfall 5: Imported Template Structure Variance Breaking Assumptions

**What goes wrong:**
Templates from Bolt.new and Loveable have inconsistent directory structures:
- Some have `src/pages/index.astro`, others have `pages/index.astro` or just `index.astro`
- Package.json versions vary wildly (Tailwind 2 vs 4, React 18 vs 19)
- Asset paths relative to root vs relative to src
- Config files may be missing (no astro.config.mjs, no tsconfig.json)

When wizard assumes standard structure, imports fail silently:
- Entry point detection succeeds but finds wrong file (returns `pages/index.astro` when `src/pages/index.astro` is the real entry)
- Preview generation loads wrong file, shows placeholder
- Build fails because config assumptions don't match

**Root cause:**
- Different template generators (Bolt, Loveable, v0, manual) follow different conventions
- No normalization step after import
- Entry point resolution uses suffix matching; multiple matches return first, not best

**Prevention:**
1. **Normalize structure after import:**
   - Move `pages/` → `src/pages/`, `components/` → `src/components/`, `styles/` → `src/styles/`
   - Ensure `astro.config.mjs`, `tsconfig.json`, `package.json` present with expected values
2. **Entry point detection — use all candidates:**
   - Don't stop at first match; rank all candidates and return highest-confidence match
   - Verify file exists at resolved path before returning
3. **Validate imported structure:**
   - After import, run `astro check --validate` on the template
   - If validation fails, show user the errors before saving template

**Detection (warning signs):**
- Preview shows "No entry point found" despite template having HTML files
- Build fails with "module not found" errors for relative imports
- Same template sometimes works, sometimes doesn't (depends on import method)
- Astro check reports "config error" for imported templates

**Phase mapping:**
- **Phase: Template Import Fix** — Implement normalization immediately after import

---

### Pitfall 6: Quality Check Markers Missing After Build

**What goes wrong:**
Quality checks for deployed templates look for required markers:
- Google Ads conversion tracking: `<!-- GA:CONVERSION -->` comment or `gtagConversion()` call
- Voluum pixel: `<img src="https://{domain}/pixel.gif" />`
- Viewport meta tag: `<meta name="viewport" ... />`

If template doesn't include these markers, quality checks fail. But the markers should be injected automatically by the build system, not required to be in source.

**Root cause:**
- **Marker injection incomplete:** Quality checks look for markers, but build process doesn't always inject them
- **Order dependency:** Markers injected too late (post-build step), but checks run before post-build
- **Conditional injection:** Some templates skip marker injection if they already include tracking (false assumption that old tracking works)

**Prevention:**
1. **Post-build marker injection:**
   ```javascript
   // After astro build, before deploy:
   injections = [
     { pattern: '</head>', insert: '<meta name="viewport" content="width=device-width, initial-scale=1.0">' },
     { pattern: '<body', insert: `<body><!-- GA:CONVERSION -->\n<!-- Voluum: ${voluumPixel} -->` }
   ];
   ```
2. **Quality check → marker check sequence:**
   - Run quality checks AFTER marker injection
   - Don't quality-check the raw template; quality-check the final deployed HTML
3. **Template manifest with required markers:**
   - Template declares "I require Google Ads tracking injection" or "I include my own conversion tracking"
   - Build system knows whether to inject or not

**Detection (warning signs):**
- Quality checks report "Missing Google Ads marker" even though template is deployed
- Voluum conversion tracking shows 0 events despite page traffic
- Manual inspection of deployed page source shows markers are present (but checks missed them)

**Phase mapping:**
- **Phase: Template Quality Validation** — Implement post-build marker injection and re-order checks

---

### Pitfall 7: Live Preview Not Reflecting Deployed Build Differences

**What goes wrong:**
Template preview in wizard uses `buildPreviewHtml()` which:
- Injects CDN dependencies (Tailwind via cdn.tailwindcss.com)
- Attempts to render templates in an iframe
- But doesn't run the actual build process

When template is deployed (runs real `astro build`), differences emerge:
- Tailwind CDN version differs from build-time version (generates different CSS)
- Client-side JavaScript doesn't execute in preview (functions appear broken)
- Build optimizations remove code preview includes (tree-shaking changes behavior)
- CSS-in-JS libraries don't work in HTML preview (they need JavaScript runtime)

User sees working preview, deploys, and page is broken.

**Root cause:**
- **Preview vs build difference:** Preview is iframe rendering, build is static generation — fundamentally different
- **No build simulation:** Preview doesn't actually run `astro build` to simulate final output
- **CDN timing:** Preview CDN may have different version than local build

**Prevention:**
1. **Warning on preview:** "This is a preview simulation. Actual deployed output may differ slightly due to build optimizations."
2. **Optional build simulation:**
   - For Astro templates: Actually run `astro build` in preview (takes 10-30 seconds)
   - Show build logs to user
   - Serve built output in preview iframe
3. **Test build before preview release:**
   - When user uploads template, immediately build it (background task)
   - If build fails, show error: "This template can't be built. Fix errors before saving."

**Detection (warning signs):**
- Preview shows working page, but deployed page shows Tailwind styling is missing
- User reports "form doesn't submit in preview but works on deployed page" (means JS runs in deployed version)
- CSS appears "broken" or "incomplete" in one but not the other

**Phase mapping:**
- **Phase: Template Preview** — Implement optional build simulation for templates that need it

---

## Minor Pitfalls

### Pitfall 8: Domain Uniqueness Requires More Than HTML Randomization

**What goes wrong:**
Randomizing HTML and CSS gives false confidence about uniqueness. Google detects pages as related through:
- **Whois data:** All domains registered to same organization/email
- **DNS records:** All use same nameservers or point to same IP
- **Canonical redirect chain:** All redirect to same conversion tracking domain
- **Server headers:** All use Cloudflare with same worker signatures

**Prevention:**
- Document that HTML randomization is only 20% of the anti-detection strategy
- Ensure domains registered under different registrants (if possible)
- Use different nameserver providers per domain
- Tracking redirects should route through different proxy layers
- Accept that 50+ completely unique domains at scale may not be achievable; target 30-40 detected as distinct

**Detection:** Monitor Google Ads account for "suspicious activity" warnings across multiple domains in same week

**Phase mapping:** **Phase: Scale to 50+ Domains** — Account structure and domain registration strategy critical

---

### Pitfall 9: Voluum Pixel Timing Creates Detection Fingerprint

**What goes wrong:**
Conversion tracking pixel fires at consistent timing after form submission. Google can detect that all landing pages from a source fire identical pixel sequence:
- Time 0ms: Page loads
- Time 200ms: Form renders
- Time 2000ms: Form submits
- Time 2100ms: Voluum pixel fires
- Time 2150ms: Google Ads pixel fires

Same timing across domains = detection.

**Prevention:**
- Randomize pixel firing delay ± 500ms per page
- Add random micro-interactions before firing pixels
- Vary form submission method (AJAX vs form post)
- Document that randomization is required; not automatable without breaking tracking

**Detection:** Review Voluum conversion logs; are all conversions coming in at same intervals?

**Phase mapping:** **Phase: Anti-Fingerprint** — Pixel timing randomization part of deployment config

---

### Pitfall 10: CSS-in-JS Dependencies Not Rendering in Static Build

**What goes wrong:**
If template uses styled-components, emotion, or other CSS-in-JS, the build process won't extract styles into static CSS because those libraries require JavaScript runtime.

Template imports CSS-in-JS library → Astro can't statically render → deployed page has no CSS.

**Prevention:**
- During capability detection, flag templates with CSS-in-JS as requiring special handling
- Recommend Tailwind or CSS Modules instead
- If template uses CSS-in-JS, either skip it or provide warning: "This template may not render correctly when deployed"

**Detection:** Deployed page has zero styling; inspect source, no `<style>` tags present

**Phase mapping:** **Phase: Multi-Format Support** — Detect CSS-in-JS during import, surface as incompatibility

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|---|---|
| **Template Import Fix** | Env var injection | Astro `import.meta.env.PUBLIC_*` not applied | Pre-process Astro files; inject values before build |
| **Template Import Fix** | Import structure | Inconsistent dir structure breaks assumptions | Normalize after import; validate entry point |
| **Capability-Aware Wizard** | Feature detection | False positives/negatives in capability detection | Implement multi-level detection; require manifest |
| **Capability-Aware Wizard** | Preview accuracy | Live preview differs from build output | Add build simulation or warning about differences |
| **Anti-Fingerprint** | HTML randomization | Only 20% effective against Google detection | Document that additional strategies required (domain registration, DNS, redirects) |
| **Multi-Format Support** | Build isolation | Concurrent builds interfere; memory exhaustion | Implement per-domain build directories; limit concurrency |
| **Multi-Format Support** | CSS-in-JS | Not supported in static build | Flag during import; recommend Tailwind/CSS Modules |
| **Scale to 50+ Domains** | Account structure | Google detects multiple domains as related | Plan domain/registrant strategy; expect <50% true uniqueness |
| **Scale to 50+ Domains** | Rate limiting | No protection on tracking endpoints | Implement rate limiting on pixel, callback, webhook endpoints |

---

## Summary

**Highest priority (Critical):**
1. Fix Astro env var injection (blocks effective customization)
2. Implement anti-fingerprint strategy beyond HTML randomization (blocks scale)
3. Build process isolation (blocks stability at scale)

**High priority (Should address in v1):**
4. Capability detection multi-level strategy (blocks accurate wizard)
5. Template structure normalization (blocks import reliability)

**Medium priority (v1.5+):**
6. Live preview build simulation (improves user confidence)
7. CSS-in-JS detection (prevents import failures)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Astro env injection | HIGH | Issue documented in CONCERNS.md; confirmed in astro-generator.jsx code |
| Anti-fingerprint effectiveness | HIGH | Based on PPC industry knowledge (Google Ads detection methods known) |
| Build isolation | HIGH | Typical failure pattern with multi-format builds |
| Capability detection | MEDIUM-HIGH | Template analyzer exists; confidence scoring is verifiable |
| Google detection methods | MEDIUM | Based on training data + CONCERNS.md; exact detection algorithms proprietary |

---

## Sources & Evidence

- **CONCERNS.md:** "Astro expression leak" flagged; blank mode template bug documented
- **PROJECT.md:** "PUBLIC_* env vars not applied"; "Sites appear unique to Google Ads" as requirement
- **astro-generator.jsx:** Shows `.env` created with `PUBLIC_*` variables; shows `import.meta.env.PUBLIC_*` in .astro templates
- **template-analyzer.js:** Shows scoring-based detection; capability detection not yet implemented
- **Template import flow:** MCP imports raw template files; no build step runs before preview

