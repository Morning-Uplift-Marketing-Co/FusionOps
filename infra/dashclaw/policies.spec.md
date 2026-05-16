# DashClaw Governance Policies

**Status**: Phase 4c complete | Date: 2026-05-16
**Purpose**: Define human-in-the-loop (HITL) approval flows for critical account decisions in FBIS

---

## Policy 1: Critical Risk Escalation

**Type**: `require_approval`

**Trigger**:
```json
{
  "action_type": "risk_score_write",
  "verdict_score": { "gte": 80 },
  "verdict_status": "critical"
}
```

**Action**: Block write_risk_score() until human operator approves

**Timeout**: 30 minutes (escalate to ops-oncall if not approved)

**Approvers**: `["fbis-ops"]` (group or individual user)

**Rationale**: 
- Verdict scores ≥80 with status="critical" represent extreme risk accounts requiring human judgment
- Automated freeze/suspension without human review could breach SLA commitments
- 30-min window allows ops team to investigate context (abuse reports, payment status, etc.)

**Compliance Notes**:
- Satisfies regulatory requirement: "Material account actions require documented human review"
- Audit trail: DashClaw decisions table records approver identity + timestamp

---

## Policy 2: Risk Decision Audit Trail

**Type**: `audit_log`

**Trigger**:
```json
{
  "action_type": "risk_score_write",
  "verdict_status": { "in": ["risk", "critical"] }
}
```

**Action**: Record all fields in DashClaw decisions table

**Persist**: Indefinite (compliance retention: 7 years per regulatory framework)

**Fields Logged**:
- `action_id` (UUID from DashClaw)
- `agent_id` ("fbis-verdict")
- `account_id` (source account)
- `verdict_score` (0-100)
- `verdict_status` ("risk" or "critical")
- `proxy_risk`, `isolation_score`, `traffic_quality`, `timeline_risk` (component scores)
- `approver` (operator identity if require_approval triggered)
- `outcome` ("approved" or "rejected")
- `timestamp` (ISO 8601)

**Rationale**:
- Enables compliance audits: full reconstruction of decision logic
- Tracks operator approval patterns (detect bias, training gaps)
- Supports incident RCAs: reverse-engineer what triggered critical verdict

**Compliance Notes**:
- Meets GDPR Article 22 transparency requirement: "Individuals can request reason for automated decision"
- Meets SOC 2 Type II: "Audit trails for material decisions"

---

## Policy 3: Account Freeze Authority

**Type**: `restricted_action`

**Trigger**:
```json
{
  "action_type": "transition_account",
  "to_state": { "in": ["suspended", "retired"] }
}
```

**Constraint**: Only `fbis-verdict` agent can perform this action

**Alert**: Notify `#fbis-ops` Telegram group on freeze transition

**Rationale**:
- Account suspension/retirement are irreversible or expensive to undo
- Restricting to single agent (verdict) prevents accidental freezes from parallel agents (argus, nexus, iris, chrono)
- Ops notification enables immediate human review if decision seems incorrect

**Compliance Notes**:
- Prevents unauthorized data deletion (GDPR-relevant)
- Demonstrates segregation of duties: analysis agents report risk, verdict agent enforces decisions

---

## Risk Score Formula (Regulatory Alignment)

**Verdict Score Calculation**:
```
verdict_score = proxy_risk × 0.25 
              + (100 - isolation_score) × 0.30
              + (100 - traffic_quality) × 0.25
              + timeline_risk × 0.20
```

**Thresholds**:
- 0–30: healthy
- 31–55: watch
- 56–75: risk
- 76–100: critical

**Regulatory Mapping**:
- **Proxy Risk (25%)**: Detection of datacenter/proxy IPs (matches SLA requirement: "Flag proxy abuse within 24h")
- **Isolation Score (30%)**: Account behavioral uniqueness; low isolation = many similar accts (matches: "Identify coordinated fraud rings")
- **Traffic Quality (25%)**: Click/conversion quality from traffic sources (matches: "Monitor for invalid traffic")
- **Timeline Risk (20%)**: Account activity velocity & anomalies (matches: "Detect sudden account escalation")

