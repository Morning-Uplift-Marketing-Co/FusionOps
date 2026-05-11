from fastmcp import FastMCP
from tools._client import api_get

def register(mcp: FastMCP) -> None:

    @mcp.tool()
    async def query_pixel_events(domain: str, days: int = 30) -> dict:
        """
        Query aggregated pixel event stats for a domain.

        Args:
            domain: Domain to query (e.g. 'example.com').
            days:   Lookback window in days (default 30).

        Returns:
            dict with 'data' list of event summaries:
            domain, event, count, unique_sessions, unique_gclids, first_event, last_event
        """
        return await api_get(f"/api/analysis/pixel-events/{domain}", params={"days": days})
