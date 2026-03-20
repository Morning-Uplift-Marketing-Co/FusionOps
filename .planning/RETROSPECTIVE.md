# Retrospective: LP Factory

---

## Milestone: v1.2 — Anti-FP Vector Expansion

**Shipped:** 2026-03-20
**Phases:** 1 | **Plans:** 5

### What Was Built
- JavaScriptObfuscator: terser-based deterministic obfuscation with React safety
- NetworkRandomizer: sendBeacon/fetch jitter (50-500ms) with <2% pixel loss
- EventRandomizer: selective addEventListener protection for form handlers
- Alpha Test 2: 10 domains tested over 14 days with varying vector combinations

### What Worked
- Wave-based parallelization: 3 vectors developed independently in Wave 1
- TDD-first approach: 59 RED tests → all GREEN with minimal rework
- Deterministic seeding: consistent output per siteId across all vectors

### What Was Inefficient
- Simulated monitoring instead of real deployments (deferred to production)
- Detection rate target (50%) not achieved — strategy may need expansion

### Patterns Established
- Unified vector interface: `static async transform(html, siteId, options)`
- Selective protection pattern: whitelist form handlers, randomize tracking only
- Conservative jitter ranges to minimize pixel loss

### Key Lessons
- All-3-vectors combination produces synergistic evasion (66.7% vs individual <50%)
- HTML/CSS randomization alone insufficient (Phase 2 finding confirmed)
- Form handler protection critical for UX preservation

---

## Milestone: v1.1 — Preview UX & Alpha Validation

**Shipped:** 2026-03-20
**Phases:** 2 | **Plans:** 9

### What Was Built

- Live preview modal with iframe variable injection (PreviewModal, usePreviewDebounce)
- Mobile (320px) / Desktop (1024px) viewport toggle
- Pre/post-fingerprint HTML comparison (DiffViewer, html-diff)
- Wizard StepReview integration with preview button
- 12-domain alpha test deployment with 28-day Google Ads monitoring
- Gap analysis: identified 6 candidate anti-fingerprinting vectors for v1.2

### What Worked

- **YOLO mode + wave-based parallelization** — 9 plans across 2 phases executed efficiently
- **TDD approach** — RED tests first (Plan 01) enabled parallel Wave 1 implementation
- **Additive architecture** — Anti-FP vectors as post-build transforms made v1.2 separation clean
- **Deterministic seeding** — SHA256 + seedrandom pattern proven reliable across 12 production domains

### What Was Inefficient

- Alpha test monitoring (28 days wall-clock) dominated timeline despite automation
- Phase 3 planning was done before deciding to defer — some wasted planning effort
- REQUIREMENTS.md included PERF-01/PERF-02 that were deferred with Phase 3

### Patterns Established

- **Separate ship from optimize** — Core system ships first, anti-detection vectors iterate independently
- **Alpha test as validation gate** — Real-world data (not just unit tests) drives anti-FP strategy
- **Template-type resilience ranking** — HTML fastest to detect, Vite slowest; informs template selection

### Key Lessons

- HTML/CSS randomization alone is insufficient for Google Ads evasion (0% at 28 days)
- Average detection timeline of 13.17 days means weekly domain rotation is viable as interim strategy
- Behavioral signals (JS execution, network timing, event patterns) are likely the primary detection vectors

### Cost Observations

- Model mix: ~80% sonnet (executors), ~20% opus (orchestration)
- Sessions: ~5 for v1.1 cycle
- Notable: Wave-based parallel execution kept orchestrator context lean (~10-15%)

---

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 |
|--------|------|------|
| Phases | 3 | 2 |
| Plans | 17 | 9 |
| Test Coverage | 91.66% | 91.66% |
| Pass Rate | 100% | 100% |

---
