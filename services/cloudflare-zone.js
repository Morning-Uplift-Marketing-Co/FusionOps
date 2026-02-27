/**
 * Cloudflare Zone Service
 *
 * Handles zone (domain) listing and management for Cloudflare accounts
 */

import { api } from "./api";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

/* ═════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
══════════════════════════════════════════════════════════════════════ */

/**
 * Get Cloudflare API base URL
 */
function getCfApiBase() {
  return CF_API_BASE;
}

/* ═════════════════════════════════════════════════════════════════════
   ZONE MANAGEMENT
══════════════════════════════════════════════════════════════════════ */

/**
 * List all zones for a Cloudflare account
 * @param {string} cfAccountId - Cloudflare Account ID
 * @param {string} cfApiToken - Cloudflare API Token
 * @param {object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.perPage - Results per page (default: 50)
 * @param {string} options.name - Filter by zone name
 * @returns {Promise<{success: boolean, zones?: array, error?: string}>}
 */
export async function listZones(cfAccountId, cfApiToken, options = {}) {
  try {
    const { page = 1, perPage = 50, name } = options;

    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      account_id: cfAccountId,
    });

    if (name) {
      params.append("name", name);
    }

    const res = await fetch(`${CF_API_BASE}/zones?${params}`, {
      headers: {
        "Authorization": `Bearer ${cfApiToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        error: data.errors?.[0]?.message || "Failed to list zones",
      };
    }

    return {
      success: true,
      zones: data.result || [],
      pageInfo: {
        page: data.result_info?.page || 1,
        perPage: data.result_info?.per_page || 50,
        totalPages: data.result_info?.total_pages || 1,
        total: data.result_info?.total_count || 0,
      },
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Get zone details by ID
 * @param {string} zoneId - Zone ID
 * @param {string} cfApiToken - Cloudflare API Token
 * @returns {Promise<{success: boolean, zone?: object, error?: string}>}
 */
export async function getZoneDetails(zoneId, cfApiToken) {
  try {
    const res = await fetch(`${CF_API_BASE}/zones/${zoneId}`, {
      headers: {
        "Authorization": `Bearer ${cfApiToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        error: data.errors?.[0]?.message || "Failed to get zone details",
      };
    }

    return {
      success: true,
      zone: data.result,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Find zone by domain name
 * @param {string} domain - Domain name to search for
 * @param {string} cfAccountId - Cloudflare Account ID
 * @param {string} cfApiToken - Cloudflare API Token
 * @returns {Promise<{success: boolean, zone?: object, error?: string}>}
 */
export async function findZoneByDomain(domain, cfAccountId, cfApiToken) {
  try {
    const res = await fetch(
      `${CF_API_BASE}/zones?name=${encodeURIComponent(domain)}&account_id=${cfAccountId}`,
      {
        headers: {
          "Authorization": `Bearer ${cfApiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        error: data.errors?.[0]?.message || "Failed to find zone",
      };
    }

    if (!data.result || data.result.length === 0) {
      return {
        success: false,
        error: "Zone not found",
      };
    }

    return {
      success: true,
      zone: data.result[0],
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Create a new zone
 * @param {object} params - Zone creation parameters
 * @param {string} params.name - Domain name
 * @param {string} params.accountId - Cloudflare Account ID
 * @param {string} params.cfApiToken - Cloudflare API Token
 * @param {string} [params.type='full'] - Zone type (full, partial)
 * @returns {Promise<{success: boolean, zone?: object, error?: string}>}
 */
export async function createZone({ name, accountId, cfApiToken, type = "full" }) {
  try {
    const res = await fetch(`${CF_API_BASE}/zones`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cfApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        account: { id: accountId },
        type,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        error: data.errors?.[0]?.message || "Failed to create zone",
      };
    }

    return {
      success: true,
      zone: data.result,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Delete a zone
 * @param {string} zoneId - Zone ID to delete
 * @param {string} cfApiToken - Cloudflare API Token
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteZone(zoneId, cfApiToken) {
  try {
    const res = await fetch(`${CF_API_BASE}/zones/${zoneId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${cfApiToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        error: data.errors?.[0]?.message || "Failed to delete zone",
      };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Get zone analytics/daily usage
 * @param {string} zoneId - Zone ID
 * @param {string} cfApiToken - Cloudflare API Token
 * @param {object} options - Query options
 * @param {string} options.since - Start date (ISO 8601)
 * @param {string} options.until - End date (ISO 8601)
 * @returns {Promise<{success: boolean, analytics?: object, error?: string}>}
 */
export async function getZoneAnalytics(zoneId, cfApiToken, options = {}) {
  try {
    const { since, until } = options;
    const params = new URLSearchParams();

    if (since) params.append("since", since);
    if (until) params.append("until", until);

    const res = await fetch(
      `${CF_API_BASE}/zones/${zoneId}/analytics/dashboard${params ? `?${params}` : ""}`,
      {
        headers: {
          "Authorization": `Bearer ${cfApiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        error: data.errors?.[0]?.message || "Failed to get analytics",
      };
    }

    return {
      success: true,
      analytics: data.result,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Get zone SSL certificate status
 * @param {string} zoneId - Zone ID
 * @param {string} cfApiToken - Cloudflare API Token
 * @returns {Promise<{success: boolean, ssl?: object, error?: string}>}
 */
export async function getZoneSSL(zoneId, cfApiToken) {
  try {
    const res = await fetch(`${CF_API_BASE}/zones/${zoneId}/ssl/verification`, {
      headers: {
        "Authorization": `Bearer ${cfApiToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        error: data.errors?.[0]?.message || "Failed to get SSL status",
      };
    }

    return {
      success: true,
      ssl: data.result,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/* ═════════════════════════════════════════════════════════════════════
   DNS PROPAGATION CHECK
══════════════════════════════════════════════════════════════════════ */

/**
 * Check DNS propagation using multiple DNS servers
 * @param {string} domain - Domain to check
 * @param {string} [recordType='A'] - Record type to check
 * @param {string} [expectedValue] - Expected DNS value
 * @returns {Promise<{success: boolean, propagated: boolean, servers: array}>}
 */
export async function checkDnsPropagation(domain, recordType = "A", expectedValue) {
  const dnsServers = [
    { name: "Cloudflare", url: "https://cloudflare-dns.com/dns-query" },
    { name: "Google", url: "https://dns.google/resolve" },
    { name: "Quad9", url: "https://dns.quad9.net:5053/dns-query" },
  ];

  const results = [];

  for (const server of dnsServers) {
    try {
      const url = `${server.url}?name=${encodeURIComponent(domain)}&type=${recordType}`;
      const res = await fetch(url, {
        headers: { Accept: "application/dns-json" },
      });
      const data = await res.json();

      const answer = data.Answer?.[0]?.data;
      const matches = expectedValue ? answer === expectedValue : !!answer;

      results.push({
        server: server.name,
        success: true,
        value: answer,
        matches,
      });
    } catch (e) {
      console.warn(`[CloudflareZone] DNS check failed for ${server.name}:`, e?.message || e);
      results.push({
        server: server.name,
        success: false,
        value: null,
        matches: false,
      });
    }
  }

  const propagated = results.every(r => r.success && r.matches);

  return {
    success: true,
    propagated,
    servers: results,
  };
}

/**
 * Resolve domain to IP using DNS-over-HTTPS
 * @param {string} domain - Domain to resolve
 * @param {string} [recordType='A'] - Record type
 * @returns {Promise<string|null>} IP address or null
 */
export async function resolveDomain(domain, recordType = "A") {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${recordType}`,
      {
        headers: { Accept: "application/dns-json" },
      }
    );
    const data = await res.json();
    return data.Answer?.[0]?.data || null;
  } catch (e) {
    console.warn("[CloudflareZone] Domain resolution failed:", e?.message || e);
    return null;
  }
}

/* ═════════════════════════════════════════════════════════════════════
   EXPORTS
══════════════════════════════════════════════════════════════════════ */

const cloudflareZone = {
  // Zone management
  listZones,
  getZoneDetails,
  findZoneByDomain,
  createZone,
  deleteZone,

  // Zone info
  getZoneAnalytics,
  getZoneSSL,

  // DNS propagation
  checkDnsPropagation,
  resolveDomain,
};

export default cloudflareZone;
