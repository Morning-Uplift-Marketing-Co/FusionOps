---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-03-20T02:06:36.270Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 5
  completed_plans: 4
---

# Project State: LP Factory v1

**Project:** LP Factory — Template Pipeline & Anti-Fingerprint
**Updated:** 2026-03-20 (roadmap created)
**Mode:** YOLO (research-driven, high parallelization)

---

## Project Reference

**Core Value:** Import any template from bolt.new/Loveable, inject brand variables correctly, deploy to Cloudflare with unique HTML/CSS fingerprint — every time, without manual fixing.

**Success Metric:** Deployment pipeline stable at 50+ new domains/week with Google Ads undetected uniqueness.

**Current Focus:** Phase 01 — template-import-capability

---

## Current Position

Phase: 01 (template-import-capability) — EXECUTING
Plan: 4 of 5 (Plans 01, 02 & 03 complete)
Progress: Plans 01 (env injection), 02 (capability detection), & 03 (wizard integration) done; Plan 04 next

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

### What Needs Implementation

- **Plan 04:** Build orchestrator (multi-format builds, anti-fingerprint strategy)
- Multi-format build adapters + orchestrator (Phase 2)
- Deterministic fingerprinting plugin (Phase 2)
- Quality checker validation rules (Phase 3)
- Preview modal in wizard step 5 (Phase 4)

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

*State initialized: 2026-03-20*
*Ready for Phase 1 planning*
