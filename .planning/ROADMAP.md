# Roadmap: LP Factory v1 — Template Pipeline & Anti-Fingerprint

**Defined:** 2026-03-20
**Granularity:** Coarse (4 phases)
**Mode:** YOLO (research-driven, parallelization enabled)

---

## Phases

- [ ] **Phase 1: Template Import Fix & Capability Detection** - Fix Astro env var injection, establish multi-level capability detection framework
- [ ] **Phase 2: Multi-Format Build & Anti-Fingerprint Pipeline** - Complete build isolation for all formats, implement deterministic randomization
- [ ] **Phase 3: Quality Checks & Deploy Validation** - Comprehensive pre-deploy validation gates, Lighthouse enforcement
- [ ] **Phase 4: Template Preview & UX Polish** - Live preview with real-time variable injection and error feedback

---

## Phase Details

### Phase 1: Template Import Fix & Capability Detection
**Goal:** Fix critical blocker (Astro env var injection not reaching deployed templates) and establish foundation for capability-aware workflow that automatically adapts wizard steps based on template features.

**Depends on:** Nothing (foundation phase)

**Requirements:** IMPORT-01, IMPORT-02, IMPORT-03, CAPAB-01, CAPAB-02, CAPAB-03, CAPAB-04, CAPAB-05

**Success Criteria** (what must be TRUE):
  1. Imported Astro templates render configured brand variables in deployed output (no `import.meta.env.PUBLIC_*` fallback expressions)
  2. Post-build HTML rewriting detects and replaces any leaked env expressions with site-specific values
  3. Template entry points and package.json validated after import; paths normalized to standard structure
  4. Wizard dynamically shows/hides steps (Design, Tracking, Copy) based on auto-detected + manifest-declared capabilities
  5. Capability detection has confidence scoring; manifest override allows users to correct false positives/negatives

**Plans:** 3 plans
  - [ ] 01-PLAN.md — Env var injection + template normalization (Wave 1)
  - [ ] 02-PLAN.md — Capability detection framework (Wave 1)
  - [ ] 03-PLAN.md — Wizard capability-aware integration (Wave 2)

---

### Phase 2: Multi-Format Build & Anti-Fingerprint Pipeline
**Goal:** Complete multi-format build isolation (Astro, Vite/React, static HTML) and implement deterministic HTML/CSS randomization so deployed sites appear unique to detection systems.

**Depends on:** Phase 1 (requires normalized templates + capability manifest)

**Requirements:** IMPORT-04, IMPORT-05, FINGER-01, FINGER-02, FINGER-03, FINGER-04, FINGER-05, FINGER-06

**Success Criteria** (what must be TRUE):
  1. Astro, Vite/React, and static HTML templates each build independently in isolated environments with `npm ci` and separate temp directories
  2. CSS class names, DOM attributes (data-*, id prefixes), and aria-labels randomized per deploy using deterministic seed (same siteId = same output)
  3. Structural DOM variation applied (whitespace, comment injection, attribute ordering) without breaking functionality
  4. Meta tag variation applied (generator tag, description phrasing, OG tags) to prevent static HTML fingerprinting
  5. Redeployment of same site produces byte-identical output (determinism verified across multiple redeploys)
  6. Anti-fingerprint transforms applied post-build, before deploy, without modifying source templates

**Plans:** TBD

---

### Phase 3: Quality Checks & Deploy Validation
**Goal:** Establish comprehensive pre-deploy validation gates that catch quality issues before Cloudflare upload, with Lighthouse 95+ enforcement.

**Depends on:** Phase 2 (requires built output for inspection)

**Requirements:** QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06

