# FBIS Quick Start Guide for Operators

**Read this first.** Complete documentation available in other files.

---

## What is FBIS?

**FusionOps Ban Intelligence System** — Automatic risk detection for Google Ads accounts.

**Purpose**: Predict which accounts are likely to be banned soon, before it happens.

**Components**:
- 5 autonomous agents (ARGUS, NEXUS, IRIS, CHRONO, VERDICT)
- Risk score calculation (0-100)
- Automatic daily nightly run at 2 AM UTC
- Telegram alerts for high-risk accounts
- Database of risk scores, KPIs, ban events

---

## Daily Operator Checklist (< 5 minutes)

### Morning (9 AM UTC, after nightly run)

1. **Check Telegram alert received**
   - Expect emoji summary: 🟢✅ 🟡👀 🟠⚠️ 🔴🚨
   - If no alert: check API Worker is up
   ```bash
   curl https://lp-factory-api.misty-feather-556e.workers.dev/api/health
   ```

2. **Review critical accounts** (if any)
   - Critical = verdict_score > 75
   - Action: Manual review of account details
   - Check: Proxy trust score, ban history, traffic quality

3. **Monitor agent KPIs**
   - All 5 agents should report (argus, nexus, iris, chrono, verdict)
   - Timeline risk should NOT be all zeros (bug #13 if it is)
   - Traffic quality should be 50-85 range (not 0-100)

---

## Risk Score Interpretation

| Score | Status | Color | Action |
|-------|--------|-------|--------|
| 0-30  | Healthy | 🟢 | Monitor monthly |
| 31-55 | Watch  | 🟡 | Review weekly |
| 56-75 | Risk   | 🟠 | Review daily |
| 76-100| Critical| 🔴 | Review immediately |

---

## 5-Minute Queries

### Query 1: Latest Risk Scores
```bash
curl -s "https://lp-factory-api.misty-feather-556e.workers.dev/api/analysis/accounts" \
  -H "Authorization: Bearer $FBIS_API_KEY" | jq '.data[] | {id, label, status}' | head -20
```

### Query 2: Critical Accounts
```bash
curl -s "https://lp-factory-api.misty-feather-556e.workers.dev/api/analysis/accounts" \
  -H "Authorization: Bearer $FBIS_API_KEY" | jq '.data[] | select(.verdict_score > 75)'
```

### Query 3: Agent KPIs (last 24h)
```bash
curl -s "https://lp-factory-api.misty-feather-556e.workers.dev/api/analysis/agent-kpis" \
  -H "Authorization: Bearer $FBIS_API_KEY" | jq '.data[] | {agent: .agent_name, kpi: .kpi_name, value: .kpi_value}'
```

### Query 4: Recent Bans
```bash
curl -s "https://lp-factory-api.misty-feather-556e.workers.dev/api/analysis/ban-events?days=7" \
  -H "Authorization: Bearer $FBIS_API_KEY" | jq '.data[] | {account_id, ban_reason, risk_score: .risk_score_at_ban}'
```

---

## If Something Goes Wrong

### Nightly run didn't complete
1. Check API Worker: `curl https://lp-factory-api.misty-feather-556e.workers.dev/api/health`
2. Check D1 database: `wrangler d1 info fusionops-main-new-v2`
3. View logs: Check `/var/log/hermes-nightly.log` on VPS (if available)
4. **Action**: Contact platform team if API is down

### No risk scores calculated
1. Check accounts exist: `SELECT COUNT(*) FROM ops_accounts`
2. Check KPIs exist: `SELECT COUNT(*) FROM agent_kpis WHERE recorded_at > datetime('now', '-1 day')`
3. Known issue: Timeline risk always 0 (BUG #13 — being fixed)

### Risk scores too high (all critical)
1. Check traffic quality metric: Is it realistic?
2. Known issue: Traffic quality oversimplified (BUG #14 — being fixed)
3. Check proxy pool: Are scores accurate?

### Telegram alerts not sending
1. Verify credentials: `echo $TELEGRAM_BOT_TOKEN | wc -c` (should be > 10)
2. Test manually:
   ```bash
   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
     -d "chat_id=${TELEGRAM_CHAT_ID}&text=test"
   ```

---

## Understanding Risk Components

Each account gets 4 risk scores combined into a verdict:

### 1. Proxy Risk (25% weight)
**What**: Is the proxy high-fraud or low-trust?
**Range**: 0-100
**Example**:
- Fraud score 0-20 → proxy_risk = 0-20 (clean)
- Fraud score 50+ → proxy_risk = 50+ (questionable)

### 2. Isolation Score (30% weight)
**What**: Is this account isolated from others?
**Range**: 0-100
**Example**:
- Own proxy, unique fingerprint → isolation = 90 (good)
- Shared /24 subnet with 10 other accounts → isolation = 30 (poor)

### 3. Traffic Quality (25% weight)
**What**: Is the campaign traffic real users or bots?
**Range**: 0-100
**Status**: ⚠ Currently oversimplified (BUG #14)
**Example**:
- Good GCLID rate, conversions, coherent sessions → quality = 80
- No conversions, bot patterns, zero GCLID → quality = 20

### 4. Timeline Risk (20% weight)
**What**: Is this account on a ban trajectory?
**Range**: 0-100
**Status**: ✗ Currently broken (BUG #13 — always 0)
**Example**:
- No ban history, account 60+ days old → timeline = 0
- Account banned 10 days ago → timeline = 80

---

## Weekly Tasks (1 hour)

1. **Review watch accounts** (31-55 score)
   - Are they stable or trending worse?
   - Consider proactive campaign review

2. **Check proxy pool health**
   - % clean proxies should be > 90%
   - If < 85%: investigate proxy provider

3. **Analyze traffic quality trends**
   - Graph avg_traffic_quality over time
   - Sharp drops indicate account health issues

4. **Review agent KPIs**
   - All agents should hit targets (see FBIS-MONITORING-CHECKLIST.md)
   - Missing KPIs = agent failure

---

## Monthly Tasks (2 hours)

1. **Generate risk report**
   - Count accounts by status (healthy/watch/risk/critical)
   - Target: 70%+ healthy, <2% critical

2. **Ban correlation analysis**
   - Compare predicted risk vs. actual bans
   - Accuracy should be > 80%
   - If < 80%: weight tuning needed

3. **Spend analysis**
   - Identify overspend accounts (utilization > 110%)
   - Flag for budget adjustment
   - Correlate with risk scores

4. **Proxy rotation review**
   - Accounts with low trust score
   - Plan proxy rotation schedule

---

## Known Issues (Being Fixed)

### BUG #13: Timeline Risk Always 0
- **File**: `hermes/hermes-nightly.py` line 145
- **Impact**: Risk scores ~15-25% too low
- **Status**: CRITICAL, in remediation plan
- **ETA**: Phase 1 (next session)

### BUG #14: Traffic Quality Oversimplified
- **File**: `hermes/hermes-nightly.py` lines 78-91
- **Impact**: Cannot detect bot farms
- **Status**: HIGH, in remediation plan
- **ETA**: Phase 2 (before Phase 9)

**Both bugs documented in**: `docs/FBIS-TEST-REPORT.md`

---

## Where to Find More Info

| Topic | File |
|-------|------|
| Daily checklist | `docs/FBIS-MONITORING-CHECKLIST.md` |
| Risk weight analysis | `docs/FBIS-RISK-WEIGHT-ANALYSIS.md` |
| Full test report | `docs/FBIS-TEST-REPORT.md` |
| Phase 3 summary | `docs/FBIS-PHASE-3-SUMMARY.md` |
| Bug details | `.wolf/buglog.json` |
| Risk formula code | `apps/fbis-mcp-server/tools/risk.py` |
| Nightly runner | `hermes/hermes-nightly.py` |
| Database schema | `apps/api-worker/migrations/0008_analysis.sql` |

---

## Quick Escalation

**Critical account (score > 80)?**
1. Review account details
2. Check proxy history
3. Check ban events for similar accounts
4. Decision: pause campaigns or monitor?

**System down?**
1. Check API Worker health
2. Check D1 database connectivity
3. Check cron job running: `0 2 * * * /tmp/fbis-nightly-cron.sh`
4. Contact platform team if API/DB down

**Questions about risk weights?**
- See: `docs/FBIS-RISK-WEIGHT-ANALYSIS.md`
- Current weights: 0.25 proxy, 0.30 isolation, 0.25 quality, 0.20 timeline

---

## Success = Catching Bans Before They Happen

**Goal**: Identify risky accounts 7-14 days before Google bans them.

**Measures**:
- Ban prediction accuracy: ≥ 80%
- False positive rate: ≤ 10%
- Healthy account false alarm: ≤ 5%

**When you catch a risky account early**: ✓ Win
- Notify client, rotate proxy, audit campaigns, pause if needed

**When an account gets banned**: ✗ Miss
- Log in buglog.json, analyze why prediction failed, adjust weights

---

**Document Version**: 1.0
**Last Updated**: 2026-05-16
**Status**: Ready for operators
**Questions?** See full documentation files listed above.
