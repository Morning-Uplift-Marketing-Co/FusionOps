#!/usr/bin/env python3
"""AEGIS — Brand-Jack Detection for Trademark Keywords

State (24h dedup window + alerts) lives in D1 via the agent state API.
See .agents/debates/hermes-state-20260518-231225/SYNTHESIS-R2.md.
"""

import os
import sys
import base64
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from typing import List, Dict, Any
import requests

# Make sibling _lib importable when run as `python3 AEGIS/run.py`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _lib.agent_state import AgentStateClient, AgentStateError  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(asctime)s [AEGIS] %(message)s')
logger = logging.getLogger(__name__)

DEDUP_WINDOW_HOURS = 24
BATCH_SIZE = 50  # keywords per cron tick; full list rotates across runs


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

        self.state = AgentStateClient()
        self.dataforseo_base_url = 'https://api.dataforseo.com/v3'

    def _auth_header(self) -> str:
        """Generate base64 auth header for DataForSEO API"""
        credentials = f"{self.dataforseo_login}:{self.dataforseo_password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"

    def _get_seen_advertisers(self) -> Dict[str, datetime]:
        """Load 24h dedup window from D1."""
        since = int((datetime.utcnow() - timedelta(hours=DEDUP_WINDOW_HOURS)).timestamp())
        rows = self.state.list_fingerprints(agent='AEGIS', since=since, limit=500)
        return {
            r['fingerprint_key']: datetime.utcfromtimestamp(r['last_seen_at'])
            for r in rows
            if r.get('fingerprint_key') and r.get('last_seen_at') is not None
        }

    def _save_seen_advertisers(self, seen: Dict[str, datetime]):
        """Upsert 24h dedup window to D1.

        Rows older than the window age out naturally on the next read (no DELETE).
        """
        if not seen:
            return
        self.state.upsert_fingerprints([
            {
                'agent': 'AEGIS',
                'scope': '_global',
                'fingerprint_key': key,
                'fingerprint_hash': key,
                'payload': {'last_seen_iso': ts.isoformat()},
            }
            for key, ts in seen.items()
        ])

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

    def _get_batch_offset(self) -> int:
        """Load the rotating batch offset from D1."""
        rows = self.state.list_baselines(agent='AEGIS')
        for r in rows:
            if r.get('metric') == 'batch_offset':
                return int(r.get('value', 0))
        return 0

    def _save_batch_offset(self, offset: int):
        self.state.upsert_baseline({
            'agent': 'AEGIS',
            'metric': 'batch_offset',
            'scope': '_global',
            'window': 'rolling',
            'value': float(offset),
            'sample_count': 1,
        })

    def _fetch_keyword(self, keyword: str) -> List[Dict[str, Any]]:
        """Query one keyword against the SERP Ads Advertisers endpoint."""
        headers = {
            'Authorization': self._auth_header(),
            'Content-Type': 'application/json',
        }
        payload = [{'keyword': keyword, 'location_code': 2840}]
        try:
            response = requests.post(
                f'{self.dataforseo_base_url}/serp/google/ads_advertisers/live/advanced',
                json=payload,
                headers=headers,
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
            if data.get('status_code') != 20000:
                logger.warning(f"API status {data.get('status_code')} for '{keyword}': {data.get('status_message')}")
                return []
            results = []
            for task in data.get('tasks', []) or []:
                if task.get('status_code') == 20000:
                    for result in task.get('result', []) or []:
                        result['keyword'] = keyword
                        results.append(result)
                else:
                    logger.warning(f"Task error for '{keyword}': {task.get('status_message')}")
            return results
        except Exception as e:
            logger.error(f"Failed to query SERP ads for '{keyword}': {e}")
            return []

    def query_serp_ads(self, keywords: List[str]) -> List[Dict[str, Any]]:
        """Query a batch of keywords in parallel (10 workers)."""
        all_results: List[Dict[str, Any]] = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(self._fetch_keyword, kw): kw for kw in keywords}
            for future in as_completed(futures):
                all_results.extend(future.result())
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
        """Persist alert to D1 (replaces local alerts.jsonl)."""
        payload = {
            'timestamp': datetime.utcnow().isoformat(),
            'keyword': keyword,
            'domain': domain,
            'title': advertiser.get('title'),
            'url': advertiser.get('url'),
            'position': advertiser.get('position'),
        }
        self.state.create_alert(
            agent='AEGIS',
            severity='high',
            title=f"Brand-jack: {keyword} → {domain}",
            payload=payload,
        )
        logger.info(f"Alert logged: {keyword} - {domain}")

    def detect_brand_jacks(self):
        """Main detection loop — processes BATCH_SIZE keywords per tick, rotating."""
        keywords = [kw.strip() for kw in self.trademark_list if kw.strip()]
        total = len(keywords)

        offset = self._get_batch_offset()
        if offset >= total:
            offset = 0
        batch = keywords[offset:offset + BATCH_SIZE]
        next_offset = (offset + BATCH_SIZE) % total if total else 0

        logger.info(f"Brand-jack detection: batch {offset}–{offset + len(batch)} of {total} keywords")
        ads_results = self.query_serp_ads(batch)
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
        self._save_batch_offset(next_offset)
        logger.info(f"Brand-jack detection complete: {new_alerts} new alerts (next offset: {next_offset})")

def _notify_d1_failure(err: Exception):
    """Best-effort Telegram alert when the D1 agent state API is unreachable."""
    chat = os.getenv('AEGIS_TELEGRAM_CHAT_ID')
    token = os.getenv('AEGIS_TELEGRAM_BOT_TOKEN')
    if not (chat and token):
        return
    try:
        requests.post(
            f'https://api.telegram.org/bot{token}/sendMessage',
            json={
                'chat_id': chat,
                'text': f"🚨 AEGIS aborted: D1 agent state API unreachable\n{err}",
            },
            timeout=10,
        )
    except Exception:
        pass  # already failing — don't cascade


def run():
    """Entry point for Hermes. Fail-fast on D1 errors (no degraded run)."""
    try:
        detector = AEGISBrandJackDetector()
        detector.detect_brand_jacks()
    except AgentStateError as e:
        logger.error(f"D1 agent state API unreachable — aborting this tick: {e}")
        _notify_d1_failure(e)
        sys.exit(2)


if __name__ == '__main__':
    run()
