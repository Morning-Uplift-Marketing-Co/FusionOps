#!/usr/bin/env python3
"""SCOUT — Competitor Ad Copy Intelligence"""

import os
import json
import base64
import logging
from datetime import datetime
from typing import Dict, List, Any
import requests
from pathlib import Path
from difflib import SequenceMatcher

logging.basicConfig(level=logging.INFO, format='%(asctime)s [SCOUT] %(message)s')
logger = logging.getLogger(__name__)

class SCOUTAdCopyIntel:
    def __init__(self):
        self.dataforseo_login = os.getenv('DATAFORSEO_LOGIN')
        self.dataforseo_password = os.getenv('DATAFORSEO_PASSWORD')
        self.competitor_list = os.getenv('COMPETITOR_LIST', '').split(',')
        self.telegram_chat_id = os.getenv('SCOUT_TELEGRAM_CHAT_ID')
        self.telegram_bot_token = os.getenv('SCOUT_TELEGRAM_BOT_TOKEN')

        self.state_dir = Path.home() / '.hermes' / 'scout-state'
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.snapshots_file = self.state_dir / 'snapshots.json'
        self.diffs_file = self.state_dir / 'diffs.jsonl'

        self.dataforseo_base_url = 'https://api.dataforseo.com/v3'
        self.similarity_threshold = 0.75  # 75% identical = no change

    def _auth_header(self) -> str:
        credentials = f"{self.dataforseo_login}:{self.dataforseo_password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"

    def _get_snapshots(self) -> Dict[str, Dict[str, Any]]:
        if self.snapshots_file.exists():
            with open(self.snapshots_file) as f:
                return json.load(f)
        return {}

    def _save_snapshots(self, snapshots: Dict[str, Dict[str, Any]]):
        with open(self.snapshots_file, 'w') as f:
            json.dump(snapshots, f, indent=2)

    def _text_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity ratio between two texts (0-1)"""
        matcher = SequenceMatcher(None, text1.lower(), text2.lower())
        return matcher.ratio()

    def query_ads_by_target(self, domain: str) -> List[Dict[str, Any]]:
        """Query SERP Google Ads Search by target domain"""
        headers = {
            'Authorization': self._auth_header(),
            'Content-Type': 'application/json'
        }

        payload = [
            {
                'target': domain,
                'location_code': 2840,
                'platform': 'google_search'
            }
        ]

        try:
            response = requests.post(
                f'{self.dataforseo_base_url}/serp/google/ads_search/live/advanced',
                json=payload,
                headers=headers,
                timeout=60
            )
            response.raise_for_status()
            data = response.json()
            if data.get('status_code') != 20000:
                logger.warning(f"ads_search API status: {data.get('status_message')}")
                return []
            items = []
            for task in data.get('tasks', []) or []:
                if task.get('status_code') == 20000:
                    for result in task.get('result', []) or []:
                        for item in (result.get('items') or []):
                            items.append(item)
                else:
                    logger.warning(f"Task error for '{domain}': {task.get('status_message')}")
            return items
        except Exception as e:
            logger.error(f"Failed to query ads search for '{domain}': {e}")
            return []

    def detect_ad_copy_changes(self, competitor_domain: str):
        """Detect ad creative changes for a competitor domain"""
        current_items = self.query_ads_by_target(competitor_domain)
        logger.info(f"{competitor_domain}: {len(current_items)} active ads")

        # Build map: creative_id → ad info
        current_creatives = {
            item.get('creative_id'): {
                'creative_id': item.get('creative_id'),
                'advertiser_id': item.get('advertiser_id'),
                'title': item.get('title', ''),
                'url': item.get('url', ''),
                'format': item.get('format', ''),
                'first_shown': item.get('first_shown'),
                'last_shown': item.get('last_shown'),
                'preview_image_url': (item.get('preview_image') or {}).get('url')
            }
            for item in current_items if item.get('creative_id')
        }

        snapshots = self._get_snapshots()
        snapshot_key = competitor_domain

        if snapshot_key not in snapshots:
            snapshots[snapshot_key] = {
                'timestamp': datetime.utcnow().isoformat(),
                'creatives': current_creatives
            }
            self._save_snapshots(snapshots)
            logger.info(f"First snapshot: {snapshot_key} ({len(current_creatives)} creatives)")
            return

        prev_creatives = snapshots[snapshot_key].get('creatives', {})

        # Diff: new creatives, removed creatives
        new_ids = set(current_creatives.keys()) - set(prev_creatives.keys())
        removed_ids = set(prev_creatives.keys()) - set(current_creatives.keys())

        if new_ids:
            for cid in new_ids:
                ad = current_creatives[cid]
                logger.info(f"NEW AD on {competitor_domain}: {ad.get('title')} ({ad.get('format')})")
                self._send_diff_alert(competitor_domain, 'NEW', None, ad, 0.0)
                self._log_diff(competitor_domain, 'new_creative', None, ad)

        if removed_ids:
            for cid in removed_ids:
                ad = prev_creatives[cid]
                logger.info(f"PAUSED AD on {competitor_domain}: {ad.get('title')}")
                self._log_diff(competitor_domain, 'paused_creative', ad, None)

        snapshots[snapshot_key] = {
            'timestamp': datetime.utcnow().isoformat(),
            'creatives': current_creatives
        }
        self._save_snapshots(snapshots)

        # Update snapshot
        snapshots[snapshot_key] = {
            'timestamp': datetime.utcnow().isoformat(),
            'ads_by_domain': current_ads
        }
        self._save_snapshots(snapshots)

    def _send_diff_alert(self, competitor: str, change_type: str, prev_ad: Dict, curr_ad: Dict, similarity: float):
        if not (self.telegram_chat_id and self.telegram_bot_token):
            logger.info("Telegram not configured, skipping alert")
            return

        ad = curr_ad or prev_ad or {}
        message = f"""📊 COMPETITOR AD {change_type}

Domain: {competitor}
Advertiser: {ad.get('title', 'N/A')}
Format: {ad.get('format', 'N/A')}
URL: {ad.get('url', 'N/A')}
First shown: {ad.get('first_shown', 'N/A')}
Last shown: {ad.get('last_shown', 'N/A')}
"""

        try:
            requests.post(
                f'https://api.telegram.org/bot{self.telegram_bot_token}/sendMessage',
                json={
                    'chat_id': self.telegram_chat_id,
                    'text': message,
                    'parse_mode': 'HTML'
                },
                timeout=10
            )
            logger.info(f"Telegram alert sent for {competitor}")
        except Exception as e:
            logger.error(f"Failed to send Telegram alert: {e}")

    def _log_diff(self, competitor: str, change_type: str, prev_ad: Dict, curr_ad: Dict):
        diff = {
            'timestamp': datetime.utcnow().isoformat(),
            'competitor': competitor,
            'change_type': change_type,
            'before': prev_ad,
            'after': curr_ad
        }
        with open(self.diffs_file, 'a') as f:
            f.write(json.dumps(diff) + '\n')

    def monitor_competitors(self):
        """Main monitoring loop — query each competitor's domain"""
        logger.info(f"Monitoring {len(self.competitor_list)} competitor domains")

        for competitor in self.competitor_list:
            competitor = competitor.strip()
            if not competitor:
                continue
            # Normalize: if just brand name (no dot), assume .com
            if '.' not in competitor:
                competitor = f'{competitor.lower()}.com'
            self.detect_ad_copy_changes(competitor)

        logger.info("Competitor ad monitoring complete")

def run():
    """Entry point for Hermes"""
    scout = SCOUTAdCopyIntel()
    scout.monitor_competitors()

if __name__ == '__main__':
    run()
