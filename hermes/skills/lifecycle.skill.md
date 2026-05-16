# Lifecycle Manager Agent

## Role
Monitor account lifecycle states, evaluate pause rules, and take automated actions.
Run every 6 hours. Also triggered on-demand when VERDICT flags risk_score ≥ 55.

## Tools Required
- `fbis` MCP (lifecycle tools: list_lifecycle_accounts, evaluate_pause_rules,
  transition_account, record_spend_snapshot, get_budget_recommendation,
  upsert_creative_performance, get_fatigued_creatives)
- `mem0` MCP (store yesterday's metrics for delta calculation)
- Telegram (send alerts via TELEGRAM_HOME_CHANNEL)

## Workflow

### Step 1 — Load Active Accounts
```
list_lifecycle_accounts()
```
Filter to accounts where lifecycle_state IN (warming, active, resting).

### Step 2 — For Each Active Account

#### 2a. Pull Today's Metrics (from mem0 or ads-reporter output)
Load stored metrics:
- today_spend, budget_cap, conversions_today, prev_conversions
- risk_score (from VERDICT output stored in mem0)
- top creative: impressions_7d, clicks_7d, ctr_7d, ctr_prev, conv_7d, conv_prev

#### 2b. Record Spend Snapshot
```
record_spend_snapshot(
  account_id=id,
  spend=today_spend,
  budget=budget_cap,
  conversions=conversions_today,
  risk_score=risk_score
)
```

#### 2c. Evaluate Pause Rules
```
conv_drop_pct = max(0, (prev_conversions - conversions_today) / prev_conversions * 100)
spend_pct = (today_spend / budget_cap) * 100

evaluate_pause_rules(
  account_id=id,
  risk_score=risk_score,
  spend_pct=spend_pct,
  conv_drop_pct=conv_drop_pct,
)
```

If actions triggered:
- `pause` action → transition_account(id, 'suspended', reason, 'lifecycle-agent', risk_score)
- `reduce_budget` action → send Telegram alert with recommendation
- `alert` action → include in Telegram summary

#### 2d. Budget Recommendation
```
get_budget_recommendation(account_id=id)
```
If recommendation returned, append to Telegram report.

#### 2e. Creative Fatigue
For each known creative:
```
upsert_creative_performance(
  account_id=id,
  ad_id=ad_id,
  ctr_delta=(ctr_7d - ctr_prev) / ctr_prev,
  conv_delta=(conv_7d - conv_prev) / conv_prev,
  ...
)
```
Then:
```
get_fatigued_creatives(account_id=id, min_score=70)
```
Flag fatigued creatives in report.

### Step 3 — Lifecycle State Promotion (warming → active)
For accounts in `warming` state:
- If warming_day >= 7 AND risk_score < 40 AND consecutive_safe_days >= 3:
  ```
  transition_account(id, 'active', 'Warming complete — safe to scale', 'lifecycle-agent')
  ```

### Step 4 — Send Telegram Summary
```
🔄 FusionOps Lifecycle Report — {date}

⚡ Active: N accounts | Warming: N | Resting: N | Suspended: N

🚨 Actions Taken:
  • [account] → suspended (risk_score=85)
  • [account] → active (warming complete, day 7)

⚠️ Alerts:
  • [account] overspend 118% of budget
  • [account] conv drop 35%
  • [account] creative fatigue score=72 (ad: "...")

💰 Budget Recommendations:
  • [account]: reduce $500→$250 (risk_high)
  • [account]: scale $300→$345 (underutilized)

Full dashboard: https://fusionops-web.pages.dev/risk-dashboard
```

## Cron Schedule
```
# Every 6 hours
0 */6 * * * run lifecycle
```

## Error Handling
- API timeout → retry once, log to mem0, report partial
- State transition rejected → log reason, skip account
- No metrics available → skip account, note in report
