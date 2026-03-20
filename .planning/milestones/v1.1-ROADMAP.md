# Roadmap: LP Factory v1.1 — Preview UX & Alpha Validation

**Defined:** 2026-03-20
**Updated:** 2026-03-20 (separated Anti-FP Vector Expansion to v1.2)
**Granularity:** Coarse (2 phases)
**Mode:** YOLO (research-driven, parallelization enabled)

---

## Phases

- [x] **Phase 1: Live Template Preview** - Enable operators to preview with injected variables, viewport toggle, and fingerprint diagnostics ✅ COMPLETE
- [x] **Phase 2: Alpha Test Validation** - Deploy 5-10 test domains, measure anti-fingerprinting effectiveness vs Google Ads ✅ COMPLETE

---

## Phase Details

### Phase 1: Live Template Preview

**Goal:** Implement live preview modal in Wizard Step 5 (Review) with real-time variable injection, mobile/desktop viewport toggle, and pre/post-fingerprint comparison.

**Depends on:** v1.0 complete (all templates, build pipeline, quality checks functional)

**Requirements:** PREV-01, PREV-02, PREV-03, PREV-04

**Success Criteria** (what must be TRUE):
  1. Preview modal renders template in iframe with site-specific variables injected (no template re-upload needed)
  2. Mobile (320px) / desktop (1024px) viewport toggle available; layout responsive in both viewports
  3. Real-time preview refresh when user changes brand variables; debounced <1s latency
  4. Toggle view shows pre-fingerprint (original) and post-fingerprint (randomized) HTML side-by-side or tabbed

**Plans:**
- [x] 01-01-PLAN.md — Test suite (Wave 0) ✅
- [x] 01-02-PLAN.md — PreviewModal + usePreviewDebounce hooks (Wave 1) ✅
- [x] 01-03-PLAN.md — DiffViewer + html-diff utility (Wave 1) ✅
- [x] 01-04-PLAN.md — PreviewModal + DiffViewer integration (Wave 1) ✅
- [x] 01-05-PLAN.md — StepReview integration (Wave 2) ✅
- [x] 01-06-PLAN.md — E2E testing + verification (Wave 2) ✅

---

### Phase 2: Alpha Test Validation

**Goal:** Deploy complete test suite (5-10 domains) with v1.0 pipeline to measure anti-fingerprinting effectiveness and detect Google Ads detection timeline.

**Depends on:** Phase 1 complete (optional; can run in parallel with Phase 1)

**Requirements:** ALPHA-01, ALPHA-02, ALPHA-03

**Success Criteria** (what must be TRUE):
  1. 5-10 test domains deployed with fingerprinting across all vectors (CSS classes, IDs, meta tags, structural variation)
  2. Google Ads system behavior tracked over 4+ weeks; days-to-flag documented per domain
  3. Report generated identifying randomization gaps and recommendations for additional vectors (behavioral, registrant, etc.)

**Plans:**
- [x] 02-04-PLAN.md — Deploy 5-10 test domains with anti-fingerprinting (Wave 1) [Complete]
- [x] 02-05-PLAN.md — Monitor Google Ads detection over 4 weeks (Wave 2) [Complete]
- [x] 02-06-PLAN.md — Analyze findings & document randomization gaps (Wave 3) [Complete]

---

## Progress Table

| Phase | Plans | Status | Scheduled |
|-------|-------|--------|-----------|
| 1. Preview UX | 6 plans in 2 waves | 6/6 complete ✅ | Week 1-2 |
| 2. Alpha Test | 3 plans (completed) | 3/3 complete ✅ | Week 2-3 |

---

## Coverage Summary

**Total v1.1 requirements:** 7
**Mapped to phases:** 7
**Unmapped:** 0

| Category | Requirements | Phase |
|----------|--------------|-------|
| Preview UX | PREV-01, PREV-02, PREV-03, PREV-04 | Phase 1 |
| Alpha Testing | ALPHA-01, ALPHA-02, ALPHA-03 | Phase 2 |

---

## Phase Dependencies

```
Phase 1: Preview UX
  └─ (INDEPENDENT) Phase 2: Alpha Test (ran in parallel)

Phase 2: Alpha Test
  └─ (COMPLETE) Findings feed into v1.2 Anti-FP Vector Expansion
```

---

## Deferred to v1.2

**Phase 3: Anti-FP Vector Expansion** has been separated into its own milestone (v1.2).

Rationale: The core system (build pipeline, quality gates, preview UX, anti-FP v1) is production-ready. Advanced anti-fingerprinting vectors (JS obfuscation, network jitter, event randomization) are additive post-build transforms that can be developed and shipped independently.

**Existing Phase 3 work carried forward to v1.2:**
- 03-01-PLAN.md complete (59 RED tests, service stubs, TemplateBuilder config wiring)
- 03-03 committed (NetworkRandomizer with sendBeacon wrapper)
- Plans 03-02, 03-04, 03-05 ready for execution

See `.planning/phases/03-anti-fp-vector-expansion/` for all artifacts.

---

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Preview in Wizard Step 5 (Review) | Operators need QA gate before submit; post-fingerprint preview validates randomization | Phase 1 |
| Real-time <1s refresh | Operator UX expectation; debounced updates prevent re-render thrashing | Phase 1 |
| Separate Anti-FP v2 to v1.2 | Core system ready to ship; anti-FP vectors are additive transforms; domains still have v1 fingerprinting as baseline | 2026-03-20 |
