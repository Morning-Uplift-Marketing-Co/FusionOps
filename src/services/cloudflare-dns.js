/**
 * Cloudflare DNS Service
 *
 * Handles:
 * - Zone creation/lookup
 * - DNS record management
 * - Automatic DNS updates after deployment
 */

import { api } from "./api";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

/* ═════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
══════════════════════════════════════════════════════════════════════ */

/**
 * Get Cloudflare API base URL (supports proxy)
 */
function getCfApiBase() {
  // If proxy is configured, use it
  return `${CF_API_BASE}`;
}

/* ═════════════════════════════════════════════════════════════════════
   ZONE MANAGEMENT
══════════════════════════════════════════════════════════════════════ */

/**
 * Create or get a zone for a domain
 * @param {string} domain - Domain name
 * @param {string} cfAccountId - Cloudflare Account ID
 * @param {string} cfApiToken - Cloudflare API Token
 * @returns {Promise<{success: boolean, zoneId?: string, exists?: boolean, nameservers?: string[]}>}
 */
export async function getOrCreateZone(domain, cfAccountId, cfApiToken) {
  try {
    // Route through Worker proxy to avoid browser CORS/network issues.
    const res = await api.post("/automation/cf/zone", { domain, cfAccountId, cfApiToken });
    if (res?.error || res?.success === false) {
      return { success: false, error: res?.error || "Zone lookup/create failed" };
    }
    return {
      success: true,
      exists: !!res.exists,
      zoneId: res.zoneId,
      nameservers: res.zone?.name_servers || [],
      zone: res.zone,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Get zone details by domain
 * @param {string} domain - Domain name
 * @param {string} cfApiToken - Cloudflare API Token
 * @param {string} [cfAccountId] - Cloudflare Account ID
 * @returns {Promise<{success: boolean, zone?: object}>}
 */
export async function getZoneByDomain(domain, cfApiToken, cfAccountId = "") {
  try {
    if (!cfAccountId) {
      return { success: false, error: "cfAccountId is required" };
    }
    const zoneResult = await getOrCreateZone(domain, cfAccountId, cfApiToken);
    if (zoneResult.success && zoneResult.zone) {
      return { success: true, zone: zoneResult.zone };
    }
    return { success: false, error: zoneResult.error || "Zone not found" };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/* ═════════════════════════════════════════════════════════════════════
   DNS RECORD MANAGEMENT
══════════════════════════════════════════════════════════════════════ */

/**
 * List all DNS records for a zone
 * @param {string} zoneId - Zone ID
 * @param {string} cfAccountId - Cloudflare Account ID
 * @returns {Promise<{success: boolean, records?: array}>}
 */
export async function listDnsRecords(zoneId, cfAccountId, cfApiToken = "") {
  try {
    const q = `zoneId=${encodeURIComponent(zoneId)}&cfAccountId=${encodeURIComponent(cfAccountId)}&apiToken=${encodeURIComponent(cfApiToken || "")}`;
    const res = await api.get(`/automation/cf/dns?${q}`);

    return {
      success: res.success !== false,
      records: res.records || [],
      error: res.error,
    };
  } catch (e) {
    return { success: false, error: e.message, records: [] };
  }
}

/**
 * Create a DNS record
 * @param {object} params - Record parameters
 * @param {string} params.zoneId - Zone ID
 * @param {string} params.cfAccountId - Cloudflare Account ID
 * @param {string} params.type - Record type (A, AAAA, CNAME, TXT, etc.)
 * @param {string} params.name - Record name
 * @param {string} params.content - Record content/value
 * @param {number} [params.ttl=3600] - TTL in seconds
 * @param {boolean} [params.proxied=false] - Enable Cloudflare proxy
 * @returns {Promise<{success: boolean, record?: object}>}
 */
export async function createDnsRecord({ zoneId, cfAccountId, cfApiToken, type, name, content, ttl = 3600, proxied = false }) {
  try {
    const res = await api.post("/automation/cf/dns", {
      zoneId,
      cfAccountId,
      apiToken: cfApiToken || "",
      type,
      name,
      content,
      ttl,
      proxied,
    });

    return {
      success: res.success !== false,
      record: res.record,
      error: res.error,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Update a DNS record
 * @param {object} params - Update parameters
 * @param {string} params.dnsRecordId - DNS Record ID
 * @param {string} params.zoneId - Zone ID
 * @param {string} params.cfAccountId - Cloudflare Account ID
 * @param {string} [params.type] - New record type
 * @param {string} [params.name] - New record name
 * @param {string} [params.content] - New record content
 * @param {number} [params.ttl] - New TTL
 * @param {boolean} [params.proxied] - New proxy status
 * @returns {Promise<{success: boolean, record?: object}>}
 */
export async function updateDnsRecord({ dnsRecordId, zoneId, cfAccountId, cfApiToken, type, name, content, ttl, proxied }) {
  try {
    const res = await api.put("/automation/cf/dns", {
      dnsRecordId,
      zoneId,
      cfAccountId,
      apiToken: cfApiToken || "",
      type,
      name,
      content,
      ttl,
      proxied,
    });

    return {
      success: res.success !== false,
      record: res.record,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Delete a DNS record
 * @param {string} dnsRecordId - DNS Record ID
 * @param {string} zoneId - Zone ID
 * @param {string} cfAccountId - Cloudflare Account ID
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteDnsRecord(dnsRecordId, zoneId, cfAccountId, cfApiToken = "") {
  try {
    const q = `dnsRecordId=${encodeURIComponent(dnsRecordId)}&zoneId=${encodeURIComponent(zoneId)}&cfAccountId=${encodeURIComponent(cfAccountId)}&apiToken=${encodeURIComponent(cfApiToken || "")}`;
    const res = await api.del(`/automation/cf/dns?${q}`);

    return { success: res.success !== false, error: res.error };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/* ═════════════════════════════════════════════════════════════════════
   DEPLOYMENT INTEGRATION
══════════════════════════════════════════════════════════════════════ */

/**
 * Update DNS records after deployment
 * Creates/updates DNS records to point to the deployed service
 *
 * @param {object} params - Deployment parameters
 * @param {string} params.domain - Domain name
 * @param {string} params.cfAccountId - Cloudflare Account ID
 * @param {string} params.cfApiToken - Cloudflare API Token
 * @param {string} params.deployTarget - Deployment target (cf-pages, netlify, vercel, etc.)
 * @param {string} params.deployUrl - URL from deployment
 * @param {boolean} [params.proxied=true] - Whether to enable Cloudflare proxy
 * @returns {Promise<{success: boolean, records?: array, message?: string}>}
 */
export async function updateDnsAfterDeploy({
  domain,
  cfAccountId,
  cfApiToken,
  deployTarget,
  deployUrl,
  proxied = true,
}) {
  try {
    // First get the zone
    const zoneResult = await getOrCreateZone(domain, cfAccountId, cfApiToken);
    if (!zoneResult.success) {
      return { success: false, error: "Failed to get zone: " + zoneResult.error };
    }

    const zoneId = zoneResult.zoneId;
    const records = [];
    const errors = [];

    const trackResult = (result, contextLabel) => {
      if (result?.success) {
        if (result.record) records.push(result.record);
      } else {
        errors.push(`${contextLabel}: ${result?.error || "Unknown DNS error"}`);
      }
    };

    // Determine DNS records based on deployment target
    switch (deployTarget) {
      case "cf-pages":
        // CF Pages uses CNAME to pages.dev
        const pagesHost = new URL(deployUrl).hostname;
        const cnameResult = await upsertDnsRecord({
          zoneId,
          cfAccountId,
          cfApiToken,
          domain,
          type: "CNAME",
          name: "@", // Root domain
          content: pagesHost,
          proxied,
        });
        trackResult(cnameResult, "root CNAME");
        // Add www
        const wwwResult = await upsertDnsRecord({
          zoneId,
          cfAccountId,
          cfApiToken,
          domain,
          type: "CNAME",
          name: "www",
          content: pagesHost,
          proxied,
        });
        trackResult(wwwResult, "www CNAME");
        break;

      case "netlify":
        // Netlify uses CNAME to netlify.com
        const netlifyHost = `${domain}.netlify.com`;
        const netlifyCname = await upsertDnsRecord({
          zoneId,
          cfAccountId,
          cfApiToken,
          domain,
          type: "CNAME",
          name: "@",
          content: netlifyHost,
          proxied,
        });
        trackResult(netlifyCname, "root CNAME");
        const wwwNetlify = await upsertDnsRecord({
          zoneId,
          cfAccountId,
          cfApiToken,
          domain,
          type: "CNAME",
          name: "www",
          content: netlifyHost,
          proxied,
        });
        trackResult(wwwNetlify, "www CNAME");
        break;

      case "vercel":
        // Vercel uses CNAME to cname.vercel-dns.com
        const vercelCname = await upsertDnsRecord({
          zoneId,
          cfAccountId,
          cfApiToken,
          domain,
          type: "CNAME",
          name: "@",
          content: "cname.vercel-dns.com",
          proxied,
        });
        trackResult(vercelCname, "root CNAME");
        break;

      case "cf-workers":
        // Workers Sites uses A record or special handling
        // For custom domains, use A record pointing to Workers
        const workersA = await upsertDnsRecord({
          zoneId,
          cfAccountId,
          cfApiToken,
          domain,
          type: "A",
          name: "@",
          content: "192.0.2.1", // Placeholder - should use actual Worker route
          proxied: true, // Must be proxied for Workers
        });
        trackResult(workersA, "root A");
        break;

      case "s3-cloudfront":
        // S3+CloudFront uses CNAME or A record to CloudFront distribution
        // If cloudfrontDistId is set, use it
        const cloudfrontHost = deployUrl; // Should be CloudFront URL
        if (cloudfrontHost.includes("cloudfront.net")) {
          const cfCname = await upsertDnsRecord({
            zoneId,
            cfAccountId,
            cfApiToken,
            domain,
            type: "CNAME",
            name: "@",
            content: cloudfrontHost,
            proxied: false, // Don't proxy CloudFront
          });
          trackResult(cfCname, "root CNAME");
        }
        break;

      case "vps-ssh":
        // VPS uses A record to server IP
        // Need to resolve the deploy URL to get IP
        try {
          const ip = await resolveIp(deployUrl);
          if (ip) {
            const vpsA = await upsertDnsRecord({
              zoneId,
              cfAccountId,
              cfApiToken,
              domain,
              type: "A",
              name: "@",
              content: ip,
              proxied: false,
            });
            trackResult(vpsA, "root A");
          }
        } catch (e) {
          console.warn("Could not resolve IP for VPS:", e);
        }
        break;

      default:
        return { success: false, error: `Unknown deploy target: ${deployTarget}` };
    }

    if (errors.length > 0) {
      return {
        success: false,
        records,
        error: `DNS update failed (${errors.length}): ${errors.join(" | ")}`,
      };
    }

    return {
      success: true,
      records,
      message: `Updated ${records.length} DNS record(s) for ${domain}`,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Upsert a DNS record (create or update if exists)
 */
function normalizeRecordName(name, domain) {
  const cleanName = String(name || "").trim();
  const cleanDomain = String(domain || "").trim();
  if (!cleanName) return cleanDomain;
  if (cleanName === "@") return cleanDomain;
  if (!cleanDomain) return cleanName;
  return cleanName.includes(".") ? cleanName : `${cleanName}.${cleanDomain}`;
}

async function upsertDnsRecord({ zoneId, cfAccountId, cfApiToken, domain, type, name, content, ttl = 3600, proxied = false }) {
  try {
    const normalizedName = normalizeRecordName(name, domain);

    // List existing records to check if one exists
    const listRes = await listDnsRecords(zoneId, cfAccountId, cfApiToken);

    if (!listRes.success) {
      return { success: false, error: listRes.error || "Failed to list DNS records" };
    }

    // Find matching record
    const existing = listRes.records.find(
      (r) => r.type === type && (
        r.name === normalizedName ||
        r.name === name
      )
    );

    if (existing) {
      // Update existing record
      return await updateDnsRecord({
        dnsRecordId: existing.id,
        zoneId,
        cfAccountId,
        cfApiToken,
        type,
        name: normalizedName,
        content,
        ttl,
        proxied,
      });
    }

    // Create new record
    return await createDnsRecord({
      zoneId,
      cfAccountId,
      cfApiToken,
      type,
      name: normalizedName,
      content,
      ttl,
      proxied,
    });
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Resolve IP address from URL
 * Uses a DNS-over-HTTPS service
 */
async function resolveIp(url) {
  try {
    const hostname = new URL(url).hostname;
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${hostname}&type=A`, {
      headers: { Accept: "application/dns-json" },
    });
    const data = await res.json();
    return data.Answer?.[0]?.data;
  } catch (e) {
    console.warn("[CloudflareDNS] Failed to resolve IP:", e?.message || e);
    return null;
  }
}

/* ═════════════════════════════════════════════════════════════════════
   EXPORTS
══════════════════════════════════════════════════════════════════════ */

const cloudflareDns = {
  // Zone management
  getOrCreateZone,
  getZoneByDomain,

  // DNS record management
  listDnsRecords,
  createDnsRecord,
  updateDnsRecord,
  deleteDnsRecord,

  // Deployment integration
  updateDnsAfterDeploy,
};

export default cloudflareDns;
