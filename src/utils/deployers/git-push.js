/**
 * Git Push deployer
 * Queues a deploy by committing generated artifacts into a GitHub repository.
 * For Astro projects, sends all project files. For HTML templates, sends index.html.
 */

const WORKER_BASE = "https://lp-factory-api.songsawat-w.workers.dev";

export async function deploy(content, site, settings) {
  // If content is an object with multiple files (Astro project), use it directly
  // If content is a string (HTML), wrap it as index.html
  let files;

  if (typeof content === "string") {
    files = { "index.html": content };
  } else if (content && typeof content === "object") {
    // Already a files map (from Astro project generator or multi-file deploy)
    // Astro source projects don't have index.html — GitHub Actions builds it
    files = content;
  } else {
    throw new Error("Invalid deploy content for git-push target");
  }

  const rawGithubToken = String(settings.githubToken || "").trim();
  const githubToken = isMaskedSecret(rawGithubToken) ? "" : rawGithubToken;
  const payload = {
    siteId: site.id,
    domainId: site.id,
    deployRecordId: site._deployRecordId || "",
    domain: site.domain || site.brand || "unknown",
    brand: site.brand || "",
    templateId: site.templateId || "classic",
    environment: site.environment || "production",
    target: "git-push",
    requestedBy: settings.userEmail || "unknown",
    files,
    githubToken,
    repoOwner: settings.githubRepoOwner || "",
    repoName: settings.githubRepoName || "",
    branch: settings.githubRepoBranch || "deploy/auto",
    workflowFile: settings.githubDeployWorkflow || "deploy-sites.yml",
    netlifyTarget: settings.netlifyTarget || "",
    cfPagesTarget: settings.cfPagesTarget || "",
  };

  if (!settings.githubRepoOwner || !settings.githubRepoName) {
    throw new Error("Git push deploy not configured: set GitHub owner/repo in Settings.");
  }

  const res = await fetch(`${WORKER_BASE}/api/ops/deployments/git-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Git push API error: ${res.status}`);
  }

  return {
    success: !!data.success,
    queued: !!data.queued,
    url: data.url || data.commitUrl || data.workflowUrl || "",
    deployId: data.deployId,
    message: data.message,
    workflowUrl: data.workflowUrl,
    commitUrl: data.commitUrl,
    branch: data.branch,
  };
}

/**
 * Check deploy status by querying the latest GitHub Actions workflow run
 * on the deploy/auto branch.
 */
export async function checkDeployStatus(site, settings) {
  const owner = settings.githubRepoOwner;
  const repo = settings.githubRepoName;
  const rawToken = String(settings.githubToken || "").trim();
  const token = isMaskedSecret(rawToken) ? "" : rawToken;
  const workflowFile = settings.githubDeployWorkflow || "deploy-sites.yml";

  if (!owner || !repo || !token) {
    return { success: false, error: "GitHub not configured (owner/repo/token)" };
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?branch=deploy/auto&per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) {
    return { success: false, error: `GitHub API ${res.status}` };
  }

  const data = await res.json();
  const run = data.workflow_runs?.[0];

  if (!run) {
    return { success: true, status: "no_deploys", platform: "github-actions" };
  }

  const statusMap = {
    completed: run.conclusion === "success" ? "live" : "failed",
    in_progress: "building",
    queued: "pending",
    requested: "pending",
    waiting: "pending",
  };

  return {
    success: true,
    status: statusMap[run.status] || "unknown",
    url: run.html_url,
    platform: "github-actions",
    conclusion: run.conclusion,
    runId: run.id,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  };
}

function isMaskedSecret(value) {
  return /^[•*]+$/.test(String(value || "").trim());
}
