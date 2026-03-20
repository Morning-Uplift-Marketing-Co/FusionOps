---
phase: 1
slug: template-import-capability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/utils/__tests__/ --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/utils/__tests__/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 1 | IMPORT-01 | unit | `npx vitest run src/utils/__tests__/env-preprocessor.test.js` | ❌ W0 | ⬜ pending |
| 01-02 | 01 | 1 | IMPORT-02 | unit | `npx vitest run src/utils/__tests__/html-rewriter.test.js` | ❌ W0 | ⬜ pending |
| 01-03 | 01 | 1 | IMPORT-03 | unit | `npx vitest run src/utils/__tests__/template-normalizer.test.js` | ❌ W0 | ⬜ pending |
| 02-01 | 02 | 1 | CAPAB-01 | unit | `npx vitest run src/utils/__tests__/capability-detector.test.js` | ❌ W0 | ⬜ pending |
| 02-02 | 02 | 1 | CAPAB-02 | unit | `npx vitest run src/utils/__tests__/manifest-loader.test.js` | ❌ W0 | ⬜ pending |
| 02-03 | 02 | 1 | CAPAB-05 | unit | `npx vitest run src/utils/__tests__/capability-resolver.test.js` | ❌ W0 | ⬜ pending |
| 03-01 | 03 | 2 | CAPAB-03 | integration | `npx vitest run src/components/__tests__/wizard-capability.test.jsx` | ❌ W0 | ⬜ pending |
| 03-02 | 03 | 2 | CAPAB-04 | integration | `npx vitest run src/components/__tests__/wizard-degradation.test.jsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/env-preprocessor.test.js` — stubs for IMPORT-01
- [ ] `src/utils/__tests__/html-rewriter.test.js` — stubs for IMPORT-02
- [ ] `src/utils/__tests__/template-normalizer.test.js` — stubs for IMPORT-03
- [ ] `src/utils/__tests__/capability-detector.test.js` — stubs for CAPAB-01
- [ ] `src/utils/__tests__/manifest-loader.test.js` — stubs for CAPAB-02
- [ ] `src/utils/__tests__/capability-resolver.test.js` — stubs for CAPAB-05
- [ ] `src/components/__tests__/wizard-capability.test.jsx` — stubs for CAPAB-03
- [ ] `src/components/__tests__/wizard-degradation.test.jsx` — stubs for CAPAB-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wizard step visibility changes | CAPAB-03 | Visual UI behavior | Open Wizard with template that lacks calculator → verify calculator step is hidden |
| Deployed site shows correct brand | IMPORT-01 | Requires Cloudflare deploy | Deploy test template → verify brand name in live HTML |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
