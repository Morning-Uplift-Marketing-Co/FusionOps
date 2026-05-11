# Roadmap: LP Factory

**Updated:** 2026-05-11
**Mode:** YOLO (research-driven, parallelization enabled)

> **v1.3:** Team is **not pursuing** the v1.3 “Template Reliability” milestone (Phases 4–6). Requirements and phase docs remain below **for reference only**.

---

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-03-20)
- ✅ **v1.1 Preview UX & Alpha Validation** — Phases 1-2 (shipped 2026-03-20)
- ✅ **v1.2 Anti-FP Vector Expansion** — Phase 3 (shipped 2026-03-20)
- ~~◆ **v1.3 Template Reliability** — Phases 4-6~~ **deprecated (not pursued, 2026-05-11)**

---

## Phases

<details>
<summary>✅ v1.0 MVP — SHIPPED 2026-03-20</summary>

See `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.1 Preview UX & Alpha Validation — SHIPPED 2026-03-20</summary>

- [x] Phase 1: Live Template Preview (6/6 plans) — PREV-01 through PREV-04
- [x] Phase 2: Alpha Test Validation (3/3 plans) — ALPHA-01 through ALPHA-03

Key finding: HTML/CSS randomization alone = 0% evasion at 28 days (avg 13.17 days).

See `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.2 Anti-FP Vector Expansion — SHIPPED 2026-03-20</summary>

- [x] Phase 3: Anti-FP Vector Expansion (5/5 plans) — ANTI-FP-01 through ANTI-FP-04

Key metrics: 40% still-active at Day 14 (target ≥30% ✅), 0.98% pixel loss (target <2% ✅), 66.7% all-3-vectors Day 14 evasion rate.

See `.planning/milestones/v1.2-ROADMAP.md` for full details.

</details>

## Archived: v1.3 Template Reliability (not pursued)

The following phases were planned under v1.3; **no longer an active roadmap**.

### Phase 4: Color Defaults
**Goal:** Templates display default colors (ocean palette) immediately in local dev and preview without CI injection

**Requirements:** CLR-01, CLR-02

**Plans:** 1 plan

**Plan List:**
- [ ] 04-01-PLAN.md — Update TEMPLATE-PROMPT.md with ocean defaults, update goldrush-lending.template.json with color defaults

**Success Criteria:**
1. User can see default ocean colors in local dev environment (no build step needed)
2. Global.css includes ocean HSL fallback for all color variables
3. TEMPLATE-PROMPT.md instructs AI to include default HSL values instead of "LEAVE EMPTY"
4. Existing templates remain unaffected (backwards compatible)

### Phase 5: Tracking Verification
**Goal:** Voluum tracking, clickid persistence, and first-party pixel all inject and fire correctly

**Requirements:** TRK-01, TRK-02, TRK-03

**Success Criteria:**
1. Voluum dtpCallback injects correctly and fires pageview event
2. GCLID/clickid captured from URL and persisted to sessionStorage
3. Clickid passed through to apply page form submission
4. First-party pixel (fpPixel) injects and fires pageview + form events
5. All tracking fires observable in browser DevTools

### Phase 6: Apply Page & Local Testing
**Goal:** Apply page functional with LeadsGate form, plus local testing tooling

**Requirements:** APPLY-01, TEST-01, TEST-02

**Success Criteria:**
1. apply.astro scaffolded with LeadsGate form + clickid passthrough
2. `npm run inject` replicates full CI pipeline locally
3. `npm run validate` reports color/tracking/pixel/apply/clickid readiness
4. Validator output human-readable with clear pass/fail

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Preview UX | v1.1 | 6/6 | Complete | 2026-03-20 |
| 2. Alpha Test | v1.1 | 3/3 | Complete | 2026-03-20 |
| 3. Anti-FP Vectors | v1.2 | 5/5 | Complete | 2026-03-20 |
| 4. Color Defaults | v1.3 | 0/? | **Deprecated** | — |
| 5. Tracking Verification | v1.3 | 0/? | **Deprecated** | — |
| 6. Apply & Local Testing | v1.3 | 0/? | **Deprecated** | — |
