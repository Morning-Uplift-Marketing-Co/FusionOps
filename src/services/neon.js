/**
 * Neon Serverless Postgres — Data Access Layer
 * Uses @neondatabase/serverless HTTP driver (works in browsers).
 *
 * Tables:
 *   settings  (key TEXT PK, value JSONB, updated_at)
 *   sites     (id TEXT PK, data JSONB, created_at, updated_at)
 *   deploy_history (id TEXT PK, site_id TEXT FK, target, url, status, brand, created_at)
 */

import { neon } from "@neondatabase/serverless";

let sql = null;
let connectionString = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 3;
let reconnectDelay = 1000; // 1 second

/**
 * Ensure all required tables exist in the database.
 */
export async function ensureTables() {
  if (!sql) return false;
  try {
    // Settings table
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    // Sites table
    await sql`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        data JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    // Deploy History table
    await sql`
      CREATE TABLE IF NOT EXISTS deploy_history (
        id TEXT PRIMARY KEY,
        site_id TEXT,
        target TEXT,
        url TEXT,
        status TEXT,
        brand TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    // DAILY SPEND & ROI table
    await sql`
      CREATE TABLE IF NOT EXISTS daily_spend (
        id TEXT PRIMARY KEY,
        date DATE,
        account_id TEXT,
        campaign_id TEXT,
        google_spend DECIMAL(12,4),
        vat DECIMAL(12,4),
        lendingcard_fee DECIMAL(12,4),
        true_cost DECIMAL(12,4),
        revenue DECIMAL(12,4),
        conversions INTEGER,
        clicks INTEGER,
        true_roi DECIMAL(12,4),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    // LENDINGCARD TRANSACTIONS table
    await sql`
      CREATE TABLE IF NOT EXISTS lendingcard_transactions (
        id TEXT PRIMARY KEY,
        date DATE,
        amount DECIMAL(12,4),
        deposit_fee DECIMAL(12,4),
        net_amount DECIMAL(12,4),
        card_id TEXT,
        card_last4 TEXT,
        merchant TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    return true;
  } catch (e) {
    console.error("[neon] ensureTables failed:", e.message);
    return false;
  }
}

/**
 * Initialize the Neon connection. Call once on app start.
 */
export function initNeon(connStr) {
  if (!connStr) return false;
  connectionString = connStr;
  try {
    sql = neon(connStr);
    reconnectAttempts = 0;
    // Attempt table initialization in the background
    ensureTables().catch(() => { });
    return true;
  } catch (e) {
    console.warn("[neon] Init failed:", e.message);
    sql = null;
    return false;
  }
}

/**
 * Ensure connection is alive, reconnect if needed with retry logic
 * @internal
 */
function ensureConnection() {
  if (!sql && connectionString && reconnectAttempts < maxReconnectAttempts) {
    try {
      sql = neon(connectionString);
      reconnectAttempts++;
      sql`SELECT 1 as ok`.catch(() => {
        sql = null;
      });
    } catch (e) {
      reconnectAttempts++;
      if (reconnectAttempts >= maxReconnectAttempts) {
        setTimeout(() => {
          reconnectAttempts = 0;
        }, reconnectDelay * 3);
      }
    }
  }
  return sql !== null;
}

/** Check if Neon is connected
 * @internal - used only within this module
 */
function isNeonReady() {
  return ensureConnection();
}

/** Test connectivity */
export async function ping() {
  if (!ensureConnection()) return false;
  try {
    const rows = await sql`SELECT 1 as ok`;
    return rows?.[0]?.ok === 1;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════

/** Load all settings as a flat object */
export async function loadSettings() {
  if (!ensureConnection()) return null;
  try {
    const rows = await sql`SELECT key, value FROM settings`;
    const result = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  } catch (e) {
    return null;
  }
}

/** Save one or more settings (upsert) */
export async function saveSettings(obj) {
  // Always save to localStorage as fallback
  try {
    const existing = JSON.parse(localStorage.getItem("lpf2-settings") || "{}");
    const merged = { ...existing, ...obj };
    localStorage.setItem("lpf2-settings", JSON.stringify(merged));
  } catch (e) {
    // localStorage error - ignore
  }

  if (!ensureConnection()) return false;
  try {
    for (const [key, value] of Object.entries(obj)) {
      await sql`
        INSERT INTO settings (key, value, updated_at)
        VALUES (${key}, ${JSON.stringify(value)}, now())
        ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value)}, updated_at = now()
      `;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// SITES
// ═══════════════════════════════════════════════════════

/** Load all sites */
export async function loadSites() {
  if (!ensureConnection()) return null;
  try {
    const rows = await sql`SELECT id, data, created_at FROM sites ORDER BY created_at DESC`;
    return rows.map(r => ({ ...r.data, id: r.id, _createdAt: r.created_at }));
  } catch (e) {
    return null;
  }
}

/** Upsert a site */
export async function saveSite(site) {
  if (!ensureConnection()) return false;
  try {
    const { id: rawId, ...data } = site;
    const id = rawId || `site-${Date.now().toString(36)}`;
    console.log("[neon] saveSite id:", id, "type:", typeof id);
    console.log("[neon] saveSite called with templateId:", data.templateId);

    const safeData = JSON.parse(JSON.stringify(data, (_, v) =>
      typeof v === "function" || (v instanceof Node) || v === window ? undefined : v
    ));
    await sql`
      INSERT INTO sites (id, data, created_at, updated_at)
      VALUES (${id}, ${JSON.stringify(safeData)}, now(), now())
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = now()
    `;
    console.log("[neon] saveSite success - templateId saved as:", data.templateId);
    return true;
  } catch (e) {
    console.error("[neon] saveSite error:", e);
    // Try reconnecting on failure
    sql = null;
    return false;
  }
}

/** Delete a site */
export async function deleteSite(id) {
  if (!ensureConnection()) return false;
  try {
    await sql`DELETE FROM sites WHERE id = ${id}`;
    return true;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// DEPLOY HISTORY
// ═══════════════════════════════════════════════════════

/** Load recent deploys (last 100) */
export async function loadDeploys() {
  if (!ensureConnection()) return null;
  try {
    const rows = await sql`
      SELECT id, site_id, target, url, status, brand, created_at
      FROM deploy_history ORDER BY created_at DESC LIMIT 100
    `;
    return rows.map(r => ({
      id: r.id,
      siteId: r.site_id,
      target: r.target,
      url: r.url,
      status: r.status,
      brand: r.brand,
      ts: r.created_at,
    }));
  } catch (e) {
    return null;
  }
}

/** Save a deploy record */
export async function saveDeploy(deploy) {
  if (!ensureConnection()) return false;
  try {
    await sql`
      INSERT INTO deploy_history (id, site_id, target, url, status, brand, created_at)
      VALUES (${deploy.id}, ${deploy.siteId}, ${deploy.target || "netlify"}, ${deploy.url || ""}, ${deploy.status || "success"}, ${deploy.brand || ""}, ${deploy.ts || new Date().toISOString()})
      ON CONFLICT (id) DO NOTHING
    `;
    return true;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// DAILY SPEND & ROI (Module 8)
// ═══════════════════════════════════════════════════════

/** Load spend records by date range */
export async function loadDailySpend(startDate, endDate) {
  if (!ensureConnection()) return null;
  try {
    const rows = await sql`
      SELECT id, date, account_id, campaign_id, google_spend, vat, lendingcard_fee, true_cost, revenue, conversions, clicks, true_roi, created_at
      FROM daily_spend
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY date DESC
    `;
    return rows;
  } catch (e) {
    console.error("[neon] loadDailySpend error:", e);
    return null;
  }
}

/** Save daily spend record */
export async function saveDailySpend(spend) {
  if (!ensureConnection()) return false;
  try {
    const id = spend.id || `${spend.date}-${spend.account_id}`;
    await sql`
      INSERT INTO daily_spend (
        id, date, account_id, campaign_id, google_spend, vat, lendingcard_fee, true_cost, revenue, conversions, clicks, true_roi
      ) VALUES (
        ${id}, ${spend.date}, ${spend.account_id}, ${spend.campaign_id || null}, 
        ${spend.google_spend || 0}, ${spend.vat || 0}, ${spend.lendingcard_fee || 0}, 
        ${spend.true_cost || 0}, ${spend.revenue || 0}, ${spend.conversions || 0}, 
        ${spend.clicks || 0}, ${spend.true_roi || 0}
      )
      ON CONFLICT (id) DO UPDATE SET
        google_spend = EXCLUDED.google_spend,
        vat = EXCLUDED.vat,
        lendingcard_fee = EXCLUDED.lendingcard_fee,
        true_cost = EXCLUDED.true_cost,
        revenue = EXCLUDED.revenue,
        conversions = EXCLUDED.conversions,
        clicks = EXCLUDED.clicks,
        true_roi = EXCLUDED.true_roi,
        updated_at = now()
    `;
    return true;
  } catch (e) {
    console.error("[neon] saveDailySpend error:", e);
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// LENDINGCARD TRANSACTIONS (Module 8)
// ═══════════════════════════════════════════════════════

/** Load lendingcard transactions within a date range */
export async function loadLendingCardTransactions(startDate, endDate) {
  if (!ensureConnection()) return null;
  try {
    const rows = await sql`
      SELECT id, date, amount, deposit_fee, net_amount, card_id, card_last4, merchant, created_at
      FROM lendingcard_transactions
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY date DESC
    `;
    return rows;
  } catch (e) {
    console.error("[neon] loadLendingCardTransactions error:", e);
    return null;
  }
}

/** Save multiple transactions in bulk from API */
export async function saveLendingCardTransactions(transactions) {
  if (!ensureConnection() || !transactions || transactions.length === 0) return false;
  try {
    for (const tx of transactions) {
      await sql`
        INSERT INTO lendingcard_transactions (
          id, date, amount, deposit_fee, net_amount, card_id, card_last4, merchant
        ) VALUES (
          ${tx.id}, ${tx.date}, ${tx.amount}, ${tx.deposit_fee || 0}, ${tx.net_amount}, 
          ${tx.card_id}, ${tx.card_last4}, ${tx.merchant}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }
    return true;
  } catch (e) {
    console.error("[neon] saveLendingCardTransactions error:", e);
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// BULK SYNC (localStorage -> Neon)
// ═══════════════════════════════════════════════════════

/**
 * One-time sync: push localStorage data into Neon.
 * Called on first connection when Neon tables are empty.
 */
export async function syncFromLocal(localSettings, localSites, localDeploys) {
  if (!ensureConnection()) return;
  try {
    if (localSettings && Object.keys(localSettings).length > 0) {
      await saveSettings(localSettings);
    }
    if (localSites?.length > 0) {
      for (const site of localSites) {
        await saveSite(site);
      }
    }
    if (localDeploys?.length > 0) {
      for (const d of localDeploys) {
        await saveDeploy(d);
      }
    }
  } catch (e) {
    // sync error - ignore
  }
}

// ═══════════════════════════════════════════════════════
// CONNECTION RECOVERY
// ═══════════════════════════════════════════════════════

/**
 * Force reconnection attempt - useful after page refresh or visibility change
 */
export function forceReconnect() {
  if (connectionString) {
    sql = null;
    reconnectAttempts = 0;
    return ensureConnection();
  }
  return false;
}

/**
 * Handle page visibility changes to reconnect when page becomes visible again
 */
export function setupVisibilityHandler() {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && !sql && connectionString) {
      setTimeout(() => forceReconnect(), reconnectDelay);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

/**
 * Get connection status for debugging
 */
export function getConnectionStatus() {
  return {
    connected: sql !== null,
    connectionString: !!connectionString,
    reconnectAttempts,
    maxReconnectAttempts
  };
}
