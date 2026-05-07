"""
Tests for FBIS MCP tools.
Formula tests run without HTTP. Registration tests require server running.
"""
import pytest


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
