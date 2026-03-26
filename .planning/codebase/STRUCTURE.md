# Codebase Structure

**Analysis Date:** 2026-03-26

## Directory Layout

```
lp-factory-web/                    # package name: lp-factory-web (root package.json)
├── apps/
│   ├── api-worker/                # Cloudflare Worker — main REST API (worker.js)
│   ├── worker/                    # Cloudflare Worker — callbacks, /track, /e (TypeScript)
│   ├── pixel-worker/              # Cloudflare Worker — first-party pixel t.* /e
│   ├── lander/                    # Standalone Astro lander app
│   └── cf-proxy/                  # Minimal CORS proxy Worker
├── packages/
│   └── lp-template-generator/     # Template registry + generate() implementations
├── src/                           # Primary Astro + React application
│   ├── pages/                     # Astro routes
│   ├── layouts/
│   ├── components/                # React UI (Wizard.jsx + Wizard/ steps, dashboards, …)
│   ├── services/                  # api, auth, build, dns, d1, neon, …
│   ├── utils/                     # template-router, deployers, helpers
│   ├── hooks/
│   ├── constants/
│   ├── adapters/
│   └── templates/                 # Full template project trees (Astro/Vite) used by tooling
├── templates/                     # Additional template / import sandboxes (many Astro projects)
├── utils/                         # Root-level Node/browser shared utils (registry bridge, deployers)
├── scripts/                       # Node maintenance: pack-template, convert, deploy-org, tracking inject
├── tests/                         # unit, e2e (Playwright wizard specs under tests/e2e/wizard/)
├── deploy-configs/                # Per-site or org JSON deploy descriptors
├── files/gen/                     # Generated asset helpers
└── astro.config.mjs               # Astro + Vite (Tailwind, aliases, /api proxy)
```

## Directory Purposes

**`src/`:**

- Purpose: Main product — FusionOps UI, wizard, ops dashboards, template management.
- Contains: `.jsx`/`.tsx` React, `.astro` pages, client services.
- Key files: `src/App.jsx`, `src/AppRoot.jsx`, `src/services/api.js`, `src/components/Wizard.jsx`, `src/utils/template-router.js`.

**`apps/api-worker/`:**

- Purpose: Production API surface; keep new HTTP endpoints here unless explicitly a callback/pixel-only concern.
- Contains: `src/worker.js`, `migrations/`, `wrangler.toml`.
- Key files: `apps/api-worker/src/worker.js` (all route branches).

**`apps/worker/` and `apps/pixel-worker/`:**

- Purpose: Isolated Workers with small surface areas — do not add general REST features here.
- Contains: `src/index.ts`, lib handlers, D1 migrations.

**`packages/lp-template-generator/`:**

- Purpose: Authoritative module templates and `generate(templateId, siteConfig)`.
- Contains: `src/core/registry.js`, `src/core/generator.js`, `src/core/schema.js`, `src/templates/*`.

**`utils/` (repo root):**

- Purpose: Bridges used by scripts and/or legacy imports — e.g. `utils/template-registry.js` re-exports module + legacy template lists and calls `src/services/api`.
- Contains: `lp-generator.js`, `astro-generator.jsx`, `template-registry.js`, `deployers/`.

**`templates/` and `src/templates/`:**

- Purpose: Runnable Astro (or Vite) projects for import, preview, or packaging — not the same as `packages/lp-template-generator` (which is generator code, not always a full app).
- Contains: Per-template `package.json`, `astro.config.*`, `src/`.

**`scripts/`:**

- Purpose: CLI automation (template conversion, deploy helpers, tracking injection). Run via `npm run <script>` from root `package.json`.

**`tests/`:**

- Purpose: Vitest unit tests and Playwright E2E; wizard flows under `tests/e2e/wizard/`.

**`deploy-configs/`:**

- Purpose: JSON configs consumed by deploy automation — pair changes with `scripts/deploy-org.js` or documented deploy flow.

## Key File Locations

**Entry Points:**

- `src/pages/index.astro` — home: loads `AppRoot` React island.
- `src/pages/docs/index.astro`, `src/pages/my-sites-preview.astro`, `src/pages/robots.txt.ts` — secondary routes.
- `apps/api-worker/src/worker.js` — API Worker entry.
- `apps/worker/src/index.ts` — callback Worker entry.
- `apps/pixel-worker/src/index.ts` — pixel Worker entry.
- `apps/lander/` — own `astro.config` and pages (separate app).

