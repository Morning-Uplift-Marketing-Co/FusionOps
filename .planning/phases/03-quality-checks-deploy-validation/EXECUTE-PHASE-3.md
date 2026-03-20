# Execute Phase 3: Quality Checks & Deploy Validation

**Start date:** 2026-03-20
**Plans:** 4 (18 total tasks across 3 waves)
**Requirements:** QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06
**Status:** Ready for execution

---

## Quick Reference: Plan Summary

| Plan | Objective | Wave | Dependencies | Tasks | Requirements |
|------|-----------|------|--------------|-------|--------------|
| **01** | QualityChecker orchestrator + viewport/pixel validators | 1 | None | 5 | QUAL-01, QUAL-02 |
| **02** | Astro leak + Google Ads validation | 1 | Plan 01 | 4 | QUAL-03, QUAL-04 |
| **03** | Lighthouse integration + TemplateBuilder orchestration | 2 | Plans 01, 02 | 5 | QUAL-05, QUAL-06 |
| **04** | Regression testing + e2e validation + report | 3 | Plans 01, 02, 03 | 4 | All (01–06) |

---

## Execution Waves

### Wave 1: Parallel (Plans 01 & 02 run simultaneously)

**Start both in parallel:**
```bash
# Terminal 1
/gsd:execute-phase 03 --plan=01

# Terminal 2 (after Plan 01 completes or in parallel)
/gsd:execute-phase 03 --plan=02
```

**Estimated duration:** 60–90 minutes total (overlapping)

**Deliverables:**
- `src/services/quality-check/QualityChecker.js` (orchestrator)
- `src/services/quality-check/validators/viewport-validator.js`
- `src/services/quality-check/validators/pixel-validator.js`
- `src/services/quality-check/validators/astro-leak-validator.js`
- `src/services/quality-check/validators/google-ads-validator.js`
- 4 test files (38+ test cases)

---

### Wave 2: Sequential (Plan 03, depends on Wave 1)

**Start after Wave 1 complete:**
```bash
/gsd:execute-phase 03 --plan=03
```

**Estimated duration:** 45–60 minutes

**Prerequisite:** Wave 1 must be complete (all validators implemented)

**Deliverables:**
- `src/services/quality-check/validators/lighthouse-validator.js`
- Lighthouse integration into `TemplateBuilder.js`
- PageSpeed API fallback logic
- 1 test file (6+ test cases)
- Quality checks callable from TemplateBuilder pipeline

**Critical deliverable:** Integration into TemplateBuilder.transform() method

---

### Wave 3: Sequential (Plan 04, depends on Wave 2)

**Start after Wave 2 complete:**
```bash
/gsd:execute-phase 03 --plan=04
```

**Estimated duration:** 45–60 minutes

**Prerequisite:** Wave 2 must be complete (full quality pipeline integrated)

**Deliverables:**
- Regression test suite (~15 existing templates)
- E2E pipeline test (detect → build → fingerprint → quality check → deploy-ready)
- `03-VALIDATION.md` comprehensive report
- Coverage metrics (% per validator)

**Final output:** Comprehensive validation report showing:
- All validators working
- No regressions in Phase 1–2 templates
- Full pipeline integration verified
- Coverage gaps (if any) and recommendations

---

## Files Reference

### Plan Execution Files
- `03-01-PLAN.md` — QualityChecker orchestrator + viewport/pixel validators
- `03-02-PLAN.md` — Astro leak + Google Ads validators
- `03-03-PLAN.md` — Lighthouse integration + TemplateBuilder orchestration
- `03-04-PLAN.md` — Regression testing + e2e validation

### Support Files
- `03-PLANNING-SUMMARY.md` — Detailed planning breakdown (this file covers high-level overview)
- `03-RESEARCH.md` — Research findings, patterns, and code examples
- `EXECUTE-PHASE-3.md` — This file (execution checklist)

---

## Integration Points

### Critical: TemplateBuilder Integration (Plan 03)

Quality checks must be integrated into the TemplateBuilder after anti-fingerprinting:

