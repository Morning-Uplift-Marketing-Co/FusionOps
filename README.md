# FusionOps (LP Factory)

Internal control plane for building and deploying PPC / affiliate landing pages: **Astro 6 + React 19** dashboard, **Cloudflare Workers** API, template library, Wizard, deploy hooks, and tracking integrations.

## Prerequisites

- **Node.js ≥ 22** (see `.nvmrc` — use `nvm use`, `fnm use`, or install from [nodejs.org](https://nodejs.org))
- **npm** (bundled with Node)

## Install (new machine)

```bash
npm run bootstrap
```

Runs **`npm install`** then **`npm run setup:check`** (Node version, `.env` hint, optional `apps/api-worker` deps).

You can also run `npm install` alone, then `npm run setup:check` anytime.

### Optional: API Worker dependencies

If you develop **`apps/api-worker`** locally (Wrangler):

```bash
npm run install:api-worker
```

### Environment

1. Copy the template and edit values (do **not** commit secrets):

   ```bash
   # Windows PowerShell
   Copy-Item .env.example .env
   ```

   ```bash
   # macOS / Linux
   cp .env.example .env
   ```

2. At minimum for a working UI against shared infrastructure, set:

   - `VITE_API_BASE` — Worker URL ending in `/api` (default in `astro.config.mjs` points at the team Worker if unset).
   - `VITE_NEON_URL` — optional; Neon Postgres branch for dashboard data (same pattern as production if you need parity).

   All `VITE_*` values are **exposed to the browser** — never put private keys there.

Optional: `.env.lock` at the repo root is read by `astro.config.mjs` in non-CI builds to seed env (local-only convenience; keep out of git).

## Run the app

```bash
npm run dev
```

Open **http://localhost:4321** (port is fixed via `strictPort` so it matches Playwright E2E).

The dev server proxies `/api/*` to `VITE_API_BASE` (see `astro.config.mjs`). For full local API development, run the Worker separately (optional).

### Optional: local API Worker

```bash
cd apps/api-worker
npx wrangler dev
```

Or after `npm run install:api-worker`, use the app’s `package.json` scripts inside `apps/api-worker` (`npm run dev` there). Point `VITE_API_BASE` at your local wrangler URL (with `/api`) when testing against it.

## Common commands

| Command | Purpose |
|--------|---------|
| `npm run dev` | Astro dev server (port **4321**) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm test` | Vitest |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright (expects app on **4321**) |
| `npm run deploy:org` | Org deploy helper (Wrangler / Cloudflare) |

## Where to read next

- **Databases, D1, Neon, บัญชีใน `.env`:** [docs/DATABASES.md](docs/DATABASES.md)
- **First-time issues:** [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md)
- **Team sync / PR & secrets:** [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- **Architecture & data flow:** `.planning/codebase/ARCHITECTURE.md`, `AGENTS.md`
- **AI / editor rules:** `.cursor/rules/fusionops-project-core.mdc`
- **API Worker:** `apps/api-worker/` (Wrangler + D1)

## License

Private / internal — see repository settings.
