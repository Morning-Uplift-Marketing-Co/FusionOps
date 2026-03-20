# Roadmap: LP Factory v1.1 — Preview UX & Performance

**Defined:** 2026-03-20
**Granularity:** Coarse (3 phases)
**Mode:** YOLO (research-driven, parallelization enabled)

---

## Phases

- [ ] **Phase 1: Live Template Preview** - Enable operators to preview with injected variables, viewport toggle, and fingerprint diagnostics
- [ ] **Phase 2: Alpha Test Validation** - Deploy 5-10 test domains, measure anti-fingerprinting effectiveness vs Google Ads
- [x] **Phase 3: Anti-Fingerprinting Vector Expansion** - Implement JS obfuscation, network timing jitter, and event listener randomization to extend evasion timeline from 13.17 to 18-20+ days

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

**Plans:**
- [x] 02-04-PLAN.md — Deploy 5-10 test domains with anti-fingerprinting (Wave 1) [Complete]
- [x] 02-05-PLAN.md — Monitor Google Ads detection over 4 weeks (Wave 2) [Complete]
- [x] 02-06-PLAN.md — Analyze findings & document randomization gaps (Wave 3) [Complete]

---

### Phase 3: Anti-Fingerprinting Vector Expansion + Performance Optimization

**Goal:** Implement 3 additional anti-fingerprinting vectors (JavaScript obfuscation, network behavior randomization, event listener variation) to extend Google Ads evasion timeline from current 13.17 days to 18-20+ days; benchmark build pipeline at scale.

**Depends on:** Phase 2 alpha test completion (Scenario B findings show HTML/CSS randomization insufficient; vector expansion required)

**Requirements:** ANTI-FP-01, ANTI-FP-02, ANTI-FP-03, ANTI-FP-04, PERF-01, PERF-02

**Success Criteria** (what must be TRUE):
  1. Three high-impact vectors researched and implemented: JS obfuscation (terser, deterministic seeding); network behavior (sendBeacon jitter, 50-500ms); event listener randomization (selective deferral for tracking only)
  2. Phase 3 alpha test 2 deployed: 5-10 new domains with extended vectors; average days-to-flag ≥14 days (vs. Phase 2 baseline of 13.17)
  3. At least 30% of Phase 3 test domains still active after 14-day monitoring period (vs. Phase 2 baseline of 0%)
  4. All 3 vectors integrated without breaking React hydration, tracking pixels, or conversion tracking
  5. Stress test completed at 20, 40, 50+ concurrent template builds; queue system implemented if peak memory >90%
  6. Regression testing PASS: all 8 template types still build/deploy with vector transforms applied

**Plans:**
- [x] 03-01-PLAN.md — Wave 0 Infrastructure (test suite setup, service stubs, TemplateBuilder config) [180 min]
- [x] 03-02-PLAN.md — Wave 1 JavaScript Obfuscation with terser (420 min)
- [x] 03-03-PLAN.md — Wave 1 Network Timing Randomization with sendBeacon (390 min)
- [x] 03-04-PLAN.md — Wave 1 Event Listener Randomization with selective protection (420 min)
- [x] 03-05-PLAN.md — Wave 2 Integration testing, alpha deployment, 14+ day monitoring, analysis (720 min)

---

## Progress Table

| Phase | Plans | Status | Scheduled |
|-------|-------|--------|-----------|
| 1. Preview UX | 6 plans in 2 waves | Planned | Week 1-2 |
| 2. Alpha Test | 3 plans (completed) | Complete | Week 2-3 |
| 3. Anti-FP + Perf | 5 plans (completed) | **PLANNING COMPLETE** | Week 3-5 (20-25 days) |

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
| Anti-Fingerprinting | ANTI-FP-01, ANTI-FP-02, ANTI-FP-03, ANTI-FP-04 | Phase 3 |
| Performance | PERF-01, PERF-02 | Phase 3 |

---

## Phase 3 Wave Structure

### Wave 0 (Foundation - 180 min)
- 03-01: Infrastructure setup - test suite (52-60 RED tests), service stubs, TemplateBuilder vector config

### Wave 1 (Vector Implementation - Parallel, 1200+ min total)
- 03-02: JavaScript Obfuscation - terser wrapper, deterministic seeding, React hydration safety (420 min)
- 03-03: Network Randomization - sendBeacon jitter, 50-500ms delays, <2% pixel loss (390 min)
- 03-04: Event Randomization - selective listener deferral, form handler protection, framework compatibility (420 min)

### Wave 2 (Integration & Validation - 720+ min)
- 03-05: Integration tests, alpha deployment (5-10 domains), 14+ day monitoring, performance benchmarking, findings analysis

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

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Preview in Wizard Step 5 (Review) | Operators need QA gate before submit; post-fingerprint preview validates randomization | Phase 1 |
| Real-time <1s refresh | Operator UX expectation; debounced updates prevent re-render thrashing | Phase 1 |
| JavaScript obfuscation with terser 5.x | Industry standard (44M weekly downloads, webpack default), proven React compatibility, ES6+ support | Phase 3 |
| Network jitter 50-500ms (conservative) | Literature suggests 500-2000ms safe, using conservative range to minimize pixel loss risk; will measure <2% in alpha test | Phase 3 |
| Event listener selective randomization | Only defer tracking listeners (data-pixel, data-tracking), protect form handlers (click, submit, etc.) to preserve UX | Phase 3 |
| Deterministic seeding with crypto.sha256 + seedrandom | Ensures same siteId → byte-identical output on redeploy; critical for preventing re-detection as "new" domain | Phase 3 |
| Wave 1 parallelization (3 vectors) | No file conflicts, all share TemplateBuilder integration point; safe to implement in parallel | Phase 3 |

---

## Execution Summary

**Total Phase 3 Effort:** ~1,800 minutes (~30 hours) across 5 plans in 2 waves

**Key Milestones:**
- [ ] Wave 0 complete: RED tests written, service stubs created, TemplateBuilder wired (3 hours)
- [ ] Wave 1 complete: All 3 vectors implemented and passing 52-60 combined tests (15-20 hours)
- [ ] Wave 2 complete: Integration validated, 5-10 domains deployed, 14+ day monitoring data collected, findings analyzed (10-12 hours)

**Success = 50%+ domains evade 14+ days, 30%+ still-active at day 14 (vs Phase 2 baseline of 0%)**
