# Paid Component Normalization Spec

## Selected Paid Source

- Primary source: `Tailwind UI` (Tailwind Labs)
- Reason:
  - Commercial license path is clear
  - Mobile-ready building blocks
  - Easy mapping to current tokenized template system

## Scope

- Normalize imported paid blocks into FusionOps template pipeline:
  - `templateId`
  - color tokens (`primary`, `secondary`, `accent`)
  - typography tokens
  - worker-safe rendering constraints
  - tracking baseline compatibility

## Normalization Contract

Each paid-derived template must include:

- `src/pages/index.astro` or `index.html`
- deterministic token usage:
  - `var(--color-primary)`
  - `var(--color-secondary)`
  - `var(--color-accent)`
- CTA block with one primary click target above the fold
- tracking hooks:
  - `gtag` init (if conversion ID present)
  - `form_start` and `form_submit`
  - pixel event to `https://t.{domain}/e`

## Mapping Rules

- Typography:
  - display/headline -> template `fontId`
  - body -> template `fontId` fallback stack
- Colors:
  - paid palette main -> `primary`
  - paid palette support -> `secondary`
  - paid action color -> `accent`
- Components:
  - hero -> `section.hero`
  - social proof -> `section.trust`
  - FAQ/testimonial -> optional modules

## Deploy Safety Rules

- Avoid complex Astro conditional blocks in `<head>` for worker convert path
- Ensure critical styles for hero/form/button are available without runtime build dependencies
- Strip or pre-resolve unsupported expression patterns before deploy

## Acceptance Criteria

- Template appears in Wizard + Template Manager with `componentSource=Tailwind UI`
- No expression leak on live page (`{title}`, `{... && (...)}`, ternary blocks)
- Primary CTA, form, and tracking events work on mobile
- Passes Template Quality Gate in Template Manager

