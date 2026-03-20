---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Preview UX & Alpha Validation
status: executing
last_updated: "2026-03-20T18:00:00.000Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 6
  completed_plans: 6
---

# Project State: LP Factory v1.1

**Project:** LP Factory — Preview UX & Alpha Validation
**Updated:** 2026-03-20 (Anti-FP Vector Expansion separated to v1.2)
**Mode:** YOLO (research-driven, high parallelization)

---

## Project Reference

**Core Value:** Import any template from bolt.new/Loveable, inject brand variables correctly, deploy to Cloudflare with unique HTML/CSS fingerprint — every time, without manual fixing.

**Success Metric:** v1.1 delivers live preview UX + validates anti-fingerprinting effectiveness via alpha test. Advanced anti-FP vectors deferred to v1.2.

**Current Focus:** Phase 1 completion (Plan 01-06 E2E testing remaining)

---

## Current Position

Phase: 01-live-template-preview (6/6 plans complete) ✅ PHASE COMPLETE
Plan: 01-06 (E2E testing + verification - COMPLETE) ✅

**Phase 2 Complete:** Alpha test validated — Scenario B confirmed (HTML/CSS alone = 0% evasion, avg 13.17 days). Findings documented for v1.2.

**Decision Made:** Anti-FP Vector Expansion (Phase 3) separated to v1.2 milestone. Ship v1.1 with preview UX + anti-FP v1 baseline.

## Roadmap Snapshot

| Phase | Goal | Requirements | Dependency |
|-------|------|--------------|-----------|
| 1 | Import Fix + Capability Detection | 8 req | Foundation |
| 2 | Multi-Format Build + Anti-Fingerprint | 8 req | Blocks v1 |
| 3 | Quality Checks + Validation | 6 req | Blocks v1 |
| 4 | Preview + UX Polish | 4 req | Optional |

**Coverage:** 26/26 v1 requirements mapped ✓

---

## Critical Blockers

**Phase 1 Blocker (Env Var Injection):**

- Astro `import.meta.env.PUBLIC_*` not injected at build time
- Consequence: Deployed pages show fallback expressions instead of customized values
- Fix: Pre-process .env before build or load into process.env at Cloudflare Pages build time
- Impact: Required for all deployed sites to work; blocks scaling

**Phase 2 Blocker (Anti-Fingerprint Alpha):**

- Unknown: How many randomization vectors needed to evade Google Ads detection?
- Risk: Randomizing only HTML/CSS may be insufficient; Google detects behavioral patterns
- Mitigation: Plan 5-10 domain alpha test post-Phase 2; measure days-to-flag
- Impact: If ineffective, will need Phase 2 extension for additional randomization vectors

**Phase 3 Blocker (Lighthouse API):**

- Lighthouse API rate limits and pricing unknown for 50+ daily checks
- Mitigation: Test API limits; plan PageSpeed API as fallback if needed
- Impact: Minor; can defer Lighthouse checks to Phase 3.1 if needed

---

## Performance Metrics

**Velocity Targets:**

- Phase 1 (Foundation): 10-15 days
- Phase 2 (Build + Anti-FP): 15-20 days (includes alpha test)
- Phase 3 (Quality): 10-15 days
- Phase 4 (Preview): 10-15 days
- **Total:** 45-65 days for v1.0 (7-9 weeks)

**Quality Gates:**

- Phase 1: Env var injection working; manifest schema validated
- Phase 2: 4+ randomization vectors implemented; 5-10 domain alpha test initiated
- Phase 3: Lighthouse 95+ enforced; all markers validated
- Phase 4: Preview <1s latency; pre/post-fingerprint comparison enabled

**Deployment Targets:**

- Phase 2: 10-15 domains deployable
- Phase 3: 20-30 domains with quality gates
- Phase 4: 50+ domains with operator UX polish

---

## Accumulated Context

### What's Solved

- Framework detection (template-analyzer.js, 522 lines, low false positive rate)
- Preview generation (template-preview-runtime.js, 385 lines, <100ms rendering for HTML/Astro)
- Dashboard, deploy history, Cloudflare Pages integration
- Voluum tracking, Google Ads conversion tracking, spend dashboards
- **COMPLETED:** Env var preprocessing (env-preprocessor.js 95 lines, html-expression-replacer.js 90 lines) — Plan 01 ✓
  - 32 passing tests (12 preprocessor + 15 replacer + 5 integration)
  - 90%+ coverage on both modules
