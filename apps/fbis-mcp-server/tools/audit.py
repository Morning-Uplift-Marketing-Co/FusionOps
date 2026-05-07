from fastmcp import FastMCP
from tools._client import api_get

def register(mcp: FastMCP) -> None:

    @mcp.tool()
    async def query_link_audit(account_id: str, days: int = 30) -> dict:
        """
        Query the link/unlink/rotate audit trail for one account.

        Args:
            account_id: The ops_accounts.id to query.
            days:       Lookback window in days (default 30).

        Returns:
            dict with 'data' list of audit records:
            id, account_id, profile_id, proxy_ip, proxy_provider,
            trust_score, action, details, created_at
        """
        return await api_get(f"/api/analysis/link-audit/{account_id}", params={"days": days})

    @mcp.tool()
    async def query_ban_events(days: int | None = None) -> dict:
        """
        Query all recorded ban events.

        Args:
            days: If provided, limit to bans in the last N days. None returns all.

        Returns:
            dict with 'data' list of ban records:
            id, account_id, domain, ban_reason, ban_date,
            days_active, risk_score_at_ban, notes
        """
        params = {}
        if days is not None:
            params["days"] = days
        return await api_get("/api/analysis/ban-events", params=params or None)
