// ============================================================
// D1 automation handler for FusionOps API Worker
// ============================================================
// Routes (POST unless noted):
//   /api/automation/d1/query         remote D1 query via CF API (caller's accountId+databaseId+apiToken)
//   /api/automation/d1/execute       remote D1 mutation via CF API
//   GET /api/automation/d1/test      env.DB binding sanity check (no token, list tables)
//   /api/automation/d1/direct-query  read-only SELECT/WITH against env.DB (defense-in-depth gated)
//
// Note: /direct-query enforces isReadOnlyD1DirectSql to block writes
// even if the outer Bearer auth is compromised.
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json } from '../../lib/http.js';
import { isReadOnlyD1DirectSql } from '../../lib/auth.js';

const CF_D1_BASE = 'https://api.cloudflare.com/client/v4';

async function handleD1Query(body) {
  const { sql, params = [], accountId, databaseId, apiToken } = body;

  if (!sql) return json({ success: false, error: 'Missing SQL query' }, 400);
  if (!accountId) return json({ success: false, error: 'Missing accountId' }, 400);
  if (!databaseId) return json({ success: false, error: 'Missing databaseId' }, 400);
  if (!apiToken) return json({ success: false, error: 'Missing apiToken (send from request body)' }, 400);

  try {
    const url = `${CF_D1_BASE}/accounts/${accountId}/d1/database/${databaseId}/query`;

    console.log('[D1 Query]', {
      url: url.replace(accountId, '***').replace(databaseId, '***'),
      sql: sql.substring(0, 50) + (sql.length > 50 ? '...' : ''),
      hasToken: !!apiToken,
      tokenPrefix: apiToken ? apiToken.substring(0, 10) + '...' : 'none',
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    const responseText = await res.text();

    if (!res.ok) {
      let errData = {};
      try {
        errData = JSON.parse(responseText);
      } catch { /* response was not JSON */ }

      const errorMessage = errData.errors?.[0]?.message || errData.errors?.[0]?.code || responseText || `HTTP ${res.status}`;

      console.error('[D1 Error]', {
        status: res.status,
        error: errorMessage,
        details: errData.errors?.[0] || {},
      });

      return json({
        success: false,
        error: errorMessage,
        code: errData.errors?.[0]?.code,
        details: errData.errors?.[0] || {},
        httpStatus: res.status,
      }, res.status);
    }

    const data = JSON.parse(responseText);
    return json({
      success: true,
      results: data.result?.[0]?.results || [],
    });
  } catch (e) {
    console.error('[D1 Exception]', e.message, e.stack);
    return json({ success: false, error: e.message, stack: e.stack }, 500);
  }
}

async function handleD1Execute(body) {
  const { sql, params = [], accountId, databaseId, apiToken } = body;

  if (!sql) return json({ success: false, error: 'Missing SQL command' }, 400);
  if (!accountId) return json({ success: false, error: 'Missing accountId' }, 400);
  if (!databaseId) return json({ success: false, error: 'Missing databaseId' }, 400);
  if (!apiToken) return json({ success: false, error: 'Missing apiToken (send from request body)' }, 400);

  try {
    const url = `${CF_D1_BASE}/accounts/${accountId}/d1/database/${databaseId}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return json({
        success: false,
        error: errData.errors?.[0]?.message || `HTTP ${res.status}`,
      }, res.status);
    }

    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: e.message }, 500);
  }
}

async function handleD1Test(env) {
  try {
    const { results } = await env.DB
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all();

    return json({
      success: true,
      tables: results.map(r => r.name),
      message: 'D1 connection successful',
    });
  } catch (e) {
    return json({
      success: false,
      error: e.message,
    }, 500);
  }
}

async function handleD1DirectQuery(env, body) {
  try {
    const { sql, params = [] } = body;

    if (!sql) return json({ success: false, error: 'Missing SQL query' }, 400);
    if (!isReadOnlyD1DirectSql(sql)) {
      return json(
        {
          success: false,
          error:
            'This endpoint is read-only (SELECT/WITH on the Worker D1 binding). For CREATE/INSERT/UPDATE use Settings D1 credentials: POST /api/automation/d1/execute from the app (FusionOps d1.js).',
          code: 'D1_DIRECT_READ_ONLY',
        },
        400,
      );
    }

    const stmt = env.DB.prepare(sql);
    let result;
    if (params && params.length > 0) {
      result = await stmt.bind(...params).all();
    } else {
      result = await stmt.all();
    }

    return json({
      success: true,
      results: result.results || [],
    });
  } catch (e) {
    return json({
      success: false,
      error: e.message,
    }, 500);
  }
}

/**
 * Route entry. Returns Response if path matches `/api/automation/d1/*`; null otherwise.
 */
export async function handleD1AutomationRoute({ request, env, path, method }) {
  if (path === '/api/automation/d1/query' && method === 'POST') {
    const body = await request.json();
    return handleD1Query(body);
  }
  if (path === '/api/automation/d1/execute' && method === 'POST') {
    const body = await request.json();
    return handleD1Execute(body);
  }
  if (path === '/api/automation/d1/test' && method === 'GET') {
    return handleD1Test(env);
  }
  if (path === '/api/automation/d1/direct-query' && method === 'POST') {
    const body = await request.json();
    return handleD1DirectQuery(env, body);
  }
  return null;
}
