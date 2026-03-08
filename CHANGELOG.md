# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.7.9] - 2026-03-08
### Fixed
- **Pages custom-domain binding during deploy**: `deploy-lp.yml` now passes `--domain` for root and `www` to `wrangler pages deploy`, so Cloudflare Pages associates the custom domains during deployment instead of relying only on the later API attach step.

## [2.7.8] - 2026-03-08
### Fixed
- **Fresh Pages project slug for `joracreditz.com`**: Switched deploy config from `lp-joracreditz-com` to `lp-jora-creditz-main` to avoid reuse of the previously deleted Cloudflare Pages project slug.
- **Pages project preservation**: `github-actions` deployer now preserves an existing `cfPagesProject` from deploy config instead of recomputing and overwriting it on future deploys.

## [2.7.7] - 2026-03-08
### Fixed
- **Cloudflare Pages custom-domain attach resilience**: GitHub deploy workflow no longer aborts the entire job when the Pages domain attach API returns a non-fatal error.
- **Always-run DNS provisioning**: Root and `www` Cloudflare DNS CNAME upsert now runs even if the Pages custom-domain attach step warns or fails.

## [2.7.6] - 2026-03-08
### Fixed
- **Cloudflare credential precedence in CI**: `deploy-lp.yml` now prefers repository secrets over per-config credentials to avoid stale/wrong account-token mismatches during Pages custom-domain attach and DNS upsert.
- **Deploy config hardening**: `github-actions` deployer no longer persists Cloudflare API token/account into `deploy-configs/*.json`.

## [2.7.5] - 2026-03-08
### Fixed
- **Cloudflare Pages custom-domain attach**: Normalize deploy-config `domain` before API calls (strip scheme/path/trailing dot/leading `www`) to prevent `invalid TLD` failures.
- **Deploy env consistency**: `PUBLIC_DOMAIN` in workflow now uses normalized domain value so template env and Cloudflare domain attach are aligned.

## [2.7.4] - 2026-03-08
### Fixed
- **GitHub Actions DNS provisioning (Cloudflare Pages)**: Deploy workflow now fails fast if custom-domain attach API returns an error instead of silently continuing.
- **Explicit DNS upsert**: Added workflow step to upsert Cloudflare DNS `CNAME` records for root + `www` to the deployed `*.pages.dev` host.

## [2.7.3] - 2026-03-08
### Added
- **Manual thumbnail upload (🖼 button)**: Template cards now have a 🖼 button to upload a screenshot image directly from local disk → stored in R2. Faster and more reliable than auto-generate via Puppeteer.
- **`POST /api/templates/:id/upload-thumb`**: Worker endpoint that accepts `multipart/form-data` image upload and stores it in R2, then updates `thumbnail_url` in D1.
- **`api.postForm()`**: Added `postForm` helper to `api.js` for multipart/form-data requests.

## [2.7.2] - 2026-03-08
### Fixed
- **Hover popup position**: Now shows to the right of the hovered card, clamped to viewport edge (was appearing behind sidebar at x=8)
- **Hover popup content**: Removed broken iframe fallback. Now shows thumbnail screenshot if generated via 📸, else a clean "📷 No preview yet — click 📸" placeholder. No more solid-color hero sections.

## [2.7.1] - 2026-03-08
### Added
- **Hover Preview Popup on template cards**: Hovering over a template card in Step 4 (Design) shows a fixed popup to the left with a live iframe preview of the template HTML — or thumbnail image if one has been generated via 📸. Falls back to ⚡ placeholder for CI templates without stored HTML.

## [2.7.0] - 2026-03-08
### Added
- **Template Thumbnail Screenshots**: Cloudflare Browser Rendering API + R2 — headless browser screenshots stored in `lp-factory-thumbs` R2 bucket.
- **`POST /api/templates/:id/generate-thumb`**: Worker endpoint that screenshots template HTML and stores PNG in R2, writes `thumbnail_url` back to D1.
- **`GET /api/templates/:id/thumb`**: Serves stored thumbnail PNG directly from R2 with 24h cache.
- **📸 button on template cards**: Custom templates now show a 📸 button to trigger screenshot generation on demand.
- **Thumbnail display in template cards**: Cards show real screenshot preview instead of ⚡ icon once generated.
- **Same-origin `/api/cfg` proxy** (`functions/api/cfg.js` in `pet-orange-white`): Cloudflare Pages Function proxies aid fetch through same domain — hides Worker URL and shared infrastructure from Google and competitors.

