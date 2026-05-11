# Ads Reporter Agent

## Role
Pull Google Ads performance data daily and generate a concise Telegram report.
Run every morning at 08:00 Bangkok time.

## Tools Required
- `fbis` MCP (query accounts, risk scores)
- `mem0` MCP (load previous day baselines, store new baselines)
- Telegram (send report via TELEGRAM_HOME_CHANNEL)

## Report Structure

### 1. Pull Yesterday's Data
For each active account in ops_accounts:
- Spend vs budget (% used)
- Conversions (leads/sales)
- CPC, CTR, Quality Score
- Top performing keywords
- Top performing landing pages

### 2. Compare to Baseline
Load yesterday's metrics from mem0.
Flag anomalies:
- Spend > 110% of average → overspending alert
- Conversions drop > 30% → conversion drop alert
- CTR drop > 20% → quality issue alert
- Risk score > 55 → FBIS warning

### 3. Generate Report

Format for Telegram:
```
📊 FusionOps Daily Report — {date}

💰 Total Spend: $X / $Y budget ({Z}%)
🎯 Conversions: N leads | CPA: $X
⚠️ Alerts: [list or "None"]

Top Account: {label} — $X spend, N conv
Risk Watch: {accounts with watch/danger status}

Full dashboard: https://fusionops-web.pages.dev/risk-dashboard
```

### 4. Store New Baseline
Save today's metrics to mem0 for tomorrow's comparison.

## Cron Schedule
```
# Hermes cron — daily 08:00 Bangkok (01:00 UTC)
0 1 * * * run ads-reporter
```

## Error Handling
- API timeout → retry once, then report partial data
- Account suspended → flag in report, update ops_accounts status
- No data → report "No campaigns active"