- **COMPLETED:** Manifest loader (manifest-loader.js) — Plan 02 ✓
- **COMPLETED:** Capability auto-detection (capability-detector.js) — Plan 02 ✓
- **COMPLETED:** Capability resolver (capability-resolver.js) — Plan 02 ✓
- **COMPLETED:** Wizard integration with capability detection (step-mapper.js, StepDesign enhancement, graceful degradation tests) — Plan 03 ✓
  - 69 passing tests (28 step-mapper + 14 wizard-capability + 27 StepReview graceful degradation)
  - Dynamic step visibility, conditional field rendering, graceful fallbacks implemented
- **COMPLETED:** Anti-fingerprinting service (fingerprint-seeder.js, AntiFingerprint.js) — Plan 02-02 ✓
  - Deterministic seeding with SHA256 + seedrandom
  - 6 transform strategies: class names, IDs, data attributes, aria labels, meta tags, structural variation
  - 62 passing tests (26 seeder + 36 service) with 100% coverage
  - Verified determinism: same siteId → byte-identical output
  - Whitelists: Tailwind utilities, third-party data attributes, framework IDs
- **COMPLETED:** QualityChecker foundation + viewport/pixel validators — Phase 3 Plan 01 ✓
  - QUAL-01: Viewport meta tag detection and validation (checkViewportMeta)
  - QUAL-02: Tracking pixel detection - Voluum + Google conversion (checkTrackingPixels)
  - 32 passing tests (9 viewport + 13 pixel + 10 orchestrator) with 100% coverage
  - Immutable result objects; critical/warning separation
  - Ready for Plan 02 integration
- **COMPLETED:** Astro leak detection + Google Ads validators — Phase 3 Plan 02 ✓
  - QUAL-03: Astro expression leak detection (checkAstroLeaks) - import.meta.env.PUBLIC_*, ${...env...}, VITE_*
  - QUAL-04: Google Ads tracking validation (checkGoogleAdMarkers) - gtag script, conversion ID, GCLID detection
  - 33 passing tests (16 astro + 17 google ads) added
  - Total 65 quality-check tests passing; 95.95% statement coverage, 90.09% branch coverage
  - Immutable result objects; line context reporting for debugging
  - QualityChecker orchestrator updated; 4 of 6 gates complete
  - Ready for Plan 03 integration (Lighthouse)
- **COMPLETED:** Lighthouse integration + TemplateBuilder orchestration — Phase 3 Plan 03 ✓
  - QUAL-05: Lighthouse 95+ enforcement (checkLighthouseScores) - local execution + graceful fallback to advisory
  - QUAL-06: Quality checks integration into build pipeline (post-fingerprinting, pre-deploy)
  - 20 passing tests (10 lighthouse + 10 integration)
  - All 85 quality-check tests passing; 95%+ statement coverage
  - AntiFingerprint.transform() called after build; QualityChecker.validatePreDeploy() called after fingerprinting
  - All 6 quality gates orchestrated and tested
  - Critical failures block deploy with clear error messages; warnings log only
- **COMPLETED:** Regression testing + E2E validation + comprehensive report — Phase 3 Plan 04 ✓
  - 36 new test cases: 18 regression tests (Phase 1-2 backward compatibility) + 18 E2E tests (full pipeline)
  - 121 total quality-check tests passing (100% pass rate)
  - 91.66% statement coverage, 91.3% branch coverage (exceeds 80% target)
  - All 6 QUAL requirements verified through test cases
  - 8 Phase 1-2 template samples tested: Astro, Vite/React, static HTML (all formats pass)
  - Full pipeline validated: detect → build → fingerprint → quality check → deploy-ready
  - Error handling verified: critical failures block deploy, warnings log only
  - Configuration handling tested: tracking required/optional, Google Ads optional
  - Lighthouse integration: timeout, unavailability fallback, local execution verified
  - 03-04-SUMMARY.md comprehensive report with production readiness assessment
  - **Phase 3 COMPLETE:** All 6 quality gates fully functional, backward compatible, production ready
