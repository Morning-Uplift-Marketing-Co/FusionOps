---
name: lp_ci_local_triage
description: Run local LP Factory repo checks (astro check, eslint, vitest, optional e2e) and summarize failures for quick fixes. Use when CI failed or before push.
metadata.openclaw.requires.bins: ["node", "npm"]
---

# LP Factory — Local CI triage

## When to use

- "CI แดง", "test fail", "lint ไม่ผ่าน", before PR, after large refactor.
- Complements `lp_deploy_monitor` (which only reports GitHub Actions status).

## Constants

- `LP_FACTORY_ROOT`: repo root with `package.json` (`lp-factory-web`).

## Procedure

1. `cd "$LP_FACTORY_ROOT"`

2. **Type / Astro**

   ```bash
   npm run check
   ```

3. **Lint**

   ```bash
   npm run lint
   ```

4. **Unit tests**

   ```bash
   npm test
   ```

5. **E2E** (slow; only if user asks or failure mentions Playwright)

   ```bash
   npm run test:e2e
   ```

6. **Summarize**
   - First failing command and exit code.
   - Paste failing test names and 20–40 lines of relevant output.
   - Suggest file areas from stack traces (e.g. `src/services/`, `scripts/`).

## Safety

- Do not run `npm publish`, `wrangler deploy`, or destructive git without explicit user request.
