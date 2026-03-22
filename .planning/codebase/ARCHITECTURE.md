# Architecture

**Analysis Date:** 2026-03-22

## Pattern Overview

**Overall:** Monorepo-style single product — an Astro 5 static/SSR-capable shell hosting a React 19 single-page application (“FusionOps” / LP Factory), with Cloudflare Workers backends and browser-accessible data layers (Neon Postgres, Cloudflare D1 via API).

**Key Characteristics:**
- **Hybrid UI:** Astro owns routing and document shell (`src/pages`, `src/layouts`); the main UX is one React tree hydrated with `client:only="react"` from `src/AppRoot.jsx`.
- **Service-oriented frontend:** Feature logic lives in `src/services/` (HTTP client, auth, DB adapters, build/deploy automation), not in a formal MVC backend inside this repo’s web tree.
- **Separate worker apps:** API and async work run in `apps/api-worker` and specialized workers under `apps/`, not inside the Astro process.

## Layers

**Presentation (Astro + layouts):**
- Purpose: Page routes, HTML shell, SEO-related endpoints, CSP-oriented dev server headers.
- Location: `src/pages/`, `src/layouts/`
- Contains: `.astro` pages, `APIRoute` handlers (e.g. `src/pages/e.ts`, `src/pages/robots.txt.ts`)
- Depends on: React islands, `public/` assets
- Used by: Browser requests, crawlers

**Presentation (React SPA):**
- Purpose: Dashboard, wizard, ops center, settings, and all interactive UI.
- Location: `src/components/`, `src/App.jsx`, `src/AppRoot.jsx`, `src/hooks/`
- Contains: Feature modules (e.g. `Wizard/`, `OpsCenter/`, `TemplateGenerator/`), shared UI primitives under `src/components/ui/`
- Depends on: `src/services/`, `src/utils/`, `src/constants`, `src/lib/utils.ts`
- Used by: Astro pages that mount `AppRoot` (see `src/pages/index.astro`)

**Application services (browser + shared logic):**
- Purpose: API calls, session/auth, Neon/D1 access wrappers, integrations (Cloudflare, registrars, proxies), template build pipeline, quality checks.
- Location: `src/services/`
- Contains: `api.js` (fetch wrapper), `auth.js`, `neon.js`, `d1.js`, `build/` (e.g. `TemplateBuilder.js`, `AstroBuilder.js`), `quality-check/`, integration modules (`cloudflare-*.js`, `voluum.js`, etc.)
- Depends on: `src/utils/`, environment via `import.meta.env`, browser storage where noted in modules
- Used by: React components and build utilities

**Utilities & deploy orchestration:**
- Purpose: Template analysis/normalization, deploy routing, generators, risk/fingerprint helpers.
- Location: `src/utils/` (notably `deployers/index.js`, `template-analyzer.js`, `lp-generator.js`)
- Contains: Pure helpers and orchestrators invoked from services and tests
- Depends on: Node/browser APIs as documented per file
- Used by: `src/services/build/`, UI flows, Vitest suites

**Template adapters (pluggable contract):**
- Purpose: Normalize and validate per-template site data for preview/build.
- Location: `src/adapters/template-adapter.ts` (interface), `src/templates/*/adapter.ts` (implementations, e.g. `src/templates/lander-core/adapter.ts`)
- Contains: TypeScript adapter modules implementing `TemplateAdapter`
- Depends on: Template-specific utils (e.g. `src/utils/lp-generator.js`)
- Used by: Template registry and build paths that resolve capabilities

**Backend (Cloudflare Workers):**
- Purpose: Primary REST API, automation proxies, tracking/callback endpoints, D1 migrations.
- Location: `apps/api-worker/src/worker.js` (large route handler), `apps/worker/src/index.ts` (callbacks, `/track`, `/e` pixel), other `apps/*` packages as deployed units
- Contains: Worker `fetch` handlers, CORS helpers, Neon usage in API worker
- Depends on: Worker bindings (D1, env secrets — configured in deployment, not documented here)
- Used by: `src/services/api.js` and proxy routes

**Template generator package:**
- Purpose: Programmatic generation of Astro/template variants (CLI and library exports).
- Location: `packages/lp-template-generator/` (`src/index.js`, `src/core/`, `src/templates/`)
- Contains: Node-based generator and template registry
- Depends on: Consumed via `#lp-template-generator` alias in Vite (`astro.config.mjs`, `vitest.config.ts`)
- Used by: Scripts and tooling that import the package

## Data Flow

**Authenticated dashboard → API:**

1. User interacts with React in `src/App.jsx`; state may persist via `localStorage` (see keys like `lpf2-settings` in `src/services/d1.js` and related modules).
2. `src/services/api.js` resolves base URL (`VITE_API_BASE`, `window.__LP_API__`, or production default), builds URLs, attaches CSRF for same-origin mutations, and `fetch`es the remote Worker API.
3. `apps/api-worker` handles JSON routes, CORS, and persistence (Neon/D1 patterns in `worker.js`).

**Direct Neon from browser:**