## [2.6.2] - 2026-03-08
### Security
- **Hide affiliate `aid` from HTML source**: `apply.astro` (`pet-orange-white`) now fetches `aid` async from Worker `/api/cfg?d={domain}` instead of embedding it directly in HTML — prevents competitors from reading affiliate ID via DevTools.
- **Worker `/api/cfg` route**: New endpoint in `apps/api-worker/src/worker.js` — looks up `aid` from D1 site config by domain, returns `{a: aid}`. No other sensitive data exposed.
- **`template: "fresh"` → `"t1"`**: Changed LeadsGate template identifier to a less descriptive name.

## [2.6.1] - 2026-03-08
### Changed
- **`convert-astro-template.md` workflow (Step 4c)**: Replaced wrong `vp.js` Voluum loader with correct `dtpCallback` script. Added Rocket Loader warnings, `data-cfasync="false"` checklist, `voluumDomain` default `''`, and `Fragment set:html` head limitation note.
- **Step 4c-ii added**: Form submit CTA redirect must use `define:vars={{ ctaHref }}` and redirect to Voluum URL, not hardcoded `/apply`.
- **Memory updated**: Astro Full Tracking memory now includes dtpCallback pattern, Rocket Loader fix for all components, Fragment set:html limitation, and form CTA redirect pattern.

## [2.6.0] - 2026-03-08
### Added
- **`pet-orange-white` LeadsGate integration**: `apply.astro` rebuilt as standalone HTML page (no Layout) with full `_lg_form_init_` config — `SafeStorage`, `getVoluumClickId()`, and dataLayer callbacks (`onFormLoad`, `onStepChange`, `onSubmit`, `onSuccess`) with `soldLead`/`rejectLead`/`newLead` event handling.
- **LeadsGate dataLayer events**: `leadsgate_form_start`, `leadsgate_form_progress`, `leadsgate_form_submit`, `lead_conversion_all`, `lead_conversion_approved`, `lead_declined`, `lead_pending` — wired to `PUBLIC_AID` env var.

### Fixed
- **`deploy-lp.yml` template resolution**: Replaced bash function with direct `if [ -d "templates/$TEMPLATE_ID" ]` check — eliminates double-echo bug from subshell that caused `pet-orange-white` to build as `pet_loans_v1`.
- **`scratchpaypet.tech` serving old site**: Deleted stale Cloudflare Worker route `scratchpaypet.tech/* → lp-worker-scratchpaypet-tech-92d470` that intercepted all traffic before reaching Cloudflare Pages project.
- **Wizard Step 4 Gen Images button disabled**: `StepDesign.jsx` — removed `!c.brand?.trim()` disabled condition, use fallback `'Brand'` in `handleGenImages` instead.
- **`App.jsx` template update flow**: PUT request on duplicate `templateId` instead of retrying POST with timestamp suffix.
- **Cloudflare Rocket Loader breaking all scripts**: Added `data-cfasync="false"` to every `<script is:inline>` tag in `pet-orange-white` — `Layout.astro`, `BaseLayout.astro`, `index.astro`, `StickyMobileCta.astro`, `LegalModal.astro`, `LoanCalculator.astro`, `apply.astro`.
- **`apply.astro` Astro IIFE wrapping**: Used `Fragment set:html` with template literal to output raw HTML — eliminates `(function(){...})()` wrapper and `data-astro-cid-*` attributes that broke `_lg_form_init_` global scope.

### Changed
- **`pet-orange-white` performance**: Removed render-blocking Google Fonts (system font fallback), async Voluum `vp.js`, reduced blur effects, added `X-Robots-Tag: index, follow`.
- **`pet-orange-white` `_headers`**: Added `Cache-Control: no-cache` for HTML routes to prevent Cloudflare edge cache serving stale deployments.

