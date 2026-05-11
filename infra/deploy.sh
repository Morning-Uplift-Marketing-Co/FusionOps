#!/usr/bin/env bash
# infra/deploy.sh — Deploy FusionOps stack to Hetzner server
# Run after provision-hetzner.sh + filling .env
set -e

source infra/.server  # SERVER_IP, SSH_KEY
ENV_FILE="infra/.env"

[ -f "$ENV_FILE" ] || { echo "❌ infra/.env not found. Copy from .env.example and fill in."; exit 1; }

echo "=== Deploying FusionOps to $SERVER_IP ==="

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no root@$SERVER_IP"
SCP="scp -i $SSH_KEY -o StrictHostKeyChecking=no"

# ─── Upload project files ───────────────────────────────────────────────────
echo "Uploading project..."
$SSH "mkdir -p /opt/fusionops"
rsync -az --exclude='.git' --exclude='node_modules' --exclude='.venv' \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  . "root@$SERVER_IP:/opt/fusionops/"

# Upload .env
$SCP "$ENV_FILE" "root@$SERVER_IP:/opt/fusionops/infra/.env"

# ─── Install Hermes Agent ───────────────────────────────────────────────────
echo "Installing Hermes Agent..."
$SSH "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash"

# ─── Configure Hermes ──────────────────────────────────────────────────────
echo "Configuring Hermes..."
$SSH "mkdir -p ~/.hermes && \
  cp /opt/fusionops/infra/hermes/config.yaml ~/.hermes/config.yaml && \
  cp /opt/fusionops/infra/hermes/SOUL.md ~/.hermes/SOUL.md"

# Inject secrets from .env into hermes .env
$SSH "cd /opt/fusionops && grep -E 'OPENROUTER|TELEGRAM|MEM0' infra/.env >> ~/.hermes/.env || true"

# ─── Start Docker services ─────────────────────────────────────────────────
echo "Starting Docker services..."
$SSH "cd /opt/fusionops/infra && docker compose up -d"

# ─── Setup cron ────────────────────────────────────────────────────────────
echo "Setting up cron..."
$SSH 'crontab -l 2>/dev/null | grep -v fusionops | { cat; echo "
# FusionOps automation
0 15 * * * cd /opt/fusionops && ~/.hermes/bin/hermes --print \"run FBIS analysis\" >> /var/log/fbis.log 2>&1
0 1 * * * cd /opt/fusionops && ~/.hermes/bin/hermes --print \"run ads-reporter\" >> /var/log/ads-report.log 2>&1
0 2 * * * cd /opt/fusionops && ~/.hermes/bin/hermes --print \"run gmail-warmer\" >> /var/log/gmail-warm.log 2>&1
"; } | crontab -'

# ─── Health check ──────────────────────────────────────────────────────────
echo "Checking services..."
$SSH "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo ""
echo "=== Deploy Complete! ==="
echo ""
echo "Services:"
echo "  fbis-mcp:        http://$SERVER_IP:8765/mcp"
echo "  browser-mcp:     http://$SERVER_IP:8766/mcp"
echo "  mission-control: http://$SERVER_IP:3001"
echo ""
echo "SSH: ssh -i $SSH_KEY root@$SERVER_IP"
echo "Hermes: $SSH 'hermes'"