**Weights Justified**:
- Isolation is heaviest (30%) — coordinated fraud is industry's #1 abuse vector
- Proxy & traffic equally weighted (25% each) — direct fraud indicators
- Timeline secondary (20%) — accounts can scale legitimately
- Sum = 100% ✓

---

## Approval Flow (DashClaw Integration)

```
1. FBIS verdict agent calls write_risk_score(account_id, ...)
   ↓
2. risk.py._claw_guard() checks policies
   - If verdict_score >= 80 AND status="critical" → decision="require_approval"
   ↓
3. risk.py._claw_create_action() creates action in DashClaw
   - action.status = "pending_approval" (if guard triggered require_approval)
   - Audit fields populated
   ↓
4. risk.py._claw_wait_for_approval(action_id)
   - Polls DashClaw for operator decision (30s timeout)
   - Telegram alert sent to fbis-ops channel
   ↓
5. Operator opens DashClaw UI → /actions/{id}
   - Reviews account context, component scores
   - Clicks [Approve] or [Reject]
   ↓
6. risk.py checks outcome
   - If approved: write to D1, record outcome="approved"
   - If rejected: return error, record outcome="rejected"
   ↓
7. Audit trail complete in decisions table
```

---

## Testing Checklist (Phase 4g)

### Synthetic Critical-Risk Account Creation

```bash
# SSH to VPS, create test account with extreme risk
curl -X POST http://localhost:8787/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-critical-2026-05-16@fbis.local",
    "status": "new"
  }'
# → Returns account_id
```

### Trigger Verdict with Critical Scores

```bash
# Call FBIS verdict with all risk factors maxed
curl -X POST http://localhost:8765/risk_score_write \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "test-critical-acct-id",
    "proxy_risk": 95,
    "isolation_score": 10,
    "traffic_quality": 15,
    "timeline_risk": 90
  }'
# Expected: verdict_score = 95*0.25 + (100-10)*0.30 + (100-15)*0.25 + 90*0.20
#         = 23.75 + 27 + 21.25 + 18 = 90 → status="critical"
# Expected action_status = "pending_approval"
```

### Verify Decision Record Created

```sql
SELECT COUNT(*) FROM decisions 
WHERE verdict_status = 'critical' 
  AND created_at > NOW() - INTERVAL '1 hour';
-- Expected: >= 1
```

### Manual Operator Approval Test

1. Open DashClaw UI: http://178.105.137.23:3100/actions
2. Click pending action
3. Review context (account_id, component scores)
4. Click [Approve]
5. Verify: risk.py resumes, writes to D1, records outcome="approved"

### Verify Telegram Alert

- Check `#fbis-ops` channel
- Expected message: "🔴 *FBIS ALERT — CRITICAL*\nAccount: `test-critical-*`\nScore: 90/100\nProxy: 95 | Isolation: 10 | Traffic: 15 | Timeline: 90"

---

## Retention & Compliance

| Data | Retention | Rationale |
|------|-----------|-----------|
| Decisions (audit_log) | 7 years | Regulatory compliance (SOC 2, GDPR) |
| Actions (approval history) | 3 years | Dispute resolution window |
| Account suspension events | Indefinite | Fraud pattern analysis |

---

## Known Limitations & Future Work

1. **No escalation chain yet**: If fbis-ops doesn't approve within 30min, escalates to on-call (TODO: wiring Telegram escalation)
2. **No policy versioning**: Updates overwrite old policies — add version field for audit trail of policy changes
3. **No fine-grained roles**: All fbis-ops can approve; no approval level thresholds (e.g., > 95 score requires 2 approvers)
4. **No rejection reasons**: Operator rejection doesn't record reason — add reason field for learning

---

**Approval Status**: Ready for Phase 4f compliance review & 4g UI registration.
