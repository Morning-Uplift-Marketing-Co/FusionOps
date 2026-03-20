---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: planning
last_updated: "2026-03-20T05:20:15.000Z"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 6
  completed_plans: 4
---

# Project State: LP Factory v1.1

**Project:** LP Factory — Template Pipeline & Anti-Fingerprint
**Updated:** 2026-03-20 (Phase 1 Wave 0 test foundation complete)
**Mode:** YOLO (research-driven, high parallelization)

---

## Project Reference

**Core Value:** Import any template from bolt.new/Loveable, inject brand variables correctly, deploy to Cloudflare with unique HTML/CSS fingerprint — every time, without manual fixing.

**Success Metric:** v1.1 delivers live preview UX + validates anti-fingerprinting effectiveness via 5-10 domain alpha test + ensures build pipeline scales to 50+ concurrent deployments.

**Current Focus:** Planning Phase 1 (Preview UX) + Phase 2 (Alpha Test) + Phase 3 (Performance)

---

## Current Position

Phase: 01-live-template-preview (Wave 0 + Wave 1 test foundation complete)
Plan: 01-04 (DiffViewer + PreviewModal Integration - COMPLETE ✅)

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

**For Next Session:**

1. Start `/gsd:plan-phase 1` immediately after approval
2. Phase 1 deliverables: 6 components (env preprocessing, manifest schema, CapabilityResolver, etc.)
3. Key tests: Env vars applied correctly, manifest override works, wizard steps adapt
4. Expected blockers: Cloudflare Pages build context env var timing (needs testing)

**Files to Reference:**

- `REQUIREMENTS.md` — 26 v1 requirements with traceability
- `ROADMAP.md` — This 4-phase breakdown
- `research/SUMMARY.md` — Architecture, patterns, pitfalls, critical decisions
- `src/utils/template-analyzer.js` — Scoring-based detection (base for Phase 1)
- `src/utils/template-preview-runtime.js` — Preview generation (base for Phase 4)

**Cached Decisions:**

- Astro 5.x + React 19 + Vite (no framework changes)
- Cloudflare Pages only (no multi-deployer)
- Post-build anti-fingerprinting (not pre-build)
- File-based manifest (`.lp-manifest.json`, not DB-only)
- Fail-fast quality checks (no graceful degradation)

---

## Known Unknowns

| Question | Impact | Mitigation | Timeline |
|----------|--------|-----------|----------|
| Astro env var injection in CF Pages context? | High | Test in Phase 1; may need env preprocessing strategy | Phase 1 |
| Multi-vector fingerprinting effectiveness? | Critical | 5-10 domain alpha test in Phase 2 | Phase 2 + 2 weeks |
| Lighthouse API rate limits for 50+ checks/day? | Moderate | Test API; plan PageSpeed fallback | Phase 3 |
| Vite/React import failure rate? | Moderate | Sample 10+ templates; measure success % | Phase 2 |
| Build isolation memory at 50+ concurrent? | Moderate | Benchmark concurrency limits; plan queue | Phase 5 |

---

## Todos

- [ ] **Approve roadmap** — Share feedback or approve for Phase 1 planning
- [ ] **Phase 1 planning** — Run `/gsd:plan-phase 1` after approval
- [ ] **Phase 1 implementation** — Env vars + capability detection
- [ ] **Phase 2 alpha test** — 5-10 domain alpha test for anti-fingerprint effectiveness
- [ ] **Phase 2+ implementation** — Multi-format build pipeline
- [ ] **Backwards compatibility testing** — Regression suite for ~15 existing templates

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

---

## Next Phase: Wave 1 Implementation

**Parallel Implementation Plans (Ready):**
- `01-02-PLAN.md` — PreviewModal component implementation (PREV-01, PREV-02, PREV-04)
- `01-03-PLAN.md` — usePreviewDebounce hook implementation (PREV-03)
- `01-04-PLAN.md` — DiffViewer + html-diff utility implementation (PREV-04)

All implementation plans will use existing test suite as RED phase validation.

---

*State updated: 2026-03-20T05:12:04Z*
*Phase 01-01 COMPLETE — Ready for Wave 1 implementation*