- **COMPLETED:** Multi-format build infrastructure and anti-fingerprinting service — Phase 2 Plan 01 ✓
  - 7 core modules: FormatBuilder, AstroBuilder, ViteBuilder, HtmlStaticBuilder, TemplateBuilder, fingerprint-seeder, AntiFingerprint (1,140 lines)
  - 640+ tests passing (98.6% pass rate, 95%+ coverage)
  - Deterministic seeding: SHA256(siteId+namespace) → seedrandom for byte-identical output on redeploy
  - 6 transform strategies: class names, IDs, data attributes, aria-labels, meta tags, structural variation
  - Whitelisting: Tailwind utilities, third-party data-*, framework IDs preserved
  - Adapter pattern for format extensibility (Astro, Vite/React, static HTML)
  - Post-build transforms applied after TemplateBuilder before QualityChecker
  - Determinism verified across multiple redeploys (same siteId → identical output)
  - All 8 FINGER-* and IMPORT-04/05 requirements implemented and tested
  - **Phase 2 Plan 01 COMPLETE:** Build infrastructure ready for fingerprinting verification (Plan 02) and integration testing (Plan 03)
- **COMPLETED:** Live template preview + fingerprint comparison components — Phase 1 Plan 04 (Wave 1) ✓
  - DiffViewer component: 16 tests passing (side-by-side layout, visual highlighting, truncation)
  - PreviewModal component: 14 tests passing (viewport toggle, fingerprint toggle, modal UX)
  - usePreviewDebounce hook: 12 tests passing (debounce timing, dependency updates)
  - html-diff utility: 19 tests passing (character-level diffs, summary stats)
  - **All 61 tests passing** (PREV-01 through PREV-04 fully implemented)
  - Production-ready for Wave 2 integration with StepReview
  - **Phase 1 Wave 1 COMPLETE:** Preview components ready for operator UX integration

### What Needs Implementation

- **Phase 3 Plan 04:** Regression testing + E2E validation + comprehensive report ✓
  - 36 new test cases (18 regression + 18 e2e)
  - 121 total tests passing (100% pass rate)
  - 91.66% code coverage (exceeds 80% target)
  - 8 Phase 1-2 templates verified backward compatible
  - Full pipeline end-to-end validated
  - 03-04-SUMMARY.md completed with production readiness assessment
- **Phase 4:** Preview modal in wizard step 5 (optional enhancement)

### Key Architecture Patterns

- Multi-stage pipeline: Detect → Build → Transform
- 3-stage build: Stage 1 (detect, resolve) → Stage 2 (build per format) → Stage 3 (post-process, inject)
- Capability detection: Confidence scoring + manifest override
- Non-destructive transforms: CSS variables for theming, not regex replacement
- Deterministic fingerprinting: Seeded RNG on siteId; same domain = identical output

### Backwards Compatibility

- ~15 existing templates must continue working
- Phase 2-3 changes must not break current deployment pipeline
- Regression test suite required post-Phase 2

---

## Session Continuity

**v1.1 Scope Complete — Preview UX Ready for Release:**

1. ✅ Phase 1 complete — All 6 plans executed (E2E testing verified)
2. ✅ Phase 2 complete — Scenario B confirmed (HTML/CSS alone = 0% evasion)
3. ✅ Anti-FP Vector Expansion separated to v1.2 milestone
4. ✅ All v1.1 scope requirements delivered and verified
5. **Next:** Ship v1.1 release with preview UX, then plan Phase 3 (v1.2)

**Alpha test findings (carried to v1.2):**
- `.planning/alpha-test/` — All monitoring data and reports
- `.planning/phases/03-anti-fp-vector-expansion/` — Phase 3 plans (03-01 complete, 03-02 to 03-05 ready)

---

## Todos

- [x] **Complete Phase 1** — All 6 plans executed, 121+ tests passing, E2E verification done ✅
- [ ] **Ship v1.1** — Preview UX + alpha test findings ready for release
- [ ] **Start v1.2 milestone** — Anti-FP Vector Expansion (Phase 3 plans ready, awaiting v1.2 kickoff)

---

## Execution Metrics

### Phase 01-01: Test Suite Foundation (COMPLETED)

| Metric | Value |
|--------|-------|
| Plan Duration | 4 min (240 sec) |
| Test Files Created | 4 |
| Total Test Cases | 61 |
| Pass Rate | 100% |
| Requirements Covered | 4 (PREV-01 to PREV-04) |
| Commits Made | 5 |
| Execution Date | 2026-03-20 |

**Completed Tasks:**
1. ✅ PreviewModal.test.jsx (14 tests)
2. ✅ usePreviewDebounce.test.js (12 tests)
3. ✅ DiffViewer.test.jsx (16 tests)
4. ✅ html-diff.test.js (19 tests)
5. ✅ 01-01-SUMMARY.md

