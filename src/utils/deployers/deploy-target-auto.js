/**
 * Auto Deploy Target Distributor
 * ===============================
 * Deterministically assigns each site to a different hosting platform
 * based on site.id hash — distributing the footprint across CF Pages,
 * Netlify, Vercel, etc. so Google can't correlate sites by ASN/hosting.
 *
 * Only assigns to targets that have credentials configured.
 * Falls back to the first configured target if none match.
 *
 * Usage:
 *   import { autoAssignDeployTarget } from './deploy-target-auto.js';
 *   const target = autoAssignDeployTarget(site, settings);
 */

import { hash53 } from '../deterministic-hash.js';

/**
 * Distribution weights — how likely each target gets picked.
 * Must sum to 100. Adjust based on your account quotas.
 */
const DISTRIBUTION_WEIGHTS = [
  { id: 'cf-pages',   weight: 40 },
  { id: 'netlify',    weight: 25 },
  { id: 'vercel',     weight: 20 },
  { id: 'github-actions', weight: 15 },
];

/**
 * Deterministic hash of site.id → number 0-99
 */
function siteHash(siteId) {
  return hash53(String(siteId || 'default')) % 100;
}

/**
 * Check if a target has credentials configured.
 * Mirrors the logic from deployers/index.js isTargetConfigured().
 */
function isConfigured(target, settings) {
  switch (target) {
    case 'cf-pages':
    case 'cf-workers':
      return !!(settings.cfApiToken && settings.cfAccountId);
    case 'netlify':
      return !!settings.netlifyToken;
    case 'vercel':
      return !!settings.vercelToken;
    case 'github-actions':
      return !!(settings.githubToken && settings.githubRepoOwner && settings.githubRepoName);
    default:
      return false;
  }
}

/**
 * Auto-assign a deploy target based on site.id hash.
 *
 * @param {object} site - Site object with at least .id
 * @param {object} settings - User settings with credentials
 * @param {object} [options]
 * @param {boolean} [options.respectExisting=true] - If site.deployTarget is set, honor it
 * @param {string[]} [options.prefer] - Preferred targets (tried first)
 * @returns {{ target: string, auto: boolean, reason: string }}
 */
export function autoAssignDeployTarget(site, settings, options = {}) {
  const { respectExisting = true, prefer = [] } = options;

  // 1. Honor explicit deployTarget from site config
  if (respectExisting && site.deployTarget) {
    return {
      target: site.deployTarget,
      auto: false,
      reason: `Explicit deployTarget: ${site.deployTarget}`,
    };
  }

  // 2. Honor preference list if configured
  for (const pref of prefer) {
    if (isConfigured(pref, settings)) {
      return {
        target: pref,
        auto: true,
        reason: `Preferred target: ${pref}`,
      };
    }
  }

  // 3. Hash-based distribution among configured targets
  const configured = DISTRIBUTION_WEIGHTS.filter(w => isConfigured(w.id, settings));

  if (configured.length === 0) {
    return {
      target: 'github-actions',
      auto: true,
      reason: 'No targets configured — defaulting to github-actions',
    };
  }

  if (configured.length === 1) {
    return {
      target: configured[0].id,
      auto: true,
      reason: `Only configured target: ${configured[0].id}`,
    };
  }

  // Build cumulative weight ranges from configured targets
  const totalWeight = configured.reduce((sum, w) => sum + w.weight, 0);
  const normalized = configured.map(w => ({
    id: w.id,
    threshold: 0,
    weight: (w.weight / totalWeight) * 100,
  }));

  // Compute cumulative thresholds
  let cumulative = 0;
  for (const entry of normalized) {
    cumulative += entry.weight;
    entry.threshold = cumulative;
  }

  // Use site hash to pick target
  const hash = siteHash(site.id);
  for (const entry of normalized) {
    if (hash < entry.threshold) {
      return {
        target: entry.id,
        auto: true,
        reason: `Auto-assigned via hash distribution (${hash}/${100} → ${entry.id})`,
      };
    }
  }

  // Fallback (shouldn't reach here)
  return {
    target: configured[0].id,
    auto: true,
    reason: `Fallback: ${configured[0].id}`,
  };
}

/**
 * Get a summary of how sites would be distributed across targets.
 * Useful for debugging / UI display.
 *
 * @param {object[]} sites - Array of site objects
 * @param {object} settings - User settings
 * @returns {Record<string, { count: number, domains: string[] }>}
 */
export function getDistributionSummary(sites, settings) {
  const summary = {};
  for (const site of sites) {
    const { target } = autoAssignDeployTarget(site, settings);
    if (!summary[target]) {
      summary[target] = { count: 0, domains: [] };
    }
    summary[target].count++;
    if (site.domain) {
      summary[target].domains.push(site.domain);
    }
  }
  return summary;
}
