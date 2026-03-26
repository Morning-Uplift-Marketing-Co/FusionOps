# External Integrations

**Analysis Date:** 2026-03-26

## APIs & External Services

**FusionOps / LP Factory API (Cloudflare Worker):**
- **Primary backend** — `apps/api-worker/src/worker.js` (deploy name `lp-factory-api` per `apps/api-worker/wrangler.toml`).
- **Client resolution** — `services/api.js` and `utils/api-proxy.js` build URLs from `window.__LP_API__`, then `import.meta.env.VITE_API_BASE`, then dev fallback `/api` (proxied by Vite in `astro.config.mjs`) or default worker URL documented in those files.
- **Prescriptive rule:** Set **`VITE_API_BASE`** to the full API root including `/api` when it must match production (e.g. `https://<worker-host>/api`) so `buildApiUrl` in `services/api.js` does not double-prefix paths.

**Cloudflare REST API (zones, SSL, analytics):**
- **Upstream** — `https://api.cloudflare.com/client/v4` (see `src/services/cloudflare-zone.js`).
- **Browser access** — Do not call Cloudflare directly from the browser for authenticated flows; use the worker proxy base from **`utils/api-proxy.js`** → `getCfApiBase()` → `{workerBase}/api/proxy/cf` (maps to Cloudflare v4 API inside `apps/api-worker/src/worker.js`).
- **Auth** — Requests carry Cloudflare credentials as required by the proxied API (token in headers/body per call sites); account scoping uses `VITE_CF_ACCOUNT_ID` / locked settings in `src/services/account-lock.js` and `services/account-lock.js`.

**Multilogin X:**
- **Remote API** — `https://api.multilogin.com` (documented in `src/services/multilogin.js`).
- **Launcher** — `https://launcher.mlx.yt:45001` for local profile start/stop (same file).
- **Browser access** — Use **`getMlxApiBase()`** from `src/services/multilogin.js` (via `utils/api-proxy.js`) so traffic goes to `{workerBase}/api/proxy/mlx` in production-shaped environments.

**Internet.bs (registrar API):**
- **Legacy / standalone CORS proxy** — `apps/cf-proxy/worker.js` maps `/ibs/` → `https://api.internet.bs/`. Prefer the main API worker’s proxy patterns for new code if unified there.

**Anthropic (Claude API):**
- **Endpoint** — `https://api.anthropic.com/v1/messages` (called from `apps/api-worker/src/worker.js`).
- **Auth** — Header `anthropic-version` (CORS allowlist includes this header in `worker.js`); API key from request body, Worker secret **`ANTHROPIC_API_KEY`**, or D1 `settings` key `anthropicKey` (see worker logic around `callAnthropic` / `SECRET_KEYS`).

**Google Gemini (Generative Language API):**
- **Endpoint** — `https://generativelanguage.googleapis.com/v1beta/models/...` (e.g. `gemini-1.5-flash`, `gemini-2.5-flash` in `apps/api-worker/src/worker.js`).
- **Auth** — API key query parameter; key from body, **`GEMINI_API_KEY`** env, or D1 `settings` row `geminiKey`.

**Voluum (tracking / postbacks):**
- **Relay** — Worker implements postback forwarding with SSRF guards (`isSafeVoluumForwardHost`) and optional allowlist **`VOLUUM_FORWARD_DOMAIN_ALLOWLIST`**; optional default domain **`DEFAULT_VOLUUM_POSTBACK_DOMAIN`** (`apps/api-worker/wrangler.toml` comments and `worker.js`).

**GitHub:**
- **Org repo creation / git push** — `scripts/deploy-org.js` uses `https://api.github.com/orgs/{ORG}/repos` with **`GITHUB_TOKEN`** (Bearer).

**Sentry:**
- **SDK** — `@sentry/react` in `src/services/sentry.js`, `src/AppRoot.jsx` (`Sentry.ErrorBoundary`).
- **Config** — DSN from **`PUBLIC_SENTRY_DSN`** or **`VITE_SENTRY_DSN`**; optional dev enablement via **`PUBLIC_SENTRY_DEV`** / **`VITE_SENTRY_DEV`**.

**Fonts (templates / generated HTML):**
- **Google Fonts** — Referenced in template generators and utilities (e.g. `src/utils/template-router.js`, `packages/lp-template-generator` templates). Not a server-side SDK; outbound links from published LPs.

## Data Storage

**D1 (Cloudflare SQLite):**
- **Main app data** — Binding **`DB`**, database name `fusionops-main-new-v2` in `apps/api-worker/wrangler.toml` (primary persistence for templates, settings, and most API features; migrations under `apps/api-worker/migrations/`).
- **Pixel events** — Binding **`PIXEL_DB`**, database `fusionops-pixel-new-v2` in the same worker for dashboard/event storage.
- **Dedicated pixel worker** — `apps/pixel-worker/wrangler.toml` binds **`DB`** to `fusionops-pixel-new-v2` (receive beacon traffic on provisioned `t.{domain}` routes).
- **Callback worker** — `apps/worker/wrangler.toml` binds **`DB`** to `fusionops-callback-new-v2` (staging env overrides database id in the same file).