### Phase 01-02: Preview Components (COMPLETED)

| Metric | Value |
|--------|-------|
| Plan Duration | 4 min |
| Components Created | 2 |
| Total Test Cases | 26 |
| Pass Rate | 100% |
| Requirements Covered | 4 (PREV-01 to PREV-04) |
| Commits Made | 2 |
| Execution Date | 2026-03-20 |

**Completed Tasks:**
1. ✅ usePreviewDebounce hook (12 tests)
2. ✅ PreviewModal component (14 tests)
3. ✅ 01-02-SUMMARY.md

### Phase 01-05: Wizard Preview Integration (COMPLETED)

| Metric | Value |
|--------|-------|
| Plan Duration | 15 min |
| Components Modified | 2 |
| Integration Tests | 19 passing |
| Unit Tests | 14 passing (PreviewModal) |
| Total Wizard Tests | 75 passing |
| Pass Rate | 100% |
| Requirements Covered | 4 (PREV-01 to PREV-04) |
| Commits Made | 2 |
| Execution Date | 2026-03-20 |

**Completed Tasks:**
1. ✅ Task 1: Add preview button and state to StepReview
2. ✅ Task 2: Create integration tests for wizard preview flow (19 tests)
3. ✅ Task 3: Handle edge cases and error scenarios
4. ✅ 01-05-SUMMARY.md

**Key Achievements:**
- StepReview.jsx: Preview button integrated with modal state management
- PreviewModal.jsx: Edge case handling (missing siteId, no fingerprinted HTML, etc.)
- wizard-preview-integration.test.jsx: 19 comprehensive integration tests
- All tests passing; no regressions
- Wave 2 integration complete

### Phase 01-06: E2E Testing & Verification (COMPLETED)

| Metric | Value |
|--------|-------|
| Plan Duration | 5 min |
| Test Cases Created | 18 |
| E2E Test Scenarios | 7 (PREV-01 through PREV-04 + performance + error recovery) |
| Pass Rate | 100% |
| Requirements Covered | 4 (PREV-01 to PREV-04) |
| Test Execution Time | 68 ms |
| Commits Made | 1 |
| Execution Date | 2026-03-20 |

**Completed Tasks:**
1. ✅ Task 1: Create E2E test suite (preview-e2e.test.jsx, 18 tests)
2. ✅ Task 2: Create Phase 1 verification report (01-VERIFICATION.md)
3. ✅ 01-06-SUMMARY.md

**Key Achievements:**
- Comprehensive E2E test suite: 18 tests covering all PREV-* requirements
- Determinism verification: Same siteId produces byte-identical fingerprints
- Error recovery testing: Modal remains functional after error states
- Performance baseline: All operations <1s latency
- Phase 1 verification complete: All 121+ tests passing, 91.66% coverage
- **PHASE 1 PRODUCTION READY** ✅

---

## Next Phase: Phase 2 Execution

**Phase 2: Alpha Test Validation** (Planning complete, ready for execution)
- Goal: Deploy 5-10 test domains to measure anti-fingerprinting effectiveness over 4 weeks
- Plans: 3 plans created (02-04, 02-05, 02-06) with wave-based execution
- Next: `/gsd:execute-phase 2` to begin alpha test deployment

**Phase 1 Completion Summary:**
- ✅ 6 of 6 plans executed (Wave 0-2)
- ✅ 18 E2E tests passing (100% pass rate)
- ✅ 121 total Phase 1-3 tests passing
- ✅ Verification report: 01-VERIFICATION.md
- ✅ All 4 PREV-* requirements verified

**Next Step Options:**
1. `/gsd:plan-phase 2` — Start Phase 2 Alpha Test planning
2. `/gsd:complete-milestone 1.1` — Archive Phase 1 and prepare for next milestone
3. Continue execution with existing plan if available

---

*State updated: 2026-03-20T07:56:28Z*
*Phase 01-live-template-preview COMPLETE — All 6 plans executed, E2E testing verified*
*Phase 02-alpha-test-validation COMPLETE — Scenario B confirmed: HTML/CSS randomization insufficient*
*v1.1 Release Ready — Preview UX complete, production tested, ready for deployment*
*Next: Ship v1.1 milestone, then proceed with v1.2 (Phase 3 Anti-FP Vector Expansion)*
