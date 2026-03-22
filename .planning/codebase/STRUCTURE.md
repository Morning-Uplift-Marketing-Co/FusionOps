# Codebase Structure

**Analysis Date:** 2026-03-22

## Directory Layout

```
[project-root]/
├── src/                    # Canonical Astro + React application (use this for app code)
│   ├── adapters/           # TemplateAdapter interface + contract
│   ├── assets/             # Static assets consumed by the app
│   ├── components/         # React UI (features + ui/)
│   ├── constants/          # Shared constants (theme, defaults)
│   ├── hooks/              # React hooks
│   ├── layouts/            # Astro layouts
│   ├── lib/                # Shared lib helpers (e.g. cn/utils)
│   ├── pages/              # Astro routes + APIRoute handlers
│   ├── services/           # API, auth, DB, build, integrations
│   ├── styles/             # Global styles
│   ├── templates/          # Embedded lander templates + per-template adapters
│   ├── utils/              # Template analysis, deployers, generators
│   ├── __tests__/          # Co-located tests under src
│   ├── App.jsx             # Root React app (state, navigation)
│   └── AppRoot.jsx         # Sentry + error boundary wrapper
├── apps/                   # Deployable Cloudflare Worker apps (separate packages)
│   ├── api-worker/         # Main API (src/worker.js)
│   ├── worker/             # Callbacks / tracking / pixel routes
│   ├── lander/             # Standalone lander Astro app
│   ├── pixel-worker/       # Pixel-related worker
│   └── cf-proxy/           # Proxy worker
├── packages/
│   └── lp-template-generator/   # @lp-factory/template-generator — CLI + core
├── templates/              # External / bolt-import template projects (large; excluded from tsconfig)
├── tests/                  # Vitest setup + unit + Playwright e2e
│   ├── unit/
│   └── e2e/
├── scripts/                # Node maintenance, deploy helpers, converters
├── public/                 # Astro public assets
├── docs/                   # Project documentation
├── deploy-configs/         # Deployment configuration artifacts
├── schemas/                # JSON or data schemas (if present)
├── astro.config.mjs        # Astro + Vite config (proxy, aliases)
├── tsconfig.json           # TS: @/* → src/*
├── vitest.config.ts        # Vitest: @ → src, #lp-template-generator
├── eslint.config.js
├── playwright.config.ts
└── package.json            # Root scripts: astro, vitest, playwright
```

**Note:** The repository root may also contain legacy copies of `App.jsx`, `services/`, `components/`, etc. The **canonical** application tree is `src/` (referenced by `src/pages/*.astro` and `tsconfig.json`). Prefer editing under `src/` unless a root file is proven to be the live import target.

## Directory Purposes

**`src/`:**
- Purpose: FusionOps web UI, template tooling invoked from the browser, and shared build/quality logic.
- Contains: `.jsx`/`.tsx` components, `.astro` pages, `.js` services, `.ts` adapters.
- Key files: `src/App.jsx`, `src/AppRoot.jsx`, `src/services/api.js`, `src/pages/index.astro`

**`src/pages/`:**
- Purpose: File-based routing and HTTP endpoints implemented as Astro `APIRoute` modules.
- Contains: `index.astro`, `docs/index.astro`, `my-sites-preview.astro`, `e.ts`, `robots.txt.ts`
- Key files: `src/pages/index.astro` (main entry)

**`src/services/`:**
- Purpose: All non-UI application logic: network, persistence adapters, build pipeline, quality checks.
- Contains: `build/`, `quality-check/`, integration modules, `api.js`, `neon.js`, `d1.js`, `auth.js`
- Key files: `src/services/build/TemplateBuilder.js`, `src/services/api.js`

**`src/components/`:**
- Purpose: React feature areas and design-system-style primitives.
- Contains: Top-level feature folders (`Wizard/`, `OpsCenter/`, `TemplateGenerator/`, …) and `ui/` (buttons, inputs, toast, etc.)

**`src/templates/`:**
- Purpose: First-party template sources and `adapter.ts` files for template-specific behavior.
- Contains: Nested `src/` trees per template (Astro/React components for landers), `lander-core/adapter.ts`, etc.

**`apps/`:**
- Purpose: Independently deployed Workers and auxiliary apps; each has its own `package.json` and Wrangler usage.
- Contains: `api-worker`, `worker`, `lander`, etc.

**`packages/lp-template-generator/`:**
- Purpose: Reusable template generation library and CLI (`bin/lp-gen.js`).
- Contains: `src/core/`, `src/templates/`

