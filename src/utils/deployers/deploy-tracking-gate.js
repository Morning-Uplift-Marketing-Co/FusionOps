/**
 * Shared deploy-time tracking gate — fail loudly when t.{domain}/* route or pixel verify breaks.
 * Pixel ingest runs on lp-factory-api (handlePixelTrackingRoute), not the standalone pixel worker.
 */

export const DEFAULT_PIXEL_WORKER_SCRIPT = "lp-factory-api";

export function resolvePixelScriptName(settings = {}) {
  const fromSettings = (
    settings.pixelWorkerScriptName ||
    settings.cfPixelWorkerScriptName ||
    settings.apiWorkerScriptName ||
    ""
  ).trim();
  return fromSettings || DEFAULT_PIXEL_WORKER_SCRIPT;
}

function normalizeDomain(domain) {
  return String(domain || "").trim().toLowerCase();
}

export function trackingRequiredForDomain(domain) {
  const d = normalizeDomain(domain);
  if (!d) return false;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d);
}

function formatVerifyFailure(trackingVerification) {
  if (!trackingVerification) return "Tracking verification did not run";
  if (trackingVerification.error) return String(trackingVerification.error);
  const checks = trackingVerification.checks || {};
  const parts = [];
  if (checks.workerHealth && !checks.workerHealth.ok) {
    parts.push(`Worker health: HTTP ${checks.workerHealth.status || 0}`);
  }
  if (checks.pixelEndpoint && !checks.pixelEndpoint.ok) {
    parts.push(`Pixel endpoint: HTTP ${checks.pixelEndpoint.status || 0}`);
  }
  return parts.length ? parts.join("; ") : "Tracking verification failed";
}

export function pixelHealthFromVerification(trackingVerification) {
  if (!trackingVerification) {
    return { pixelHealthOk: false, pixelHealthError: "Tracking verification did not run" };
  }
  if (trackingVerification.error) {
    return { pixelHealthOk: false, pixelHealthError: String(trackingVerification.error) };
  }
  if (trackingVerification.success === true) {
    return { pixelHealthOk: true, pixelHealthError: null };
  }
  const pixelCheck = trackingVerification.checks?.pixelEndpoint;
  if (pixelCheck && !pixelCheck.ok) {
    return {
      pixelHealthOk: false,
      pixelHealthError: `Pixel endpoint returned HTTP ${pixelCheck.status || 0}. Ensure Workers Route t.{domain}/* → ${DEFAULT_PIXEL_WORKER_SCRIPT} is set.`,
    };
  }
  return { pixelHealthOk: false, pixelHealthError: formatVerifyFailure(trackingVerification) };
}

/**
 * Returns { success, error?, pixelHealthOk, pixelHealthError, trackingError?, skipped? }
 */
export function evaluateDeployTrackingGate({
  domain,
  routeCreated = false,
  routeError = null,
  trackingVerification = null,
  pixelRouteCreated = false,
  pixelProvisioned = false,
  pixelHealthOk = false,
  pixelHealthError = null,
  pixelRouteError = null,
  pixelError = null,
} = {}) {
  if (!trackingRequiredForDomain(domain)) {
    return {
      success: true,
      pixelHealthOk: true,
      pixelHealthError: null,
      trackingError: null,
      skipped: true,
    };
  }

  const d = normalizeDomain(domain);
  // Pixel may already work via wrangler routes even when CF API provision fails (zone/token mismatch).
  const routeOk = Boolean(
    routeCreated || pixelRouteCreated || pixelProvisioned || pixelHealthOk,
  );
  const routeErr = routeError || pixelRouteError || pixelError;

  let health;
  if (trackingVerification != null) {
    health = pixelHealthFromVerification(trackingVerification);
  } else {
    health = {
      pixelHealthOk: Boolean(pixelHealthOk),
      pixelHealthError: pixelHealthOk ? null : (pixelHealthError || `Pixel endpoint at t.${d}/e is not reachable`),
    };
  }

  const verifyOk = trackingVerification != null
    ? !trackingVerification.error && trackingVerification.success === true
    : Boolean(pixelHealthOk);

  const errors = [];
  if (!routeOk) {
    errors.push(
      routeErr || `Workers route t.${d}/* was not created. Add the zone to Cloudflare and retry deploy.`,
    );
  }
  if (!verifyOk) {
    const msg = (health.pixelHealthError || formatVerifyFailure(trackingVerification) || `Pixel tracking at t.${d}/e failed`)
      .replace(/\{domain\}/g, d);
    errors.push(msg);
  }

  if (errors.length) {
    const trackingError = errors.join(" ");
    return {
      success: false,
      error: `Deploy blocked — tracking not ready: ${trackingError}`,
      pixelHealthOk: false,
      pixelHealthError: health.pixelHealthError || errors[errors.length - 1],
      trackingError,
    };
  }

  return {
    success: true,
    pixelHealthOk: health.pixelHealthOk !== false,
    pixelHealthError: null,
    trackingError: null,
  };
}

export function normalizeTrackingVerifyResponse(response) {
  if (!response || typeof response !== "object") {
    return { success: false, error: "Tracking verification returned no data" };
  }
  if (response.error) {
    return { success: false, error: String(response.error), checks: response.checks };
  }
  return response;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** Match Wizard / Ops CF profile + account resolution for deploy-time API calls. */
export function resolveCfCredentials(site = {}, settings = {}) {
  const cfAccounts = asArray(settings.cfAccounts);
  const siteAccountRef = String(site.cfAccountId || site.cf_account_id || "").trim();
  const cfAccountEntry = cfAccounts.find(
    (a) =>
      String(a.id || "") === siteAccountRef
      || String(a.accountId || a.account_id || "") === siteAccountRef,
  );

  const cfProfileId = String(site.cfProfileId || "").trim();
  const cfProfile = asArray(settings.cfProfiles).find((p) => String(p.id || "") === cfProfileId);

  const cfAccountId = String(
    cfAccountEntry?.accountId
    || cfAccountEntry?.account_id
    || cfProfile?.accountId
    || site.cfAccountId
    || site.cf_account_id
    || settings.cfAccountId
    || "",
  ).trim();

  const cfApiToken = String(
    cfAccountEntry?.apiToken
    || cfAccountEntry?.apiKey
    || cfAccountEntry?.api_key
    || cfProfile?.apiToken
    || settings.cfApiToken
    || "",
  ).trim();

  return { cfAccountId, cfApiToken };
}

export async function checkPixelEndpointHealth(domain, { timeoutMs = 8000 } = {}) {
  const d = normalizeDomain(domain);
  if (!d) return { ok: false, error: "Domain is required" };
  try {
    const pixelUrl = `https://t.${d}/e?e=healthcheck&ts=${Date.now()}`;
    const hc = await fetch(pixelUrl, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (hc.status < 400) {
      return { ok: true, status: hc.status };
    }
    return {
      ok: false,
      status: hc.status,
      error: `Pixel endpoint returned HTTP ${hc.status}`,
    };
  } catch (e) {
    return { ok: false, error: e?.message || "Pixel endpoint unreachable" };
  }
}
