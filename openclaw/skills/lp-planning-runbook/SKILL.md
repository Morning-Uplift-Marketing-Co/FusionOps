---
name: lp_planning_runbook
description: Execute or summarize steps from LP Factory .planning docs (PROJECT.md, phase PLAN.md, debug notes). Read files, run only commands the user approves.
metadata.openclaw.requires.bins: ["node", "npm", "git"]
---

# LP Factory — Planning / runbook assistant

## When to use

- User references `.planning/PROJECT.md`, `ROADMAP.md`, `phases/*/PLAN.md`, `debug/*.md`.
- "ทำตามแผน phase X", "verify ตาม VALIDATION", "next step จาก roadmap".

## Constants

- `LP_FACTORY_ROOT`: repo root.
- `RUNBOOK_PATH`: optional explicit file, e.g. `.planning/phases/05-tracking-verification/05-01-PLAN.md`.

## Procedure

1. `cd "$LP_FACTORY_ROOT"`

2. **Load context** (read only):
   - If `RUNBOOK_PATH` set, read that file first.
   - Else read `.planning/PROJECT.md` and ask which phase or artifact to follow.

3. **Extract actionable steps**
   - Bullet commands (`npm run ...`, `node scripts/...`, `gh ...`, `wrangler ...`).
   - Acceptance criteria / checkboxes.

4. **Execute incrementally**
   - Run one logical group at a time; report output before the next.
   - For destructive or deploy steps, require explicit user confirmation in the same session.

5. **Track progress**
   - Use OpenClaw memory or a short note: which REQ-/phase items completed.

## Safety

- Never apply git operations that drop unrelated work (`git reset --hard`, force push) without explicit approval.
- Secrets only via env on the machine, never from chat into committed files.

## Related skills

- `lp_template_pipeline` — concrete npm template commands
- `lp_ci_local_triage` — default test/lint sweep
