---
name: lp_template_pipeline
description: Local LP Factory template workflow — generate from D1, convert-template, pack-template, inject-tracking, npm check/lint/test. Use for Bolt/Loveable import, ZIP prep, or pre-upload validation on the dev machine.
metadata.openclaw.requires.bins: ["node", "npm"]
---

# LP Factory — Template pipeline (local repo)

## When to use

- User imported or unzipped a template under `templates/<name>` or generated one from D1.
- Phrases: pack template, convert template, inject tracking, dry-run, `generate-template-from-db`, pre-upload check.

## Constants

- `LP_FACTORY_ROOT`: absolute path to repo root (`package.json` has `"name": "lp-factory-web"`). Windows: `H:/DEV/.../ppc-claude-web-V1` or quoted path.
- `TEMPLATE_DIR`: relative to root, e.g. `templates/LionFunds`. If `generate-template-from-db` prints an absolute path, use that for inject/convert.

## Safety

- Use `convert-template` with `--dry-run` first until user confirms.
- No secrets in chat; do not commit `.env`.
- If `git status` shows mass unexpected deletes, stop and ask.

## Procedure

1. `cd "$LP_FACTORY_ROOT"`

2. **Optional — D1 → folder**

   ```bash
   node scripts/generate-template-from-db.mjs "<templateId>"
   ```

   Use output directory as `TEMPLATE_DIR`.

3. **Convert Astro props → site literals** (`scripts/README-TEMPLATES.md`)

   ```bash
   npm run convert-template "$TEMPLATE_DIR" -- --dry-run
   npm run convert-template "$TEMPLATE_DIR" -- --backup
   ```

4. **Optional — ZIP for Smart Import**

   ```bash
   npm run pack-template "$TEMPLATE_DIR" -- --convert
   ```

   Add `--name`, `--desc`, `--category`, `--badge` if provided.

5. **Inject tracking** (needs env like CI: Voluum, gtag, etc.)

   ```bash
   node scripts/inject-tracking.mjs "$TEMPLATE_DIR"
   ```

   Root `index.html`-only cases may use `npm run inject:index-html-tracking` when applicable.

6. **Quality gates**

   ```bash
   npm run check && npm run lint && npm test
   ```

   `npm run test:e2e` only if user asks.

7. **Summarize**: commands, exit codes, zip path, Astro vs Vite from db script, last ~30 lines of stderr on failure.

## See also

- `docs/template-worker-deploy-checklist.md` — worker deploy / runtime QA
- [OpenClaw skills](https://docs.openclaw.ai/skills)
