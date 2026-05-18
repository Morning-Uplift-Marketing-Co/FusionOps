# SCOUT — Competitor Ad Copy Intelligence

**Daily diff of competitor ad copy. Alerts on significant changes (new claims, pricing, CTAs).**

## Configuration

```yaml
schedule: "0 6 * * *"     # Daily 06:00 UTC
timezone: UTC
telegram_chat_id: ${SCOUT_TELEGRAM_CHAT_ID}
```

## Behavior

1. Query SERP/Google/Ads/Search/Live for competitor keywords
2. Extract ad copy (headline, description, display_url, final_url)
3. Compare vs yesterday's snapshot (stored in state)
4. On material change (>20% text diff, new CTA, new pricing claim):
   - Log diff to .hermes/scout-diffs.jsonl
   - Send Telegram notification with before/after
5. Update snapshot for tomorrow's comparison

## DataForSEO Endpoints

```
POST /v3/serp/google/ads/search/live/advanced
Body:
{
  "keywords": ["competitor_keyword1", "competitor_keyword2", ...],
  "location_code": 2840,
  "language_code": "en"
}

POST /v3/dataforseo_labs/google/competitors_domain/live
Body:
{
  "target": "competitor-site.com",
  "location_code": 2840
}
```

## Environment Variables

```
DATAFORSEO_LOGIN=${DATAFORSEO_LOGIN}
DATAFORSEO_PASSWORD=${DATAFORSEO_PASSWORD}
COMPETITOR_LIST=comp1.com,comp2.com,comp3.com
SCOUT_TELEGRAM_CHAT_ID=12345678
SCOUT_TELEGRAM_BOT_TOKEN=${SCOUT_TELEGRAM_BOT_TOKEN}
```

## Output

Daily diff sent to Telegram on material change:
```
📊 COMPETITOR AD COPY CHANGED

Competitor: comp1.com
Keyword: "personal loan online"

BEFORE:
Title: Get $5,000 Today
Desc: No credit check, instant approval

AFTER:
Title: Get $10,000 Today
Desc: Bad credit welcome, instant approval

Change Type: new_claim (credit_amount), new_feature (bad_credit_eligible)
```

## State

- `.hermes/scout-snapshots.json` — Latest ad copy snapshots by competitor
- `.hermes/scout-diffs.jsonl` — Change history (timestamp, competitor, keyword, change_type, before, after)
