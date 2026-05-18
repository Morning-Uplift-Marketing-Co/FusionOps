#!/usr/bin/env python3
"""ORACLE — Keyword Discovery

State (weekly baseline + discovered keywords) lives in D1 via the agent state API.
See .agents/debates/hermes-state-20260518-231225/SYNTHESIS-R2.md.
"""

import os
import sys
import base64
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Set, Tuple
import requests

# Make sibling _lib importable when run as `python3 ORACLE/run.py`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _lib.agent_state import AgentStateClient, AgentStateError  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(asctime)s [ORACLE] %(message)s')
logger = logging.getLogger(__name__)

BASELINE_SOURCE = 'weekly_baseline'
DISCOVERED_SOURCE = 'suggestion'
# ORACLE runs weekly (Mon 09:00 UTC). 9d window covers 1 missed run + safety margin.
BASELINE_WINDOW_DAYS = 9


class OracleKeywordDiscovery:
    def __init__(self):
        self.dataforseo_login = os.getenv('DATAFORSEO_LOGIN')
        self.dataforseo_password = os.getenv('DATAFORSEO_PASSWORD')
        self.trademark_list = os.getenv('TRADEMARK_LIST', '').split(',')
        self.telegram_chat_id = os.getenv('ORACLE_TELEGRAM_CHAT_ID')
        self.telegram_bot_token = os.getenv('ORACLE_TELEGRAM_BOT_TOKEN')

        self.state = AgentStateClient()
        self.dataforseo_base_url = 'https://api.dataforseo.com/v3'
        self.min_search_volume = 100

        # Brand protection terms to filter out
        self.protection_filters = {'scam', 'complaint', 'reddit', 'reviews', 'fake', 'lawsuit', 'bad'}

        # Buffer for log_keyword calls — flushed as a single batch upsert at end of run.
        self._keyword_log_buffer: List[Dict[str, int]] = []

    def _auth_header(self) -> str:
        credentials = f"{self.dataforseo_login}:{self.dataforseo_password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"

    def _contains_brand(self, keyword: str) -> bool:
        """Check if keyword contains any trademark brand"""
        keyword_lower = keyword.lower()
        return any(brand.lower() in keyword_lower for brand in self.trademark_list)

    def _contains_protection_filter(self, keyword: str) -> Tuple[bool, str]:
        """Check if keyword contains brand protection terms"""
        keyword_lower = keyword.lower()
        for term in self.protection_filters:
            if term in keyword_lower:
                return True, term
        return False, None

    def _has_commercial_intent(self, intent_data: Dict) -> bool:
        """Check if keyword has commercial or transactional intent"""
        intent = intent_data.get('intent', '').lower()
        return intent in ['commercial', 'transactional', 'commercial (products)', 'transactional (e-commerce)']

    def query_keyword_suggestions(self) -> List[str]:
        """Query Labs/Keyword Suggestions endpoint"""
        headers = {
            'Authorization': self._auth_header(),
            'Content-Type': 'application/json'
        }

        # Use trademark brands as seeds (more relevant)
        base_keywords = [b.strip() for b in self.trademark_list if b.strip()][:10] or [
            'personal loan',
            'installment loan',
            'payday loan'
        ]

        suggestions = set()

        for base_keyword in base_keywords:
            payload = [
                {
                    'keyword': base_keyword,
                    'location_code': 2840,
                    'language_code': 'en',
                    'limit': 100
                }
            ]

            try:
                response = requests.post(
                    f'{self.dataforseo_base_url}/dataforseo_labs/google/keyword_suggestions/live',
                    json=payload,
                    headers=headers,
                    timeout=60
                )
                response.raise_for_status()
                data = response.json()
                if data.get('status_code') != 20000:
                    logger.warning(f"Suggestions API status: {data.get('status_message')}")
                    continue
                for task in data.get('tasks', []) or []:
                    if task.get('status_code') == 20000:
                        for result in task.get('result', []) or []:
                            for item in (result.get('items') or []):
                                kw = item.get('keyword', '').strip()
                                if kw:
                                    suggestions.add(kw)
                    else:
                        logger.warning(f"Suggestions task error: {task.get('status_message')}")
            except Exception as e:
                logger.error(f"Failed to query keyword suggestions for '{base_keyword}': {e}")

        return list(suggestions)

    def query_search_volume(self, keywords: List[str]) -> Dict[str, int]:
        """Query search volume for keywords"""
        headers = {
            'Authorization': self._auth_header(),
            'Content-Type': 'application/json'
        }

        volumes = {}

        # Batch queries (100 keywords per request)
        for i in range(0, len(keywords), 100):
            batch = keywords[i:i+100]
            payload = [
                {
                    'keywords': batch,
                    'location_code': 2840
                }
            ]

            try:
                response = requests.post(
                    f'{self.dataforseo_base_url}/keywords_data/google_ads/search_volume/live',
                    json=payload,
                    headers=headers,
                    timeout=60
                )
                response.raise_for_status()
                data = response.json()
                if data.get('status_code') != 20000:
                    logger.warning(f"Volume API status: {data.get('status_message')}")
                    continue
                for task in data.get('tasks', []) or []:
                    if task.get('status_code') == 20000:
                        for item in (task.get('result') or []):
                            keyword = item.get('keyword', '')
                            volume = item.get('search_volume') or 0
                            volumes[keyword] = volume
            except Exception as e:
                logger.error(f"Failed to query search volume: {e}")

        return volumes

    def query_search_intent(self, keywords: List[str]) -> Dict[str, str]:
        """Query search intent for keywords"""
        headers = {
            'Authorization': self._auth_header(),
            'Content-Type': 'application/json'
        }

        intents = {}

        for i in range(0, len(keywords), 100):
            batch = keywords[i:i+100]
            payload = [{'keywords': batch, 'language_code': 'en'}]

            try:
                response = requests.post(
                    f'{self.dataforseo_base_url}/dataforseo_labs/google/search_intent/live',
                    json=payload,
                    headers=headers,
                    timeout=60
                )
                response.raise_for_status()
                data = response.json()
                if data.get('status_code') != 20000:
                    logger.warning(f"Intent API status: {data.get('status_message')}")
                    continue
                for task in data.get('tasks', []) or []:
                    if task.get('status_code') == 20000:
                        for result in (task.get('result') or []):
                            for item in (result.get('items') or []):
                                keyword = item.get('keyword', '')
                                # Intent structure has keyword_intent.label
                                ki = item.get('keyword_intent') or {}
                                intent = ki.get('label', 'unknown')
                                intents[keyword] = intent
            except Exception as e:
                logger.error(f"Failed to query search intent: {e}")

        return intents

    def query_google_autocomplete(self, seed_keyword: str) -> List[str]:
        """Query Google Autocomplete for suggestions"""
        suggestions = []
        try:
            response = requests.get(
                'https://www.google.com/complete/search',
                params={
                    'q': seed_keyword,
                    'client': 'firefox'
                },
                timeout=10
            )
            response.raise_for_status()
            # Parse JSON response [query, [suggestions], ...]
            data = response.json()
            if len(data) > 1 and isinstance(data[1], list):
                suggestions.extend(data[1])
        except Exception as e:
            logger.error(f"Failed to query Google Autocomplete: {e}")

        return suggestions

    def get_baseline_keywords(self) -> Set[str]:
        """Load previous week's keywords for dedup (from D1).

        Reads with a 9-day lookback so stale baselines from 2+ weeks ago
        age out naturally — no DELETE needed.
        """
        since = int((datetime.utcnow() - timedelta(days=BASELINE_WINDOW_DAYS)).timestamp())
        rows = self.state.list_oracle_keywords(source=BASELINE_SOURCE, since=since, limit=500)
        return {r['keyword'] for r in rows if r.get('keyword')}

    def save_baseline_keywords(self, keywords: Set[str]):
        """Upsert current week's keywords as the new baseline.

        Rows older than BASELINE_WINDOW_DAYS will age out from future reads
        because get_baseline_keywords filters on last_seen_at.
        """
        if not keywords:
            return
        self.state.upsert_oracle_keywords([
            {'keyword': kw, 'source': BASELINE_SOURCE, 'volume': 0, 'weekly_baseline_volume': 0}
            for kw in keywords
        ])

    def log_keyword(self, keyword: str, volume: int, intent: str, source: str, filtered_reason: str = None):
        """Buffer a discovered keyword for batched upsert at end of run.

        Note: `intent` and `filtered_reason` are NOT stored in the oracle_keywords
        table (no column for them). They're surfaced in the per-run report alert
        instead. The pre-existing keywords.jsonl audit trail is replaced by
        querying agent_alerts for the latest ORACLE run.
        """
        self._keyword_log_buffer.append({
            'keyword': keyword,
            'source': DISCOVERED_SOURCE,
            'volume': int(volume or 0),
        })

    def _flush_keyword_log(self):
        """Bulk-upsert all buffered keywords to D1 (single batch call)."""
        if not self._keyword_log_buffer:
            return
        self.state.upsert_oracle_keywords(self._keyword_log_buffer)
        logger.info(f"Flushed {len(self._keyword_log_buffer)} keywords to oracle_keywords")
        self._keyword_log_buffer = []

    def _send_report(self, new_keywords: List[Dict], rising_volume: List[Dict], filtered_out: List[Dict]):
        if not (self.telegram_chat_id and self.telegram_bot_token):
            logger.warning("Telegram not configured")
            return

        message = f"""🔮 KEYWORD DISCOVERY REPORT

Period: {(datetime.utcnow() - timedelta(days=7)).strftime('%Y-%m-%d')} to {datetime.utcnow().strftime('%Y-%m-%d')}
New Keywords: {len(new_keywords)}

NEW VARIANTS (Commercial Intent):
"""
        for kw in new_keywords[:5]:
            message += f"\n{kw['keyword']} (Vol: {kw['volume']}/mo, Intent: {kw['intent']})"

        if rising_volume:
            message += "\n\nRISING VOLUME:"
            for kw in rising_volume[:3]:
                message += f"\n- {kw['keyword']} (Prev: {kw.get('prev_vol', '?')} → Now: {kw['volume']}/mo)"

        if filtered_out:
            message += f"\n\nFILTERED OUT: {len(filtered_out)} keywords (brand protection)"

        try:
            requests.post(
                f'https://api.telegram.org/bot{self.telegram_bot_token}/sendMessage',
                json={'chat_id': self.telegram_chat_id, 'text': message, 'parse_mode': 'HTML'},
                timeout=10
            )
            logger.info("Weekly keyword discovery report sent to Telegram")
        except Exception as e:
            logger.error(f"Failed to send Telegram report: {e}")

    def discover_keywords(self):
        """Main discovery loop"""
        logger.info(f"Starting keyword discovery for {len(self.trademark_list)} brands")

        # Step 1: Get keyword suggestions
        suggestions = self.query_keyword_suggestions()
        logger.info(f"Got {len(suggestions)} suggestions")

        # Step 2: Filter by brand + get search volume
        brand_keywords = [kw for kw in suggestions if self._contains_brand(kw)]
        logger.info(f"Filtered to {len(brand_keywords)} brand-related keywords")

        # Step 3: Query search volumes
        volumes = self.query_search_volume(brand_keywords)

        # Step 4: Query search intent
        intents = self.query_search_intent(brand_keywords)

        # Step 5: Apply commercial intent + minimum volume filters
        new_keywords = []
        filtered_out = []
        baseline = self.get_baseline_keywords()

        for kw in brand_keywords:
            volume = volumes.get(kw, 0)
            intent = intents.get(kw, 'unknown')

            # Check protection filters
            is_protected, reason = self._contains_protection_filter(kw)
            if is_protected:
                filtered_out.append({'keyword': kw, 'reason': f'brand_protection ({reason})'})
                self.log_keyword(kw, volume, intent, 'suggestion', f'brand_protection_{reason}')
                continue

            # Check commercial intent
            if not self._has_commercial_intent({'intent': intent}):
                filtered_out.append({'keyword': kw, 'reason': 'non_commercial_intent'})
                self.log_keyword(kw, volume, intent, 'suggestion', 'non_commercial_intent')
                continue

            # Check minimum volume
            if volume < self.min_search_volume:
                filtered_out.append({'keyword': kw, 'reason': f'low_volume ({volume})'})
                self.log_keyword(kw, volume, intent, 'suggestion', f'low_volume_{volume}')
                continue

            # Not in baseline = new
            if kw not in baseline:
                new_keywords.append({'keyword': kw, 'volume': volume, 'intent': intent})
                self.log_keyword(kw, volume, intent, 'suggestion')

        logger.info(f"Discovered {len(new_keywords)} new commercial keywords, filtered {len(filtered_out)}")

        # Step 6: Check for rising volume
        rising_volume = []
        for kw in brand_keywords:
            if kw in baseline:
                prev_vol = volumes.get(f"{kw}_prev", 0)  # Would need historical data
                curr_vol = volumes.get(kw, 0)
                if curr_vol > 0 and prev_vol > 0 and curr_vol > prev_vol * 1.3:  # 30% growth
                    rising_volume.append({'keyword': kw, 'prev_vol': prev_vol, 'volume': curr_vol})

        # Step 7: Save new baseline, flush keyword log to D1, send reports.
        self.save_baseline_keywords(set(brand_keywords))
        self._flush_keyword_log()
        self._record_run_report(new_keywords, rising_volume, filtered_out)
        self._send_report(new_keywords, rising_volume, filtered_out)

        logger.info("Keyword discovery complete")

    def _record_run_report(self, new_keywords: List[Dict], rising_volume: List[Dict], filtered_out: List[Dict]):
        """Persist the per-run discovery report as a single D1 alert entry.

        Replaces the historical role of keywords.jsonl as a structured audit trail —
        callers can query `GET /api/agents/state/alerts?agent=ORACLE` to see what
        each weekly run discovered and filtered.
        """
        self.state.create_alert(
            agent='ORACLE',
            severity='info',
            title=f"Weekly keyword discovery — {len(new_keywords)} new, {len(filtered_out)} filtered",
            payload={
                'timestamp': datetime.utcnow().isoformat(),
                'period_start': (datetime.utcnow() - timedelta(days=7)).date().isoformat(),
                'period_end': datetime.utcnow().date().isoformat(),
                'new_keywords': new_keywords,
                'rising_volume': rising_volume,
                'filtered_out': filtered_out,
            },
        )

def _notify_d1_failure(err: Exception):
    chat = os.getenv('ORACLE_TELEGRAM_CHAT_ID')
    token = os.getenv('ORACLE_TELEGRAM_BOT_TOKEN')
    if not (chat and token):
        return
    try:
        requests.post(
            f'https://api.telegram.org/bot{token}/sendMessage',
            json={
                'chat_id': chat,
                'text': f"🚨 ORACLE aborted: D1 agent state API unreachable\n{err}",
            },
            timeout=10,
        )
    except Exception:
        pass


def run():
    """Entry point for Hermes. Fail-fast on D1 errors (no degraded run)."""
    try:
        oracle = OracleKeywordDiscovery()
        oracle.discover_keywords()
    except AgentStateError as e:
        logger.error(f"D1 agent state API unreachable — aborting this tick: {e}")
        _notify_d1_failure(e)
        sys.exit(2)


if __name__ == '__main__':
    run()
