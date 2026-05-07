from fastmcp import FastMCP
from tools._client import api_get

def register(mcp: FastMCP) -> None:

    @mcp.tool()
    async def query_accounts(status: str | None = None) -> dict:
        """
        Query all Google Ads accounts with their linked profile, proxy, and payment card.

        Args:
            status: Filter by account status — 'active', 'paused', 'retired', or None for all.

        Returns:
            dict with 'data' list of account objects each containing:
            id, label, email, status, monthly_spend, proxy_ip, lifecycle_state,
            browser_type, fingerprint_os, last_ip, last_trust_score,
            fraud_score, trust_score, asn, isp, last4, bank_name
        """
        params = {}
        if status:
            params["status"] = status
        return await api_get("/api/analysis/accounts", params=params or None)
