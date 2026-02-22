#!/bin/bash
# LP Factory API - Registrar Examples
# Usage: ./registrar.sh [check|register|nameservers|import|ping] [domain]

API_BASE="https://lp-factory-api.songsawat-w.workers.dev"
PROVIDER="internetbs"

# Optional: Set your API secret if authentication is enabled
# API_SECRET="your-secret-here"

check_domain() {
    local domain=$1
    if [ -z "$domain" ]; then
        echo "Usage: $0 check <domain>"
        exit 1
    fi

    echo "Checking availability for $domain..."
    curl -s -X POST "$API_BASE/api/automation/registrar/check" \
        -H "Content-Type: application/json" \
        ${API_SECRET:+-H "Authorization: Bearer $API_SECRET"} \
        -d "{\"domain\": \"$domain\", \"provider\": \"$PROVIDER\"}" | jq '.'
}

register_domain() {
    local domain=$1
    if [ -z "$domain" ]; then
        echo "Usage: $0 register <domain>"
        exit 1
    fi

    echo "Registering $domain..."
    curl -s -X POST "$API_BASE/api/automation/registrar/register" \
        -H "Content-Type: application/json" \
        ${API_SECRET:+-H "Authorization: Bearer $API_SECRET"} \
        -d "{\"domain\": \"$domain\", \"provider\": \"$PROVIDER\", \"period\": \"1Y\"}" | jq '.'
}

update_nameservers() {
    local domain=$1
    if [ -z "$domain" ]; then
        echo "Usage: $0 nameservers <domain>"
        exit 1
    fi

    echo "Updating nameservers for $domain..."
    curl -s -X PUT "$API_BASE/api/automation/registrar/nameservers" \
        -H "Content-Type: application/json" \
        ${API_SECRET:+-H "Authorization: Bearer $API_SECRET"} \
        -d "{\"domain\": \"$domain\", \"provider\": \"$PROVIDER\", \"nameservers\": [\"ns1.cloudflare.com\", \"ns2.cloudflare.com\"]}" | jq '.'
}

import_domains() {
    echo "Importing all domains from $PROVIDER..."
    curl -s -X POST "$API_BASE/api/automation/registrar/import" \
        -H "Content-Type: application/json" \
        ${API_SECRET:+-H "Authorization: Bearer $API_SECRET"} \
        -d "{\"provider\": \"$PROVIDER\"}" | jq '.'
}

ping_registrar() {
    echo "Pinging $PROVIDER..."
    curl -s -X POST "$API_BASE/api/automation/registrar/ping" \
        -H "Content-Type: application/json" \
        ${API_SECRET:+-H "Authorization: Bearer $API_SECRET"} \
        -d "{\"provider\": \"$PROVIDER\"}" | jq '.'
}

# Main
case "${1:-}" in
    check)
        check_domain "$2"
        ;;
    register)
        register_domain "$2"
        ;;
    nameservers)
        update_nameservers "$2"
        ;;
    import)
        import_domains
        ;;
    ping)
        ping_registrar
        ;;
    *)
        echo "LP Factory Registrar API Examples"
        echo ""
        echo "Usage: $0 [command] [args]"
        echo ""
        echo "Commands:"
        echo "  check <domain>      Check if domain is available"
        echo "  register <domain>   Register a new domain"
        echo "  nameservers <domain> Update nameservers to Cloudflare"
        echo "  import              List all domains from registrar"
        echo "  ping                Test connection and get balance"
        echo ""
        echo "Examples:"
        echo "  $0 check example.com"
        echo "  $0 register my-new-domain.com"
        echo "  $0 nameservers example.com"
        echo "  $0 import"
        echo "  $0 ping"
        exit 1
        ;;
esac
