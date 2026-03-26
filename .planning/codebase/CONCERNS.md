# Codebase Concerns

**Analysis Date:** 2026-03-26

## Tech Debt

**Monolithic API Worker:**
- Issue: Almost all HTTP behavior for FusionOps (pixels, postbacks, templates, automation, AI, proxies) lives in one module.
- Files: `apps/api-worker/src/worker.js` (~5520 lines)
- Impact: Hard to review, test, or change safely; merge conflicts and regressions are likely; behavior ordering (early vs late routes) becomes security-critical.
- Fix approach: Split by domain (`handlers/pixel.js`, `handlers/templates.js`, `handlers/automation.js`, …) and compose in `fetch`; add integration tests per slice.

**Parallel `utils/` vs `src/utils/` (and `services/` vs `src/services/`):**
- Issue: Same responsibilities maintained in two trees; imports differ by script (`deploy-scratchvetloans.mjs` → `utils/template-router.js`, `test-ui-deploy.mjs` → `src/utils/template-router.js`).
- Files: `utils/template-router.js`, `src/utils/template-router.js`; `utils/lp-generator.js`, `src/utils/lp-generator.js`; `utils/risk-engine.js`, `src/utils/risk-engine.js`; `utils/template-registry.js`, `src/utils/template-registry.js`; `utils/template-preview-runtime.js`, `src/utils/template-preview-runtime.js`; `services/voluum.js`, `src/services/voluum.js`
- Impact: Fixes applied in one copy do not apply to the other; behavior drifts; tests may cover the wrong path.
- Fix approach: Pick a single canonical tree (`src/` recommended), re-export or delete duplicates, grep-driven migration of imports, CI check forbidding new `utils/*.js` duplicates.

**Giant template / LP pipeline modules:**
- Issue: Template routing and LP generation are very large single files with heavy string/HTML manipulation.
- Files: `src/utils/template-router.js` (~5900+ lines), `src/utils/lp-generator.js` (~5700+ lines)
- Impact: High cognitive load; brittle regex/HTML edge cases; slow onboarding.
- Fix approach: Extract phases (parse → transform → emit) with narrow unit tests; document invariants in one place.

**Suspect root dependency `"install"`:**
- Issue: `package.json` lists `"install": "^0.13.0"` under `dependencies` — typically a mistaken npm artifact, not the npm CLI.
- Files: `package.json`
- Impact: Bloat, possible supply-chain or confusion; may shadow tooling expectations.
- Fix approach: Confirm intent; remove if unused (`npm ls install`), rely on `npm install` / `npm ci` only.

## Known Bugs

**DB-sourced templates vs tracking completeness:**
- Symptoms: Deployed landers can show partial tracking in dashboard (e.g. URL params / pixel checks) when files come from D1 workflows.
- Files: `.planning/debug/tracking-injection-db-templates.md`, `scripts/generate-template-from-db.mjs` (referenced in that doc), inject/validate scripts in repo
- Trigger: Deploy template whose authoritative copy is DB rows rather than a full checked-in scaffold.
- Workaround: Ensure required Astro/layout and inject steps run on extracted tree; re-run tracking validation before deploy.

**Template pages with TODO forwarding:**
- Symptoms: Endpoints stubbed without worker/DB integration.
- Files: `templates/bol-inloan-01/src/pages/e.ts`, `templates/goldrush-v2/src/pages/v.ts`
- Trigger: Hit those routes expecting server-side persistence.
- Workaround: Not applicable until implemented.

## Security Considerations

**Unauthenticated template thumbnail routes (ordering bug):**
- Risk: `GET/POST` thumbnail handlers run before the global `API_SECRET` / trusted-origin gate later in the same `fetch` handler. Any client can upload or trigger expensive Browser Rendering (`puppeteer.launch`) if they know or guess a template id.
- Files: `apps/api-worker/src/worker.js` (thumbnail block ~1707–1798; auth gate ~2557–2577)
- Current mitigation: None before auth.
- Recommendations: Move thumbnail routes below auth, or add explicit Bearer/`API_SECRET` check on those paths; rate-limit `generate-thumb`; cap body/HTML size for `previewHtml`.

**Debug endpoint exposes MCP secret:**
- Risk: `GET /api/debug/mcp-secret` returns `MCP_SHARED_SECRET` in JSON to any caller (comment says temporary).
- Files: `apps/api-worker/src/worker.js` (~2551–2555)
- Current mitigation: None if deployed.
- Recommendations: Remove route entirely or guard with `API_SECRET` + never ship in production.

**AI and settings routes bypass origin check when `API_SECRET` unset:**
- Risk: If `API_SECRET` is not configured, `/api/ai/*` and `GET/POST /api/settings` are explicitly allowed without `isTrustedOriginRequest`, so cross-site/browser or direct abuse can burn quotas or exfiltrate/change settings depending on handler behavior.
- Files: `apps/api-worker/src/worker.js` (~2570–2576)
- Current mitigation: Relies on always setting `API_SECRET` in production (operational, not enforced in code).
- Recommendations: Always require Bearer in production; remove `isAiRoute` / `isSettingsRoute` exceptions or tie them to a separate secret.

**Arbitrary SQL on bound D1 (`direct-query`):**
- Risk: `POST /api/automation/d1/direct-query` executes `env.DB.prepare(sql)` with caller-supplied `sql` (after passing outer auth). Full read/write potential on the worker’s D1.
- Files: `apps/api-worker/src/worker.js` (~5286–5313)
- Current mitigation: Same global auth as other `/api` routes.
- Recommendations: Restrict to read-only statements, allowlist statement types, or remove in favor of named endpoints; audit callers.

