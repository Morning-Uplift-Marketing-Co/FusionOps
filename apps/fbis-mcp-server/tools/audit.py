"""MCP tools for account↔site link audit."""

from mcp.server.fastmcp import FastMCP
from . import _client


def register_audit_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def get_link_audit() -> dict:
        """Get account-to-site link audit trail (most recent 500 entries).
        Use this to identify accounts linked to high-risk or banned domains.
        """
        return await _client.get("/api/analysis/link-audit")
