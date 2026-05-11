import {
  ACCOUNTS_WITH_LINKS,
  PROXY_POOL,
  PIXEL_EVENTS_SUMMARY,
  LINK_AUDIT,
  BAN_EVENTS,
  BAN_EVENTS_BY_ACCOUNT,
  WRITE_RISK_SCORE,
  WRITE_AGENT_KPI,
  LATEST_RISK_SCORES,
  AGENT_KPI_SUMMARY,
} from './queries.js';

function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function now() {
  return new Date().toISOString();
}

export async function handleAnalysisRoutes(request, env, db, pixelDb, json) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // GET /api/analysis/accounts — accounts with site links + risk metadata
  if (path === '/api/analysis/accounts' && method === 'GET') {
    try {
      const { results } = await db.prepare(ACCOUNTS_WITH_LINKS).all();
      return json({ ok: true, data: results });
    } catch (e) {
      return json({ ok: false, error: e.message }, 500);
    }
  }

  // GET /api/analysis/proxy-pool — proxy IP groupings
  if (path === '/api/analysis/proxy-pool' && method === 'GET') {
    try {
      const { results } = await db.prepare(PROXY_POOL).all();
      return json({ ok: true, data: results });
    } catch (e) {
      return json({ ok: false, error: e.message }, 500);
    }
  }

  // GET /api/analysis/pixel-events — pixel event summary from pixel D1
  if (path === '/api/analysis/pixel-events' && method === 'GET') {
    try {
      const targetDb = pixelDb || db;
      const { results } = await targetDb.prepare(PIXEL_EVENTS_SUMMARY).all();
      return json({ ok: true, data: results });
    } catch (e) {
      return json({ ok: false, error: e.message }, 500);
    }
  }

  // GET /api/analysis/link-audit — account↔site link audit trail
  if (path === '/api/analysis/link-audit' && method === 'GET') {
    try {
      const { results } = await db.prepare(LINK_AUDIT).all();
      return json({ ok: true, data: results });
    } catch (e) {
      return json({ ok: false, error: e.message }, 500);
    }
  }

  // GET /api/analysis/ban-events — recent ban events
  if (path === '/api/analysis/ban-events' && method === 'GET') {
    try {
      const accountId = url.searchParams.get('account_id');
      let results;
      if (accountId) {
        ({ results } = await db.prepare(BAN_EVENTS_BY_ACCOUNT).bind(accountId).all());
      } else {
        ({ results } = await db.prepare(BAN_EVENTS).all());
      }
      return json({ ok: true, data: results });
    } catch (e) {
      return json({ ok: false, error: e.message }, 500);
    }
  }

  // POST /api/analysis/ban-events — log a ban event
  if (path === '/api/analysis/ban-events' && method === 'POST') {
    try {
      const body = await request.json();
      const { account_id, ban_type, platform, reason, evidence } = body;
      if (!account_id || !ban_type) {
        return json({ ok: false, error: 'account_id and ban_type required' }, 400);
      }
      const id = uid();
      const ts = now();
      await db
        .prepare(
          'INSERT INTO ban_events (id, account_id, ban_type, platform, reason, evidence, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(id, account_id, ban_type, platform || '', reason || '', evidence || '', ts)
        .run();

      // update lifecycle_stage on account
      await db
        .prepare("UPDATE ops_accounts SET lifecycle_stage = 'banned', ban_reason = ?, banned_at = ? WHERE id = ?")
        .bind(reason || ban_type, ts, account_id)
        .run();

      return json({ ok: true, id });
    } catch (e) {
      return json({ ok: false, error: e.message }, 500);
    }
  }

  // GET /api/analysis/risk-scores — latest computed risk scores
  if (path === '/api/analysis/risk-scores' && method === 'GET') {
    try {
      const { results } = await db.prepare(LATEST_RISK_SCORES).all();
      return json({ ok: true, data: results });
    } catch (e) {
      return json({ ok: false, error: e.message }, 500);
    }
  }

  // POST /api/analysis/risk-scores — upsert risk score from Hermes agent
  if (path === '/api/analysis/risk-scores' && method === 'POST') {
    try {
      const body = await request.json();
      const { account_id, score, flags } = body;
      if (!account_id || score == null) {
        return json({ ok: false, error: 'account_id and score required' }, 400);
      }
      const id = uid();
      await db.prepare(WRITE_RISK_SCORE).bind(id, account_id, score, JSON.stringify(flags || []), now()).run();
      await db
        .prepare('UPDATE ops_accounts SET risk_score = ? WHERE id = ?')
        .bind(score, account_id)
        .run();
      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, error: e.message }, 500);
    }
  }

  // GET /api/analysis/agent-kpis — agent performance summary (last 7 days)
  if (path === '/api/analysis/agent-kpis' && method === 'GET') {
    try {
      const { results } = await db.prepare(AGENT_KPI_SUMMARY).all();
      return json({ ok: true, data: results });
    } catch (e) {
      return json({ ok: false, error: e.message }, 500);
    }
  }

  // POST /api/analysis/agent-kpis — record agent KPI
  if (path === '/api/analysis/agent-kpis' && method === 'POST') {
    try {
      const body = await request.json();
      const { agent_name, metric, value } = body;
      if (!agent_name || !metric || value == null) {
        return json({ ok: false, error: 'agent_name, metric, value required' }, 400);
      }
      const id = uid();
      await db.prepare(WRITE_AGENT_KPI).bind(id, agent_name, metric, value, now()).run();
      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, error: e.message }, 500);
    }
  }

  return null; // not handled — fall through to main router
}
