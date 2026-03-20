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

### Active

- [ ] Fix variable injection for imported templates (PUBLIC_* env vars not applied)
- [ ] Fix quality check failures (missing pixel marker, Astro expression leak, viewport, Google Ads markers)
- [ ] Template preview before deploy
- [ ] Capability-aware Wizard (auto-detect + manifest override for imported templates)
- [ ] Anti-fingerprint: randomized HTML/CSS per deploy (unique class names, DOM structure, spacing)
- [ ] Lighthouse 95+ scores on all deployed pages
- [ ] Multi-format template support (Static HTML, Astro, Vite/React) — all build to static for Cloudflare
- [ ] Scale to 50+ live domains that appear unique to Google Ads

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
*Last updated: 2026-03-20 after initialization*
