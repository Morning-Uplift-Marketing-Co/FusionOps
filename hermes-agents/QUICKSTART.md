# Quick Start — 4-Agent Trademark Monitoring

**5-minute setup for Hermes + 4 trademark agents.**

## 1️⃣ Configure Credentials (2 min)

```bash
cd hermes-agents
cp .env.example .env
nano .env
```

Fill in:
- `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` — [get here](https://app.dataforseo.com/)
- `TRADEMARK_LIST` — e.g., `loanstart,fastcash,quickbucks`
- `COMPETITOR_LIST` — e.g., `lendify.com,creditmax.com`
- `APPROVED_ADVERTISERS` — Your domains only
- (Optional) Telegram bot tokens from [BotFather](https://t.me/BotFather)

## 2️⃣ Install Agent Skills (1 min)

```bash
mkdir -p ~/.hermes/skills/trademark-monitoring
cp -r AEGIS SCOUT HERALD ORACLE ~/.hermes/skills/trademark-monitoring/
```

Verify:
```bash
hermes skills list | grep trademark
# Should show: trademark-monitoring/aegis, scout, herald, oracle
```

## 3️⃣ Add Crons to Hermes (1 min)

```bash
nano ~/.hermes/config.yaml
```

Copy this section (from `HERMES_CONFIG.yaml`):

```yaml
crons:
  aegis-brand-jack:
    schedule: "0 */2 * * *"
    skill: "trademark-monitoring/aegis"
    enabled: true
    env_file: /full/path/to/hermes-agents/.env

  scout-ad-copy:
    schedule: "0 6 * * *"
    skill: "trademark-monitoring/scout"
    enabled: true
    env_file: /full/path/to/hermes-agents/.env

  herald-trends:
    schedule: "0 8 * * *"
    skill: "trademark-monitoring/herald"
    enabled: true
    env_file: /full/path/to/hermes-agents/.env

  oracle-keywords:
    schedule: "0 9 * * 1"
    skill: "trademark-monitoring/oracle"
    enabled: true
    env_file: /full/path/to/hermes-agents/.env
```

**Important**: Change `/full/path/to/hermes-agents/.env` to your actual path (use `pwd` to get it).

## 4️⃣ Test One Agent (1 min)

```bash
cd hermes-agents
source .env
python3 AEGIS/run.py
```

Expected output:
```
2026-05-17 10:30:45 [AEGIS] Starting brand-jack detection for 3 keywords
2026-05-17 10:30:47 [AEGIS] Brand-jack detection complete: 0 new alerts
```

## 5️⃣ Start Hermes (instant)

```bash
systemctl restart hermes
```

Monitor:
```bash
tail -f ~/.hermes/hermes.log | grep "trademark\|AEGIS\|SCOUT\|HERALD\|ORACLE"
```

## Done! ✅

Your 4 agents are now running:

| Agent | Schedule | Checks |
|-------|----------|--------|
| **AEGIS** | Every 2h | Unauthorized ads on trademark keywords |
| **SCOUT** | Daily 06:00 UTC | Competitor ad copy changes |
| **HERALD** | Daily 08:00 UTC | Competitor trend spikes & reputation drops |
| **ORACLE** | Weekly Mon 09:00 | New commercial intent keywords |

## View Results

- **Alerts**: `~/.hermes/{aegis,scout,herald,oracle}-state/alerts.jsonl`
- **Logs**: `tail -f ~/.hermes/hermes.log`
- **Telegram** (if configured): Messages in your configured chat

## Troubleshooting

### Skills not found?
```bash
ls -la ~/.hermes/skills/trademark-monitoring/
# Should show: AEGIS/ SCOUT/ HERALD/ ORACLE/ directories
```

### Agent runs but no output?
```bash
# Verify .env is sourced:
source hermes-agents/.env
echo $DATAFORSEO_LOGIN  # Should print your email

# Test API manually:
curl -u $DATAFORSEO_LOGIN:$DATAFORSEO_PASSWORD \
  https://api.dataforseo.com/v3/serp/google/ads/advertisers/live/advanced \
  -H 'Content-Type: application/json' \
  -d '{"keywords": ["test"], "location_code": 2840}' | head -20
```

### Hermes won't restart?
```bash
# Check syntax of config.yaml
hermes config validate

# View Hermes logs
journalctl -u hermes -n 50 --no-pager
```

---

## Optional: Wire Observability

If you've deployed **Langfuse + LiteLLM proxy**, add this to `~/.hermes/config.yaml`:

```yaml
model:
  provider: "openrouter"
  base_url: "http://localhost:4000/v1"    # LiteLLM proxy
  model: "claude-3-5-sonnet"
  api_key: ${OPENROUTER_API_KEY}
```

Then restart Hermes and view traces in Langfuse:
```
http://178.105.137.23:3030 → Project → Traces
```

---

**Need help?** See full README.md in this directory.
