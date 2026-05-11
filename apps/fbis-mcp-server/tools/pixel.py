"""MCP tools for pixel event analysis."""

from mcp.server.fastmcp import FastMCP
from . import _client


def register_pixel_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def get_pixel_events_summary() -> dict:
        """Get pixel event counts grouped by campaign_id and event_type.
        Useful for spotting traffic quality anomalies (e.g. zero conversions, bot clicks).
        """
        return await _client.get("/api/analysis/pixel-events")
