/**
 * D1 Database Service
 *
 * Direct connection to Cloudflare D1 via REST API
 * Use this for frontend queries to D1 database
 */

import { api } from "./api";

const D1_API_BASE = "https://api.cloudflare.com/client/v4";

/* ═════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
══════════════════════════════════════════════════════════════════════ */

/**
 * Get D1 credentials from settings
 * Reads from lpf2-settings localStorage key
 */
async function getCredentials() {
  // Settings are stored with "lpf2-" prefix
  const settings = JSON.parse(localStorage.getItem("lpf2-settings") || "{}");

  return {
    accountId: settings.d1AccountId || "",
    databaseId: settings.d1DatabaseId || "",
    apiToken: settings.d1ApiToken || "",
  };
}

/* ═════════════════════════════════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════════════════════════════════ */

/**
 * Execute a SQL query on D1 database
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} params - Parameters for prepared statement
 * @returns {Promise<{success: boolean, results?: Array, error?: string}>}
 */
export async function query(sql, params = []) {
  const { accountId, databaseId, apiToken } = await getCredentials();

  if (!accountId || !databaseId || !apiToken) {
    return { success: false, error: "D1 credentials not configured. Please check Settings." };
  }

  try {
    // Use our Worker proxy to avoid CORS
    const response = await api.post("/api/automation/d1/query", {
      sql,
      params,
      accountId,
      databaseId,
      apiToken, // Send token in request body
    });

    if (response.success) {
      return { success: true, results: response.results || [] };
    } else {
      return { success: false, error: response.error || "Query failed" };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Execute a SQL command that doesn't return data (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL command
 * @param {Array} params - Parameters for prepared statement
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function execute(sql, params = []) {
  const { accountId, databaseId, apiToken } = await getCredentials();

  if (!accountId || !databaseId || !apiToken) {
    return { success: false, error: "D1 credentials not configured. Please check Settings." };
  }

  try {
    // Use our Worker proxy to avoid CORS
    const response = await api.post("/api/automation/d1/execute", {
      sql,
      params,
      accountId,
      databaseId,
      apiToken, // Send token in request body
    });

    if (response.success) {
      return { success: true };
    } else {
      return { success: false, error: response.error || "Execution failed" };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Test D1 connection using Worker's D1 binding (no credentials needed)
 * @returns {Promise<{success: boolean, tables?: Array, error?: string}>}
 */
export async function testConnection() {
  try {
    const response = await api.get("/api/automation/d1/test");
    if (response.success) {
      return { success: true, tables: response.tables || [] };
    } else {
      return { success: false, error: response.error || "Connection failed" };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Test D1 connection with API Token (for validation)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function testConnectionWithToken() {
  const { accountId, databaseId, apiToken } = await getCredentials();

  if (!accountId || !databaseId || !apiToken) {
    return { success: false, error: "D1 credentials not configured" };
  }

  try {
    const result = await query("SELECT name FROM sqlite_master WHERE type='table'");
    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Get all tables in the database
 * @returns {Promise<{success: boolean, tables?: Array, error?: string}>}
 */
export async function getTables() {
  const result = await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");

  if (result.success) {
    return { success: true, tables: result.results.map(r => r.name) };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Check if a table exists
 * @param {string} tableName - Name of the table
 * @returns {Promise<boolean>}
 */
export async function tableExists(tableName) {
  const result = await query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    [tableName]
  );
  return result.success && result.results.length > 0;
}

/* ═════════════════════════════════════════════════════════════════════
   SITE HELPERS — parallel write alongside Neon
══════════════════════════════════════════════════════════════════════ */

/**
 * Resolve the Worker API base URL (same logic as voluum.js / api.js)
 */
function resolveApiBase() {
  const fromWindow = typeof window !== "undefined" ? window.__LP_API__ : "";
  const fromEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_API_BASE : "";
  const DEFAULT = "https://lp-factory-api.misty-feather-556e.workers.dev/api";
  return String(fromWindow || fromEnv || DEFAULT).replace(/\/+$/, "");
}

/**
 * Direct D1 write via Worker env.DB binding (no API token needed).
 * Uses /api/automation/d1/direct-query which calls env.DB.prepare() internally.
 */
async function directExecute(sql, params = []) {
  const base = resolveApiBase();
  const res = await fetch(`${base}/automation/d1/direct-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || `D1 HTTP ${res.status}`);
  return data;
}

let _sitesTableReady = false;
let _auditTableReady = false;
let _proxiesTableReady = false;
let _tasksTableReady = false;

/**
 * Ensure the sites table exists in D1 — only runs once per session
 */
async function ensureSitesTable() {
  if (_sitesTableReady) return;
  await directExecute(
    `CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );
  _sitesTableReady = true;
}

async function ensureAuditTable() {
  if (_auditTableReady) return;
  await directExecute(
    `CREATE TABLE IF NOT EXISTS site_audit_log (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      detail TEXT,
      meta TEXT DEFAULT '{}',
      ts TEXT DEFAULT (datetime('now'))
    )`
  );
  _auditTableReady = true;
}

async function ensureProxiesTable() {
  if (_proxiesTableReady) return;
  await directExecute(
    `CREATE TABLE IF NOT EXISTS proxies (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );
  _proxiesTableReady = true;
}

/**
 * Upsert a site into D1 (parallel write alongside Neon)
 * @param {object} site  — plain site object with an `id` field
 */
export async function saveSiteToD1(site) {
  await ensureSitesTable();
  const { id, ...data } = site;
  const safeId = id || `site-${Date.now().toString(36)}`;
  await directExecute(
    `INSERT INTO sites (id, data, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       data = excluded.data,
       updated_at = datetime('now')`,
    [safeId, JSON.stringify(data)]
  );
  return true;
}

/**
 * Delete a site from D1 by id
 * @param {string} id
 */
export async function deleteSiteFromD1(id) {
  await directExecute(`DELETE FROM sites WHERE id = ?`, [id]);
  return true;
}

/** Save audit event to D1 (fire-and-forget backup) */
export async function saveAuditEventToD1(event) {
  await ensureAuditTable();
  await directExecute(
    `INSERT INTO site_audit_log (id, site_id, event_type, severity, title, detail, meta, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [event.id, event.site_id, event.event_type, event.severity || 'info',
     event.title || '', event.detail || '', JSON.stringify(event.meta || {}), event.ts || new Date().toISOString()]
  );
  return true;
}

/** Upsert proxy to D1 (fire-and-forget backup) */
export async function saveProxyToD1(proxy) {
  await ensureProxiesTable();
  const { id, createdAt, updatedAt, ...data } = proxy;
  await directExecute(
    `INSERT INTO proxies (id, data, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
    [id, JSON.stringify(data)]
  );
  return true;
}

/** Delete proxy from D1 */
export async function deleteProxyFromD1(id) {
  await directExecute(`DELETE FROM proxies WHERE id = ?`, [id]);
  return true;
}

async function ensureTasksTable() {
  if (_tasksTableReady) return;
  await directExecute(
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee_id TEXT,
      assignee_name TEXT,
      site_id TEXT,
      tags TEXT DEFAULT '[]',
      due_date TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );
  _tasksTableReady = true;
}

/** Upsert task to D1 (fire-and-forget backup) */
export async function saveTaskToD1(task) {
  await ensureTasksTable();
  await directExecute(
    `INSERT INTO tasks (id, title, description, status, priority, assignee_id, assignee_name,
                        site_id, tags, due_date, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       status = excluded.status,
       priority = excluded.priority,
       assignee_id = excluded.assignee_id,
       assignee_name = excluded.assignee_name,
       site_id = excluded.site_id,
       tags = excluded.tags,
       due_date = excluded.due_date,
       updated_at = datetime('now')`,
    [task.id, task.title || '', task.description || '', task.status || 'todo',
     task.priority || 'medium', task.assignee_id || null, task.assignee_name || null,
     task.site_id || null, JSON.stringify(task.tags || []), task.due_date || null,
     task.created_by || null, task.created_at || new Date().toISOString()]
  );
  return true;
}

/** Delete task from D1 */
export async function deleteTaskFromD1(id) {
  await directExecute(`DELETE FROM tasks WHERE id = ?`, [id]);
  return true;
}

/**
 * One-time migration: bulk-upsert all sites from Neon → D1
 * @param {Array} sites  — array of site objects (from Neon loadSites)
 * @returns {{ synced: number, errors: number }}
 */
export async function migrateSitesToD1(sites) {
  await ensureSitesTable();
  let synced = 0;
  let errors = 0;
  for (const site of sites) {
    try {
      await saveSiteToD1(site);
      synced++;
    } catch (_) {
      errors++;
    }
  }
  return { synced, errors };
}

/* ═════════════════════════════════════════════════════════════════════
   EXPORTS
══════════════════════════════════════════════════════════════════════ */

const d1Service = {
  query,
  execute,
  testConnection,
  getTables,
  tableExists,
  saveSiteToD1,
  deleteSiteFromD1,
};

export default d1Service;
