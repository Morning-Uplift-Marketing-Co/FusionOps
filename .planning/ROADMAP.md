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

**Plans:** TBD (to be detailed in `/gsd:plan-phase 1`)

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

| Phase | Plans Complete | Status | Scheduled |
|-------|----------------|--------|-----------|
| 1. Preview UX | 0/? | Planning | Week 1-2 |
| 2. Alpha Test | 0/? | Planning | Week 2-3 |
| 3. Performance | 0/? | Planning | Week 3-4 |

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

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Preview in Wizard Step 5 (Review) | Operators need QA gate before submit; post-fingerprint preview validates randomization | Phase 1 |
| Real-time <1s refresh | Operator UX expectation; debounced updates prevent re-render thrashing | Phase 1 |
| 5-10 domain alpha test | Statistically significant sample to measure detection timeline; cost-effective | Phase 2 |
| 4+ week observation window | Google Ads detection timeline varies; 4 weeks captures typical suspension patterns | Phase 2 |
| Benchmark at 20, 40, 50+ scale | Gradual scaling reveals memory curve; 50+ is production target | Phase 3 |
| Queue implementation threshold at 90% | Safe margin before OOM; allows headroom for spikes | Phase 3 |

---

*Roadmap created: 2026-03-20*
*Status: Ready for Phase 1 planning*
