# Milestones

## v1.2 Anti-FP Vector Expansion (Shipped: 2026-03-20)

**Delivered:** 3 anti-fingerprinting vectors validated for production deployment

- 1 phase, 5 plans, 55+ vector tests GREEN
- JavaScriptObfuscator with terser + deterministic seeding
- NetworkRandomizer with sendBeacon/fetch jitter wrapper
- EventRandomizer with selective form handler protection
- Alpha Test 2: 10 domains, 40% still-active at Day 14
- All-3-vectors synergy: 66.7% Day 14 evasion rate

---

## v1.1 Preview UX & Alpha Validation (Shipped: 2026-03-20)

**Phases completed:** 2 phases, 9 plans
**Timeline:** 20 days (2026-02-28 to 2026-03-20)
**Files modified:** 103 | **Lines added:** 34,675

**Key accomplishments:**

1. Live preview modal with iframe rendering, real-time variable injection (<1s debounced refresh)
2. Mobile/desktop viewport toggle (320px/1024px) with responsive layout validation
3. Pre/post-fingerprint HTML comparison (side-by-side diff viewer with visual highlighting)
4. 5-10 test domains deployed with deterministic anti-fingerprinting across all vectors
5. 28-day alpha test completed — Scenario B confirmed: HTML/CSS alone = 0% evasion (avg 13.17 days to flag)
6. Comprehensive gap analysis with Phase 3 recommendations for JS, network, and behavioral vectors

**Deferred to v1.2:** Anti-FP Vector Expansion (Phase 3 plans 03-01 through 03-05 carried forward)

---

## v1.0 MVP (Shipped: 2026-03-20)

**Phases completed:** 4 phases (Foundation, Build Pipeline, Quality Checks, UX Polish)
**Requirements Met:** 22/26 (84.6%)
**Test Coverage:** 91.66% (1,009+ tests)

**Key accomplishments:**

1. Env var injection fixed — Astro PUBLIC_* variables correctly injected via two-stage preprocessing
2. Multi-format build pipeline — Astro, Vite/React, static HTML with isolated npm environments
3. Capability-aware wizard — Auto-detection + manifest override for templates
4. Deterministic anti-fingerprinting — Same siteId = byte-identical output; 6 transform strategies
5. Comprehensive quality validation — Viewport, tracking pixels, Astro leak detection, Lighthouse 95+
6. Production deployment ready — 50+ new domains/week with quality and uniqueness

---
