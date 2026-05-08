#!/usr/bin/env bash
# hermes/setup.sh — one-command Hermes + FBIS setup (run from WSL2)
set -e

REPO_WSL="/mnt/h/DEV/projects/ppc_project/ppc-claude-web-V1"

echo "=== 1. Connect FBIS MCP server to Hermes ==="
hermes mcp add fbis http://host.docker.internal:8765/mcp
hermes mcp list

echo "=== 2. Register skills ==="
hermes skill add "$REPO_WSL/hermes/skills/argus.skill.md"
hermes skill add "$REPO_WSL/hermes/skills/nexus.skill.md"
hermes skill add "$REPO_WSL/hermes/skills/iris.skill.md"
hermes skill add "$REPO_WSL/hermes/skills/chrono.skill.md"
hermes skill add "$REPO_WSL/hermes/skills/verdict.skill.md"
hermes skill list

echo "=== 3. Install Paperclip adapter (optional) ==="
hermes mcp add paperclip-adapter http://host.docker.internal:8766/mcp 2>/dev/null || echo "(skip — configure manually)"

echo "=== Done. Start MCP server: pm2 start apps/fbis-mcp-server/pm2.config.js ==="
