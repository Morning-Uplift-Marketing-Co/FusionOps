# Patch Notes — bolt-loan-pastel-optimized-01

Fixes applied for FusionOps Wizard live-preview compatibility.

## Files Changed

### `src/components/Calculator.astro`
- Added `amountMinFmt` / `amountMaxFmt` frontmatter variables
- Changed `${amountMin.toLocaleString()}` → `${amountMinFmt}` in display text
  (preview engine resolves simple `${varName}` only — method calls like `.toLocaleString()` are not evaluated)
- Slider `min`/`max` attributes now use Astro `{amountMin}` / `{amountMax}` expressions
- All TypeScript removed from `<script>` block:
  - `as HTMLInputElement` → removed
  - `document.getElementById('x')!` → `document.getElementById('x')`
  - `function calcMonthly(p: number, r: number, n: number): number` → `function calcMonthly(p, r, n)`

### `src/components/Footer.astro`
- Removed TypeScript from frontmatter: `const popupContent: Record<string, {...}>` type annotation → removed
- **Critical fix**: Moved `popupContent` object from Astro frontmatter into the `<script>` block
  (Astro frontmatter variables are NOT accessible in `<script>` tags without `define:vars` — this was a runtime bug)
- Rewrote popup logic in plain JavaScript (no TypeScript type casts)
- Added disclosure toggle functionality (was missing a close toggle button)

## Engine Changes (in FusionOps repo, not template)

Two improvements were made to `src/utils/template-preview-runtime.js` and `src/utils/template-router.js`:
1. `substituteSiteVariables()` — replaces `${varName}` placeholders in HTML-static templates
2. `stripTypeScriptFromScript()` — strips TypeScript from `<script>` blocks at preview time
   Handles: `as TypeName`, `querySelector<T>`, non-null assertions `!`, parameter type annotations, return type annotations

## Variables Supported in Live Preview

All fields in Wizard → Copy & CTA step update in real-time:

| Placeholder | Wizard Field |
|---|---|
| `{brand}` / `${brand}` | Brand Name |
| `{h1}` / `${h1}` | H1 Headline |
| `{sub}` / `${sub}` | Sub-headline |
| `{cta}` / `${cta}` | CTA Button |
| `{aprMin}` / `{aprMax}` | APR Range |
| `${amountMinFmt}` / `${amountMaxFmt}` | Loan Amount display (formatted) |
| `{amountMin}` / `{amountMax}` | Loan Amount (slider range from env) |
