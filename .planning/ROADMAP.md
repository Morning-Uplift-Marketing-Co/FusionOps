# Roadmap: LP Factory v1.1 — Preview UX & Performance

**Defined:** 2026-03-20
**Granularity:** Coarse (3 phases)
**Mode:** YOLO (research-driven, parallelization enabled)

---

## Phases

- [ ] **Phase 1: Live Template Preview** - Enable operators to preview with injected variables, viewport toggle, and fingerprint diagnostics
- [ ] **Phase 2: Alpha Test Validation** - Deploy 5-10 test domains, measure anti-fingerprinting effectiveness vs Google Ads
- [ ] **Phase 3: Performance Optimization** - Benchmark build concurrency, implement queue if needed for 50+ concurrent deploys

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
- [ ] 01-01-PLAN.md — Test suite (Wave 0)
- [ ] 01-02-PLAN.md — PreviewModal + usePreviewDebounce hooks (Wave 1)
- [ ] 01-03-PLAN.md — DiffViewer + html-diff utility (Wave 1)
- [ ] 01-04-PLAN.md — PreviewModal + DiffViewer integration (Wave 1)
- [ ] 01-05-PLAN.md — StepReview integration (Wave 2)
- [ ] 01-06-PLAN.md — E2E testing + verification (Wave 2)

---

### Phase 2: Alpha Test Validation

**Goal:** Deploy complete test suite (5-10 domains) with v1.0 pipeline to measure anti-fingerprinting effectiveness and detect Google Ads detection timeline.

**Depends on:** Phase 1 complete (optional; can run in parallel with Phase 1)

**Requirements:** ALPHA-01, ALPHA-02, ALPHA-03

**Success Criteria** (what must be TRUE):
  1. 5-10 test domains deployed with fingerprinting across all vectors (CSS classes, IDs, meta tags, structural variation)
  2. Google Ads system behavior tracked over 4+ weeks; days-to-flag documented per domain
  3. Report generated identifying randomization gaps and recommendations for additional vectors (behavioral, registrant, etc.)

**Plans:** TBD (to be detailed in `/gsd:plan-phase 2`)

---

### Phase 3: Performance Optimization

**Goal:** Benchmark build pipeline at scale (20-50+ concurrent deployments) and implement queue if memory usage exceeds safe thresholds.

**Depends on:** Phase 2 alpha test completion (data informs performance requirements)

**Requirements:** PERF-01, PERF-02

**Success Criteria** (what must be TRUE):
  1. Stress test completed at 20, 40, 50+ concurrent template builds; peak RAM and CPU documented per scale
  2. If peak memory >90% at 50+ concurrent, queue system implemented with configurable concurrency limit
  3. Queue validation: peak memory <80%; per-template build time degradation acceptable (<2x)

**Plans:** TBD (to be detailed in `/gsd:plan-phase 3`)

---

## Progress Table

| Phase | Plans | Status | Scheduled |
|-------|-------|--------|-----------|
| 1. Preview UX | 6 plans in 2 waves | Planned | Week 1-2 |
| 2. Alpha Test | TBD | Planning | Week 2-3 |
| 3. Performance | TBD | Planning | Week 3-4 |

---

## Coverage Summary

**Total v1.1 requirements:** 9
**Mapped to phases:** 9
**Unmapped:** 0

✓ **100% Coverage Achieved**

| Category | Requirements | Phase |
|----------|--------------|-------|
| Preview UX | PREV-01, PREV-02, PREV-03, PREV-04 | Phase 1 |
| Alpha Testing | ALPHA-01, ALPHA-02, ALPHA-03 | Phase 2 |
| Performance | PERF-01, PERF-02 | Phase 3 |

---

## Phase Dependencies

```
Phase 1: Preview UX
  ├─ (INDEPENDENT) Phase 2: Alpha Test (can run in parallel)
  └─ (ENABLES) Phase 3: Performance

Phase 2: Alpha Test
  ├─ (INDEPENDENT) Phase 1: Preview UX (can run in parallel)
  └─ (ENABLES) Phase 3: Performance

Phase 3: Performance
  └─ (REQUIRES) Phase 2 alpha data
```

**Critical path:** Phase 1 + Phase 2 (parallel) → Phase 3 (sequential)

---

## Plan Wave Structure (Phase 1)

### Wave 0 (Foundations)
- 01-01: Test suite (4 test files covering all PREV-* requirements)

### Wave 1 (Component Implementation - Parallel)
- 01-02: PreviewModal + usePreviewDebounce hook (core preview UI)
- 01-03: DiffViewer + html-diff utility (pre/post comparison)
- 01-04: PreviewModal + DiffViewer integration (tab switching, fingerprint generation)

### Wave 2 (Integration - Sequential)
- 01-05: StepReview integration (preview button, state management)
- 01-06: E2E testing + verification (comprehensive workflow tests)

---

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Preview in Wizard Step 5 (Review) | Operators need QA gate before submit; post-fingerprint preview validates randomization | Phase 1 |
| Real-time <1s refresh | Operator UX expectation; debounced updates prevent re-render thrashing | Phase 1 |
| Debounce: 400ms | Balances responsiveness with preventing thrashing; keeps <1s overall latency | Phase 1 |
| Viewport: 320px/1024px | Mobile standard / large tablet; covers most responsive design breakpoints | Phase 1 |
| Diff viewer: side-by-side layout | Easier to compare original vs fingerprinted; tabbed added as alternative | Phase 1 |
| Reuse buildPreviewHtml() + AntiFingerprint | Both exist, tested, proven in v1.0; avoids code duplication | Phase 1 |
| 5-10 domain alpha test | Statistically significant sample to measure detection timeline; cost-effective | Phase 2 |
| 4+ week observation window | Google Ads detection timeline varies; 4 weeks captures typical suspension patterns | Phase 2 |
| Benchmark at 20, 40, 50+ scale | Gradual scaling reveals memory curve; 50+ is production target | Phase 3 |
| Queue implementation threshold at 90% | Safe margin before OOM; allows headroom for spikes | Phase 3 |

---

## Implementation Notes

### Phase 1 Key Components

**PreviewModal** (src/components/Wizard/PreviewModal.jsx)
- Modal wrapper with iframe + controls
- Viewport toggle (320px mobile / 1024px desktop)
- Fingerprint toggle (show original or fingerprinted HTML)
- Tab interface: "Live Preview" | "Fingerprint Comparison"

**usePreviewDebounce** (src/hooks/usePreviewDebounce.js)
- Custom React hook for debounced preview generation
- Debounce delay: 400ms (prevents thrashing)
- Abort controller for cancelling in-flight requests
- Returns: previewHtml, error, loading state

**DiffViewer** (src/components/DiffViewer.jsx)
- Side-by-side or tabbed view of pre/post HTML
- Diff highlighting: added (green) / removed (red)
- Summary statistics: added/removed/unchanged counts
- Truncation: large diffs capped at 100 lines

**html-diff utility** (src/utils/html-diff.js)
- Wrapper around diff-match-patch
- Handles CSS class changes, ID randomization, data attributes
- Returns: diffs array + summary object

### Dependencies (New)
- diff-match-patch: Google's canonical diff algorithm (npm install diff-match-patch)

### Existing Dependencies (Reused)
- buildPreviewHtml(): src/utils/template-preview-runtime.js (existing, 385 lines)
- AntiFingerprint.transform(): src/services/AntiFingerprint.js (existing, 1,140 lines)
- React 19, cheerio 1.2.0 (already in project)

---

*Roadmap updated: 2026-03-20*
*Status: Phase 1 plans ready for execution*
