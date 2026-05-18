# Architecture — 4-Agent Trademark Monitoring

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    HERMES RUNTIME (NousResearch)                         │
│                                                                          │
│  ~/.hermes/skills/trademark-monitoring/                                 │
│  ├── AEGIS/          (Brand-jack detection)                             │
│  │   ├── SKILL.md    ← Hermes skill metadata                            │
│  │   └── run.py      ← Main detection logic                             │
│  │                                                                       │
│  ├── SCOUT/          (Competitor ad copy intel)                         │
│  │   ├── SKILL.md                                                       │
│  │   └── run.py                                                         │
│  │                                                                       │
│  ├── HERALD/         (Trend & reputation monitor)                       │
│  │   ├── SKILL.md                                                       │
│  │   └── run.py                                                         │
│  │                                                                       │
│  └── ORACLE/         (Keyword discovery)                                │
│      ├── SKILL.md                                                       │
│      └── run.py                                                         │
│                                                                          │
│  ~/.hermes/config.yaml                                                  │
│  └── crons:          (Schedule all 4 agents)                            │
│      ├── aegis-brand-jack         (every 2h)                            │
│      ├── scout-ad-copy            (daily 06:00)                         │
│      ├── herald-trends            (daily 08:00)                         │
│      └── oracle-keywords          (weekly Mon 09:00)                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                 │
                  ┌──────────────┼──────────────┐
                  ▼              ▼              ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ AEGIS        │ │ SCOUT        │ │ HERALD       │
        │ (every 2h)   │ │ (06:00 UTC)  │ │ (08:00 UTC)  │
        └──────────────┘ └──────────────┘ └──────────────┘
                  │              │              │
                  └──────────────┬──────────────┘
                                 ▼
        ┌────────────────────────────────────────┐
        │  DataForSEO Live API                   │
        │                                        │
        │  ├── SERP/Google/Ads/Advertisers      │
        │  ├── SERP/Google/Ads/Search           │
        │  ├── Labs/Google/Trends               │
        │  ├── Business Data/Trustpilot         │
        │  ├── Keywords Data/Google/Search Vol  │
        │  ├── Labs/Keyword Suggestions         │
        │  └── Labs/Search Intent               │
        └────────────────────────────────────────┘
                                 │
                                 ▼
        ┌────────────────────────────────────────────────┐
        │  ORACLE (weekly Mon 09:00)                     │
        │  Keyword Discovery + Filtering                │
        │                                                │
        │  ├── Trademark brand filtering                │
        │  ├── Commercial intent check                  │
        │  ├── Min search volume (100/mo)               │
        │  └── Brand protection filter                  │
        └────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
 ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
 │  Telegram   │  │  State Dir  │  │  Langfuse   │
 │  Alerts     │  │  (.jsonl)   │  │  Traces     │
 │  (optional) │  │  (optional) │  │  (optional) │
 └─────────────┘  └─────────────┘  └─────────────┘
```

## Data Flow

### AEGIS — Every 2 Hours

```
AEGIS (run.py)
  │
  ├─→ Query SERP/Google/Ads/Advertisers/Live
  │   Parameters: keywords=TRADEMARK_LIST, location_code=2840
  │
  ├─→ For each ad result:
  │   ├─→ Check domain in APPROVED_ADVERTISERS
  │   ├─→ Skip if in 24h dedup window
  │   └─→ If unauthorized: ALERT
  │
  ├─→ Send Telegram (if configured)
  │   └─→ Domain, ad title, URL, timestamp
  │
  └─→ Log to ~/.hermes/aegis-state/
      ├─→ alerts.jsonl (all alerts)
      └─→ seen.json (24h dedup window)
```

### SCOUT — Daily 06:00 UTC

```
SCOUT (run.py)
  │
  ├─→ For each competitor in COMPETITOR_LIST:
  │   │
  │   ├─→ Query SERP/Google/Ads/Search/Live
  │   │   (Search for competitor keywords)
  │   │
  │   ├─→ Extract ad copy:
  │   │   title, description, display_url, final_url
  │   │
  │   ├─→ Compare vs yesterday's snapshot:
  │   │   ├─→ Load previous ads from snapshots.json
  │   │   ├─→ Calculate text similarity (SequenceMatcher)
  │   │   └─→ If similarity <75%: MATERIAL CHANGE
  │   │
  │   ├─→ Send Telegram (if changed)
  │   │   └─→ Before/after headlines + descriptions
  │   │
  │   └─→ Update snapshot for tomorrow
  │
  └─→ Log to ~/.hermes/scout-state/
      ├─→ snapshots.json (latest ad copy by domain/keyword)
      └─→ diffs.jsonl (change history)
