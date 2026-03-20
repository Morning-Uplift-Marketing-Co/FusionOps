# Roadmap: LP Factory

**Updated:** 2026-03-20
**Mode:** YOLO (research-driven, parallelization enabled)

---

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-03-20)
- ✅ **v1.1 Preview UX & Alpha Validation** — Phases 1-2 (shipped 2026-03-20)
- 🚧 **v1.2 Anti-FP Vector Expansion** — Phase 3 (planned)

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

### 🚧 v1.2 Anti-FP Vector Expansion (Planned)

- [ ] Phase 3: Anti-FP Vector Expansion (5 plans, 1 complete)

**Goal:** Implement JS obfuscation, network timing jitter, and event listener randomization to extend evasion timeline from 13.17 to 18-20+ days.

**Existing work:**
- 03-01 complete (59 RED tests, service stubs, TemplateBuilder config wiring)
- 03-03 committed (NetworkRandomizer with sendBeacon wrapper)
- Plans 03-02, 03-04, 03-05 ready for execution

See `.planning/phases/03-anti-fp-vector-expansion/` for all artifacts.

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Preview UX | v1.1 | 6/6 | Complete | 2026-03-20 |
| 2. Alpha Test | v1.1 | 3/3 | Complete | 2026-03-20 |
| 3. Anti-FP Vectors | v1.2 | 1/5 | In Progress | - |
