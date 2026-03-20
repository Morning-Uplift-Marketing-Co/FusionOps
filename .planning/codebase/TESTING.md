# Testing

## Frameworks

| Type | Framework | Config |
|------|-----------|--------|
| Unit | Vitest 4.x | `vitest.config.ts` |
| E2E | Playwright 1.58 | `playwright.config.ts` |
| Coverage | v8 (via `@vitest/coverage-v8`) | Configured in vitest.config.ts |

## Unit Tests

### Configuration (`vitest.config.ts`)
- Environment: `happy-dom`
- Globals: `true` (no explicit imports for `describe`, `it`, `expect`)
- Setup file: `tests/unit/setup.ts`
- Include patterns: `src/**/*.{test,spec}.{js,ts,jsx,tsx}`, `tests/unit/**/*`
- Coverage excludes: `src/templates/**`, `src/main.jsx`, test files

### Test Locations
- `src/utils/__tests__/` — utility function tests
  - `template-registry.test.js`
  - `template-router.integration.test.js`
  - `template-analyzer.test.js`
  - `template-preview-runtime.test.js`
- `tests/unit/` — general unit tests
  - `setup.ts` — test setup (DOM mocks, etc.)
  - `test-utils.tsx` — shared test utilities
  - `utils/` — utility test helpers

### Test Utilities
- `tests/unit/test-utils.tsx` — shared rendering utilities
- `tests/fixtures/api-mocks.ts` — API mock data for tests

### Running Tests
```bash
npm test              # Run all unit tests
npm run test:ui       # Vitest UI mode
npm run test:coverage # With v8 coverage report
```

## E2E Tests

### Configuration (`playwright.config.ts`)
- Located in `tests/e2e/`
- Page Object Model: `tests/pages/`
- Fixtures: `tests/e2e/fixtures/`
- Global setup: `tests/e2e/global-setup.ts`

### Test Suites
- `tests/e2e/suite.spec.ts` — main test suite
- `tests/e2e/deploy/` — deploy flow tests
- `tests/e2e/ops-center/` — operations center tests
- `tests/e2e/settings/` — settings page tests
- `tests/e2e/sites/` — sites management tests
- `tests/e2e/wizard/` — LP creation wizard tests

### Running E2E
```bash
npm run test:e2e         # Run all E2E tests
npm run test:e2e:headed  # With browser visible
npm run test:e2e:debug   # Debug mode
npm run test:e2e:ui      # Playwright UI
npm run test:report      # Show HTML report
```

## Coverage

- Provider: `v8`
- Reporters: text, json, html
- Include: `src/**/*.{js,jsx,ts,tsx}`, `tests/unit/**/*`
- Exclude: templates, main.jsx, test files, node_modules, dist
- Output: `coverage/` directory

## Mocking Patterns

- API mocks defined in `tests/fixtures/api-mocks.ts`
- DOM environment: `happy-dom` (lighter than jsdom)
- `jsdom` also available as devDependency for specific cases
- Testing Library: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`

## Test Gaps (Observed)

- Root-level `services/` and `utils/` have no dedicated test files
- Worker code (`apps/worker/`, `apps/api-worker/`) has no test setup
- Template adapters (`src/adapters/`) have no tests
- Coverage focused on template system utilities; other areas sparse
