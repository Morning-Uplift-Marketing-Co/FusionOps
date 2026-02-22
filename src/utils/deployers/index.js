/**
 * Deploy Orchestrator
 * Routes to the correct deployer module based on target.
 * Returns standardized result: { success, url, deployId, target, error }
 */

import * as cfPages from "./cf-pages.js";
import * as netlify from "./netlify.js";
import * as vercel from "./vercel.js";
import * as cfWorkers from "./cf-workers.js";
import * as s3Cloudfront from "./s3-cloudfront.js";
import * as vpsSsh from "./vps-ssh.js";
import * as gitPush from "./git-push.js";
import { LS } from "../index.js";

const DEPLOYERS = {
  "cf-pages": cfPages,
  "netlify": netlify,
  "vercel": vercel,
  "cf-workers": cfWorkers,
  "s3-cloudfront": s3Cloudfront,
  "vps-ssh": vpsSsh,
  "git-push": gitPush,
};

const DEPLOY_HISTORY_KEY = "lpf2-deploy-history";
const DEPLOY_CONFIGS_KEY = "lpf2-deploy-configs";

// Worker API base URL - use environment variable
const WORKER_BASE = import.meta.env?.VITE_API_BASE?.replace(/\/api$/, '') ||
    "https://lp-factory-api.songsawat-w.workers.dev";

/**
 * Helper to make API calls to the Worker
 */
