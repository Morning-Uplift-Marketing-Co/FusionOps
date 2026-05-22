// ============================================================
// Neon automation handler for FusionOps API Worker
// ============================================================
// Routes:
//   GET  /api/automation/neon/test   verify NEON_DATABASE_URL connectivity
//   POST /api/automation/neon/sync   backfill settings/sites/deploys from D1
// ============================================================

import { json } from '../../lib/http.js';
import { getNeonSql, syncD1ToNeon } from '../../lib/neon-sync.js';

async function handleNeonTest(env) {
  const neonSql = getNeonSql(env);
  if (!neonSql) {
    return json({ success: false, error: 'NEON_DATABASE_URL is not configured' }, 400);
  }

  try {
    const result = await neonSql`SELECT 1 as ok`;
    return json({
      success: result?.[0]?.ok === 1,
      message: 'Neon connection successful',
    });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}

async function handleNeonSync(env) {
  const neonSql = getNeonSql(env);
  if (!neonSql) {
    return json({ success: false, error: 'NEON_DATABASE_URL is not configured' }, 400);
  }

  try {
    const counts = await syncD1ToNeon(env.DB, neonSql);
    return json({
      success: true,
      synced: counts,
    });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}

export async function handleNeonAutomationRoute({ env, path, method }) {
  if (path === '/api/automation/neon/test' && method === 'GET') {
    return handleNeonTest(env);
  }

  if (path === '/api/automation/neon/sync' && method === 'POST') {
    return handleNeonSync(env);
  }

  return null;
}
