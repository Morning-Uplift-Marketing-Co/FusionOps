# AEGIS — Brand-Jack Detection

**Monitors unauthorized trademark keyword advertising in Google Ads. Alerts on first appearance.**

## Configuration

```yaml
schedule: "*/2 * * * *"  # Every 2 hours
telegram_chat_id: ${AEGIS_TELEGRAM_CHAT_ID}
```

## Behavior

1. Query SERP/Google/Ads/Advertisers/Live for each trademark keyword
2. Check if advertiser domain is in APPROVED_ADVERTISERS list
3. On first unauthorized appearance:
   - Log alert in .hermes/aegis-alerts.jsonl
   - Send Telegram notification with advertiser, domain, ad copy snippet
   - Record timestamp for deduplication (24h window)

## DataForSEO Endpoint

```
POST /v3/serp/google/ads/advertisers/live/advanced
Body:
{
  "keywords": ["trademark1", "trademark2", ...],
  "location_code": 2840,  # United States
  "language_code": "en"
}
```

## Environment Variables

```
DATAFORSEO_LOGIN=${DATAFORSEO_LOGIN}
DATAFORSEO_PASSWORD=${DATAFORSEO_PASSWORD}
APPROVED_ADVERTISERS=our-site.com,partner1.com,partner2.com
AEGIS_TELEGRAM_CHAT_ID=12345678
AEGIS_TELEGRAM_BOT_TOKEN=${AEGIS_TELEGRAM_BOT_TOKEN}
TRADEMARK_LIST=trademark1,trademark2,trademark3
```

## Output

Alert sent to Telegram on new unauthorized advertiser:
```
⚠️ BRAND JACK DETECTED

Trademark: "trademark1"
Advertiser: badactor.com
Ad Title: [ad title]
Ad URL: https://badactor.com/...
Time: 2026-05-17 14:32:00 UTC
```

## State

- `.hermes/aegis-alerts.jsonl` — Daily alerts log (dedup key: `{keyword}:{domain}:date`)
- `.hermes/aegis-seen.json` — 24h dedup window
