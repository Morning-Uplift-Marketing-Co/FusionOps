# Phase 1 Planning Summary: Live Template Preview

**Planning Date:** 2026-03-20
**Phase:** 01-live-template-preview
**Status:** ✅ Planning Complete - Ready for Execution

---

## Overview

Phase 1 delivers live template preview capability for LP Factory v1.1. Operators will be able to preview templates with injected variables, toggle between mobile and desktop viewports, see real-time variable updates, and compare pre/post-fingerprinted HTML.

All 4 requirements (PREV-01 through PREV-04) are addressed across 6 executable plans with clear dependencies and wave structure.

---

## Requirements Coverage

| Requirement | Description | Plan | Status |
|-------------|-------------|------|--------|
| **PREV-01** | Live preview renders template in iframe with injected variables | 01-02, 01-04 | ✅ |
| **PREV-02** | Mobile/desktop viewport toggle (320px/1024px) without re-rendering | 01-02, 01-04 | ✅ |
| **PREV-03** | Real-time variable preview (<1s refresh, debounced) | 01-02, 01-04 | ✅ |
| **PREV-04** | Pre/post-fingerprint HTML comparison (side-by-side diff) | 01-03, 01-04 | ✅ |

**Coverage:** 4/4 requirements (100%)

---

## Plan Breakdown

### Wave 0: Test Suite Foundation

#### 01-01-PLAN.md: Test Suite
- **Status:** Pending (Wave 0 gate)
- **Tasks:** 4 test files (32+ test cases)
- **Deliverables:**
  - `src/components/Wizard/PreviewModal.test.jsx` (10+ tests)
  - `src/hooks/usePreviewDebounce.test.js` (8+ tests)
  - `src/components/DiffViewer.test.jsx` (6+ tests)
  - `src/utils/html-diff.test.js` (8+ tests)
- **Purpose:** Establish test contracts before implementation
- **Duration:** 15-20 min (writing comprehensive test specs)

---

### Wave 1: Component Implementation (Parallel)

#### 01-02-PLAN.md: Core Preview Components
- **Blocked by:** 01-01
- **Status:** Pending
- **Tasks:** 2 implementation tasks
- **Deliverables:**
  - `src/hooks/usePreviewDebounce.js` - Debounced preview refresh hook
  - `src/components/Wizard/PreviewModal.jsx` - Modal wrapper with viewport toggle
- **Requirements Addressed:** PREV-01, PREV-02, PREV-03
- **Key Features:**
  - Debounce delay: 400ms (prevents thrashing, meets <1s requirement)
  - Viewport toggle: 320px mobile / 1024px desktop (CSS-only, no re-render)
  - Real-time preview on config change (brand, color, copy)
  - AbortController for cancelling in-flight requests
  - Error handling with fallback HTML
- **Duration:** 25-30 min per task (40-50 min total)

**Key Implementation Notes:**
- buildPreviewHtml() already exists and handles variable injection
- useRef for storing timer/abort controller
- Manual iframe.srcdoc update in useEffect (React 19 specific)
- Graceful degradation if template fetch fails

---

#### 01-03-PLAN.md: Pre/Post Fingerprint Comparison
- **Blocked by:** 01-01
- **Status:** Pending
- **Tasks:** 2 implementation tasks
- **Deliverables:**
  - `src/utils/html-diff.js` - Wrapper around diff-match-patch
  - `src/components/DiffViewer.jsx` - Side-by-side or tabbed diff viewer
- **Requirements Addressed:** PREV-04
- **Key Features:**
  - diff-match-patch for canonical HTML diffs
  - Visual highlighting: added (green) / removed (red) / unchanged
  - Summary statistics: character counts, change count
  - Truncation for large diffs (>100 lines)
  - Side-by-side or tabbed layout options
- **Duration:** 20-25 min per task (40-50 min total)

**Key Implementation Notes:**
- New npm dependency: `npm install diff-match-patch`
- Handles CSS class randomization, ID changes, data attributes
- DiffViewer reuses existing AntiFingerprint.transform() output
- Diff computation deferred until fingerprint toggle (not on every keystroke)

---

#### 01-04-PLAN.md: Integration of PreviewModal + DiffViewer
- **Blocked by:** 01-02, 01-03
- **Status:** Pending
- **Tasks:** 2 integration + verification tasks
- **Deliverables:**
  - Enhanced `src/components/Wizard/PreviewModal.jsx`
  - Tab interface: "Live Preview" | "Fingerprint Comparison"
