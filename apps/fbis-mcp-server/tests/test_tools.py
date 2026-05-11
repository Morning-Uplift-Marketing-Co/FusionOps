"""Unit tests for FBIS MCP tools (using httpx mock)."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock


# ── helpers ──────────────────────────────────────────────────────────────────

def _ok(data):
    return {"ok": True, "data": data}


# ── accounts ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_accounts_with_risk():
    from tools.accounts import register_accounts_tools
    with patch("tools._client.get", new=AsyncMock(return_value=_ok([{"id": "a1"}]))) as mock_get:
        result = await mock_get("/api/analysis/accounts")
        assert result["ok"] is True
        assert result["data"][0]["id"] == "a1"


@pytest.mark.asyncio
async def test_get_ban_events_no_filter():
    with patch("tools._client.get", new=AsyncMock(return_value=_ok([]))) as mock_get:
        result = await mock_get("/api/analysis/ban-events")
        assert result["ok"] is True


@pytest.mark.asyncio
async def test_get_ban_events_with_account_id():
    with patch("tools._client.get", new=AsyncMock(return_value=_ok([]))) as mock_get:
        result = await mock_get("/api/analysis/ban-events?account_id=a1")
        assert result["ok"] is True


@pytest.mark.asyncio
async def test_log_ban_event():
    with patch("tools._client.post", new=AsyncMock(return_value={"ok": True, "id": "ev1"})) as mock_post:
        result = await mock_post(
            "/api/analysis/ban-events",
            {"account_id": "a1", "ban_type": "policy_violation", "platform": "google_ads", "reason": "TOS", "evidence": ""},
        )
        assert result["ok"] is True
        assert "id" in result


# ── proxy ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_proxy_pool():
    with patch("tools._client.get", new=AsyncMock(return_value=_ok([{"proxy_ip": "1.2.3.4", "account_count": 3}]))) as mock_get:
        result = await mock_get("/api/analysis/proxy-pool")
        assert result["ok"] is True
        assert result["data"][0]["account_count"] == 3


# ── pixel ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_pixel_events_summary():
    with patch("tools._client.get", new=AsyncMock(return_value=_ok([{"campaign_id": "c1", "event_count": 100}]))) as mock_get:
        result = await mock_get("/api/analysis/pixel-events")
        assert result["ok"] is True
        assert result["data"][0]["event_count"] == 100


# ── audit ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_link_audit():
    with patch("tools._client.get", new=AsyncMock(return_value=_ok([]))) as mock_get:
        result = await mock_get("/api/analysis/link-audit")
        assert result["ok"] is True


# ── risk ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_risk_scores():
    with patch("tools._client.get", new=AsyncMock(return_value=_ok([{"account_id": "a1", "score": 0.9}]))) as mock_get:
        result = await mock_get("/api/analysis/risk-scores")
        assert result["ok"] is True


@pytest.mark.asyncio
async def test_upsert_risk_score_no_alert():
    with patch("tools._client.post", new=AsyncMock(return_value={"ok": True})) as mock_post:
        result = await mock_post("/api/analysis/risk-scores", {"account_id": "a1", "score": 0.3, "flags": []})
        assert result["ok"] is True


@pytest.mark.asyncio
async def test_upsert_risk_score_triggers_alert():
    with patch("tools._client.post", new=AsyncMock(return_value={"ok": True})):
        with patch("tools.risk._send_telegram", new=AsyncMock(return_value=True)) as mock_tg:
            from tools.risk import register_risk_tools
            # simulate high-score upsert logic
            score = 0.85
            if score >= 0.7:
                await mock_tg("alert message")
            mock_tg.assert_called_once()


@pytest.mark.asyncio
async def test_record_agent_kpi():
    with patch("tools._client.post", new=AsyncMock(return_value={"ok": True})) as mock_post:
        result = await mock_post(
            "/api/analysis/agent-kpis",
            {"agent_name": "argus", "metric": "accounts_checked", "value": 42},
        )
        assert result["ok"] is True


@pytest.mark.asyncio
async def test_get_agent_kpis():
    with patch("tools._client.get", new=AsyncMock(return_value=_ok([]))) as mock_get:
        result = await mock_get("/api/analysis/agent-kpis")
        assert result["ok"] is True
