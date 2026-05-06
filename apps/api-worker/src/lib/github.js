// ============================================================
// GitHub API helpers for FusionOps API Worker
// ============================================================
// Wraps GitHub REST v3 with authenticated fetch, file SHA lookup,
// content upsert (atomic via fetch-then-PUT), and branch creation.
//
// Used by deploy manifest write paths (deploy-lp.yml dispatch).
//
// Extracted from worker.js (Phase 1: utility extraction).
// ============================================================

import { toBase64 } from './http.js';

export async function githubFetch(url, options = {}, GITHUB_TOKEN) {
  const mergedHeaders = new Headers(options.headers || {});
  mergedHeaders.set('Authorization', `Bearer ${GITHUB_TOKEN}`);
  mergedHeaders.set('Content-Type', 'application/json');
  mergedHeaders.set('User-Agent', 'FusionOps-LP-Factory');
  mergedHeaders.set('Accept', 'application/vnd.github+json');
  mergedHeaders.set('X-GitHub-Api-Version', '2022-11-28');

  const reqOptions = {
    ...options,
    headers: mergedHeaders,
  };

  const res = await fetch(url, reqOptions);

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const method = String(reqOptions.method || 'GET').toUpperCase();
    const bodySnippet = detail ? detail.slice(0, 1000) : res.statusText;
    const error = new Error(`GitHub API ${res.status} ${method} ${url}: ${bodySnippet}`);
    error.status = res.status;
    throw error;
  }

  return res;
}

export async function githubApi(token, path, options = {}) {
  const res = await githubFetch(`https://api.github.com${path}`, options, token);

  if (res.status === 204) return null;
  return res.json();
}

export async function getGithubFileSha(token, owner, repo, path, branch) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  try {
    const data = await githubApi(token, `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`);
    return data?.sha || null;
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}

export async function upsertGithubFile({ token, owner, repo, branch, filePath, content, message }) {
  const sha = await getGithubFileSha(token, owner, repo, filePath, branch);
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const payload = {
    message,
    content: toBase64(content),
    branch,
  };
  if (sha) payload.sha = sha;

  const data = await githubApi(token, `/repos/${owner}/${repo}/contents/${encodedPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  return data?.content?.sha || null;
}

export async function ensureGithubBranch(token, owner, repo, branchName, sourceBranch) {
  try {
    await githubApi(token, `/repos/${owner}/${repo}/git/ref/${encodeURIComponent(`heads/${branchName}`)}`);
    return;
  } catch (e) {
    if (e?.status !== 404) throw e;
  }
  const sourceRef = await githubApi(token, `/repos/${owner}/${repo}/git/ref/${encodeURIComponent(`heads/${sourceBranch}`)}`);
  const sha = sourceRef?.object?.sha;
  if (!sha) throw new Error(`Cannot resolve source branch ${sourceBranch}`);
  await githubApi(token, `/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
}
