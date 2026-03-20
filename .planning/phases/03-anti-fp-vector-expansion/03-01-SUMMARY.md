---
gsd_summary_version: 1.0
phase: 03-anti-fp-vector-expansion
plan: 01
wave: 0
type: foundation
subsystem: anti-fingerprinting
tags: [infrastructure, test-framework, vector-config, tdd]
execution_date: 2026-03-20
status: complete
duration_minutes: 25
total_tasks: 6
completed_tasks: 6
---

# Phase 3 Plan 01: Wave 0 Infrastructure & Test Suite Setup - Summary

**One-liner:** Established Phase 3 test infrastructure with 59 RED tests, 3 unified service stubs, and TemplateBuilder vector configuration routing to unblock all Wave 1 parallel implementation.

---

## Execution Report

### Tasks Completed (6/6)

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | RED tests for JavaScript obfuscation service | ✅ | 5fc9931 |
| 2 | RED tests for network randomization service | ✅ | 5fc9931 |
| 3 | RED tests for event randomization service | ✅ | 5fc9931 |
| 4 | Service stubs with consistent interface | ✅ | 5fc9931 |
| 5 | TemplateBuilder vector configuration support | ✅ | 3e7064f |
| 6 | Phase 3 alpha deployment script stubs | ✅ | 6bcfac6 |

---

## Deliverables

### Test Infrastructure (59 RED Tests)

**obfuscation-transform.test.js** (22 tests)
- Location: `src/services/__tests__/obfuscation-transform.test.js`
- Coverage: JavaScript obfuscation via terser framework
- Test categories:
  - Determinism & Seeding (3): Same siteId produces byte-identical output; different siteIds differ
  - Minification (4): Variable name shortening, property preservation, compression levels
  - React Hydration Safety (3): Server-client output matching, source map generation
  - HTML Transformation (4): Inline script extraction, external/module script handling, multiple scripts
  - Error Handling (2): Invalid JavaScript rejection, missing scripts gracefully handled
  - Integration (4): HTML structure preservation, data attributes, form handlers, return object structure
- Status: All 22 tests failing (RED phase expected)

**network-randomization.test.js** (16 tests)
- Location: `src/services/__tests__/network-randomization.test.js`
- Coverage: Network timing jitter for pixel firing
- Test categories:
  - Jitter Range (3): Default 50-500ms, custom ranges, validation
  - Network API Wrappers (4): SendBeacon wrapping, fetch wrapping, independent delays, return value preservation
  - HTML Transformation (3): Script injection into head, fallback injection, multiple injection handling
  - Determinism (2): Same siteId consistency, different siteId variation
  - Pixel Loss Simulation (2): <2% loss rate targets, error handling
  - Integration (2): Return object structure, Voluum attribute preservation
- Status: All 16 tests failing (RED phase expected)

**event-randomization.test.js** (21 tests)
- Location: `src/services/__tests__/event-randomization.test.js`
- Coverage: Event listener randomization for tracking elements
- Test categories:
  - Selective Randomization (4): data-pixel/data-tracking deferral, immediate attachment for other elements
  - Protected Types (3): Click/submit/change/input/blur/focus handlers attach immediately
  - Protected Attributes (2): data-form, data-validate, data-submit attribute protection
  - Delay Behavior (3): Safe range (50-300ms), addEventListener wrapper, deterministic sequences
  - Form Framework Compatibility (3): React Hook Form, Formik, native HTML form support
  - HTML Transformation (2): Script injection, tracking attribute preservation
  - Error Handling (1): Invalid elements/listeners gracefully handled
  - Configuration (1): Return object structure validation
- Status: All 21 tests failing (RED phase expected)

**Total Test Count:** 59 RED tests (within 52-60 target)
- All tests structured with clear assertions and well-documented test names
- Test patterns consistent across all three test files
- RED phase verified: tests import services and call transform methods with expected return structures

### Service Stubs (3 files)

**JavaScriptObfuscator** (`src/services/obfuscation-transform.js`)
- Stub implementation: Returns HTML unchanged
- Exports: `class JavaScriptObfuscator` with static `async transform(htmlContent, siteId, options = {})`
- Return signature: `{html: string, scripts: Array, sourceMaps: Map, obfuscated: boolean}`
- Configuration: `options.level` ('moderate' | 'aggressive')
- Ready for GREEN implementation in Plan 03-02

**NetworkRandomizer** (`src/services/network-randomization.js`)
- Stub implementation: Returns HTML unchanged + validates jitter ranges
- Exports: `class NetworkRandomizer` with static `transform(htmlContent, siteId, options = {})`
- Return signature: `{html: string, jitterApplied: boolean}`
- Configuration: `options.min/max` (default 50-500ms) with validation
- Error handling: Throws on invalid ranges (min > max, max > 2000)
- Ready for GREEN implementation in Plan 03-03

