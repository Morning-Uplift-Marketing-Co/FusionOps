# Architecture

**Analysis Date:** 2026-03-26

## Pattern Overview

**Overall:** Monorepo with an Astro-hosted React SPA (“FusionOps / LP Factory”) talking to one primary Cloudflare Workers REST API, plus separate Workers for affiliate callbacks and first-party pixel ingestion. Template output is generated in the browser build pipeline and on the server via shared generator code and API persistence.

**Key Characteristics:**

- **Thin Astro shell, fat React app:** Pages are minimal; almost all product UI is `client:only="react"` under `src/App.jsx`.
- **API-centric backend:** Business persistence, proxies, automation, and template CRUD live in `apps/api-worker/src/worker.js` (single fetch handler with path-based routing).
- **Template system is split:** Declarative generators in `packages/lp-template-generator/`, routing/merge logic in `utils/template-router.js` and `utils/template-registry.js`, full Astro/Vite trees under `src/templates/` and `templates/`.
- **Multiple Workers by concern:** API vs callback/beacon vs dedicated pixel host; do not assume one Worker does everything.

## Layers

**Presentation (Astro + React):**

- Purpose: Render shell, mount React, provide static/docs routes.
- Location: `src/pages/`, `src/layouts/`, `src/AppRoot.jsx`, `src/App.jsx`, `src/components/`
- Contains: Wizard, dashboards, settings, deploy UIs, shared UI primitives.
- Depends on: `src/services/api.js`, `src/services/*`, `src/utils/*`, `packages/lp-template-generator` (via Vite alias `#lp-template-generator`).
- Used by: End users in the browser.

**Client services & state:**

- Purpose: HTTP to API, auth session helpers, Neon/D1 helpers used from the client flow, Cloudflare DNS orchestration from wizard.
- Location: `src/services/` (e.g. `api.js`, `auth`, `neon`, `d1`, `cloudflare-dns`, `build/`, `quality-check/`)
- Contains: Fetch wrappers, domain/DNS helpers, optional direct DB paths where wired.
- Depends on: `import.meta.env.VITE_*`, session storage, API base from `resolveApiBase()` in `src/services/api.js`.
- Used by: `src/App.jsx`, `src/components/Wizard.jsx`, feature components.

**Template generation & routing:**

- Purpose: Resolve template ID → generator; produce HTML/Astro/files for preview and deploy; merge custom templates from API.
- Location: `utils/template-router.js`, `utils/template-registry.js`, `utils/lp-generator.js`, `utils/astro-generator.jsx`, `packages/lp-template-generator/src/core/generator.js`, `packages/lp-template-generator/src/templates/*/index.js`
- Contains: `generate()` contracts returning `{ files: { path: content } }`, capability flags for the wizard, legacy bridge list in `utils/template-registry.js`.
- Depends on: Side-effect import `#lp-template-generator/templates` (see `utils/template-router.js`).
- Used by: `src/components/Wizard.jsx`, build/deploy scripts, tests.

**API Worker (Cloudflare):**

- Purpose: Authoritative REST API for sites, deploys, variants, settings, templates (including MCP ingest), proxy tunnels to third-party APIs, Voluum postback relay, pixel event reads, thumbnails (R2 + Puppeteer), OpenAPI doc.
- Location: `apps/api-worker/src/worker.js`, `apps/api-worker/wrangler.toml`
- Contains: Monolithic `fetch` router; D1 bindings `DB` and `PIXEL_DB`; optional Neon sync; R2 `THUMBS`; Browser Rendering for screenshots.
- Depends on: Worker `env` bindings and secrets (configure in Wrangler/dashboard — do not commit values).
- Used by: Browser app via `src/services/api.js`; dev server proxies `/api` (see `astro.config.mjs`).

**Callback / tracking Worker:**

- Purpose: LeadsGate callback URLs, internal `/track` beacon, and `/e` pixel handling tied to callback DB schema (`lead_callbacks`).
- Location: `apps/worker/src/index.ts`, `apps/worker/src/handlers/callback.ts`, `apps/worker/src/lib/*`
- Contains: Typed handler; D1 writes; CORS helpers; dedup/validation/voluum helpers.
- Depends on: D1 binding `DB` in `apps/worker/wrangler.toml`.
- Used by: Configured routes per domain (see comments in wrangler.toml).

**Pixel Worker:**

- Purpose: First-party pixel at `t.{domain}/e` — canonical event names, D1 `pixel_events` storage, health check.
- Location: `apps/pixel-worker/src/index.ts`, `apps/pixel-worker/wrangler.toml`
- Contains: POST/GET `/e`, event alias map, strict body size limit.
- Depends on: D1 `DB` (pixel database id in wrangler).
- Used by: Landers’ `sendBeacon` / tracking scripts hitting the `t.*` host.

**Supporting apps:**

- **`apps/lander/`:** Standalone Astro lander build (separate product surface from main app).
- **`apps/cf-proxy/`:** Small CORS proxy Worker (`lp-cors-proxy`).

## Data Flow

**Wizard → site record → deploy:**

