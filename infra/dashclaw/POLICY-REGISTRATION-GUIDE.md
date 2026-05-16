# DashClaw Policy Registration Guide

**Applies to**: Phase 4g validation  
**Time Required**: ~5 minutes (manual UI registration)

---

## Overview

Three policies must be re-registered in DashClaw to match the exact action types and logic used by risk.py. The previous registration used generic action types (api, build, deploy) which don't match the FBIS implementation.

---

## Pre-Registration Checklist

Before starting, ensure:
- [ ] DashClaw is running: `docker ps | grep dashclaw`
- [ ] You can access DashClaw UI: http://YOUR_IP:3100
- [ ] You are logged in with admin privileges
- [ ] Phase 4 fixes are applied (agent_id, endpoint corrections)

---

## Step 1: Delete Old Policies

1. Open DashClaw UI → Settings → Policies
2. For each existing policy, click [⋯] → Delete
3. Confirm: "Yes, delete this policy"

**Expected state**: Policies list is empty

---

## Step 2: Register Policy 1 (Critical Risk Escalation)

**Form Fields**:

| Field | Value |
|-------|-------|
| **Name** | Critical Risk Escalation |
| **Type** | require_approval |
| **Action Type** | risk_score_write |
| **Trigger Conditions** | JSON below |
| **Approver Group** | fbis-ops |
| **Timeout (min)** | 30 |

**Trigger Conditions** (paste as JSON):
```json
{
  "verdict_score": { "gte": 80 },
  "verdict_status": "critical"
}
```

**Why This Matters**:
- `action_type: "risk_score_write"` matches the exact action type from risk.py
- `verdict_score >= 80` + `status="critical"` triggers approval gate for extreme-risk accounts
- Without this exact match, policy never activates

**Steps**:
1. Click [+ New Policy]
2. Fill in fields above
3. Paste Trigger Conditions JSON
4. Click [Save]
5. ✅ Policy appears in list as "active"

---

## Step 3: Register Policy 2 (Risk Decision Audit Trail)

**Form Fields**:

| Field | Value |
|-------|-------|
| **Name** | Risk Decision Audit Trail |
| **Type** | audit_log |
| **Action Type** | risk_score_write |
| **Trigger Conditions** | JSON below |
| **Retention (days)** | 2555 (7 years for regulatory compliance) |
| **Fields to Log** | All |

**Trigger Conditions** (paste as JSON):
```json
{
  "verdict_status": { "in": ["risk", "critical"] }
}
```

**Fields to Log** (checkboxes):
- [x] action_id
- [x] agent_id
- [x] account_id
- [x] verdict_score
- [x] verdict_status
- [x] All context fields (proxy_risk, isolation_score, traffic_quality, timeline_risk)
- [x] timestamp

**Why This Matters**:
- Captures every risk/critical decision for compliance audits
- 7-year retention satisfies SOC 2 + GDPR requirements
- Audit trail enables incident RCAs and operator pattern analysis

**Steps**:
1. Click [+ New Policy]
2. Fill in fields above
3. Paste Trigger Conditions JSON
4. Check "All" for Fields to Log
5. Click [Save]
6. ✅ Policy appears in list as "active"

---

## Step 4: Register Policy 3 (Account Freeze Authority)

**Form Fields**:

| Field | Value |
|-------|-------|
| **Name** | Account Freeze Authority |
| **Type** | restricted_action |
| **Action Type** | transition_account |
| **Trigger Conditions** | JSON below |
| **Allowed Agents** | fbis-verdict |
| **Alert Group** | #fbis-ops |

**Trigger Conditions** (paste as JSON):
```json
{
  "to_state": { "in": ["suspended", "retired"] }
}
```

**Action**: BLOCK if agent is NOT fbis-verdict

**Why This Matters**:
- Account suspension/retirement are irreversible actions
- Restricting to fbis-verdict only prevents accidental freezes from parallel agents (argus, nexus, iris, chrono)
- Ops alert enables immediate human review if decision seems wrong

**Steps**:
1. Click [+ New Policy]
2. Fill in fields above
3. Paste Trigger Conditions JSON
4. Set **Allowed Agents**: fbis-verdict
5. Set **Alert Group**: #fbis-ops (or equivalent Telegram group)
6. Click [Save]
7. ✅ Policy appears in list as "active"

---

## Verification After Registration

After all 3 policies are registered:

1. **Check policy list**: All 3 show as "active" with green checkmark ✅
2. **Verify action_type matching**: Open each policy, confirm action_type is exactly:
   - Policy 1: `risk_score_write`
   - Policy 2: `risk_score_write`
   - Policy 3: `transition_account`
3. **Test trigger logic**: (Do NOT execute yet — wait for code review)
   - Policy 1: Will trigger when `verdict_score >= 80` AND `status="critical"`
   - Policy 2: Will log when `status` is risk or critical
   - Policy 3: Will block when `agent != fbis-verdict` on suspend/retire transitions

---

## If Registration Fails

**Error: "Invalid JSON in Trigger Conditions"**
- Copy JSON exactly as shown above (with proper quotes and spacing)
- Do NOT add extra comments or fields
- Validate JSON at https://jsonlint.com/ before pasting

**Error: "Action Type not recognized"**
- Ensure you typed `risk_score_write` (exact case)
- Do NOT use generic types like "api" or "build"

**Error: "Approver Group not found"**
- Policy 1: Ensure `fbis-ops` group exists in DashClaw admin panel
- If not: Create it first, then register policy

---

## After Policies Are Registered

1. Restart fbis-mcp container to load new code:
   ```bash
   docker compose -f infra/docker-compose.yml up -d --force-recreate fbis-mcp
   ```

2. Re-run synthetic critical-risk test:
   ```bash
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
   ```

3. Expected: `action_status="pending_approval"` (Policy 1 triggered)

---

## Troubleshooting

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| write_risk_score returns HTTP 400 | agent_id missing or policy not found | Check agent_id in code (should be fixed) or policy action_type mismatch | 
| write_risk_score returns HTTP 401 | Request signature required (ENFORCE_AGENT_SIGNATURES) | Disable in DashClaw config or implement signing |
| Action created but no decision webhook | Audit policy not triggered | Verify Policy 2 has action_type="risk_score_write" |
| Telegram alert not sent | Telegram env vars missing or policy 1 not triggered | Check TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID in fbis-mcp env |

---

**Status**: Ready to execute after Phase 4g fixes are applied.