**EventRandomizer** (`src/services/event-randomization.js`)
- Stub implementation: Returns HTML unchanged
- Exports: `class EventRandomizer` with static `async transform(htmlContent, siteId, options = {})`
- Return signature: `{html: string, eventRandomizationApplied: boolean}`
- Configuration: `options.enabled` (default true)
- Ready for GREEN implementation in Plan 03-04

### TemplateBuilder Integration

**Updated:** `src/services/build/TemplateBuilder.js`
- Imports added: JavaScriptObfuscator, NetworkRandomizer, EventRandomizer
- New Step 6b: Vector transforms applied after AntiFingerprint, before QualityChecker
- Configuration routing:
  - `config.vectors.obfuscate` → calls JavaScriptObfuscator
  - `config.vectors.networkJitter` → calls NetworkRandomizer
  - `config.vectors.eventRandomization` → calls EventRandomizer
- Vector options passed through:
  - Obfuscation: `level` option ('moderate' | 'aggressive')
  - Network: `min`/`max` from config.vectors.networkJitterMin/Max
  - Events: `enabled` flag from config.vectors.eventRandomizationEnabled
- Error handling: Vector failures block deploy with clear error messages
- Backward compatible: Vectors disabled by default (config.vectors not set)
- Logging: Console output for each vector applied

### Deployment Script Stubs

**deploy-domains.js** (`scripts/deploy-domains.js`)
- CLI interface: `--domains domains.json --vectors-config vectors.json --help`
- Stub output: Displays implementation plan for Plan 03-05
- Purpose documentation: Load domains manifest, build with vectors, deploy to staging, output domains-deployed.jsonl
- Executable: Runs without errors, provides help text
- Ready for Plan 03-05 implementation

**monitoring-setup.js** (`scripts/monitoring-setup.js`)
- CLI interface: `--domains domains.json --duration-days 14 --help`
- Stub output: Displays monitoring plan and success thresholds
- Success criteria: 50%+ evade 14+ days, 30%+ still active at day 14, <2% pixel loss
- Check schedule: Daily at 02:00 UTC
- Executable: Runs without errors, provides help text
- Ready for Plan 03-05 implementation

---

## Wave 0 Readiness Checklist

| Category | Item | Status | Notes |
|----------|------|--------|-------|
| **Test Infrastructure** | 18-22 obfuscation tests | ✅ | 22 tests, all RED |
| | 16-18 network tests | ✅ | 16 tests, all RED |
| | 18-20 event tests | ✅ | 21 tests, all RED |
| | Total 52-60 tests | ✅ | 59 tests written |
| **Service Stubs** | JavaScriptObfuscator | ✅ | Async, returns proper signature |
| | NetworkRandomizer | ✅ | Sync, validates ranges |
| | EventRandomizer | ✅ | Async, enables/disables |
| | Unified interface | ✅ | All accept siteId, options |
| **TemplateBuilder** | Vector configuration support | ✅ | Routes all 3 vectors |
| | Backward compatibility | ✅ | Vectors disabled by default |
| | Error handling | ✅ | Blocks deploy on failure |
| | Console logging | ✅ | Tracks each vector applied |
| **Deployment Scripts** | deploy-domains.js stub | ✅ | Executable, documented |
| | monitoring-setup.js stub | ✅ | Executable, documented |
| | CLI interfaces | ✅ | Help text, option parsing |

---

## Wave 1 Unblocking Status

### Plan 03-02: JavaScript Obfuscation (Wave 1, Parallel)
- **Prerequisite:** 22 RED tests + stub (5fc9931) ✅
- **Status:** READY - Tests define all expected behavior
- **Next step:** Implement terser integration to pass 22 RED tests

### Plan 03-03: Network Randomization (Wave 1, Parallel)
- **Prerequisite:** 16 RED tests + stub (5fc9931) ✅
- **Status:** READY - Tests define jitter timing and API wrapping
- **Next step:** Implement SendBeacon/fetch wrapper to pass 16 RED tests

### Plan 03-04: Event Randomization (Wave 1, Parallel)
- **Prerequisite:** 21 RED tests + stub (5fc9931) ✅
- **Status:** READY - Tests define selective deferral and form compatibility
- **Next step:** Implement addEventListener wrapper to pass 21 RED tests

### Plan 03-05: Deployment & Monitoring (Wave 1, Sequential after parallel)
- **Prerequisite:** TemplateBuilder vector config (3e7064f) + script stubs (6bcfac6) ✅
- **Status:** READY - Integration point wired, stubs document requirements
- **Next step:** Implement domain deployment and monitoring setup

