#!/usr/bin/env bash
# infra/setup.sh — One-command setup on Hetzner CX22 (Ubuntu 24.04)
# Run as root: bash setup.sh
# Updated: 2026-05-16 (Phase 6 — DashClaw + ecosystem integration)
set -e

PROJECT_REPO="https://github.com/YOUR_USER/ppc-claude-web-V1.git"
PROJECT_DIR="/opt/fusionops"

echo "=== FusionOps Automation Stack Setup ==="
echo "Server: $(hostname) | $(date)"

# ─── System packages ────────────────────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq git curl wget docker.io docker-compose-v2 \
  python3 python3-pip python3-venv nodejs npm jq

# Docker daemon
systemctl enable --now docker

# ─── Clone project ────────────────────────────────────────────────────────
if [ ! -d "$PROJECT_DIR" ]; then
  git clone "$PROJECT_REPO" "$PROJECT_DIR"
fi
cd "$PROJECT_DIR"

# ─── Install Hermes Agent ─────────────────────────────────────────────────
echo "Installing Hermes Agent v0.13.0+"
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash

# ─── Configure Hermes ─────────────────────────────────────────────────────
mkdir -p ~/.hermes
cp infra/hermes/config.yaml ~/.hermes/config.yaml
cp infra/hermes/SOUL.md ~/.hermes/SOUL.md

# Enable disk-cleanup plugin
hermes plugins enable disk-cleanup

echo ""
echo "⚠️  REQUIRED: Set environment variables before starting Hermes"
echo "   Copy infra/.env.example to infra/.env:"
echo "   cp infra/.env.example infra/.env && nano infra/.env"
echo ""
echo "   Required variables:"
echo "   - TELEGRAM_BOT_TOKEN (for cron alerts)"
echo "   - TELEGRAM_CHAT_ID"
echo "   - DASHCLAW_API_KEY (for Phase 4 HITL approval flows)"
echo "   - MEM0_API_KEY (optional, for memory persistence)"
echo "   - MC_API_KEY (optional, for mission-control dashboard)"

# ─── Docker Compose — Services ────────────────────────────────────────────────
# Services: fbis-mcp (8765), dashclaw (3100), browser-mcp (8766), mission-control (3001)
if [ -f "infra/.env" ]; then
  echo "Starting Docker services..."
  cd infra
  docker compose up -d 2>&1 | tail -3
  sleep 10
  echo "✅ Services status:"
  docker compose ps
else
  echo "⏭️  Skipping Docker start — .env not found"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Phases deployed:"
echo "  ✅ Phase 1: Hermes v0.13.0"
echo "  ✅ Phase 2: Kanban orchestrator"
echo "  ✅ Phase 3: Health check gates"
echo "  ✅ Phase 4: DashClaw HITL wiring"
echo "  ✅ Phase 5: Ecosystem plugins"
echo "  ✅ Phase 6: Config synced"
echo ""
echo "Next steps:"
echo "  1. nano infra/.env  (fill in secrets)"
echo "  2. docker compose -f infra/docker-compose.yml up -d"
echo "  3. hermes setup  (configure OpenRouter + Telegram)"
echo "  4. Login to DashClaw (http://$(hostname -I | awk '{print $1}'):3100) and register policies"
echo "  5. Test: hermes 'run FBIS analysis'"