## [2.5.2] - 2026-03-07
### Fixed
- **`installment-loans-101` tracking parity**: Added `/e` Astro API route, `sendBeacon` fpPixel, `PUBLIC_FORMSTARTLABEL`/`PUBLIC_FORMSUBMITLABEL` env vars, `window.__gtagConversionId`/`__formStartLabel`/`__formSubmitLabel` globals — matching `astro-test002` v2.5.1 fixes.
- **`installment-loans-101` Voluum Click URL in CTA**: `index.astro` Final CTA button now uses `ctaHref = voluumClickUrl || '#apply'` from `PUBLIC_VOLUUM_CLICK_URL`.

## [2.5.1] - 2026-03-07
### Added
- **First-Party Pixel `/e` endpoint**: New Astro API route `templates/astro-test002/src/pages/e.ts` — accepts `POST`/`GET`, returns `204`. Used by `sendBeacon` for zero-GTM first-party event tracking.
- **`sendBeacon` fpPixel function**: Injected in `Layout.astro` body — fires `pv` on load, exposes `window.__fpPixel(eventName, extra)` for downstream events (form_start, etc.).
- **`formStartLabel` / `formSubmitLabel` env vars**: `Layout.astro` now reads `PUBLIC_FORMSTARTLABEL` / `PUBLIC_FORMSUBMITLABEL` and exposes them as `window.__formStartLabel` / `window.__formSubmitLabel` for gtag conversion label firing.
- **`deploy-lp.yml`**: Added `PUBLIC_FORMSTARTLABEL` and `PUBLIC_FORMSUBMITLABEL` to build-time `.env` injection (reads from `c.gtagFormStartLabel` / `c.gtagFormSubmitLabel`).

### Fixed
- **form_start Label Present** (Tracking Test ❌): `HeroFormStatic.astro` form submit now fires `gtag('event','conversion', { send_to: conversionId/formStartLabel })` when both values are set.
- **First-Party Pixel Endpoint: Not Found** (Tracking Test ❌): `/e` route now exists and returns `204`, resolving `sendBeacon` failures.

## [2.5.0] - 2026-03-07
### Added
- **6 New Templates**: `bear-loan-modern`, `installment-golden`, `pet-care-golden`, `leadgen-golden`, `flowbite-loan`, `hyperui-loan` — registered in `packages/lp-template-generator/src/templates/index.js`.
- **`bear-loan-astro` Template**: Full Astro template with APRComparison, EligibleExpenses, FAQ, Features, StatsBar, Testimonials components.
- **`templates/project` Scaffold**: Blank Astro project scaffold for new template creation.
- **`robots.txt` via Astro API Route**: Dynamic `robots.txt.ts` in `astro-test002` and `installment-loans-101` — injects `PUBLIC_DOMAIN` for correct Sitemap URL. Disallows `/apply/`.
- **Security Headers (`_headers`)**: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` added to both Astro templates via Cloudflare Pages `_headers` file.
- **`phone-gen.js` Utility**: Phone number generation/formatting util in `src/utils/`.
- **Deploy & Debug Scripts**: `scripts/deploy-scratchvetloans.mjs`, `scripts/debug-css-vars.mjs`, `scripts/fix-installment-001.mjs`, `scripts/push-to-github.mjs`, `scripts/push-workflow.ps1`.
- **`setCustomTemplatesCache` Export**: `utils/template-registry.js` now exports `setCustomTemplatesCache` for external deploy scripts.
- **Paid Rollout Docs**: `docs/paid-component-normalization-spec.md`, `docs/paid-fast-track-rollout-playbook.md`, `docs/template-worker-deploy-checklist.md`.

### Fixed
- **Voluum field name mismatch**: `github-actions.js` now correctly reads `site.voluumCampaignId` (Wizard field) → `voluumId` (deploy config), `site.voluumTrackingDomain` → `voluumDomain`, `site.gtagId` → `conversionId`. Previously all three resolved to empty string.
- **`SITE_FIELDS` whitelist**: Added `voluumCampaignId`, `voluumCampaignName`, `voluumTrackingDomain`, `voluumClickUrl`, `voluumLanderScript`, `voluumCfCname`, `voluumAcmName`, `voluumAcmValue`, `trackingMode`, `gtagId`, `phone`, `address`, `reviews`, `trustBadges`, `deployTarget`, `deployOnBuild` — previously these were stripped by `sanitizeSite()` and lost on save.
- **Edit Mode Config Restore**: `startCreate()` in `App.jsx` now fetches `deploy-configs/{domain}.json` from GitHub and restores `voluumCampaignId`, `trackingMode`, `gtagId`, `voluumCfCname`, `voluumAcmName`, `voluumAcmValue`, `voluumLanderScript` on edit — fixing "must re-enter Voluum every time" bug.
- **`voluumCfCname`/`voluumAcmName`/`voluumAcmValue` Persistence**: `github-actions.js` now preserves Tracking Domain DNS fields across redeploys.
- **LeadsGate SDK URL**: Fixed `packages/lp-template-generator/src/shared/tracking.js` — changed from `forms.leadsgate.com/form/embed/{aid}` to `https://apikeep.com/form/applicationInit.js` with correct `_lg_form_` container and dynamic script injection.
- **Compliance Contact Modal**: Phone number now renders as `<span>` (not `<a href="tel:">`) to avoid accidental clicks in embed contexts.
- **Template Preview CSS vars**: `utils/template-router.js` now pre-resolves `${primaryColor}` / `${accentColor}` inside `<style>` blocks before Tailwind CDN injection, preventing broken styles.
- **Tailwind CDN Auto-detection**: Preview no longer injects Tailwind CDN when template has substantial inline CSS (`>200 chars`), preventing style conflicts.

