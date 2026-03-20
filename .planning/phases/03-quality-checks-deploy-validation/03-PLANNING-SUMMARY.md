# Phase 3: Quality Checks & Deploy Validation — Planning Summary

**Created:** 2026-03-20
**Status:** ✓ PLANNING COMPLETE — Ready for execution
**Duration:** 4 plans across 3 execution waves

---

## Overview

Phase 3 establishes comprehensive pre-deploy validation gates that catch quality issues before Cloudflare upload. It implements:

1. **Viewport & Tracking Pixel Validation** (QUAL-01, QUAL-02)
2. **Astro Leak & Google Ads Detection** (QUAL-03, QUAL-04)
3. **Lighthouse 95+ Enforcement** (QUAL-05, QUAL-06)
4. **Regression Testing & E2E Integration** (QUAL-01–06)

---

## Phase Dependencies

**Blocks:** Phase 4 (Preview UX — optional)
**Blocked by:** Phase 2 (Build Pipeline — required)
**Critical path:** Phase 1 → Phase 2 → Phase 3

Phase 3 executes AFTER:
- Phase 1 (Template import fix) — ✓ Complete
- Phase 2 (Multi-format build + anti-fingerprinting) — Prerequisite

Phase 3 unblocks: v1 Release (quality gates ensure deploy readiness)

---

## Plans & Wave Structure

### Wave 1 (Parallel Execution)

#### Plan 01: QualityChecker Orchestrator + Viewport/Pixel Validators
- **Objective:** Foundation quality service with first two validators (QUAL-01, QUAL-02)
- **Files:** 6 files (orchestrator + 2 validators + 3 test files)
- **Tasks:** 5
  1. Create QualityChecker orchestrator (5-validator framework)
  2. Implement checkViewportMeta (viewport validation)
  3. Implement checkTrackingPixels (pixel detection)
  4. Write unit tests for QualityChecker + viewport (150 lines, 7 cases)
  5. Write unit tests for tracking pixels (180 lines, 8 cases)
- **Key insight:** Orchestrator is immutable (returns result objects, never throws)
- **Requirements:** QUAL-01, QUAL-02

#### Plan 02: Astro Leak Detection + Google Ads Validation
- **Objective:** Implement security validators (QUAL-03, QUAL-04)
- **Depends on:** Plan 01 (uses QualityChecker interface)
- **Files:** 4 files (2 validators + 2 test files)
- **Tasks:** 4
  1. Implement checkAstroLeaks (Astro expression detection)
  2. Implement checkGoogleAds (conversion tracking validation)
  3. Write unit tests for Astro leak detection (8 cases + regex patterns)
  4. Write unit tests for Google Ads validation (9 cases)
- **Key insight:** Pre-compiled regex patterns for performance; whitelist safe Astro builtins
- **Requirements:** QUAL-03, QUAL-04

---

### Wave 2 (Sequential — depends on Wave 1)

#### Plan 03: Lighthouse Integration + Pipeline Orchestration
- **Objective:** Implement performance validator (QUAL-05, QUAL-06) and integrate into TemplateBuilder
- **Depends on:** Plans 01, 02 (all validators must exist before integration)
- **Files:** 4 files (Lighthouse adapter + 1 test file + integration points)
- **Tasks:** 5
  1. Implement checkLighthouse (local Chrome launcher + async auditing)
  2. Create Lighthouse mocking strategy (for tests, offline execution)
  3. Write unit tests for Lighthouse validator (6 cases)
  4. Integrate quality checks into TemplateBuilder.transform()
  5. Add fallback logic (PageSpeed API if local unavailable)
- **Key insight:** Local Lighthouse execution avoids API rate limits; 120-second timeout; PageSpeed fallback is advisory-only
- **Critical integration:** Quality checks run AFTER AntiFingerprint.transform() in TemplateBuilder
- **Requirements:** QUAL-05, QUAL-06

---

### Wave 3 (Sequential — depends on Wave 2)

