#!/usr/bin/env python3
"""BOT_IP_SYNC — Daily sync of Google Bot IP ranges into D1"""

import os
import json
import ipaddress
import logging
from datetime import datetime
from typing import List, Dict, Any
import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s [BOT_IP_SYNC] %(message)s')
logger = logging.getLogger(__name__)

SOURCES = [
    ('https://developers.google.com/static/search/apis/ipranges/googlebot.json', 'googlebot'),
    ('https://developers.google.com/static/search/apis/ipranges/special-crawlers.json', 'special-crawlers'),
    ('https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json', 'user-triggered-fetchers'),
]


def fetch_ip_ranges(url: str, label: str) -> List[Dict[str, Any]]:
    """Fetch and parse Google's IP range JSON"""
    try:
        resp = requests.get(url, timeout=30,
                            headers={'User-Agent': 'HERMES-BOT-IP-SYNC/1.0'})
        resp.raise_for_status()
        data = resp.json()
        prefixes = data.get('prefixes', [])
        result = []
        for p in prefixes:
            cidr = p.get('ipv4Prefix') or p.get('ipv6Prefix')
            if not cidr:
                continue
            try:
                net = ipaddress.ip_network(cidr, strict=False)
                row = {
                    'cidr': cidr,
                    'ip_version': net.version,
                    'bot_type': label,
                    'source': url,
                }
                if net.version == 4:
                    row['ip_start'] = int(net.network_address)
                    row['ip_end'] = int(net.broadcast_address)
                result.append(row)
            except ValueError:
                logger.warning(f"Invalid CIDR skipped: {cidr}")
                continue
        return result
    except Exception as e:
        logger.error(f"Failed to fetch {url}: {e}")
        return []


def send_to_api_worker(ranges: List[Dict[str, Any]]) -> bool:
    """POST ranges to API Worker /api/bot-ip-sync endpoint"""
    api_base = os.getenv('API_WORKER_BASE', 'https://lp-factory-api.misty-feather-556e.workers.dev')
    api_token = os.getenv('API_WORKER_INTERNAL_TOKEN', '')

    if not ranges:
        logger.warning("No ranges to sync")
        return False

    try:
        resp = requests.post(
            f'{api_base}/api/bot-ip-sync',
            json={'ranges': ranges, 'timestamp': int(datetime.utcnow().timestamp())},
            headers={
                'Content-Type': 'application/json',
                'X-Internal-Token': api_token,
            },
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()
        logger.info(f"API Worker response: {result.get('count', 0)} ranges synced")
        return True
    except Exception as e:
        logger.error(f"Failed to sync to API Worker: {e}")
        return False


def send_telegram(message: str):
    chat_id = os.getenv('BOT_IP_SYNC_TELEGRAM_CHAT_ID')
    token = os.getenv('BOT_IP_SYNC_TELEGRAM_BOT_TOKEN')
    if not (chat_id and token):
        return
    try:
        requests.post(
            f'https://api.telegram.org/bot{token}/sendMessage',
            json={'chat_id': chat_id, 'text': message},
            timeout=10,
        )
    except Exception as e:
        logger.error(f"Telegram error: {e}")


def run():
    logger.info("Starting Google Bot IP range sync")
    all_ranges = []
    summary_parts = []

    for url, label in SOURCES:
        ranges = fetch_ip_ranges(url, label)
        all_ranges.extend(ranges)
        v4 = sum(1 for r in ranges if r['ip_version'] == 4)
        v6 = sum(1 for r in ranges if r['ip_version'] == 6)
        summary_parts.append(f"- {label}.json: {len(ranges)} ranges (IPv4: {v4}, IPv6: {v6})")
        logger.info(f"{label}: fetched {len(ranges)} CIDR ranges")

    if all_ranges:
        success = send_to_api_worker(all_ranges)
        status_emoji = "✅" if success else "❌"
        message = (
            f"🤖 BOT IP SYNC COMPLETE\n\n"
            f"Sources synced:\n" + "\n".join(summary_parts) +
            f"\n\nTotal: {len(all_ranges)} CIDR ranges {status_emoji}\n"
            f"Last sync: {datetime.utcnow().isoformat()}Z"
        )
        send_telegram(message)
        logger.info(f"Sync complete: {len(all_ranges)} total ranges")
    else:
        logger.warning("No ranges fetched from any source")


if __name__ == '__main__':
    run()
