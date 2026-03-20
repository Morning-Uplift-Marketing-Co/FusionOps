# Retrospective: LP Factory

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
