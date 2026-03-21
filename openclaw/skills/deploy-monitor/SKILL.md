---
name: lp_deploy_monitor
description: Monitor GitHub Actions deploy workflows and report status via Telegram
metadata.openclaw.requires.bins: ["gh", "curl"]
---

# LP Factory Deploy Monitor

Monitor GitHub Actions deployment workflows for the LP Factory project and notify via Telegram when deploys complete or fail.

## When to Use

Run this skill on a cron schedule (every 5 minutes) to check for new GitHub Actions workflow runs. Report deploy status so the team knows without checking GitHub directly.

## Configuration

Required environment variables:
- `GH_REPO`: GitHub repository (e.g., `Morning-Uplift-Marketing-Co/FusionOps`)
- `TELEGRAM_BOT_TOKEN`: Telegram bot API token
- `TELEGRAM_CHAT_ID`: Target chat/group ID for notifications

## How It Works

1. Fetch the 5 most recent workflow runs for `deploy-lp.yml`:
   ```bash
   gh api repos/${GH_REPO}/actions/workflows/deploy-lp.yml/runs?per_page=5
   ```

2. For each run, check:
   - `status`: `completed`, `in_progress`, `queued`
   - `conclusion`: `success`, `failure`, `cancelled`
   - `created_at`: only report runs from the last 10 minutes (avoid duplicates)

3. For new completed runs, extract:
   - Run ID and URL
   - Branch name
   - Commit message (contains domain name)
   - Duration (updated_at - created_at)
   - Conclusion (success/failure)

4. Send Telegram notification:
   ```bash
   curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
     -d chat_id="${TELEGRAM_CHAT_ID}" \
     -d parse_mode="Markdown" \
     -d text="${MESSAGE}"
   ```

## Message Format

### Success
```
Deploy OK: example-domain.com
Branch: main
Duration: 2m 34s
Link: https://github.com/.../actions/runs/12345
```

### Failure
```
DEPLOY FAILED: example-domain.com
Branch: main
Error: Build step failed
Link: https://github.com/.../actions/runs/12345
```

## Cron Setup

```bash
openclaw cron add \
  --name "LP Deploy Monitor" \
  --cron "*/5 * * * *" \
  --session isolated \
  --message "Check GitHub Actions deploy status for LP Factory and notify Telegram of any completed runs in the last 10 minutes" \
  --announce --channel telegram
```

## Safety

- Read-only GitHub API calls (no mutations)
- Only reports runs from last 10 minutes to prevent duplicate notifications
- If GitHub API fails, log error but do not send alert (transient)
