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
    // Cloudflare Accounts table
    await sql`
      CREATE TABLE IF NOT EXISTS cf_accounts (
        id TEXT PRIMARY KEY,
        email TEXT,
        api_key TEXT,
        api_token TEXT,
        account_id TEXT,
        label TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    // Registrar Accounts table (Internet.bs, etc.)
    await sql`
      CREATE TABLE IF NOT EXISTS registrar_accounts (
        id TEXT PRIMARY KEY,
        provider TEXT,
        label TEXT,
        api_key TEXT,
        secret_key TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
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
    // USERS table (auth)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT DEFAULT '',
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','employee')),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now(),
        last_login_at TIMESTAMPTZ
      )
    `;
    // SESSIONS table (auth)
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        ua TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    // SITE AUDIT LOG (KPI events)
    await sql`
      CREATE TABLE IF NOT EXISTS site_audit_log (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        title TEXT NOT NULL,
        detail TEXT,
        meta JSONB DEFAULT '{}',
        ts TIMESTAMPTZ DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_site ON site_audit_log(site_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_type ON site_audit_log(event_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`;
    // Tasks table
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'medium',
        assignee_id TEXT,
        assignee_name TEXT,
        site_id TEXT,
        tags JSONB DEFAULT '[]',
        due_date TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`;
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
      const v = row.value;
      // Handle both JSONB and legacy TEXT storage.
      if (typeof v === "string") {
        try {
          result[row.key] = JSON.parse(v);
        } catch (_e) {
          result[row.key] = v;
        }
      } else {
        result[row.key] = v;
      }
    }
    return result;
  } catch (e) {
    return null;
  }
}

