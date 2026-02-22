#!/usr/bin/env bash
# ============================================================
# Deployment Script — LP Factory
# ============================================================
# Usage:
#   ./scripts/deploy.sh [environment] [component]
#
# Examples:
#   ./scripts/deploy.sh production all        # Deploy everything
#   ./scripts/deploy.sh production lander     # Deploy lander only
#   ./scripts/deploy.sh production worker     # Deploy worker only
#   ./scripts/deploy.sh staging worker        # Deploy worker to staging
#
# Prerequisites:
#   - wrangler CLI authenticated
#   - CLOUDFLARE_ACCOUNT_ID set
#   - CLOUDFLARE_API_TOKEN set (for Pages API)
# ============================================================

set -euo pipefail

ENVIRONMENT="${1:-production}"
COMPONENT="${2:-all}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# ============================================================
# Validation
# ============================================================

validate_env() {
  local missing=0

  if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
    err "CLOUDFLARE_ACCOUNT_ID is not set"
    missing=1
  fi

  if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    err "CLOUDFLARE_API_TOKEN is not set"
    missing=1
  fi

  if [[ "$missing" -eq 1 ]]; then
    err "Missing required environment variables. Aborting."
    exit 1
  fi
}

# ============================================================
# D1 Migration
# ============================================================

run_migrations() {
  log "Running D1 migrations..."
  cd "$ROOT_DIR/apps/worker"

  if [[ "$ENVIRONMENT" == "production" ]]; then
    npx wrangler d1 execute lp-factory-db --remote --file=./migrations/0001_init.sql --yes
  else
    npx wrangler d1 execute lp-factory-db-staging --remote --file=./migrations/0001_init.sql --yes
  fi

  log "Migrations complete."
  cd "$ROOT_DIR"
}

# ============================================================
# Worker Deployment
# ============================================================

deploy_worker() {
  log "Deploying Worker ($ENVIRONMENT)..."
  cd "$ROOT_DIR/apps/worker"

  # Install dependencies
  npm ci --prefer-offline 2>/dev/null || npm install

  if [[ "$ENVIRONMENT" == "production" ]]; then
    npx wrangler deploy
  else
    npx wrangler deploy --env staging
  fi

  log "Worker deployed successfully."
  cd "$ROOT_DIR"
}

# ============================================================
# Lander Build & Deploy
# ============================================================

build_lander() {
  log "Building Lander ($ENVIRONMENT)..."
  cd "$ROOT_DIR/apps/lander"

  # Install dependencies
  npm ci --prefer-offline 2>/dev/null || npm install

  # Build static site
  npm run build

  log "Lander built successfully. Output: dist/"
  cd "$ROOT_DIR"
}

deploy_lander_pages() {
  log "Deploying Lander to Cloudflare Pages..."
  cd "$ROOT_DIR/apps/lander"

  local PROJECT_NAME="${PAGES_PROJECT_NAME:-lp-factory-lander}"
  local BRANCH="main"

  if [[ "$ENVIRONMENT" != "production" ]]; then
    BRANCH="staging"
  fi

  # Deploy via wrangler pages
  npx wrangler pages deploy dist/ \
    --project-name="$PROJECT_NAME" \
    --branch="$BRANCH" \
    --commit-dirty=true

  log "Lander deployed to Cloudflare Pages."
  cd "$ROOT_DIR"
}

# ============================================================
# Domain Binding (Manual Step Helper)
# ============================================================

print_domain_instructions() {
  log "=========================================="
  log "POST-DEPLOYMENT: Domain Binding"
  log "=========================================="
  log ""
  log "To bind a custom domain to Pages:"
  log "  1. Go to Cloudflare Dashboard → Pages → Your Project → Custom domains"
  log "  2. Add your domain (e.g., yourdomain.com)"
  log "  3. DNS will be configured automatically"
  log ""
  log "To bind Worker routes for the callback API:"
  log "  wrangler routes add 'api.yourdomain.com/*' --zone=ZONE_ID"
  log ""
  log "Or add to wrangler.toml:"
  log "  [[routes]]"
  log "  pattern = \"api.yourdomain.com/*\""
  log "  zone_name = \"yourdomain.com\""
  log ""
  log "=========================================="
}

# ============================================================
# Main
# ============================================================

main() {
  log "Starting deployment: env=$ENVIRONMENT component=$COMPONENT"
  validate_env

  case "$COMPONENT" in
    all)
      run_migrations
      deploy_worker
      build_lander
      deploy_lander_pages
      print_domain_instructions
      ;;
    worker)
      run_migrations
      deploy_worker
      ;;
    lander)
      build_lander
      deploy_lander_pages
      ;;
    migrate)
      run_migrations
      ;;
    *)
      err "Unknown component: $COMPONENT"
      err "Usage: $0 [environment] [all|worker|lander|migrate]"
      exit 1
      ;;
  esac

  log "Deployment complete!"
}

main "$@"
