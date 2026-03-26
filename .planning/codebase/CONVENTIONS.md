# Coding Conventions

**Analysis Date:** 2025-03-26

## Naming Patterns

**Files:**
- React shell and features: `.jsx` in `src/components/`, `src/App.jsx`, `src/AppRoot.jsx`.
- Shared UI primitives: `.tsx` under `src/components/ui/` (e.g. `button.tsx`, `tabs.tsx`).
- Utilities and services: `.js` for legacy modules (e.g. `src/utils/template-registry.js`, `src/services/api.js`); newer adapters may use `.ts` (e.g. `src/adapters/template-feature-matrix.ts`).
- Astro pages and lander templates: `.astro` under `src/pages/` and `src/templates/<template-id>/`.
- Tests next to code: `__tests__/*.test.js|jsx` or co-located `*.test.jsx` (e.g. `src/components/DiffViewer.test.jsx`).
- Vitest specs under repo root: `tests/unit/**/*.spec.ts`.

**Functions:**
- Use `camelCase` for functions and variables (`openLpWizardFromSidebar`, `getTemplateFeatureMatrix`).
- React components: `PascalCase` (`DiffViewer`, `Wizard`).

**Variables:**
- Constants grouped in `src/constants` and imported as named exports; theme object often aliased: `import { THEME as T } from "./constants"` or `from "../../constants"` (see `src/App.jsx`, `src/components/ui/toast.tsx`).

**Types:**
- TypeScript: use `interface` / `type` as needed; `type VariantProps` from CVA in UI components (`src/components/ui/badge.tsx`).

## Code Style

**Formatting:**
- No root `.prettierrc` or Biome config detected. Follow existing file style: main app favors **double quotes** in `src/App.jsx`; some TSX uses double quotes (`import * as React from "react"` in `src/components/ui/button.tsx`).
- Match the dominant quote style in the directory you edit.

**Linting:**
- ESLint flat config: `eslint.config.js`.
- **Scope:** only `**/*.{js,jsx}` — **not** `.ts` / `.tsx`.
- **Ignored paths:** `dist`, `node_modules`, `coverage`, Playwright output dirs, `apps/**`, `packages/**`, `templates/**`, `docs/**`, `scripts/**`, `*.config.*` (`eslint.config.js` `globalIgnores`).
- Run: `npm run lint` (from repo root `package.json`).
- Common rules (warnings): `no-unused-vars` with `varsIgnorePattern: '^[A-Z_]'`, `argsIgnorePattern: '^_'`; React Hooks recommended sets; `react-refresh/only-export-components`: warn.

**TypeScript / Astro static analysis:**
- Run `npm run check` — invokes `astro check` (`@astrojs/check`) for Astro + TS in included sources.
- `tsconfig.json` extends `astro/tsconfigs/strict`, `jsx`: `react-jsx`, `baseUrl` `.`, paths: `@/*` → `src/*`.
- `tsconfig.json` **excludes** `tests` — Playwright/E2E types use `tests/tsconfig.json` which extends the root config.

## Import Organization

**Order (observed in `src/App.jsx`):**
1. External packages (`react`).
2. Same-layer services, constants, utils (grouped with blank lines between concerns).
3. Component imports under a `// Component Imports` comment block.

**Path aliases:**
- **IDE / `tsc` (paths):** `@/*` → `src/*` (`tsconfig.json`).
- **Vite (dev/build):** `astro.config.mjs` sets `resolve.alias['@']` to `src/templates/astrodeck-main/src` and `#lp-template-generator` to `packages/lp-template-generator/src`. Bundled resolution follows Vite, not only `tsconfig` — when adding imports, **mirror the pattern used in the same folder** (shell code often uses **relative** `./services/...`, `./components/...`).
- **Vitest:** `vitest.config.ts` maps `@` → repo `./src` and `@constants` → `./src/constants` — unit tests resolving `@/` see top-level `src/`, not the Astro Vite alias.

**Prescriptive rule for new code:**
- In `src/App.jsx` and large JSX features: prefer **relative** imports (`./services/api`, `./components/Sidebar`).
- In `.ts` modules that already use `@/`: keep consistency within that file tree; run `npm run check` after changes.

## Error Handling

**Patterns:**
- Async flows in `App.jsx` use try/catch with user-visible handling and logging patterns tied to `ErrorLog` / `logError` (`src/components/ErrorLog.jsx`).
- Utilities like `LS.set` return booleans on failure (`tests/unit/utils/index.spec.ts` documents quota behavior).

## Logging

**Framework:** `console` for ad-hoc debugging in tests and some E2E specs; Sentry integration via `src/services/sentry` and `setSentryContext` / `addBreadcrumb` from `src/App.jsx`.

**Patterns:**
- Prefer existing `logError` / Sentry breadcrumbs for production paths when extending `App.jsx` or services.

## Comments

**When to Comment:**
- File-level blocks for test suites describing ticket or feature scope (e.g. `src/components/DiffViewer.test.jsx`, `tests/e2e/wizard/wizard-basic.spec.ts`).
- Inline comments for non-obvious business rules (wizard steps, deploy flows).

**JSDoc/TSDoc:**
- Sparse; short leading comments for test modules are common. Use TSDoc on exported public TS APIs when adding new `.ts` modules under `src/adapters/` or shared libraries.

## Function Design

**Size:** `src/App.jsx` is large; new features should prefer **extracted components** or **services** under `src/components/` or `src/services/` rather than growing the root file.

**Parameters:** Destructuring for props in React components; options objects for complex service calls.

**Return Values:** Explicit booleans for success/failure in storage helpers; async functions return Promises.

## Module Design

**Exports:** Named exports for components and utilities; default export for Astro layouts/pages where used.

**Barrel Files:** `src/utils/index.js` (or equivalent) re-exports utilities — `tests/unit/utils/index.spec.ts` imports `LS` from `../../../src/utils`.

## Git hooks

**Pre-push:** `.githooks/pre-push` blocks direct push to `main` and warns on branches >50 commits ahead. `package.json` `prepare` sets `core.hooksPath` to `.githooks`.

---

*Convention analysis: 2025-03-26*
