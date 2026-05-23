/**
 * GitHub Actions Workflow Status Poller
 * =====================================
 * Polls GitHub Actions API for workflow run status after deploy trigger.
 * Uses the existing PAT with "repo" scope — no additional permissions needed.
 *
 * Usage:
 *   const tracker = createDeployTracker({ githubToken, repo, commitSha });
 *   tracker.onStatus((status) => updateUI(status));
 *   tracker.start();
 *   // later: tracker.stop();
 */

const GITHUB_API = 'https://api.github.com';
const POLL_INTERVAL_MS = 12_000; // 12 seconds
const MAX_POLL_DURATION_MS = 15 * 60_000; // 15 minutes max

/**
 * @typedef {'queued'|'in_progress'|'completed'|'failed'|'cancelled'|'waiting'|'not_found'} DeployPhase
 *
 * @typedef {Object} DeployStatus
 * @property {DeployPhase} phase
 * @property {string}      message     — Human-readable status
 * @property {string|null} runUrl      — Link to the workflow run on GitHub
 * @property {string|null} deployUrl   — Final deploy URL (from run output)
 * @property {number|null} durationSec — Elapsed time since run started
 * @property {string|null} conclusion  — success | failure | cancelled (only when completed)
 * @property {Object|null} steps       — Step-level status for progress detail
 */

/**
 * Fetch workflow runs triggered by a specific commit SHA
 */
