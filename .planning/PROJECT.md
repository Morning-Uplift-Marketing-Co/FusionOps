# LP Factory — Template Pipeline & Anti-Fingerprint

## What This Is

An internal Landing Page Factory for PPC campaigns. Creates, manages, and deploys landing pages at scale (~5-6 new domains per week) using Astro SSG + React dashboard + Cloudflare Workers. Templates are sourced from bolt.new/Loveable via MCP import, customized through a Wizard, and deployed to Cloudflare Pages with tracking pixels and conversion tracking.

## Core Value

Import any template from bolt/loveable, inject brand variables + tracking correctly, and deploy to Cloudflare — every time, without manual fixing — while making each deployed site unique enough that Google Ads cannot detect they share a common origin.

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

### Active (v1.1 — Deferred)

- [ ] Template preview before deploy — deferred to v1.1 (Phase 4 UX polish)

### Out of Scope

- Mobile app — web dashboard is sufficient
- Multi-deployer (Vercel, S3, VPS) — Cloudflare-only for now
- Batch deploy automation — manual per-domain workflow is fine at current scale
- Real-time collaboration — single operator tool
- Next.js template support — requires special Cloudflare adapter, defer to v2

## Context

**Current pain points:**
1. Templates imported from bolt.new/loveable don't get `PUBLIC_*` variables injected — they use Astro `import.meta.env.PUBLIC_*` expressions that show fallback values instead of wizard-configured values
2. Quality checks flag "Astro expression leak" — raw `import.meta.env` expressions appearing in build output
3. Missing viewport meta, pixel markers, and Google Ads tracking markers in imported templates
4. Template router is ~900 lines with hardcoded mappings — fragile when adding new templates
5. Sites have short lifespan — need to create new ones weekly, so pipeline speed matters

**Existing template system:**
- `src/adapters/` has TypeScript adapter interfaces but imported templates don't implement them
- `src/utils/template-analyzer.js` and `template-preview-runtime.js` exist (new, untracked)
- Wizard steps are hardcoded — don't adapt to what a template actually supports

**Workflow:** bolt.new/Loveable → MCP import → Wizard config → deploy to Cloudflare Pages

## Constraints

- **Stack**: Astro 5.x + React 19 + Cloudflare Workers — no framework changes
- **Performance**: Lighthouse 95+ across all metrics — pages must load fast
- **Anti-detection**: Each deployed site must have unique HTML/CSS fingerprint
- **Backwards compatibility**: Existing templates and deploy configs must keep working
- **Template source**: Templates come from external tools (bolt, loveable) — can't control their structure

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Auto-detect + manifest for template capabilities | Templates from external sources have unpredictable structure; auto-detect handles unknown, manifest allows override | — Pending |
| Randomize HTML/CSS rather than multi-layout | Lower effort than maintaining multiple layouts; achieves uniqueness without template redesign | — Pending |
| Keep Astro SSG for templates | Static output = fast, cheap hosting, Lighthouse-friendly | ✓ Good |
| Cloudflare-only deploy | Simplifies pipeline, already working | ✓ Good |
| Multi-format → static build | All formats (Astro, Vite, HTML) build to static files for Cloudflare Pages | — Pending |

---

## Current State: v1.0 Shipped

**Status:** ✓ Production Ready
**Shipped:** 2026-03-20
**Requirements Met:** 22 of 26 (84.6% scope)
**Test Coverage:** 91.66% (1,009+ tests, 100% passing)
**Commits:** 66 in v1.0 cycle

### What's Working

1. ✓ **Env var injection fixed** — Astro `PUBLIC_*` variables correctly injected at build time via two-stage preprocessing + post-build rewriting
2. ✓ **Multi-format build pipeline** — Astro, Vite/React, and static HTML each build independently in isolated npm environments
3. ✓ **Capability-aware wizard** — Auto-detection + manifest override for templates; wizard dynamically shows/hides steps based on capabilities
4. ✓ **Deterministic anti-fingerprinting** — Same siteId → byte-identical output; CSS class names, DOM IDs, meta tags randomized per deploy
5. ✓ **Comprehensive quality validation** — Viewport, tracking pixels, Astro leak detection, Google Ads markers, Lighthouse 95+ enforcement
6. ✓ **Production deployment ready** — Can deploy 50+ new domains/week with confidence in quality and uniqueness

### What's Deferred (v1.1)

- Live preview modal with real-time variable injection
- Mobile/desktop viewport toggle
- Pre/post-fingerprint HTML comparison

### Next Milestone Goals (v1.1)

1. **Phase 4 (Preview UX):** Implement live preview modal with real-time variable injection (PREV-01–04)
2. **Alpha test validation:** Run 5-10 domain alpha test to measure fingerprinting effectiveness against Google Ads detection
3. **Performance optimization:** Benchmark build concurrency; plan queue if 50+ concurrent deploys cause memory issues
4. **Extended roadmap:** Plan v2 features (domain registrant variation, batch operations, Next.js support)

---

## Current Milestone: v1.1 (Preview UX & Performance)

**Status:** Planning
**Version:** 1.1
**Scope:** Phase 4 (Template Preview UX) + Alpha Testing + Performance Optimization

### Goals

1. **Phase 4: Live Template Preview** — Enable operators to preview templates with injected variables before deploy
   - Live preview modal with iframe rendering (PREV-01)
   - Mobile (320px) / desktop (1024px) viewport toggle (PREV-02)
   - Real-time preview refresh on variable changes (PREV-03)
   - Pre/post-fingerprint HTML comparison (PREV-04)

2. **Alpha Test Validation** — Measure fingerprinting effectiveness against Google Ads detection
   - Deploy 5-10 test domains with randomized HTML/CSS
   - Monitor days-to-flag by Google Ads system
   - Validate anti-detection strategy effectiveness
   - Collect data for v1.1 release notes

3. **Performance Optimization** — Ensure build pipeline scales to 50+ concurrent deployments
   - Benchmark build isolation memory usage at 20, 40, 50+ concurrent templates
   - Implement queue if memory > 90% threshold
   - Plan for batch deploy optimization in v1.2

### Out of Scope (v1.1)

- Domain registrant variation (v2)
- Batch deploy automation (v1.2)
- Next.js template support (v2)
- Template marketplace (v2)

---
*Last updated: 2026-03-20 after v1.0 shipment
Status: Starting v1.1 planning (requirements & roadmap)_