**Wide-open CORS on API JSON helpers:**
- Risk: Default `corsHeaders` uses `Access-Control-Allow-Origin: *` for many responses, increasing cross-origin data reads where responses are not credential-gated.
- Files: `apps/api-worker/src/worker.js` (~9–14, merged into `json()`)
- Current mitigation: Some routes rely on missing `Origin` for non-browser clients.
- Recommendations: Reflect specific allowed origins for sensitive routes; keep `*` only for truly public endpoints.

**Client-supplied HTML in Puppeteer `setContent`:**
- Risk: `previewHtml` from JSON is passed to `page.setContent` — primarily abuse (CPU, Browser Rendering minutes, large HTML) rather than classic SSRF; still a trust boundary.
- Files: `apps/api-worker/src/worker.js` (~1756–1783)
- Recommendations: Max length, strip scripts if policy allows, or only server-build HTML from `files`.

**Voluum postback forward allowlist optional:**
- Risk: Without `VOLUUM_FORWARD_DOMAIN_ALLOWLIST`, `isSafeVoluumForwardHost` still allows many host shapes; misconfiguration could forward to unintended HTTPS targets.
- Files: `apps/api-worker/src/worker.js` (`isSafeVoluumForwardHost`, ~71–91)
- Recommendations: Require explicit allowlist in production.

**Multilogin sign-in uses MD5 of password:**
- Risk: Weak hashing if password ever exposed; depends on Multilogin API contract.
- Files: `apps/api-worker/src/worker.js` (~5032–5036)
- Recommendations: Confirm against vendor docs; avoid storing reversible secrets in D1 settings in plain JSON where possible.

## Performance Bottlenecks

**Thumbnail generation:**
- Problem: `networkidle0` + 15s timeout per screenshot; serial Puppeteer usage.
- Files: `apps/api-worker/src/worker.js` (~1780–1784), `src/services/api.js` (extended timeout for `generate-thumb`)
- Cause: Full browser lifecycle per request.
- Improvement path: Queue + worker concurrency limits; cheaper preview path without `networkidle0` when assets are static.

**Large template-router / lp-generator in Node and CI:**
- Problem: Heavy CPU/string work on every deploy or preview.
- Files: `src/utils/template-router.js`, `src/utils/lp-generator.js`
- Cause: Monolithic synchronous pipelines.
- Improvement path: Cache per template version; incremental builds.

## Fragile Areas

**Preview / thumbnail URL resolution:**
- Why fragile: Hardcoded fallback Worker hostname if env/window not set; must match deployed API for `/_astro` and dist assets.
- Files: `src/utils/template-thumbnail-preview.js` (`workerOriginForTemplateAssets`, fallback `https://lp-factory-api.misty-feather-556e.workers.dev`)
- Safe modification: Drive base URL only from `import.meta.env` / build-time injection; add env validation in CI.
- Test coverage: Partial (`usePreviewDebounce` tests); worker thumbnail auth gap reduces E2E value.

**Regex-heavy template transforms:**
- Why fragile: Comments in `src/utils/template-preview-runtime.js` reference replacing brittle patterns in `template-router.js`.
- Files: `src/utils/template-router.js`, `src/utils/template-preview-runtime.js`
- Safe modification: Add golden-file tests per template family before refactors.
- Test coverage: `src/utils/__tests__/template-router.integration.test.js` (ensure it imports canonical path only).

**MCP template import when secret unset:**
- Why fragile: `MCP_SHARED_SECRET` optional — if empty, `/api/mcp/templates` may accept unauthenticated writes.
- Files: `apps/api-worker/src/worker.js` (~2764–2771)
- Safe modification: Fail closed if `MCP_SHARED_SECRET` missing in production.

## Scaling Limits

**Browser Rendering / Puppeteer:**
- Current capacity: Bounded by Cloudflare plan and concurrent `launch` calls.
- Limit: Thundering herd on `generate-thumb` or abuse of unauthenticated route.
- Scaling path: Auth + queue; pre-render off critical path.

**D1 / R2 thumbnail storage:**
- Current capacity: R2 object per template id key `thumbs/{id}.png`.
- Limit: Unauthenticated `upload-thumb` could fill bucket.
- Scaling path: Auth, per-account quotas, lifecycle rules.

## Dependencies at Risk

**`@cloudflare/puppeteer` coupling:**
- Risk: Tied to Workers Browser Rendering; API or pricing changes affect thumbnails.
- Impact: Thumbnail generation fails or costs spike.
- Migration plan: Fallback to client-generated thumbs or static placeholders.

## Missing Critical Features

**Consolidated auth for all `/api/templates/*` sub-routes:**
- Problem: Thumbnail routes bypass the same gate as the rest of the API.
- Blocks: Safe public sharing of worker URL without abuse.

## Test Coverage Gaps

**API worker route matrix:**
- What's not tested: Ordering-sensitive auth (thumb before gate), `direct-query`, debug MCP route, AI bypass branches.
- Files: `apps/api-worker/src/worker.js`, `tests/unit/workers/pixel-security.spec.ts` (pixel-focused, not template thumb)
- Risk: Security regressions on deploy.
- Priority: High

**Duplicate util trees:**
- What's not tested: Equivalence of `utils/*` vs `src/utils/*` for deploy scripts.
- Files: both trees
- Risk: Script uses stale copy.
- Priority: Medium

---

*Concerns audit: 2026-03-26*
