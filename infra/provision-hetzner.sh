#!/usr/bin/env bash
# infra/provision-hetzner.sh
# สร้าง Hetzner CX22 + deploy FusionOps stack อัตโนมัติ
# Run: HETZNER_TOKEN=xxx bash infra/provision-hetzner.sh
set -e

# ─── Config ──────────────────────────────────────────────────────────────────
HETZNER_TOKEN="${HETZNER_TOKEN:?Set HETZNER_TOKEN env var}"
SERVER_NAME="fusionops-automation"
SERVER_TYPE="cx22"          # 2vCPU, 4GB RAM, €4/mo
IMAGE="ubuntu-24.04"
LOCATION="nbg1"             # Nuremberg (หรือ hel1=Helsinki, fsn1=Falkenstein)
SSH_KEY_NAME="fusionops-key"
SSH_KEY_PATH="$HOME/.ssh/fusionops_hetzner"

API="https://api.hetzner.cloud/v1"
H="Authorization: Bearer $HETZNER_TOKEN"

echo "=== FusionOps Hetzner Provisioning ==="

# ─── Step 1: Create SSH key pair (ถ้ายังไม่มี) ───────────────────────────────
if [ ! -f "$SSH_KEY_PATH" ]; then
  echo "Generating SSH key..."
  ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "fusionops-hetzner"
fi
PUB_KEY=$(cat "${SSH_KEY_PATH}.pub")

# Upload public key to Hetzner (ignore if already exists)
echo "Uploading SSH key to Hetzner..."
KEY_RESPONSE=$(curl -sf -X POST "$API/ssh_keys" \
  -H "$H" -H "Content-Type: application/json" \
  -d "{\"name\":\"$SSH_KEY_NAME\",\"public_key\":\"$PUB_KEY\"}" 2>/dev/null || true)

# Get SSH key ID (existing or newly created)
KEY_ID=$(curl -sf "$API/ssh_keys" -H "$H" | \
  python3 -c "import sys,json; keys=json.load(sys.stdin)['ssh_keys']; \
  match=[k for k in keys if k['name']=='$SSH_KEY_NAME']; \
  print(match[0]['id'] if match else '')")

if [ -z "$KEY_ID" ]; then
  echo "❌ Could not get SSH key ID"
  exit 1
fi
echo "SSH Key ID: $KEY_ID"

# ─── Step 2: Cloud-init script (runs on first boot) ──────────────────────────
CLOUD_INIT=$(cat <<'CLOUDINIT'
#cloud-config
package_update: true
packages:
  - git
  - curl
  - docker.io
  - docker-compose-v2
  - python3
  - python3-pip
  - python3-venv
  - nodejs
  - npm

runcmd:
  - systemctl enable --now docker
  - mkdir -p /opt/fusionops
  - echo "READY" > /opt/fusionops/.setup-ready
CLOUDINIT
)

# ─── Step 3: Create server ────────────────────────────────────────────────────
echo "Creating server $SERVER_NAME ($SERVER_TYPE, $IMAGE, $LOCATION)..."
CREATE_RESPONSE=$(curl -sf -X POST "$API/servers" \
  -H "$H" -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$SERVER_NAME\",
    \"server_type\": \"$SERVER_TYPE\",
    \"image\": \"$IMAGE\",
    \"location\": \"$LOCATION\",
    \"ssh_keys\": [$KEY_ID],
    \"user_data\": $(echo "$CLOUD_INIT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
    \"labels\": {\"project\": \"fusionops\", \"role\": \"automation\"}
  }")

SERVER_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['server']['id'])")
SERVER_IP=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['server']['public_net']['ipv4']['ip'])")

echo "✅ Server created!"
echo "   ID: $SERVER_ID"
echo "   IP: $SERVER_IP"

# ─── Step 4: รอ server พร้อม ────────────────────────────────────────────────
echo "Waiting for server to boot..."
for i in $(seq 1 30); do
  sleep 10
  STATUS=$(curl -sf "$API/servers/$SERVER_ID" -H "$H" | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['server']['status'])" 2>/dev/null || echo "unknown")
  echo "  Status: $STATUS ($((i*10))s)"
  [ "$STATUS" = "running" ] && break
done

# รอ SSH พร้อม
echo "Waiting for SSH..."
for i in $(seq 1 20); do
  sleep 5
  ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
    -i "$SSH_KEY_PATH" "root@$SERVER_IP" "echo ok" 2>/dev/null && break
  echo "  Retrying SSH... ($((i*5))s)"
done

# ─── Step 5: Save server info ────────────────────────────────────────────────
cat > infra/.server <<EOF
SERVER_ID=$SERVER_ID
SERVER_IP=$SERVER_IP
SSH_KEY=$SSH_KEY_PATH
EOF

echo ""
echo "=== Server Ready! ==="
echo ""
echo "IP: $SERVER_IP"
echo "SSH: ssh -i $SSH_KEY_PATH root@$SERVER_IP"
echo ""
echo "Next: fill infra/.env then run:"
echo "  bash infra/deploy.sh"
