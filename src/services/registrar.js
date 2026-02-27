/**
 * Registrar Service - Internet.bs API Integration
 *
 * API Documentation: https://reseller.internet.bs/api/API_reseller_en.html
 *
 * Features:
 * - Check domain availability
 * - Register new domain
 * - Update nameservers
 * - List all domains
 * - Get account balance
 */

import { api } from "./api";

const REGISTRAR_API_BASE = "https://api.internet.bs";

/* ═════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
══════════════════════════════════════════════════════════════════════ */

/**
 * Convert form-data response to JSON
 */
function parseFormResponse(text) {
  const lines = text.split("\n");
  const result = {};
  for (const line of lines) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      result[key] = valueParts.join("=");
    }
  }
  return result;
}

/**
 * Make a request to Internet.bs API
 * Uses our Worker proxy to avoid CORS issues
 */
async function requestApi(endpoint, formData, accountId) {
  try {
    // Map Internet.bs-style endpoints to our Worker automation routes.
    const normalized = String(endpoint || "").replace(REGISTRAR_API_BASE, "");
    const endpointMap = {
      "/Domain/Check": "/api/automation/registrar/check",
      "/Domain/Create": "/api/automation/registrar/register",
      "/Domain/Update": "/api/automation/registrar/nameservers",
      "/Domain/List": "/api/automation/registrar/import",
      "/Account/Balance/Get": "/api/automation/registrar/ping",
    };
    const workerEndpoint = endpointMap[normalized];
    if (!workerEndpoint) {
      return { success: false, error: `Unsupported registrar endpoint: ${normalized}` };
    }

    const body = { provider: "internetbs", accountId };

    if (normalized === "/Domain/Check") {
      body.domain = formData?.domain || formData?.Domain || "";
    }

    if (normalized === "/Domain/Create") {
      body.domain = formData?.domain || formData?.Domain || "";
      body.period = formData?.period || formData?.Period || "1Y";
      // Also extract nameservers if present
      const nsFromArray = Array.isArray(formData?.nameservers) ? formData.nameservers : [];
      if (nsFromArray.length > 0) {
        body.nameservers = nsFromArray;
      } else {
        // Check for Ns1, Ns2... in formData
        const nsList = [];
        for (let i = 1; i <= 10; i++) {
          if (formData[`Ns${i}`]) nsList.push(formData[`Ns${i}`]);
        }
        if (nsList.length > 0) body.nameservers = nsList;
      }
    }

    if (normalized === "/Domain/Update") {
      body.domain = formData?.domain || formData?.Domain || "";
      const nsFromArray = Array.isArray(formData?.nameservers) ? formData.nameservers : [];
      const nsFromList = String(formData?.Ns_list || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      body.nameservers = nsFromArray.length ? nsFromArray : nsFromList;
    }

    const res = normalized === "/Domain/Update"
      ? await api.put(workerEndpoint, body)
      : await api.post(workerEndpoint, body);

    if (res?.error) {
      let message = res.error;
      try {
        const parsed = JSON.parse(res.detail || "{}");
        message = parsed?.error || parsed?.message || message;
      } catch (parseErr) {
        if (res.detail) message = res.detail;
      }
      return { success: false, error: message };
    }

    return res;
  } catch (e) {
    console.warn("[Registrar] API request failed:", e?.message || e);
    return { error: e.message, success: false };
  }
}

/* ═════════════════════════════════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════════════════════════════════ */

/**
 * Check if a domain is available for registration
 * @param {string} domain - Domain name (e.g., "example.com")
 * @param {string} accountId - Optional registrar account ID
 * @returns {Promise<{success: boolean, available: boolean, domain: string, message?: string}>}
 */
export async function checkAvailability(domain, accountId) {
  if (!domain || !domain.includes(".")) {
    return { success: false, available: false, error: "Invalid domain format" };
  }

  return await requestApi("/Domain/Check", { Domain: domain }, accountId);
}

/**
 * Register a new domain
 * @param {object} params - Registration parameters
 * @param {string} params.domain - Domain name to register
 * @param {string} [params.period='1Y'] - Registration period (1Y, 2Y, etc.)
 * @param {string} [params.accountId] - Registrar account ID
 * @param {string[]} [params.nameservers] - Optional nameservers to set
 * @param {object} [params.contacts] - Registrant contact info
 * @returns {Promise<{success: boolean, domain: string, transactionId?: string, message?: string}>}
 */
export async function registerDomain({ domain, period = "1Y", accountId, nameservers, contacts }) {
  if (!domain) {
    return { success: false, error: "Domain is required" };
  }

  const formData = { Domain: domain, Period: period };

  // Add nameservers if provided
  if (nameservers && nameservers.length > 0) {
    nameservers.forEach((ns, i) => {
      formData[`Ns${i + 1}`] = ns;
    });
  }

  // Add contact info if provided
  if (contacts) {
    if (contacts.registrant) {
      Object.entries(contacts.registrant).forEach(([key, value]) => {
        formData[`Registrant_${key}`] = value;
      });
    }
  }

  return await requestApi("/Domain/Create", formData, accountId);
}

/**
 * Update domain nameservers
 * @param {string} domain - Domain name
 * @param {string[]} nameservers - Array of nameserver hostnames
 * @param {string} [accountId] - Registrar account ID
 * @returns {Promise<{success: boolean, domain: string, nameservers: string[], message?: string}>}
 */
export async function updateNameservers(domain, nameservers, accountId) {
  if (!domain || !nameservers || !Array.isArray(nameservers)) {
    return { success: false, error: "Domain and nameservers array required" };
  }

  if (nameservers.length < 2) {
    return { success: false, error: "At least 2 nameservers required" };
  }

  return await requestApi("/Domain/Update", {
    Domain: domain,
    Ns_list: nameservers.join(","),
  }, accountId);
}

/**
 * List all domains in the registrar account
 * @param {string} [accountId] - Registrar account ID
 * @returns {Promise<{success: boolean, domains: Array, count: number}>}
 */
export async function listDomains(accountId) {
  return await requestApi("/Domain/List", { CompactList: "no" }, accountId);
}

/**
 * Get account balance
 * @param {string} [accountId] - Registrar account ID
 * @returns {Promise<{success: boolean, balance: number, currency: string}>}
 */
export async function getBalance(accountId) {
  return await requestApi("/Account/Balance/Get", {}, accountId);
}

/**
 * Test connection to registrar API
 * @param {string} [accountId] - Registrar account ID
 * @returns {Promise<{success: boolean, balance?: number, message?: string}>}
 */
export async function testConnection(accountId) {
  const result = await getBalance(accountId);
  const rawBalance = result.balance;
  const normalizedBalance =
    rawBalance && typeof rawBalance === "object"
      ? (rawBalance.amount ?? rawBalance.value ?? rawBalance.balance ?? rawBalance?.[0]?.amount ?? rawBalance?.[0]?.balance ?? null)
      : rawBalance;
  const normalizedCurrency =
    result.currency ||
    (rawBalance && typeof rawBalance === "object"
      ? (rawBalance.currency ?? rawBalance?.[0]?.currency ?? null)
      : null);

  return {
    success: !!result.success,
    balance: normalizedBalance,
    currency: normalizedCurrency,
    message: result.message || result.error || "Connection failed",
  };
}

/**
 * Get recommended Cloudflare nameservers
 * These should be set after adding domain to Cloudflare
 */
export function getCloudflareNameservers() {
  return [
    "ara.ns.cloudflare.com",
    "bob.ns.cloudflare.com",
  ];
}

/**
 * Get nameservers for a specific Cloudflare account
 * @param {string} cfAccountId - Cloudflare Account ID
 * @returns {string[]} Nameserver hostnames
 */
export function getCfNameserversForAccount(cfAccountId) {
  // Different Cloudflare accounts may have different nameservers
  // This is a simplified version - in production, you'd fetch from CF API
  return getCloudflareNameservers();
}

/* ═════════════════════════════════════════════════════════════════════
   EXPORTS
══════════════════════════════════════════════════════════════════════ */

const registrarApi = {
  checkAvailability,
  registerDomain,
  updateNameservers,
  listDomains,
  getBalance,
  testConnection,
  getCloudflareNameservers,
  getCfNameserversForAccount,
};

export default registrarApi;