**Success Criteria** (what must be TRUE):
  1. Viewport meta tag (`<meta name="viewport">`) present and correctly formatted in final HTML
  2. First-party tracking pixel marker detected and validated (Voluum/Google conversion pixel)
  3. No raw Astro expressions (`import.meta.env`, `${}` template literals in scripts) present in built output
  4. Google Ads conversion tracking markers (gtag scripts, gclid parameters) present and syntactically valid
  5. Lighthouse score on all metrics >= 95; deploy blocked with clear error message if any metric < 95
  6. Quality checks run after fingerprinting; critical failures (missing markers, Astro leaks) block deploy; warnings surface non-blocking issues

**Plans:** TBD

---

### Phase 4: Template Preview & UX Polish
**Goal:** Enable operators to preview templates with injected variables before deploy, with real-time updates and mobile/desktop toggle.

**Depends on:** Phase 3 (optional; improves UX but not required for deploy)

**Requirements:** PREV-01, PREV-02, PREV-03, PREV-04

**Success Criteria** (what must be TRUE):
  1. Preview modal renders template in iframe with site-specific variables injected (brand name, color, copy)
  2. Mobile (320px) / desktop (1024px) viewport toggle available in preview UI
  3. Real-time preview refresh when user changes brand name, color, or other injected variables (debounced, <1s latency)
  4. Preview shows both pre-fingerprint and post-fingerprint HTML versions for comparison; error capture in iframe shows console errors and form handler failures

**Plans:** TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Import Fix & Capability | 3/3 | Planning complete | — |
| 2. Build & Anti-Fingerprint | 0/6 | Not started | — |
| 3. Quality & Validation | 0/5 | Not started | — |
| 4. Preview & Polish | 0/3 | Not started | — |

---

## Coverage Summary

**Total v1 requirements:** 26
**Mapped to phases:** 26
**Unmapped:** 0

✓ **100% Coverage Achieved**

| Category | Requirements | Phase |
|----------|--------------|-------|
| Template Import | IMPORT-01, IMPORT-02, IMPORT-03 | Phase 1 |
| Multi-Format Build | IMPORT-04, IMPORT-05 | Phase 2 |
| Capability Detection | CAPAB-01, CAPAB-02, CAPAB-03, CAPAB-04, CAPAB-05 | Phase 1 |
| Anti-Fingerprint | FINGER-01, FINGER-02, FINGER-03, FINGER-04, FINGER-05, FINGER-06 | Phase 2 |
| Quality Checks | QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06 | Phase 3 |
| Preview | PREV-01, PREV-02, PREV-03, PREV-04 | Phase 4 |

---

## Phase Dependencies

```
Phase 1: Foundation (Import + Capability)
  ├─ (BLOCKS) Phase 2: Build + Anti-Fingerprint
  ├─ (ENABLES) Phase 3: Quality Checks
  └─ (ENABLES) Phase 4: Preview UX

Phase 2: Build Pipeline
  ├─ (BLOCKS) Phase 3: Quality Checks
  └─ (ENABLES) v1 Release

Phase 3: Quality Checks
  ├─ (BLOCKS) Phase 4 (optional)
  └─ (ENABLES) v1 Release

Phase 4: Preview UX
  └─ (OPTIONAL) Improves v1 polish
```

**Critical path:** Phase 1 → Phase 2 → Phase 3 (Phase 4 is polish, optional)

---

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Multi-level capability detection (manifest + auto-detect) | Handles unpredictable template structures; manifest enables accuracy; auto-detect bootstraps on import | Phase 1 |
| Post-build anti-fingerprinting | Allows template reuse; enables caching multiplier; simpler implementation across formats | Phase 2 |
| Build isolation per template | Prevents concurrent npm cache conflicts and OOM kills; `npm ci` ensures reproducibility | Phase 2 |
| Deterministic fingerprinting (seeded RNG) | Same siteId → identical output on redeploy; enables audit trail and safe caching | Phase 2 |
| Quality checks as deploy gate | Fail fast with clear errors; blocks broken templates before Cloudflare upload | Phase 3 |

---

*Roadmap created: 2026-03-20*
*Last updated: 2026-03-20*
