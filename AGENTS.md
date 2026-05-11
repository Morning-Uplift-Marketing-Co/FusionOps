# Agent / AI instructions (FusionOps — LP Factory)

This repository is **FusionOps** (internal name **LP Factory**): an **Astro + React** control plane for building and deploying **PPC / affiliate landing pages**, backed by a **Cloudflare Worker API** (`apps/api-worker`).

## Start here

1. **Always-on context:** `.cursor/rules/fusionops-project-core.mdc` (product map, data flow, duplicate-`utils` warning, env naming).
2. **New clone / env:** `README.md`, `docs/GETTING-STARTED.md`
3. **Databases & Neon / D1 / keys:** `docs/DATABASES.md`
4. **PRs / CI secrets / operator workflow:** `docs/CONTRIBUTING.md`
5. **Deeper docs:** `.planning/codebase/ARCHITECTURE.md`, `docs/CODEMAPS/frontend.md`, `docs/template-system-flow.md`.

## Scoped rules (Cursor `.mdc`)

| File | When it applies |
|------|------------------|
| `fusionops-project-core.mdc` | Every session (`alwaysApply`) |
| `fusionops-frontend-react.mdc` | Files under `src/**` |
| `fusionops-api-worker.mdc` | `apps/api-worker/**` |
| `fusionops-deploy-and-lp-build.mdc` | Workflows, `deploy-configs/**`, inject/validate scripts |
| `fusionops-lp-template-generator.mdc` | `packages/lp-template-generator/**` |

## Non-negotiables for edits

- **`src/utils/` is canonical** for template routing / LP preview code shared with the UI; root **`utils/`** may duplicate files — grep both before assuming one source.
- New persisted site fields: extend **`src/constants/site-fields.js`** (`SITE_FIELD_KEYS`) and wire **`App.jsx`** sanitization + deploy mapping (`src/utils/deployers/github-actions.js`) + CI `.env` generation in **`deploy-lp.yml`** if the lander must read them.
- **Secrets:** never commit; use env / Wrangler / Settings UI patterns already in the repo.

## Quick commands

- App dev: `npm run dev` (Astro, port **4321**).
- Tests: `npm test` (Vitest).

If your tool does not read `.cursor/rules`, open and follow **`fusionops-project-core.mdc`** manually.
