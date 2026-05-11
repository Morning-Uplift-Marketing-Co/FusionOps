"""MCP tools for Google Ads account lifecycle analysis."""

from mcp.server.fastmcp import FastMCP
from . import _client


def register_accounts_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def list_accounts_with_risk() -> dict:
        """List all ops_accounts with linked sites and current risk metadata."""
        return await _client.get("/api/analysis/accounts")

    @mcp.tool()
    async def get_ban_events(account_id: str = "") -> dict:
        """Retrieve ban events. Pass account_id to filter by account, or omit for all recent events."""
        path = "/api/analysis/ban-events"
        if account_id:
            path += f"?account_id={account_id}"
        return await _client.get(path)

    @mcp.tool()
    async def log_ban_event(
        account_id: str,
        ban_type: str,
        platform: str = "",
        reason: str = "",
        evidence: str = "",
    ) -> dict:
        """Record a ban event for an account and update its lifecycle_stage to 'banned'.

        ban_type options: policy_violation | payment | quality | manual
        platform options: google_ads | meta | tiktok | voluum
        """
        return await _client.post(
            "/api/analysis/ban-events",
            {
                "account_id": account_id,
                "ban_type": ban_type,
                "platform": platform,
                "reason": reason,
                "evidence": evidence,
            },
        )
