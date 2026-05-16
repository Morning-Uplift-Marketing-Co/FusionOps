# FBIS Monitoring Checklist & Dashboard

## Daily Operator Duties

This checklist is for human operators managing the FusionOps Ban Intelligence System.

### Pre-Nightly (before 2 AM UTC)
- [ ] Verify cron job scheduled: `0 2 * * * /tmp/fbis-nightly-cron.sh`
- [ ] Check API Worker is up: `curl https://lp-factory-api.misty-feather-556e.workers.dev/api/health`
- [ ] Verify D1 database bindings accessible: `wrangler d1 info fusionops-main-new-v2`
- [ ] Confirm Telegram credentials set: `echo $TELEGRAM_BOT_TOKEN | wc -c` (should be > 10)

### Post-Nightly (after 2:30 AM UTC)
- [ ] Check Telegram alert received (expected: risk summary with emoji indicators)
- [ ] Query latest KPIs: `GET /api/analysis/agent-kpis`
  - Should have 5 agents: argus, nexus, iris, chrono, verdict
  - KPIs should have values > 0
- [ ] Review critical accounts: `GET /api/analysis/accounts?status=active`
  - Count accounts with verdict_status = "critical"
  - If > 0: review ban_events table for recent incidents
- [ ] Check ban events logged: `GET /api/analysis/ban-events?days=1`
  - Should correlate with risk scores (high risk = ban risk)

### Weekly Review (Sundays)
- [ ] Analyze risk score distribution
  - % healthy: target ≥ 70%
  - % watch:   target ≤ 20%
  - % risk:    target ≤ 8%
  - % critical: target ≤ 2%
- [ ] Review proxy pool health: `GET /api/analysis/proxy-pool`
  - clean_proxy_rate should be ≥ 90%
  - low_trust_accounts should be ≤ 5% of active
- [ ] Check traffic quality: `GET /api/analysis/agent-kpis?agent=iris`
  - avg_traffic_quality should be ≥ 70
  - link_health_score should be ≥ 80%
- [ ] Review spending accounts: `GET /api/analysis/spend-history/:account_id?limit=7`
  - Identify overspend patterns (utilization > 110%)
  - Flag accounts for budget adjustment

### Monthly Review (1st of month)
- [ ] Generate FBIS report:
  ```bash
  cd /opt/fusionops && \
  echo "SELECT COUNT(*) as total, \
    SUM(CASE WHEN verdict_status='healthy' THEN 1 ELSE 0 END) as healthy, \
    SUM(CASE WHEN verdict_status='critical' THEN 1 ELSE 0 END) as critical \
    FROM account_risk_scores \
    WHERE scored_at >= date('now', '-30 days')" | \
  wrangler d1 query fusionops-main-new-v2
  ```
- [ ] Review lifecycle transitions
  - New accounts warming → active progression
  - Suspended/retired accounts and their reasons
- [ ] Tune risk weights based on past month's ban data
  - Compare predicted risk vs. actual bans
  - Adjust weights if accuracy < 80%

## Monitoring Queries

### Risk Score Health Check
```sql
-- Get latest risk scores per account
SELECT account_id, verdict_score, verdict_status, scored_at
FROM account_risk_scores
WHERE scored_at >= datetime('now', '-1 day')
ORDER BY verdict_score DESC
LIMIT 20;
```

### Agent KPI Tracking
```sql
-- Latest KPIs per agent
SELECT agent_name, kpi_name, kpi_value, kpi_target,
  ROUND(100.0 * kpi_value / kpi_target, 1) as pct_of_target,
  recorded_at
FROM agent_kpis
WHERE recorded_at >= datetime('now', '-1 day')
ORDER BY agent_name, kpi_name;
```

### Ban Correlation
```sql
-- Correlate risk scores at ban time
SELECT b.account_id, b.ban_reason, b.ban_date,
  b.risk_score_at_ban, b.days_active,
  r.verdict_score, r.verdict_status
FROM ban_events b
LEFT JOIN account_risk_scores r
  ON b.account_id = r.account_id
ORDER BY b.ban_date DESC
LIMIT 50;
```

