# ORACLE — Keyword Discovery

**Weekly discovery of new trademark keyword variants. Filters to commercial intent only.**

## Configuration

```yaml
schedule: "0 9 * * 1"     # Weekly Monday 09:00 UTC
timezone: UTC
telegram_chat_id: ${ORACLE_TELEGRAM_CHAT_ID}
```

## Behavior

1. For each brand in TRADEMARK_LIST:
   - Query Labs/Keyword Suggestions
   - Query Labs/Keyword Ideas
   - Query Search Intent analysis
   - Query Historical Keyword Data
   - Fetch Google Autocomplete suggestions
   - Fetch Reddit mentions (r/personalfinance, r/loans, etc.)
2. Filter results:
   - Must mention brand (exact or fuzzy match)
   - Must have commercial intent (intent classifier: "commercial" or "transactional")
   - Must have search volume > 100/month
   - Remove brand protection terms (e.g., "[brand] scam", "[brand] complaints", "[brand] reddit", "[brand] reviews")
3. Compare vs previous week's discoveries:
   - New variants → prioritize
   - Rising search volume → flag
4. Output weekly report: new keywords, search volume, intent, opportunity score

## DataForSEO Endpoints

```
POST /v3/dataforseo_labs/google/keyword_suggestions/live
Body:
{
  "keywords": ["personal loan", "installment loan", "payday loan"],
  "location_code": 2840,
  "search_partners": true
}

POST /v3/dataforseo_labs/google/keyword_ideas/live
Body:
{
  "keywords": ["personal loan", "installment loan"],
  "location_code": 2840
}

POST /v3/dataforseo_labs/google/search_intent/live
Body:
{
  "keywords": ["new_keyword_variant1", "new_keyword_variant2"]
}

POST /v3/keywords_data/google/search_volume/live
Body:
{
  "keywords": ["new_keyword_variant1", "new_keyword_variant2"],
  "location_code": 2840
}

POST /v3/keywords_data/google/historical_search_volume/live
Body:
{
  "keywords": ["new_keyword_variant1"],
  "location_code": 2840,
  "year": 2026,
  "month": 5
}
```

## External APIs

```
Google Autocomplete: GET https://www.google.com/complete/search?q=trademark&client=firefox
  → Parse JSON responses array for suggestions

Reddit: GET https://www.reddit.com/r/personalfinance/search.json?q=trademark&limit=100
        GET https://www.reddit.com/r/loans/search.json?q=trademark&limit=100
  → Parse JSON for post titles mentioning brand
```

## Environment Variables

```
DATAFORSEO_LOGIN=${DATAFORSEO_LOGIN}
DATAFORSEO_PASSWORD=${DATAFORSEO_PASSWORD}
TRADEMARK_LIST=trademark1,trademark2,trademark3
ORACLE_TELEGRAM_CHAT_ID=12345678
ORACLE_TELEGRAM_BOT_TOKEN=${ORACLE_TELEGRAM_BOT_TOKEN}
```

## Output

Weekly report sent to Telegram:
```
🔮 KEYWORD DISCOVERY REPORT

Period: 2026-05-10 to 2026-05-17
New Keywords: 7

NEW VARIANTS (Commercial Intent):
1. "trademark1 + bad credit" (Search Vol: 2,100/mo, Intent: Commercial)
2. "trademark1 no credit check" (Search Vol: 1,800/mo, Intent: Commercial)
3. "trademark1 3000" (Search Vol: 650/mo, Intent: Transactional)

RISING VOLUME:
- "trademark1 for bad credit" (Prev: 800 → Now: 1,200/mo, +50%)

FILTERED OUT (Brand Protection):
- "trademark1 scam", "trademark1 reddit", "trademark1 reviews" (brand protection)
- "trademark2 installment loan" (Intent: Informational, Vol: 150/mo)

Opportunity Score: 8.5/10 (high commercial intent keywords with growth trend)
```

## State

- `.hermes/oracle-keywords.jsonl` — All discovered keywords (date, keyword, volume, intent, source, filtered_out_reason)
- `.hermes/oracle-weekly-baseline.json` — Previous week's keywords for dedup + volume comparison
