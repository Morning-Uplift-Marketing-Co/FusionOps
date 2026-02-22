#!/bin/bash
# LP Factory API - Cloudflare DNS Examples
# Usage: ./dns.sh [create-zone|list-dns|create-dns|update-dns|delete-dns] [args]

API_BASE="https://lp-factory-api.songsawat-w.workers.dev"

# Optional: Set your API secret if authentication is enabled
# API_SECRET="your-secret-here"
# CF_ACCOUNT_ID="your-cf-account-id"

create_zone() {
    local domain=$1
    if [ -z "$domain" ]; then
        echo "Usage: $0 create-zone <domain>"
        exit 1
    fi

    echo "Creating/get zone for $domain..."
    curl -s -X POST "$API_BASE/api/automation/cf/zone" \
        -H "Content-Type: application/json" \
        ${API_SECRET:+-H "Authorization: Bearer $API_SECRET"} \
        -d "{\"domain\": \"$domain\", \"cfAccountId\": \"$CF_ACCOUNT_ID\"}" | jq '.'
}

list_dns() {
    local zone_id=$1
    if [ -z "$zone_id" ]; then
        echo "Usage: $0 list-dns <zone-id>"
        exit 1
    fi

    echo "Listing DNS records for zone $zone_id..."
    curl -s -X GET "$API_BASE/api/automation/cf/dns?zoneId=$zone_id&cfAccountId=$CF_ACCOUNT_ID" \
        ${API_SECRET:+-H "Authorization: Bearer $API_SECRET"} | jq '.'
}

create_dns() {
    local zone_id=$1
    local name=$2
    local content=$3
    local type=${4:-A}

    if [ -z "$zone_id" ] || [ -z "$name" ] || [ -z "$content" ]; then
        echo "Usage: $0 create-dns <zone-id> <name> <content> [type]"
        echo "Example: $0 create-dns abc123 www 192.0.2.1 A"
        exit 1
    fi

    echo "Creating DNS record: $name -> $content ($type)..."
    curl -s -X POST "$API_BASE/api/automation/cf/dns" \
        -H "Content-Type: application/json" \
        ${API_SECRET:+-H "Authorization: Bearer $API_SECRET"} \
        -d "{\"zoneId\": \"$zone_id\", \"cfAccountId\": \"$CF_ACCOUNT_ID\", \"type\": \"$type\", \"name\": \"$name\", \"content\": \"$content\", \"ttl\": 3600, \"proxied\": false}" | jq '.'
}

update_dns() {
    local record_id=$1
    local zone_id=$2
    local content=$3

    if [ -z "$record_id" ] || [ -z "$zone_id" ] || [ -z "$content" ]; then
        echo "Usage: $0 update-dns <record-id> <zone-id> <new-content>"
        exit 1
    fi

    echo "Updating DNS record $record_id..."
    curl -s -X PUT "$API_BASE/api/automation/cf/dns" \
        -H "Content-Type: application/json" \
        ${API_SECRET:+-H "Authorization: Bearer $API_SECRET"} \
        -d "{\"dnsRecordId\": \"$record_id\", \"zoneId\": \"$zone_id\", \"cfAccountId\": \"$CF_ACCOUNT_ID\", \"content\": \"$content\"}" | jq '.'
}

delete_dns() {
    local record_id=$1
    local zone_id=$2

    if [ -z "$record_id" ] || [ -z "$zone_id" ]; then
        echo "Usage: $0 delete-dns <record-id> <zone-id>"
        exit 1
    fi

    echo "Deleting DNS record $record_id..."
    curl -s -X DELETE "$API_BASE/api/automation/cf/dns?dnsRecordId=$record_id&zoneId=$zone_id&cfAccountId=$CF_ACCOUNT_ID" \
        ${API_SECRET:+-H "Authorization: Bearer $API_SECRET"} | jq '.'
}

# Main
case "${1:-}" in
    create-zone)
        create_zone "$2"
        ;;
    list-dns)
        list_dns "$2"
        ;;
    create-dns)
        create_dns "$2" "$3" "$4" "$5"
        ;;
    update-dns)
        update_dns "$2" "$3" "$4"
        ;;
    delete-dns)
        delete_dns "$2" "$3"
        ;;
    *)
        echo "LP Factory Cloudflare DNS API Examples"
        echo ""
        echo "Usage: $0 [command] [args]"
        echo ""
        echo "Commands:"
        echo "  create-zone <domain>         Create or get a zone"
        echo "  list-dns <zone-id>            List all DNS records"
        echo "  create-dns <zone> <name> <ip> [type]   Create A/CNAME/TXT/etc record"
        echo "  update-dns <record-id> <zone> <new-ip>  Update a record"
        echo "  delete-dns <record-id> <zone>            Delete a record"
        echo ""
        echo "Examples:"
        echo "  $0 create-zone example.com"
        echo "  $0 list-dns abc1234567890abcdef"
        echo "  $0 create-dns abc123 www 192.0.2.1 A"
        echo "  $0 create-dns abc123 @ 192.0.2.1 A"
        echo "  $0 create-dns abc123 api.example.com. example.com. CNAME"
        echo "  $0 create-dns abc123 @ \"v=spf1 include:_spf.google.com ~all\" TXT"
        echo "  $0 update-dns xyz789 abc123 192.0.2.2"
        echo "  $0 delete-dns xyz789 abc123"
        exit 1
        ;;
esac
