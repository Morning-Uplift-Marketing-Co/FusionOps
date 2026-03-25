---
name: lp_ops_daily_brief
description: One-shot morning/ops summary combining deploy status (gh), optional active site count (LP API), and pointer to spend report. Use when user asks for "สรุปวันนี้", "brief", "ทุกอย่างเป็นยังไง".
metadata.openclaw.requires.bins: ["gh", "curl"]
---

# LP Factory — Ops daily brief (aggregator)

## When to use

- Single message covering **deploy + footprint + spend hook**.
- Does not replace cron jobs; use for **ad-hoc** briefings or heartbeat.

## Configuration

- `GH_REPO`
- `LP_API_BASE` (optional — for site/template counts)
- For spend numbers, use skill `lp_spend_alert` / env documented there (`VOLUUM_*`, `DAILY_BUDGET_LIMIT`).

## Procedure

1. **Last deploy-lp runs** (3 most recent)

   ```bash
   gh run list --repo "$GH_REPO" --workflow deploy-lp.yml --limit 3 \
     --json conclusion,displayTitle,url,updatedAt
   ```

2. **Optional — scale snapshot**

   ```bash
   curl -s "${LP_API_BASE}/sites" | head -c 4000
   ```

   Summarize: how many active / any obvious errors (if API returns counts or list length via `jq` when available).

3. **Spend**  
   If Voluum env configured, run the **daily summary** path from `lp_spend_alert` SKILL (session + one report call) or tell user "see scheduled LP Daily Spend Report cron".

4. **Output template**

   ```
   LP Ops Brief (UTC/local as noted)
   Last deploys: [ok/fail + links]
   Sites API: [brief]
   Spend: [summary or "see spend-alert cron / run lp_spend_alert"]
   Next: [user-defined or suggest domain health if issues]
   ```

## Safety

- Read-only API and `gh` list/view; no deploy reruns unless user asks.

## Related cron skills

- `lp_deploy_monitor`, `lp_domain_health`, `lp_spend_alert` (this brief is the manual combo).
