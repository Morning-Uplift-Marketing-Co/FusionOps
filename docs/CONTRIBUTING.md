# Contributing & operator setup (FusionOps)

## After `git pull` (stay in sync)

1. **Install deps** if lockfiles changed:
   - Root: `npm install` (or `npm ci` in clean CI checkouts)
   - API Worker: `npm run install:api-worker` or `cd apps/api-worker && npm ci`
2. **Read [CHANGELOG.md](../CHANGELOG.md)** for breaking or operational notes (new env vars, migrations, script renames).
3. **Diff [.env.example](../.env.example)** against your local `.env` and add any new keys.
4. **Run checks** before pushing: `npm run lint` and `npm test` (and `npm run test:e2e` when UI flows change).

Prefer a single source of truth on **`main`** (or your team’s default branch). Optional: tag releases (`v3.x.x`) or GitHub Releases so production can be traced to a commit.

## PR expectations (small but important)

- New **client or build-time** env vars: update **`.env.example`** and **CHANGELOG** in the same PR.
- **D1 / schema** changes: include migrations under `apps/api-worker/migrations/` and a short **CHANGELOG** / PR description of what operators must run locally or on remote D1 (see `package.json` scripts in `apps/api-worker`).
- **Dependency upgrades** that affect everyone: keep changes in a dedicated PR with green CI so others can `npm ci` predictably.

## GitHub Actions secrets (dashboard deploy)

Workflow: `.github/workflows/deploy-dashboard.yml`.

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | API token with rights to deploy Workers/Pages for the account |
| `CLOUDFLARE_ACCOUNT_ID` | Target Cloudflare account |

The workflow runs a token preflight before deploy. Do not commit these values; set them in the repo’s **Settings → Secrets and variables → Actions**.

## Wrangler / Worker secrets (API)

Production and preview secrets (AI keys, Neon URL, etc.) are **not** in this repo. Set them with `wrangler secret put <NAME>` for `apps/api-worker` or via the Cloudflare dashboard, consistent with [`apps/api-worker/wrangler.toml`](../apps/api-worker/wrangler.toml) and [.planning/codebase/INTEGRATIONS.md](../.planning/codebase/INTEGRATIONS.md).

## Internal comms

When a release requires action (migrate, new env, redeploy), post a link to the PR or release notes in your team channel (Slack/Discord/etc.) so people don’t rely on word of mouth alone.
