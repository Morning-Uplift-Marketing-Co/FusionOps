# Phase 4: Color Defaults - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Templates display default ocean colors in local dev and preview without CI injection. Update TEMPLATE-PROMPT.md to instruct AI tools to include default HSL values.

</domain>

<decisions>
## Implementation Decisions

### Default palette
- Use ocean palette as default: `--primary: 217 91% 35%; --secondary: 158 64% 42%; --accent: 15 92% 62%; --background: 210 40% 98%; --foreground: 222 47% 11%;`
- Values go into global.css `:root` block (currently empty)
- Deploy pipeline's injected `<style>` tag in `<head>` will override these at build time -- CSS cascade handles it

### TEMPLATE-PROMPT.md update
- Change "LEAVE EMPTY" to include ocean default HSL values
- Keep the comment explaining deploy pipeline overrides per-site
- Both Astro and Vite/React prompt sections need updating

### Existing templates
- goldrush-lending (DB template): update global.css in the JSON to include defaults
- Other physical templates (pet-orange-white etc.): if they already have COLOR_MAP in Layout.astro they work -- no change needed
- New templates created after this change will get defaults automatically via updated prompt

### Claude's Discretion
- Exact comment wording in global.css and TEMPLATE-PROMPT.md
- Whether to also add --color-primary (alias for --primary used by some templates)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Color system
- `packages/lp-template-generator/src/shared/unified-colors.js` -- Master color palette definitions (8 schemes, HSL format)
- `scripts/inject-tracking.mjs` lines 628-688 -- CI color injection into Layout.astro

### Template creation
- `docs/TEMPLATE-PROMPT.md` -- AI prompt for Bolt/Lovable template generation (all 3 format sections need updating)
- `goldrush-lending.template.json` -- DB template that needs global.css default colors

### Deploy pipeline
- `.github/workflows/deploy-lp.yml` lines 105-181 -- How PUBLIC_COLORID flows to env vars

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `unified-colors.js` COLOR_SCHEMES array: exact HSL values for all 8 palettes
- `inject-tracking.mjs` COLOR_MAP: same values inlined as JS object for Astro frontmatter

### Established Patterns
- CSS variable theming via `:root` + Tailwind `hsl(var(--primary) / <alpha-value>)` mapping
- Deploy override: injected `<style is:inline>` in `<head>` overrides `:root` defaults via cascade

### Integration Points
- `tailwind.config.mjs` in each template -- maps `bg-primary` etc. to CSS vars (no change needed)
- Template preview runtime (`src/utils/template-preview-runtime.js`) -- injects `<style id="lp-theme-override">` which also overrides

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- standard approach: add ocean defaults to global.css, update prompt doc.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 04-color-defaults*
*Context gathered: 2026-03-22*
