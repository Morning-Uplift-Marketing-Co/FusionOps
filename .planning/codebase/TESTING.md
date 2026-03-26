# Testing Patterns

**Analysis Date:** 2025-03-26

## Test Framework

**Runner:**
- Vitest `^4.0.18` — config: `vitest.config.ts`
- Uses `@vitejs/plugin-react` in config for JSX in tests.

**Assertion Library:**
- Vitest `expect` globally enabled (`test.globals: true`).
- DOM: `@testing-library/react` + `@testing-library/jest-dom` (see `tests/unit/setup.ts`).

**Environment:**
- Default Vitest environment: `happy-dom` (`vitest.config.ts`).
- `jsdom` is imported in config but environment is `happy-dom` — follow config as written for new tests.

**Run Commands:**

```bash
npm test                 # vitest (default)
npm run test:ui          # vitest --ui
npm run test:coverage    # vitest --coverage
npm run check            # astro check (TypeScript/Astro; not Vitest)
npm run lint             # eslint . (JS/JSX only per eslint.config.js)
npm run test:e2e         # playwright test
npm run test:e2e:headed  # playwright test --headed
npm run test:e2e:debug   # playwright test --debug
npm run test:e2e:ui      # playwright test --ui
npm run test:report      # playwright show-report
```

## Test File Organization

**Location:**
- **Co-located / near feature:** `src/**/__tests__/*.{test,spec}.{js,jsx}` and co-located `*.test.jsx` next to components (e.g. `src/components/DiffViewer.test.jsx`, `src/components/Wizard/__tests__/wizard-capability.test.jsx`).
- **Central unit specs:** `tests/unit/**/*.{test,spec}.ts` (e.g. `tests/unit/utils/index.spec.ts`, `tests/unit/workers/*.spec.ts`).
- **E2E:** `tests/e2e/**/*.spec.ts` (configured `testDir` in `playwright.config.ts`).

**Naming:**
- Vitest discovery: `src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` and `tests/unit/**/*.{test,spec}.{js,...}` (`vitest.config.ts` `test.include`).

**Structure:**

```
src/
├── components/
│   ├── DiffViewer.test.jsx
│   └── Wizard/__tests__/*.test.jsx
├── services/**/__tests__/*.test.js
├── utils/**/__tests__/*.test.js
└── __tests__/integration/*.test.js
tests/
├── unit/
│   ├── setup.ts
│   ├── utils/*.spec.ts
│   ├── workers/*.spec.ts
│   └── scripts/*.spec.ts
└── e2e/
    ├── wizard/*.spec.ts
    ├── deploy/*.spec.ts
    └── settings/*.spec.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ...', () => {
    expect(...).toBe(...);
  });
});
```

**Real example (component + Testing Library):** `src/components/DiffViewer.test.jsx` — `describe` / `it`, `render`, `screen.getByTestId`, `toBeInTheDocument()`.

**Patterns:**
- **Setup:** `tests/unit/setup.ts` registers `afterEach(cleanup)`, mocks `window.matchMedia`, `IntersectionObserver`, `ResizeObserver`, `requestAnimationFrame`.
- **React tests:** import `render`, `screen` from `@testing-library/react`; use `data-testid` where components expose them (e.g. `diff-viewer`).
- **Isolation:** `beforeEach` + `vi.clearAllMocks()` for component tests.

## Mocking

**Framework:** Vitest `vi` (`vi.fn`, `vi.mock`, `vi.stubGlobal`, `vi.unstubAllGlobals`, `vi.mocked`).

**Patterns:**

```javascript
vi.mock('../../../services/AntiFingerprint', () => ({
  default: { someMethod: vi.fn() },
}));

vi.stubGlobal('localStorage', mockLocalStorage);
// ...
vi.unstubAllGlobals();
```

**References:**
- Subpath alias mock: `src/utils/__tests__/template-registry.test.js` — `vi.mock('#lp-template-generator/core/template-registry.js', ...)`.
- Worker tests: `tests/unit/workers/callback-idempotency.spec.ts` — `vi.mock('../../../apps/worker/src/lib/dedup', ...)`.

**What to Mock:**
- External network, browser APIs not provided by happy-dom, heavy modules (AntiFingerprint, template runtime), worker internals when testing logic in isolation.

**What NOT to Mock:**
- Prefer real `render` + DOM for UI behavior unless flakiness forces a boundary mock.

## Fixtures and Factories

**Test Data:**
- Inline literals in `it` blocks common; HTML strings for `DiffViewer` tests in `src/components/DiffViewer.test.jsx`.
- E2E: screenshots written under `test-artifacts/screenshots/` (see `tests/e2e/wizard/wizard-basic.spec.ts`).

**Location:**
- No shared factory package required; reuse patterns from neighboring `__tests__` in the same feature.

## Coverage

**Requirements:** No enforced threshold in config; coverage via `npm run test:coverage`.

**Provider:** `v8` with reporters `text`, `json`, `html` (`vitest.config.ts`).

**Included:** `src/**/*.{js,jsx,ts,tsx}`, `tests/unit/**/*.{js,jsx,ts,tsx}`.

**Excluded:** `src/main.jsx`, `**/*.spec.*`, `**/*.test.*`, `**/*.d.ts`, `src/templates/**`, `node_modules`, `dist`.

**View Coverage:** run `npm run test:coverage` and open generated HTML under `coverage/` (default Vitest/v8 layout).

## Test Types

**Unit Tests:**
- Pure functions, services, utilities under `src/utils`, `src/services`, `src/components` with Vitest + Testing Library for React.

**Integration Tests:**
- `src/__tests__/integration/`, `src/utils/__tests__/template-router.integration.test.js`, build pipeline tests under `src/__tests__/`.

**E2E Tests:**
- Playwright `@playwright/test` `^1.58.2`, config `playwright.config.ts`.
- **Base URL:** `process.env.BASE_URL` or `http://localhost:4323` (matches Astro `server.port` in `astro.config.mjs`).
- **Dev server:** `webServer` runs `npm run dev`, reuses existing server locally, sets `VITE_E2E=1` for auth bypass / wizard access (see comments in `playwright.config.ts`).
- **Projects:** Chromium (optional `CHROME_DEV_PATH` / default Windows Chrome Dev path), Firefox, WebKit, mobile/tablet profiles.
- **Artifacts:** `test-artifacts/playwright-report`, `test-artifacts/playwright-results.xml`, `test-artifacts/playwright-results.json`, `outputDir` `test-artifacts/test-results`.

## Common Patterns

**Async Testing:**

```typescript
it('should ...', async () => {
  await expect(page.getByRole('navigation', { name: /FusionOps main/i })).toBeVisible({ timeout: 15000 });
});
```

**Error Testing:**

```typescript
it('should handle quota exceeded errors gracefully', () => {
  vi.stubGlobal('localStorage', mockLocalStorage);
  expect(LS.set('test-key', { foo: 'bar' })).toBe(false);
  vi.unstubAllGlobals();
});
```

**Playwright helpers:**
- Shared flows as local async functions in spec files (e.g. `openLpWizardFromSidebar` in `tests/e2e/wizard/wizard-basic.spec.ts`).
- Use `getByRole`, `locator`, `expect(...).toBeVisible()`; `waitForLoadState` / short `waitForTimeout` where hydration timing matters.

---

*Testing analysis: 2025-03-26*
