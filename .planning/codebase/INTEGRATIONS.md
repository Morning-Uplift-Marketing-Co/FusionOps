# External Integrations

**Analysis Date:** 2026-03-22

## APIs & External Services

**FusionOps / LP Factory backend (HTTP API):**
- Cloudflare Worker API — primary REST backend for dashboard operations; base URL from `import.meta.env.VITE_API_BASE`, `window.__LP_API__`, or default in `src/services/api.js` and `astro.config.mjs` (`VITE_API_BASE` / dev proxy `/api`)
  - SDK/Client: `fetch` via `src/services/api.js` (`api.get`, `api.post`, …)
  - Auth: CSRF header `X-CSRF-Token` for same-origin mutations (`src/services/api.js`); Worker auth as implemented server-side in `apps/api-worker/`

**Cloudflare (product APIs):**
- Cloudflare REST API v4 — zone and DNS operations; direct `https://api.cloudflare.com/client/v4` in `src/services/cloudflare-zone.js`; credentials passed as parameters from UI/settings (not hardcoded)
- Cloudflare Pages & Workers — deployment via `wrangler` in `.github/workflows/deploy-dashboard.yml` (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` GitHub secrets)

**Neon (PostgreSQL):**
- Neon serverless Postgres — HTTP driver `@neondatabase/serverless` in `src/services/neon.js`; connection from app configuration (e.g. `VITE_NEON_URL` referenced in `src/services/account-lock.js` for sanitization/display)

**Observability:**
- Sentry — `@sentry/react` in `src/services/sentry.js`; DSN via `PUBLIC_SENTRY_DSN` or `VITE_SENTRY_DSN`; optional dev enablement via `PUBLIC_SENTRY_DEV` / `VITE_SENTRY_DEV`

**Affiliate / tracking:**
- Voluum — session and reporting through Worker routes under `/voluum` and `src/services/voluum.js`; credentials env names include `VITE_VOLUUM_ACCESS_KEY_ID`, `VITE_VOLUUM_ACCESS_KEY` (`src/services/account-lock.js`); CTA link env `PUBLIC_VOLUUMURL` in `src/pages/index.astro`. **LP head / Wizard → deploy → Astro flow:** see [VOLUUM_LP.md](./VOLUUM_LP.md).

**Automation / anti-detect:**
- Multilogin X — `https://api.multilogin.com` and launcher `https://launcher.mlx.yt:45001` in `src/services/multilogin.js`; base override via `src/utils/api-proxy.js` (`getMlxApiBase`)

**Deploy targets (utilities):**
- GitHub REST API — repo creation in `scripts/deploy-org.js` (`GITHUB_TOKEN`); Actions and contents APIs in `src/utils/deployers/github-actions.js`, `src/utils/deployers/github-status.js`
- Vercel API — deployments/domains in `src/utils/deployers/vercel.js`
- AWS S3 / CloudFront — uploads and invalidation patterns in `src/utils/deployers/s3-cloudfront.js` (requests may go through Worker proxy URL)

**Worker-specific (related repo area):**
- `apps/api-worker/` — `@cloudflare/puppeteer` for browser automation; exposes HTTP API deployed with Wrangler (see `apps/api-worker/package.json`)

## Data Storage

**Databases:**
- Neon PostgreSQL — primary app metadata/settings pattern in `src/services/neon.js` (tables created via `ensureTables()`)
- Cloudflare D1 — referenced by Worker package migrations under `apps/api-worker/migrations/` (not used directly by root Astro client code)

**File Storage:**
- Deploy flows may target S3 (`src/utils/deployers/s3-cloudfront.js`); local static assets live under `public/`

**Caching:**
- Browser `sessionStorage` for CSRF token key in `src/services/api.js`; no separate Redis/cache service in front-end code

## Authentication & Identity

**Auth Provider:**
- Custom — dashboard relies on Worker API + client-side settings; Cloudflare API tokens and account IDs supplied by user/env (`VITE_CF_ACCOUNT_ID`, `VITE_CF_API_TOKEN` in `src/services/account-lock.js`)

## Monitoring & Observability

**Error Tracking:**
- Sentry — `src/services/sentry.js`, `src/App.jsx` (context), `src/AppRoot.jsx` (`Sentry.ErrorBoundary`)

**Logs:**
- `console` logging across services (e.g. `src/services/neon.js`, `src/services/api.js` warnings)

## CI/CD & Deployment

**Hosting:**
- Cloudflare Pages for static dashboard (`dist/` after `npm run build`)
- Cloudflare Workers for API (`apps/api-worker`)

**CI Pipeline:**
- GitHub Actions — `.github/workflows/deploy-dashboard.yml` (Node 20, `npm ci`, `npm run build`, `wrangler deploy` / `wrangler pages deploy`); additional workflows under `.github/workflows/` for other automation

## Environment Configuration

**Required env vars (representative names — set in hosting/CI, not documented here with values):**
- `VITE_API_BASE` — API origin for production builds
- `PUBLIC_SENTRY_DSN` / `VITE_SENTRY_DSN` — Sentry client DSN
- `VITE_NEON_URL` — Neon connection string for client-side Neon usage when configured
- `VITE_CF_ACCOUNT_ID`, `VITE_CF_API_TOKEN` — Cloudflare account lock / automation (`src/services/account-lock.js`)
- `VITE_VOLUUM_ACCESS_KEY_ID`, `VITE_VOLUUM_ACCESS_KEY` — Voluum integration
- `PUBLIC_VOLUUMURL` — default CTA href (`src/pages/index.astro`)
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — CI deploy secrets (`.github/workflows/deploy-dashboard.yml`)
- `GITHUB_TOKEN` — org script `scripts/deploy-org.js`

**Secrets location:**
- GitHub Actions secrets for CI; local `.env` / `.env.lock` patterns may exist — never commit or paste values into planning docs

## Webhooks & Callbacks

**Incoming:**
- Worker routes defined in `apps/api-worker` (not enumerated here); dashboard calls outbound APIs only

**Outgoing:**
- `fetch` to Worker API, Cloudflare API, Voluum (via Worker), Multilogin, GitHub, Vercel, S3 endpoints as triggered by UI flows in `src/services/` and `src/utils/deployers/`

---

*Integration audit: 2026-03-22*
