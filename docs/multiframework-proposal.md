# Multi-Framework / Build-Fingerprint Diversification — Proposal

**Date:** 2026-06-09
**Goal:** break the React/Vite/Tailwind monoculture so a network of LP sites doesn't cluster as one operator to Google.
**Sources:** `docs/multiframework-research.md` (gemini), codebase analysis (codex).

## Key insight (changes everything)
The generators emit **final static HTML**, and `scripts/inject-tracking.mjs` already has an **HTML-first path** that injects tracking into static `index.html`. So adding "frameworks" for footprint purposes does **NOT require new build toolchains** — we emit varied static HTML, the existing pipeline handles it. `finalizeHtml()` (already applies `randomizeHtmlStructure`) is the single post-pass.

→ Recommendation: **emit varied static HTML styles, do NOT bolt on real Next/Hugo/11ty build tools.** The output is what Google fingerprints, not the build tool.

---

## Phase 1 — CSS-strategy presets (LOW effort, HIGH value) ⭐ start here
Extend the existing plain-HTML generator with a seeded `cssStrategy` chosen deterministically per `site.id`:

| Strategy | Fingerprint vs Tailwind | Notes |
|----------|------------------------|-------|
| **Pico.css** (classless) | EXTREME — semantic tags, almost no classes | inline or CDN |
| **Vanilla / BEM** | EXTREME — `.card__title` style, no utility strings | inline `<style>` |
| **Bulma** | HIGH — unique `is-*`/`has-*` prefixes | single CSS file |
| **Bootstrap 5** | HIGH — `.btn`/`.card`/`.col-md-*` component classes | CDN or compiled |

**Files to change (per codex):**
- `src/utils/generators/plain-html-generator.js` — add seeded `cssStrategy` + per-strategy markup
- `src/utils/generators/html-structure-randomizer.js` — DOM variation (semantic tag swap, wrapper nesting, attribute order, quote style, comment injection — per gemini)
- `src/utils/template-router.js` — expand `PLAIN_HTML_TEMPLATE_IDS` / `shouldUsePlainHtml()` so all plain variants route to the one generator
- `src/utils/generators/__tests__/diversification.test.js` — lock determinism (same id → same strategy)

**Deploy:** no change. **Toolchain:** none. **Risk:** low (pure generator + existing post-pass).

## Phase 2 — "SSG-style" structural presets (MEDIUM)
Add more structural presets that mimic non-SPA markup conventions (traditional/SSG-style: `<article>`/`<section>` hierarchies, different head ordering, no `<div id="root">`, zero module scripts). Emit final HTML — still **no real 11ty dependency**. New file `src/utils/generators/static-ssg-generator.js`, routed via template-router.

## Phase 3 (optional) — real Eleventy, only if you want the actual tool
If you want genuine 11ty (Nunjucks templates, etc.): new generator + the `npm run build` step in `deploy-lp.yml` must branch on an `html-static`/`11ty` type (skip Vite build, run `npx @11ty/eleventy --output=dist`). Higher effort + a CI branch. **Not recommended** unless you specifically want 11ty authoring — Phase 1+2 already achieve the footprint goal.

---

## Recommended order
1. **Phase 1** (CSS presets) — biggest footprint ROI, leverages existing code, no deploy/toolchain change
2. **Phase 2** (SSG-style structural presets) — more breadth, still no toolchain
3. Phase 3 (real 11ty) — skip unless authoring need

## DOM-variation techniques to fold into the randomizer (gemini)
semantic tag substitution · arbitrary wrapper nesting · attribute reordering · quote-style switching · comment injection/stripping · whitespace/minify variants — all seeded per site.id for determinism.
