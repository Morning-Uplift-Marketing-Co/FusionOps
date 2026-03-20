# LP Factory — Template Pipeline & Anti-Fingerprint

## What This Is

An internal Landing Page Factory for PPC campaigns. Creates, manages, and deploys landing pages at scale (~5-6 new domains per week) using Astro SSG + React dashboard + Cloudflare Workers. Templates are sourced from bolt.new/Loveable via MCP import, customized through a Wizard with live preview, and deployed to Cloudflare Pages with tracking pixels, conversion tracking, and deterministic anti-fingerprinting.

## Core Value

Import any template from bolt/loveable, inject brand variables + tracking correctly, preview before deploy, and deploy to Cloudflare — every time, without manual fixing — while making each deployed site unique enough to extend Google Ads detection timeline.

## Requirements

### Validated

- ✓ Dashboard with site management, deploy history, settings — existing
- ✓ Wizard flow for LP creation (Product → Brand → Copy → Design → Tracking → Review) — existing
- ✓ Template system with router, registry, analyzer — existing
- ✓ Multi-database storage (Neon PostgreSQL + Cloudflare D1) — existing
- ✓ Cloudflare Workers backend (API, callbacks, pixel, proxy) — existing
- ✓ Deploy to Cloudflare Pages — existing
- ✓ Voluum tracking integration — existing
- ✓ Google Ads conversion tracking — existing
- ✓ Spend dashboard with per-account/card/domain views — existing
- ✓ OpsCenter with DNS management — existing
- ✓ MCP-based template import from bolt.new/Loveable — existing
- ✓ Env var injection (Astro PUBLIC_* preprocessing) — v1.0
- ✓ Multi-format build pipeline (Astro, Vite/React, static HTML) — v1.0
- ✓ Capability-aware wizard (auto-detection + manifest override) — v1.0
- ✓ Deterministic anti-fingerprinting (6 HTML/CSS vectors) — v1.0
- ✓ Quality validation (viewport, pixels, leaks, Google Ads, Lighthouse 95+) — v1.0
- ✓ Live preview modal with variable injection (PREV-01) — v1.1
- ✓ Mobile/desktop viewport toggle (PREV-02) — v1.1
- ✓ Real-time preview refresh <1s (PREV-03) — v1.1
- ✓ Pre/post-fingerprint HTML comparison (PREV-04) — v1.1
- ✓ Alpha test: 12 domains deployed with fingerprinting (ALPHA-01) — v1.1
- ✓ Alpha test: 28-day Google Ads monitoring (ALPHA-02) — v1.1
- ✓ Alpha test: Gap analysis and findings report (ALPHA-03) — v1.1

### Active (v1.2)

- [ ] JavaScript obfuscation with terser (ANTI-FP-01)
- [ ] Network timing randomization with sendBeacon jitter (ANTI-FP-02)
- [ ] Event listener randomization (ANTI-FP-03)
- [ ] Alpha test 2: extended vectors validation (ANTI-FP-04)
- [ ] Build pipeline stress test at 50+ concurrent (PERF-01)
- [ ] Build queue if memory >90% (PERF-02)

### Out of Scope

- Mobile app — web dashboard is sufficient
- Multi-deployer (Vercel, S3, VPS) — Cloudflare-only for now
- Batch deploy automation — manual per-domain workflow is fine at current scale
- Real-time collaboration — single operator tool
- Next.js template support — requires special Cloudflare adapter, defer to v2
- Domain registrant variation — defer to v2
- Template marketplace — defer to v2

## Context

**v1.1 shipped.** Core pipeline fully operational with live preview UX. Alpha test revealed HTML/CSS fingerprinting alone provides ~13 day average evasion (0% at 28 days). v1.2 will add JS obfuscation + network/event randomization vectors.

**Tech stack:** Astro 5.x + React 19 + Cloudflare Workers, 60K+ LOC JavaScript
**Test coverage:** 91.66% (121+ tests, 100% passing)
**Workflow:** bolt.new/Loveable → MCP import → Wizard config → Live Preview → Deploy to Cloudflare Pages

## Constraints

- **Stack**: Astro 5.x + React 19 + Cloudflare Workers — no framework changes
- **Performance**: Lighthouse 95+ across all metrics — pages must load fast
- **Anti-detection**: Each deployed site must have unique fingerprint (expanding from HTML/CSS to JS/network/event vectors)
- **Backwards compatibility**: Existing templates and deploy configs must keep working
- **Template source**: Templates come from external tools (bolt, loveable) — can't control their structure

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Auto-detect + manifest for template capabilities | Templates from external sources have unpredictable structure; auto-detect handles unknown, manifest allows override | ✓ Good |
| Randomize HTML/CSS rather than multi-layout | Lower effort than maintaining multiple layouts; achieves uniqueness without template redesign | ⚠️ Insufficient alone — need JS/network/event vectors (v1.2) |
| Keep Astro SSG for templates | Static output = fast, cheap hosting, Lighthouse-friendly | ✓ Good |
| Cloudflare-only deploy | Simplifies pipeline, already working | ✓ Good |
| Multi-format → static build | All formats (Astro, Vite, HTML) build to static files for Cloudflare Pages | ✓ Good |
| Separate Anti-FP v2 to v1.2 | Core system ready to ship; anti-FP vectors are additive post-build transforms | ✓ Good — ships faster |
| Deterministic seeding (SHA256 + seedrandom) | Same siteId → byte-identical output on redeploy; prevents re-detection | ✓ Good |

---

## Current State: v1.1 Shipped

**Status:** ✓ Production Ready
**Shipped:** 2026-03-20
**Milestones:** v1.0 (core pipeline) + v1.1 (preview UX + alpha test)
**Test Coverage:** 91.66% (121+ tests, 100% passing)

### What's Working

1. ✓ **Full build pipeline** — Import → Wizard → Build → Fingerprint → Quality Check → Deploy
2. ✓ **Live preview** — Operators preview templates with injected variables before deploy
3. ✓ **Viewport toggle** — Mobile (320px) / Desktop (1024px) preview
4. ✓ **Fingerprint comparison** — Pre/post-fingerprint HTML diff viewer
5. ✓ **6-vector anti-fingerprinting** — CSS classes, IDs, data attrs, aria-labels, meta tags, structural variation
6. ✓ **Quality gates** — Viewport, pixels, leaks, Google Ads, Lighthouse 95+

### Alpha Test Findings (v1.1)

- HTML/CSS randomization alone: **0% evasion at 28 days** (avg 13.17 days to detection)
- All 12 test domains detected; HTML templates fastest, Vite slowest
- Recommendation: Add JS obfuscation + network/event vectors (v1.2)
- Full report: `.planning/milestones/v1.1-alpha-test/`

### Next Milestone: v1.2 (Anti-FP Vector Expansion)

- JavaScript obfuscation with terser (deterministic seeding)
- Network timing randomization (sendBeacon jitter 50-500ms)
- Event listener randomization (selective deferral)
- Alpha test 2: validate extended vectors
- Build pipeline stress test at scale
- Phase 3 plans already prepared in `.planning/phases/03-anti-fp-vector-expansion/`

---
*Last updated: 2026-03-20 after v1.1 milestone completion*
