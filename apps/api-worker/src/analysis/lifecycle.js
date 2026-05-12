/**
 * lifecycle.js — Phase 2 Lifecycle Engine
 * State machine, creative fatigue, spend intelligence, auto-pause
 */

// ─── State Machine ────────────────────────────────────────────────────────────

const VALID_TRANSITIONS = {
  new:       ['warming', 'retired'],
  warming:   ['active', 'suspended', 'retired'],
  active:    ['resting', 'suspended', 'retired'],
  resting:   ['active', 'retired'],
  suspended: ['active', 'retired'],
  retired:   [],
};

export async function transitionAccount(db, accountId, toState, reason, triggeredBy = 'system', riskScore = null) {
  const account = await db.prepare(
    'SELECT lifecycle_state, label FROM ops_accounts WHERE id = ?'
  ).bind(accountId).first();

  if (!account) throw new Error(`Account ${accountId} not found`);

  const fromState = account.lifecycle_state || 'new';
  const allowed = VALID_TRANSITIONS[fromState] || [];

  if (!allowed.includes(toState)) {
    throw new Error(`Invalid transition: ${fromState} → ${toState}`);
  }

  const now = Math.floor(Date.now() / 1000);

  await db.batch([
    db.prepare(`
      UPDATE ops_accounts
      SET lifecycle_state = ?, lifecycle_updated_at = ?
      WHERE id = ?
    `).bind(toState, now, accountId),

    db.prepare(`
      INSERT INTO lifecycle_transitions (account_id, from_state, to_state, reason, triggered_by, risk_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(accountId, fromState, toState, reason, triggeredBy, riskScore),
  ]);

  return { accountId, fromState, toState, reason };
}

// ─── Spend Intelligence ───────────────────────────────────────────────────────

export async function recordSpendSnapshot(db, accountId, data) {
  const { spend, budget, conversions, cpa, roas, riskScore } = data;
  const date = new Date().toISOString().split('T')[0];
  const utilization = budget > 0 ? Math.round((spend / budget) * 100) : 0;

  await db.prepare(`
    INSERT INTO spend_snapshots
      (account_id, snapshot_date, actual_spend, budget_cap, utilization_pct, conversions, cpa, roas, risk_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, snapshot_date) DO UPDATE SET
      actual_spend = excluded.actual_spend,
      utilization_pct = excluded.utilization_pct,
      conversions = excluded.conversions,
      cpa = excluded.cpa,
      roas = excluded.roas,
      risk_score = excluded.risk_score
  `).bind(accountId, date, spend, budget, utilization, conversions, cpa ?? null, roas ?? null, riskScore ?? 0).run();

  return { date, utilization };
}

export async function recommendBudgetAdjustment(db, accountId) {
  // Get last 7 days snapshots
  const rows = await db.prepare(`
    SELECT actual_spend, budget_cap, utilization_pct, conversions, risk_score, snapshot_date
    FROM spend_snapshots
    WHERE account_id = ?
    ORDER BY snapshot_date DESC
    LIMIT 7
  `).bind(accountId).all();

  if (!rows.results || rows.results.length < 3) return null;

  const snapshots = rows.results;
  const avgUtil = snapshots.reduce((s, r) => s + r.utilization_pct, 0) / snapshots.length;
  const latestRisk = snapshots[0].risk_score;
  const currentBudget = snapshots[0].budget_cap;

  let recommendedCap = currentBudget;
  let signal = null;
  let reason = null;

  if (latestRisk >= 70) {
    recommendedCap = currentBudget * 0.5;
    signal = 'risk_high';
    reason = `Risk score ${latestRisk} — reduce exposure`;
  } else if (avgUtil > 110) {
    recommendedCap = currentBudget * 0.9;
    signal = 'overspend';
    reason = `Avg utilization ${Math.round(avgUtil)}% — trim budget`;
  } else if (avgUtil < 60 && latestRisk < 30) {
    recommendedCap = currentBudget * 1.15;
    signal = 'underutilized';
    reason = `Avg utilization ${Math.round(avgUtil)}% with low risk — scale up`;
  }

  if (!signal) return null;

  const deltaPct = Math.round(((recommendedCap - currentBudget) / currentBudget) * 100);

  await db.prepare(`
    INSERT INTO budget_adjustments (account_id, recommended_cap, current_cap, delta_pct, reason, signal)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(accountId, recommendedCap, currentBudget, deltaPct, reason, signal).run();

  return { accountId, currentBudget, recommendedCap, deltaPct, signal, reason };
}

// ─── Creative Fatigue ─────────────────────────────────────────────────────────

export function calcFatigueScore(ctrDelta, convDelta, impressions7d) {
  // Score 0-100: higher = more fatigued
  let score = 0;
  if (ctrDelta < -0.20) score += 40;       // CTR dropped >20%
  else if (ctrDelta < -0.10) score += 20;
  if (convDelta < -0.30) score += 40;      // Conv dropped >30%
  else if (convDelta < -0.15) score += 20;
  if (impressions7d > 50000) score += 10;  // High exposure
  if (impressions7d > 200000) score += 10;
  return Math.min(100, score);
}

export function fatigueStatus(score) {
  if (score >= 80) return 'retired';
  if (score >= 60) return 'fatigued';
  if (score >= 40) return 'watch';
  return 'healthy';
}

export async function upsertCreativePerformance(db, accountId, adData) {
  const { campaignId, adId, headline, impressions7d, clicks7d, conversions7d,
          ctr7d, cpa7d, ctrDelta, convDelta } = adData;

  const score = calcFatigueScore(ctrDelta, convDelta, impressions7d);
  const status = fatigueStatus(score);
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(`
    INSERT INTO creative_performance
      (account_id, campaign_id, ad_id, headline, impressions_7d, clicks_7d,
       conversions_7d, ctr_7d, cpa_7d, ctr_delta, conv_delta, fatigue_score,
       fatigue_status, last_updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, ad_id) DO UPDATE SET
      headline = excluded.headline,
      impressions_7d = excluded.impressions_7d,
      clicks_7d = excluded.clicks_7d,
      conversions_7d = excluded.conversions_7d,
      ctr_7d = excluded.ctr_7d,
      cpa_7d = excluded.cpa_7d,
      ctr_delta = excluded.ctr_delta,
      conv_delta = excluded.conv_delta,
      fatigue_score = excluded.fatigue_score,
      fatigue_status = excluded.fatigue_status,
      last_updated_at = excluded.last_updated_at
  `).bind(accountId, campaignId, adId, headline ?? null, impressions7d, clicks7d,
    conversions7d, ctr7d, cpa7d ?? 0, ctrDelta, convDelta, score, status, now).run();

  return { adId, score, status };
}

// ─── Auto-Pause Engine ────────────────────────────────────────────────────────

export async function evaluatePauseRules(db, accountId, metrics) {
  const rules = await db.prepare(
    'SELECT * FROM pause_rules WHERE enabled = 1'
  ).all();

  const actions = [];
  const { riskScore = 0, spendPct = 0, convDropPct = 0, fatigueScore = 0 } = metrics;

  const fieldMap = { risk_score: riskScore, spend_pct: spendPct, conv_drop_pct: convDropPct, fatigue_score: fatigueScore };

  for (const rule of rules.results ?? []) {
    const val = fieldMap[rule.condition_field] ?? 0;
    const threshold = rule.condition_value;
    let triggered = false;

    if (rule.condition_op === 'gte' && val >= threshold) triggered = true;
    if (rule.condition_op === 'gt'  && val >  threshold) triggered = true;
    if (rule.condition_op === 'lte' && val <= threshold) triggered = true;
    if (rule.condition_op === 'lt'  && val <  threshold) triggered = true;

    if (triggered) {
      await db.prepare(`
        INSERT INTO pause_events (account_id, rule_name, action_taken, trigger_value, notes)
        VALUES (?, ?, ?, ?, ?)
      `).bind(accountId, rule.rule_name, rule.action, val,
        `${rule.condition_field} ${rule.condition_op} ${threshold}`).run();

      actions.push({ rule: rule.rule_name, action: rule.action, triggerValue: val });
    }
  }

  return actions;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

export async function handleLifecycleRoutes(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const db = env.DB;

  // GET /api/lifecycle/accounts — list with lifecycle state
  if (path === '/api/lifecycle/accounts' && request.method === 'GET') {
    const rows = await db.prepare(`
      SELECT id, label, lifecycle_state, lifecycle_updated_at,
             warming_day, daily_spend_cap, last_risk_score, consecutive_safe_days
      FROM ops_accounts
      ORDER BY lifecycle_state, label
    `).all();
    return Response.json({ ok: true, accounts: rows.results ?? [] });
  }

  // POST /api/lifecycle/transition — change account state
  if (path === '/api/lifecycle/transition' && request.method === 'POST') {
    const body = await request.json();
    const { accountId, toState, reason, triggeredBy, riskScore } = body;
    if (!accountId || !toState || !reason) {
      return Response.json({ ok: false, error: 'accountId, toState, reason required' }, { status: 400 });
    }
    try {
      const result = await transitionAccount(db, accountId, toState, reason, triggeredBy, riskScore);
      return Response.json({ ok: true, ...result });
    } catch (e) {
      return Response.json({ ok: false, error: e.message }, { status: 400 });
    }
  }

  // GET /api/lifecycle/transitions/:accountId
  if (path.startsWith('/api/lifecycle/transitions/') && request.method === 'GET') {
    const accountId = path.split('/').pop();
    const rows = await db.prepare(`
      SELECT * FROM lifecycle_transitions WHERE account_id = ? ORDER BY created_at DESC LIMIT 50
    `).bind(accountId).all();
    return Response.json({ ok: true, transitions: rows.results ?? [] });
  }

  // POST /api/lifecycle/spend-snapshot
  if (path === '/api/lifecycle/spend-snapshot' && request.method === 'POST') {
    const body = await request.json();
    const result = await recordSpendSnapshot(db, body.accountId, body);
    return Response.json({ ok: true, ...result });
  }

  // GET /api/lifecycle/budget-recommend/:accountId
  if (path.startsWith('/api/lifecycle/budget-recommend/') && request.method === 'GET') {
    const accountId = path.split('/').pop();
    const rec = await recommendBudgetAdjustment(db, accountId);
    return Response.json({ ok: true, recommendation: rec });
  }

  // POST /api/lifecycle/creative
  if (path === '/api/lifecycle/creative' && request.method === 'POST') {
    const body = await request.json();
    const result = await upsertCreativePerformance(db, body.accountId, body);
    return Response.json({ ok: true, ...result });
  }

  // GET /api/lifecycle/creative/:accountId — fatigued ads
  if (path.startsWith('/api/lifecycle/creative/') && request.method === 'GET') {
    const accountId = path.split('/').pop();
    const minScore = parseInt(url.searchParams.get('min_score') ?? '0');
    const rows = await db.prepare(`
      SELECT * FROM creative_performance
      WHERE account_id = ? AND fatigue_score >= ?
      ORDER BY fatigue_score DESC
    `).bind(accountId, minScore).all();
    return Response.json({ ok: true, creatives: rows.results ?? [] });
  }

  // POST /api/lifecycle/evaluate-rules
  if (path === '/api/lifecycle/evaluate-rules' && request.method === 'POST') {
    const body = await request.json();
    const actions = await evaluatePauseRules(db, body.accountId, body.metrics ?? {});
    return Response.json({ ok: true, actions, triggered: actions.length });
  }

  // GET /api/lifecycle/pause-history/:accountId
  if (path.startsWith('/api/lifecycle/pause-history/') && request.method === 'GET') {
    const accountId = path.split('/').pop();
    const rows = await db.prepare(`
      SELECT * FROM pause_events WHERE account_id = ? ORDER BY created_at DESC LIMIT 30
    `).bind(accountId).all();
    return Response.json({ ok: true, events: rows.results ?? [] });
  }

  return null;
}
