# Tracking Pipeline v1 — Quick Reference

**Status:** Draft (awaiting user review)
**Owner:** FusionOps / LP Factory
**Target:** Finance / loan affiliate LPs deployed via `deploy-lp.yml`

## Problem (one paragraph)

Browser-fired Google Ads conversions (gtag.js + `/pagead/conversion/*`) are lost to ad blockers and browser ITP (Safari). GCLIDs die at 7 days when stored in JS-set first-party cookies. We have six live domains and plan to add more. Rebuilding conversion tracking after every short-lived Google Ads account bans is expensive. GA4 and direct Google Ads API integration are ruled out (per-account setup pain, no developer token). Voluum already pushes `sold_lead` to Google Ads server-side via its native integration — we must not break it or double-count it.

## Solution (one diagram)

```
LP browser   ──gtag──►  t.{domain}/gtag/js  ──►  googletagmanager.com   (relay)
             ──gtag──►  t.{domain}/g/collect ──►  google-analytics.com  (relay)
             ──gtag──►  t.{domain}/pagead/*  ──►  googleadservices.com  (relay)
                            │
                            ├─ form_start   (observation, $0)
                            └─ form_submit  (PRIMARY, $5 flat, +EC4L PII hash)

Affiliate postback ──► t.{domain}/v ──► Voluum (existing, unchanged)
                                        └──► Google Ads "sold_lead" (via Voluum native integration, unchanged)

Worker sets _gcl_aw cookie (HTTP-only, 90d) on every /e and /gtag/js hit to extend GCLID lifespan past Safari ITP.
```

## Scope

| In scope | Out of scope |
|---|---|
| Server-side gtag relay on `t.{domain}` | Google Ads API / OAuth / Developer Token |
| Enhanced Conversions for Leads (EC4L) PII hashing | GA4 Measurement Protocol |
| Split browser conversion actions (`form_start` + `form_submit`) | Customer Match / audience upload |
| First-party `_gcl_aw` cookie via worker | Scheduled CSV offline adjustments |
| P0: fix broken `t.scratchpetfinancing.com/e` pixel | Rebuild of Voluum → Google Ads integration |

## Effort

- **Domain-level code (one-time):** ~3-4 engineer-days
- **Per-new-Google-Ads-account:** ~5 min (create 2 conversion actions + toggle Enhanced Conversions + paste labels into deploy-config)

## Files changed (summary)

| File | Change |
|---|---|
| `apps/api-worker/wrangler.toml` | ✅ DONE — bind `t.scratchpetfinancing.com/*` |
| `apps/api-worker/src/worker.js` | Add relay routes: `/gtag/js`, `/g/collect`, `/j/collect`, `/pagead/conversion/*`, `/ccm/collect`; add `_gcl_aw` cookie handler |
| `scripts/inject-tracking.mjs` | Modify gtag loader → use `t.{domain}/gtag/js`; add `transport_url`; add `form_start`/`form_submit` fire points; add EC4L hasher |
| `deploy-configs/scratchpetfinancing.com.json` | Reconstruct from production (requires user-supplied values) |
| `deploy-configs/*.json` | Optional — add `ec4lEnabled: true`, `formStartValue: 0`, `formSubmitValue: 5` flags |

## Reading order

1. **This README** — you are here
2. **[DESIGN.md](./DESIGN.md)** — architecture, data flow, per-file change spec, rollback, validation
3. **[per-account-runbook.md](./per-account-runbook.md)** — 5-minute checklist for spinning up a new Google Ads account

## Status checklist

- [x] Wrangler route for `t.scratchpetfinancing.com` added
- [ ] Reconstruct `deploy-configs/scratchpetfinancing.com.json` from production
- [ ] Worker gtag relay routes implemented
- [ ] `_gcl_aw` cookie handler implemented
- [ ] `inject-tracking.mjs` gtag loader rewrite
- [ ] EC4L hasher + user_data injection
- [ ] Split conversion action fire points (`form_start`, `form_submit`)
- [ ] Validation Phase A-E complete
- [ ] Rollout to all 6 live domains
