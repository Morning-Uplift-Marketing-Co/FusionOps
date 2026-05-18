# Deployment Checklist — 4-Agent Trademark Monitoring

Use this checklist to deploy the agents to production on Hetzner.

## Pre-Deployment (Local)

- [ ] Read QUICKSTART.md (5 min)
- [ ] Read README.md (10 min)
- [ ] Review ARCHITECTURE.md to understand data flow
- [ ] Verify you have DataForSEO API credentials
- [ ] (Optional) Get Telegram bot tokens from [BotFather](https://t.me/BotFather)

## Copy to Hetzner

```bash
# On your local machine
cd hermes-agents

# SCP all files to Hetzner
scp -r . root@178.105.137.23:/opt/fusionops/agents/

# SSH into Hetzner
ssh root@178.105.137.23
```

## Step 1: Configure Credentials (5 min)

```bash
# On Hetzner
cd /opt/fusionops/agents

# Create .env from template
cp .env.example .env

# Edit with your credentials
nano .env
```

Required:
- [ ] `DATAFORSEO_LOGIN` — your DataForSEO email
- [ ] `DATAFORSEO_PASSWORD` — your DataForSEO password
- [ ] `TRADEMARK_LIST` — comma-separated brand names (e.g., `loanstart,fastcash`)
- [ ] `COMPETITOR_LIST` — comma-separated competitor domains (e.g., `lendify.com,creditmax.com`)
- [ ] `APPROVED_ADVERTISERS` — Your domains only (e.g., `our-domain.com`)

Optional:
- [ ] `AEGIS_TELEGRAM_BOT_TOKEN` / `AEGIS_TELEGRAM_CHAT_ID`
- [ ] `SCOUT_TELEGRAM_BOT_TOKEN` / `SCOUT_TELEGRAM_CHAT_ID`
- [ ] `HERALD_TELEGRAM_BOT_TOKEN` / `HERALD_TELEGRAM_CHAT_ID`
- [ ] `ORACLE_TELEGRAM_BOT_TOKEN` / `ORACLE_TELEGRAM_CHAT_ID`

Save: `Ctrl+O` → `Ctrl+X` (nano)

## Step 2: Install Agent Skills (2 min)

```bash
# On Hetzner, in /opt/fusionops/agents

# Create Hermes skills directory
mkdir -p ~/.hermes/skills/trademark-monitoring

# Copy all 4 agents
cp -r AEGIS SCOUT HERALD ORACLE ~/.hermes/skills/trademark-monitoring/

# Verify installation
hermes skills list | grep trademark
```

Expected output:
```
trademark-monitoring/aegis
trademark-monitoring/herald
trademark-monitoring/oracle
trademark-monitoring/scout
```

- [ ] All 4 agents appear in skills list

## Step 3: Add Crons to Hermes Config (5 min)

```bash
# On Hetzner

# Edit Hermes config
nano ~/.hermes/config.yaml
```

Add this section (copy from HERMES_CONFIG.yaml):

```yaml
crons:
  aegis-brand-jack:
    schedule: "0 */2 * * *"
    skill: "trademark-monitoring/aegis"
    enabled: true
    env_file: /opt/fusionops/agents/.env

  scout-ad-copy:
    schedule: "0 6 * * *"
    skill: "trademark-monitoring/scout"
    enabled: true
    env_file: /opt/fusionops/agents/.env

  herald-trends:
    schedule: "0 8 * * *"
    skill: "trademark-monitoring/herald"
    enabled: true
    env_file: /opt/fusionops/agents/.env

  oracle-keywords:
    schedule: "0 9 * * 1"
    skill: "trademark-monitoring/oracle"
    enabled: true
    env_file: /opt/fusionops/agents/.env
```

**Important**: Change `/opt/fusionops/agents/.env` to the correct path on your system.

- [ ] Crons section added to ~/.hermes/config.yaml
- [ ] env_file paths are correct

## Step 4: Verify Setup (3 min)

```bash
# On Hetzner, in /opt/fusionops/agents

# Run verification script
bash verify-setup.sh
```

Expected output:
```
✓ Checking .env configuration...
  ✓ All required env vars configured
✓ Checking Hermes skills installation...
  ✓ All 4 agents installed in Hermes skills directory
✓ Checking Hermes config crons...
  ✓ Cron entries configured
✓ Checking state directories...
  ✓ Created ~/.hermes/aegis-state
  ✓ Created ~/.hermes/scout-state
  ...
✓ Testing DataForSEO API credentials...
  ✓ DataForSEO API credentials verified
✓ Checking Telegram configuration (optional)...
  ✓ Telegram configured for alerts

✅ Setup verification complete!
```

- [ ] Verification script passes all checks

## Step 5: Test One Agent (2 min)

```bash
# On Hetzner, in /opt/fusionops/agents

# Test AEGIS manually
source .env
python3 AEGIS/run.py
```

Expected output:
```
2026-05-17 10:30:45 [AEGIS] Starting brand-jack detection for 3 keywords
2026-05-17 10:30:47 [AEGIS] Brand-jack detection complete: 0 new alerts
```

- [ ] AEGIS runs without errors
- [ ] Log message shows keywords detected

## Step 6: Start Hermes with Agents (instant)

```bash
# On Hetzner

# Restart Hermes to pick up new crons
systemctl restart hermes

# Verify Hermes is running
systemctl status hermes
```

Expected:
```
● hermes.service - Hermes Agent Runtime
   Loaded: loaded (/etc/systemd/system/hermes.service)
   Active: active (running)
```

- [ ] Hermes service is active and running

## Step 7: Monitor Agent Execution (5 min)

```bash
# On Hetzner, monitor in real-time
tail -f ~/.hermes/hermes.log | grep -E "trademark|AEGIS|SCOUT|HERALD|ORACLE"
```

You should see:
- Periodic AEGIS logs (every 2 hours)
- Daily SCOUT logs at 06:00
- Daily HERALD logs at 08:00
- Weekly ORACLE logs on Monday at 09:00

- [ ] Agent logs appear in hermes.log

## Step 8: Check State Files (5 min)

```bash
# On Hetzner, after first agent run

# Check AEGIS state
ls -la ~/.hermes/aegis-state/

# View first alert (if any)
head -5 ~/.hermes/aegis-state/alerts.jsonl

# Check all state directories
ls -la ~/.hermes/*-state/
```

Expected:
```
~/.hermes/
├── aegis-state/
│   ├── alerts.jsonl
│   └── seen.json
├── scout-state/
│   ├── snapshots.json
│   └── diffs.jsonl
├── herald-state/
│   ├── baselines.json
│   └── alerts.jsonl
└── oracle-state/
    ├── keywords.jsonl
    └── weekly_baseline.json
```

- [ ] All state directories exist
- [ ] .jsonl files being populated

## Step 9: Verify Telegram Alerts (if configured)

```bash
# On Hetzner, test Telegram manually
source .env

# Send test message to AEGIS chat
curl -X POST https://api.telegram.org/bot$AEGIS_TELEGRAM_BOT_TOKEN/sendMessage \
  -d chat_id=$AEGIS_TELEGRAM_CHAT_ID \
  -d text="✅ Hermes agents deployed successfully!"
```

Expected: Message appears in your Telegram chat

- [ ] Telegram test message received (if Telegram configured)

## Step 10: Set Up Observability (Optional, 5 min)

If you've deployed Langfuse + LiteLLM proxy:

```bash
# On Hetzner

# Edit Hermes config
nano ~/.hermes/config.yaml

# Add model section (if not already present):
model:
  provider: "openrouter"
  base_url: "http://localhost:4000/v1"    # LiteLLM proxy
  model: "claude-3-5-sonnet"
  api_key: ${OPENROUTER_API_KEY}

# Restart Hermes
systemctl restart hermes
```

Then view traces in Langfuse:
```
http://178.105.137.23:3030
→ Project → Traces
→ Filter by skill: "trademark-monitoring"
```

- [ ] (Optional) LiteLLM proxy configured
- [ ] (Optional) Langfuse traces appearing

## Post-Deployment Verification

Run these checks after 24-48 hours:

### AEGIS (Every 2h)
- [ ] Logs appear in `~/.hermes/hermes.log`
- [ ] Alert JSON in `~/.hermes/aegis-state/alerts.jsonl`
- [ ] Dedup window in `~/.hermes/aegis-state/seen.json`

### SCOUT (Daily 06:00)
- [ ] Runs once per day at 06:00 UTC
- [ ] Snapshots saved in `~/.hermes/scout-state/snapshots.json`
- [ ] Diffs (if any) in `~/.hermes/scout-state/diffs.jsonl`

### HERALD (Daily 08:00)
- [ ] Runs once per day at 08:00 UTC
- [ ] Baselines in `~/.hermes/herald-state/baselines.json`
- [ ] Alerts (if any) in `~/.hermes/herald-state/alerts.jsonl`

### ORACLE (Weekly Monday 09:00)
- [ ] Next run: Monday 09:00 UTC
- [ ] Keywords in `~/.hermes/oracle-state/keywords.jsonl`
- [ ] Baseline in `~/.hermes/oracle-state/weekly_baseline.json`

## Troubleshooting During Deployment

### Error: "skills not found"
```bash
# Solution: Verify directory structure
ls -la ~/.hermes/skills/trademark-monitoring/
# Should show: AEGIS/ SCOUT/ HERALD/ ORACLE/

# Refresh skill cache
hermes skills refresh
```

### Error: "env_file not found"
```bash
# Solution: Update cron env_file path in config.yaml to absolute path
# Get absolute path:
cd /opt/fusionops/agents && pwd

# Use output in config.yaml:
env_file: /opt/fusionops/agents/.env
```

### Error: "DataForSEO API authentication failed"
```bash
# Solution: Verify credentials in .env
source /opt/fusionops/agents/.env
echo $DATAFORSEO_LOGIN
echo $DATAFORSEO_PASSWORD

# Test API call
curl -u $DATAFORSEO_LOGIN:$DATAFORSEO_PASSWORD \
  https://api.dataforseo.com/v3/serp/google/ads/advertisers/live/advanced \
  -H 'Content-Type: application/json' \
  -d '{"keywords": ["test"], "location_code": 2840}' | head -20
```

### Error: "Hermes won't restart"
```bash
# Check config syntax
hermes config validate

# View Hermes logs
journalctl -u hermes -n 50 --no-pager

# Fix YAML syntax errors in config.yaml
# (Common: missing colon, wrong indentation)
```

## Rollback Plan (If Needed)

If agents cause issues:

```bash
# 1. Disable all crons temporarily
nano ~/.hermes/config.yaml
# Set enabled: false for all 4 agents

# 2. Restart Hermes
systemctl restart hermes

# 3. Remove skills (if needed)
rm -rf ~/.hermes/skills/trademark-monitoring/

# 4. Restore from backup
# (If you had a backup of ~/.hermes/config.yaml before adding agents)
```

## Success Criteria

Deployment is successful when:

- ✅ All 4 agents appear in `hermes skills list`
- ✅ Verification script passes all checks
- ✅ AEGIS test runs without errors
- ✅ Hermes service is active and running
- ✅ Agent logs appear in `~/.hermes/hermes.log`
- ✅ State files are being created in `~/.hermes/*-state/`
- ✅ (Optional) Telegram alerts being sent
- ✅ (Optional) Langfuse traces appearing in dashboard

## Support

For issues:
1. Check troubleshooting section above
2. Review README.md in this directory
3. Check DataForSEO API docs: https://docs.dataforseo.com/
4. Check Hermes runtime logs: `journalctl -u hermes -n 100`

---

**Estimated Time**: 30-40 minutes total
**Risk Level**: Low (agents are read-only, no data modifications)
**Reversibility**: High (can disable or remove skills anytime)
