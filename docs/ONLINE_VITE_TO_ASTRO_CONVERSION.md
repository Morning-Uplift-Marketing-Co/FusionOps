# Online Vite -> Astro Conversion

Use this flow when you want conversion to run online (GitHub Actions), not manually on a local machine.

## 1) Workflow

Use workflow: `.github/workflows/convert-vite-template.yml`

Inputs:
- `source_repo`: git URL of the Vite/Lovable project
- `template_id`: output folder name under `templates/`
- `template_name`: optional display name

What it does:
- clones source repo
- runs converter script
- validates with `scripts/validate-template-tracking.mjs`
- uploads converted template as workflow artifact

## 2) Local/Server CLI (same script)

```bash
node scripts/convert-vite-to-astro-template.mjs \
  --source <path-or-git-url> \
  --out templates \
  --template-id <template-id> \
  --name "<Template Name>"
```

## 3) Output Policy

- Converted output is Astro format.
- `public/apply.html` is preserved and mirrored to `apply.html` for validation compatibility.
- `index` route stays deployable and points to the built static landing page.