**Configuration:**

- `astro.config.mjs` — React integration, `VITE_*` / `.env.lock` bootstrap, port `4323`, `/api` proxy, aliases `@` → `src/templates/astrodeck-main/src`, `#lp-template-generator` → `packages/lp-template-generator/src`.
- `package.json` (root) — Astro 6, React 19, Vitest, Playwright, Wrangler in devDeps.
- `apps/*/wrangler.toml` — Worker names, D1/R2/browser bindings.

**Core Logic:**

- `src/App.jsx` — routing by `page` state, wizard launch (`page === "create"`), settings/auth, site lists.
- `src/components/Wizard.jsx` — step machine, validation, deploy orchestration, AI assist hooks.
- `src/components/Wizard/` — step components (`StepBrand.jsx`, …), `step-mapper.js`, `template-utils.js`.
- `utils/template-router.js` — central template generation dispatch.
- `utils/template-registry.js` — module + legacy + API-backed custom templates.

**Testing:**

- `vitest` config: discover via root `package.json` script `test` — configs typically at repo root (e.g. `vitest.config.*` if present).
- `tests/e2e/wizard/wizard-basic.spec.ts`, `wizard-tracking.spec.ts`.

## Naming Conventions

**Files:**

- React components: `PascalCase.jsx` or `.tsx` in `src/components/`.
- Wizard steps: `Step*.jsx` under `src/components/Wizard/`.
- Services: `camelCase.js` in `src/services/`.
- Workers: `worker.js` (api) or `index.ts` (typed workers).

**Directories:**

- `kebab-case` for multi-word packages (`lp-template-generator`, `pixel-worker`).
- Template folders often `snake_case` or `kebab-case` matching template id (e.g. `PDL_Loans_V3`).

## Where to Add New Code

**New dashboard / admin page:**

- Add a component under `src/components/`.
- Register navigation and `page === "..."` branch in `src/App.jsx` (follow existing `Sidebar` / `setPage` patterns).

**New wizard step or change step order:**

- Extend `steps` and `validateStep` in `src/components/Wizard.jsx`.
- Add or edit `src/components/Wizard/Step*.jsx` and export from `src/components/Wizard/index.js`.
- Update `src/components/Wizard/step-mapper.js` and capabilities in `src/utils/wizard-template-capabilities.js` if visibility depends on template support.

**New built-in template (module generator):**

- Add template under `packages/lp-template-generator/src/templates/<id>/` with `index.js` registering `generate`.
- Ensure registration side-effect: add to `#lp-template-generator/templates` entrypoint (pattern used by `utils/template-router.js` import).
- Extend `MODULE_TEMPLATE_IDS` (and any capability map) in `utils/template-router.js` if the wizard must treat it as a module template.

**New API endpoint:**

- Implement branch in `apps/api-worker/src/worker.js` (keep CORS and auth consistent with neighboring routes).
- Call from `src/services/api.js` by adding a method or using `api.get` / `api.post` with the new path.
- Document in OpenAPI block inside `worker.js` if the `/api/openapi.json` surface should include it.

**New deploy target:**

- Implement in `utils/deployers/` (and mirror under `src/utils/deployers/` only if existing code imports from `src/` — grep for `deployTo` imports before choosing path).
- Wire into `getAvailableTargets` and `deployTo` exports.

**New Cloudflare Worker (new subdomain or protocol):**

- Prefer `apps/<name>/` with its own `wrangler.toml`; avoid growing `worker.js` further unless it is truly API-bound.

## Special Directories

**`packages/lp-template-generator/src/templates/`:**

- Purpose: Generator modules consumed via alias; not always deployable as-is without the core pipeline.
- Generated: No — hand-maintained.
- Committed: Yes.

**`templates/` (root):**

- Purpose: Large Astro/Vite trees for experiments and imports; may contain own `node_modules` when developers run them locally.
- Generated: No.
- Committed: Yes (per repo policy).

**`.planning/`:**

- Purpose: GSD / planning artifacts including this codebase map.
- Generated: Partially hand-edited.
- Committed: Typically yes.

---

*Structure analysis: 2026-03-26*
