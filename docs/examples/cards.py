#!/usr/bin/env python3
"""
LP Factory API - LeadingCards Examples

Usage:
    python cards.py create <limit> <currency>
    python cards.py block <card_uuid>
    python cards.py activate <card_uuid>
    python cards.py change_limit <card_uuid> <new_limit>
"""

import requests
import sys

API_BASE = "https://lp-factory-api.songsawat-w.workers.dev"

# Optional: Set your API secret if authentication is enabled
# API_SECRET = "your-secret-here"

def api_request(endpoint, method="GET", body=None):
    """Make an API request to LP Factory."""
    headers = {"Content-Type": "application/json"}
    # if API_SECRET:
    #     headers["Authorization"] = f"Bearer {API_SECRET}"

    if method == "GET":
        response = requests.get(f"{API_BASE}{endpoint}", headers=headers)
    elif method == "POST":
        response = requests.post(f"{API_BASE}{endpoint}", json=body, headers=headers)
    elif method == "PUT":
        response = requests.put(f"{API_BASE}{endpoint}", json=body, headers=headers)
    else:
        raise ValueError(f"Unsupported method: {method}")

    return response.json()


def create_card(limit: int, currency: str = "USD"):
    """Create a new virtual card."""
    print(f"Creating card: {currency} {limit}...")
    result = api_request("/api/automation/lc/create", "POST", {
        "limit": limit,
        "currency": currency,
    })
    print(f"Success: {result.get('success')}")
    if result.get("card"):
        print(f"Card ID: {result['card'].get('id')}")
        print(f"Card Number: {result['card'].get('number')}")
    return result


def block_card(card_uuid: str):
    """Block a virtual card."""
    print(f"Blocking card: {card_uuid}...")
    result = api_request("/api/automation/lc/block", "POST", {
        "cardUuid": card_uuid,
    })
    print(f"Success: {result.get('success')}")
    return result


def activate_card(card_uuid: str):
    """Activate a blocked virtual card."""
    print(f"Activating card: {card_uuid}...")
    result = api_request("/api/automation/lc/activate", "POST", {
        "cardUuid": card_uuid,
    })
    print(f"Success: {result.get('success')}")
    return result


def change_limit(card_uuid: str, new_limit: int):
    """Change the spending limit on a card."""
    print(f"Changing limit for {card_uuid} to {new_limit}...")
    result = api_request("/api/automation/lc/change_limit", "POST", {
        "cardUuid": card_uuid,
        "limit": new_limit,
    })
    print(f"Success: {result.get('success')}")
    return result


def main():
    if len(sys.argv) < 2:
        print("LP Factory LeadingCards API Examples\n")
        print("Usage: python cards.py [command] [args]\n")
        print("Commands:")
        print("  create <limit> <currency>    Create a new virtual card")
        print("  block <card_uuid>            Block a card")
        print("  activate <card_uuid>          Activate a blocked card")
        print("  change_limit <card_uuid> <limit>   Change card limit\n")
        print("Examples:")
        print("  python cards.py create 1000 USD")
        print("  python cards.py block abc-123-def")
        print("  python cards.py activate abc-123-def")
        print("  python cards.py change_limit abc-123-def 5000")
        sys.exit(1)

    command = sys.argv[1]

    if command == "create":
        if len(sys.argv) < 3:
            print("Usage: python cards.py create <limit> [currency]")
            sys.exit(1)
        limit = int(sys.argv[2])
        currency = sys.argv[3] if len(sys.argv) > 3 else "USD"
        create_card(limit, currency)

    elif command == "block":
        if len(sys.argv) < 3:
            print("Usage: python cards.py block <card_uuid>")
            sys.exit(1)
        block_card(sys.argv[2])

    elif command == "activate":
        if len(sys.argv) < 3:
            print("Usage: python cards.py activate <card_uuid>")
            sys.exit(1)
        activate_card(sys.argv[2])

    elif command == "change_limit":
        if len(sys.argv) < 4:
            print("Usage: python cards.py change_limit <card_uuid> <new_limit>")
            sys.exit(1)
        change_limit(sys.argv[2], int(sys.argv[3]))

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
