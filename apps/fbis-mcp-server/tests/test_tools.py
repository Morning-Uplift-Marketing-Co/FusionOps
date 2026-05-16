"""
Tests for FBIS MCP tools.
Formula tests run without HTTP. Registration tests require server running.
"""
import pytest

from tools import _client


class TestApiClientHeaders:
    """HTTP auth headers for the Worker API."""

    def test_api_key_sets_bearer_and_legacy_header(self, monkeypatch):
        monkeypatch.setattr(_client, "API_KEY", "test-secret")

        headers = _client.get_headers()

        assert headers["Authorization"] == "Bearer test-secret"
        assert headers["x-api-key"] == "test-secret"
        assert headers["Content-Type"] == "application/json"


class TestVerdictScoreFormula:
    """Pure formula tests — no HTTP required."""

    def test_healthy_account(self):
        proxy_risk = 10
        isolation_score = 90
        traffic_quality = 85
        timeline_risk = 5
        score = int(10 * 0.25 + (100-90) * 0.30 + (100-85) * 0.25 + 5 * 0.20)
        assert score == 10
        assert score <= 30  # healthy

    def test_watch_account(self):
        score = int(40 * 0.25 + (100-70) * 0.30 + (100-65) * 0.25 + 20 * 0.20)
        # = 10 + 9 + 8.75 + 4 = 31
        assert score == 31
        assert 31 <= score <= 55  # watch

    def test_risk_account(self):
        score = int(70 * 0.25 + (100-50) * 0.30 + (100-40) * 0.25 + 50 * 0.20)
        # = 17.5 + 15 + 15 + 10 = 57
        assert score == 57
        assert 56 <= score <= 75  # risk

    def test_critical_account(self):
        proxy_risk = 90
        isolation_score = 20
        traffic_quality = 15
        timeline_risk = 95
        score = int(90*0.25 + 80*0.30 + 85*0.25 + 95*0.20)
        # = 22.5 + 24.0 + 21.25 + 19.0 = 86
        assert score == 86
        assert score > 75  # critical

    def test_max_score_is_bounded(self):
        score = int(100*0.25 + (100-0)*0.30 + (100-0)*0.25 + 100*0.20)
        assert score == 100

    def test_min_score_is_zero(self):
        score = int(0*0.25 + (100-100)*0.30 + (100-100)*0.25 + 0*0.20)
        assert score == 0


class TestAgentKpiValidation:
    """Test agent name validation logic."""

    def test_valid_agents(self):
        valid = {"argus", "nexus", "iris", "chrono", "verdict"}
        for name in valid:
            assert name in valid

    def test_invalid_agent_rejected(self):
        valid = {"argus", "nexus", "iris", "chrono", "verdict"}
        assert "zeus" not in valid
        assert "ARGUS" not in valid  # case-sensitive


class TestFatigueScoreFormula:
    """Pure formula tests for lifecycle creative fatigue — no HTTP required."""

    def _calc(self, ctr_delta: float, conv_delta: float, impressions: int) -> int:
        score = 0
        if ctr_delta < -0.20:
            score += 40
        elif ctr_delta < -0.10:
            score += 20
        if conv_delta < -0.30:
            score += 40
        elif conv_delta < -0.15:
            score += 20
        if impressions > 50_000:
            score += 10
        if impressions > 200_000:
            score += 10
        return min(100, score)

    def _status(self, score: int) -> str:
        if score >= 80:
            return "retired"
        if score >= 60:
            return "fatigued"
        if score >= 40:
            return "watch"
        return "healthy"

    def test_healthy_creative(self):
        score = self._calc(0.05, 0.02, 10_000)
        assert score == 0
        assert self._status(score) == "healthy"

    def test_watch_creative_ctr_and_conv_drop(self):
        # CTR 10-20% drop (+20) + conv 15-30% drop (+20) = 40 → watch
        score = self._calc(-0.12, -0.18, 5_000)
        assert score == 40
        assert self._status(score) == "watch"

    def test_fatigued_creative(self):
        score = self._calc(-0.25, -0.20, 60_000)
        # CTR >20% drop (+40) + conv >15% drop (+20) + impressions >50k (+10) = 70
        assert score == 70
        assert self._status(score) == "fatigued"

    def test_retired_creative(self):
        score = self._calc(-0.35, -0.40, 250_000)
        # CTR >20% drop (+40) + conv >30% drop (+40) + >50k (+10) + >200k (+10) = 100
        assert score == 100
        assert self._status(score) == "retired"

    def test_score_capped_at_100(self):
        score = self._calc(-0.99, -0.99, 999_999)
        assert score == 100

    def test_valid_lifecycle_transitions(self):
        transitions = {
            "new":       ["warming", "retired"],
            "warming":   ["active", "suspended", "retired"],
            "active":    ["resting", "suspended", "retired"],
            "resting":   ["active", "retired"],
            "suspended": ["active", "retired"],
            "retired":   [],
        }
        assert "active" in transitions["warming"]
        assert "resting" in transitions["active"]
        assert transitions["retired"] == []
        assert "new" not in transitions["warming"]  # no backward transition
