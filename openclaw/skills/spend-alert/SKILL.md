---
name: lp_spend_alert
description: Track daily ad spend via Voluum API and LendingCards fees, alert when approaching budget limits
---

# LP Factory Spend Alert (via Voluum + LendingCards)

Track daily ad spend using Voluum reports (not Google Ads API). Include LendingCards deposit fees for true cost calculation. Send warnings at 80% budget, alerts at 100%, and a daily summary every morning.

## Why Voluum Instead of Google Ads API

- All traffic flows through Voluum — it already has cost, conversions, revenue, ROI
- Single API covers all Google Ads accounts (Voluum aggregates across traffic sources)
- No need for Google Ads API credentials per account
- LendingCards fees add the real deposit cost (3.5% markup)

## Configuration

Required environment variables:
- `VOLUUM_ACCESS_ID`: Voluum API access key ID (from Voluum → Settings → Security → Access Keys)
- `VOLUUM_ACCESS_KEY`: Voluum API access key secret
- `VOLUUM_API_BASE`: Worker proxy URL (e.g., `https://your-worker.workers.dev/api/voluum`)
- `LENDINGCARD_TOKEN`: LendingCards API token
- `LENDINGCARD_API`: `https://app.leadingcards.media/v1`
- `DAILY_BUDGET_LIMIT`: Daily budget limit in USD (e.g., `500`)
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TELEGRAM_CHAT_ID`: Target chat ID

## How It Works

### Step 1: Authenticate with Voluum

```bash
VOLUUM_TOKEN=$(curl -s -X POST "${VOLUUM_API_BASE}/session" \
  -H "Content-Type: application/json" \
  -d '{"accessId":"'${VOLUUM_ACCESS_ID}'","accessKey":"'${VOLUUM_ACCESS_KEY}'"}' \
  | jq -r '.token')
```

### Step 2: Fetch Today's Spend Report

```bash
TODAY=$(date -u +"%Y-%m-%dT00:00:00Z")
NOW=$(date -u +"%Y-%m-%dT%H:00:00Z")

curl -s "${VOLUUM_API_BASE}/report?from=${TODAY}&to=${NOW}&tz=UTC&groupBy=campaign&sort=cost&direction=desc&limit=100&columns=visits&columns=clicks&columns=conversions&columns=revenue&columns=cost&columns=profit&columns=roi&columns=cr" \
  -H "cwauth-token: ${VOLUUM_TOKEN}" \
  -H "Accept: application/json"
```

Response includes per-campaign:
- `cost` — ad spend
- `conversions` — lead count
- `revenue` — affiliate revenue
- `profit` — revenue - cost
- `roi` — return on investment %

### Step 3: Fetch LendingCards Fees

```bash
curl -s "${LENDINGCARD_API}/transactions?from_date=$(date +%Y-%m-%d)" \
  -H "Authorization: Token ${LENDINGCARD_TOKEN}"
```

Calculate real cost: `voluum_cost * 1.07 (VAT) * 1.035 (LC fee)`

### Step 4: Calculate Budget Usage

```
total_spend = sum(campaign.cost)
real_cost = total_spend * 1.07 * 1.035  # with VAT + LC fee
budget_pct = real_cost / DAILY_BUDGET_LIMIT * 100
```

### Step 5: Alert Based on Threshold

- **< 80%**: No alert (save for daily summary)
- **80-100%**: Warning message
- **> 100%**: Alert with recommendation to pause

## Message Format

### Daily Summary (9:00 AM Bangkok)
```
Daily Spend Report — Mar 21

Campaign              | Spend   | Conv | Rev    | ROI
Personal Loans Broad  | $156.20 |    8 | $320.00 | 105%
Quick Cash Exact      | $98.40  |    5 | $200.00 | 103%
Payday Search         | $67.30  |    3 | $120.00 |  78%
---
Voluum Total: $321.90
LC Fee (3.5%): $11.27
VAT (7%): $22.53
Real Cost: $355.70 / $500.00 (71.1%)

Conversions: 16 | Avg CPA: $22.23
Total Revenue: $640.00 | Net Profit: $284.30
```

### Budget Warning (>80%)
```
SPEND WARNING: 85% of daily budget

Real Cost: $425.50 / $500.00
  Voluum spend: $384.20
  LC fee: $13.45
  VAT: $26.89
Hours remaining: 6
Projected EOD: $580.00 (OVER)

Consider reducing bids on low-ROI campaigns.
```

### Budget Alert (>100%)
```
BUDGET EXCEEDED: $523.40 / $500.00 (104.7%)

Top spenders:
  1. Personal Loans Broad — $210.30 (ROI: 45%)
  2. Quick Cash Exact — $180.50 (ROI: 120%)

Recommend: Pause campaign #1 (low ROI, high spend)
```

## Cron Setup

```bash
# Budget check every 3 hours
openclaw cron add \
  --name "LP Spend Check" \
  --cron "0 */3 * * *" \
  --session isolated \
  --message "Fetch Voluum spend report and LendingCards fees for today. Calculate real cost with VAT+LC fees. Alert via Telegram if >80% of daily budget." \
  --announce --channel telegram

# Daily summary at 9 AM Bangkok
openclaw cron add \
  --name "LP Daily Spend Report" \
  --cron "0 9 * * *" \
  --tz "Asia/Bangkok" \
  --session isolated \
  --message "Generate full daily spend report from Voluum (per-campaign breakdown with cost, conversions, revenue, ROI) and LendingCards fees. Send summary via Telegram." \
  --announce --channel telegram
```

## Safety

- Read-only API queries (no campaign modifications)
- Does NOT auto-pause campaigns (alert only, human decides)
- Budget limit is configurable via env var
- Voluum token expires after ~24h — re-authenticate each check