**`tests/`:**
- Purpose: Cross-cutting tests — Vitest `tests/unit/`, Playwright `tests/e2e/`, shared fixtures.
- Contains: `tests/unit/setup.ts`, `tests/e2e/global-setup.ts`

**`templates/` (repo root):**
- Purpose: Standalone template projects (e.g. imports from Bolt/Lovable); not part of strict `tsconfig` `include` for the main app.
- Contains: Full mini-projects with their own `package.json` files

## Key File Locations

**Entry Points:**
- `src/pages/index.astro`: Main `/` page mounting React.
- `src/AppRoot.jsx`: Client bootstrap (Sentry, error UI).
- `src/App.jsx`: Application shell and page state.
- `apps/api-worker/src/worker.js`: Worker API entry.
- `apps/worker/src/index.ts`: Callback/tracking worker entry.

**Configuration:**
- `astro.config.mjs`: Integrations, Vite proxy, Tailwind, path aliases for Vite.
- `tsconfig.json`: TypeScript paths `@/*` → `src/*`.
- `vitest.config.ts`: Test aliases and include globs.
- `eslint.config.js`: Lint rules.
- `playwright.config.ts`: E2E runner config.

**Core Logic:**
- `src/services/api.js`: HTTP client for Worker API.
- `src/services/build/TemplateBuilder.js`: Build orchestration.
- `src/utils/deployers/index.js`: Deploy target routing.

**Testing:**
- `vitest.config.ts`: Vitest entry and coverage scope.
- `tests/unit/setup.ts`: Unit test setup.
- `tests/e2e/`: Playwright specs and page objects.

## Naming Conventions

**Files:**
- React components: `PascalCase.jsx` or `.tsx` (e.g. `Dashboard.jsx`, `src/components/ui/button.tsx`).
- Services/utilities: `kebab-case.js` or descriptive camelCase (e.g. `cloudflare-dns.js`, `api.js`).
- Tests: `*.test.js`, `*.spec.ts` co-located under `src/**/__tests__/` or under `tests/unit/`.
- Astro: `*.astro` for pages/layouts; `APIRoute` modules often named by route (`e.ts`, `robots.txt.ts`).

**Directories:**
- Feature folders: `PascalCase` or descriptive lowercase (`Wizard`, `OpsCenter`, `quality-check`).
- `src/components/ui/`: Shared primitives (shadcn-style).

## Where to Add New Code

**New Feature:**
- Primary UI: `src/components/<Feature>/` with exports consumed from `src/App.jsx` (add navigation/state there).
- Feature-specific hooks: `src/hooks/`.
- API calls: extend or add modules under `src/services/`; use `src/services/api.js` for HTTP to the Worker.

**New Astro Page or Endpoint:**
- Pages: `src/pages/<name>.astro`.
- JSON/binary API routes: `src/pages/<name>.ts` exporting `GET`/`POST` per Astro `APIRoute` conventions.

**New Worker Route or Handler:**
- Main API: `apps/api-worker/src/worker.js` (or extract modules from it following existing patterns in that file).
- Callbacks/tracking: `apps/worker/src/` (`handlers/`, `lib/`).

**New Template Kind:**
- Adapter: implement `TemplateAdapter` in `src/adapters/` or `src/templates/<id>/adapter.ts`.
- Template sources: under `src/templates/<id>/` mirroring existing layouts.

**New Deploy Target:**
- Add module under `src/utils/deployers/<target>.js` and register in `src/utils/deployers/index.js` `DEPLOYERS` map.

**Utilities:**
- Shared helpers: `src/utils/`; cross-cutting React helpers: `src/lib/utils.ts` (existing `cn` pattern).

**Tests:**
- Unit/integration near code: `src/**/__tests__/*.test.js` or top-level `src/__tests__/`.
- Broader unit tests: `tests/unit/`.
- E2E: `tests/e2e/<area>/*.spec.ts` with page objects in `tests/e2e/pages/`.

## Special Directories

**`dist/`:**
- Purpose: Astro build output.
- Generated: Yes (by `npm run build`).
- Committed: No (typically gitignored).

**`node_modules/`:**
- Purpose: Dependencies.
- Generated: Yes.
- Committed: No.

**`coverage/`:**
- Purpose: Vitest coverage HTML/lcov.
- Generated: Yes.
- Committed: No.

**`.env.lock` (if present):**
- Purpose: Local non-secret defaults merged at dev time by `astro.config.mjs` (see file existence only; do not commit secrets).

---

*Structure analysis: 2026-03-22*
