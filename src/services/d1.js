/**
 * D1 Database Service
 *
 * Direct connection to Cloudflare D1 via REST API
 * Use this for frontend queries to D1 database
 */

import { api } from "./api";
import { LS } from "../utils";
import { resolveD1DatabaseIds } from "./account-lock";

const D1_API_BASE = "https://api.cloudflare.com/client/v4";

/* ═════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
══════════════════════════════════════════════════════════════════════ */

/**
 * Get D1 credentials from settings
 * Reads from lpf2-settings localStorage key
 */
async function getCredentials() {
  const settings = LS.get("settings") || {};
  const { d1DatabaseId } = resolveD1DatabaseIds(settings);

  return {
    accountId: settings.d1AccountId || "",
    databaseId: d1DatabaseId || "",
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
 * Run DDL/DML on the user's D1 via Worker proxy + Cloudflare API token from Settings.
 * Do NOT use /api/automation/d1/direct-query here — that route is read-only (SELECT/WITH only).
 */
async function directExecute(sql, params = []) {
  const res = await execute(sql, params);
  if (!res.success) {
    throw new Error(res.error || "D1 execute failed");
  }
  return res;
}

let _sitesTableReady = false;

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

/* ═════════════════════════════════════════════════════════════════════
   TASK HELPERS — fire-and-forget backup alongside Neon
══════════════════════════════════════════════════════════════════════ */

let _tasksTableReady = false;

async function ensureTasksTable() {
  if (_tasksTableReady) return;
  await directExecute(
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );
  _tasksTableReady = true;
}

/** Upsert a task into D1 (fire-and-forget backup) */
export async function saveTaskToD1(task) {
  try {
    await ensureTasksTable();
    await directExecute(
      `INSERT INTO tasks (id, data, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         data = excluded.data,
         updated_at = datetime('now')`,
      [task.id, JSON.stringify(task)]
    );
  } catch { /* fire and forget — never throw */ }
}

/** Delete a task from D1 by id */
export async function deleteTaskFromD1(id) {
  try {
    await directExecute(`DELETE FROM tasks WHERE id = ?`, [id]);
  } catch { /* fire and forget */ }
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