async function apiCall(endpoint, options = {}) {
  const url = `${WORKER_BASE}${endpoint}`;
  const opts = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  const res = await fetch(url, opts);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

export const DEPLOY_TARGETS = [
  { id: "cf-pages", label: "Cloudflare Pages", icon: "☁️", priority: 1, description: "Primary — fast, free, CF integration" },
  { id: "netlify", label: "Netlify", icon: "🔺", priority: 2, description: "Backup — diversify footprint" },
  { id: "vercel", label: "Vercel", icon: "▲", priority: 3, description: "Edge-first deploys with preview support" },
  { id: "cf-workers", label: "CF Workers Sites", icon: "⚡", priority: 4, description: "Edge logic — A/B test, geo-redirect" },
  { id: "s3-cloudfront", label: "S3 + CloudFront", icon: "🪣", priority: 5, description: "AWS — US-focused, low latency" },
  { id: "vps-ssh", label: "VPS (SSH)", icon: "🖥️", priority: 6, description: "Self-managed server, full control" },
  { id: "git-push", label: "Git Push Pipeline", icon: "🧬", priority: 7, description: "Commit artifacts to repo and let CI deploy" },
];

/**
 * Deploy HTML to a specific target.
 * @param {string} target - One of: cf-pages, netlify, cf-workers, s3-cloudfront, vps-ssh
 * @param {string} html - The generated static HTML
 * @param {object} site - Site configuration object
 * @param {object} settings - User settings with API credentials
 * @returns {Promise<{success: boolean, url?: string, deployId?: string, target: string, error?: string}>}
 */
export async function deployTo(target, html, site, settings) {
  const deployer = DEPLOYERS[target];
  if (!deployer) {
    return { success: false, target, error: `Unknown deploy target: ${target}` };
  }

  const startTime = Date.now();

  // Create deployment record in database
  let deployId = null;
  try {
    const deployResult = await apiCall("/api/ops/deployments", {
      method: "POST",
      body: JSON.stringify({
        domainId: site.id,
        domain: site.domain || site.brand || "unknown",
        target,
        environment: "production",
        status: "pending",
        deployedBy: settings.userEmail || "unknown",
      }),
    });
    deployId = deployResult.id;
  } catch (e) {
    console.warn("Failed to create deployment record:", e);
  }

  try {
    // Build content: support three patterns:
    // 1. html is already a files map (object) — use directly (e.g. Sites.jsx git-push)
    // 2. html is a string + site._extraFiles — merge into files map
    // 3. html is a plain string — single-file deploy
    let content;
    if (html && typeof html === "object") {
      content = html;
      console.log(`[Deploy] Files-map deploy:`, Object.keys(content).length, "files");
    } else if (site._extraFiles && Object.keys(site._extraFiles).length > 0) {
      const filesMap = { "index.html": html };
      for (const [path, data] of Object.entries(site._extraFiles)) {
        const cleanPath = path.startsWith("/") ? path.slice(1) : path;
        filesMap[cleanPath] = data;
      }
      content = filesMap;
      console.log(`[Deploy] Multi-file deploy:`, Object.keys(filesMap).length, "files");
    } else {
      content = html;
      console.log(`[Deploy] Single-file deploy: index.html (${(html || "").length} bytes)`);
    }

    const deployPayload = deployId ? { ...site, _deployRecordId: deployId } : site;
    const result = await deployer.deploy(content, deployPayload, settings);
    const finalStatus = result.queued ? "pending" : (result.success ? "success" : "failed");

    // Update deployment record with success
    if (deployId) {
      try {
        await apiCall(`/api/ops/deployments/${deployId}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: finalStatus,
            url: result.url,
            durationMs: Date.now() - startTime,
            errorMessage: result.error,
          }),
        });
      } catch (e) {
        console.warn("Failed to update deployment record:", e);
      }
    }

    // Always save to localStorage for reliable local history
    const deployRecord = {
      id: deployId || `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      domain: site.domain || site.brand || "unknown",
      siteId: site.id,
      target,
      status: finalStatus,
      url: result.url,
      deployId: result.deployId,
      duration: Date.now() - startTime,
      error: result.error,
      dnsUpdated: result.dnsUpdated,
      dnsError: result.dnsError,
    };
    saveDeploymentRecord(deployRecord);

    return { ...result, target };
  } catch (e) {
    // Update deployment record with failure
    if (deployId) {
      try {
        await apiCall(`/api/ops/deployments/${deployId}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "failed",
            errorMessage: e.message,
            durationMs: Date.now() - startTime,
          }),
        });
      } catch (apiError) {
        console.warn("Failed to update deployment record:", apiError);
      }
    }

    // Fallback to localStorage if DB fails
    if (!deployId) {
      saveDeploymentRecord({
        id: `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        domain: site.domain || site.brand || "unknown",
        siteId: site.id,
        target,
        status: "failed",
        error: e.message,
        duration: Date.now() - startTime,
      });
    }

    return { success: false, target, error: `Deploy failed: ${e.message}` };
  }
}

/**
 * Delete a project from a specific target.
 * @param {string} target - One of: cf-pages, netlify, cf-workers, s3-cloudfront, vps-ssh
 * @param {object} site - Site configuration object
 * @param {object} settings - User settings with API credentials
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function deleteProject(target, site, settings) {
  const deployer = DEPLOYERS[target];
  if (!deployer || !deployer.deleteProject) {
    return { success: false, error: `Delete not supported for target: ${target}` };
  }
  
  try {
    return await deployer.deleteProject(site, settings);
  } catch (error) {
    return { success: false, error: `Delete failed: ${error.message}` };
  }
}

/**
 * Check live deploy status for a site on a specific target.
 * @param {string} target - Deploy target id
 * @param {object} site - Site object
 * @param {object} settings - User settings with API credentials
 * @returns {Promise<{success, status, url, platform, error?}>}
 *   status: "live" | "building" | "pending" | "failed" | "unknown" | "no_deploys"
 */
export async function checkDeployStatus(target, site, settings) {
  const deployer = DEPLOYERS[target];
  if (!deployer?.checkDeployStatus) {
    return { success: false, error: `Status check not supported for: ${target}` };
  }
  try {
    return await deployer.checkDeployStatus(site, settings);
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Check which deploy targets have valid credentials configured.
 */
export function getAvailableTargets(settings) {
  return DEPLOY_TARGETS.map(t => ({
    ...t,
    configured: isTargetConfigured(t.id, settings),
  }));
}

function isTargetConfigured(target, settings) {
  switch (target) {
    case "cf-pages":
    case "cf-workers":
      return !!(settings.cfApiToken && settings.cfAccountId);
    case "netlify":
      return !!settings.netlifyToken;
    case "vercel":
      return !!settings.vercelToken;
    case "s3-cloudfront":
      return !!(settings.awsAccessKey && settings.awsSecretKey && settings.s3Bucket);
    case "vps-ssh":
      return !!(settings.vpsHost && settings.vpsUser && settings.vpsPath && (settings.vpsWorkerUrl || settings.workerBaseUrl));
    case "git-push":
      return !!(settings.githubRepoOwner && settings.githubRepoName);
    default:
      return false;
  }
}

/* ═════════════════════════════════════════════════════════════════════
   DEPLOYMENT HISTORY (Database + localStorage fallback)
══════════════════════════════════════════════════════════════════════ */

/**
 * Save a deployment record to history (localStorage fallback)
 * @internal - used only within this module
 */
function saveDeploymentRecord(record) {
  try {
    const history = LS.get(DEPLOY_HISTORY_KEY) || [];
    history.unshift(record);
    // Keep only last 100 records
    if (history.length > 100) {
      history.splice(100);
    }
    LS.set(DEPLOY_HISTORY_KEY, history);
  } catch (e) {
    console.warn("Failed to save deployment record:", e);
  }
}

/**
 * Get deployment history from database
 * @param {string} [domain] - Filter by domain
 * @param {string} [target] - Filter by deploy target
 * @param {string} [status] - Filter by status
 * @param {number} [limit=50] - Max records to return
 */
export async function getDeploymentHistory(domain = null, target = null, status = null, limit = 50) {
  // Always read from localStorage (reliable local source)
  let localHistory = [];
  try {
    localHistory = LS.get(DEPLOY_HISTORY_KEY) || [];
  } catch (e) {
    console.warn("Failed to read localStorage history:", e);
  }

  // Try API as additional source
  let apiHistory = [];
  try {
    const params = new URLSearchParams();
    if (domain) params.set("domain", domain);
    if (target) params.set("target", target);
    if (status) params.set("status", status);
    params.set("limit", limit.toString());
    apiHistory = await apiCall(`/api/ops/deployments?${params.toString()}`) || [];
  } catch (e) {
    // API unavailable, use local only
  }

  // Merge: deduplicate by id, prefer API version
  const seen = new Set();
  const merged = [];
  for (const item of [...apiHistory, ...localHistory]) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  // Apply filters to local data (API already filtered)
  let filtered = merged;
  if (domain) filtered = filtered.filter(h => h.siteId === domain || h.domain === domain);
  if (target) filtered = filtered.filter(h => h.target === target);
  if (status) filtered = filtered.filter(h => h.status === status);

  // Sort by timestamp descending
  filtered.sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0));

  return filtered.slice(0, limit);
}

/**
 * Get deployment statistics computed from history
 */
export async function getDeploymentStats(domain = null) {
  const history = await getDeploymentHistory(domain, null, null, 1000);
  const now = Date.now();
  const dayAgo = now - 86400000;
  const weekAgo = now - 604800000;
  const monthAgo = now - 2592000000;

  const stats = {
    total: history.length,
    successful: history.filter(h => h.status === "success").length,
    failed: history.filter(h => h.status === "failed").length,
    last24h: history.filter(h => new Date(h.timestamp || h.created_at).getTime() > dayAgo).length,
    lastWeek: history.filter(h => new Date(h.timestamp || h.created_at).getTime() > weekAgo).length,
    lastMonth: history.filter(h => new Date(h.timestamp || h.created_at).getTime() > monthAgo).length,
    avgDurationMs: history.length > 0
      ? Math.round(history.reduce((sum, h) => sum + (h.duration || h.durationMs || 0), 0) / history.length)
      : 0,
    byTarget: {},
  };

  DEPLOY_TARGETS.forEach(t => {
    stats.byTarget[t.id] = history.filter(h => h.target === t.id).length;
  });

  stats.successRate = stats.total > 0
    ? Math.round((stats.successful / stats.total) * 100)
    : 0;

  return stats;
}

/**
 * Clear deployment history
 * @internal - used only within this module
 */
function clearDeploymentHistory() {
  try {
    LS.set(DEPLOY_HISTORY_KEY, []);
  } catch (e) {
    console.warn("Failed to clear deployment history:", e);
  }
}

/* ═════════════════════════════════════════════════════════════════════
   DEPLOY CONFIGS (Per-domain settings) - Database + localStorage fallback
══════════════════════════════════════════════════════════════════════ */

/**
 * Save deploy config for a domain+target combination
 */
export async function saveDeployConfig(domainId, target, config) {
  try {
    await apiCall("/api/ops/deploy-configs", {
      method: "POST",
      body: JSON.stringify({
        domainId,
        targetKey: target,
        config,
      }),
    });
  } catch (e) {
    console.warn("Failed to save deploy config to DB, using localStorage:", e);
    // Fallback to localStorage
    try {
      const configs = LS.get(DEPLOY_CONFIGS_KEY) || {};
      const key = `${domainId}-${target}`;
      configs[key] = {
        ...config,
        updatedAt: new Date().toISOString(),
      };
      LS.set(DEPLOY_CONFIGS_KEY, configs);
    } catch (lsError) {
      console.warn("Failed to save deploy config to localStorage:", lsError);
    }
  }
}

/**
 * Get deploy config for a domain+target combination
 */
export async function getDeployConfig(domainId, target) {
  try {
    const params = new URLSearchParams();
    params.set("domainId", domainId);

    const result = await apiCall(`/api/ops/deploy-configs?${params.toString()}`);
    return result?.[target] || null;
  } catch (e) {
    console.warn("Failed to get deploy config from DB, using localStorage:", e);
    // Fallback to localStorage
    try {
      const configs = LS.get(DEPLOY_CONFIGS_KEY) || {};
      const key = `${domainId}-${target}`;
      return configs[key] || null;
    } catch (lsError) {
      console.warn("Failed to get deploy config from localStorage:", lsError);
      return null;
    }
  }
}

/**
 * Get all deploy configs for a domain
 * @internal - used only within this module
 */
async function getAllDeployConfigs(domainId) {
  try {
    const params = new URLSearchParams();
    params.set("domainId", domainId);

    const result = await apiCall(`/api/ops/deploy-configs?${params.toString()}`);
    return Object.entries(result || {}).map(([target, config]) => ({
      target,
      ...config,
    }));
  } catch (e) {
    console.warn("Failed to get all deploy configs from DB, using localStorage:", e);
    // Fallback to localStorage
    try {
      const configs = LS.get(DEPLOY_CONFIGS_KEY) || {};
      const result = [];
      Object.entries(configs).forEach(([key, config]) => {
        const [keyDomainId, keyTarget] = key.split("-");
        if (keyDomainId === domainId) {
          result.push({ target: keyTarget, ...config });
        }
      });
      return result;
    } catch (lsError) {
      console.warn("Failed to get all deploy configs from localStorage:", lsError);
      return [];
    }
  }
}