1. User fills steps in `src/components/Wizard.jsx`; `validateStep` enforces per-step rules; `resolveWizardTemplateCapabilities` in `src/utils/wizard-template-capabilities.js` gates UI.
2. Preview/build artifacts: `generateHtmlByTemplate` / `generateDeployAssetsByTemplate` from `utils/template-router.js` call module `generate` or legacy generators.
3. `addSite` / persistence flows in `src/App.jsx` use `api` and/or `src/services/d1.js` / `src/services/neon.js` depending on feature flags and environment.
4. Deploy: `deployTo` from `utils/deployers` (and related under `utils/deployers/` / `src/utils/deployers/`) targets CF Pages, Netlify, Vercel, S3/CloudFront, etc., using settings and API proxies as needed.

**Browser → API Worker:**

1. `src/services/api.js` builds URL via `buildApiUrl` (dedupes `/api` prefix), attaches `X-CSRF-Token` for same-origin mutations, applies timeouts.
2. In local dev, Vite `server.proxy['/api']` forwards to `VITE_API_BASE` origin (see `astro.config.mjs`); production calls the Worker URL directly unless overridden.
3. Worker authenticates/trusts origin for `/api/*` (except public routes like `/api/openapi.json`); routes by `url.pathname` inside `apps/api-worker/src/worker.js`.

**Template CRUD / MCP:**

1. `GET/POST /api/templates` and related thumb routes live in the API Worker (search `path === '/api/templates'` in `worker.js`).
2. MCP-specific routes under `/api/mcp/templates` receive or list templates for external tooling.
3. Client refreshes custom templates via `fetchCustomTemplates` in `utils/template-registry.js` and events like `lp-template-refresh` from `src/App.jsx`.

**Landing page → pixel / postback:**

1. LP sends events to pixel host → `apps/pixel-worker` persists to D1.
2. Voluum and other postbacks may hit API Worker routes (e.g. `/api/postbacks`, forward logic with `vd` / allowlist in `worker.js`).
3. Callback Worker handles `POST /callback/:account_id/leadsgate` and optional `/track` / `/e` for its deployment model.

**State Management:**

- Global UI state: React `useState` in `src/App.jsx` (page, `wizData`, `sites`, `settings`, auth user, deploys, etc.).
- Wizard draft: `wizData` / `setWizData` passed as `config` / `setConfig` into `Wizard`.
- Long-lived client config: `localStorage` via helpers in `src/utils` (e.g. settings merge with `ENV_DEFAULTS` in `App.jsx`).

## Key Abstractions

**`api` client:**

- Purpose: Typed-ish JSON HTTP to the Worker API.
- Examples: `src/services/api.js`
- Pattern: `api.get("/sites")` paths are relative to resolved API base; errors return `{ error, detail, url }` objects instead of throwing.

**Template module `generate`:**

- Purpose: Single entry for file manifests per template ID.
- Examples: `packages/lp-template-generator/src/core/generator.js`, per-template `packages/lp-template-generator/src/templates/<id>/index.js`
- Pattern: Return shape includes `files` map string paths → string contents; registry in `packages/lp-template-generator/src/core/registry.js`.

**Wizard capability resolution:**

- Purpose: Keep wizard steps aligned with what a template supports.
- Examples: `src/utils/wizard-template-capabilities.js`, `src/components/Wizard/step-mapper.js`
- Pattern: Pure functions: capabilities → enabled steps; async `renderWizardSteps` loads step components without circular imports.

**Deployer registry:**

- Purpose: Choose deployment target from settings.
- Examples: `utils/deployers/index.js` (and parallel `src/utils/deployers/` where duplicated — follow existing import site when adding targets).

## Entry Points

**Main web app:**

- Location: `src/pages/index.astro`
- Triggers: HTTP request to site root.
- Responsibilities: `Layout` + `AppRoot` with `client:only="react"`.

**React root:**

- Location: `src/AppRoot.jsx` → `src/App.jsx`
- Triggers: Client hydration.
- Responsibilities: Sentry init order, error boundary, auth gate, page switcher, Wizard when `page === "create"`.

**API Worker:**

- Location: `apps/api-worker/src/worker.js` default export `fetch` handler
- Triggers: All HTTP to deployed Worker.
- Responsibilities: Full REST surface, CORS, D1/Neon/R2, proxies.

**Callback Worker:**

- Location: `apps/worker/src/index.ts`
- Triggers: Routed hostnames for callback/track/pixel (per deploy config).

**Pixel Worker:**

- Location: `apps/pixel-worker/src/index.ts`
- Triggers: `t.{domain}` routes.

## Error Handling

**Strategy:** Layer-specific — React error boundaries in `src/AppRoot.jsx` / `src/components/ErrorBoundary.jsx`; API Worker returns JSON with status codes and logs via `console.error` for template POST failures; Workers use try/catch with generic 404/500 JSON.

**Patterns:**

- API client: Non-throwing `request()` — callers check `.error` on result.
- Workers: Early `OPTIONS` CORS; `waitUntil` for async pixel/track processing where used.

## Cross-Cutting Concerns

**Logging:** `console` in Workers; client `console.warn` on API network failure; Sentry in React when `VITE_SENTRY_DSN` set (`src/services/sentry`).

**Validation:** Wizard step validation in `src/components/Wizard.jsx`; API Worker parses bodies and validates paths/hosts (e.g. Voluum forward allowlist).

**Authentication:** `src/services/auth.js` consumed by `App.jsx`; API routes require trusted origin or tokens for `/api/*` (see `isTrustedOriginRequest` and route guards in `worker.js`).

---

*Architecture analysis: 2026-03-26*
