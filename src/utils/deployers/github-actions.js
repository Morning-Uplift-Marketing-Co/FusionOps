/**
 * GitHub Actions LP Deployer
 *
 * Pushes deploy-configs/{domain}.json to the repo via GitHub Contents API.
 * This triggers .github/workflows/deploy-lp.yml (on: push: paths: deploy-configs/**.json)
 * which runs Astro build + CF Pages deploy via CI.
 *
 * Only needs PAT with "repo" scope — NO "workflow" scope required.
 */

const GITHUB_API = 'https://api.github.com';

function isMaskedSecret(v) {
  return typeof v === 'string' && /^\*+$/.test(v.trim());
}

/**
 * Push or update a file in the repo via GitHub Contents API
 * Returns commit URL
 */
async function pushFile({ githubToken, repo, branch, path, content, message }) {
  const url = `${GITHUB_API}/repos/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Check if file exists to get its SHA (required for update)
  let sha;
  const existing = await fetch(`${url}?ref=${branch}`, { headers });
  if (existing.ok) {
    const data = await existing.json();
    sha = data.sha;
  }

  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))), // base64 encode UTF-8
    branch,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`GitHub push failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.commit?.html_url || `https://github.com/${repo}/commits/${branch}`;
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
  const cfPagesProject = `lp-${(site.domain || site.brand || 'site').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}`;

  if (!githubToken) return { success: false, error: 'Missing GitHub Token. Add it in Settings → Git Push Pipeline.' };
  if (!githubRepo)  return { success: false, error: 'Missing GitHub Repo. Add Repo Owner + Repo Name in Settings.' };

  // Build deploy config — written as JSON file, read by workflow
  const config = {
    templateId:      site.templateId    || 'installment-bear',
    cfPagesProject,
    cfApiToken:      (settings.cfApiToken  || '').trim(),
    cfAccountId:     (settings.cfAccountId || '').trim(),
    brand:           site.brand        || '',
    domain:          site.domain       || '',
    h1:              site.h1           || '',
    sub:             site.sub          || '',
    cta:             site.cta          || 'Apply Now',
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
    conversionId:    site.conversionId || '',
    voluumDomain:    site.voluumDomain || '',
    deployedAt:      new Date().toISOString(),
  };

  const domain = (site.domain || site.brand || 'site').replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
  const filePath = `deploy-configs/${domain}.json`;
  const commitMsg = `deploy: ${domain} via GitHub Actions (Astro Build)`;

  try {
    const commitUrl = await pushFile({
      githubToken,
      repo: githubRepo,
      branch,
      path: filePath,
      content: JSON.stringify(config, null, 2),
      message: commitMsg,
    });

    return {
      success: true,
      queued: true,
      url: commitUrl,
      deployId: `gh-actions-${Date.now()}`,
      target: 'github-actions',
      message: `Pushed config → GitHub Actions building Astro. Track: https://github.com/${githubRepo}/actions`,
      actionsUrl: `https://github.com/${githubRepo}/actions`,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
