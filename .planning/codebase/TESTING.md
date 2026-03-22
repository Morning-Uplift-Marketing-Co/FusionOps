# Testing Patterns

**Analysis Date:** 2026-03-22

## Test Framework

**Runner:**
- Vitest `^4.0.18`
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect`; DOM: `@testing-library/jest-dom` matchers (loaded in setup).

**Environment:**
- `happy-dom` (see `test.environment` in `vitest.config.ts`); `jsdom` imported in config for potential advanced use.

**Run Commands:**
```bash
npm test                 # vitest
npm run test:ui          # vitest --ui
npm run test:coverage    # vitest --coverage
npm run test:e2e         # playwright test
npm run test:e2e:headed  # playwright test --headed
npm run test:e2e:debug   # playwright test --debug
npm run test:e2e:ui      # playwright test --ui
npm run test:report      # playwright show-report
```

## Test File Organization

**Location:**
- Co-located: `src/**/__tests__/*.test.js` (e.g. `src/utils/__tests__/capability-resolver.test.js`), `src/hooks/usePreviewDebounce.test.js`.
- Central unit suite: `tests/unit/**/*.spec.ts` (e.g. `tests/unit/utils/index.spec.ts`, `tests/unit/workers/*.spec.ts`).
- E2E: `tests/e2e/**/*.spec.ts` (configured in `playwright.config.ts` as `testDir`).

**Naming:**
- `*.test.js` or `*.spec.ts` / `*.spec.js` per Vitest `include` patterns in `vitest.config.ts`.

**Structure:**
```
src/
  __tests__/              # top-level regression / integration tests
  utils/__tests__/        # unit tests next to utils
  services/**/__tests__/
tests/
  unit/
    setup.ts              # referenced as setupFiles (path: tests/unit/setup.ts)
    utils/
    workers/
  e2e/
    fixtures/             # Playwright fixtures
    *.spec.ts
```

## Test Structure

**Suite Organization:**

```typescript
// tests/unit/utils/index.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LS } from '../../../src/utils';

describe('LocalStorage Utility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('get()', () => {
    it('should return null for non-existent key', () => {
      expect(LS.get('nonexistent')).toBeNull();
    });
  });
});
```

**Vitest globals:** `globals: true` in `vitest.config.ts` — `describe`/`it`/`expect` available without import in principle; many files still import explicitly from `vitest`.

**Setup (`tests/unit/setup.ts`):**
- `afterEach` → `@testing-library/react` `cleanup()`.
- Mocks: `window.matchMedia`, `IntersectionObserver`, `ResizeObserver`, `requestAnimationFrame` / `cancelAnimationFrame`.

## Mocking

**Framework:** Vitest `vi`.

**Patterns:**

```typescript
// tests/unit/utils/index.spec.ts
vi.stubGlobal('localStorage', mockLocalStorage);
// ...
vi.unstubAllGlobals();
```

```typescript
// tests/unit/workers/callback-security.spec.ts
vi.mock('../../../apps/worker/src/lib/dedup', () => ({
  generateDedupKey: vi.fn().mockResolvedValue('dedup-key'),
}));
```

**What to mock:** External modules with side effects (DB, dedup, Voluum); browser globals not provided by `happy-dom` (see setup file).

**What NOT to mock:** Prefer real `localStorage` when possible; tests override only for error paths (e.g. quota exceeded).

## Fixtures and Factories

**Test Data:**
- Inline constants and objects in test files (e.g. `SAMPLE_FILES`, `MANIFEST_WITH_CAPABILITIES` in `src/utils/__tests__/capability-resolver.test.js`).
- Helper factories in E2E: `TestDataGenerator`, page helpers (`AppHelpers`, `WizardHelpers`) via `tests/e2e/fixtures/fixtures.ts`.

**Location:**
- Unit: co-located in spec files or `__tests__` folders.
- E2E: `tests/e2e/utils/test-helpers` (imported by `tests/e2e/fixtures/fixtures.ts`).

## Coverage

**Requirements:** No enforced threshold in config; CI not defined in `vitest.config.ts`.

**Provider:** `@vitest/coverage-v8` (`provider: 'v8'` in `vitest.config.ts`).

**Reporters:** `text`, `json`, `html`.

**Include / exclude:** See `coverage.include` and `coverage.exclude` in `vitest.config.ts` — excludes test files, `src/templates/**`, `src/main.jsx`, etc.

**View coverage:**
```bash
npm run test:coverage
# open coverage/index.html after generation
```

## Test Types

**Unit tests:**
- Pure logic and utilities under `src/utils`, `src/services`, hooks — `describe`/`it` with `expect`.

**Integration tests:**
- Files named `*.integration.test.js` (e.g. `src/utils/__tests__/template-router.integration.test.js`); build pipeline tests under `src/services/build/__tests__/`.

**E2E tests:**
- Playwright `@playwright/test` — `playwright.config.ts` sets `testDir: './tests/e2e'`, multi-browser `projects`, `webServer` running `npm run dev` on port `4323`, artifacts under `test-artifacts/`.

**Example E2E import:**

```typescript
// tests/e2e/suite.spec.ts
import { test, expect } from './fixtures/fixtures';

test.describe('Smoke Tests - Critical Paths', () => {
  test('should load application', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Dashboard|My Sites/i).first()).toBeVisible({ timeout: 15000 });
  });
});
```

## Common Patterns

**Async testing:**
- `async`/`await` with `expect` on resolved values; API mocks use `mockResolvedValue` (see `tests/unit/workers/callback-security.spec.ts`).

**Error testing:**
- Force failures via stubbed globals or mocked `setItem` throwing; assert boolean return values (e.g. `LS.set` returns `false` on quota errors in `tests/unit/utils/index.spec.ts`).

**React component tests:**
- Use `@testing-library/react` with setup cleanup; import paths align with Vitest aliases in `vitest.config.ts`.

---

*Testing analysis: 2026-03-22*