- **Requirements Addressed:** PREV-01, PREV-02, PREV-03, PREV-04 (all)
- **Key Features:**
  - Tab switching without re-rendering template
  - AntiFingerprint.transform() called once per tab switch
  - Fingerprint generation with loading state
  - Error handling if transform fails
  - Determinism verification (same siteId → identical output)
- **Duration:** 15-20 min (verification + enhancement)

**Key Implementation Notes:**
- Use siteId from wizard config for fingerprint seeding
- Graceful fallback: temporary siteId if not yet assigned
- Fingerprinted HTML cached (not regenerated on each toggle)
- DiffViewer rendered in compare tab with pre/post HTML

---

### Wave 2: Integration & Verification (Sequential)

#### 01-05-PLAN.md: StepReview Integration
- **Blocked by:** 01-02, 01-04
- **Status:** Pending
- **Tasks:** 3 integration + edge case handling tasks
- **Deliverables:**
  - Enhanced `src/components/Wizard/StepReview.jsx` with preview button
  - Integration test: `src/components/Wizard/__tests__/wizard-preview-integration.test.jsx` (5+ tests)
- **Requirements Addressed:** PREV-01 through PREV-04 (integration point)
- **Key Features:**
  - "Preview" button in review step (secondary style)
  - Modal opens/closes cleanly
  - Config and templateId passed correctly
  - Edge case handling: missing siteId, large templates, errors
  - Graceful fallback: temporary siteId generation
- **Duration:** 20-25 min

