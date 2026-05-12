"""
lifecycle.py — MCP tools for Phase 2 Lifecycle Engine
Wraps /api/lifecycle/* endpoints on lp-factory-api
"""

from fastmcp import FastMCP
from tools._client import api_get, api_post


def register(mcp: FastMCP) -> None:

    # ─── State Machine ────────────────────────────────────────────────────────

    @mcp.tool()
    async def list_lifecycle_accounts() -> dict:
        """List all accounts with their current lifecycle state, warming_day, daily_spend_cap, risk score."""
        return await api_get("/api/lifecycle/accounts")

    @mcp.tool()
    async def transition_account(
        account_id: str,
        to_state: str,
        reason: str,
        triggered_by: str = "hermes",
        risk_score: int | None = None,
    ) -> dict:
        """
        Transition an account to a new lifecycle state.
        Valid transitions: new→warming, warming→active|suspended|retired,
        active→resting|suspended|retired, resting→active|retired,
        suspended→active|retired
        """
        return await api_post("/api/lifecycle/transition", {
            "accountId": account_id,
            "toState": to_state,
            "reason": reason,
            "triggeredBy": triggered_by,
            "riskScore": risk_score,
        })

    @mcp.tool()
    async def get_transition_history(account_id: str) -> dict:
        """Get the last 50 lifecycle state transitions for an account."""
        return await api_get(f"/api/lifecycle/transitions/{account_id}")

    # ─── Spend Intelligence ───────────────────────────────────────────────────

    @mcp.tool()
    async def record_spend_snapshot(
        account_id: str,
        spend: float,
        budget: float,
        conversions: float = 0,
        cpa: float | None = None,
        roas: float | None = None,
        risk_score: int = 0,
    ) -> dict:
        """
        Record today's spend snapshot for an account.
        Calculates utilization_pct = spend/budget*100 automatically.
        """
        return await api_post("/api/lifecycle/spend-snapshot", {
            "accountId": account_id,
            "spend": spend,
            "budget": budget,
            "conversions": conversions,
            "cpa": cpa,
            "roas": roas,
            "riskScore": risk_score,
        })

    @mcp.tool()
    async def get_budget_recommendation(account_id: str) -> dict:
        """
        Get budget adjustment recommendation from 7-day rolling spend history.
        Requires at least 3 days of snapshots.
        Returns: { currentBudget, recommendedCap, deltaPct, signal, reason }
        Signals: risk_high (cut 50%), overspend (cut 10%), underutilized (raise 15%)
        """
        return await api_get(f"/api/lifecycle/budget-recommend/{account_id}")

    # ─── Creative Fatigue ─────────────────────────────────────────────────────

    @mcp.tool()
    async def upsert_creative_performance(
        account_id: str,
        campaign_id: str,
        ad_id: str,
        impressions_7d: int,
        clicks_7d: int,
        conversions_7d: float,
        ctr_7d: float,
        ctr_delta: float,
        conv_delta: float,
        headline: str | None = None,
        cpa_7d: float = 0,
    ) -> dict:
        """
        Upsert creative performance data and calculate fatigue score.
        ctr_delta / conv_delta: fractional change (e.g. -0.25 = 25% drop vs previous period).
        Returns: { adId, score (0-100), status (healthy|watch|fatigued|retired) }
        Fatigue score: CTR drop >20% (+40), conv drop >30% (+40), high impressions (+10-20)
        """
        return await api_post("/api/lifecycle/creative", {
            "accountId": account_id,
            "campaignId": campaign_id,
            "adId": ad_id,
            "headline": headline,
            "impressions7d": impressions_7d,
            "clicks7d": clicks_7d,
            "conversions7d": conversions_7d,
            "ctr7d": ctr_7d,
            "cpa7d": cpa_7d,
            "ctrDelta": ctr_delta,
            "convDelta": conv_delta,
        })

    @mcp.tool()
    async def get_fatigued_creatives(account_id: str, min_score: int = 60) -> dict:
        """
        Get creatives with fatigue score >= min_score (default 60).
        Returns list sorted by fatigue_score DESC.
        Use min_score=80 to get only retired-status creatives.
        """
        return await api_get(
            f"/api/lifecycle/creative/{account_id}",
            params={"min_score": str(min_score)},
        )

    # ─── Auto-Pause Rules ─────────────────────────────────────────────────────

    @mcp.tool()
    async def evaluate_pause_rules(
        account_id: str,
        risk_score: float = 0,
        spend_pct: float = 0,
        conv_drop_pct: float = 0,
        fatigue_score: float = 0,
    ) -> dict:
        """
        Evaluate all enabled auto-pause rules against current account metrics.
        Returns: { actions: [{ rule, action, triggerValue }], triggered: N }
        Built-in rules:
          critical_risk_pause: risk_score >= 80 → pause
          high_risk_reduce:    risk_score >= 60 → reduce_budget 50%
          overspend_alert:     spend_pct >= 110 → alert
          conv_drop_alert:     conv_drop_pct >= 30 → alert
          creative_fatigue_warn: fatigue_score >= 70 → alert
        """
        return await api_post("/api/lifecycle/evaluate-rules", {
            "accountId": account_id,
            "metrics": {
                "riskScore": risk_score,
                "spendPct": spend_pct,
                "convDropPct": conv_drop_pct,
                "fatigueScore": fatigue_score,
            },
        })

    @mcp.tool()
    async def get_pause_history(account_id: str) -> dict:
        """Get the last 30 auto-pause events for an account."""
        return await api_get(f"/api/lifecycle/pause-history/{account_id}")
