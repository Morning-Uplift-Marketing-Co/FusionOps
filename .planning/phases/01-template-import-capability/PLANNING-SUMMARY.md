# Phase 1 Planning Complete

**Phase:** 01-template-import-capability
**Date:** 2026-03-20
**Plans Created:** 3
**Requirements Addressed:** 8/8 (IMPORT-01, IMPORT-02, IMPORT-03, CAPAB-01, CAPAB-02, CAPAB-03, CAPAB-04, CAPAB-05)

---

## Overview

Phase 1 establishes the foundation for the LP Factory by fixing the critical Astro environment variable injection blocker and implementing a multi-level capability detection framework that adapts the wizard to template capabilities.

**Critical Blocker Fixed:** Astro `PUBLIC_*` environment variables not injected at build time, causing deployed pages to show `import.meta.env.PUBLIC_*` expressions instead of actual values (brand name, conversion IDs, tracking domains).

**Foundation Built:** Multi-level capability detection (manifest + auto-detect + user override) enables the wizard to dynamically show/hide steps based on what each template actually supports.

---

## Plans at a Glance

### Plan 01: Env Var Injection & Template Normalization (Wave 1)
**Requirements:** IMPORT-01, IMPORT-02, IMPORT-03
**Dependencies:** None (Wave 1 - can run in parallel)
**Tasks:** 3 (15+ tests)

**What it fixes:**
- Astro env var injection via two-stage pipeline (preprocessing + post-build rewriting)
- Post-build HTML scanning to catch leaked expressions
- Template structure normalization (src/ standardization, config file generation)

**Key Modules:**
- `src/utils/env-preprocessor.js` — Replace `import.meta.env.PUBLIC_*` in .astro files before build
- `src/utils/html-expression-replacer.js` — Scan built HTML for leaked expressions and replace them
- `src/utils/template-normalizer.js` — Standardize directory structure and ensure config files exist

---

### Plan 02: Capability Detection Framework (Wave 1)
**Requirements:** CAPAB-01, CAPAB-02, CAPAB-05
**Dependencies:** None (Wave 1 - can run in parallel)
**Tasks:** 3 (18+ tests)

**What it builds:**
- Manifest loading and validation (.lp-manifest.json schema)
- Auto-detection via signal scoring (confidence-based with 5 capability types)
- Capability resolution merging manifest + auto-detect + user override

**Key Modules:**
- `src/utils/manifest-loader.js` — Load and validate .lp-manifest.json
- `src/utils/capability-detector.js` — Auto-detect template capabilities with confidence scores
- `src/utils/capability-resolver.js` — Merge all three sources with priority (manifest > override > auto-detect)

**Capability Types Detected:**
- supportsCalculator (calculator fields for loan/mortgage calculations)
- supportsSectionReorder (dynamic section reordering)
- supportsCustomColors (CSS-based color customization)
- supportsFormCustomization (custom form handling)
- supportsImageUpload (image upload functionality)

---

### Plan 03: Wizard Capability-Aware Integration (Wave 2)
**Requirements:** CAPAB-03, CAPAB-04
**Dependencies:** Plan 01 + Plan 02 (Wave 2)
**Tasks:** 3 (16+ tests)

**What it integrates:**
- Step mapper: Translate capabilities to wizard step visibility
- Conditional field rendering: Design step shows only supported sub-fields
- Graceful degradation: Preview renders safely with missing features, shows warnings

**Key Modules:**
- `src/components/Wizard/step-mapper.js` — Map capabilities to enabled steps
- `src/components/Wizard/steps/StepDesign.jsx` — Enhanced with conditional field rendering
- `src/components/__tests__/StepReview.test.jsx` — Tests for graceful degradation

**User Experience:**
- Design step only shows fields for supported features (calculator, section reorder, colors)
- Warnings displayed when user configures unsupported features
- Preview renders safely even with missing features (shows placeholder sections, default values)

---

## Wave Structure

```
Wave 1 (Parallel):
  - Plan 01: Env var injection + normalization
  - Plan 02: Capability detection framework

Wave 2 (Sequential on Wave 1):
  - Plan 03: Wizard integration
```

**Execution Time Estimate:**
- Wave 1 plans: 60-90 minutes each (can run in parallel → ~90 minutes total)
- Wave 2 plan: 45-60 minutes (depends on Wave 1)
- **Total Phase 1: ~150 minutes (~2.5 hours)**

---

## Test Coverage

**Total tests:** 49+ (15+ per plan)
**Test framework:** vitest (already in package.json)
**Coverage targets:** 80%+ per module

**Test command:**
```bash
# Quick per-plan verification (after each task)
npx vitest run src/utils/__tests__/ --reporter=verbose

# Full phase verification
npx vitest run --reporter=verbose
```

---

## Key Design Decisions

### 1. Two-Stage Env Var Injection
**Why:** Astro `PUBLIC_*` variables must be injected at build time. No `.env` file loading by default.
- **Stage 1 (Pre-build):** Replace `import.meta.env.PUBLIC_*` with hardcoded values in .astro files
- **Stage 2 (Post-build):** Scan HTML for any remaining leaked expressions and replace them
- **Safety:** Conservative; if Stage 1 misses anything, Stage 2 catches it