### Spend Pattern Detection
```sql
-- Identify overspend accounts (> 110% utilization)
SELECT account_id, snapshot_date, actual_spend, budget_cap,
  ROUND(100.0 * actual_spend / budget_cap, 1) as utilization_pct,
  CASE WHEN actual_spend > budget_cap * 1.1 THEN 'OVERSPEND' ELSE 'OK' END as status
FROM spend_snapshots
WHERE snapshot_date >= date('now', '-7 days')
ORDER BY utilization_pct DESC;
```

### Proxy Health
```sql
-- Proxy pool fraud/trust distribution
SELECT
  SUM(CASE WHEN fraud_score < 20 THEN 1 ELSE 0 END) as clean_count,
  SUM(CASE WHEN fraud_score >= 20 AND fraud_score < 50 THEN 1 ELSE 0 END) as medium_count,
  SUM(CASE WHEN fraud_score >= 50 THEN 1 ELSE 0 END) as high_count,
  COUNT(*) as total,
  ROUND(100.0 * SUM(CASE WHEN fraud_score < 20 THEN 1 ELSE 0 END) / COUNT(*), 1) as clean_rate_pct
FROM ops_proxy_pool;
```

## Risk Weight Analysis

### Current Formula (from risk.py)
```
verdict_score = int(
  proxy_risk           * 0.25 +
  (100 - isolation_score) * 0.30 +
  (100 - traffic_quality) * 0.25 +
  timeline_risk        * 0.20
)
```

### Weight Interpretation
- **proxy_risk (0.25)**: Impact of proxy fraud/trust issues
  - Lower = more weight on proxy safety
  - Typical range: 0-100 (100 = maximum proxy fraud)

- **isolation_score (0.30)**: Inverse of account isolation quality
  - Higher isolation = lower risk contribution
  - Typical range: 0-100 (100 = fully isolated)
  - Accounts on same /24 subnet = shared isolation

- **traffic_quality (0.25)**: Inverse of traffic cleanliness
  - Higher quality = lower risk contribution
  - Typical range: 0-100 (100 = highest quality)
  - Based on pixel event patterns, session validity

- **timeline_risk (0.20)**: Ban pattern velocity
  - Recent bans = higher risk
  - Typical range: 0-100 (100 = ban imminent)
  - Decreases over 30+ days without ban

### Weight Adjustment Decision Tree
If accuracy < 80% (predicted risk vs. actual bans):

1. **Many false positives** (high-risk accounts NOT banned)
   - Increase proxy_risk weight (maybe 0.20)
   - Decrease isolation_score or traffic_quality

2. **Many false negatives** (low-risk accounts BANNED)
   - Increase timeline_risk weight (maybe 0.30)
   - Increase traffic_quality weight (maybe 0.30)

3. **Systematic overestimation**
   - Scale all weights down proportionally
   - Increase healthy threshold from 30 to 40

4. **Systematic underestimation**
   - Decrease all weights uniformly
   - Lower risk thresholds

## Alert Thresholds

### Status Breakpoints (verdict_score)
| Score | Status | Action | Telegram Emoji |
|-------|--------|--------|--------|
| 0-30  | healthy | Monitor | 🟢 |
| 31-55 | watch  | Review weekly | 🟡 |
| 56-75 | risk   | Daily review + 🟠 alert |
| 76-100| critical| Immediate review + 🔴 alert |

### KPI Targets (daily)
| Agent | KPI | Target | Critical if |
|-------|-----|--------|------------|
| argus | clean_proxy_rate | 90% | < 80% |
| nexus | avg_traffic_quality | 70 | < 50 |
| iris | link_health_score | 80% | < 60% |
| chrono | ban_rate_30d | 0 | > 5 |
| verdict | healthy_accounts | 70% of total | < 50% |

