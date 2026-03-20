---
name: lp_quality_gate_reporter
description: Validate newly imported templates against quality gate checks and report results
metadata.openclaw.requires.bins: ["curl"]
---

# LP Factory Quality Gate Reporter

After a new template is imported, automatically run quality validation and send results via Telegram. Catches issues before anyone tries to deploy a broken template.

## When to Use

Run on cron every 30 minutes. Check for templates imported since last check. Only report when new templates are found.

## Configuration

Required environment variables:
- `LP_API_BASE`: LP Factory API base URL
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TELEGRAM_CHAT_ID`: Target chat ID

## How It Works

1. Fetch all templates from API:
   ```bash
   curl -s "${LP_API_BASE}/templates"
   ```

2. Filter templates updated in last 30 minutes (by `updated_at` field).

3. For each new/updated template, validate:

   | Check | How | Pattern |
   |-------|-----|---------|
   | Viewport meta | Scan for `<meta name="viewport">` | Required |
   | Primary color token | Scan for `--primary` CSS variable | Required |
   | Payment Calculator | Scan for "Payment Calculator" text | Required for loan |
   | APR Table | Scan for `<table>` with "APR" | Required for loan |
   | First-party pixel | Scan for `sendBeacon` or pixel markers | Required |
   | Google Ads tracking | Scan for `gtag(` or `AW-` | Required |
   | Expression leak | Scan for unescaped Astro expressions | Must NOT match |
   | Banned copy | Scan for "guaranteed approval" etc. | Must NOT match |

4. Send results via Telegram.

## Message Format

### Pass
```
Template Import: trust-lend
Quality Gate: PASS (8/8 checks)
Category: loan | Source: MCP
Ready to deploy
```

### Fail
```
Template Import: demo-template-01
Quality Gate: FAIL (5/8 checks)

Missing:
  - Payment Calculator section
  - APR comparison table
  - Primary color token (--primary)

Action: Fix template before deploying
```

## Cron Setup

```bash
openclaw cron add \
  --name "LP Quality Gate Reporter" \
  --cron "*/30 * * * *" \
  --session isolated \
  --message "Check for newly imported LP Factory templates in the last 30 minutes. Run quality gate validation and report results via Telegram." \
  --announce --channel telegram
```

## Safety

- Read-only: fetches templates, does not modify
- Only reports new/updated templates (no spam for unchanged ones)
- Stateless: uses timestamp comparison, no persistent state needed
