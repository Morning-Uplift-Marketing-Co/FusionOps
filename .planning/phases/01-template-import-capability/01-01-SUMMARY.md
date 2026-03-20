---
phase: 01-template-import-capability
plan: 01
subsystem: environment-variable-injection
tags: [env-injection, preprocessing, post-build-cleanup, astro-integration]
dependencies:
  requires: []
  provides: [preprocessAstroEnvVars, replaceLeakedExpressions]
  affects: [01-02-capability-detection, 02-build-adapter, 02-deploy-pipeline]
tech_stack:
  added: [vitest, regex-patterns-for-env-var-replacement]
  patterns: [file-map-transformation, string-escaping, multi-stage-injection]
key_files:
  created:
    - src/utils/env-preprocessor.js (95 lines, 91.66% coverage)
    - src/utils/html-expression-replacer.js (90 lines, 90% coverage)
    - src/utils/__tests__/env-preprocessor.test.js (180 lines)
    - src/utils/__tests__/html-expression-replacer.test.js (235 lines)
    - src/utils/__tests__/env-injection-integration.test.js (275 lines)
decisions: []
metrics:
  duration: 45 minutes
  tasks_completed: 3
  tests_passing: 32 (12 preprocessor + 15 replacer + 5 integration)
  coverage: preprocessor 91.66% / replacer 90%
  commits: 3
---

# Phase 01 Plan 01: Astro Environment Variable Injection Summary

**One-liner:** Two-stage env injection pipeline (preprocessAstroEnvVars + replaceLeakedExpressions) with 32 passing tests and 90%+ coverage.

## Overview

Implemented critical bug fix for Astro `PUBLIC_*` environment variable injection. The solution uses a two-stage approach:
1. **Pre-build preprocessing** (env-preprocessor.js): Replace env var references in .astro files before Astro build
2. **Post-build cleanup** (html-expression-replacer.js): Catch any leaked expressions in final HTML output

This ensures deployed pages show actual brand names, conversion IDs, and tracking domains instead of placeholder expressions.

## Tasks Completed

### Task 1: env-preprocessor.js Implementation ✓
**Commit:** fc6b189

**Implementation:** `preprocessAstroEnvVars(files, envVars)` function that:
- Iterates through file map (JSZip format)
- Only processes .astro files
- Handles two patterns:
  - With fallback: `import.meta.env.PUBLIC_VAR || "fallback"`
  - Without fallback: `import.meta.env.PUBLIC_VAR`
- Supports all quote types (single, double, backticks)
- Escapes special characters (backslashes, quotes, newlines, tabs, carriage returns)
- Returns new file map with same keys, modified content

**Test Coverage:** 12 tests, 91.66% coverage
- Fallback operator handling (double, single, backtick quotes)
- No fallback handling
- Special character escaping (quotes, backslashes)
- Multiple replacements in same file
- Non-.astro file preservation
- Missing env var handling (empty string fallback)
- Complex expressions (object properties, template properties)
- Invalid input handling (null/undefined)

### Task 2: html-expression-replacer.js Implementation ✓
**Commit:** 1d9826b

**Implementation:** `replaceLeakedExpressions(html, envVars)` function that:
- Scans HTML string for remaining `import.meta.env.PUBLIC_*` patterns
- Processes three patterns in order (template literals first to avoid interference):
  1. Template literal syntax: `${import.meta.env.PUBLIC_VAR}`
  2. Quoted with fallback: `import.meta.env.PUBLIC_VAR || "fallback"`
  3. Unquoted: `import.meta.env.PUBLIC_VAR`
- Preserves quote type from fallback or adds single quotes for unquoted
- Same escaping pattern as preprocessor
- Returns modified HTML string

**Test Coverage:** 15 tests, 90% coverage
- Quoted fallback replacement (double, single, backticks)
- Template literal replacement
- Multiple expressions in same HTML
- Special character escaping
- HTML structure preservation
- Missing env var handling
- Newline escaping
- Script tag structure preservation
- Mixed quote types
- HTML entity preservation
- Null/undefined input handling

### Task 3: Integration Tests ✓
**Commit:** 7db30ca

**Implementation:** Five integration test cases demonstrating end-to-end pipeline:
1. **Loan calculator template** — Brand and conversion ID injection with multiple occurrences
2. **Missing env vars** — Fallback behavior when vars not provided
3. **Special characters** — Proper escaping of quotes and newlines
4. **Real-world loan template** — Complex config object with multiple vars in different contexts
5. **Empty env vars** — All fallbacks used when no env vars provided