**Key Implementation Notes:**
- StepReview must pass `config` and `templateId` props to PreviewModal
- config includes: brand, primaryColor, secondaryColor, copy, siteId
- templateId used for fetching template files via getTemplateFiles()
- Preview button is optional (doesn't block deploy)
- Modal closure doesn't prevent deploy workflow

---

#### 01-06-PLAN.md: End-to-End Testing & Verification
- **Blocked by:** All Wave 1 tasks
- **Status:** Pending
- **Tasks:** 2 verification tasks
- **Deliverables:**
  - E2E test suite: `src/components/Wizard/__tests__/preview-e2e.test.jsx` (7+ scenarios)
  - Phase verification report: `.planning/phases/01-live-template-preview/01-VERIFICATION.md`
- **Requirements Addressed:** PREV-01 through PREV-04 (acceptance verification)
- **Key Features:**
  - 7 comprehensive E2E scenarios (Playwright or Vitest+RTL)
  - Performance baseline: <1s refresh, <1s fingerprint generation
  - Determinism verification: same siteId → identical output on re-toggle
  - Error recovery: graceful handling of missing templates/siteId
  - Manual verification checklist
- **Duration:** 30-40 min

**Key E2E Scenarios:**
1. Variable injection (PREV-01)
2. Viewport toggle (PREV-02)
3. Real-time refresh (PREV-03)
4. Fingerprint comparison (PREV-04)
5. Determinism (same siteId same output)
6. Error recovery
7. Performance baseline

---

## Wave Dependency Graph

```
Wave 0:
  01-01 (Test Suite)
    │
    ├─→ Wave 1: 01-02, 01-03 (parallel)
    │   01-02: usePreviewDebounce + PreviewModal
    │   01-03: html-diff + DiffViewer
    │
    ├─→ 01-04 (integration)
    │   01-04: PreviewModal + DiffViewer tabs
    │
    └─→ Wave 2: 01-05, 01-06 (sequential)
        01-05: StepReview integration
        01-06: E2E + Verification
```

**Execution Order:**
1. Wave 0: 01-01 (test suite foundation)
2. Wave 1: 01-02 + 01-03 (parallel component work)
3. Wave 1: 01-04 (integration after parallel work complete)
4. Wave 2: 01-05 (StepReview integration)
5. Wave 2: 01-06 (E2E testing & verification)

**Total Plans:** 6
**Total Tasks:** 15
**Estimated Duration:** 3-4 hours total execution time

---

## Key Architecture Decisions

### 1. **Reuse Existing Infrastructure**
- **Decision:** Use buildPreviewHtml() from v1.0 (template-preview-runtime.js)
- **Rationale:** Already tested, proven, handles Astro/Vite/HTML; no need to rewrite
- **Impact:** Reduces implementation scope; high confidence in correctness

### 2. **Debounce Strategy**
- **Decision:** Custom usePreviewDebounce hook with 400ms delay
- **Rationale:** Prevents thrashing on rapid input; meets <1s refresh requirement
- **Alternative Considered:** usehooks-ts useDebounce (rejected as less control)
- **Impact:** Smooth UX; prevents excessive CPU usage

### 3. **Viewport Simulation**
- **Decision:** CSS-only width constraint (320px / 1024px)
- **Rationale:** Iframe respects CSS width; template CSS media queries fire naturally
- **Alternative Considered:** devicePixelRatio hacks (rejected as over-complex)
- **Impact:** Simple implementation; works with any responsive template

### 4. **Fingerprint Comparison**
- **Decision:** Side-by-side diff viewer with diff-match-patch
- **Rationale:** Google's canonical algorithm; handles edge cases; visual diff highlighting
- **Alternative Considered:** Tabbed view (implemented as fallback option)
- **Impact:** Transparent; operators see exactly what's randomized

### 5. **SiteId Handling in Preview**
- **Decision:** Use config.siteId if available; generate temporary if missing
- **Rationale:** SiteId may not be assigned until deploy; preview should work anyway
- **Implementation:** SHA256(templateId + timestamp) for temporary ID
- **Documentation:** "Fingerprint preview is approximate; actual deploy uses permanent siteId"
- **Impact:** Graceful degradation; operators can preview even before site exists

### 6. **Error Handling Strategy**
- **Decision:** Show user-friendly error messages; log full errors to console
- **Rationale:** Operators need actionable feedback; developers need diagnostics
- **Implementation:** Try/catch with fallback HTML for each error type
- **Impact:** Better UX; easier debugging

---

## Open Questions Resolved

### Question 1: Template File Caching
**Question:** Should preview HTML be cached per siteId? Cache key = siteId + variables hash?
**Decision:** Cache per templateId within session (IndexedDB or sessionStorage optional)
- First preview fetch: async getTemplateFiles(templateId)
- Subsequent previews: use cached files (buildPreviewHtml() deterministic per config)
- Benefit: Reduces network calls on repeated variable changes
- Implementation: In usePreviewDebounce hook (cache decision left to executor)

### Question 2: SiteId Timing
**Question:** When is siteId assigned in wizard flow? Must be before Step 5?
**Decision:** SiteId may not exist until deploy; preview generates temporary ID if needed
- If config.siteId exists: use it
- If config.siteId missing: generate temporary SHA256(templateId + timestamp)
- Log warning to developer console
- Document: "Fingerprint preview uses temporary ID; actual deploy will use permanent siteId"
- Benefit: Preview always works, even before site creation

### Question 3: CSS Media Query Edge Cases
**Question:** Does viewport toggle via CSS width naturally trigger media queries?
**Decision:** Yes, if template includes proper viewport meta tag (buildPreviewHtml ensures this)
- buildPreviewHtml() injects `<meta name="viewport" content="width=device-width">` if missing
- CSS @media (max-width: 640px) triggers naturally at 320px iframe width
- Caveat: Mobile preview is approximate; real device testing recommended
- Document viewport breakpoint caveat in preview UI

---

## Testing Strategy

### Test Coverage Target
- **Unit Tests:** 32+ test cases across 4 test files
- **Integration Tests:** 5+ test cases for StepReview + modal workflow
- **E2E Tests:** 7+ scenarios covering all PREV-* requirements
- **Total:** 44+ test cases (100% test-first approach)

### Coverage Goals
- **Statement Coverage:** 85%+ (target: 90%+)
- **Branch Coverage:** 80%+ (target: 85%+)
- **Function Coverage:** 95%+

### Testing Philosophy
- **Wave 0:** Define contracts via tests (RED phase)
- **Wave 1:** Implement to pass tests (GREEN phase)
- **Wave 2:** Integration + refactor (REFACTOR phase)
- **Wave 2 Final:** Comprehensive E2E (verification phase)

---

## Dependencies

### New Dependencies
- **diff-match-patch** (npm install required)
  - Version: 20121119 (stable; 10+ years no breaking changes)
  - Size: ~63KB
  - Purpose: HTML diff generation for pre/post fingerprint comparison
  - Alternative: None (canonical choice)

### Existing Dependencies (Reused)
- **React 19.2.0** - Hooks, components, state management
- **cheerio 1.2.0** - DOM parsing (via buildPreviewHtml)
- **buildPreviewHtml()** - Template preview generation (existing, 385 lines)
- **AntiFingerprint.transform()** - Fingerprinting service (existing, 1,140 lines)
- **fingerprint-seeder** - Deterministic RNG (existing, 70 lines)

---

## File Structure

```
src/
├── components/
│   └── Wizard/
│       ├── PreviewModal.jsx (NEW)
│       ├── PreviewModal.test.jsx (NEW)
│       ├── StepReview.jsx (MODIFIED)
│       └── __tests__/
│           ├── wizard-preview-integration.test.jsx (NEW)
│           └── preview-e2e.test.jsx (NEW)
├── hooks/
│   ├── usePreviewDebounce.js (NEW)
│   └── usePreviewDebounce.test.js (NEW)
├── components/
│   ├── DiffViewer.jsx (NEW)
│   └── DiffViewer.test.jsx (NEW)
└── utils/
    ├── html-diff.js (NEW)
    └── html-diff.test.js (NEW)

.planning/
└── phases/
    └── 01-live-template-preview/
        ├── 01-01-PLAN.md (Test Suite)
        ├── 01-02-PLAN.md (Core Components)
        ├── 01-03-PLAN.md (Diff Components)
        ├── 01-04-PLAN.md (Integration)
        ├── 01-05-PLAN.md (StepReview)
        ├── 01-06-PLAN.md (E2E + Verification)
        ├── 01-RESEARCH.md (existing)
        └── PLANNING-SUMMARY.md (this file)
```

---

## Success Criteria

### Phase 1 Acceptance (All must be TRUE)
- [ ] All 4 requirements (PREV-01 through PREV-04) implemented and verified
- [ ] 44+ test cases passing (100% pass rate)
- [ ] E2E scenarios verified (7 workflows)
- [ ] Manual verification checklist completed
- [ ] Preview refresh: <1 second (debounce working)
- [ ] Fingerprint generation: <500ms
- [ ] DiffViewer rendering: <100ms
- [ ] No console errors or warnings
- [ ] Code review: no blockers or critical issues
- [ ] Performance metrics documented
- [ ] Edge cases handled (missing siteId, large templates, errors)

### Next Steps
1. **Approve Planning** — Confirm structure, dependencies, timeline
2. **Execute Wave 0** — Start with test suite (01-01)
3. **Execute Wave 1** — Parallel component work (01-02 + 01-03, then 01-04)
4. **Execute Wave 2** — Integration + verification (01-05 + 01-06)
5. **User Testing** — Operators validate UX in real workflow
6. **Phase 2** — Begin Alpha Test Validation (parallel with Phase 1 execution possible)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| SiteId not available in preview | Medium | Medium | Generate temporary ID; document caveat |
| Template files not cacheable | Low | Medium | Fetch each time (slower but correct) |
| Diff generation too slow on large templates | Low | Medium | Truncate diffs (max 100 lines shown) |
| Fingerprint determinism fails | Low | Critical | Existing 62 tests pass; high confidence |
| iframe sandbox blocks template functionality | Low | Medium | Use `sandbox="allow-scripts allow-same-origin allow-forms"` |
| React 19 srcdoc update issues | Low | Low | Manual ref.srcDoc update in useEffect |

---

## Next Phase Dependencies

**Phase 1 → Phase 2 (Alpha Test Validation)**
- Phase 2 is INDEPENDENT but optional to wait for Phase 1 completion
- Phase 2 uses v1.0 pipeline; Phase 1 is UI enhancement
- Can deploy Phase 2 test domains without Phase 1 UI (but preview helpful for operator QA)

**Phase 1 → Phase 3 (Performance Optimization)**
- Phase 3 DEPENDS on Phase 2 data
- Phase 1 completion enables Phase 2
- Critical path: Phase 1 + Phase 2 (parallel) → Phase 3

---

## Metadata

- **Planning Date:** 2026-03-20
- **Planner Model:** claude-haiku-4-5-20251001
- **Research Confidence:** HIGH (existing v1.0 infrastructure, proven patterns)
- **Execution Confidence:** HIGH (clear specs, TDD approach, existing test infrastructure)
- **Planning Duration:** 2 hours
- **Estimated Execution Duration:** 3-4 hours (6 plans, 15 tasks)
- **Total Phase Duration (estimate):** 4-5 hours (planning + execution)

---

**Status:** ✅ Ready for Execution

Execute via: `/gsd:execute-phase 01-live-template-preview`

