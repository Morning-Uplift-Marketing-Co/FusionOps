import os
import json
import httpx
from fastmcp import FastMCP
from tools._client import api_post

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
DASHCLAW_BASE = os.getenv("DASHCLAW_BASE_URL", "http://localhost:3100")
DASHCLAW_API_KEY = os.getenv("DASHCLAW_API_KEY", "")

def register(mcp: FastMCP) -> None:

    @mcp.tool()
    async def write_risk_score(
        account_id: str,
        proxy_risk: int,
        isolation_score: int,
        traffic_quality: int,
        timeline_risk: int,
    ) -> dict:
        """
        Write computed risk scores for one account. VERDICT calls this after
        all 4 component agents have reported.

        HITL flow (DashClaw integration):
        1. claw.guard() → check policy before acting
        2. claw.createAction() → create action (authoritative gate)
        3. If pending_approval → claw.waitForApproval() → wait for human
        4. Write to D1 only if approved
        5. claw.updateOutcome() → record outcome

        verdict_score formula:
          proxy_risk * 0.25 + (100 - isolation_score) * 0.30
          + (100 - traffic_quality) * 0.25 + timeline_risk * 0.20

        verdict_status thresholds:
          0-30  → healthy
          31-55 → watch
          56-75 → risk
          76-100 → critical
        """
        # Input validation: ensure all scores are in valid range [0, 100]
        for score, name in [
            (proxy_risk, "proxy_risk"),
            (isolation_score, "isolation_score"),
            (traffic_quality, "traffic_quality"),
            (timeline_risk, "timeline_risk"),
        ]:
            if not (0 <= score <= 100):
                return {
                    "ok": False,
                    "error": f"{name} must be between 0 and 100, got {score}",
                }

        verdict_score = int(
            proxy_risk * 0.25
            + (100 - isolation_score) * 0.30
            + (100 - traffic_quality) * 0.25
            + timeline_risk * 0.20
        )
        if verdict_score <= 30:
            status = "healthy"
        elif verdict_score <= 55:
            status = "watch"
        elif verdict_score <= 75:
            status = "risk"
        else:
            status = "critical"

        # HITL Step 1: Check policy before acting
        claw_decision = await _claw_guard(
            action_type="risk_score_write",
            declared_goal=f"Write risk score for account {account_id}",
            risk_score=verdict_score,
            verdict_status=status,
        )

        if claw_decision.get("decision") == "block":
            return {
                "ok": False,
                "error": "DashClaw policy BLOCKED this action",
                "decision": "block",
            }

        # HITL Step 2: Create action in DashClaw (authoritative gate)
        action_result = await _claw_create_action(
            action_type="risk_score_write",
            declared_goal=f"Write risk score for account {account_id}",
            risk_score=verdict_score,
            context={
                "account_id": account_id,
                "verdict_status": status,
                "proxy_risk": proxy_risk,
                "isolation_score": isolation_score,
                "traffic_quality": traffic_quality,
                "timeline_risk": timeline_risk,
            },
        )

        if not action_result.get("ok"):
            return {
                "ok": False,
                "error": f"Failed to create DashClaw action: {action_result.get('error')}",
            }

        action_id = action_result.get("action_id", "")
        action_status = action_result.get("action", {}).get("status", "completed")

        # HITL Step 3: If pending approval, wait for human operator
        if action_status == "pending_approval":
            approval_result = await _claw_wait_for_approval(action_id)
            if not approval_result.get("approved"):
                await _claw_update_outcome(
                    action_id, status="rejected",
                    note="Operator rejected critical risk decision",
                )
                return {
                    "ok": False,
                    "error": f"Operator REJECTED action {action_id}",
                    "action_id": action_id,
                    "decision": "rejected",
                }

        # HITL Step 4: Write to D1 (now approved or auto-approved)
        result = await api_post("/api/analysis/risk-score", {
            "account_id": account_id,
            "proxy_risk": proxy_risk,
            "isolation_score": isolation_score,
            "traffic_quality": traffic_quality,
            "timeline_risk": timeline_risk,
            "verdict_score": verdict_score,
            "verdict_status": status,
        })

        # HITL Step 5: Record outcome
        await _claw_update_outcome(
            action_id, status="completed",
            note=f"Risk score {verdict_score} written to D1",
        )

        # Send Telegram alert for risk/critical
        if status in ("risk", "critical") and TELEGRAM_TOKEN and TELEGRAM_CHAT_ID:
            emoji = "🟠" if status == "risk" else "🔴"
            # Escape account_id for Telegram Markdown (backticks)
            safe_account_id = account_id.replace("`", "\\`").replace("*", "\\*").replace("_", "\\_")
            msg = (
                f"{emoji} *FBIS ALERT — {status.upper()}*\n"
                f"Account: `{safe_account_id}`\n"
                f"Score: {verdict_score}/100\n"
                f"Proxy: {proxy_risk} | Isolation: {isolation_score} | "
                f"Traffic: {traffic_quality} | Timeline: {timeline_risk}"
            )
            await _send_telegram(msg)

        return {
            **result,
            "verdict_score": verdict_score,
            "verdict_status": status,
            "action_id": action_id,
            "decision": "approved",
        }

    @mcp.tool()
    async def write_agent_kpi(
        agent_name: str,
        kpi_name: str,
        kpi_value: float,
        kpi_target: float,
        kpi_unit: str = "%",
    ) -> dict:
        """
        Record a KPI measurement for a Hermes agent.

        Args:
            agent_name: 'argus' | 'nexus' | 'iris' | 'chrono' | 'verdict'
            kpi_name:   e.g. 'clean_proxy_rate', 'isolation_score_avg'
            kpi_value:  Measured value.
            kpi_target: Target value from PRD.
            kpi_unit:   '%', 'days', 'score', 'count' (default '%')

        Returns:
            dict with 'ok'
        """
        valid_agents = {"argus", "nexus", "iris", "chrono", "verdict"}
        if agent_name not in valid_agents:
            return {"ok": False, "error": f"agent_name must be one of {valid_agents}"}
        return await api_post("/api/analysis/agent-kpi", {
            "agent_name": agent_name,
            "kpi_name": kpi_name,
            "kpi_value": kpi_value,
            "kpi_target": kpi_target,
            "kpi_unit": kpi_unit,
        })


