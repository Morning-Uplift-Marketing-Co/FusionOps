// ============================================================
// Tracking verification for FusionOps API Worker
// ============================================================
// POST /api/automation/tracking/verify
//   Validates that a deployed LP's tracking pipe is reachable:
//     - Worker /__health endpoint (if workerUrl provided)
//     - First-party pixel endpoint at https://t.{domain}/e
//
// Used by deploy verification flows after a new LP goes live.
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json } from '../../lib/http.js';

export async function handleTrackingVerifyRoute({ request, path, method }) {
  if (path !== '/api/automation/tracking/verify' || method !== 'POST') return null;

  const body = await request.json();
  const domain = String(body?.domain || '').trim().toLowerCase();
  const workerUrl = String(body?.workerUrl || '').trim();
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return json({ error: 'Valid domain is required' }, 400);
  }

  const checks = {};
  let allPassed = true;

  if (workerUrl) {
    try {
      const healthUrl = `${workerUrl.replace(/\/+$/, '')}/__health`;
      const healthRes = await fetch(healthUrl, { method: 'GET' });
      const bodyText = await healthRes.text().catch(() => '');
      checks.workerHealth = {
        ok: healthRes.ok,
        status: healthRes.status,
        url: healthUrl,
        body: bodyText.slice(0, 120),
      };
      if (!healthRes.ok) allPassed = false;
    } catch (e) {
      checks.workerHealth = {
        ok: false,
        status: 0,
        url: workerUrl,
        error: e?.message || 'worker health request failed',
      };
      allPassed = false;
    }
  }

  const pixelUrl = `https://t.${domain}/e`;
  try {
    const payload = {
      e: 'deploy_verify',
      d: domain,
      ts: Date.now(),
      source: 'automation-tracking-verify',
    };
    const pixelRes = await fetch(pixelUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const pixelBody = await pixelRes.text().catch(() => '');
    checks.pixelEndpoint = {
      ok: pixelRes.ok,
      status: pixelRes.status,
      url: pixelUrl,
      body: pixelBody.slice(0, 120),
    };
    if (!pixelRes.ok) allPassed = false;
  } catch (e) {
    checks.pixelEndpoint = {
      ok: false,
      status: 0,
      url: pixelUrl,
      error: e?.message || 'pixel endpoint request failed',
    };
    allPassed = false;
  }

  return json({
    success: allPassed,
    checks,
    verifiedAt: new Date().toISOString(),
  });
}
