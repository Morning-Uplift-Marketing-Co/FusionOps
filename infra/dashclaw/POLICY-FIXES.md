# DashClaw Policy Configuration Fixes

**Date**: 2026-05-16 (Phase 4g Validation)
**Status**: Blocking issue identified — policies must be re-registered with corrected triggers

---

## Issue Summary

Phase 4g synthetic validation revealed that policies registered in DashClaw UI do not match the actual action types and logic implemented in `apps/fbis-mcp-server/tools/risk.py`:

1. **Policy 1 (Critical Risk Escalation)**: Registered with generic action types (api, build, deploy) but risk.py uses `action_type="risk_score_write"`
2. **Policy 2 (Risk Decision Audit Trail)**: Should trigger on risk_score_write actions with status ∈ [risk, critical]
3. **Policy 3 (Account Freeze Authority)**: Policy logic reversed — currently allows non-verdict agents to freeze accounts, should restrict to fbis-verdict only

---

## Corrected Policy Definitions

### Policy 1: Critical Risk Escalation (UPDATED)

**Name**: Critical Risk Escalation  
**Type**: `require_approval`

**Trigger Conditions** (ALL must match):
```json
{
  "action_type": "risk_score_write",
  "verdict_score": { "gte": 80 },
  "verdict_status": "critical"
}
```

**Action**: BLOCK execution, require operator approval

**Approval Config**:
- **Approver Group**: `fbis-ops`
- **Timeout**: 30 minutes
- **On Timeout**: Escalate to ops-oncall (Telegram escalation)

**Why This Matters**:
- DashClaw only triggers policies when `action_type` exactly matches the trigger condition
- Previously: policies matched generic action types → never triggered for risk_score_write
- Fix: Trigger on `action_type="risk_score_write"` specifically

---

### Policy 2: Risk Decision Audit Trail (UPDATED)

**Name**: Risk Decision Audit Trail  
**Type**: `audit_log`

**Trigger Conditions**:
```json
{
  "action_type": "risk_score_write",
  "verdict_status": { "in": ["risk", "critical"] }
}
```

**Action**: Log all action fields to DashClaw decisions table

**Retention**: 7 years (regulatory compliance)

**Fields to Capture**:
- `action_id`, `agent_id`, `account_id`
- `verdict_score`, `verdict_status`
- `proxy_risk`, `isolation_score`, `traffic_quality`, `timeline_risk`
- `approver`, `outcome`, `timestamp`

**Why This Matters**:
- Audit trail enables compliance audits and incident RCAs
- Must capture on risk_score_write, not generic actions
- Webhook must be wired correctly (currently 0 decisions logged)

---

### Policy 3: Account Freeze Authority (FIXED LOGIC)

**Name**: Account Freeze Authority  
**Type**: `restricted_action`

**Trigger Conditions**:
```json
{
  "action_type": "transition_account",
  "to_state": { "in": ["suspended", "retired"] },
  "agent_id": { "ne": "fbis-verdict" }
}
```

**Action**: BLOCK if agent is NOT fbis-verdict

**Alert**: Notify `#fbis-ops` Telegram group

**Why This Matters**:
- Previous policy had logic reversed: allowed non-verdict agents to freeze
- Corrected to: ONLY fbis-verdict can call transition_account to suspended/retired
- Prevents parallel agents (argus, nexus, iris, chrono) from freezing accounts

---

## Re-Registration Steps

To fix Phase 4g validation failures, re-register policies in DashClaw UI at http://YOUR_IP:3100/settings/policies:

1. **Delete old policies** (Settings → Policies → [delete each])
2. **Create Policy 1** using corrected trigger (action_type="risk_score_write")
3. **Create Policy 2** using corrected trigger (action_type="risk_score_write" + verdict_status in [risk, critical])
4. **Create Policy 3** with fixed logic (agent_id != "fbis-verdict" → BLOCK)

After re-registration, re-run synthetic validation test:

```bash
# Call write_risk_score with critical scores
curl -X POST http://localhost:8765/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "write_risk_score",
    "params": {
      "account_id": "test-critical-5-16",
      "proxy_risk": 95,
      "isolation_score": 10,
      "traffic_quality": 15,
      "timeline_risk": 90
    },
    "id": 1
  }'

# Expected: action_status="pending_approval" (Policy 1 triggered)
# Then: Decision record created in DashClaw (Policy 2 triggered)
# Then: Operator approves → risk score written to D1, Telegram alert sent
```

---

## Verification Checklist

After re-registration:
- [ ] Policy 1: /api/guard returns require_approval for verdict_score >= 80, status=critical
- [ ] Policy 2: POST to /api/actions with risk_score_write triggers webhook, creates decision record
- [ ] Policy 3: transition_account from non-verdict agent returns policy violation error
- [ ] Telegram alerts sent for risk/critical verdicts (🟠 risk, 🔴 critical)
- [ ] D1 risk_scores table updated after operator approval
- [ ] DashClaw decisions table has audit trail (all fields populated, 7-year retention)

---

**Next Action**: Re-register policies in DashClaw UI, then re-run Phase 4g validation test
