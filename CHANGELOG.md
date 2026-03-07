# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
