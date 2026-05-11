"""MCP tools for risk scoring + agent KPIs + Telegram alerts."""

import os
import httpx
from mcp.server.fastmcp import FastMCP
from . import _client

_TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
_TELEGRAM_CHAT = os.getenv("TELEGRAM_CHAT_ID", "")


async def _send_telegram(message: str) -> bool:
    if not _TELEGRAM_TOKEN or not _TELEGRAM_CHAT:
        return False
    url = f"https://api.telegram.org/bot{_TELEGRAM_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(url, json={"chat_id": _TELEGRAM_CHAT, "text": message, "parse_mode": "HTML"})
        return r.status_code == 200


def register_risk_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def get_risk_scores() -> dict:
        """Get the latest computed risk scores for all accounts (sorted highest first)."""
        return await _client.get("/api/analysis/risk-scores")

    @mcp.tool()
    async def upsert_risk_score(account_id: str, score: float, flags: list[str] | None = None) -> dict:
        """Write or update a risk score for an account.
        score: 0.0 (clean) to 1.0 (critical ban risk).
        flags: list of string identifiers, e.g. ['shared_proxy', 'high_cpc_variance'].
        Sends Telegram alert when score >= 0.7.
        """
        result = await _client.post(
            "/api/analysis/risk-scores",
            {"account_id": account_id, "score": score, "flags": flags or []},
        )
        if score >= 0.7 and _TELEGRAM_TOKEN:
            flag_str = ", ".join(flags or []) or "none"
            await _send_telegram(
                f"🚨 <b>High Risk Account</b>\n"
                f"ID: <code>{account_id}</code>\n"
                f"Score: <b>{score:.2f}</b>\n"
                f"Flags: {flag_str}"
            )
        return result

    @mcp.tool()
    async def get_agent_kpis() -> dict:
        """Get agent performance summary for the last 7 days (avg/max/min per metric)."""
        return await _client.get("/api/analysis/agent-kpis")

    @mcp.tool()
    async def record_agent_kpi(agent_name: str, metric: str, value: float) -> dict:
        """Record a single KPI data point for a Hermes agent.
        agent_name: argus | nexus | iris | chrono | verdict
        metric: e.g. accounts_checked | bans_detected | latency_ms | api_calls
        """
        return await _client.post(
            "/api/analysis/agent-kpis",
            {"agent_name": agent_name, "metric": metric, "value": value},
        )

    @mcp.tool()
    async def send_alert(message: str) -> dict:
        """Send a free-form alert message to the configured Telegram channel."""
        sent = await _send_telegram(message)
        return {"ok": sent, "message": message}