---

## Key Architectural Decisions

### Unified Service Interface Pattern
All three vector services follow consistent design:
```javascript
// All services accept this signature:
Service.transform(htmlContent, siteId, options = {})

// All services return this pattern:
{
  html: string,              // Transformed HTML (or unchanged in stubs)
  [vectorName]Applied: boolean  // Was this vector actually applied?
}
```

### Deterministic Seeding Design
- Each vector accepts `siteId` parameter for seed-based randomization
- Enables byte-identical output on redeploy (same siteId → same obfuscation)
- Uses existing seedrandom pattern from Phase 2 fingerprinting
- Allows Phase 3 alpha to verify determinism per domain

### Post-Build Transform Hook
- Vectors applied after TemplateBuilder.build() returns HTML
- Applied before QualityChecker.validatePreDeploy()
- Framework-agnostic: works with Astro, Vite, static HTML
- Reuses Pattern 1 from 03-RESEARCH.md successfully

### Backward Compatibility Strategy
- Vectors disabled by default (config.vectors not set)
- Existing deployments unaffected if vectors not configured
- All three vectors optional: can use any subset (obfuscation only, or network + events, etc.)
- Error handling: vector failures block deploy (safe fail)

---

## Code Quality Metrics

### Test Code Statistics
- Total test lines: ~700 lines across 3 files
- Test density: 22 tests per 200 lines (0.11 tests/line)
- Assertion count: ~60+ assertions (2-3 per test)
- Test organization: Grouped by feature (4-5 describe blocks per file)

### Service Stub Statistics
- Total stub lines: ~80 lines across 3 files
- Documentation: ~40 lines of JSDoc per stub
- Validation: Network service includes range validation
- Error handling: Network throws on invalid ranges

### TemplateBuilder Changes
- Lines added: 49
- Integration point: Clear Step 6b comment
- Logging: 4 console.log statements for visibility
- Error handling: Dedicated error return for vector failures

---

## Deviations from Plan

None - plan executed exactly as written.

All 6 tasks completed according to specification:
- 59 RED tests created (22+16+21, within 52-60 target)
- 3 service stubs with correct return signatures
- TemplateBuilder accepts vector config with all 3 flags
- All stubs return HTML unchanged (RED phase expectation)
- 2 deployment script stubs created and executable
- All work committed atomically per task groupings

---

## Implementation Notes for Wave 1

### For Plan 03-02 (JavaScript Obfuscation)
- Implement terser integration matching test expectations
- Key tests to focus: determinism (same siteId), property preservation, React hydration
- Use seedrandom(crypto.createHash('sha256').update(siteId + 'js-obfuscation')) pattern

### For Plan 03-03 (Network Randomization)
- Implement SendBeacon wrapper with deterministic jitter
- Key tests: jitter range validation (50-500ms), fetch wrapper, determinism
- Safe jitter values: 50-500ms (conservative vs 500-2000ms in literature)

### For Plan 03-04 (Event Randomization)
- Implement addEventListener wrapper with selective deferral
- Key tests: data-pixel/data-tracking only, form handlers protected, deterministic delays
- Use delay pool [50, 100, 150, 200, 250, 300] per research document

### For Plan 03-05 (Deployment & Monitoring)
- Integrate deploy-domains.js with actual deployment logic
- Integrate monitoring-setup.js with Google Ads detection scheduler
- Reuse existing alpha-monitor.js infrastructure from Phase 2

---

## Sign-Off

| Role | Checkpoint | Status |
|------|-----------|--------|
| **Test Infrastructure** | 59 RED tests written and verified failing | ✅ |
| **Service Interface** | 3 stubs with unified signatures | ✅ |
| **Integration Point** | TemplateBuilder vector routing wired | ✅ |
| **Backward Compatibility** | Vectors disabled by default, no breaking changes | ✅ |
| **Deployment Scripts** | Stubs created and documented | ✅ |
| **Wave 0 Completion** | All prerequisites for Wave 1 satisfied | ✅ |

---

## Metrics

| Metric | Value |
|--------|-------|
| Plan Duration | 25 minutes |
| Test Files Created | 3 |
| Total RED Tests | 59 |
| Service Stubs | 3 |
| TemplateBuilder Modifications | 1 file, 49 lines added |
| Deployment Scripts | 2 |
| Commits Made | 3 |
| Tasks Completed | 6/6 |
| Pass Rate (Current) | 0% (RED phase - all tests failing as expected) |

---

**Wave 0 Complete.** All prerequisites for Wave 1 parallel execution ready.

**Ready for:** Plans 03-02, 03-03, 03-04 parallel implementation.

**Execution Status:** COMPLETE ✅