#### Plan 04: Regression Testing + E2E Validation
- **Objective:** Validate entire quality pipeline against ~15 Phase 1–2 templates
- **Depends on:** Plans 01, 02, 03 (full pipeline required)
- **Files:** 4 files (regression suite + e2e test + report generator)
- **Tasks:** 4
  1. Create regression test suite for ~15 existing templates
  2. Create e2e pipeline test (detect → build → fingerprint → quality check → deploy-ready)
  3. Verify no new failures introduced (backward compatibility)
  4. Generate 03-VALIDATION.md comprehensive report (coverage, gaps, recommendations)
- **Key insight:** Regression tests ensure Phase 1–2 changes don't break existing templates; e2e test validates full pipeline
- **Coverage target:** 80%+ per validator
- **Requirements:** QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06

---

## Requirement Mapping

All 6 Phase 3 requirements mapped:

| Requirement | Plan | What It Validates |
|-------------|------|-------------------|
| QUAL-01 | 01 | Viewport meta tag present and correctly formatted |
| QUAL-02 | 01 | Tracking pixel markers detected |
| QUAL-03 | 02 | No Astro expression leaks in built output |
| QUAL-04 | 02 | Google Ads conversion tracking properly configured |
| QUAL-05 | 03 | Lighthouse score >= 95 on all metrics |
| QUAL-06 | 03 | Quality checks run post-fingerprint, block deploy on critical failures |

**Plan 04** validates all 6 requirements together via regression + e2e testing.

---

## Technical Foundation

### Architecture Pattern: Immutable Results

All validators return result objects (never throw):

```javascript
// Example validator result (never throws)
{
  passed: true,
  severity: "critical",     // "critical" | "warning"
  message: "Viewport meta tag detected",
  details: {
    found: true,
    content: "width=device-width, initial-scale=1",
    lineNumber: 5
  }
}
```

**Rationale:** Allows orchestrator to collect ALL validation failures before deciding whether to block deploy. Critical failures block; warnings log only.

### Validator Implementations

**Plan 01 validators** (Cheerio-based DOM parsing):
- `checkViewportMeta(htmlContent)` → detects and validates viewport meta tag
- `checkTrackingPixels(htmlContent)` → finds Voluum/Google tracking markers

**Plan 02 validators** (Regex + AST-like parsing):
- `checkAstroLeaks(htmlContent)` → detects import.meta.env and template literal leaks
  - Pre-compiled patterns for performance
  - Whitelist: import.meta.env.DEV, PROD, SSR (safe built-ins)
  - Context reporting (line number + surrounding code)
- `checkGoogleAds(htmlContent)` → validates gtag scripts, conversion ID format, GCLID parameters

**Plan 03 validator** (Async — Chrome launcher):
- `checkLighthouse(htmlContent, options)` → local Lighthouse audit (offline)
  - Runs async; part of pipeline orchestration
  - Fallback: PageSpeed API (advisory-only)
  - 120-second timeout

### Test Framework

**Vitest 4.x** with globals enabled:
- No import needed for describe, it, expect
- Happy-DOM environment
- Mock patterns for async validators (Chrome launcher, Lighthouse)
- Coverage target: 80%+ per validator

---

## Integration Point: TemplateBuilder

Quality checks are called in `TemplateBuilder.transform()` **after** `AntiFingerprint.transform()`:

```javascript
// Simplified flow
async transform(htmlContent, siteId) {
  // Step 1: Build template
  let html = await this.build(template);

  // Step 2: Apply anti-fingerprinting transforms
  html = await AntiFingerprint.transform(html, siteId);

  // Step 3: RUN QUALITY CHECKS (NEW)
  const qualityResults = await QualityChecker.validate(html);

  // Step 4: Fail fast on critical issues
  if (qualityResults.hasCriticalFailures) {
    throw new Error(`Quality checks failed: ${qualityResults.criticalErrors}`);
  }

  // Step 5: Log warnings (non-blocking)
  if (qualityResults.warnings.length > 0) {
    logger.warn("Quality warnings:", qualityResults.warnings);
  }

  return html;
}
```

**Critical failures** (block deploy):
- Missing viewport meta tag
- Astro expression leaks
- Lighthouse < 95 on any metric

**Warnings** (log only):
- Missing tracking pixel (site may not need it)
- Missing GCLID parameter (Google Ads optional)

---

## Testing Strategy

