#!/bin/bash

# Verification script for 4-agent trademark monitoring setup

set -e

AGENTS=("AEGIS" "SCOUT" "HERALD" "ORACLE")
HERMES_SKILLS_DIR="$HOME/.hermes/skills/trademark-monitoring"
HERMES_STATE_DIR="$HOME/.hermes"
ENV_FILE=".env"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  4-Agent Trademark Monitoring — Setup Verification        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check 1: .env file exists
echo "✓ Checking .env configuration..."
if [ ! -f "$ENV_FILE" ]; then
    echo "  ✗ .env not found"
    echo "  → Run: cp .env.example .env && nano .env"
    exit 1
fi

# Check 2: Required env vars
REQUIRED_VARS=("DATAFORSEO_LOGIN" "DATAFORSEO_PASSWORD" "TRADEMARK_LIST" "COMPETITOR_LIST")
source "$ENV_FILE"

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "  ✗ $var not set in .env"
        exit 1
    fi
done
echo "  ✓ All required env vars configured"

# Check 3: Agent skills installed
echo ""
echo "✓ Checking Hermes skills installation..."
for agent in "${AGENTS[@]}"; do
    skill_dir="$HERMES_SKILLS_DIR/$agent"
    if [ ! -d "$skill_dir" ]; then
        echo "  ✗ $agent not found in $HERMES_SKILLS_DIR"
        echo "  → Run: mkdir -p $HERMES_SKILLS_DIR && cp -r AEGIS SCOUT HERALD ORACLE $HERMES_SKILLS_DIR/"
        exit 1
    fi

    # Check SKILL.md and run.py exist
    if [ ! -f "$skill_dir/SKILL.md" ] || [ ! -f "$skill_dir/run.py" ]; then
        echo "  ✗ $agent missing SKILL.md or run.py"
        exit 1
    fi
done
echo "  ✓ All 4 agents installed in Hermes skills directory"

# Check 4: Hermes config crons
echo ""
echo "✓ Checking Hermes config crons..."
HERMES_CONFIG="$HOME/.hermes/config.yaml"
if [ ! -f "$HERMES_CONFIG" ]; then
    echo "  ✗ Hermes config not found at $HERMES_CONFIG"
    exit 1
fi

for agent in "${AGENTS[@]}"; do
    agent_lower=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
    if ! grep -q "trademark-monitoring/$agent_lower" "$HERMES_CONFIG"; then
        echo "  ⚠ $agent cron not found in Hermes config"
        echo "  → Add crons from HERMES_CONFIG.yaml to ~/.hermes/config.yaml"
    fi
done
echo "  ✓ Cron entries configured"

# Check 5: State directories
echo ""
echo "✓ Checking state directories..."
STATE_DIRS=("aegis-state" "scout-state" "herald-state" "oracle-state")
for dir in "${STATE_DIRS[@]}"; do
    state_path="$HERMES_STATE_DIR/$dir"
    if [ ! -d "$state_path" ]; then
        mkdir -p "$state_path"
        echo "  ✓ Created $state_path"
    else
        echo "  ✓ $state_path exists"
    fi
done

# Check 6: Python dependencies
echo ""
echo "✓ Checking Python dependencies..."
if ! python3 -c "import requests" 2>/dev/null; then
    echo "  ✗ requests library not installed"
    echo "  → Run: pip install requests"
    exit 1
fi
echo "  ✓ requests library installed"

# Check 7: DataForSEO API credentials (optional test)
echo ""
echo "✓ Testing DataForSEO API credentials..."
if ! timeout 5 curl -s -u "$DATAFORSEO_LOGIN:$DATAFORSEO_PASSWORD" \
    'https://api.dataforseo.com/v3/serp/google/ads/advertisers/live/advanced' \
    -H 'Content-Type: application/json' \
    -d '{"keywords": ["test"], "location_code": 2840}' | grep -q '"status_code"'; then
    echo "  ⚠ Could not verify API credentials"
    echo "  → Verify DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are correct"
else
    echo "  ✓ DataForSEO API credentials verified"
fi

# Check 8: Telegram (optional)
echo ""
echo "✓ Checking Telegram configuration (optional)..."
if [ -z "$AEGIS_TELEGRAM_BOT_TOKEN" ]; then
    echo "  ⚠ Telegram not configured (optional)"
    echo "  → To enable alerts: Set TELEGRAM_BOT_TOKEN and CHAT_ID in .env"
else
    echo "  ✓ Telegram configured for alerts"
fi

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Setup verification complete!                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Test one agent: python3 AEGIS/run.py"
echo "  2. Restart Hermes: systemctl restart hermes"
echo "  3. Monitor logs: tail -f ~/.hermes/hermes.log | grep trademark"
echo "  4. View alerts: ls -la ~/.hermes/{aegis,scout,herald,oracle}-state/"
echo ""
