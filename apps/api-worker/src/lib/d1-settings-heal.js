// ============================================================
// D1 settings heal — migrate stale main DB UUIDs server-side
// ============================================================
// Keeps Worker /api/init + /api/settings aligned with wrangler.toml
// even when Neon still stores pre-migration cfD1DatabaseId.
// ============================================================

import { neonUpsertSettings } from './neon-sync.js';

export const LEGACY_D1_MAIN_DATABASE_IDS = [
  '7d31d941-f863-46f5-99c2-2179de821573',
];

export const PRODUCTION_D1_MAIN_DATABASE_ID = '4eaee76d-10fb-42a7-bb9d-50737c3da785';

function normalizeUuid(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isLegacyMainId(id) {
  const normalized = normalizeUuid(id);
  return Boolean(
    normalized && LEGACY_D1_MAIN_DATABASE_IDS.some((legacyId) => normalizeUuid(legacyId) === normalized)
  );
}

/** @returns {{ d1DatabaseId: string, cfD1DatabaseId: string }} */
export function resolveD1DatabaseIds(settings = {}) {
  let d1DatabaseId = normalizeUuid(settings.d1DatabaseId);
  let cfD1DatabaseId = normalizeUuid(settings.cfD1DatabaseId);

  if (isLegacyMainId(d1DatabaseId)) d1DatabaseId = PRODUCTION_D1_MAIN_DATABASE_ID;
  if (isLegacyMainId(cfD1DatabaseId)) cfD1DatabaseId = PRODUCTION_D1_MAIN_DATABASE_ID;

  if (d1DatabaseId && cfD1DatabaseId && d1DatabaseId !== cfD1DatabaseId) {
    cfD1DatabaseId = d1DatabaseId;
  } else if (d1DatabaseId && !cfD1DatabaseId) {
    cfD1DatabaseId = d1DatabaseId;
  } else if (cfD1DatabaseId && !d1DatabaseId) {
    d1DatabaseId = cfD1DatabaseId;
  }

  return { d1DatabaseId, cfD1DatabaseId };
}

/**
 * Mutate settings object in place when D1 IDs are stale.
 * @returns {boolean} true when values changed
 */
export function healD1SettingsInPlace(settingsObj) {
  if (!settingsObj || typeof settingsObj !== 'object') return false;

  const beforeD1 = normalizeUuid(settingsObj.d1DatabaseId);
  const beforeCf = normalizeUuid(settingsObj.cfD1DatabaseId);
  const resolved = resolveD1DatabaseIds(settingsObj);

  if (!resolved.d1DatabaseId && !resolved.cfD1DatabaseId) return false;

  const changed =
    beforeD1 !== resolved.d1DatabaseId ||
    beforeCf !== resolved.cfD1DatabaseId;

  if (resolved.d1DatabaseId) settingsObj.d1DatabaseId = resolved.d1DatabaseId;
  else delete settingsObj.d1DatabaseId;
  if (resolved.cfD1DatabaseId) settingsObj.cfD1DatabaseId = resolved.cfD1DatabaseId;
  else delete settingsObj.cfD1DatabaseId;

  return changed;
}

/** Persist healed D1 IDs to D1 settings table (+ Neon mirror when configured). */
export async function persistD1SettingsHeal(db, neonSql, settingsObj) {
  const patch = {
    d1DatabaseId: settingsObj.d1DatabaseId,
    cfD1DatabaseId: settingsObj.cfD1DatabaseId,
  };
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === '') continue;
    await db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `).bind(key, String(value), String(value)).run();
  }
  if (neonSql) {
    await neonUpsertSettings(neonSql, patch).catch(() => {});
  }
}