1. `src/services/neon.js` uses `@neondatabase/serverless` in the browser for configured connection strings (`VITE_NEON_URL` and settings-driven configuration as implemented in that module).
2. Tables are ensured via `ensureTables()` and CRUD helpers used by `src/services/auth.js` and app features.

**Template build → deploy:**

1. User or automation supplies template files; `src/services/build/TemplateBuilder.js` detects framework via `src/utils/template-analyzer.js`, delegates to `AstroBuilder`, `ViteBuilder`, or `HtmlStaticBuilder`, runs anti-fingerprint and quality checks (`src/services/quality-check/QualityChecker.js`), then stages output.
2. `src/utils/deployers/index.js` maps deploy target strings to modules (`cf-pages.js`, `netlify.js`, `vercel.js`, `s3-cloudfront.js`, `git-push.js`, `github-actions.js`, etc.) and coordinates Worker-backed calls where applicable.

**Tracking / pixel:**

1. Astro route `src/pages/e.ts` accepts beacon-style POST for first-party pixel logging (204 responses).
2. `apps/worker` exposes `/e`, `/track`, and callback routes for external networks (see `apps/worker/src/index.ts`).

**State Management:**
- React `useState` / effects in `src/App.jsx` for global UI state; `localStorage` for settings and session (see `src/services/auth.js`); no Redux/Zustand detected as core pattern.

## Key Abstractions

**HTTP client:**
- Purpose: Centralized API calls with timeout and CSRF behavior.
- Examples: `src/services/api.js`
- Pattern: `request(path, opts)` + thin wrappers (`get`, `post`, etc. if exported)

**Template build orchestration:**
- Purpose: Single pipeline for all template formats with quality gates.
- Examples: `src/services/build/TemplateBuilder.js`, builders under `src/services/build/`
- Pattern: Strategy by framework ID from `template-analyzer`

**TemplateAdapter:**
- Purpose: Contract for template-specific validation, mapping, and render/preview.
- Examples: `src/adapters/template-adapter.ts`, `src/templates/lander-core/adapter.ts`
- Pattern: Interface + per-template module

**Deploy orchestrator:**
- Purpose: Uniform `{ success, url, deployId, target, error }` style results across targets.
- Examples: `src/utils/deployers/index.js`

## Entry Points

**Astro dev/build:**
- Location: `astro.config.mjs`
- Triggers: `npm run dev`, `npm run build` (`package.json`)
- Responsibilities: React integration (`@astrojs/react`), Tailwind Vite plugin, dev proxy `/api` → `VITE_API_BASE`, path aliases (`@` → `src/templates/astrodeck-main/src` in Vite; differs from `tsconfig` `@/*` → `src/*` — use explicit relative imports or know which tool resolves which alias)

**Primary UI page:**
- Location: `src/pages/index.astro`
- Triggers: `/` request
- Responsibilities: `Layout` + `AppRoot` client island

**React root:**
- Location: `src/AppRoot.jsx` → `src/App.jsx`
- Triggers: Client hydration of the index page
- Responsibilities: Sentry init import order, error boundary, full app routing by `page` state

**Worker API:**
- Location: `apps/api-worker/src/worker.js`
- Triggers: HTTP to deployed worker origin
- Responsibilities: REST surface, Neon, browser automation (`@cloudflare/puppeteer`), D1, CORS policy

**Callback / tracking worker:**
- Location: `apps/worker/src/index.ts`
- Triggers: `/callback/...`, `/track`, `/e`, `/health`
- Responsibilities: LeadsGate callback handling (`handlers/callback.ts`), beacon ingestion

## Error Handling

**Strategy:** Layered — UI boundaries (Sentry + React error boundaries), network timeouts in `src/services/api.js`, Worker-level `try/catch` with JSON error responses and CORS headers.

**Patterns:**
- **React:** `src/AppRoot.jsx` imports `./services/sentry` first; uses `@sentry/react` `ErrorBoundary` when `VITE_SENTRY_DSN` is set, else `src/components/ErrorBoundary.jsx`
- **Fetch:** `AbortController` timeout in `src/services/api.js`; slow endpoints get extended timeout
- **Workers:** Handler-level catches (e.g. `apps/worker/src/index.ts` for callback path); `apps/api-worker/src/worker.js` uses `json()` helper for consistent error payloads

## Cross-Cutting Concerns

**Logging:** `console` in Workers and some routes; client-side Sentry breadcrumbs via `src/services/sentry.js` (as used from `App.jsx`).

**Validation:** Mixed — schema-style validation in template adapters; Worker-side validation helpers (e.g. `apps/worker/src/lib/validation.ts`); quality validators under `src/services/quality-check/validators/`.

**Authentication:** `src/services/auth.js` — PBKDF2 in browser, session in `localStorage`; admin checks and user APIs coordinate with Neon via `src/services/neon.js`. API worker enforces origin/trust policies (see `isTrustedOriginRequest` pattern in `apps/api-worker/src/worker.js`).

---

*Architecture analysis: 2026-03-22*
