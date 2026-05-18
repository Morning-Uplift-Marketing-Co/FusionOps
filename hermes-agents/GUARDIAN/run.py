#!/usr/bin/env python3
"""GUARDIAN — Bot Radar Sentinel (every 30 min)"""

import os
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any
import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s [GUARDIAN] %(message)s')
logger = logging.getLogger(__name__)


class GuardianBotSentinel:
    def __init__(self):
        self.api_base = os.getenv('API_WORKER_BASE', 'https://lp-factory-api.misty-feather-556e.workers.dev')
        self.internal_token = os.getenv('API_WORKER_INTERNAL_TOKEN', '')
        self.telegram_chat = os.getenv('GUARDIAN_TELEGRAM_CHAT_ID')
        self.telegram_bot = os.getenv('GUARDIAN_TELEGRAM_BOT_TOKEN')

        self.state_dir = Path.home() / '.hermes' / 'guardian-state'
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.alerts_file = self.state_dir / 'alerts.jsonl'
        self.seen_file = self.state_dir / 'seen-visits.json'

        # Verbose mode: alert on every Google bot visit
        self.verbose_mode = True

        # Pre-ban thresholds
        self.spike_ratio_critical = 3.0  # 3x baseline = critical
        self.spike_ratio_elevated = 2.0  # 2x baseline = elevated

        # Bot types worth alerting (Google-specific only)
        self.google_bot_types = {'googlebot', 'adsbot', 'mediapartners', 'inspection'}

    def _get_seen(self) -> Dict[str, Any]:
        if self.seen_file.exists():
            try:
                with open(self.seen_file) as f:
                    return json.load(f)
            except Exception:
                pass
        return {'last_check_ts': 0, 'last_alerts': []}

    def _save_seen(self, data: Dict[str, Any]):
        with open(self.seen_file, 'w') as f:
            json.dump(data, f)

    def fetch_recent_bot_visits(self, since_ts: int) -> List[Dict]:
        """Fetch bot visits since last check via API Worker"""
        try:
            # Use timeline endpoint with broader query
            resp = requests.get(
                f'{self.api_base}/api/bot-radar/summary',
                timeout=30,
                headers={'X-Internal-Token': self.internal_token} if self.internal_token else {}
            )
            resp.raise_for_status()
            summary = resp.json()

            if not summary.get('success'):
                logger.warning(f"Summary fetch returned: {summary}")
                return []

            return summary.get('by_type_24h', [])
        except Exception as e:
            logger.error(f"Failed to fetch bot visits: {e}")
            return []

    def fetch_heatmap(self) -> Dict:
        """Fetch heatmap data for anomaly detection"""
        try:
            resp = requests.get(
                f'{self.api_base}/api/bot-radar/heatmap?hours=24',
                timeout=30
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"Failed to fetch heatmap: {e}")
            return {'cells': []}

    def fetch_top_ips(self) -> List[Dict]:
        """Fetch top bot IPs to identify Google reviews"""
        try:
            resp = requests.get(
                f'{self.api_base}/api/bot-radar/top-ips?limit=50',
                timeout=30
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get('ips', [])
        except Exception as e:
            logger.error(f"Failed to fetch top IPs: {e}")
            return []

    def compute_anomaly(self, cells: List[Dict]) -> Dict[str, Dict]:
        """Compute per-site anomaly scores from heatmap cells"""
        # Group by site, compute mean + last-hour
        by_site = {}
        now_hour = (int(datetime.utcnow().timestamp()) // 3600) * 3600

        for cell in cells:
            site = cell.get('site') or '(unknown)'
            if site not in by_site:
                by_site[site] = {'hours': [], 'last_hour_visits': 0}
            by_site[site]['hours'].append(cell.get('visits', 0))
            if cell.get('hour') == now_hour or cell.get('hour') == now_hour - 3600:
                by_site[site]['last_hour_visits'] += cell.get('visits', 0)

        # Compute baseline (mean) + ratio
        anomalies = {}
        for site, data in by_site.items():
            hours = data['hours']
            if not hours:
                continue
            avg = sum(hours) / len(hours)
            recent = data['last_hour_visits']

            if avg < 1:  # Too little data
                continue

            ratio = recent / avg
            status = 'normal'
            if ratio >= self.spike_ratio_critical:
                status = 'critical'
            elif ratio >= self.spike_ratio_elevated:
                status = 'elevated'

            if status != 'normal':
                anomalies[site] = {
                    'recent_1h': recent,
                    'baseline_per_hour': round(avg, 1),
                    'ratio': round(ratio, 2),
                    'status': status,
                    'anomaly_score': min(1.0, ratio / 5.0),
                }

        return anomalies

    def send_google_review_alert(self, ip_data: Dict):
        """Verbose: send Telegram alert on every Google bot visit"""
        if not (self.telegram_chat and self.telegram_bot):
            logger.info("Telegram not configured")
            return

        ptr_status = "✓ verified" if ip_data.get('ptr_record') else "no PTR"
        msg = (
            f"🤖 GOOGLE BOT REVIEW\n\n"
            f"Bot Type: {ip_data.get('bot_type', 'unknown')}\n"
            f"IP: {ip_data.get('ip', 'N/A')}\n"
            f"ASN: AS{ip_data.get('asn', 0)} {ip_data.get('org', '')}\n"
            f"Country: {ip_data.get('country', '?')}\n"
            f"PTR: {ptr_status}\n"
            f"Avg Score: {ip_data.get('avg_score', 0)}\n"
            f"Visits (24h): {ip_data.get('visits', 0)}\n"
            f"Time: {datetime.utcnow().isoformat()}Z"
        )

        try:
            requests.post(
                f'https://api.telegram.org/bot{self.telegram_bot}/sendMessage',
                json={'chat_id': self.telegram_chat, 'text': msg},
                timeout=10
            )
            logger.info(f"Alerted: Google bot {ip_data.get('ip')} ({ip_data.get('bot_type')})")
        except Exception as e:
            logger.error(f"Telegram error: {e}")

    def send_pre_ban_alert(self, site: str, anomaly: Dict):
        """Critical: pre-ban signal detected"""
        if not (self.telegram_chat and self.telegram_bot):
            return

        msg = (
            f"🚨 PRE-BAN SIGNAL — {site}\n\n"
            f"Status: {anomaly['status']}\n"
            f"Recent visits (1h): {anomaly['recent_1h']}\n"
            f"Baseline/hour: {anomaly['baseline_per_hour']}\n"
            f"Spike ratio: {anomaly['ratio']}x\n"
            f"Anomaly score: {anomaly['anomaly_score']}\n\n"
            f"⚠️ Site likely under manual review.\n"
            f"Check cloaking + compliance immediately."
        )

        try:
            requests.post(
                f'https://api.telegram.org/bot{self.telegram_bot}/sendMessage',
                json={'chat_id': self.telegram_chat, 'text': msg},
                timeout=10
            )
            logger.info(f"Pre-ban alert sent for {site}")
        except Exception as e:
            logger.error(f"Telegram error: {e}")

    def log_alert(self, alert_type: str, payload: Dict):
        entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'type': alert_type,
            'payload': payload,
        }
        with open(self.alerts_file, 'a') as f:
            f.write(json.dumps(entry) + '\n')

    def run_once(self):
        logger.info("GUARDIAN sweep starting")

        seen = self._get_seen()
        last_check = seen.get('last_check_ts', 0)
        now_ts = int(datetime.utcnow().timestamp())

        # 1. Top IPs — find new Google bot IPs
        top_ips = self.fetch_top_ips()
        google_ips = [ip for ip in top_ips
                      if ip.get('bot_type') in self.google_bot_types
                      and ip.get('last_seen', 0) >= last_check]

        logger.info(f"Found {len(google_ips)} Google bot IPs since last check")

        # Dedup by IP+last_seen
        already_alerted = set(seen.get('last_alerts', []))
        new_alerts = []
        for ip_data in google_ips:
            key = f"{ip_data.get('ip')}:{ip_data.get('last_seen')}"
            if key in already_alerted:
                continue

            if self.verbose_mode:
                self.send_google_review_alert(ip_data)
                self.log_alert('google_review', ip_data)
            new_alerts.append(key)

        # 2. Anomaly detection — heatmap analysis
        heatmap = self.fetch_heatmap()
        anomalies = self.compute_anomaly(heatmap.get('cells', []))

        for site, anom in anomalies.items():
            if anom['status'] == 'critical':
                self.send_pre_ban_alert(site, anom)
                self.log_alert('pre_ban', {'site': site, **anom})
                logger.warning(f"CRITICAL anomaly: {site} ({anom['ratio']}x baseline)")
            elif anom['status'] == 'elevated':
                logger.info(f"Elevated activity: {site} ({anom['ratio']}x)")

        # 3. Save state
        # Keep last 200 alert keys for dedup
        all_alerts = (list(already_alerted) + new_alerts)[-200:]
        self._save_seen({'last_check_ts': now_ts, 'last_alerts': all_alerts})

        logger.info(f"GUARDIAN sweep complete: {len(new_alerts)} new bot alerts, {len(anomalies)} anomalies")


def run():
    guardian = GuardianBotSentinel()
    guardian.run_once()


if __name__ == '__main__':
    run()