```javascript
// In TemplateBuilder.transform()
async transform(htmlContent, siteId) {
  // 1. Build template
  let html = await this.build(template);

  // 2. Apply anti-fingerprinting
  html = await AntiFingerprint.transform(html, siteId);

  // 3. RUN QUALITY CHECKS (NEW in Plan 03)
  const qualityResults = await QualityChecker.validate(html);

  // 4. Fail fast on critical failures
  if (qualityResults.hasCriticalFailures) {
    throw new Error(`Quality checks failed: ${qualityResults.criticalErrors}`);
  }

  // 5. Log warnings
  if (qualityResults.warnings.length > 0) {
    logger.warn("Quality warnings:", qualityResults.warnings);
  }

  return html;
}
```

**Verify after Plan 03:**
- Quality checks run after fingerprinting
- Critical failures block deploy
- Warnings surface without blocking

---

## Success Checklist

### After Wave 1 Complete (Plans 01 + 02)
- [ ] QualityChecker orchestrator created and tested
- [ ] Viewport validator implemented (7 test cases pass)
- [ ] Pixel validator implemented (8 test cases pass)
- [ ] Astro leak validator implemented (8 test cases pass)
- [ ] Google Ads validator implemented (9 test cases pass)
- [ ] All 4 validators follow immutable result pattern (never throw)
- [ ] Pre-compiled regex patterns in place (Astro leak detection)
- [ ] Whitelist of safe Astro built-ins (DEV, PROD, SSR) configured

### After Wave 2 Complete (Plan 03)
- [ ] Lighthouse validator created (local Chrome spawn)
- [ ] Lighthouse integration into TemplateBuilder verified
- [ ] PageSpeed API fallback implemented (advisory-only)
- [ ] 120-second timeout configured
- [ ] Quality checks run after anti-fingerprinting
- [ ] Critical failures block deploy
- [ ] Warnings log without blocking
- [ ] 6+ Lighthouse test cases pass

### After Wave 3 Complete (Plan 04)
- [ ] ~15 existing templates pass regression tests (no new failures)
- [ ] E2E pipeline test validates full flow
- [ ] 03-VALIDATION.md report generated
- [ ] Coverage metrics computed (target: 80%+ per validator)
- [ ] Gaps identified (if any) and recommendations provided

---

## Troubleshooting Guide

### Lighthouse Tests Fail
**Problem:** Local Lighthouse execution hangs or fails
**Solution:** Use PageSpeed API fallback (Plan 03 Task 5), or mock Lighthouse in tests (don't call actual Chrome)

### Astro Leak False Positives
**Problem:** Safe imports (import.meta.env.DEV) flagged as leaks
**Solution:** Update whitelist in Plan 02 (astro-leak-validator.js), add more test cases

### Regression Tests Show New Failures
**Problem:** ~15 existing templates now fail quality checks
**Solution:** Adjust validator thresholds or whitelist requirements. This indicates Phase 1–2 implementations may need adjustment.

### TemplateBuilder Integration Fails
**Problem:** Quality checks not running or throwing errors
**Solution:** Verify Plan 03 Task 4 (integration). Ensure QualityChecker.validate() is called after AntiFingerprint.transform().

---

## Next Phase

After Phase 3 complete:
1. Create `03-VALIDATION.md` comprehensive report (Plan 04)
2. Update `STATE.md` with Phase 3 completion status
3. Decide: Proceed to Phase 4 (Preview UX) or release v1?

**Phase 4** is optional polish (improves UX but not required for deploy).

---

## Key Insights

1. **Immutability pattern:** All validators return result objects, never throw. Allows orchestrator to collect all failures before blocking deploy.

2. **Wave parallelization:** Plans 01–02 run in parallel (no file conflicts). Plan 03 depends on both. Plan 04 validates all together.

3. **Integration critical:** Quality checks MUST run after anti-fingerprinting (Plan 03 Task 4). This is where phase architecture impacts deployment safety.

4. **Test coverage:** 38+ unit tests (validators) + regression suite (~15 templates) + e2e test = comprehensive validation.

5. **Backward compatibility:** Plan 04 ensures existing Phase 1–2 templates don't break with new quality gates.

---

*Phase 3 Ready for Execution*
*Created: 2026-03-20*