### Changed
- **`.gitignore`**: Added `.preview-astrodeck/`, `tmp_check.html`, `*.tar.gz`, `templates/astro-test002/package-lock.json`, `templates/installment-loans-101/package-lock.json`.
- **`utils/template-router.js`**: Added `phone`, `amountMin`, `amountMax`, `aprMin`, `aprMax`, `loanLabel`, `leadsGateFormId`, `primaryColor`, `accentColor` to preview variable resolution.
- **`installment-bear/src/pages/apply.astro`**: Updated to use `_lg_form_` container and `apikeep.com` SDK.

## [2.4.0] - 2026-03-07
### Added
- **Gen Reviews Button**: Wizard Step 5 (Copy) → ✨ Gen Reviews — calls `/api/ai/generate-reviews` to generate 3 unique, category-aware testimonials via Gemini. Reviews saved in config and injected as `PUBLIC_REVIEWS` at CI build time.
- **Voluum CTA Click URL**: StepTracking Voluum section now has "CTA Click URL" input with "Use Default" button (auto-fill `https://vls.{domain}/click`). When set, all CTA buttons in `astro-test002` use this URL instead of `#apply`. Injected as `PUBLIC_VOLUUM_CLICK_URL`.
- **`/api/ai/generate-reviews` Worker Route**: New AI generation endpoint — prompt includes `loanType` for category-specific reviews (pet care, installment, PDL, etc.).
- **`apply.astro` in skill**: `/convert-astro-template` workflow Step 8 — standalone LeadsGate form page (no Layout/header/footer), `PUBLIC_AID` injected via `define:vars`.

### Fixed
- **409 SHA Race Condition**: `github-actions.js` now parses correct SHA from 409 error body immediately (no clone, no delay), then pushes at once. Fallback re-fetches from API. Retries up to 5x.
- **Worker Redeploy**: `wrangler deploy` required after each worker.js change for new routes to go live.

### Changed
- **`deploy-lp.yml`**: Added `PUBLIC_REVIEWS` and `PUBLIC_VOLUUM_CLICK_URL` to injected env vars.
- **`github-actions.js`**: Added `voluumClickUrl` and `reviews` fields to deploy config JSON.
- **`convert-astro-template.md` skill**: Updated Steps 7–8 (reviews injection, apply.astro LeadsGate pattern, Voluum CTA note).

