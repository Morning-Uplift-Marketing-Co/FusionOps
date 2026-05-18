# 4-Agent Trademark Keyword Monitoring Team

Autonomous Hermes agents for continuous trademark brand protection and keyword discovery using DataForSEO Live API.

## Team Overview

| Agent | Function | Schedule | Alert |
|-------|----------|----------|-------|
| **AEGIS** | Brand-jack detection in Google Ads | Every 2 hours | Unauthorized advertiser |
| **SCOUT** | Competitor ad copy intelligence | Daily 06:00 UTC | Material ad copy change |
| **HERALD** | Trend surge & reputation monitoring | Daily 08:00 UTC | Competitor trend spike, reputation drop |
| **ORACLE** | New trademark keyword discovery | Weekly Monday 09:00 | Commercial intent keywords, rising volume |

## Prerequisites

- Hermes Agent runtime (NousResearch/hermes-agent) installed
- DataForSEO API credentials ([get here](https://app.dataforseo.com/))
- Python 3.8+ with requests library
- (Optional) Telegram bot for alerts ([BotFather](https://t.me/BotFather))
- (Optional) Langfuse v3 + LiteLLM proxy for observability

## Quick Start

### 1. Clone and Configure

```bash
# Copy agent directory to your workspace
cp -r hermes-agents ~/fusionops/agents/

cd ~/fusionops/agents/

# Create .env from template
cp .env.example .env

# Edit with your credentials
nano .env
# Set: DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, TRADEMARK_LIST, COMPETITOR_LIST, Telegram tokens
```

### 2. Install Agent Skills

```bash
# Create Hermes skills directory
mkdir -p ~/.hermes/skills/trademark-monitoring

# Copy all 4 agent skills
cp -r AEGIS SCOUT HERALD ORACLE ~/.hermes/skills/trademark-monitoring/

# Verify
hermes skills list | grep trademark
# Should show: trademark-monitoring/aegis, trademark-monitoring/scout, etc.
```

### 3. Add Crons to Hermes Config

```bash
# Edit Hermes config
nano ~/.hermes/config.yaml

# Add this section (from HERMES_CONFIG.yaml):
crons:
  aegis-brand-jack:
    schedule: "0 */2 * * *"
    skill: "trademark-monitoring/aegis"
    enabled: true
    env_file: ~/fusionops/agents/.env

  scout-ad-copy:
    schedule: "0 6 * * *"
    skill: "trademark-monitoring/scout"
    enabled: true
    env_file: ~/fusionops/agents/.env

  herald-trends:
    schedule: "0 8 * * *"
    skill: "trademark-monitoring/herald"
    enabled: true
    env_file: ~/fusionops/agents/.env

  oracle-keywords:
    schedule: "0 9 * * 1"
    skill: "trademark-monitoring/oracle"
    enabled: true
    env_file: ~/fusionops/agents/.env
```

### 4. Test One Agent

```bash
# Test AEGIS manually
cd ~/fusionops/agents
source .env
python AEGIS/run.py

# Should output:
# 2026-05-17 10:30:45 [AEGIS] Starting brand-jack detection for 3 keywords
# 2026-05-17 10:30:47 [AEGIS] Brand-jack detection complete: 0 new alerts
```

### 5. Start Hermes with Agents

```bash
# Restart Hermes to pick up new crons
systemctl restart hermes

# Monitor logs
tail -f ~/.hermes/hermes.log | grep "trademark"
```

### 6. (Optional) Wire Observability

If you've deployed Langfuse + LiteLLM proxy:

```bash
# Edit ~/.hermes/config.yaml
model:
  provider: "openrouter"
  base_url: "http://localhost:4000/v1"    # LiteLLM proxy
  model: "claude-3-5-sonnet"
  api_key: ${OPENROUTER_API_KEY}

# Restart Hermes
systemctl restart hermes

# View traces in Langfuse
# http://178.105.137.23:3030 → Project → Traces
```

## Agent Behavior

### AEGIS — Brand-Jack Detection

**What**: Polls SERP Google Ads Advertisers Live every 2 hours
**Filters**: Trademark keywords → Only look for unauthorized advertiser domains
**Alerts**: First appearance of domain not in APPROVED_ADVERTISERS list
**Output**: Telegram alert + .jsonl log in `~/.hermes/aegis-state/`

```
⚠️ BRAND JACK DETECTED
Trademark: trademark1
Advertiser Domain: badactor.com
Ad Title: Get $5000 Today
Ad URL: https://badactor.com/...
Time: 2026-05-17 14:32:00 UTC
```

---

### SCOUT — Competitor Ad Copy Intelligence

**What**: Daily diff of competitor ad copy (headlines, descriptions, URLs)
**Compares**: Yesterday's snapshot vs today's live ads
**Alerts**: Material text change (>25% diff) detected
**Output**: Before/after ad copy to Telegram + .jsonl log

```
📊 COMPETITOR AD COPY CHANGED
Competitor: comp1.com
Keyword: personal loan online

BEFORE:
Title: Get $5,000 Today
Desc: No credit check, instant approval

AFTER:
Title: Get $10,000 Today
Desc: Bad credit welcome, instant approval
```

---

### HERALD — Trend & Reputation Monitor

**What**: Daily monitoring of 4 data sources
- Google Trends search interest
- Trustpilot reviews & rating
- CFPB complaint database
- BBB rating (optional scrape)

**Alerts**:
- Trend surge (+25 percentage points)
- Reputation decline (-0.5 stars)
- Complaint spike (+50% vs baseline)

**Output**: Telegram alert + .jsonl log

```
📈 COMPETITOR TREND SURGE
Competitor: "competitor1"
Trend Increase: 28 points (45 → 73)
Period: Last 7 days

🔴 REPUTATION DECLINE
Competitor: comp2.com
Rating: 4.5⭐ → 3.8⭐ (-0.7 points)
Recent Reviews: 12 (past 7 days)
Complaint Surge: 18 CFPB complaints
```

---

### ORACLE — Keyword Discovery

**What**: Weekly discovery of new trademark keyword variants
**Sources**:
- DataForSEO Labs: Keyword Suggestions, Ideas, Search Intent, Historical
- Google Autocomplete
- Reddit mentions (r/loans, r/personalfinance)

**Filters**:
- Must contain trademark brand
- Must have commercial/transactional intent
- Must have search volume >100/month
- Exclude brand protection terms (scam, complaint, reddit, reviews)

**Output**: Weekly Telegram report + .jsonl log

```
🔮 KEYWORD DISCOVERY REPORT
Period: 2026-05-10 to 2026-05-17
New Keywords: 7

NEW VARIANTS (Commercial Intent):
1. "trademark1 + bad credit" (Vol: 2,100/mo, Intent: Commercial)
2. "trademark1 no credit check" (Vol: 1,800/mo, Intent: Commercial)
3. "trademark1 3000" (Vol: 650/mo, Intent: Transactional)

RISING VOLUME:
- "trademark1 for bad credit" (800 → 1,200/mo, +50%)
```

## State Files

Agents maintain state in `~/.hermes/`:

```
~/.hermes/
├── aegis-state/
│   ├── alerts.jsonl          # All brand-jack alerts
│   └── seen.json             # 24h dedup window
├── scout-state/
│   ├── snapshots.json        # Previous ad copy by domain
│   └── diffs.jsonl           # Ad copy change history
├── herald-state/
│   ├── baselines.json        # Weekly trend/rating baseline
│   └── alerts.jsonl          # Trend/reputation alerts
└── oracle-state/
    ├── keywords.jsonl        # All discovered keywords
    └── weekly_baseline.json  # Previous week (dedup + volume comparison)
```

## Configuration

### Required Environment Variables

```bash
DATAFORSEO_LOGIN=your_email@example.com
DATAFORSEO_PASSWORD=your_password
TRADEMARK_LIST=brand1,brand2,brand3
COMPETITOR_LIST=comp1.com,comp2.com
APPROVED_ADVERTISERS=oursite.com,partner.com
```

### Optional Telegram Alerts

```bash
AEGIS_TELEGRAM_CHAT_ID=123456789
AEGIS_TELEGRAM_BOT_TOKEN=1234567890:ABCdefghijklmnop
SCOUT_TELEGRAM_CHAT_ID=123456789
SCOUT_TELEGRAM_BOT_TOKEN=...
HERALD_TELEGRAM_CHAT_ID=123456789
HERALD_TELEGRAM_BOT_TOKEN=...
ORACLE_TELEGRAM_CHAT_ID=123456789
ORACLE_TELEGRAM_BOT_TOKEN=...
```

**Note**: If Telegram is not configured, alerts are still logged to .jsonl files.

## Troubleshooting

### "skills not found" in Hermes

```bash
# Verify directory structure
ls -la ~/.hermes/skills/trademark-monitoring/
# Should show: AEGIS/ SCOUT/ HERALD/ ORACLE/

# Verify each has SKILL.md and run.py
ls -la ~/.hermes/skills/trademark-monitoring/AEGIS/
# Should show: SKILL.md, run.py

# Refresh skill cache
hermes skills refresh
hermes skills list | grep trademark
```

### Agent runs but no alerts

1. **Check .env is sourced**:
   ```bash
   source ~/fusionops/agents/.env
   echo $DATAFORSEO_LOGIN
   ```

2. **Test API credentials**:
   ```bash
   curl -u $DATAFORSEO_LOGIN:$DATAFORSEO_PASSWORD \
     https://api.dataforseo.com/v3/serp/google/ads/advertisers/live/advanced
   ```

3. **Check state directory exists**:
   ```bash
   ls -la ~/.hermes/aegis-state/
   # Should have alerts.jsonl and seen.json
   ```

4. **View agent logs**:
   ```bash
   tail -100 ~/.hermes/hermes.log | grep AEGIS
   ```

### Telegram alerts not sending

1. **Verify bot token**:
   ```bash
   curl https://api.telegram.org/bot$AEGIS_TELEGRAM_BOT_TOKEN/getMe
   ```

2. **Verify chat ID**:
   ```bash
   # Send a message manually to ensure chat exists
   curl -X POST https://api.telegram.org/bot$AEGIS_TELEGRAM_BOT_TOKEN/sendMessage \
     -d chat_id=$AEGIS_TELEGRAM_CHAT_ID \
     -d text="Test message"
   ```

3. **Check agent logs for Telegram errors**:
   ```bash
   tail -f ~/.hermes/hermes.log | grep "Telegram"
   ```

### DataForSEO API rate limits

Each agent respects DataForSEO's rate limits (1000 requests/month on free tier):

- AEGIS: ~60/month (30 keywords × 2x daily)
- SCOUT: ~30/month (assume 5 keywords per competitor)
- HERALD: ~150/month (3 sources × 5 competitors × daily)
- ORACLE: ~50/month (weekly discovery)
- **Total**: ~290/month (well under limits)

If you hit limits, upgrade your DataForSEO plan or adjust schedules.

## Performance & Cost

### DataForSEO API Usage

- **AEGIS**: ~2 calls/hour × 24h = ~1.4k calls/month
- **SCOUT**: ~5 calls/day × 30 = ~150 calls/month
- **HERALD**: ~10 calls/day × 30 = ~300 calls/month
- **ORACLE**: ~50 calls/week × 4 = ~200 calls/month
- **Total**: ~1.85k calls/month (~$9-15 on DataForSEO Pro plan)

### Langfuse Observability (Optional)

If wired to LiteLLM proxy + Langfuse:
- Each agent execution = 1 Langfuse trace
- 4 agents × ~7 executions/day = ~28 traces/day = ~840/month
- Cost: Included in Langfuse v3 self-hosted (free)

## Integration with FusionOps Stack

### Clawmetry Dashboard

If you're using ClawMetry observability:
```bash
# View agent runs and session state
http://localhost:8900
# Look for "trademark-monitoring" crons and skill sessions
```

### Langfuse + LiteLLM

If you've deployed Langfuse v3 + LiteLLM proxy:
```bash
# View token/cost tracking for all agents
http://178.105.137.23:3030
# Project → Analytics → Model Costs
```

## Next Steps

1. **Deploy agents** — Follow Quick Start above
2. **Monitor first week** — Adjust trademark/competitor lists based on initial results
3. **Tune thresholds** — HERALD trend threshold (25pp), SCOUT similarity (75%), etc.
4. **Add to dashboard** — Create ClawMetry or Grafana dashboard to visualize alerts
5. **Expand data sources** — Add LinkedIn job postings, domain registration monitoring, etc.

## Support

- Agent logs: `tail -f ~/.hermes/hermes.log | grep -E "AEGIS|SCOUT|HERALD|ORACLE"`
- State files: `~/.hermes/{aegis,scout,herald,oracle}-state/`
- DataForSEO API docs: https://docs.dataforseo.com/
- Hermes docs: [Check with your Hermes version]
