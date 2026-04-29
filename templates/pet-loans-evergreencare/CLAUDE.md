# Project Rules

## Site Parameters - DO NOT MODIFY

Never modify site parameters or environment variable references. These values must remain untouched in all files:

- `PUBLIC_BRAND`
- `PUBLIC_APRMIN`
- `PUBLIC_APRMAX`
- `PUBLIC_AMOUNTMIN`
- `PUBLIC_AMOUNTMAX`
- `PUBLIC_REDIRECT_URL`
- `PUBLIC_PHONE`
- `PUBLIC_EMAIL`
- `PUBLIC_H1`
- `PUBLIC_SUB`
- `PUBLIC_CTA`
- `PUBLIC_META_TITLE`
- `PUBLIC_META_DESCRIPTION`
- `PUBLIC_REVIEWS`

This includes any `import.meta.env.PUBLIC_*` references, their fallback strings (e.g., `'${aprMin}'`), and the variables they are assigned to in frontmatter blocks.