## Escalation Procedures

### Critical Risk (verdict_score ≥ 80)
1. **Immediate** (within 1 hour):
   - Human review account details
   - Check proxy history + trust score
   - Review recent campaigns
   - Check for subnet collisions

2. **Same day**:
   - If suspicious: pause campaigns
   - If false alarm: adjust weights (log to cerebrum.md)

### Watch Risk (31-55 score)
1. **Weekly review**:
   - Identify trending patterns
   - Check if accounts are warming up or degrading
   - Look for common signals

2. **Monthly**:
   - Bulk review for common risk factors
   - Adjust weights if patterns change

### Proxy Pool Degradation
1. **If clean_proxy_rate < 85%**:
   - Check for batch scans returning bad results
   - Verify fraud_score calculation
   - Consider rotating proxy provider

2. **If subnet collision detected**:
   - Identify affected accounts
   - Rotate proxies to separate /24s
   - Review isolation_score formula

## Hermes Nightly Run Details

### Expected Output
```
==============================================================
  HERMES nightly run — 2026-05-16
==============================================================

[hermes] 50 accounts loaded

[ARGUS] proxy & IP risk analysis...
  [argus] clean_proxy_rate = 92.3 % (target 90)
  [argus] ip_collision_count = 2 count (target 0)
  [argus] low_trust_accounts = 1 count (target 0)
  [argus] proxy_pool_size = 120 count (target 0)

[NEXUS] traffic quality analysis...
  [nexus] avg_traffic_quality = 75.2 score (target 70)
  [nexus] accounts_analyzed = 50 count (target 50)

[IRIS] link health analysis...
  [iris] link_health_score = 85.4 score (target 80)
  [iris] broken_links = 3 count (target 0)

[CHRONO] ban pattern analysis...
  [chrono] ban_rate_30d = 1 count (target 0)
  [chrono] accounts_at_timeline_risk = 1 count (target 0)

[VERDICT] computing risk scores...
  [verdict] accounts_scored = 50 count (target 50)
  [verdict] critical_accounts = 1 count (target 0)
  [verdict] healthy_accounts = 35 count (target 35)

[hermes] sending Telegram report...

==============================================================
  HERMES run complete
==============================================================
```

### If Hermes fails
1. Check API connectivity: `curl -v https://lp-factory-api.misty-feather-556e.workers.dev/api/health`
2. Check D1 availability: `wrangler d1 query fusionops-main-new-v2 "SELECT COUNT(*) FROM ops_accounts"`
3. Check environment variables: `env | grep FBIS_`
4. Check Telegram token validity: `curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"`
5. Review `/var/log/hermes-nightly.log` (if available on VPS)

## Phase 9 Preparation: Multi-Account Scaling

### Ready for Scaling?
- [ ] Risk scoring formula validated (6/6 tests pass)
- [ ] Database schema supports 10,000+ accounts
- [ ] API response times < 2s for 100 account queries
- [ ] Nightly run completes in < 5 minutes
- [ ] KPI tracking working for all 5 agents
- [ ] Telegram alerts functional for critical accounts
- [ ] Monitoring dashboard accessible to operators

### Scaling Checklist
- [ ] Identify max accounts API can handle: `curl /api/analysis/accounts?limit=1000`
- [ ] Test parallel risk scoring (currently sequential)
- [ ] Implement caching for proxy pool (refresh hourly, not per-request)
- [ ] Add database indexes for account_id lookups
- [ ] Set up metrics collection (Prometheus/Grafana or similar)
- [ ] Create on-call rotation for critical alerts
- [ ] Document runbook for account on-boarding
- [ ] Test disaster recovery (D1 backup + restore)

## Contact & Escalation

- **Technical Issues**: Check logs + reach out to platform team
- **Risk Tuning**: Review monthly report, discuss weight changes
- **VPS Access**: SSH key at `~/.ssh/fusionops_hetzner`
- **Database Backup**: Automated daily to CloudFlare storage
