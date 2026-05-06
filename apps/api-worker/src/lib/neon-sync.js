// ============================================================
// Neon Postgres mirror for FusionOps API Worker
// ============================================================
// Best-effort sync of settings/sites/deploys to a Neon serverless
// Postgres instance for analytics/reporting. D1 remains primary.
// All functions silently no-op when env.NEON_DATABASE_URL is unset.
//
// Extracted from worker.js (Phase 1: utility extraction).
// ============================================================

import { neon } from '@neondatabase/serverless';

export function getNeonSql(env) {
  const connStr = env?.NEON_DATABASE_URL;
  if (!connStr || typeof connStr !== 'string') return null;
  if (!connStr.includes('@')) return null;
  try {
    return neon(connStr);
  } catch (_e) {
    return null;
  }
}

export async function ensureNeonTables(sql) {
  if (!sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`
      ALTER TABLE settings
      ALTER COLUMN value TYPE JSONB
      USING (
        CASE
          WHEN value IS NULL THEN NULL
          WHEN pg_typeof(value) = 'jsonb'::regtype THEN value
          ELSE to_jsonb(value)
        END
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        data JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS deploys (
        id TEXT PRIMARY KEY,
        site_id TEXT,
        brand TEXT,
        url TEXT,
        type TEXT,
        deployed_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
  } catch (_e) {
    // Best-effort only; D1 remains primary.
  }
}

export async function neonUpsertSettings(sql, obj) {
  if (!sql || !obj) return;
  for (const [key, value] of Object.entries(obj)) {
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${key}, ${JSON.stringify(value)}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  }
}

export async function neonUpsertSite(sql, id, body) {
  if (!sql) return;
  await sql`
    INSERT INTO sites (id, data, created_at, updated_at)
    VALUES (${id}, ${JSON.stringify(body || {})}, now(), now())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
}

export async function neonDeleteSite(sql, id) {
  if (!sql) return;
  await sql`DELETE FROM sites WHERE id = ${id}`;
}

export async function neonUpsertDeploy(sql, id, body) {
  if (!sql) return;
  await sql`
    INSERT INTO deploys (id, site_id, brand, url, type, deployed_by, created_at)
    VALUES (
      ${id}, ${body?.siteId || ''}, ${body?.brand || ''}, ${body?.url || ''}, ${body?.type || 'new'}, ${body?.deployedBy || ''}, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      site_id = EXCLUDED.site_id,
      brand = EXCLUDED.brand,
      url = EXCLUDED.url,
      type = EXCLUDED.type,
      deployed_by = EXCLUDED.deployed_by
  `;
}

export async function neonDeleteDeploy(sql, id) {
  if (!sql) return;
  await sql`DELETE FROM deploys WHERE id = ${id}`;
}
