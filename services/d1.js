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
   EXPORTS
══════════════════════════════════════════════════════════════════════ */

const d1Service = {
  query,
  execute,
  testConnection,
  getTables,
  tableExists,
};

export default d1Service;
