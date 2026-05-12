// apps/api-worker/src/analysis/routes.js

import { Q } from './queries.js';

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
    const pixelDb = env.PIXEL_DB;
    if (!pixelDb) return json({ ok: false, error: 'PIXEL_DB binding not configured' }, 500);
    const { results } = await pixelDb.prepare(Q.PIXEL_EVENTS_SUMMARY)
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

  // POST /api/analysis/risk-score
  if (path === '/api/analysis/risk-score' && method === 'POST') {
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
    const { results } = await db.prepare(`
      SELECT k1.*
      FROM agent_kpis k1
      INNER JOIN (
        SELECT agent_name, kpi_name, MAX(recorded_at) as latest
        FROM agent_kpis
        ${agent ? "WHERE agent_name = ?" : ""}
        GROUP BY agent_name, kpi_name
      ) k2 ON k1.agent_name = k2.agent_name
           AND k1.kpi_name = k2.kpi_name
           AND k1.recorded_at = k2.latest
      ORDER BY k1.agent_name, k1.kpi_name
      LIMIT ?
    `).bind(...(agent ? [agent, limit] : [limit])).all();
    return json({ ok: true, data: results });
  }

  // POST /api/analysis/agent-kpi
  if (path === '/api/analysis/agent-kpi' && method === 'POST') {
    const body = await request.json();
    const { agent_name, kpi_name, kpi_value, kpi_target, kpi_unit } = body;
    if (!agent_name || !kpi_name) return json({ ok: false, error: 'agent_name and kpi_name required' }, 400);
    await db.prepare(Q.WRITE_AGENT_KPI)
      .bind(uid(), agent_name, kpi_name, kpi_value ?? 0,
            kpi_target ?? 0, kpi_unit ?? '')
      .run();
    return json({ ok: true });
  }

  return null; // not handled
}
