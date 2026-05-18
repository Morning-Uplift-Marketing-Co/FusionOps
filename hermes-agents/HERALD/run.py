#!/usr/bin/env python3
"""HERALD — Trend & Reputation Monitor"""

import os
import json
import base64
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
import requests
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s [HERALD] %(message)s')
logger = logging.getLogger(__name__)

class HERALDTrendMonitor:
    def __init__(self):
        self.dataforseo_login = os.getenv('DATAFORSEO_LOGIN')
        self.dataforseo_password = os.getenv('DATAFORSEO_PASSWORD')
        self.competitor_list = os.getenv('COMPETITOR_LIST', '').split(',')
        self.telegram_chat_id = os.getenv('HERALD_TELEGRAM_CHAT_ID')
        self.telegram_bot_token = os.getenv('HERALD_TELEGRAM_BOT_TOKEN')

        self.state_dir = Path.home() / '.hermes' / 'herald-state'
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.baselines_file = self.state_dir / 'baselines.json'
        self.alerts_file = self.state_dir / 'alerts.jsonl'

        self.dataforseo_base_url = 'https://api.dataforseo.com/v3'
        self.trend_threshold = 25  # Percentage point increase
        self.review_threshold = -0.5  # Rating drop

    def _auth_header(self) -> str:
        credentials = f"{self.dataforseo_login}:{self.dataforseo_password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"

    def _get_baselines(self) -> Dict[str, Dict[str, Any]]:
        if self.baselines_file.exists():
            with open(self.baselines_file) as f:
                return json.load(f)
        return {}

    def _save_baselines(self, baselines: Dict[str, Dict[str, Any]]):
        with open(self.baselines_file, 'w') as f:
            json.dump(baselines, f, indent=2)

    def query_google_trends(self, keyword: str) -> Dict[str, Any]:
        """Query Google Trends search interest"""
        headers = {
            'Authorization': self._auth_header(),
            'Content-Type': 'application/json'
        }

        payload = [
            {
                'keywords': [keyword],
                'location_code': 2840,
                'language_code': 'en'
            }
        ]

        try:
            response = requests.post(
                f'{self.dataforseo_base_url}/keywords_data/google_trends/explore/live',
                json=payload,
                headers=headers,
                timeout=60
            )
            response.raise_for_status()
            data = response.json()
            if data.get('status_code') != 20000:
                logger.warning(f"Trends API status: {data.get('status_message')}")
                return {}
            for task in data.get('tasks', []) or []:
                if task.get('status_code') == 20000:
                    result = (task.get('result') or [{}])[0]
                    # Extract average interest from items
                    items = result.get('items') or []
                    if items:
                        # google_trends_graph item has 'data' array of {date, values: [int]}
                        for item in items:
                            if item.get('type') == 'google_trends_graph':
                                data_points = item.get('data') or []
                                if data_points:
                                    # Average the last 4 weeks values
                                    recent_values = []
                                    for point in data_points[-4:]:
                                        vals = point.get('values') or []
                                        if vals and vals[0] is not None:
                                            recent_values.append(vals[0])
                                    avg = sum(recent_values) / len(recent_values) if recent_values else 0
                                    return {'interest': avg, 'keyword': keyword}
                    return result
            return {}
        except Exception as e:
            logger.error(f"Failed to query Google Trends for '{keyword}': {e}")
            return {}

    def query_trustpilot_reviews(self, company_name: str) -> Dict[str, Any]:
        """Query Trustpilot reviews via task_post (task-based; check next run)"""
        # Trustpilot only has task-based API, not live.
        # Step 1: POST task → step 2: poll task_get/{id}
        # For now: post task and return cached result if exists
        headers = {
            'Authorization': self._auth_header(),
            'Content-Type': 'application/json'
        }

        # Trustpilot expects domain (e.g., "lendify.com") not company name
        domain = company_name if '.' in company_name else f'{company_name.lower().replace(" ", "")}.com'

        payload = [
            {
                'domain': domain,
                'depth': 100,
                'sort_by': 'recency'
            }
        ]

        try:
            # Post task (results retrieved next run via tasks_ready/task_get)
            response = requests.post(
                f'{self.dataforseo_base_url}/business_data/trustpilot/reviews/task_post',
                json=payload,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            # task_post returns task_id; results not immediately available
            # Try to fetch cached results via tasks_ready
            if data.get('status_code') == 20000:
                logger.info(f"Trustpilot task queued for {domain}")
                # Try fetch previously-queued results
                ready_resp = requests.get(
                    f'{self.dataforseo_base_url}/business_data/trustpilot/reviews/tasks_ready',
                    headers=headers,
                    timeout=15
                )
                if ready_resp.ok:
                    ready_data = ready_resp.json()
                    for task in (ready_data.get('tasks') or []):
                        for item in (task.get('result') or []):
                            task_id = item.get('id')
                            if task_id:
                                # Fetch the result
                                get_resp = requests.get(
                                    f'{self.dataforseo_base_url}/business_data/trustpilot/reviews/task_get/{task_id}',
                                    headers=headers,
                                    timeout=15
                                )
                                if get_resp.ok:
                                    get_data = get_resp.json()
                                    for t in (get_data.get('tasks') or []):
                                        for r in (t.get('result') or []):
                                            reviews = r.get('items') or []
                                            if reviews:
                                                ratings = [rev.get('rating', {}).get('value', 0) for rev in reviews if rev.get('rating')]
                                                if ratings:
                                                    return {
                                                        'avg_rating': sum(ratings) / len(ratings),
                                                        'review_count': len(reviews),
                                                        'reviews': reviews
                                                    }
            return {'avg_rating': None, 'review_count': 0}
        except Exception as e:
            logger.error(f"Failed to query Trustpilot: {e}")
            return {'avg_rating': None, 'review_count': 0}

    def query_cfpb_complaints(self, company_name: str) -> int:
        """Query CFPB complaints database (correct API URL)"""
        try:
            url = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/'
            params = {
                'search_term': company_name,
                'size': 100,
                'no_aggs': 'true'
            }
            response = requests.get(url, params=params, timeout=30,
                                    headers={'User-Agent': 'HERMES-HERALD-Agent/1.0'})
            response.raise_for_status()
            data = response.json()
            # CFPB returns: { hits: { hits: [...], total: { value: N } } }
            return data.get('hits', {}).get('total', {}).get('value', 0)
        except Exception as e:
            logger.error(f"Failed to query CFPB: {e}")
            return 0

    def check_trend_surge(self, competitor: str, current_trend: Dict) -> bool:
        """Check for trend surge >threshold"""
        baselines = self._get_baselines()
        baseline_key = f"{competitor}:trend"

        if baseline_key not in baselines:
            baselines[baseline_key] = {'value': current_trend.get('interest', 0), 'date': datetime.utcnow().isoformat()}
            self._save_baselines(baselines)
            return False

        prev_value = baselines[baseline_key].get('value', 0)
        curr_value = current_trend.get('interest', 0)

        if curr_value - prev_value >= self.trend_threshold:
            logger.info(f"Trend surge detected for {competitor}: {prev_value} → {curr_value}")
            baselines[baseline_key] = {'value': curr_value, 'date': datetime.utcnow().isoformat()}
            self._save_baselines(baselines)
            return True

        return False

    def check_reputation_decline(self, competitor: str, current_rating: Dict) -> bool:
        """Check for reputation decline >threshold"""
        if current_rating.get('avg_rating') is None:
            return False

        baselines = self._get_baselines()
        baseline_key = f"{competitor}:rating"

        if baseline_key not in baselines:
            baselines[baseline_key] = {'value': current_rating['avg_rating'], 'date': datetime.utcnow().isoformat()}
            self._save_baselines(baselines)
            return False

        prev_rating = baselines[baseline_key].get('value', 0)
        curr_rating = current_rating['avg_rating']

        if prev_rating - curr_rating >= abs(self.review_threshold):
            logger.info(f"Reputation decline detected for {competitor}: {prev_rating} → {curr_rating}")
            baselines[baseline_key] = {'value': curr_rating, 'date': datetime.utcnow().isoformat()}
            self._save_baselines(baselines)
            return True

        return False

    def _send_alert(self, alert_type: str, details: Dict):
        if not (self.telegram_chat_id and self.telegram_bot_token):
            logger.warning("Telegram not configured")
            return

        if alert_type == 'trend_surge':
            message = f"""📈 COMPETITOR TREND SURGE

Competitor: {details['competitor']}
Trend Increase: {details['increase']} points
Previous: {details['prev_value']} → Current: {details['curr_value']}
"""
        elif alert_type == 'reputation_decline':
            message = f"""🔴 REPUTATION DECLINE

Competitor: {details['competitor']}
Rating Change: {details['change']:.1f} stars
Previous: {details['prev_rating']:.1f}⭐ → Current: {details['curr_rating']:.1f}⭐
Recent Reviews: {details['review_count']} (avg {details['avg_recent']:.1f}⭐)
"""
        elif alert_type == 'complaint_surge':
            message = f"""⚠️ COMPLAINT SURGE

Competitor: {details['competitor']}
CFPB Complaints: {details['complaints']} (past 30 days)
"""
        else:
            return

        try:
            requests.post(
                f'https://api.telegram.org/bot{self.telegram_bot_token}/sendMessage',
                json={'chat_id': self.telegram_chat_id, 'text': message, 'parse_mode': 'HTML'},
                timeout=10
            )
            logger.info(f"Telegram alert sent for {details.get('competitor')}")
        except Exception as e:
            logger.error(f"Failed to send Telegram alert: {e}")

    def _log_alert(self, alert_type: str, details: Dict):
        alert = {
            'timestamp': datetime.utcnow().isoformat(),
            'type': alert_type,
            'details': details
        }
        with open(self.alerts_file, 'a') as f:
            f.write(json.dumps(alert) + '\n')

    def monitor_competitors(self):
        """Main monitoring loop"""
        logger.info(f"Monitoring {len(self.competitor_list)} competitors for trends/reputation")

        for competitor in self.competitor_list:
            competitor = competitor.strip()

            # Check trends
            trend_data = self.query_google_trends(competitor)
            if self.check_trend_surge(competitor, trend_data):
                details = {
                    'competitor': competitor,
                    'increase': trend_data.get('interest', 0) - self._get_baselines().get(f"{competitor}:trend", {}).get('value', 0),
                    'prev_value': self._get_baselines().get(f"{competitor}:trend", {}).get('value', 0),
                    'curr_value': trend_data.get('interest', 0)
                }
                self._send_alert('trend_surge', details)
                self._log_alert('trend_surge', details)

            # Check reputation
            review_data = self.query_trustpilot_reviews(competitor)
            if self.check_reputation_decline(competitor, review_data):
                prev_rating = self._get_baselines().get(f"{competitor}:rating", {}).get('value', 0)
                details = {
                    'competitor': competitor,
                    'change': review_data['avg_rating'] - prev_rating,
                    'prev_rating': prev_rating,
                    'curr_rating': review_data['avg_rating'],
                    'review_count': review_data['review_count'],
                    'avg_recent': review_data['avg_rating']
                }
                self._send_alert('reputation_decline', details)
                self._log_alert('reputation_decline', details)

            # Check complaints
            complaint_count = self.query_cfpb_complaints(competitor)
            if complaint_count > 50:
                details = {'competitor': competitor, 'complaints': complaint_count}
                self._send_alert('complaint_surge', details)
                self._log_alert('complaint_surge', details)

        logger.info("Trend and reputation monitoring complete")

def run():
    """Entry point for Hermes"""
    herald = HERALDTrendMonitor()
    herald.monitor_competitors()

if __name__ == '__main__':
    run()
