// apps/api-worker/src/analysis/routes.js

import { Q } from './queries.js';
import { denyUnlessTrustedOrBearer } from '../lib/auth.js';

function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function handleAnalysisRoutes(path, method, request, env) {
  const url = new URL(request.url);
  const db = env.DB;

  // GET /api/analysis/accounts
  if (path === '/api/analysis/accounts' && method === 'GET') {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || null;
    const { results } = await db.prepare(Q.ACCOUNTS_WITH_LINKS)
      .bind(status)
      .all();
    return json({ ok: true, data: results });
  }

  // GET /api/analysis/proxy-pool
  if (path === '/api/analysis/proxy-pool' && method === 'GET') {
    const url = new URL(request.url);
    const minTrust = url.searchParams.get('min_trust')
      ? parseInt(url.searchParams.get('min_trust'), 10)
      : null;
    const { results } = await db.prepare(Q.PROXY_POOL)
      .bind(minTrust)
      .all();
    return json({ ok: true, data: results });
  }

  // GET /api/analysis/pixel-events/:domain
  if (path.startsWith('/api/analysis/pixel-events/') && method === 'GET') {
    const domain = decodeURIComponent(path.split('/api/analysis/pixel-events/')[1]);
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    const daysBack = `-${days} days`;
    // pixel-tracking.js writes to env.DB (main), not PIXEL_DB — read from same source.
    const { results } = await db.prepare(Q.PIXEL_EVENTS_SUMMARY)
      .bind(domain, daysBack)
      .all();
    return json({ ok: true, domain, days, data: results });
  }

  // GET /api/analysis/link-audit/:account_id
  if (path.startsWith('/api/analysis/link-audit/') && method === 'GET') {
    const accountId = path.split('/api/analysis/link-audit/')[1];
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    const daysBack = `-${days} days`;
    const { results } = await db.prepare(Q.LINK_AUDIT)
      .bind(accountId, daysBack)
      .all();
    return json({ ok: true, account_id: accountId, data: results });
  }

  // GET /api/analysis/ban-events
  if (path === '/api/analysis/ban-events' && method === 'GET') {
    const url = new URL(request.url);
    const days = url.searchParams.get('days')
      ? parseInt(url.searchParams.get('days'), 10)
      : null;
    const daysBack = days ? `-${days} days` : null;
    const { results } = await db.prepare(Q.BAN_EVENTS)
      .bind(days, daysBack)
      .all();
    return json({ ok: true, data: results });
  }

  // POST /api/analysis/ban-events  — log a new ban
  if (path === '/api/analysis/ban-events' && method === 'POST') {
    const authError = denyUnlessTrustedOrBearer(request, url, env);
    if (authError) return authError;

    const body = await request.json();
    const { account_id, domain, ban_reason, ban_date,
            days_active, risk_score_at_ban, notes } = body;
    if (!account_id) return json({ ok: false, error: 'account_id required' }, 400);
    if (!ban_reason) return json({ ok: false, error: 'ban_reason required' }, 400);
    const date = ban_date || new Date().toISOString().slice(0, 10);
    await db.prepare(Q.WRITE_BAN_EVENT)
      .bind(
        uid(), account_id, domain || '', ban_reason, date,
        days_active ?? null, risk_score_at_ban ?? null, notes || ''
      )
      .run();
    return json({ ok: true });
  }

  // GET /api/analysis/spend-history/:account_id
  if (path.startsWith('/api/analysis/spend-history/') && method === 'GET') {
    const accountId = path.split('/api/analysis/spend-history/')[1];
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '90', 10);
    try {
      const { results } = await db.prepare(Q.GET_SPEND_HISTORY)
        .bind(accountId, limit)
        .all();
      return json({ ok: true, account_id: accountId, data: results });
    } catch {
      return json({ ok: true, account_id: accountId, data: [] });
    }
  }

  // POST /api/analysis/risk-score (FBIS MCP writes risk verdicts)
  if (path === '/api/analysis/risk-score' && method === 'POST') {
    // Require Bearer token authentication (FBIS_API_KEY / API_SECRET)
    const authError = denyUnlessTrustedOrBearer(request, url, env);
    if (authError) return authError;

    const body = await request.json();
    const { account_id, proxy_risk, isolation_score, traffic_quality,
            timeline_risk, verdict_score, verdict_status } = body;
    if (!account_id) return json({ ok: false, error: 'account_id required' }, 400);
    await db.prepare(Q.WRITE_RISK_SCORE)
      .bind(uid(), account_id, proxy_risk ?? 0, isolation_score ?? 0,
            traffic_quality ?? 0, timeline_risk ?? 0,
            verdict_score ?? 0, verdict_status ?? 'healthy')
      .run();
    return json({ ok: true });
  }

  // GET /api/analysis/agent-kpis — latest KPI per agent per metric
  if (path === '/api/analysis/agent-kpis' && method === 'GET') {
    const url = new URL(request.url);
    const agent = url.searchParams.get('agent') || null;
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const { results } = await db.prepare(Q.LATEST_AGENT_KPIS)
      .bind(agent, limit)
      .all();
    return json({ ok: true, data: results });
  }

  // POST /api/analysis/agent-kpi (Hermes agents report KPIs)
  if (path === '/api/analysis/agent-kpi' && method === 'POST') {
    // Require Bearer token authentication (FBIS_API_KEY / API_SECRET)
    const authError = denyUnlessTrustedOrBearer(request, url, env);
    if (authError) return authError;

    const body = await request.json();
    const { agent_name, kpi_name, kpi_value, kpi_target, kpi_unit } = body;
    if (!agent_name || !kpi_name) return json({ ok: false, error: 'agent_name and kpi_name required' }, 400);
    await db.prepare(Q.WRITE_AGENT_KPI)
      .bind(uid(), agent_name, kpi_name, kpi_value ?? 0,
            kpi_target ?? 0, kpi_unit ?? '')
      .run();
    return json({ ok: true });
  }

  // POST /api/analysis/accounts/sync  — from Google Ads Script
  if (path === '/api/analysis/accounts/sync' && method === 'POST') {
    const body = await request.json();
    // Accept single object OR array
    const rows = Array.isArray(body) ? body : [body];
    if (rows.length === 0) return json({ ok: false, error: 'empty payload' }, 400);
    if (rows.length > 200) return json({ ok: false, error: 'max 200 accounts per sync' }, 400);

    let upserted = 0;
    const errors = [];

    for (const row of rows) {
      const { account_id, label, email, status, site_domain, spend_30d,
              spend_24h, daily_budget_total, campaign_count, active_campaign_count } = row;
      if (!account_id) { errors.push('missing account_id'); continue; }

      // Normalise: strip dashes from Google customer ID (123-456-7890 → 1234567890)
      const id = String(account_id).replace(/-/g, '');

      try {
        await db.prepare(Q.UPSERT_ACCOUNT)
          .bind(
            id,
            label   || '',
            email   || '',
            status  || 'active',
            site_domain || '',
            Math.round(spend_30d ?? 0),
          )
          .run();

        // Log spend history (one row per account per day, upsert)
        if (spend_30d != null || spend_24h != null) {
          try {
            await db.prepare(Q.WRITE_SPEND_HISTORY)
              .bind(
                uid(), id,
                spend_24h ?? 0,
                spend_30d ?? 0,
                daily_budget_total ?? 0,
                campaign_count ?? 0,
                active_campaign_count ?? 0,
              )
              .run();
          } catch { /* spend_history table might not exist yet */ }
        }

        upserted++;
      } catch (e) {
        errors.push(`${id}: ${e.message}`);
      }
    }

    return json({ ok: true, upserted, errors });
  }

  return null; // not handled
}