async function findWorkflowRun(githubToken, repo, commitSha) {
  if (!githubToken || githubToken.length < 10 || /^\*+$/.test(githubToken)) {
    throw new Error('Invalid GitHub token');
  }

  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const url = `${GITHUB_API}/repos/${repo}/actions/runs?head_sha=${commitSha}&per_page=5`;
  const res = await fetch(url, { headers });

  if (res.status === 429) {
    const reset = res.headers.get('X-RateLimit-Reset');
    throw new Error(`GitHub API rate limited${reset ? `, retry after ${new Date(reset * 1000).toLocaleTimeString()}` : ''}`);
  }

  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status})`);
  }

  const data = await res.json();
  const runs = data.workflow_runs || [];

  // Only return the exact deploy-lp workflow run — never guess
  return runs.find(r =>
    r.name === 'Deploy Landing Page' ||
    r.path === '.github/workflows/deploy-lp.yml'
  ) || null;
}

/**
 * Fetch current status of a workflow run
 */
async function getRunStatus(githubToken, repo, runId) {
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const res = await fetch(`${GITHUB_API}/repos/${repo}/actions/runs/${runId}`, { headers });

  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch job steps for a workflow run (for granular progress)
 */
async function getRunJobs(githubToken, repo, runId) {
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const res = await fetch(`${GITHUB_API}/repos/${repo}/actions/runs/${runId}/jobs`, { headers });

  if (!res.ok) return null;

  const data = await res.json();
  return data.jobs || [];
}

/**
 * Parse job steps into a simplified progress object
 */
function parseSteps(jobs) {
  if (!jobs || jobs.length === 0) return null;

  const job = jobs[0]; // deploy-lp has a single job
  if (!job.steps) return null;

  const steps = job.steps.map(s => ({
    name: s.name,
    status: s.status,           // queued | in_progress | completed
    conclusion: s.conclusion,   // success | failure | skipped | null
  }));

  const total = steps.length;
  const completed = steps.filter(s => s.status === 'completed').length;
  const current = steps.find(s => s.status === 'in_progress');
  const trackingSteps = steps.filter(s => /pixel|tracking/i.test(s.name));
  const trackingFailed = trackingSteps.find(s => s.conclusion === 'failure');
  const trackingOk = trackingSteps.length > 0
    && !trackingFailed
    && trackingSteps.every(s => s.conclusion === 'success' || s.conclusion === 'skipped');

  return {
    steps,
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    currentStep: current?.name || null,
    trackingOk,
    trackingFailedStep: trackingFailed?.name || null,
  };
}

/**
 * Map GitHub run data to our DeployStatus format
 */
function toDeployStatus(run, steps) {
  if (!run) {
    return {
      phase: 'not_found',
      message: 'Workflow run not found yet...',
      runUrl: null,
      deployUrl: null,
      durationSec: null,
      conclusion: null,
      steps: null,
    };
  }

  const startedAt = run.created_at ? new Date(run.created_at) : null;
  const durationSec = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 1000) : null;

  const phaseMap = {
    queued: 'queued',
    waiting: 'waiting',
    in_progress: 'in_progress',
    completed: run.conclusion === 'success' ? 'completed' : 'failed',
  };

  const phase = phaseMap[run.status] || run.status;

  const messageMap = {
    queued: 'Waiting for GitHub runner...',
    waiting: 'Waiting for approval...',
    in_progress: steps?.currentStep
      ? `Running: ${steps.currentStep}`
      : 'Building and deploying...',
    completed: 'Deploy completed successfully!',
    failed: `Deploy failed: ${run.conclusion || 'unknown error'}`,
    cancelled: 'Deploy was cancelled',
  };

  return {
    phase,
    message: messageMap[phase] || `Status: ${run.status}`,
    runUrl: run.html_url || null,
    deployUrl: null, // Will be populated from run logs if needed
    durationSec,
    conclusion: run.conclusion || null,
    steps,
  };
}

/**
 * Create a deploy status tracker that polls GitHub Actions
 *
 * @param {Object} config
 * @param {string} config.githubToken — PAT with repo scope
 * @param {string} config.repo       — "owner/name"
 * @param {string} config.commitSha  — SHA of the deploy commit
 * @returns {{ start: () => void, stop: () => void, onStatus: (cb: (s: DeployStatus) => void) => void }}
 */
export function createDeployTracker({ githubToken, repo, commitSha }) {
  let timerId = null;
  let runId = null;
  let callbacks = [];
  let startTime = null;
  let failureCount = 0;

  const emit = (status) => {
    callbacks.forEach(cb => {
      try { cb(status); } catch (_) { /* listener error is non-fatal */ }
    });
  };

  const poll = async () => {
    try {
      // Step 1: Find the workflow run (may take a few seconds to appear)
      if (!runId) {
        const run = await findWorkflowRun(githubToken, repo, commitSha);
        if (run) {
          runId = run.id;
        } else {
          emit(toDeployStatus(null, null));
          return;
        }
      }

      // Step 2: Get current run status
      const run = await getRunStatus(githubToken, repo, runId);

      // Step 3: Get step-level progress
      const jobs = await getRunJobs(githubToken, repo, runId);
      const steps = parseSteps(jobs);

      failureCount = 0; // Reset on success
      const status = toDeployStatus(run, steps);
      emit(status);

      // Stop polling when workflow is done
      if (run.status === 'completed') {
        stop();
      }

      // Safety: stop after max duration
      if (startTime && Date.now() - startTime > MAX_POLL_DURATION_MS) {
        emit({
          phase: 'failed',
          message: 'Polling timed out after 15 minutes',
          runUrl: run.html_url || null,
          deployUrl: null,
          durationSec: Math.round((Date.now() - startTime) / 1000),
          conclusion: 'timeout',
          steps,
        });
        stop();
      }
    } catch (err) {
      failureCount++;
      const giveUp = failureCount >= 3;
      emit({
        phase: 'failed',
        message: giveUp
          ? `Status check failed ${failureCount} times, stopped polling`
          : `Status check failed: ${err.message} (attempt ${failureCount}/3)`,
        runUrl: null,
        deployUrl: null,
        durationSec: startTime ? Math.round((Date.now() - startTime) / 1000) : null,
        conclusion: 'error',
        steps: null,
      });
      if (giveUp) stop();
    }
  };

  const start = () => {
    startTime = Date.now();
    // Initial poll immediately
    poll();
    // Then poll at interval
    timerId = setInterval(poll, POLL_INTERVAL_MS);
  };

  const stop = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  const onStatus = (cb) => {
    callbacks.push(cb);
  };

  return { start, stop, onStatus };
}

/**
 * One-shot status check (for manual refresh)
 */
export async function checkDeployStatus({ githubToken, repo, commitSha }) {
  const run = await findWorkflowRun(githubToken, repo, commitSha);
  if (!run) return toDeployStatus(null, null);

  const jobs = await getRunJobs(githubToken, repo, run.id);
  const steps = parseSteps(jobs);

  return toDeployStatus(run, steps);
}
