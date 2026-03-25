---
name: lp_dev_session_delegate
description: Delegate coding work from OpenClaw to a desktop agent (Claude Code, Codex CLI, Cursor) with repo path, branch, and task spec. No automatic execution on remote SaaS unless user configured it.
metadata.openclaw.requires.bins: []
---

# LP Factory — Delegate to dev agent (Claude Code / Codex / Cursor)

## When to use

- User is on phone/Telegram and wants a **coding task** started on the workstation.
- "รัน Claude Code ให้แก้ …", "kick off Codex", "สรุปงานให้ Cursor".

## Constants

- `LP_FACTORY_ROOT`: repo root on the machine where the agent runs.
- `TASK_TITLE`: one line.
- `TASK_DETAIL`: bullets: goal, files touched if known, constraints, tests to run.

## Procedure

1. **Confirm environment**
   - Machine is on, repo is cloned at `LP_FACTORY_ROOT`, user wants local agent (not cloud-only).

2. **Write a handoff block** (user or OpenClaw pastes into the agent):

   ```
   Repo: {LP_FACTORY_ROOT}
   Branch: (create feature/fix-... from current main unless user specified)

   Task: {TASK_TITLE}

   {TASK_DETAIL}

   Verify:
   - npm run check && npm run lint && npm test
   - (optional) npm run test:e2e

   Do not commit secrets. Open PR or report diff summary when done.
   ```

3. **Start agent** (examples — adjust to user install):

   ```bash
   cd "$LP_FACTORY_ROOT"
   # Claude Code (if installed)
   # claude "..." 
   # Codex CLI
   # codex "..." 
   ```

   OpenClaw should run the **actual** command the user has documented in memory (path to binary).

4. **Follow-up**
   - Poll git status / branch or wait for user message.
   - If agent reports failure, route to `lp_ci_local_triage` or `lp_github_workflow_triage`.

## Safety

- Do not pass API keys in the handoff text.
- Prefer feature branches; never force-push `main` without explicit request.

## Related

- `lp_planning_runbook` — spec from `.planning/*.md`
- `lp_template_pipeline` — template-only automation
