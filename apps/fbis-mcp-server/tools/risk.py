import os
import httpx
from fastmcp import FastMCP
from tools._client import api_post

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

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

        verdict_score formula:
          proxy_risk * 0.25 + (100 - isolation_score) * 0.30
          + (100 - traffic_quality) * 0.25 + timeline_risk * 0.20

        verdict_status thresholds:
          0-30  → healthy
          31-55 → watch
          56-75 → risk
          76-100 → critical

        Args:
            account_id:       ops_accounts.id
            proxy_risk:       0-100 (ARGUS output)
            isolation_score:  0-100 (NEXUS output, higher = better isolated)
            traffic_quality:  0-100 (IRIS output, higher = better quality)
            timeline_risk:    0-100 (CHRONO output)

        Returns:
            dict with 'ok', 'verdict_score', 'verdict_status'
        """
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

        result = await api_post("/api/analysis/risk-score", {
            "account_id": account_id,
            "proxy_risk": proxy_risk,
            "isolation_score": isolation_score,
            "traffic_quality": traffic_quality,
            "timeline_risk": timeline_risk,
            "verdict_score": verdict_score,
            "verdict_status": status,
        })

        if status in ("risk", "critical") and TELEGRAM_TOKEN and TELEGRAM_CHAT_ID:
            emoji = "🟠" if status == "risk" else "🔴"
            msg = (
                f"{emoji} *FBIS ALERT — {status.upper()}*\n"
                f"Account: `{account_id}`\n"
                f"Score: {verdict_score}/100\n"
                f"Proxy: {proxy_risk} | Isolation: {isolation_score} | "
                f"Traffic: {traffic_quality} | Timeline: {timeline_risk}"
            )
            await _send_telegram(msg)

        return {**result, "verdict_score": verdict_score, "verdict_status": status}

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
            await client.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": "Markdown",
            })
    except Exception:
        pass  # alerts are best-effort
