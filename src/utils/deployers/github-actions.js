/**
 * GitHub Actions LP Deployer
 *
 * Pushes deploy-configs/{domain}.json to the repo via GitHub Contents API,
 * then dispatches deploy-lp.yml (Contents API pushes may not trigger push workflows).
 * PAT needs repo scope; workflow dispatch requires actions:write (or classic workflow scope).
 *
 * Field mapping from Wizard → JSON keys is defined inline below (voluumCampaignId → voluumId, etc.).
 * Persistable Wizard keys live in src/constants/site-fields.js (SITE_FIELD_KEYS).
 */

import { ensurePixelSubdomain } from '../../services/cloudflare-dns.js';
import {
  resolvePixelScriptName,
  evaluateDeployTrackingGate,
  trackingRequiredForDomain,
  resolveCfCredentials,
  checkPixelEndpointHealth,
} from './deploy-tracking-gate.js';

const GITHUB_API = 'https://api.github.com';

function isMaskedSecret(v) {
  return typeof v === 'string' && /^\*+$/.test(v.trim());
}

function normalizeHost(v) {
  const raw = String(v || '').trim().toLowerCase();
  if (!raw) return '';
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/^\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/\/+$/, '');
}

function normalizeUrl(v) {
  const raw = String(v || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[a-z0-9.-]+\//i.test(raw) || /^[a-z0-9.-]+$/i.test(raw)) {
    return `https://${raw.replace(/^\/+/, '')}`;
  }
  return raw;
}

/**
 * Push or update a file in the repo via GitHub Contents API
 * Returns commit URL
 */
async function getFileSha(url, branch, headers) {
  const res = await fetch(`${url}?ref=${branch}`, { headers });
  if (!res.ok) return undefined;
  const data = await res.json();
  return data.sha;
}

async function pushFile({ githubToken, repo, branch, path, content, message }) {
  const url = `${GITHUB_API}/repos/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Encode content as base64 (works in both browser and Node)
  const encoded = typeof Buffer !== 'undefined'
    ? Buffer.from(content, 'utf8').toString('base64')
    : btoa(unescape(encodeURIComponent(content)));

  const tryPush = async (sha) => {
    const body = { message, content: encoded, branch, ...(sha ? { sha } : {}) };
    return fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  };

  // Fetch SHA fresh immediately before each push to minimize race window
  // On 409: parse correct SHA from error body (GitHub always includes it),
  // then push immediately without delay to beat other concurrent writes.
  const pushWithFreshSha = async () => {
    const freshSha = await getFileSha(url, branch, headers);
    return { res: await tryPush(freshSha), sha: freshSha };
  };

  let { res } = await pushWithFreshSha();

  for (let attempt = 0; attempt < 5 && res.status === 409; attempt++) {
    // 409 body: "...does not match <sha>" — that hex is the *stale* SHA we sent, not the current blob.
    // Always re-fetch blob SHA from Contents API before retrying.
    await res.text().catch(() => '');
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    ({ res } = await pushWithFreshSha());
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`GitHub push failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const commitSha = data.commit?.sha || null;
  const commitUrl = data.commit?.html_url || `https://github.com/${repo}/commits/${branch}`;
  return { url: commitUrl, sha: commitSha };
}

async function dispatchDeployWorkflow({ githubToken, repo, branch, configFilePath }) {
  const workflowFile = 'deploy-lp.yml';
  const url = `${GITHUB_API}/repos/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ref: branch,
      inputs: { config_file: configFilePath },
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Workflow dispatch failed (${res.status}): ${err.slice(0, 300)}`);
  }
}

/**
 * Main deploy function — called by Wizard UI
 * Pushes site config JSON → triggers deploy-lp.yml via on:push
 * Only needs PAT "repo" scope (same as Git Push Pipeline)
 */
