# FusionOps (LP Factory) — codebase map

**Analysis date:** 2026-04-08

This document is an **onboarding-oriented map**: what runs where, where to edit first, and how major flows connect. For deeper layer descriptions and data flows, see `.planning/codebase/ARCHITECTURE.md` and `docs/CODEMAPS/`.

---

## Tech stack and runtime boundaries

| Runtime | Location | Role |
|--------|----------|------|
| **Browser (React 19)** | `src/AppRoot.jsx`, `src/App.jsx`, `src/components/**` | Primary product UI: Wizard, sites, settings, ops dashboards. |
| **Astro 6 (shell)** | `src/pages/*.astro`, `src/layouts/` | Static/docs routes; mounts React with `client:only`. |
| **Vite (bundled by Astro)** | `astro.config.mjs` | Dev server (port **4444** in config), env injection (`VITE_*`, `PUBLIC_*`). |
| **API Worker** | `apps/api-worker/src/worker.js` | Main REST API: sites, templates, settings, proxies, AI routes, some pixel/postback paths. |
| **Pixel Worker** | `apps/pixel-worker/` | Optional dedicated first-party pixel (`t.{domain}/e`); production notes in `apps/pixel-worker/wrangler.toml` indicate **`/e` may be owned by `lp-factory-api`** — verify routes before assuming `lp-factory-pixel`. |
| **Callback Worker** | `apps/worker/` | LeadsGate / callback and related handlers (separate D1 DB in `apps/worker/wrangler.toml`). |
| **CORS proxy** | `apps/cf-proxy/` | Small standalone proxy Worker. |
| **LP template generator (library)** | `packages/lp-template-generator/` | `generate(templateId, config)` consumed from UI via `src/utils/template-router.js` and Vite alias `#lp-template-generator`. |
| **CI / Node scripts** | `scripts/**` | Tracking injection, validation, template tooling (e.g. `scripts/inject-tracking.mjs`). |

**API base in dev:** `astro.config.mjs` defines a default API base and **proxies `/api`** to that host so the browser can call same-origin `/api/...`. Client resolution lives in `src/services/api.js` (`buildApiUrl` / base deduplication).

---

## Frontend entry, routing, and key folders

**Mount chain**

- `src/pages/index.astro` → imports `src/AppRoot.jsx` with `client:only="react"`.
- `src/AppRoot.jsx` initializes Sentry first (`src/services/sentry`), then wraps `src/App.jsx` in `StrictMode` and optional Sentry or `ErrorBoundary`.

**In-app navigation**

- There is **no React Router file tree** for the main shell: **`page` state in `src/App.jsx`** drives which view renders (e.g. Dashboard, Sites, Wizard, Settings), with `Sidebar` / `TopBar` switching views.

**High-signal directories**

- `src/components/` — feature UI (e.g. `Wizard.jsx`, `Sites`, `Settings`, `OpsCenter`, `TemplateManager`, dashboards).
- `src/services/` — `api.js`, auth, Neon/D1 helpers, Sentry, deploy-related API calls.
- `src/utils/` — **canonical** template routing, preview, wizard capabilities, deploy orchestration (`src/utils/deployers/`).
- `src/constants/` — shared constants; **`src/constants/site-fields.js`** defines allowed persisted site keys (`SITE_FIELD_KEYS`) for Wizard → API → deploy.

---

## API Worker: routing and bindings

**Routing model**

- Single **`fetch(request, env)`** in `apps/api-worker/src/worker.js`.
- Routing is **string/path based**: parse `url.pathname`, then branches such as `if (path === '/api/sites' && method === 'GET')` (and many more). **Adding an endpoint:** grep for a similar path/method and mirror patterns; there is no separate router module.

**Bindings (from `apps/api-worker/wrangler.toml`)**

- **D1 `DB`** — `fusionops-main-new-v2` (primary app data).
- **D1 `PIXEL_DB`** — `fusionops-pixel-new-v2` (e.g. realtime/pixel-related reads in API).
- **R2 `THUMBS`** — bucket `lp-factory-thumbs` (template thumbnails).
- **Browser Rendering** — `BROWSER` binding for screenshot flows.
- **Custom routes** — `t.{domain}/*` patterns listed in this file (first-party pixel hostnames tied to this Worker in production).

Do not commit secrets; Worker vars/secrets are configured in Wrangler or the dashboard (see comments in `wrangler.toml`).

---

## Critical hazards (from `.cursor/rules/fusionops-project-core.mdc`)

1. **Duplicated `utils/` trees** — Repo root `utils/` and `src/utils/` **overlap** (e.g. template-router-style files). The **running app imports from `src/utils/`** (e.g. `src/App.jsx` uses `./utils`, which resolves under `src/`). Treat **`src/utils/` as canonical** for UI and bundler-visible code; changing only root `utils/` may not affect the app. Grep both trees if scripts or tests import the other copy.

2. **Multiple Workers** — Do not assume `apps/api-worker` alone handles pixels, callbacks, and CORS. Use the correct Worker package and `wrangler.toml` for each concern.

3. **Site field drift** — New persisted fields must be added to **`src/constants/site-fields.js`**, sanitization in `src/App.jsx`, and deploy mapping when values must reach the built lander (see same rule file and `src/utils/deployers/github-actions.js`).

---

## Deploy and LP build touchpoints

| Artifact / step | Path / note |
|-----------------|-------------|
| **Per-domain CI input** | `deploy-configs/{domain}.json` in the repo — push triggers CI (see workflow). |
| **GitHub Actions deployer** | `src/utils/deployers/github-actions.js` — writes `deploy-configs/${domain}.json` via GitHub Contents API; comment in file references `.github/workflows/deploy-lp.yml` and path filter `deploy-configs/**.json`. |
| **Deploy target registry** | `src/utils/deployers/index.js` — maps `github-actions`, `cf-pages`, etc. |
| **Tracking injection in CI** | `scripts/inject-tracking.mjs` — used in LP build pipeline (also `npm run inject:index-html-tracking` at root for related flows). |
| **Validation** | `scripts/validate-template-tracking.mjs` — template tracking checks. |
| **Wizard → deploy mental model** | Comments in `src/constants/site-fields.js` and `src/components/Wizard/StepTracking.jsx` tie Wizard fields to deploy JSON and `PUBLIC_*` / `VITE_*` in CI. |

---

## Related docs

- `.planning/codebase/ARCHITECTURE.md` — layers, data flows, error handling.
- `docs/CODEMAPS/INDEX.md` — codemap entry points.
- `docs/template-system-flow.md` — template system (referenced in project rules).

---

*Codebase map supplement: 2026-04-08*