**Neon (Postgres, serverless):**
- **Worker** — `@neondatabase/serverless` `neon()` from connection string **`NEON_DATABASE_URL`** (`getNeonSql` in `apps/api-worker/src/worker.js`); used for best-effort mirror tables (`settings`, `sites`, `deploys`) and related upserts.
- **Browser / app client** — `src/services/neon.js` uses the same package over HTTP; connection string must be supplied the way the app expects at runtime (typically via API/settings, not hardcoded).

**R2:**
- **Thumbnails** — Binding **`THUMBS`**, bucket `lp-factory-thumbs` in `apps/api-worker/wrangler.toml`; template thumbnail upload/generate/serve paths are implemented in `apps/api-worker/src/worker.js`.

**Caching:**
- **No dedicated Redis/Memcached** detected in stack config; rely on CDN/Worker edge and D1/Neon.

## Authentication & Identity

**Model:** No single third-party IdP (e.g. Auth0) is wired as the default in stack configs reviewed. The API uses:
- **CSRF** — Client sets `X-CSRF-Token` from session storage for same-origin mutations (`services/api.js`).
- **API keys / tokens** — Per-integration keys stored in D1 `settings` or Worker secrets (see `SECRET_KEYS` set in `apps/api-worker/src/worker.js` for fields like `apiKey`, `geminiKey`, `githubToken`, Multilogin credentials).
- **Origin gating** — `isTrustedOriginRequest` / `buildAllowedHosts` in `apps/api-worker/src/worker.js` restrict some behaviors to allowed hosts and Cloudflare Pages suffixes.

**Prescriptive rule:** When adding a new secret, add it to Worker secrets **and** decide whether it belongs in the `SECRET_KEYS` redaction set in `apps/api-worker/src/worker.js`.

## Monitoring & Observability

**Sentry** — Client-side errors and replay (`src/services/sentry.js`).

**Cloudflare Workers Logs** — `apps/api-worker/wrangler.toml` `[observability.logs] enabled = true`, `invocation_logs = true`.

**Console logging** — Worker uses `console.log` / `console.error` in places (e.g. D1 query helpers).

## CI/CD & Deployment

**Workers:**
- Deploy from **`apps/api-worker`**: `wrangler deploy` (see `apps/api-worker/package.json`).
- Other deployable workers: **`apps/worker`**, **`apps/pixel-worker`**, **`apps/cf-proxy`** each have `wrangler.toml` and npm scripts where `package.json` exists.

**Static site / dashboard:**
- **`npm run build`** at repo root runs `astro build` (`package.json`).
- **`scripts/setup-infrastructure.js`** — Automates D1 creation, migration execution, and wrangler.toml updates (reference for ops, not runtime).

**GitHub Actions (generated workflows):**
- **`src/utils/deployers/github-actions.js`** — Generates workflows that build Astro and target **Cloudflare Pages** deployment patterns (project naming conventions documented in-file).

**Netlify / CI:**
- **`astro.config.mjs`** treats `NETLIFY` or `CI` as hosted build to skip `.env.lock` injection.

## Environment Configuration

**Required / common variables (non-secret names only):**
- **`VITE_API_BASE`** — API base for the SPA (include `/api` suffix when using default path joining in `services/api.js`).
- **`VITE_CF_ACCOUNT_ID`**, **`VITE_CF_API_TOKEN`** (or mapped from `VITE_CF_ACCOUNT_API` / `CF_API_TOKEN` during local Astro startup) — Used for locked Cloudflare automation UX (`src/services/account-lock.js`).
- **`PUBLIC_SENTRY_DSN`** or **`VITE_SENTRY_DSN`** — Enable Sentry when set.
- **`NEON_DATABASE_URL`** — On Worker for Neon path in `apps/api-worker/src/worker.js`.
- **`ANTHROPIC_API_KEY`**, **`GEMINI_API_KEY`** — Worker-side AI calls when not using D1-stored keys.
- **`GITHUB_TOKEN`** — For `scripts/deploy-org.js`.
- **`VOLUUM_FORWARD_DOMAIN_ALLOWLIST`**, **`DEFAULT_VOLUUM_POSTBACK_DOMAIN`**, **`TEMPLATE_POST_MAX_BYTES`** — Optional Worker vars (`apps/api-worker/wrangler.toml`).

**Secrets location:**
- **Cloudflare Dashboard** — Worker secrets and vars for `lp-factory-api` and sibling workers.
- **Local** — `.env`, `.env.lock` (if used); **never commit** real tokens. Prefer platform secret stores in CI (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` referenced in `scripts/deploy-scratchvetloans.mjs` and docs patterns).

## Webhooks & Callbacks

**Incoming:**
- Worker routes handle **pixel events**, **Voluum postback relay**, **template/API** traffic on the deployed worker hostname (full route table in `apps/api-worker/src/worker.js`).
- **Pixel worker** — Intended for **`t.{domain}`** routes per `apps/pixel-worker/wrangler.toml` comments.

**Outgoing:**
- Worker-initiated **fetch** to Anthropic, Google Generative Language API, Voluum (when forwarding), Cloudflare API (automation blocks in `worker.js`), and **Neon** over HTTPS.

---

*Integration audit: 2026-03-26*
