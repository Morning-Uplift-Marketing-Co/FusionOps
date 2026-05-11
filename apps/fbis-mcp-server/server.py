"""FBIS MCP Server — exposes FusionOps analysis endpoints as MCP tools."""

import asyncio
import os
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()

from tools.accounts import register_accounts_tools
from tools.proxy import register_proxy_tools
from tools.pixel import register_pixel_tools
from tools.audit import register_audit_tools
from tools.risk import register_risk_tools

mcp = FastMCP("fbis-mcp-server")

register_accounts_tools(mcp)
register_proxy_tools(mcp)
register_pixel_tools(mcp)
register_audit_tools(mcp)
register_risk_tools(mcp)

if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", "8765"))
    mcp.run(transport="sse")