### Unit Tests (Plans 01–03)
- **Viewport:** 7 cases (missing, with/without device-width, with/without initial-scale, etc.)
- **Tracking pixels:** 8 cases (Voluum, Google conversion, both, neither, inline vs external)
- **Astro leaks:** 8 cases (import.meta.env.PUBLIC_*, ${...env...}, safe builtins, in comments)
- **Google Ads:** 9 cases (gtag script, conversion ID format, GCLID parameter, various edge cases)
- **Lighthouse:** 6 cases (all metrics pass, some fail, Chrome unavailable, timeout)

**Total:** 38 unit test cases

### Regression Tests (Plan 04)
- ~15 Phase 1–2 templates (existing templates that must not break)
- Run full pipeline: detect → build → fingerprint → quality check
- Assert no NEW failures introduced (backward compatibility)

### E2E Test (Plan 04)
- Full pipeline: detect → build → fingerprint → quality check → deploy-ready
- Validates integration between all components
- Confirms critical failures block deploy, warnings surface

---

## Success Criteria

Phase 3 is complete when:

1. ✓ All 4 PLAN.md files created and committed
2. ✓ Wave structure maximizes parallelization (Plans 01–02 parallel, Plan 03 sequential, Plan 04 final)
3. ✓ All 6 requirements (QUAL-01–06) mapped to tasks
4. ✓ Each plan autonomous (no human checkpoints)
5. ✓ Integration point documented (TemplateBuilder.transform post-fingerprint)
6. ✓ Test strategy clear (38+ unit cases + regression + e2e)
7. ✓ Files committed to git

---

## Next Steps

### Immediate (after confirmation):
1. Review PLAN files for clarity and completeness
2. Confirm wave structure and dependencies
3. Execute Plan 01 (QualityChecker orchestrator)

### Phase 3 Execution:
```
Wave 1: Execute Plans 01 + 02 in parallel
        - Plan 01: QualityChecker + viewport/pixel validators
        - Plan 02: Astro leak + Google Ads validators

Wave 2: Execute Plan 03 (depends on 01+02)
        - Lighthouse integration + TemplateBuilder orchestration

Wave 3: Execute Plan 04 (depends on 01+02+03)
        - Regression + e2e testing + comprehensive report
```

### After Phase 3 Complete:
- Create comprehensive 03-VALIDATION.md report (coverage, gaps, recommendations)
- Update STATE.md with Phase 3 completion
- Proceed to Phase 4 (Template Preview & UX Polish) — optional for v1

---

## Files Created

```
.planning/phases/03-quality-checks-deploy-validation/
├── 03-01-PLAN.md           (QualityChecker + validators 1–2)
├── 03-02-PLAN.md           (Validators 3–4)
├── 03-03-PLAN.md           (Lighthouse + integration)
├── 03-04-PLAN.md           (Regression + e2e + report)
└── 03-PLANNING-SUMMARY.md  (This file)
```

---

## Appendix: Validator Test Coverage Breakdown

### Plan 01: Viewport & Tracking Pixel (7 + 8 = 15 tests)
- Viewport: Missing tag, missing width attribute, has device-width, has initial-scale, edge cases
- Pixels: Voluum pixel found, Google conversion pixel found, both found, neither found, inline vs external scripts

### Plan 02: Astro Leaks & Google Ads (8 + 9 = 17 tests)
- Astro: import.meta.env.PUBLIC_* in script, in template literal ${...}, safe builtins (DEV/PROD/SSR), in HTML comments (false positive avoidance)
- Google Ads: gtag script present, conversion ID format valid, GCLID parameter present, invalid conversion ID, missing gtag

### Plan 03: Lighthouse (6 tests)
- All metrics pass (>= 95)
- Performance fails (< 95)
- Multiple metrics fail
- Local Chrome unavailable (fallback to PageSpeed)
- Timeout (120 seconds)
- Invalid HTML input

### Plan 04: Regression + E2E (varies)
- ~15 existing templates (backward compatibility)
- Full pipeline test (detect → build → fingerprint → quality check → deploy-ready)
- Coverage report generation

**Total test cases: 38+ unit tests + regression suite + e2e**

---

*Phase 3 Planning Complete*
*Status: Ready for execution*
*Created: 2026-03-20*
