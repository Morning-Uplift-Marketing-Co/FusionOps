from fastmcp import FastMCP
from tools._client import api_get

def register(mcp: FastMCP) -> None:

    @mcp.tool()
    async def query_proxy_pool(min_trust: int | None = None) -> dict:
        """
        Query the proxy inventory with fraud and trust scores.

        Args:
            min_trust: Minimum trust_score (0-100) to filter by. None returns all.

        Returns:
            dict with 'data' list of proxy objects each containing:
            id, host, provider, country, city, asn, isp,
            fraud_score, trust_score, latency_ms, status, assigned_to, last_scan_at
        """
        params = {}
        if min_trust is not None:
            params["min_trust"] = min_trust
        return await api_get("/api/analysis/proxy-pool", params=params or None)
