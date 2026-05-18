"""Shared HTTP client for Hermes agents → D1 agent state API.

Used by AEGIS/SCOUT/HERALD/ORACLE to read+write canonical state.
Replaces legacy ~/.hermes/{agent}-state/*.json local files.

Decision context: .agents/debates/hermes-state-20260518-231225/SYNTHESIS-R2.md

Failure contract (from the debate): if D1 is unreachable, raise. Agents that
catch the exception should log + telegram-alert + exit. NO degraded mode —
"no decision" beats "decision from stale state" for monitoring agents.
"""
import os
import logging
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

DEFAULT_API_BASE = "https://lp-factory-api.misty-feather-556e.workers.dev"
DEFAULT_ORIGIN = "https://fusionops-web.pages.dev"
DEFAULT_TIMEOUT = 30  # seconds


class AgentStateError(Exception):
    """Raised when the agent state API is unreachable or returns an error."""


class AgentStateClient:
    """Thin wrapper over /api/agents/state/* endpoints."""

    def __init__(
        self,
        api_base: Optional[str] = None,
        api_key: Optional[str] = None,
        origin: Optional[str] = None,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        self.api_base = (api_base or os.getenv("FBIS_API_BASE", DEFAULT_API_BASE)).rstrip("/")
        self.api_key = api_key or os.getenv("FUSIONOPS_API_KEY") or os.getenv("FBIS_API_KEY", "")
        self.origin = origin or os.getenv("FBIS_API_ORIGIN", DEFAULT_ORIGIN)
        self.timeout = timeout

        if not self.api_key:
            raise AgentStateError(
                "FUSIONOPS_API_KEY (or FBIS_API_KEY) is not set — agent cannot reach D1 API"
            )

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Origin": self.origin,
            "Content-Type": "application/json",
        }

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.api_base}{path}"
        try:
            r = requests.get(url, params=params, headers=self._headers(), timeout=self.timeout)
            r.raise_for_status()
        except requests.RequestException as e:
            raise AgentStateError(f"GET {path} failed: {e}") from e
        return r.json()

    def _post(self, path: str, body: Any) -> Dict[str, Any]:
        url = f"{self.api_base}{path}"
        try:
            r = requests.post(url, json=body, headers=self._headers(), timeout=self.timeout)
            r.raise_for_status()
        except requests.RequestException as e:
            raise AgentStateError(f"POST {path} failed: {e}") from e
        return r.json()

    # ── Fingerprints (AEGIS dedup, SCOUT change detection) ──────────────────

    def list_fingerprints(
        self,
        agent: str,
        scope: Optional[str] = None,
        since: Optional[int] = None,
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {"agent": agent, "limit": limit}
        if scope:
            params["scope"] = scope
        if since is not None:
            params["since"] = int(since)
        return self._get("/api/agents/state/fingerprints", params).get("fingerprints", [])

    def upsert_fingerprints(self, rows: List[Dict[str, Any]]) -> int:
        if not rows:
            return 0
        return int(self._post("/api/agents/state/fingerprints", rows).get("upserted", 0))

    # ── Baselines (HERALD anomaly thresholds) ───────────────────────────────

    def list_baselines(
        self, agent: str, metric: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {"agent": agent}
        if metric:
            params["metric"] = metric
        return self._get("/api/agents/state/baselines", params).get("baselines", [])

    def upsert_baseline(self, row: Dict[str, Any]) -> None:
        self._post("/api/agents/state/baselines", row)

    # ── Alerts (any agent → human inbox) ────────────────────────────────────

    def create_alert(
        self,
        agent: str,
        severity: str,
        title: str,
        payload: Dict[str, Any],
    ) -> Optional[int]:
        body = {"agent": agent, "severity": severity, "title": title, "payload": payload}
        return self._post("/api/agents/state/alerts", body).get("id")

    # ── ORACLE keyword corpus ───────────────────────────────────────────────

    def upsert_oracle_keywords(self, rows: List[Dict[str, Any]]) -> int:
        if not rows:
            return 0
        return int(self._post("/api/agents/state/oracle-keywords", rows).get("upserted", 0))

    def list_oracle_keywords(
        self,
        source: Optional[str] = None,
        since: Optional[int] = None,
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {"limit": limit}
        if source:
            params["source"] = source
        if since is not None:
            params["since"] = int(since)
        return self._get("/api/agents/state/oracle-keywords", params).get("keywords", [])
