#!/usr/bin/env python3
"""AEGIS — Brand-Jack Detection for Trademark Keywords"""

import os
import json
import base64
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import requests
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s [AEGIS] %(message)s')
logger = logging.getLogger(__name__)

class AEGISBrandJackDetector:
    def __init__(self):
        self.dataforseo_login = os.getenv('DATAFORSEO_LOGIN')
        self.dataforseo_password = os.getenv('DATAFORSEO_PASSWORD')
        self.approved_advertisers = set(
            os.getenv('APPROVED_ADVERTISERS', '').split(',')
        )
        self.trademark_list = os.getenv('TRADEMARK_LIST', '').split(',')
        self.telegram_chat_id = os.getenv('AEGIS_TELEGRAM_CHAT_ID')
        self.telegram_bot_token = os.getenv('AEGIS_TELEGRAM_BOT_TOKEN')

        self.state_dir = Path.home() / '.hermes' / 'aegis-state'
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.alerts_file = self.state_dir / 'alerts.jsonl'
        self.seen_file = self.state_dir / 'seen.json'

        self.dataforseo_base_url = 'https://api.dataforseo.com/v3'

    def _auth_header(self) -> str:
        """Generate base64 auth header for DataForSEO API"""
        credentials = f"{self.dataforseo_login}:{self.dataforseo_password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"

    def _get_seen_advertisers(self) -> Dict[str, datetime]:
        """Load 24h dedup window"""
        if self.seen_file.exists():
            with open(self.seen_file) as f:
                data = json.load(f)
                return {
                    k: datetime.fromisoformat(v)
                    for k, v in data.items()
                }
        return {}

    def _save_seen_advertisers(self, seen: Dict[str, datetime]):
        """Save 24h dedup window"""
        with open(self.seen_file, 'w') as f:
            json.dump(
                {k: v.isoformat() for k, v in seen.items()},
                f
            )

    def _is_authorized(self, advertiser_name: str) -> bool:
        """Check if advertiser title/domain matches approved list (fuzzy match)"""
        adv = (advertiser_name or '').lower().strip()
        if not adv:
            return True  # Empty = skip
        for approved in self.approved_advertisers:
            approved = approved.lower().strip()
            if not approved:
                continue
            # Strip TLD for fuzzy company name match
            approved_base = approved.split('.')[0]
            if approved == adv or approved_base in adv or adv in approved:
                return True
        return False

    def query_serp_ads(self) -> List[Dict[str, Any]]:
        """Query SERP Google Ads Advertisers Live endpoint (one keyword per request)"""
        headers = {
            'Authorization': self._auth_header(),
            'Content-Type': 'application/json'
        }

        all_results = []

        for keyword in self.trademark_list:
            keyword = keyword.strip()
            if not keyword:
                continue

            payload = [
                {
                    'keyword': keyword,
                    'location_code': 2840  # United States
                }
            ]

            try:
                response = requests.post(
                    f'{self.dataforseo_base_url}/serp/google/ads_advertisers/live/advanced',
                    json=payload,
                    headers=headers,
                    timeout=30
                )
                response.raise_for_status()

                data = response.json()
                if data.get('status_code') != 20000:
                    logger.warning(f"API returned status {data.get('status_code')}: {data.get('status_message')}")
                    continue

                for task in data.get('tasks', []) or []:
                    if task.get('status_code') == 20000:
                        for result in task.get('result', []) or []:
                            result['keyword'] = keyword
                            all_results.append(result)
                    else:
                        logger.warning(f"Task error for '{keyword}': {task.get('status_message')}")

            except Exception as e:
                logger.error(f"Failed to query SERP ads for '{keyword}': {e}")
                continue

        return all_results

    def send_telegram_alert(self, keyword: str, advertiser: Dict[str, str]):
        """Send Telegram alert for unauthorized advertiser"""
        if not (self.telegram_chat_id and self.telegram_bot_token):
            logger.warning("Telegram not configured, skipping alert")
            return

        domain = advertiser.get('domain', 'unknown')
        title = advertiser.get('title', 'N/A')
        url = advertiser.get('url', 'N/A')

        message = f"""⚠️ BRAND JACK DETECTED

Trademark: {keyword}
Advertiser Domain: {domain}
Ad Title: {title}
Ad URL: {url}
Time: {datetime.utcnow().isoformat()} UTC
"""

        try:
            response = requests.post(
                f'https://api.telegram.org/bot{self.telegram_bot_token}/sendMessage',
                json={
                    'chat_id': self.telegram_chat_id,
                    'text': message,
                    'parse_mode': 'HTML'
                },
                timeout=10
            )
            response.raise_for_status()
            logger.info(f"Telegram alert sent for {domain}")
        except Exception as e:
            logger.error(f"Failed to send Telegram alert: {e}")

    def log_alert(self, keyword: str, domain: str, advertiser: Dict[str, str]):
        """Log alert to alerts.jsonl"""
        alert = {
            'timestamp': datetime.utcnow().isoformat(),
            'keyword': keyword,
            'domain': domain,
            'title': advertiser.get('title'),
            'url': advertiser.get('url'),
            'position': advertiser.get('position')
        }

        with open(self.alerts_file, 'a') as f:
            f.write(json.dumps(alert) + '\n')
        logger.info(f"Alert logged: {keyword} - {domain}")

    def detect_brand_jacks(self):
        """Main detection loop"""
        logger.info(f"Starting brand-jack detection for {len(self.trademark_list)} keywords")

        ads_results = self.query_serp_ads()
        if not ads_results:
            logger.warning("No SERP results received")
            return

        seen_advertisers = self._get_seen_advertisers()
        now = datetime.utcnow()

        # Clean up old entries (>24h)
        seen_advertisers = {
            k: v for k, v in seen_advertisers.items()
            if now - v < timedelta(hours=24)
        }

        new_alerts = 0
        for result in ads_results:
            keyword = result.get('keyword', '').lower()

            for item in (result.get('items') or []):
                # ads_advertisers returns: title (company name), advertiser_id, location, verified, approx_ads_count
                advertiser_title = item.get('title', '')
                advertiser_id = item.get('advertiser_id', '')
                dedup_key = f"{keyword}:{advertiser_id}"

                # Skip if already seen in 24h window
                if dedup_key in seen_advertisers:
                    continue

                # Check if authorized
                if not self._is_authorized(advertiser_title):
                    logger.info(f"UNAUTHORIZED ADVERTISER: '{advertiser_title}' for '{keyword}' ({item.get('approx_ads_count', 0)} ads)")
                    # Build advertiser dict for alerting
                    advertiser = {
                        'domain': advertiser_title,  # ads_advertisers has no domain; use title
                        'title': advertiser_title,
                        'url': f"https://adstransparency.google.com/advertiser/{advertiser_id}",
                        'position': item.get('rank_absolute'),
                        'approx_ads_count': item.get('approx_ads_count'),
                        'verified': item.get('verified'),
                        'location': item.get('location')
                    }
                    self.send_telegram_alert(keyword, advertiser)
                    self.log_alert(keyword, advertiser_title, advertiser)
                    seen_advertisers[dedup_key] = now
                    new_alerts += 1

        self._save_seen_advertisers(seen_advertisers)
        logger.info(f"Brand-jack detection complete: {new_alerts} new alerts")

def run():
    """Entry point for Hermes"""
    detector = AEGISBrandJackDetector()
    detector.detect_brand_jacks()

if __name__ == '__main__':
    run()
