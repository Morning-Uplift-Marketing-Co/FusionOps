#!/usr/bin/env python3
"""SCOUT — Competitor Ad Copy Intelligence

State (snapshots + diffs) lives in D1 via the agent state API.
See .agents/debates/hermes-state-20260518-231225/SYNTHESIS-R2.md.
"""

import os
import sys
import json
import base64
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
import requests
from difflib import SequenceMatcher

# Make sibling _lib importable when run as `python3 SCOUT/run.py`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _lib.agent_state import AgentStateClient, AgentStateError  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(asctime)s [SCOUT] %(message)s')
logger = logging.getLogger(__name__)

# Lookback window for "previous creatives" — must exceed SCOUT cron cadence (daily).
# 26h gives a 2h safety margin so a creative seen yesterday is still in `prev`.
PREV_WINDOW_HOURS = 26


class SCOUTAdCopyIntel:
    def __init__(self):
        self.dataforseo_login = os.getenv('DATAFORSEO_LOGIN')
        self.dataforseo_password = os.getenv('DATAFORSEO_PASSWORD')
        self.competitor_list = os.getenv('COMPETITOR_LIST', '').split(',')
        self.telegram_chat_id = os.getenv('SCOUT_TELEGRAM_CHAT_ID')
        self.telegram_bot_token = os.getenv('SCOUT_TELEGRAM_BOT_TOKEN')

        self.state = AgentStateClient()
        self.dataforseo_base_url = 'https://api.dataforseo.com/v3'
        self.similarity_threshold = 0.75  # 75% identical = no change

    def _auth_header(self) -> str:
        credentials = f"{self.dataforseo_login}:{self.dataforseo_password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"

    def _get_prev_creatives(self, competitor_domain: str) -> Dict[str, Dict[str, Any]]:
        """Fetch creatives seen on this competitor's domain within the lookback window.

        Returns: {creative_id: creative_dict}
        """
        since = int((datetime.utcnow() - timedelta(hours=PREV_WINDOW_HOURS)).timestamp())
        rows = self.state.list_fingerprints(
            agent='SCOUT', scope=competitor_domain, since=since, limit=500
        )
        out: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            cid = r.get('fingerprint_key')
            if not cid:
                continue
            payload = r.get('payload')
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except (json.JSONDecodeError, TypeError):
                    payload = {}
            out[cid] = payload or {'creative_id': cid}
        return out

    def _save_current_creatives(
        self, competitor_domain: str, creatives: Dict[str, Dict[str, Any]]
    ):
        """Upsert current creatives so their last_seen_at advances to now."""
        if not creatives:
            return
        self.state.upsert_fingerprints([
            {
                'agent': 'SCOUT',
                'scope': competitor_domain,
                'fingerprint_key': cid,
                'fingerprint_hash': cid,
                'payload': creative,
            }
            for cid, creative in creatives.items()
        ])

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
        """Detect ad creative changes for a competitor domain.

        Strategy: load creatives seen in the last PREV_WINDOW_HOURS hours from D1
        as `prev`, diff against the current SERP query, emit alerts for new
        creatives, then upsert all current creatives so their last_seen_at
        advances. Removed creatives age out via last_seen_at on the next read.
        """
        current_items = self.query_ads_by_target(competitor_domain)
        logger.info(f"{competitor_domain}: {len(current_items)} active ads")

        current_creatives = {
            item.get('creative_id'): {
                'creative_id': item.get('creative_id'),
                'advertiser_id': item.get('advertiser_id'),
                'title': item.get('title', ''),
                'url': item.get('url', ''),
                'format': item.get('format', ''),
                'first_shown': item.get('first_shown'),
                'last_shown': item.get('last_shown'),
                'preview_image_url': (item.get('preview_image') or {}).get('url'),
            }
            for item in current_items if item.get('creative_id')
        }

        prev_creatives = self._get_prev_creatives(competitor_domain)

        if not prev_creatives:
            self._save_current_creatives(competitor_domain, current_creatives)
            logger.info(f"First snapshot: {competitor_domain} ({len(current_creatives)} creatives)")
            return

        new_ids = set(current_creatives.keys()) - set(prev_creatives.keys())

        for cid in new_ids:
            ad = current_creatives[cid]
            logger.info(f"NEW AD on {competitor_domain}: {ad.get('title')} ({ad.get('format')})")
            self._send_diff_alert(competitor_domain, 'NEW', None, ad, 0.0)
            self._record_new_creative(competitor_domain, ad)

        # Note: paused creatives are NOT alerted (matches prior behavior — old code
        # only wrote to diffs.jsonl, never paged Telegram). Pauses are discoverable
        # in D1 by filtering on last_seen_at.

        self._save_current_creatives(competitor_domain, current_creatives)

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

    def _record_new_creative(self, competitor: str, ad: Dict[str, Any]):
        """Record a new-creative finding to the D1 alerts inbox."""
        self.state.create_alert(
            agent='SCOUT',
            severity='info',
            title=f"New creative on {competitor}: {ad.get('title', '')[:80]}",
            payload={
                'timestamp': datetime.utcnow().isoformat(),
                'competitor': competitor,
                'change_type': 'new_creative',
                'creative': ad,
            },
        )

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

def _notify_d1_failure(err: Exception):
    chat = os.getenv('SCOUT_TELEGRAM_CHAT_ID')
    token = os.getenv('SCOUT_TELEGRAM_BOT_TOKEN')
    if not (chat and token):
        return
    try:
        requests.post(
            f'https://api.telegram.org/bot{token}/sendMessage',
            json={
                'chat_id': chat,
                'text': f"🚨 SCOUT aborted: D1 agent state API unreachable\n{err}",
            },
            timeout=10,
        )
    except Exception:
        pass


def run():
    """Entry point for Hermes. Fail-fast on D1 errors (no degraded run)."""
    try:
        scout = SCOUTAdCopyIntel()
        scout.monitor_competitors()
    except AgentStateError as e:
        logger.error(f"D1 agent state API unreachable — aborting this tick: {e}")
        _notify_d1_failure(e)
        sys.exit(2)


if __name__ == '__main__':
    run()