export async function deploy(assets, site, settings) {
  const rawToken  = (settings.githubToken || '').trim();
  const githubToken = isMaskedSecret(rawToken) ? '' : rawToken;
  const repoOwner = (settings.githubRepoOwner || '').trim();
  const repoName  = (settings.githubRepoName  || '').trim();
  const githubRepo = repoOwner && repoName ? `${repoOwner}/${repoName}` : '';
  // Always push deploy config to 'main' — that's where deploy-lp.yml workflow lives
  // (githubRepoBranch is used by git-push for LP source, not for CI config trigger)
  const branch    = 'main';

  if (!githubToken) return { success: false, error: 'Missing GitHub Token. Add it in Settings → Git Push Pipeline.' };
  if (!githubRepo)  return { success: false, error: 'Missing GitHub Repo. Add Repo Owner + Repo Name in Settings.' };

  // Fetch existing deploy config to preserve Voluum fields that were previously set
  // This prevents redeploying from wiping out voluumId/voluumDomain/voluumClickUrl
  const domain = (site.domain || site.brand || 'site').replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
  const filePath = `deploy-configs/${domain}.json`;
  let existing = {};
  try {
    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const res = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${filePath}?ref=${branch}`, { headers });
    if (res.ok) {
      const data = await res.json();
      const decoded = typeof atob !== 'undefined'
        ? atob(data.content.replace(/\n/g, ''))
        : Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
      existing = JSON.parse(decoded);
    }
  } catch (_) { /* new site — no existing config */ }

  const defaultCfPagesProject = `lp-${(site.domain || site.brand || 'site').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}`;
  const cfPagesProject = (site.cfPagesProject || existing.cfPagesProject || defaultCfPagesProject || '').trim();

  // Voluum fields: Wizard saves voluumCampaignId/voluumTrackingDomain — map to deploy config keys
  // Preserve existing values if current deploy doesn't provide them
  const voluumId          = site.voluumCampaignId      || site.voluumId            || existing.voluumId            || '';
  const voluumDomainRaw   = site.voluumTrackingDomain  || site.voluumDomain        || existing.voluumDomain        || '';
  const voluumDomain      = normalizeHost(voluumDomainRaw);
  const voluumClickUrlRaw = site.voluumClickUrl        || existing.voluumClickUrl  || '';
  const voluumClickUrl    = normalizeUrl(voluumClickUrlRaw);
  const voluumCfCname     = site.voluumCfCname        || existing.voluumCfCname     || '';
  const voluumAcmName     = site.voluumAcmName        || existing.voluumAcmName     || '';
  const voluumAcmValue    = site.voluumAcmValue       || existing.voluumAcmValue    || '';
  const voluumLanderScript= site.voluumLanderScript   || existing.voluumLanderScript|| '';
  const conversionId      = site.gtagId || site.conversionId || existing.conversionId || '';
  const formStartLabel    = site.gtagFormStartLabel || site.formStartLabel || existing.gtagFormStartLabel || existing.formStartLabel || '';
  const formSubmitLabel   = site.gtagFormSubmitLabel || site.formSubmitLabel || existing.gtagFormSubmitLabel || existing.formSubmitLabel || '';

  const isVoluumMode = (site.trackingMode || '').toLowerCase() === 'voluum'
    || Boolean(site.voluumCampaignId || site.voluumId || existing.voluumId);
  if (isVoluumMode && (!voluumId || !voluumDomain)) {
    return {
      success: false,
      error: 'Voluum mode requires both Campaign ID and Tracking Domain (vls.yourdomain.com).',
    };
  }

  // Build deploy config — written as JSON file, read by workflow
  const cfZoneId = String(site.cfZoneId || existing.cfZoneId || '').trim().toLowerCase();
  // Default true: staff use Settings → Cloudflare profiles + Wizard DNS; no GitHub CF zone alignment needed.
  // Set skipDnsUpsert: false on the site or in deploy-config only if CI should upsert CNAMEs (secrets must match zone).
  const skipDnsUpsert =
    site.skipDnsUpsert === true || site.skipDnsUpsert === false
      ? site.skipDnsUpsert
      : existing.skipDnsUpsert === true || existing.skipDnsUpsert === false
        ? existing.skipDnsUpsert
        : true;

  const config = {
    templateId:      site.templateId    || 'installment-bear',
    cfPagesProject,
    // Optional: hex zone id from Cloudflare Overview (when GET /zones?name= returns nothing)
    cfZoneId:        /^[a-f0-9]{32}$/.test(cfZoneId) ? cfZoneId : '',
    // If true, deploy-lp.yml skips automatic CNAME upsert (set CNAMEs manually or fix zone later)
    skipDnsUpsert,
    // Security: do not persist CF credentials in deploy-config JSON.
    // Workflow should read CLOUDFLARE_* from GitHub repository secrets.
    cfApiToken:      '',
    cfAccountId:     '',
    brand:           site.brand        || '',
    domain:          site.domain       || '',
    h1:              site.h1           || '',
    sub:             site.sub          || '',
    cta:             site.cta          || 'Apply Now',
    title2:          site.title2       || '',
    phone:           site.phone        || '',
    email:           site.email        || '',
    address:         site.address      || '',
    aid:             site.aid          || '',
    amountMin:       site.amountMin    || 100,
    amountMax:       site.amountMax    || 5000,
    aprMin:          site.aprMin       || 5.99,
    aprMax:          site.aprMax       || 35.99,
    primaryColor:    site.primaryColor || '',
    accentColor:     site.accentColor  || '',
    conversionId,
    gtagFormStartLabel: formStartLabel,
    gtagFormSubmitLabel: formSubmitLabel,
    formStartLabel,
    formSubmitLabel,
    voluumId,
    voluumDomain,
    voluumClickUrl,
    voluumCfCname,
    voluumAcmName,
    voluumAcmValue,
    voluumLanderScript,
    colorId:         site.colorId      || '',
    fontId:          site.fontId       || '',
    layout:          site.layout       || '',
    radius:          site.radius       || '',
    trustBadges:     site.trustBadges  || '',
    reviews:         site.reviews      || [],
    showReviews:     site.showReviews !== false,
    deployedAt:      new Date().toISOString(),
  };

  const commitMsg = `deploy: ${domain} via GitHub Actions (Astro Build)`;

  const siteDomain = String(site.domain || config.domain || '').trim().toLowerCase();
  const { cfAccountId, cfApiToken } = resolveCfCredentials(site, settings);
  let pixelProvisioned = false;
  let pixelError = null;
  let pixelHealthOk = false;
  let pixelHealthError = null;

  if (trackingRequiredForDomain(siteDomain)) {
    if (!cfAccountId || !cfApiToken) {
      return {
        success: false,
        error: 'Deploy blocked — tracking not ready: Cloudflare API Token and Account ID are required in Settings to provision t.{domain} before GitHub Actions deploy.',
      };
    }

    const pixelScriptName = resolvePixelScriptName(settings);
    try {
      const pixelResult = await ensurePixelSubdomain({
        domain: siteDomain,
        cfAccountId,
        cfApiToken,
        pixelScriptName,
      });
      pixelProvisioned = pixelResult.success;
      pixelError = pixelResult.error || null;
    } catch (e) {
      pixelError = e?.message || 'Pixel provisioning failed';
    }

    const health = await checkPixelEndpointHealth(siteDomain);
    pixelHealthOk = health.ok;
    if (!health.ok) {
      pixelHealthError = health.error || `Pixel endpoint returned HTTP ${health.status || 0}`;
    }

    const gate = evaluateDeployTrackingGate({
      domain: siteDomain,
      pixelProvisioned,
      pixelError,
      pixelHealthOk,
      pixelHealthError,
    });

    if (!gate.success) {
      return {
        success: false,
        error: gate.error,
        target: 'github-actions',
        pixelProvisioned,
        pixelError,
        pixelHealthOk: gate.pixelHealthOk,
        pixelHealthError: gate.pixelHealthError,
        trackingError: gate.trackingError,
      };
    }
  }

  try {
    const { url: commitUrl, sha: commitSha } = await pushFile({
      githubToken,
      repo: githubRepo,
      branch,
      path: filePath,
      content: JSON.stringify(config, null, 2),
      message: commitMsg,
    });

    let workflowDispatched = false;
    let workflowDispatchError = null;
    try {
      await dispatchDeployWorkflow({
        githubToken,
        repo: githubRepo,
        branch,
        configFilePath: filePath,
      });
      workflowDispatched = true;
    } catch (e) {
      workflowDispatchError = e?.message || 'Workflow dispatch failed';
    }

    const actionsUrl = `https://github.com/${githubRepo}/actions/workflows/deploy-lp.yml`;
    const dispatchHint = workflowDispatched
      ? 'CI workflow dispatched.'
      : `CI not auto-started (${workflowDispatchError}). Run "Deploy Landing Page" manually in GitHub Actions, or add actions:write to your PAT.`;

    return {
      success: true,
      queued: true,
      url: commitUrl,
      commitSha,
      repo: githubRepo,
      deployId: `gh-actions-${Date.now()}`,
      target: 'github-actions',
      templateId: config.templateId,
      workflowDispatched,
      workflowDispatchError,
      message: `Pushed config (template: ${config.templateId}) → ${dispatchHint} Track: ${actionsUrl}`,
      actionsUrl,
      pixelProvisioned,
      pixelError,
      pixelHealthOk,
      pixelHealthError,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
