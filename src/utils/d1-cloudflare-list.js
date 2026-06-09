const DEFAULT_MAIN_D1_NAME = "fusionops-main-new-v2";

function normalizeUuid(value) {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * List all D1 databases in a Cloudflare account (paginated).
 */
export async function listAllCfD1Databases(cfBase, accountId, apiToken) {
  const all = [];
  let page = 1;

  while (page <= 20) {
    const url = `${cfBase}/accounts/${accountId}/d1/database?page=${page}&per_page=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.errors?.[0]?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const batch = Array.isArray(data.result) ? data.result : [];
    all.push(...batch);

    const total = Number(data.result_info?.total_count);
    if (!batch.length || (Number.isFinite(total) && all.length >= total)) break;
    page += 1;
  }

  return all;
}

/**
 * Find a D1 database by UUID (case-insensitive) or by canonical main DB name.
 */
export function matchD1Database(databases, databaseId, preferredName = DEFAULT_MAIN_D1_NAME) {
  const targetId = normalizeUuid(databaseId);
  if (targetId) {
    const byId = databases.find((db) => normalizeUuid(db.uuid || db.id) === targetId);
    if (byId) return byId;
  }

  const targetName = normalizeUuid(preferredName);
  if (targetName) {
    return databases.find((db) => normalizeUuid(db.name) === targetName) || null;
  }

  return null;
}

export { DEFAULT_MAIN_D1_NAME, normalizeUuid };
