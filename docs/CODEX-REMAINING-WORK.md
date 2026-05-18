# Codex — Post-Bug-Fix Validation & Production Monitoring

**Status**: Bug fixes applied and validated locally. Ready for end-to-end testing on VPS.

---

## Task 1: End-to-End Validation (After PR Merge)

When PR #131 merges to main:

1. **Deploy to VPS**
   ```bash
   ssh -i ~/.ssh/fusionops_hetzner root@178.105.137.23
   cd /opt/fusionops && git pull origin main
   # Verify latest hermes-nightly.py has timeline_risk & traffic_quality fixes
   grep -n "get(\"/api/analysis/ban-events\"" hermes/hermes-nightly.py
   grep -n "gclid_rate" hermes/hermes-nightly.py
   ```

2. **Run Full Nightly Test**
   ```bash
   cd /opt/fusionops
   python3 hermes/hermes-nightly.py 2>&1 | tee /tmp/fbis-test-$(date +%Y%m%d).log
   ```
   Verify output:
   - ✓ [ARGUS] proxy analysis — clean_rate KPI
   - ✓ [NEXUS] traffic quality — avg_quality now uses gclid_rate
   - ✓ [CHRONO] ban patterns — days_to_ban calculated
   - ✓ [VERDICT] risk scores — timeline_risk not zero
   - ✓ D1 writes succeed (check /api/analysis/risk-score responses)
   - ✓ Telegram alert sent (check Telegram chat for nightly report)

3. **Validate Fixes**
   - Confirm timeline_risk > 0 for at least one account
   - Confirm traffic_quality < 100 (not raw event count)
   - Confirm verdict_score uses new weights (0.25/0.30/0.25/0.20)

4. **Check Mission Control**
   - Navigate to http://localhost:3001
   - Verify nightly mission logged + completed
   - Check agent heartbeats (argus, nexus, iris, chrono, verdict)

---

## Task 2: First 5 Nights Monitoring (2026-05-17 through 2026-05-21)

After first successful run, monitor these metrics daily:

### Daily Checklist (< 5 min)
```bash
# Check nightly cron ran
tail -20 /var/log/fbis-verdict.log

# Check D1 writes (query API Worker)
curl -s "https://lp-factory-api.misty-feather-556e.workers.dev/api/analysis/risk-scores?limit=5" | jq '.data[] | {account_id, verdict_score, verdict_status}'

# Check Telegram alerts
# (manual: check Telegram chat for "HERMES nightly run" messages)

# Check Mission Control missions
curl -s http://localhost:3001/api/missions | jq '.[] | {id, agent, status}'
```

### Data to Collect (5-day window)
- **Risk distribution**: Count of healthy/watch/risk/critical accounts per day
- **Ban correlation**: Accounts with timeline_risk=80 vs actual bans in next 24h
- **Quality scores**: Min/max/avg traffic_quality per day (baseline for tuning)
- **Proxy risk**: Accounts flagged by ARGUS, were they later banned?

### Record in spreadsheet or JSON:
```json
{
  "date": "2026-05-17",
  "accounts_total": 0,
  "healthy": 0, "watch": 0, "risk": 0, "critical": 0,
  "timeline_risk_correct": true,
  "traffic_quality_realistic": true,
  "telegram_alert_sent": true,
  "d1_writes": 0,
  "issues": []
}
```

---

## Task 3: Weight Tuning Preparation (2026-05-22 onward)

After 5 nights of data:

1. **Analyze Accuracy**
   - Accounts marked "critical" (verdict >= 80) → were they actually banned in 24h?
   - Accounts marked "risk" (verdict >= 60) → correlation with proxy risk?
   - False positives (flagged but healthy)?

2. **Calculate Correlation Coefficients**
   - timeline_risk vs actual ban events (should be 0.8+)
   - traffic_quality vs conversions (should be 0.6+)
   - proxy_risk vs account age (should be 0.5+)

3. **Recommend Weight Adjustments**
   - If timeline_risk accuracy < 70%: increase weight from 0.20 → 0.25
   - If proxy_risk accuracy < 60%: reduce from 0.25 → 0.20
   - Keep isolation_score & traffic_quality weights (new calcs working well)

4. **Create Phase 9 Readiness Report**
   - Risk model accuracy
   - Scaling readiness (1,000+ accounts)
   - Performance metrics (seconds per account)

---

## Success Criteria

- ✅ First nightly run completes without errors
- ✅ timeline_risk is no longer zero
- ✅ traffic_quality uses real metrics (not raw counts)
- ✅ D1 writes succeed for 90%+ of accounts
- ✅ Telegram alerts arrive daily
- ✅ Mission Control logs missions
- ✅ 5-night monitoring data collected
- ✅ Accuracy analysis complete
- ✅ Phase 9 readiness report submitted

---

## Blockers / Escalation

If any of these occur, escalate to primary developer:

1. **Hermes chat fails** — Check Hermes gateway logs: `hermes logs -f`
2. **D1 writes fail** — Check API Worker: `wrangler tail lp-factory-api`
3. **DashClaw approval hangs** — Check DashClaw logs: `docker logs dashclaw-app-1`
4. **Telegram alerts don't arrive** — Check TELEGRAM_BOT_TOKEN env var
5. **Mission Control 404** — Check Node.js server: `pm2 logs mission-control`

---

## Timeline

- **2026-05-17** — First nightly run (May 17 2 AM UTC)
- **2026-05-18 to 2026-05-21** — Daily monitoring
- **2026-05-22** — Analysis & weight tuning recommendations
- **2026-05-23** — Phase 9 readiness report
- **2026-05-24+** — Phase 9 development (scale to 1,000+ accounts)

---

**Reports go to**: `docs/FBIS-MONITORING-{YYYY-MM-DD}.md`