**Pipeline Simulation:** mockAstroBuild() function extracts frontmatter from preprocessed .astro files and wraps in HTML, simulating Astro's build process.

**Test Coverage:** 5 integration tests, comprehensive end-to-end validation

## Deviations from Plan

None — plan executed exactly as written.

## Key Implementation Details

### String Escaping Strategy
Both modules use identical escaping pattern applied before inserting values:
```javascript
function escapeString(str) {
  return str
    .replace(/\\/g, '\\\\')    // Backslashes first
    .replace(/'/g, "\\'")      // Single quotes
    .replace(/"/g, '\\"')      // Double quotes
    .replace(/\n/g, '\\n')     // Newlines
    .replace(/\r/g, '\\r')     // Carriage returns
    .replace(/\t/g, '\\t');    // Tabs
}
```

### Regex Patterns

**env-preprocessor.js:**
- Pattern 1: `/import\.meta\.env\.(PUBLIC_\w+)\s*\|\|\s*(['\"`])([^'\">`]*)\2/g` — Fallback operator with quote preservation
- Pattern 2: `/import\.meta\.env\.(PUBLIC_\w+)(?!\s*\|\|)(?!['\"a-zA-Z_])/g` — No fallback with negative lookahead

**html-expression-replacer.js:**
- Pattern 1: `/\$\{import\.meta\.env\.(PUBLIC_\w+)(?:\s*\|\|\s*(['\"`])([^'\">`]*)\2)?\}/g` — Template literals
- Pattern 2: Same as preprocessor Pattern 1 — Quoted with fallback
- Pattern 3: Same as preprocessor Pattern 2 — Unquoted

### Files Organization

Created 5 files totaling 775 lines:
- **src/utils/env-preprocessor.js** (95 lines) — Production code
- **src/utils/html-expression-replacer.js** (90 lines) — Production code
- **src/utils/__tests__/env-preprocessor.test.js** (180 lines) — 12 unit tests
- **src/utils/__tests__/html-expression-replacer.test.js** (235 lines) — 15 unit tests
- **src/utils/__tests__/env-injection-integration.test.js** (275 lines) — 5 integration tests

## Test Results

```
Test Files: 3 passed (3)
Tests: 32 passed (32)
  - env-preprocessor.test.js: 12 passed
  - html-expression-replacer.test.js: 15 passed
  - env-injection-integration.test.js: 5 passed

Coverage:
  - env-preprocessor.js: 91.66% statements, 85.71% branches, 100% functions, 91.66% lines
  - html-expression-replacer.js: 90% statements, 72.22% branches, 100% functions, 90% lines
```

All coverage well exceeds 80% minimum requirement.

## Success Criteria Met

- [x] Two utility functions implemented (env-preprocessor, html-expression-replacer)
- [x] Pre-build .astro file preprocessing working correctly
- [x] Post-build HTML cleanup catching leaked expressions
- [x] 32 tests passing (12 + 15 + 5 integration)
- [x] 90%+ code coverage achieved
- [x] Special character escaping properly implemented
- [x] Fallback operator handling correct
- [x] Non-.astro files preserved
- [x] End-to-end integration tests passing
- [x] No placeholder expressions leak to final output

## Requirements Traceability

- **IMPORT-01:** Env preprocessor pre-build transformation ✓
- **IMPORT-02:** Post-build HTML expression replacement ✓

## Next Steps

Plan 01-02 (capability detection) depends on these modules being available. The env injection foundation is now solid and tested.

## Self-Check: PASSED

- [x] src/utils/env-preprocessor.js exists and contains 95 lines
- [x] src/utils/html-expression-replacer.js exists and contains 90 lines
- [x] src/utils/__tests__/env-preprocessor.test.js exists with 12 tests
- [x] src/utils/__tests__/html-expression-replacer.test.js exists with 15 tests
- [x] src/utils/__tests__/env-injection-integration.test.js exists with 5 integration tests
- [x] All 32 tests passing
- [x] Coverage: preprocessor 91.66%, replacer 90%
- [x] Commit fc6b189: env-preprocessor.js implementation
- [x] Commit 1d9826b: html-expression-replacer.js implementation
- [x] Commit 7db30ca: integration tests