### 2. Multi-Level Capability Detection
**Why:** Templates have unpredictable structures; single detection approach insufficient.
- **Level 1 (Manifest):** Template author explicitly declares capabilities (confidence = 1.0)
- **Level 2 (Auto-detect):** Pattern-based scoring from 0.6–0.95 confidence
- **Level 3 (User override):** User corrects false positives/negatives (confidence = 1.0)
- **Priority:** Manifest > User Override > Auto-detect

### 3. Conservative Auto-Detection
**Why:** Better to under-detect than over-detect (false negative < false positive).
- Confidence threshold: 0.65 (if below, disable feature by default)
- User can enable disabled features via override checkbox
- Manifest provides escape hatch for known templates

### 4. Graceful Degradation in Preview
**Why:** User should see preview even if template lacks configured features.
- If calculator configured but not supported: show placeholder calculator
- If colors configured but not supported: ignore color settings, use template defaults
- If sections reordered but not supported: show original order with warning
- All warnings non-blocking; preview still renders

---

## Integration Points with Existing Code

### Existing Modules Used
- `src/utils/template-analyzer.js` (522 lines) — Framework detection, file scanning helpers
- `utils/astro-generator.jsx` — Generates .env files (will use these values in preprocessor)
- `src/utils/template-preview-runtime.js` — Preview rendering (works with graceful degradation)
- `astro.config.mjs` — Astro build configuration

### New Integration Points (for Executor)
- **Build pipeline:** Will need to call `preprocessAstroEnvVars()` before `astro build` in Phase 2
- **Template import:** Will need to call `normalizeTemplate()` after ZIP extraction
- **Post-build:** Will need to call `replaceLeakedExpressions()` on dist/index.html
- **Wizard:** Will need to call `resolveCapabilities()` to determine step visibility
- **Wizard steps:** StepDesign will accept `fields` prop from step-mapper

---

## Success Criteria for Phase 1

Phase 1 complete when all of the following are true:

1. **Env var injection works end-to-end:**
   - Build a test Astro template with `PUBLIC_BRAND` and `PUBLIC_CONVERSION_ID`
   - Run preprocessing → build → post-build rewriting
   - Inspect final HTML: Should contain actual values, not `import.meta.env.*` expressions
   - IMPORT-01, IMPORT-02 verified

2. **Template normalization verified:**
   - Import a template with `pages/` at root (Loveable structure)
   - Run normalizer
   - Verify structure is `src/pages/`, `src/components/`
   - Verify astro.config.mjs and tsconfig.json created
   - IMPORT-03 verified

3. **Capability detection accurate:**
   - Test on 5+ diverse templates (Bolt, Loveable, v0 samples)
   - Measure detection accuracy: >80% for high-confidence signals
   - Manifest loading works for templates with .lp-manifest.json
   - CAPAB-01, CAPAB-02, CAPAB-05 verified

4. **Wizard UI adapts correctly:**
   - Template with no calculator support → Design step hides calculator fields
   - Template with no section reorder → Design step hides reorder UI
   - Template with all features → All Design sub-fields visible
   - Warnings show for unsupported features
   - CAPAB-03, CAPAB-04 verified

5. **All tests pass:**
   - `npx vitest run` shows all 49+ tests green
   - No console.error or warnings
   - Feedback latency <15s
   - Nyquist compliance verified

---

## Known Open Questions (for Executor)

1. **Cloudflare Pages env var timing:**
   - Can custom `PUBLIC_*` vars be passed to Cloudflare Pages build via GitHub Actions secrets?
   - If not, preprocessing approach alone may be sufficient (manual env var injection at deploy time)
   - Plan 01 tests will reveal if preprocessing is sufficient

2. **Manifest adoption timeline:**
   - Phase 1: Manifests optional (auto-detect fallback)
   - Phase 2: Consider requesting manifests for top 5 templates

3. **False negative tolerance:**
   - Current: <10% false negative acceptable (user can override)
   - Test on diverse templates will calibrate this

---

## Files Created by Phase 1

**Utilities:**
- src/utils/env-preprocessor.js
- src/utils/html-expression-replacer.js
- src/utils/template-normalizer.js
- src/utils/manifest-loader.js
- src/utils/capability-detector.js
- src/utils/capability-resolver.js

**Components:**
- src/components/Wizard/step-mapper.js
- src/components/Wizard/steps/StepDesign.jsx (Enhanced)
- src/components/__tests__/StepReview.test.jsx

**Test files:**
- src/utils/__tests__/env-preprocessor.test.js
- src/utils/__tests__/html-expression-replacer.test.js
- src/utils/__tests__/template-normalizer.test.js
- src/utils/__tests__/manifest-loader.test.js
- src/utils/__tests__/capability-detector.test.js
- src/utils/__tests__/capability-resolver.test.js
- src/components/Wizard/__tests__/step-mapper.test.js
- src/components/Wizard/__tests__/wizard-capability.test.jsx
- src/components/__tests__/StepReview.test.jsx

**Total new code:** ~1,200 lines (including tests)

---

## Next Phase (Phase 2)

After Phase 1 executes successfully:
1. Run `/gsd:plan-phase 2` to plan multi-format build pipeline
2. Phase 2 will depend on:
   - Normalized templates (from Plan 01)
   - Capability manifests (from Plan 02)
   - Wizard step mapping (from Plan 03)
3. Phase 2 will implement:
   - Format-specific builders (Astro, Vite/React, static HTML)
   - Deterministic anti-fingerprinting (seeded RNG)
   - Build orchestration with isolation

---

*Planning completed: 2026-03-20*
*Status: Ready for execution*
