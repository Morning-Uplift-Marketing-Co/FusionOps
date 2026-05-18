# HERALD — Trend & Reputation Monitor

**Daily polls for competitor trend surge and reputation changes. Alerts on material shifts.**

## Configuration

```yaml
schedule: "0 8 * * *"     # Daily 08:00 UTC
timezone: UTC
telegram_chat_id: ${HERALD_TELEGRAM_CHAT_ID}
alert_threshold_trend: 25  # Percentage point increase
alert_threshold_reviews: -0.5  # Rating drop of 0.5+ stars
```

## Behavior

1. **Google Trends**: Query search interest trend for competitor brands
2. **Trustpilot**: Fetch recent reviews, calculate avg rating + review count
3. **CFPB Complaints**: Search complaints mentioning competitor, count past 30 days
4. **BBB**: Scrape rating + complaint count
5. Compare vs baseline (weekly avg):
   - If trend +25pp → Alert "Competitor surge"
   - If reviews drop -0.5+ stars → Alert "Reputation decline"
   - If CFPB complaints +50% → Alert "Complaint surge"
6. Update baseline for next week

## DataForSEO Endpoints

```
POST /v3/dataforseo_labs/google/trends_explore/live
Body:
{
  "keywords": ["competitor1", "competitor2"],
  "location_code": 2840,
  "language_code": "en"
}

POST /v3/business_data/trustpilot/reviews/search/live
Body:
{
  "query": "competitor-name",
  "limit": 100
}
```

## External APIs

```
CFPB Complaints: GET https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?search=competitor&field_complaint=all&date_received_min=2026-04-17

BBB: Scrape https://www.bbb.org/search?find_country=USA&find_text=competitor-name
```

## Environment Variables

```
DATAFORSEO_LOGIN=${DATAFORSEO_LOGIN}
DATAFORSEO_PASSWORD=${DATAFORSEO_PASSWORD}
COMPETITOR_LIST=comp1,comp2,comp3
HERALD_TELEGRAM_CHAT_ID=12345678
HERALD_TELEGRAM_BOT_TOKEN=${HERALD_TELEGRAM_BOT_TOKEN}
```

## Output

Alerts sent to Telegram on material shifts:
```
📈 COMPETITOR TREND SURGE

Competitor: "competitor1"
Trend Increase: 28 percentage points (baseline 45 → current 73)
Period: Last 7 days
Region: United States

🔴 REPUTATION DECLINE

Competitor: comp2.com (Trustpilot)
Rating: 4.5 ⭐ → 3.8 ⭐ (-0.7 points)
Recent Reviews: 12 (past 7 days, avg 3.2 stars)
Complaint Surge: 18 CFPB complaints (past 30 days)
```

## State

- `.hermes/herald-baselines.json` — Weekly trend/rating/complaint baseline
- `.hermes/herald-alerts.jsonl` — Alert history (timestamp, competitor, alert_type, metric_before, metric_after)
