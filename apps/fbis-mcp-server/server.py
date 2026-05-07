import os
from dotenv import load_dotenv
from fastmcp import FastMCP

load_dotenv()

mcp = FastMCP(
    name="fbis",
    instructions="FusionOps Ban Intelligence System MCP server. "
                 "Provides tools for Hermes agents to query account risk data and write analysis results.",
)

from tools.accounts import register as register_accounts
from tools.proxy import register as register_proxy
from tools.pixel import register as register_pixel
from tools.audit import register as register_audit
from tools.risk import register as register_risk

register_accounts(mcp)
register_proxy(mcp)
register_pixel(mcp)
register_audit(mcp)
register_risk(mcp)

if __name__ == "__main__":
    port = int(os.getenv("MCP_PORT", "8765"))
    mcp.run(transport="http", port=port)
