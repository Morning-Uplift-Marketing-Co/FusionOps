#!/usr/bin/env bash
# infra/setup.sh — One-command setup on Hetzner CX22 (Ubuntu 24.04)
# Run as root: bash setup.sh
set -e

PROJECT_REPO="https://github.com/YOUR_USER/ppc-claude-web-V1.git"  # แก้ตรงนี้
PROJECT_DIR="/opt/fusionops"

echo "=== FusionOps Automation Stack Setup ==="
echo "Server: $(hostname) | $(date)"

# ─── System packages ────────────────────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq git curl wget docker.io docker-compose-v2 \
  python3 python3-pip python3-venv nodejs npm

# Docker daemon
systemctl enable --now docker

# ─── Clone project ────────────────────────────────────────────────────────
if [ ! -d "$PROJECT_DIR" ]; then
  git clone "$PROJECT_REPO" "$PROJECT_DIR"
fi
cd "$PROJECT_DIR"

# ─── Install Hermes Agent ─────────────────────────────────────────────────
echo "Installing Hermes Agent..."
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash

# ─── Configure Hermes ─────────────────────────────────────────────────────
mkdir -p ~/.hermes
cp infra/hermes/config.yaml ~/.hermes/config.yaml
cp infra/hermes/SOUL.md ~/.hermes/SOUL.md

echo "⚠️  Copy infra/.env.example to infra/.env and fill in secrets first!"
echo "   Then run: cp infra/.env.example infra/.env && nano infra/.env"

# ─── Docker Compose ───────────────────────────────────────────────────────
if [ -f "infra/.env" ]; then
  echo "Starting Docker services..."
  cd infra
  docker compose up -d
  echo "✅ Services started:"
  docker compose ps
else
  echo "⏭️  Skipping Docker start — .env not found"
fi

# ─── Hermes cron setup ───────────────────────────────────────────────────
# Add to crontab after hermes is configured
echo "
# FusionOps automation schedule
# 22:00 Bangkok (15:00 UTC) — FBIS nightly
0 15 * * * cd $PROJECT_DIR && hermes --print 'run FBIS analysis: argus, nexus, iris, chrono, then verdict' >> /var/log/fbis.log 2>&1
# 08:00 Bangkok (01:00 UTC) — Ads daily report
0 1 * * * cd $PROJECT_DIR && hermes --print 'run ads-reporter' >> /var/log/ads-report.log 2>&1
# 09:00 Bangkok (02:00 UTC) — Gmail warming
0 2 * * * cd $PROJECT_DIR && hermes --print 'run gmail-warmer for all accounts with status warming' >> /var/log/gmail-warm.log 2>&1
" | crontab -

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Fill in infra/.env"
echo "  2. Run: hermes setup  (configure OpenRouter + Telegram)"
echo "  3. Run: docker compose -f infra/docker-compose.yml up -d"
echo "  4. Open Mission Control: http://$(curl -s ifconfig.me):3001"
echo "  5. Test: hermes 'run ads-reporter'"