/** Save one or more settings (upsert) */
export async function saveSettings(obj) {
  if (!ensureConnection()) return false;
  try {
    for (const [key, value] of Object.entries(obj)) {
      const jsonValue = JSON.stringify(value);
      await sql`
        INSERT INTO settings (key, value, updated_at)
        VALUES (${key}, ${jsonValue}, now())
        ON CONFLICT (key) DO UPDATE SET value = ${jsonValue}, updated_at = now()
      `;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// CLOUDFLARE ACCOUNTS (Ops)
// ═══════════════════════════════════════════════════════

/** Load Cloudflare accounts from Neon */
export async function loadCfAccounts() {
  if (!ensureConnection()) return null;
  try {
    const rows = await sql`
      SELECT id, email, api_key, api_token, account_id, label, created_at, updated_at
      FROM cf_accounts
      ORDER BY label ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      email: r.email || "",
      api_key: r.api_key || "",
      api_token: r.api_token || "",
      account_id: r.account_id || "",
      label: r.label || "",
      apiKey: r.api_key || "",
      apiToken: r.api_token || "",
      accountId: r.account_id || "",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (_e) {
    return null;
  }
}

/** Upsert one Cloudflare account in Neon */
export async function saveCfAccount(account) {
  if (!ensureConnection() || !account?.id) return false;
  try {
    await sql`
      INSERT INTO cf_accounts (id, email, api_key, api_token, account_id, label, created_at, updated_at)
      VALUES (
        ${account.id},
        ${account.email || ""},
        ${account.apiKey || account.api_key || ""},
        ${account.apiToken || account.api_token || ""},
        ${account.accountId || account.account_id || ""},
        ${account.label || ""},
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        api_key = EXCLUDED.api_key,
        api_token = EXCLUDED.api_token,
        account_id = EXCLUDED.account_id,
        label = EXCLUDED.label,
        updated_at = now()
    `;
    return true;
  } catch (_e) {
    return false;
  }
}

/** Delete Cloudflare account in Neon */
export async function deleteCfAccount(id) {
  if (!ensureConnection() || !id) return false;
  try {
    await sql`DELETE FROM cf_accounts WHERE id = ${id}`;
    return true;
  } catch (_e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// REGISTRAR ACCOUNTS (Ops)
// ═══════════════════════════════════════════════════════

/** Load registrar accounts from Neon */
export async function loadRegistrarAccounts() {
  if (!ensureConnection()) return null;
  try {
    const rows = await sql`
      SELECT id, provider, label, api_key, secret_key, created_at, updated_at
      FROM registrar_accounts
      ORDER BY provider ASC, label ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider || "internetbs",
      label: r.label || "",
      api_key: r.api_key || "",
      secret_key: r.secret_key || "",
      apiKey: r.api_key || "",
      secretKey: r.secret_key || "",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (_e) {
    return null;
  }
}

/** Upsert one registrar account in Neon */
export async function saveRegistrarAccount(account) {
  if (!ensureConnection() || !account?.id) return false;
  try {
    await sql`
      INSERT INTO registrar_accounts (id, provider, label, api_key, secret_key, created_at, updated_at)
      VALUES (
        ${account.id},
        ${account.provider || "internetbs"},
        ${account.label || ""},
        ${account.apiKey || account.api_key || ""},
        ${account.secretKey || account.secret_key || ""},
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        provider = EXCLUDED.provider,
        label = EXCLUDED.label,
        api_key = EXCLUDED.api_key,
        secret_key = EXCLUDED.secret_key,
        updated_at = now()
    `;
    return true;
  } catch (_e) {
    return false;
  }
}

/** Delete registrar account in Neon */
export async function deleteRegistrarAccount(id) {
  if (!ensureConnection() || !id) return false;
  try {
    await sql`DELETE FROM registrar_accounts WHERE id = ${id}`;
    return true;
  } catch (_e) {
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

// ═══════════════════════════════════════════════════════
// AUTH — USERS
// ═══════════════════════════════════════════════════════

/** Find user by email (returns full row including password_hash) */
export async function findUserByEmail(email) {
  if (!ensureConnection()) return null;
  const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
  return rows[0] || null;
}

/** Find user by id (no password_hash) */
export async function findUserById(id) {
  if (!ensureConnection()) return null;
  const rows = await sql`SELECT id, email, name, role, is_active, created_at, last_login_at FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

/** Load all users — no password_hash */
export async function loadUsers() {
  if (!ensureConnection()) return [];
  return sql`SELECT id, email, name, role, is_active, created_at, last_login_at FROM users ORDER BY created_at`;
}

/** Create a new user */
export async function createUser({ id, email, passwordHash, role, name }) {
  if (!ensureConnection()) throw new Error("Neon not connected");
  await sql`
    INSERT INTO users (id, email, name, password_hash, role, is_active)
    VALUES (${id}, ${email}, ${name || ""}, ${passwordHash}, ${role}, TRUE)
  `;
  return { id, email, role };
}

/** Update user role */
export async function updateUserRole(id, role) {
  if (!ensureConnection()) throw new Error("Neon not connected");
  await sql`UPDATE users SET role = ${role} WHERE id = ${id}`;
  return true;
}

/** Activate / deactivate user */
export async function updateUserStatus(id, isActive) {
  if (!ensureConnection()) throw new Error("Neon not connected");
  await sql`UPDATE users SET is_active = ${isActive} WHERE id = ${id}`;
  return true;
}

/** Update password hash */
export async function updateUserPassword(id, passwordHash) {
  if (!ensureConnection()) throw new Error("Neon not connected");
  await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${id}`;
  return true;
}

/** Update last_login_at timestamp */
export async function updateLastLogin(id) {
  if (!ensureConnection()) return;
  await sql`UPDATE users SET last_login_at = now() WHERE id = ${id}`;
}

/** Delete user (cascade deletes sessions) */
export async function deleteUser(id) {
  if (!ensureConnection()) throw new Error("Neon not connected");
  await sql`DELETE FROM users WHERE id = ${id}`;
  return true;
}

// ═══════════════════════════════════════════════════════
// AUTH — SESSIONS
// ═══════════════════════════════════════════════════════

/** Create session record */
export async function createSession({ id, userId, token, expiresAt, ua }) {
  if (!ensureConnection()) throw new Error("Neon not connected");
  await sql`
    INSERT INTO sessions (id, user_id, token, expires_at, ua)
    VALUES (${id}, ${userId}, ${token}, ${expiresAt}, ${ua || ""})
    ON CONFLICT (token) DO NOTHING
  `;
  return true;
}

/** Find session by token — returns session row */
export async function findSession(token) {
  if (!ensureConnection()) return null;
  const rows = await sql`
    SELECT s.*, u.id as uid, u.email, u.role, u.is_active, u.name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > now()
    LIMIT 1
  `;
  return rows[0] || null;
}

/** Delete session by token (logout) */
export async function deleteSession(token) {
  if (!ensureConnection()) return;
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

/** Delete all sessions for a user */
export async function deleteUserSessions(userId) {
  if (!ensureConnection()) return;
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
}

// ═══════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════

/** Save audit event */
export async function saveAuditEvent({ id, site_id, event_type, severity, title, detail, meta }) {
  if (!ensureConnection()) return;
  const safeId = id || ("ae_" + Date.now().toString(36));
  await sql`
    INSERT INTO site_audit_log (id, site_id, event_type, severity, title, detail, meta)
    VALUES (${safeId}, ${site_id}, ${event_type}, ${severity || "info"}, ${title}, ${detail || ""}, ${JSON.stringify(meta || {})})
    ON CONFLICT (id) DO NOTHING
  `;
}

/** Load audit events with optional filters */
export async function loadAuditEvents({ siteId, eventType, limit = 200 } = {}) {
  if (!ensureConnection()) return [];
  if (siteId && eventType) {
    return sql`SELECT * FROM site_audit_log WHERE site_id = ${siteId} AND event_type = ${eventType} ORDER BY ts DESC LIMIT ${limit}`;
  }
  if (siteId) {
    return sql`SELECT * FROM site_audit_log WHERE site_id = ${siteId} ORDER BY ts DESC LIMIT ${limit}`;
  }
  if (eventType) {
    return sql`SELECT * FROM site_audit_log WHERE event_type = ${eventType} ORDER BY ts DESC LIMIT ${limit}`;
  }
  return sql`SELECT * FROM site_audit_log ORDER BY ts DESC LIMIT ${limit}`;
}

/** Get KPI stats per user from audit log meta */
export async function getKpiStats() {
  if (!ensureConnection()) return [];
  // Count events grouped by meta->>'userId' for task events
  const rows = await sql`
    SELECT
      meta->>'userId' AS user_id,
      meta->>'userName' AS user_name,
      COUNT(*) FILTER (WHERE event_type = 'task_completed') AS tasks_completed,
      COUNT(*) FILTER (WHERE event_type = 'task_created') AS tasks_created,
      COUNT(*) FILTER (WHERE event_type = 'deploy_success') AS deploys,
      COUNT(*) FILTER (WHERE event_type = 'site_created') AS sites_created,
      MAX(ts) AS last_active
    FROM site_audit_log
    WHERE meta->>'userId' IS NOT NULL
    GROUP BY meta->>'userId', meta->>'userName'
    ORDER BY tasks_completed DESC
  `;
  return rows;
}

// ═══════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════

/** Load all tasks ordered by updated_at DESC */
export async function loadTasks() {
  if (!ensureConnection()) return [];
  try {
    const rows = await sql`SELECT * FROM tasks ORDER BY updated_at DESC`;
    return rows.map(r => ({
      ...r,
      tags: Array.isArray(r.tags) ? r.tags : (typeof r.tags === "string" ? JSON.parse(r.tags || "[]") : []),
    }));
  } catch (e) {
    console.warn("[neon] loadTasks:", e.message);
    return [];
  }
}

/** Upsert a task */
export async function saveTask(t) {
  if (!ensureConnection()) return false;
  try {
    await sql`
      INSERT INTO tasks (id, title, description, status, priority, assignee_id, assignee_name, site_id, tags, due_date, created_by, created_at, updated_at)
      VALUES (${t.id}, ${t.title}, ${t.description || ""}, ${t.status}, ${t.priority}, ${t.assignee_id || null}, ${t.assignee_name || null}, ${t.site_id || null}, ${JSON.stringify(t.tags || [])}, ${t.due_date || null}, ${t.created_by || null}, ${t.created_at}, ${t.updated_at})
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, description = EXCLUDED.description,
        status = EXCLUDED.status, priority = EXCLUDED.priority,
        assignee_id = EXCLUDED.assignee_id, assignee_name = EXCLUDED.assignee_name,
        site_id = EXCLUDED.site_id, tags = EXCLUDED.tags,
        due_date = EXCLUDED.due_date, updated_at = EXCLUDED.updated_at
    `;
    return true;
  } catch (e) {
    console.warn("[neon] saveTask:", e.message);
    return false;
  }
}

/** Delete a task by id */
export async function deleteTask(id) {
  if (!ensureConnection()) return false;
  try {
    await sql`DELETE FROM tasks WHERE id = ${id}`;
    return true;
  } catch (e) {
    console.warn("[neon] deleteTask:", e.message);
    return false;
  }
}
