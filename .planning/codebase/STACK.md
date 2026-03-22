# Technology Stack

**Analysis Date:** 2026-03-22

## Languages

**Primary:**
- JavaScript (ES modules) — `src/**/*.js`, `src/**/*.jsx`, scripts under `scripts/`
- TypeScript — `src/**/*.ts`, `src/**/*.tsx`, `tests/**/*.ts`, config files (`vitest.config.ts`, `playwright.config.ts`)
- Astro — `src/pages/**/*.astro`, `src/layouts/**/*.astro`

**Secondary:**
- SQL — migrations and D1 usage in `apps/api-worker/migrations/` (Worker backend, not the root Astro app)

## Runtime

**Environment:**
- Node.js — build, dev server, tests, and CI (GitHub Actions uses Node 20 in `.github/workflows/deploy-dashboard.yml`; no `.nvmrc` in repo root)

**Package Manager:**
- npm — lockfile `package-lock.json` at repository root

## Frameworks

**Core:**
- Astro `^5.18.0` — SSG/SSR app shell, routing via `src/pages/`, Vite-powered dev server (`astro.config.mjs` sets dev port `4323`)
- React `^19.2.0` with `@astrojs/react` — dashboard UI hydrated with `client:only="react"` (see `src/pages/index.astro`)

**Testing:**
- Vitest `^4.0.18` — unit/component tests; config `vitest.config.ts` (happy-dom, `@/` alias)
- Playwright `@playwright/test` — E2E; config `playwright.config.ts` (`tests/e2e/`, webServer runs `npm run dev`)

**Build/Dev:**
- Vite (via Astro) — aliases and Tailwind in `astro.config.mjs`
- Tailwind CSS `^4.2.0` with `@tailwindcss/vite` — Vite plugin in `astro.config.mjs`
- ESLint `^9` flat config — `eslint.config.js`
- Wrangler `^4.35.0` (devDependency) — Cloudflare Pages/Workers deploy from CI and local CLI

## Key Dependencies

**Critical:**
- `@neondatabase/serverless` — browser-capable Postgres client; data layer in `src/services/neon.js`
- `@sentry/react` — error monitoring; init in `src/services/sentry.js`, boundary in `src/AppRoot.jsx`
- `astro` / `@astrojs/react` — application framework integration
- `cheerio` — HTML parsing/transform in build/quality tooling
- `recharts` — charts in dashboard components
- `@radix-ui/react-slot`, `@radix-ui/react-tabs` — UI primitives (`src/components/ui/`)

**Infrastructure:**
- `node-fetch` — used by Node scripts (e.g. `scripts/deploy-org.js`)
- `dotenv` — dependency for tooling that loads env (do not commit secrets; see Configuration)
- `wrangler` — deploy dashboard static output (`dist/`) to Cloudflare Pages per `.github/workflows/deploy-dashboard.yml`
- `terser`, `jszip`, `seedrandom` — build/packaging and deterministic behavior in tooling

**Backend (separate package):**
- `apps/api-worker/` — Cloudflare Worker API (`lp-factory-api`), Wrangler scripts in `apps/api-worker/package.json`; uses `@cloudflare/puppeteer`, `@neondatabase/serverless`, D1 migrations — not bundled with root `astro build`

## Configuration

**Environment:**
- Client/build: Vite-style `import.meta.env` — `VITE_*`, `PUBLIC_*` (see `src/services/sentry.js`, `src/pages/index.astro`)
- Local dev: optional `.env.lock` merge into `process.env` when not `NETLIFY` or `CI` — logic in `astro.config.mjs` (file may exist; do not commit secrets)
- `.env` / `.env.*` — may exist in subprojects; never read contents in docs; use names only in `INTEGRATIONS.md`

**Build:**
- `astro.config.mjs` — React integration, Tailwind Vite plugin, dev proxy `/api` → `VITE_API_BASE` or default Worker URL, path aliases `@` and `#lp-template-generator`
- `tsconfig.json` — extends `astro/tsconfigs/strict`, `paths`: `@/*` → `src/*` (excludes `apps/`, `packages/`, `templates/` from main project compile)
- `public/_headers` — static headers for deployed static hosting (cache, security, `X-Robots-Tag`)

## Platform Requirements

**Development:**
- Node.js compatible with Astro 5 and React 19 (align with CI: Node 20)
- npm for `npm ci` / `npm install`
- Browsers for Playwright E2E (Chromium path override via `CHROME_DEV_PATH` in `playwright.config.ts` on Windows)

**Production:**
- Static site output: `astro build` → `dist/` deployed to Cloudflare Pages (`wrangler pages deploy`) per `.github/workflows/deploy-dashboard.yml`
- API: Cloudflare Workers (`apps/api-worker`, `npx wrangler deploy`) — default base URL referenced in `astro.config.mjs` and `src/services/api.js`

---

*Stack analysis: 2026-03-22*
