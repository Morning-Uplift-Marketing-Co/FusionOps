# Technology Stack

**Analysis Date:** 2026-03-26

## Languages

**Primary:**
- **JavaScript (ES modules)** — Main app UI and services under `src/`, Astro pages, utilities (`utils/`, `services/`), and the primary API Worker (`apps/api-worker/src/worker.js`).
- **TypeScript** — Used for Astro/Vite tooling, Playwright E2E (`tests/e2e/`), Vitest config (`vitest.config.ts`), and Workers in `apps/worker/` and `apps/pixel-worker/` (`src/index.ts` patterns).

**Secondary:**
- **SQL** — D1 migrations under `apps/api-worker/migrations/` and sibling worker migration folders.

## Runtime

**Environment:**
- **Node.js** `>=22.0.0` (enforced in root `package.json` `engines`).

**Package Manager:**
- **npm** with root `package-lock.json`.
- **Lockfile:** present at repository root; `apps/api-worker/package.json` pins its own `wrangler` devDependency separately from the root.

## Frameworks

**Core (root app — LP Factory / FusionOps web):**
- **Astro** `^6.0.8` — SSG/SSR shell, `astro dev` / `astro build` / `astro preview` / `astro check` (`package.json` scripts).
- **React** `^19.2.0` with **`@astrojs/react`** `^5.0.1` — Islands and `AppRoot` wiring (`astro.config.mjs` `integrations: [react()]`).
- **Vite** — Bundled with Astro; extended in `astro.config.mjs` under `vite` (Tailwind plugin, proxy, aliases, CSP dev headers).

**Secondary Astro app:**
- **`apps/lander/`** — Separate `package.json` using **Astro** `^5.2.0`, `@astrojs/sitemap`, `astro-compress`, Tailwind 4 + `@tailwindcss/vite` (marketing/lander builds, not the main dashboard).

**UI / styling:**
- **Tailwind CSS** `^4.2.0` via **`@tailwindcss/vite`** `^4.2.0` in `astro.config.mjs`.
- **Radix UI** — `@radix-ui/react-slot`, `@radix-ui/react-tabs`.
- **lucide-react**, **class-variance-authority**, **clsx**, **tailwind-merge** — component styling utilities.
- **recharts** `^3.7.0` — charts in the app.

**Workers (Cloudflare):**
- **Wrangler** `^4.35.0` (root devDependency); **`apps/api-worker`** uses **`wrangler` `^4.67.0`** and **`compatibility_flags = ["nodejs_compat"]`** in `apps/api-worker/wrangler.toml`.
- **`@cloudflare/puppeteer`** — Browser Rendering / screenshots in the API worker (`apps/api-worker/package.json`).
- **`cloudflare:sockets`** — Used from `apps/api-worker/src/worker.js` for outbound connections where supported.

**Testing:**
- **Vitest** `^4.0.18` — Config: `vitest.config.ts` (happy-dom default, `@vitejs/plugin-react`, path aliases).
- **@vitest/coverage-v8**, **@vitest/ui** — Coverage and UI runner.
- **@playwright/test** `^1.58.2` — E2E; config `playwright.config.ts`, tests under `tests/e2e/`.
- **happy-dom**, **jsdom** — DOM environments for tests.
- **@testing-library/react**, **@testing-library/jest-dom**, **@testing-library/user-event** — Component tests where used.

**Build / quality:**
- **TypeScript** `^5.7.0` — `tsconfig.json` extends `astro/tsconfigs/strict`; `apps/**` excluded from that project include list.
- **ESLint** `^9.39.1` flat config — `eslint.config.js` (React hooks, react-refresh; ignores `apps/**`, `packages/**`, `templates/**`, `scripts/**`).
- **standard-version** — Release/versioning script (`package.json` `release`).

**Internal package:**
- **`packages/lp-template-generator`** — Node `>=18`, no npm runtime dependencies (`packages/lp-template-generator/package.json`); consumed via Vite alias `#lp-template-generator` → `packages/lp-template-generator/src` in `astro.config.mjs` and `vitest.config.ts`.

## Key Dependencies

**Critical (product behavior):**
- **`@neondatabase/serverless`** — Neon HTTP driver in the browser-oriented service layer (`src/services/neon.js`) and in the API worker (`apps/api-worker/src/worker.js`).
- **cheerio** — HTML parsing/manipulation in tooling and pipelines.
- **jszip** — ZIP handling (templates/pack flows).
- **node-fetch** `^3.3.2` — Used in Node scripts (e.g. `scripts/deploy-org.js`).
- **dotenv** — Available for scripts; Astro also loads optional `.env.lock` key/value pairs in `astro.config.mjs` for local dev (not a substitute for production secrets).

**Infra / ops scripts:**
- **puppeteer** (root devDependency) — Automation outside the Worker (distinct from `@cloudflare/puppeteer` in the worker).
- **@voltagent/cli** — CLI tooling (`package.json` script `volt`).

**Observability (client):**
- **`@sentry/react`** — Initialized in `src/services/sentry.js`, error boundary in `src/AppRoot.jsx`.

## Configuration

**Environment:**
- **Vite-prefixed variables** — Use `VITE_*` for client-exposed config (e.g. `VITE_API_BASE`, `VITE_CF_ACCOUNT_ID`, `VITE_CF_API_TOKEN`, `VITE_APP_VERSION`, Sentry fallbacks documented in `src/services/sentry.js`).
- **Optional `.env.lock`** — If present at repo root, `astro.config.mjs` merges keys into `process.env` for non-`NETLIFY`/`CI` builds; maps `VITE_CF_ACCOUNT_API` / `CF_API_TOKEN` into `VITE_CF_API_TOKEN` when needed. Treat as local-only convenience; do not commit secrets.
- **Worker secrets** — Set via Cloudflare dashboard or `wrangler secret` for `apps/api-worker` (e.g. `NEON_DATABASE_URL`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`); see `INTEGRATIONS.md`.

**Build:**
- **`astro.config.mjs`** — Single source of truth for React integration, dev server port **4323** (`strictPort: true`), Vite proxy `/api` → `VITE_API_BASE` host, path aliases `@` (template subtree) and `#lp-template-generator`.
- **`tsconfig.json`** — Strict Astro base; path `@/*` → `src/*` (note: Vite alias `@` in `astro.config.mjs` points into `src/templates/astrodeck-main/src` for the bundled template tree).

## Platform Requirements

**Development:**
- Node **22+**.
- Run dashboard: `npm run dev` (Astro on port 4323).
- Run API worker locally: `npm run dev` inside `apps/api-worker` (Wrangler).

**Production:**
- **Cloudflare Workers** — Primary API deployment target for `apps/api-worker` (`wrangler deploy`).
- **Cloudflare D1 / R2 / Browser Rendering** — Bound in `apps/api-worker/wrangler.toml` (see `INTEGRATIONS.md`).
- **Hosted static builds** — `astro.config.mjs` detects `NETLIFY` or `CI` to skip `.env.lock` loading; typical hosting is static/Pages-compatible output from `astro build` (configure per deployment pipeline).
- **Neon Postgres** — Serverless Postgres for settings/sites mirror and related tables when `NEON_DATABASE_URL` is set on the worker (`src/services/neon.js` documents schema intent).

---

*Stack analysis: 2026-03-26*
