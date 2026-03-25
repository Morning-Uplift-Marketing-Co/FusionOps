# OpenClaw Agents for LP Factory

**Scheduled (cron):** 7 automation agents that monitor LP Factory via Telegram + GitHub/API.

**On-demand skills:** 7 extra playbooks under `openclaw/skills/` for local repo work, live URL checks, GitHub log triage, planning runbooks, dev-agent handoff, and one-shot ops briefs. Copy **all** of `openclaw/skills/*` into your OpenClaw skills directory.

## Quick Setup

### 1. Prerequisites

```bash
# Install OpenClaw
# See: https://docs.openclaw.ai/start/getting-started

# Required tools
brew install gh jq  # or apt-get install
gh auth login       # GitHub CLI authentication
```

### 2. Set Environment Variables

Add to your OpenClaw config or `.env`:

```bash
# GitHub
GH_REPO="Morning-Uplift-Marketing-Co/FusionOps"

# Telegram notifications
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_CHAT_ID="your-chat-id"

# LP Factory API
LP_API_BASE="https://your-worker.workers.dev"

# Cloudflare
CF_API_TOKEN="your-cf-token"
CF_ACCOUNT_ID="your-account-id"
CF_ZONE_IDS="zone1,zone2"

# Multilogin (for Ads Watchdog — browser automation)
MLX_EMAIL="your-multilogin-email"
MLX_PASSWORD="your-password"
MLX_LAUNCHER="https://launcher.mlx.yt:45001"
MLX_API_BASE="https://api.multilogin.com"

# Voluum (for Spend Alert — replaces Google Ads API)
VOLUUM_ACCESS_ID="your-access-id"
VOLUUM_ACCESS_KEY="your-access-key"
VOLUUM_API_BASE="https://your-worker.workers.dev/api/voluum"

# LendingCards (for real cost calculation with fees)
LENDINGCARD_TOKEN="your-token"
LENDINGCARD_API="https://app.leadingcards.media/v1"

# Budget
DAILY_BUDGET_LIMIT="500"
```

### 3. Install Skills

Copy **every** skill folder to your OpenClaw workspace (path may vary by install; see [OpenClaw skills](https://docs.openclaw.ai/skills)):

```bash
cp -r openclaw/skills/* ~/.openclaw/workspace/skills/
```

| Skill folder | OpenClaw name | Purpose |
|--------------|---------------|---------|
| `deploy-monitor` | `lp_deploy_monitor` | Recent `deploy-lp.yml` runs → Telegram |
| `domain-health` | `lp_domain_health` | HTTP / SSL / DNS per active site |
| `ads-watchdog` | `lp_ads_watchdog` | Policy / disapprovals (Multilogin) |
| `spend-alert` | `lp_spend_alert` | Voluum + LendingCards vs budget |
| `quality-gate-reporter` | `lp_quality_gate_reporter` | New templates → quality checks |
| `cf-cleanup` | `lp_cf_cleanup` | Orphan CF Pages/DNS (confirm before delete) |
| `template-scout` | `lp_template_scout` | Bolt / Lovable scouting |
| `lp-template-pipeline` | `lp_template_pipeline` | Local convert / pack / inject-tracking / test |
| `lp-live-tracking-verify` | `lp_live_tracking_verify` | Live URL HTML + pixel/gtag checks |
| `lp-ci-local-triage` | `lp_ci_local_triage` | `npm run check/lint/test` on dev machine |
| `lp-planning-runbook` | `lp_planning_runbook` | Follow `.planning/**/*.md` steps |
| `lp-github-workflow-triage` | `lp_github_workflow_triage` | `gh run view --log-failed` deep dive |
| `lp-dev-session-delegate` | `lp_dev_session_delegate` | Hand off task to Claude Code / Codex / Cursor |
| `lp-ops-daily-brief` | `lp_ops_daily_brief` | One message: deploys + API snapshot + spend pointer |

### 4. Register Cron Jobs

```bash
# 1. Deploy Monitor (every 5 min)
openclaw cron add --name "LP Deploy Monitor" --cron "*/5 * * * *" \
  --session isolated \
  --message "Check GitHub Actions deploy status for LP Factory and notify Telegram" \
  --announce --channel telegram

# 2. Domain Health (every 6 hours)
openclaw cron add --name "LP Domain Health" --cron "0 */6 * * *" \
  --session isolated \
  --message "Run domain health check on all active LP Factory sites" \
  --announce --channel telegram

# 3. Google Ads Watchdog (every 2 hours)
openclaw cron add --name "LP Ads Watchdog" --cron "0 */2 * * *" \
  --session isolated \
  --message "Check Google Ads accounts for policy violations and disapprovals" \
  --announce --channel telegram

# 4. Spend Alert (every 3 hours + daily 9AM)
openclaw cron add --name "LP Spend Check" --cron "0 */3 * * *" \
  --session isolated \
  --message "Check Google Ads spend vs daily budget, alert if >80%" \
  --announce --channel telegram

openclaw cron add --name "LP Daily Spend Report" --cron "0 9 * * *" \
  --tz "Asia/Bangkok" --session isolated \
  --message "Generate daily Google Ads spend summary" \
  --announce --channel telegram

# 5. Quality Gate (every 30 min)
openclaw cron add --name "LP Quality Gate" --cron "*/30 * * * *" \
  --session isolated \
  --message "Check for newly imported templates and validate quality gate" \
  --announce --channel telegram

# 6. CF Cleanup (Sunday 10PM)
openclaw cron add --name "LP CF Cleanup" --cron "0 22 * * 0" \
  --tz "Asia/Bangkok" --session main \
  --message "Find orphaned Cloudflare projects and DNS records, report before deleting" \
  --announce --channel telegram

# 7. Template Scout (Monday 10AM)
openclaw cron add --name "LP Template Scout" --cron "0 10 * * 1" \
  --tz "Asia/Bangkok" --session isolated \
  --message "Browse Bolt.new and Lovable for new loan landing page templates" \
  --announce --channel telegram
```

### 5. Verify

```bash
openclaw cron list          # See all scheduled jobs
openclaw skills list        # See all loaded skills
```

## Agent Overview

| Agent | Schedule | Channel | Priority |
|-------|----------|---------|----------|
| Deploy Monitor | */5 * * * * | Telegram | HIGH |
| Domain Health | 0 */6 * * * | Telegram | HIGH |
| Ads Watchdog | 0 */2 * * * | Telegram | HIGH |
| Spend Check | 0 */3 * * * | Telegram | HIGH |
| Daily Report | 0 9 * * * | Telegram | HIGH |
| Quality Gate | */30 * * * * | Telegram | MEDIUM |
| CF Cleanup | 0 22 * * 0 | Telegram | MEDIUM |
| Template Scout | 0 10 * * 1 | Telegram | LOW |
