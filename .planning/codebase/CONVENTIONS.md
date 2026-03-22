# Coding Conventions

**Analysis Date:** 2026-03-22

## Naming Patterns

**Files:**
- React components: `PascalCase.jsx` (e.g. `AppRoot.jsx`, `ErrorBoundary.jsx`).
- Astro pages and layouts: `*.astro` (e.g. `src/pages/index.astro`, `src/layouts/Layout.astro`).
- Services and utilities: `kebab-case.js` or descriptive camelCase (e.g. `src/services/api.js`, `src/services/sentry.js`).
- TypeScript used alongside JS for adapters and some tests (e.g. `src/adapters/template-feature-matrix.ts`).

**Functions:**
- `camelCase` for functions and methods (e.g. `resolveApiBase`, `buildApiUrl`, `captureError` in `src/services/api.js` and `src/services/sentry.js`).

**Variables:**
- `camelCase` for locals; `UPPER_SNAKE` for module-level constants (e.g. `CSRF_TOKEN_KEY` in `src/services/api.js`).

**Types:**
- TypeScript: `PascalCase` for types and interfaces where used (e.g. `AccountRow` in worker-related tests under `tests/unit/workers/`).

**Tests:**
- Unit/integration: `*.test.js` or `*.spec.ts` co-located under `__tests__/` or under `tests/unit/` (e.g. `src/utils/__tests__/capability-resolver.test.js`, `tests/unit/utils/index.spec.ts`).

## Code Style

**Formatting:**
- No Prettier configuration detected in the repository root. Rely on ESLint warnings and consistent team style.

**Linting:**
- ESLint 9 flat config: `eslint.config.js`.
- Lint command: `npm run lint` (`eslint .`).
- **Scoped files:** `**/*.{js,jsx}` only — TypeScript/TSX files are not in the `files` glob (use `npm run check` via Astro for TS).
- **Ignored paths:** `dist`, `node_modules`, `coverage`, Playwright output dirs, `apps/**`, `packages/**`, `templates/**`, `docs/**`, `scripts/**`, `*.config.*` (see `globalIgnores` in `eslint.config.js`).
- **Key rules (mostly `warn`):** `no-unused-vars` with `varsIgnorePattern: '^[A-Z_]'` and `argsIgnorePattern: '^_'`, React Hooks recommended set, `react-refresh/only-export-components`.

**Type checking:**
- `npm run check` runs `astro check` (TypeScript + Astro validation per `package.json`).

## Import Organization

**Order (observed pattern):**
1. Side-effect imports first when order matters (e.g. Sentry init before React in `src/AppRoot.jsx`: `import "./services/sentry"`).
2. External packages (`react`, `@sentry/react`, UI libraries).
3. Internal relative imports (`./App.jsx`, `../components/...`).

**Path aliases:**
- `tsconfig.json`: `"@/*": ["src/*"]` for editor/TS resolution.
- Vite/Astro (`astro.config.mjs` `vite.resolve.alias`): `@` maps to `src/templates/astrodeck-main/src` — **not** the same as `src/*` at repo root; prefer relative imports for app shell code unless you intentionally target the template subtree.
- Vitest (`vitest.config.ts`): `@` → `./src`, `@constants` → `./src/constants`, `#lp-template-generator` → `./packages/lp-template-generator/src` (tests only).

**Example (relative imports in root app):**

```jsx
// src/AppRoot.jsx
import "./services/sentry";
import { StrictMode } from "react";
import * as Sentry from "@sentry/react";
import App from "./App.jsx";
```

## Error Handling

**API layer (`src/services/api.js`):**
- Network failures: `try/catch` around `fetch`, return structured objects `{ error, detail, url }` with `error: "NETWORK_ERROR"` when appropriate — do not throw for expected HTTP/network failures.
- Non-OK HTTP: parse body when possible; return `{ error, detail, url }`.
- JSON parse failures: `console.warn` with `[API]` prefix, return `buildTextError(...)`.

**React:**
- Optional Sentry boundary in `src/AppRoot.jsx` when `VITE_SENTRY_DSN` is set; otherwise `src/components/ErrorBoundary.jsx`.

**Sentry helpers (`src/services/sentry.js`):**
- `captureError(error, context)` for manual reporting; `beforeSend` scrubs `token=` from breadcrumb URLs.

## Logging

**Framework:** `console` for dev/diagnostic messages; `@sentry/react` for production error reporting and breadcrumbs.

**Patterns:**
- Prefix logs by area: `[API]` in `src/services/api.js`, `[Sentry]` in `src/services/sentry.js`.
- Initialization messages use emoji sparingly for scan-ability (e.g. `[Sentry] ✅ Initialized`).

```javascript
// src/services/api.js
console.warn("[API] Network error or timeout:", e?.message || e);
```

**Breadcrumbs:** `addBreadcrumb(category, message, data)` in `src/services/sentry.js` for manual tracing when DSN is configured.

## Comments

**When to comment:**
- File-level blocks in tests describing scope (e.g. `src/utils/__tests__/capability-resolver.test.js` header).
- Section separators in large test files (`// ─── Test Fixtures ───`).

**JSDoc/TSDoc:**
- Not consistently applied; module-level JSDoc appears in `src/services/sentry.js` for public helpers.

## Function Design

**Size:** Large modules exist (e.g. `src/services/api.js`); new code should prefer small, testable helpers.

**Parameters:** Default empty objects for options (`request(path, opts = {})` in `src/services/api.js`).

**Return values:** API client returns plain objects or parsed JSON; use explicit error fields instead of exceptions for control flow.

## Module Design

**Exports:** Named object for HTTP API (`export const api = { get, post, ... }` in `src/services/api.js`); named exports for Sentry helpers.

**Barrel files:** `src/utils/index` pattern used where re-exports are helpful (see imports like `import { LS } from '../../../src/utils'` in `tests/unit/utils/index.spec.ts`).

---

*Convention analysis: 2026-03-22*