async def _send_telegram(text: str) -> None:
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": "Markdown",
            })
            if resp.status_code != 200:
                print(f"[telegram] alert failed with HTTP {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[telegram] alert failed: {e}")


# ── DashClaw HITL Integration ────────────────────────────────────────────────

async def _claw_guard(
    action_type: str, declared_goal: str, risk_score: int, verdict_status: str = ""
) -> dict:
    """Check DashClaw policy before acting. Returns decision verdict."""
    if not DASHCLAW_API_KEY:
        return {"ok": True, "decision": "allow"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{DASHCLAW_BASE}/api/guard",
                json={
                    "action_type": action_type,
                    "declared_goal": declared_goal,
                    "risk_score": risk_score,
                    "context": {"verdict_status": verdict_status},
                },
                headers={"x-api-key": DASHCLAW_API_KEY},
            )
            if resp.status_code == 200:
                return resp.json()
            return {"ok": False, "decision": "warn"}
    except Exception as e:
        print(f"[claw] guard check failed: {e}")
        return {"ok": False, "decision": "warn"}


async def _claw_create_action(
    action_type: str, declared_goal: str, risk_score: int, context: dict = None
) -> dict:
    """Create an action record in DashClaw."""
    if not DASHCLAW_API_KEY:
        return {"ok": True, "action_id": "", "action": {"status": "completed"}}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{DASHCLAW_BASE}/api/actions",
                json={
                    "action_type": action_type,
                    "declared_goal": declared_goal,
                    "risk_score": risk_score,
                    "context": json.dumps(context or {}),
                },
                headers={"x-api-key": DASHCLAW_API_KEY},
            )
            if resp.status_code == 201:
                return resp.json()
            return {"ok": False, "error": f"HTTP {resp.status_code}", "action_id": ""}
    except Exception as e:
        print(f"[claw] create_action failed: {e}")
        return {"ok": False, "error": str(e), "action_id": ""}


async def _claw_wait_for_approval(action_id: str) -> dict:
    """Wait for human operator approval of a pending action."""
    if not DASHCLAW_API_KEY:
        return {"ok": True, "approved": True}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{DASHCLAW_BASE}/api/actions/{action_id}/wait",
                headers={"x-api-key": DASHCLAW_API_KEY},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"ok": True, "approved": data.get("approved", False)}
            return {"ok": False, "approved": False}
    except Exception as e:
        print(f"[claw] wait_for_approval failed: {e}")
        return {"ok": False, "approved": False}


async def _claw_update_outcome(
    action_id: str, status: str, note: str = ""
) -> dict:
    """Record the outcome of an action (completed, rejected, etc)."""
    if not DASHCLAW_API_KEY:
        return {"ok": True}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(
                f"{DASHCLAW_BASE}/api/actions/{action_id}",
                json={"status": status, "note": note},
                headers={"x-api-key": DASHCLAW_API_KEY},
            )
            return {"ok": resp.status_code in (200, 204)}
    except Exception as e:
        print(f"[claw] update_outcome failed: {e}")
        return {"ok": False}