## [2.3.0] - 2026-02-28
### Added
- **Cloudflare Multi-Profile System**: Manage multiple CF accounts in Settings with full CRUD, API validation (32-char hex + Pages API + zone count), and auto-migration of legacy single account to "Default" profile.
- **OpsCenter Zone Explorer**: CF Accounts tab with expandable cards — click profile to load zones, click zone to view DNS records in color-coded table (A/CNAME/MX/TXT/NS).
- **Workers Route Auto-Creation**: CF Workers deploy now auto-creates Workers Routes (`{domain}/*` and `t.{domain}/*`) mapped to the deployed script, fixing the broken A-record-only approach.
- **Voluum Tracking Domain DNS Provisioning**: StepTracking wizard section to paste Voluum CloudFront CNAME + ACM certificate CNAME and auto-provision both records in Cloudflare with one click.
- **Full DNS Auto-Provisioning**: Deploy flow creates 3 records for cf-workers: root A (proxied), pixel A `t.` (proxied), and tracking CNAME `trk.` → `track.voluum.com` or CloudFront.
- **App.jsx Profile Sync**: Settings `cfProfiles` automatically sync to `ops.cfAccounts` for unified usage across OpsCenter tabs.
- **Wizard Brand Step**: CF Profile dropdown for selecting which Cloudflare account to use per site.

### Fixed
- **Workers Deploy**: Root domain was unreachable (`ERR_NAME_NOT_RESOLVED`) because A record `192.0.2.1` had no corresponding Workers Route — now auto-created.
- **Pixel Subdomain**: `t.{domain}` called non-existent `/automation/cf/pixel-provision` endpoint — replaced with inline DNS + Route creation.
- **Tracking CNAME**: `trk.{domain}` now supports CloudFront CNAME (Voluum new setup) instead of hardcoded `track.voluum.com`.

### Changed
- **ensurePixelSubdomain**: Deprecated — DNS records and Workers Routes now handled by deploy flow and `updateDnsAfterDeploy`.
- **Wizard handleBuild**: Uses `voluumCfCname` if provided, skips DNS provisioning if already done via StepTracking button.

## [2.2.0] - 2026-02-25
### Added
- **Proxy Pre-flight System**: NodeMaven residential proxy integration with 5-point IP quality validation (blacklist, geo, DNS leak, latency, IP type) and auto-rotate on failure.
- **Proxy Health Dashboard**: Real-time monitoring tab in OpsCenter showing IP status, Trust Score, geo, ISP for all Multilogin profiles with auto-refresh every 5 min.
- **PreflightModal**: Animated modal with SVG trust score gauge, live check progress, attempt tracking, and retry/cancel controls.
- **NodeMaven Settings**: New Settings card for proxy credentials (username, password), IPQS API key, pre-flight toggle, and minimum trust score threshold.
- **Worker Proxy Endpoints**: 5 new Cloudflare Worker routes — `/api/proxy/resolve-ip`, `/api/proxy/dns-check`, `/api/proxy/latency-check`, `/api/proxy/ipqs-check`, `/api/proxy/check-health`.
- **Cloudflare Pages Deploy**: Frontend deployed to CF Pages at `fusionops.pages.dev`.
- **Sentry Integration**: Error monitoring with `@sentry/react` for production error tracking.

### Changed
- **OpsCenter**: Added 🛡️ Proxy Health tab between D1 Database and Risks.
- **Settings**: NodeMaven Proxy card added with Test Connection and Save buttons.

## [2.1.2] - 2026-02-23
### Added
- **Template System**: Implemented a safe "Delete Template" feature utilizing soft-deletes and architecture dependency checks. 
- **Wizard QA**: Documented comprehensive QA testing matrix for Template generation.

### Fixed
- **Theme**: Fixed hydration mismatch (FOUC) and scoped UI conflicts causing components to incorrectly persist dark mode while the System was in light mode.
- **Neon Configuration**: Corrected issues with database persistence strings overriding active DB context.

## [2.1.1] - 2026-02-23
### Fixed
- **Voluum Settings**: Fixed variable naming typos preventing correctly established API keys from evaluating to active in the System Top Bar.
- **Settings Layout**: Refactored dashboard grid system for multi-column configuration blocks to reduce scrolling.