```

### HERALD — Daily 08:00 UTC

```
HERALD (run.py)
  │
  ├─→ For each competitor in COMPETITOR_LIST:
  │   │
  │   ├─→ Query Google Trends Explore
  │   │   └─→ Get search interest score
  │   │
  │   ├─→ Query Trustpilot Reviews
  │   │   ├─→ Get avg rating (stars)
  │   │   └─→ Count recent reviews
  │   │
  │   ├─→ Query CFPB Complaints API
  │   │   └─→ Count complaints (past 30d)
  │   │
  │   ├─→ Compare vs weekly baseline:
  │   │   ├─→ Trend +25pp? → TREND SURGE alert
  │   │   ├─→ Rating -0.5⭐? → REPUTATION DECLINE alert
  │   │   └─→ Complaints +50%? → COMPLAINT SPIKE alert
  │   │
  │   ├─→ Send Telegram alerts
  │   │
  │   └─→ Update baseline for next week
  │
  └─→ Log to ~/.hermes/herald-state/
      ├─→ baselines.json (weekly trend/rating/complaint baselines)
      └─→ alerts.jsonl (surge/decline events)
```

### ORACLE — Weekly Monday 09:00 UTC

```
ORACLE (run.py)
  │
  ├─→ Query Labs/Keyword Suggestions
  │   └─→ Base keywords: "personal loan", "bad credit loan", etc.
  │
  ├─→ Query Labs/Search Intent
  │   └─→ Classify each keyword (commercial/informational/transactional)
  │
  ├─→ Query Keywords Data/Search Volume
  │   └─→ Filter keywords with vol >100/month
  │
  ├─→ Query Google Autocomplete
  │   └─→ Get ranked suggestions for seed keywords
  │
  ├─→ Query Reddit API
  │   └─→ Search r/loans, r/personalfinance for brand mentions
  │
  ├─→ Apply filters:
  │   ├─→ Must contain trademark brand (exact or fuzzy)
  │   ├─→ Must have commercial intent (not informational)
  │   ├─→ Must have search vol ≥100/month
  │   ├─→ Exclude brand protection: scam, complaints, reddit, reviews
  │   └─→ Not in previous week's baseline
  │
  ├─→ Identify rising volume keywords
  │   └─→ Vol growth >30% vs 4 weeks ago
  │
  ├─→ Send Telegram weekly report
  │   ├─→ New keywords discovered
  │   ├─→ Rising volume keywords
  │   ├─→ Filtered out (reasons)
  │   └─→ Opportunity score (1-10)
  │
  └─→ Log to ~/.hermes/oracle-state/
      ├─→ keywords.jsonl (all discovered keywords + source)
      └─→ weekly_baseline.json (this week's baseline for dedup)
```

## State Management

Each agent maintains state in `~/.hermes/`:

### AEGIS State
```json
{
  "alerts.jsonl": [
    {
      "timestamp": "2026-05-17T14:32:00",
      "keyword": "trademark1",
      "domain": "badactor.com",
      "title": "Get $5000 Today",
      "url": "https://badactor.com/..."
    }
  ],
  "seen.json": {
    "trademark1:badactor.com": "2026-05-17T14:32:00"
  }
}
```

### SCOUT State
```json
{
  "snapshots.json": {
    "comp1.com:personal loan": {
      "timestamp": "2026-05-16T06:15:00",
      "ads_by_domain": {
        "comp1.com": [
          {
            "title": "Get $5,000 Today",
            "description": "No credit check",
            "url": "https://...",
            "position": 1
          }
        ]
      }
    }
  },
  "diffs.jsonl": [
    {
      "timestamp": "2026-05-17T06:15:00",
      "competitor": "comp1.com",
      "keyword": "personal loan",
      "before": { "title": "..." },
      "after": { "title": "..." }
    }
  ]
}
```

### HERALD State
```json
{
  "baselines.json": {
    "competitor1:trend": {
      "value": 45,
      "date": "2026-05-10T08:00:00"
    },
    "competitor1:rating": {
      "value": 4.5,
      "date": "2026-05-10T08:00:00"
    }
  },
  "alerts.jsonl": [
    {
      "timestamp": "2026-05-17T08:15:00",
      "type": "trend_surge",
      "details": {
        "competitor": "competitor1",
        "increase": 28,
        "prev_value": 45,
        "curr_value": 73
      }
    }
  ]
}
```

### ORACLE State
```json
{
  "keywords.jsonl": [
    {
      "timestamp": "2026-05-17T09:30:00",
      "keyword": "trademark1 bad credit",
      "search_volume": 2100,
      "intent": "commercial",
      "source": "suggestion",
      "filtered_reason": null
    }
  ],
  "weekly_baseline.json": {
    "timestamp": "2026-05-17T09:30:00",
    "keywords": ["trademark1 bad credit", "trademark1 no credit check", ...]
  }
}
```

## Configuration

### Environment Variables (.env)

```bash
# DataForSEO credentials (required)
DATAFORSEO_LOGIN=user@example.com
DATAFORSEO_PASSWORD=password

# Lists (required)
TRADEMARK_LIST=brand1,brand2
COMPETITOR_LIST=comp1.com,comp2.com
APPROVED_ADVERTISERS=oursite.com

# Telegram alerts (optional)
AEGIS_TELEGRAM_CHAT_ID=123...
AEGIS_TELEGRAM_BOT_TOKEN=456...
SCOUT_TELEGRAM_CHAT_ID=...
SCOUT_TELEGRAM_BOT_TOKEN=...
HERALD_TELEGRAM_CHAT_ID=...
HERALD_TELEGRAM_BOT_TOKEN=...
ORACLE_TELEGRAM_CHAT_ID=...
ORACLE_TELEGRAM_BOT_TOKEN=...
```

### Hermes Config (crons in ~/.hermes/config.yaml)

```yaml
crons:
  aegis-brand-jack:
    schedule: "0 */2 * * *"        # Every 2 hours
    skill: "trademark-monitoring/aegis"
    enabled: true
    env_file: /path/to/.env

  scout-ad-copy:
    schedule: "0 6 * * *"          # Daily 06:00
    skill: "trademark-monitoring/scout"
    enabled: true
    env_file: /path/to/.env

  herald-trends:
    schedule: "0 8 * * *"          # Daily 08:00
    skill: "trademark-monitoring/herald"
    enabled: true
    env_file: /path/to/.env

  oracle-keywords:
    schedule: "0 9 * * 1"          # Weekly Mon 09:00
    skill: "trademark-monitoring/oracle"
    enabled: true
    env_file: /path/to/.env
```

## Integration with Observability Stack

### Langfuse + LiteLLM (Optional)

If you've deployed Langfuse v3 + LiteLLM proxy, each agent execution creates a trace:

```
Hermes config.yaml:
  model:
    provider: "openrouter"
    base_url: "http://localhost:4000/v1"    # LiteLLM proxy
    model: "claude-3-5-sonnet"
    api_key: ${OPENROUTER_API_KEY}
```

Each agent run creates a Langfuse trace:
- Input: Agent name, parameters
- Output: Alerts count, state updates
- Tokens: Token counts for observability
- Cost: Aggregated in Langfuse analytics

View in Langfuse UI:
```
http://178.105.137.23:3030
→ Project → Traces
→ Filter by agent (AEGIS, SCOUT, etc.)
→ View token counts + costs
```

## Scaling Considerations

### API Rate Limits

- **DataForSEO**: 1000 req/month free tier, ~290 req/month used (~29% utilization)
- **Telegram**: Unlimited (but respect rate limit: ~30 msg/sec per chat)
- **Google Trends**: Part of DataForSEO
- **CFPB API**: Unlimited (public)
- **Reddit API**: 60 req/min (not a bottleneck)

### Performance

- **AEGIS**: ~2s per run (1 API call for all keywords)
- **SCOUT**: ~3s per run (5-10 competitor keywords)
- **HERALD**: ~5s per run (4 API sources × competitors)
- **ORACLE**: ~10s per run (Keyword discovery + filtering)

Total: ~20s of execution per 2 hours + daily + weekly = negligible CPU impact

### Storage

- **State files**: ~50 KB/month per agent
- **Alert logs**: ~500 KB/month if 10 alerts/day
- **Keywords baseline**: ~100 KB/year

Total: <10 MB/year storage

## Error Handling

Each agent handles errors gracefully:

1. **API failures** → Log to agent.log, retry on next run
2. **Missing .env** → Exit with helpful error message
3. **Telegram not configured** → Log locally only
4. **Malformed responses** → Skip entry, continue processing
5. **Rate limits** → Exponential backoff (optional future enhancement)

## Next: Enhanced Features

Potential future improvements:

1. **Multi-language support** — Keywords in Spanish, French, etc.
2. **Mobile app keyword monitoring** — iOS/Android app store optimization
3. **Social media mentions** — Twitter, TikTok, Instagram brand mentions
4. **Domain registration tracking** — New domains registering with trademark brands
5. **Email intelligence** — Phishing emails using trademark brands
6. **SMS monitoring** — Unauthorized SMS campaigns
7. **LinkedIn job posting monitoring** — Competitor hiring signals
