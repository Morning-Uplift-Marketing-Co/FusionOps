#!/bin/bash
# ============================================================
# FusionOps - Infrastructure Setup Script
# ============================================================
# Creates Cloudflare D1 databases, runs migrations, and deploys workers
#
# Prerequisites:
#   - Node.js 20+
#   - Wrangler CLI installed: npm install -g wrangler
#   - Logged in to Cloudflare: wrangler login
#   - Logged in to GitHub: gh auth login (optional)
# ============================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_NAME="fusionops"
D1_MAIN="${PROJECT_NAME}-main"
D1_PIXEL="${PROJECT_NAME}-pixel"
D1_CALLBACK="${PROJECT_NAME}-callback"

# ============================================================
# Helper Functions
# ============================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 is not installed"
        exit 1
    fi
}

confirm() {
    read -p "$1 (y/n): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# ============================================================
# Pre-flight Checks
# ============================================================

preflight_check() {
    print_step "Pre-flight Checks"

    log_info "Checking required tools..."

    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        log_success "Node.js: $NODE_VERSION"
    else
        log_error "Node.js is not installed"
        exit 1
    fi

    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        log_success "npm: $NPM_VERSION"
    else
        log_error "npm is not installed"
        exit 1
    fi

    # Check Wrangler
    if command -v wrangler &> /dev/null; then
        WRANGLER_VERSION=$(wrangler --version)
        log_success "Wrangler: $WRANGLER_VERSION"
    else
        log_warning "Wrangler not found. Installing..."
        npm install -g wrangler
    fi

    # Check if logged in to Cloudflare
    log_info "Checking Cloudflare authentication..."
    if wrangler whoami &> /dev/null; then
        CF_USER=$(wrangler whoami | grep 'User' | cut -d':' -f2 | xargs)
        log_success "Authenticated as: $CF_USER"
    else
        log_error "Not logged in to Cloudflare. Run: wrangler login"
        exit 1
    fi

    # Get Account ID
    log_info "Getting Cloudflare Account ID..."
    CF_ACCOUNT_ID=$(wrangler whoami | grep 'Account ID' | cut -d':' -f2 | xargs || echo "")
    if [ -z "$CF_ACCOUNT_ID" ]; then
        log_warning "Could not get Account ID automatically"
        read -p "Enter your Cloudflare Account ID: " CF_ACCOUNT_ID
    fi
    log_success "Account ID: $CF_ACCOUNT_ID"

    # Check for .env file
    if [ -f ".env" ]; then
        log_info "Found .env file"
    else
        log_warning "No .env file found. Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_success "Created .env from .env.example"
        fi
    fi

    log_success "Pre-flight checks complete!"
}

# ============================================================
# Database Creation
# ============================================================

create_d1_databases() {
    print_step "Creating Cloudflare D1 Databases"

    # Array of databases to create
    databases=("$D1_MAIN" "$D1_PIXEL" "$D1_CALLBACK")
    declare -A db_ids

    for db in "${databases[@]}"; do
        log_info "Creating D1 database: $db"

        # Check if database already exists
        if wrangler d1 list 2>/dev/null | grep -q "$db"; then
            log_warning "Database $db already exists"
            # Get existing database ID
            db_id=$(wrangler d1 list | grep "$db" | grep -oP 'database_id = "\K[^"]+' || echo "")
            if [ -z "$db_id" ]; then
                log_error "Could not get database ID for $db"
                exit 1
            fi
            db_ids[$db]=$db_id
            log_info "Existing database ID: $db_id"
        else
            # Create new database
            output=$(wrangler d1 create "$db" 2>&1)

            # Extract database ID from output
            db_id=$(echo "$output" | grep -oP 'database_id = "\K[^"]+' || echo "")

            if [ -z "$db_id" ]; then
                log_error "Failed to create database $db"
                log_error "Output: $output"
                exit 1
            fi

            db_ids[$db]=$db_id
            log_success "Created $db with ID: $db_id"
        fi
    done

    # Save database IDs to file for later use
    log_info "Saving database IDs to .d1-db-ids..."
    cat > .d1-db-ids << EOF
# Cloudflare D1 Database IDs
# Generated: $(date)

D1_MAIN_ID="${db_ids[$D1_MAIN]}"
D1_PIXEL_ID="${db_ids[$D1_PIXEL]}"
D1_CALLBACK_ID="${db_ids[$D1_CALLBACK]}"

# Cloudflare Account ID
CF_ACCOUNT_ID="$CF_ACCOUNT_ID"
EOF

    log_success "Database IDs saved to .d1-db-ids"
}

# ============================================================
# Update wrangler.toml files
# ============================================================

update_wrangler_configs() {
    print_step "Updating wrangler.toml Files"

    source .d1-db-ids

    # Update api-worker
    log_info "Updating apps/api-worker/wrangler.toml..."
    sed -i "s/database_name = \"ppc-gen-claude\"/database_name = \"$D1_MAIN\"/" apps/api-worker/wrangler.toml
    sed -i "s/database_id = \".*\"/database_id = \"$D1_MAIN_ID\"/" apps/api-worker/wrangler.toml
    log_success "Updated api-worker"

    # Update pixel-worker
    log_info "Updating apps/pixel-worker/wrangler.toml..."
    sed -i "s/database_name = \"ppc-gen-claude\"/database_name = \"$D1_PIXEL\"/" apps/pixel-worker/wrangler.toml
    sed -i "s/database_id = \".*\"/database_id = \"$D1_PIXEL_ID\"/" apps/pixel-worker/wrangler.toml
    sed -i "s/database_name = \"lp-factory-db-staging\"/database_name = \"$D1_PIXEL-staging\"/" apps/pixel-worker/wrangler.toml
    sed -i "s/YOUR_STAGING_D1_DATABASE_ID/$D1_PIXEL_ID/" apps/pixel-worker/wrangler.toml
    log_success "Updated pixel-worker"

    # Update worker (callback)
    log_info "Updating apps/worker/wrangler.toml..."
    sed -i "s/database_name = \"ppc-gen-claude\"/database_name = \"$D1_CALLBACK\"/" apps/worker/wrangler.toml
    sed -i "s/database_id = \".*\"/database_id = \"$D1_CALLBACK_ID\"/" apps/worker/wrangler.toml
    sed -i "s/database_name = \"lp-factory-db-staging\"/database_name = \"$D1_CALLBACK-staging\"/" apps/worker/wrangler.toml
    sed -i "s/YOUR_STAGING_D1_DATABASE_ID/$D1_CALLBACK_ID/" apps/worker/wrangler.toml
    log_success "Updated worker"

    log_success "All wrangler.toml files updated"
}

# ============================================================
# Run Migrations
# ============================================================

run_migrations() {
    print_step "Running Database Migrations"

    source .d1-db-ids

    # Main database migrations
    log_info "Running migrations for $D1_MAIN..."
    if [ -d "apps/api-worker/migrations" ]; then
        for migration in apps/api-worker/migrations/*.sql; do
            if [ -f "$migration" ]; then
                log_info "  Running: $(basename $migration)"
                wrangler d1 execute "$D1_MAIN" --file="$migration" --local=false
            fi
        done
        log_success "Main database migrations complete"
    else
        log_warning "No migrations found for main database"
    fi

    # Pixel database migrations
    log_info "Running migrations for $D1_PIXEL..."
    if [ -d "apps/pixel-worker/migrations" ]; then
        for migration in apps/pixel-worker/migrations/*.sql; do
            if [ -f "$migration" ]; then
                log_info "  Running: $(basename $migration)"
                wrangler d1 execute "$D1_PIXEL" --file="$migration" --local=false
            fi
        done
        log_success "Pixel database migrations complete"
    else
        log_warning "No migrations found for pixel database"
    fi

    # Callback database migrations
    log_info "Running migrations for $D1_CALLBACK..."
    if [ -d "apps/worker/migrations" ]; then
        for migration in apps/worker/migrations/*.sql; do
            if [ -f "$migration" ]; then
                log_info "  Running: $(basename $migration)"
                wrangler d1 execute "$D1_CALLBACK" --file="$migration" --local=false
            fi
        done
        log_success "Callback database migrations complete"
    else
        log_warning "No migrations found for callback database"
    fi
}

# ============================================================
# Deploy Workers
# ============================================================

deploy_workers() {
    print_step "Deploying Cloudflare Workers"

    workers=("api-worker" "cf-proxy" "pixel-worker" "worker")

    for worker in "${workers[@]}"; do
        if [ -d "apps/$worker" ]; then
            log_info "Deploying $worker..."

            # Check if package.json exists and install dependencies
            if [ -f "apps/$worker/package.json" ]; then
                log_info "  Installing dependencies..."
                (cd "apps/$worker" && npm install --silent)
            fi

            # Deploy worker
            (cd "apps/$worker" && wrangler deploy)

            log_success "Deployed $worker"
        else
            log_warning "Worker directory not found: apps/$worker"
        fi
    done
}

# ============================================================
# Neon Setup
# ============================================================

setup_neon() {
    print_step "Neon Postgres Setup"

    log_info "Neon setup instructions:"
    echo ""
    echo "1. Go to https://console.neon.tech/signup"
    echo "2. Create a new project named 'fusionops-main'"
    echo "3. Copy the connection string"
    echo "4. Add it to GitHub Secrets as NEON_DATABASE_URL"
    echo ""
    echo "Or run the SQL below in your Neon SQL Editor:"
    echo ""
    cat << 'EOF'
-- Settings table (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites table (landing page configurations)
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deploy history table
CREATE TABLE IF NOT EXISTS deploy_history (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES sites(id),
  target TEXT NOT NULL,
  url TEXT,
  status TEXT DEFAULT 'pending',
  brand TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deploy_history_site_id ON deploy_history(site_id);
CREATE INDEX IF NOT EXISTS idx_deploy_history_created_at ON deploy_history(created_at DESC);
EOF
    echo ""

    read -p "Have you set up Neon? (y/n): " neon_done
    if [ "$neon_done" = "y" ]; then
        read -p "Enter your Neon connection string: " neon_url
        if [ -n "$neon_url" ]; then
            echo "NEON_DATABASE_URL=$neon_url" >> .env
            log_success "Neon connection saved to .env"
        fi
    fi
}

# ============================================================
# GitHub Secrets Setup
# ============================================================

setup_github_secrets() {
    print_step "GitHub Secrets Setup"

    source .d1-db-ids

    log_info "Add these secrets to your GitHub repository:"
    echo ""
    echo "Repository: git@github.com:Morning-Uplift-Marketing-Co/FusionOps.git"
    echo ""
    echo "Go to: Settings → Secrets and variables → Actions"
    echo ""
    echo "──────────────────────────────────────────────────────"
    echo "Required Secrets:"
    echo "──────────────────────────────────────────────────────"
    echo ""
    echo "CLOUDFLARE_ACCOUNT_ID    = $CF_ACCOUNT_ID"
    echo ""
    read -p "Enter your Cloudflare API Token: " cf_token
    echo "CLOUDFLARE_API_TOKEN      = $cf_token"
    echo ""
    echo "NEON_DATABASE_URL         = (your Neon connection string)"
    echo ""
    echo "──────────────────────────────────────────────────────"
    echo "Optional Secrets (for Vercel deployment):"
    echo "──────────────────────────────────────────────────────"
    echo "VERCEL_TOKEN              = (from vercel.com/account/tokens)"
    echo "VERCEL_ORG_ID             = (from .vercel/project.json)"
    echo "VERCEL_PROJECT_ID         = (from .vercel/project.json)"
    echo ""
    echo "──────────────────────────────────────────────────────"
    echo "Optional Secrets (for Netlify deployment):"
    echo "──────────────────────────────────────────────────────"
    echo "NETLIFY_AUTH_TOKEN        = (from app.netlify.com/user/applications)"
    echo "NETLIFY_SITE_ID           = (from Netlify site settings)"
    echo ""

    # Save to file for reference
    cat > .github-secrets-reference << EOF
# GitHub Secrets Reference
# Add these to: https://github.com/Morning-Uplift-Marketing-Co/FusionOps/settings/secrets/actions

# Required
CLOUDFLARE_ACCOUNT_ID=$CF_ACCOUNT_ID
CLOUDFLARE_API_TOKEN=$cf_token

# Required (add your Neon connection string)
NEON_DATABASE_URL=postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require

# Optional (Vercel)
# VERCEL_TOKEN=
# VERCEL_ORG_ID=
# VERCEL_PROJECT_ID=

# Optional (Netlify)
# NETLIFY_AUTH_TOKEN=
# NETLIFY_SITE_ID=
EOF

    log_success "Saved reference to .github-secrets-reference"
}

# ============================================================
# Verification
# ============================================================

verify_setup() {
    print_step "Verifying Setup"

    source .d1-db-ids

    log_info "Checking D1 databases..."

    # List databases
    wrangler d1 list | grep -E "$D1_MAIN|$D1_PIXEL|$D1_CALLBACK" && log_success "All D1 databases found" || log_error "Some databases missing"

    # Test main database
    log_info "Testing $D1_MAIN..."
    wrangler d1 execute "$D1_MAIN" --command="SELECT COUNT(*) as count FROM sites" --local=false

    # Test pixel database
    log_info "Testing $D1_PIXEL..."
    wrangler d1 execute "$D1_PIXEL" --command="SELECT COUNT(*) as count FROM pixel_events" --local=false

    # Test callback database
    log_info "Testing $D1_CALLBACK..."
    wrangler d1 execute "$D1_CALLBACK" --command="SELECT COUNT(*) as count FROM accounts" --local=false

    # List workers
    log_info "Listing deployed workers..."
    wrangler deployments list --name "lp-factory-api" 2>/dev/null || log_warning "API worker not found"
    wrangler deployments list --name "lp-factory-pixel" 2>/dev/null || log_warning "Pixel worker not found"
    wrangler deployments list --name "lp-factory-callback" 2>/dev/null || log_warning "Callback worker not found"

    log_success "Verification complete!"
}

# ============================================================
# Summary
# ============================================================

print_summary() {
    print_step "Setup Complete!"

    cat << 'EOF'

╔═══════════════════════════════════════════════════════════╗
║           FusionOps Infrastructure Ready! 🚀              ║
╚═══════════════════════════════════════════════════════════╝

Next steps:

1. Add GitHub Secrets (see .github-secrets-reference)
2. Push to GitHub: git push -u origin main
3. Configure Cloudflare Pages for web app
4. Set up custom domains

For detailed instructions, see INFRASTRUCTURE_SETUP.md

EOF
}

# ============================================================
# Main Menu
# ============================================================

main_menu() {
    print_step "FusionOps Infrastructure Setup"

    echo "This script will:"
    echo "  1. Create Cloudflare D1 databases"
    echo "  2. Run database migrations"
    echo "  3. Deploy Cloudflare Workers"
    echo "  4. Guide Neon Postgres setup"
    echo "  5. Generate GitHub Secrets reference"
    echo ""

    if ! confirm "Continue?"; then
        log_info "Setup cancelled"
        exit 0
    fi

    # Run all steps
    preflight_check
    create_d1_databases
    update_wrangler_configs
    run_migrations
    deploy_workers
    setup_neon
    setup_github_secrets
    verify_setup
    print_summary
}

# ============================================================
# Script Entry Point
# ============================================================

# Parse command line arguments
case "${1:-}" in
    --d1-only)
        preflight_check
        create_d1_databases
        update_wrangler_configs
        ;;
    --migrate-only)
        source .d1-db-ids 2>/dev/null || { log_error ".d1-db-ids not found. Run full setup first."; exit 1; }
        run_migrations
        ;;
    --deploy-only)
        deploy_workers
        ;;
    --verify-only)
        verify_setup
        ;;
    --help|-h)
        echo "FusionOps Infrastructure Setup"
        echo ""
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  --d1-only        Create D1 databases only"
        echo "  --migrate-only   Run migrations only"
        echo "  --deploy-only    Deploy workers only"
        echo "  --verify-only    Verify setup only"
        echo "  --help, -h       Show this help message"
        echo ""
        echo "Without options, runs full setup."
        exit 0
        ;;
    *)
        main_menu
        ;;
esac
