---
name: lp_github_workflow_triage
description: Inspect failed GitHub Actions runs (deploy-lp, deploy-dashboard, convert-vite-template) via gh CLI and extract log snippets for debugging.
metadata.openclaw.requires.bins: ["gh"]
---

# LP Factory — GitHub workflow failure triage

## When to use

- Deploy failed but user needs the **why** (not just success/fail ping).
- After `lp_deploy_monitor` reported failure.
- Phrases: "ดึง log GitHub", "workflow แดง", "deploy-lp fail".

## Configuration

- `GH_REPO`: e.g. `Morning-Uplift-Marketing-Co/FusionOps` (must match `openclaw/README.md`).

## Constants

- `WORKFLOW_FILE`: optional — `deploy-lp.yml`, `deploy-dashboard.yml`, `convert-vite-template.yml`, `git-safety.yml`.

## Procedure

1. **Recent failures**

   ```bash
   gh run list --repo "$GH_REPO" --limit 15 --json databaseId,status,conclusion,name,headBranch,createdAt \
     --jq '.[] | select(.conclusion=="failure")'
   ```

2. **Pick run** (newest failure for relevant workflow):

   ```bash
   gh run list --repo "$GH_REPO" --workflow "$WORKFLOW_FILE" --limit 5 --json databaseId,conclusion,url
   ```

3. **Failed job logs**

   ```bash
   gh run view <RUN_ID> --repo "$GH_REPO" --log-failed
   ```

   If too large, re-run with `--job <JOB_ID>` after `gh run view <RUN_ID> --json jobs`.

4. **Summarize for chat**
   - Workflow name, branch, run URL.
   - Failing step name.
   - Last 40–80 lines of failed step or root error line (Out of memory, npm error, wrangler, etc.).
   - Map to local fix: e.g. run `lp_ci_local_triage` or `lp_template_pipeline` on same commit.

## Safety

- Read-only: do not `gh run rerun` or cancel without user asking.
