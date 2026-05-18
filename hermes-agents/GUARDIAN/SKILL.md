# GUARDIAN — Bot Radar Sentinel

**Every 30 min: query bot visits, compute anomaly scores, alert on Google reviews.**

## Configuration

```yaml
schedule: "*/30 * * * *"   # Every 30 minutes
mode: verbose              # Telegram on every Google bot visit
```

## Behavior

1. Query `/api/bot-radar/summary` for last 30 min
2. For each new Google bot visit (googlebot|adsbot|mediapartners|inspection):
   - Send Telegram alert with site + bot_type + IP + UA
3. Compute `ban_correlation` per site:
   - `recent_bot_visits_1h` vs `avg_baseline_per_hour`
   - If ratio > 3x → anomaly_score = high
   - If site already "Warming" or "Limited" status → critical alert
4. POST results to `/api/bot-radar/correlate` (updates ban_correlation table)
5. Log to `~/.hermes/guardian-state/alerts.jsonl`

## Environment

```
API_WORKER_BASE=https://lp-factory-api.misty-feather-556e.workers.dev
API_WORKER_INTERNAL_TOKEN=...
GUARDIAN_TELEGRAM_CHAT_ID=...
GUARDIAN_TELEGRAM_BOT_TOKEN=...
```

## Output

Verbose mode — every Google review:

```
🤖 GOOGLE BOT REVIEW

Site: examplesite.com
Bot Type: adsbot
IP: 66.249.66.31 (verified ✓)
PTR: crawl-66-249-66-31.googlebot.com
ASN: AS15169 GOOGLE
UA: AdsBot-Google (+http://www.google.com/adsbot.html)
Score: 0.95 (high confidence)
Time: 2026-05-18T03:42:15Z
```

Critical alert — pre-ban detected:

```
🚨 PRE-BAN SIGNAL — examplesite.com

Status: warming → review_storm
Recent visits (1h): 47 vs baseline 12 (3.9x)
Bot types: adsbot (38), googlebot (9)
Anomaly score: 0.89 (CRITICAL)

⚠️ Site likely under manual review.
Check cloaking + compliance immediately.
```
