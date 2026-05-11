"""MCP tools for proxy pool analysis."""

from mcp.server.fastmcp import FastMCP
from . import _client


def register_proxy_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def get_proxy_pool() -> dict:
        """Get proxy IP groupings — shows how many accounts share each proxy IP.
        High account_count on a single proxy is a ban-spread risk signal.
        """
        return await _client.get("/api/analysis/proxy-pool")
