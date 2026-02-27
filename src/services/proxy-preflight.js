/**
 * Proxy Pre-flight Orchestrator
 *
 * Links NodeMaven proxy + Pre-flight Checker + Multilogin API
 * into a single launch flow:
 *
 *   1. Get profile proxy config from Multilogin
 *   2. Generate/assign NodeMaven proxy with geo-targeting
 *   3. Resolve actual IP through proxy
 *   4. Run 5-point pre-flight check
 *   5. If failed → rotate IP, update profile, retry (max 3x)
 *   6. If passed → launch profile via Multilogin Launcher
 *
 * Usage:
 *   import { preflightLaunch } from './proxy-preflight.js';
 *   const result = await preflightLaunch(profileId, folderId, { country: 'us', state: 'California' });
 */

import { nodemavenApi } from "./nodemaven.js";
import { proxyChecker } from "./proxy-checker.js";
import { multiloginApi } from "./multilogin.js";

/* ────────────────── Constants ────────────────── */

const MAX_ROTATE_ATTEMPTS = 3;
const MIN_TRUST_SCORE = 70; // Configurable via settings

/* ────────────────── Settings ────────────────── */

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem("lp_settings") || "{}");
  } catch {
    return {};
  }
}

function getMinScore() {
  return getSettings().proxyMinScore || MIN_TRUST_SCORE;
}

function isPreflightEnabled() {
  const s = getSettings();
  // Default ON if NodeMaven credentials exist
  if (s.proxyCheckEnabled === false) return false;
  return !!(s.nmProxyUser && s.nmProxyPassword);
}

/* ────────────────── Event Emitter (for UI updates) ────────────────── */

const listeners = new Map();

function emit(event, data) {
  const fns = listeners.get(event) || [];
  fns.forEach((fn) => {
    try { fn(data); } catch (e) { console.error("[Preflight] listener error:", e); }
  });
}

function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(fn);
  return () => {
    const arr = listeners.get(event) || [];
    listeners.set(event, arr.filter((f) => f !== fn));
  };
}

/* ────────────────── Core: Pre-flight Launch ────────────────── */

/**
 * Launch a Multilogin profile with pre-flight proxy validation.
 *
 * @param {string} profileId    - Multilogin profile ID
 * @param {string} folderId     - Multilogin folder ID
 * @param {object} opts
 * @param {string} opts.country - Expected billing country (ISO 2-letter)
 * @param {string} [opts.state] - Expected billing state (for US accounts)
 * @param {string} [opts.city]  - Target city for proxy
 * @param {string} [opts.filter]- NodeMaven IP quality filter level
 * @param {boolean} [opts.skipCheck] - Skip pre-flight (launch directly)
 * @returns {object} { success, score, ip, attempts, profileId, launchResult }
 */
async function preflightLaunch(profileId, folderId, opts = {}) {
  const startTime = Date.now();
  const result = {
    success: false,
    profileId,
    folderId,
    score: 0,
    verdict: "",
    ip: "",
    attempts: 0,
    checks: [],
    launchResult: null,
    error: null,
    elapsed: 0,
  };

  try {
    // ─── Gate: Check if pre-flight is enabled ───
    if (!isPreflightEnabled() || opts.skipCheck) {
      emit("status", { step: "skip", message: "Pre-flight disabled — launching directly" });
      result.launchResult = await multiloginApi.startProfile(profileId, folderId);
      result.success = !result.launchResult?.error;
      result.verdict = "SKIPPED";
      result.elapsed = Date.now() - startTime;
      emit("complete", result);
      return result;
    }

    emit("status", { step: "start", message: "Starting pre-flight check..." });

    // ─── Step 1: Check Launcher is running ───
    emit("status", { step: "launcher", message: "Checking Multilogin Launcher..." });
    const launcherCheck = await multiloginApi.checkLauncher();
    if (launcherCheck.error) {
      result.error = "Multilogin Launcher is not running. Please start it first.";
      emit("error", result);
      return result;
    }

    // ─── Step 2: Generate initial proxy config ───
    let proxyConfig = nodemavenApi.getProxyConfig({
      profileId,
      country: opts.country || "us",
      region: opts.state,
      city: opts.city,
      filter: opts.filter || "medium",
    });

    if (proxyConfig.error) {
      result.error = proxyConfig.error;
      emit("error", result);
      return result;
    }

    // ─── Step 3: Update profile with new proxy ───
    emit("status", { step: "assign", message: "Assigning proxy to profile..." });
    const mlxProxy = nodemavenApi.toMultiloginFormat(proxyConfig);
    const updateResult = await multiloginApi.updateProfile({
      id: profileId,
      network: {
        proxy: mlxProxy,
      },
    });

    if (updateResult?.error) {
      // Non-fatal: proxy might already be set, continue with check
      console.warn("[Preflight] Profile update warning:", updateResult.error);
    }

    // ─── Step 4: Check loop (with rotation) ───
    const minScore = getMinScore();

    for (let attempt = 1; attempt <= MAX_ROTATE_ATTEMPTS; attempt++) {
      result.attempts = attempt;

      emit("status", {
        step: "check",
        attempt,
        maxAttempts: MAX_ROTATE_ATTEMPTS,
        message: `Running pre-flight check (attempt ${attempt}/${MAX_ROTATE_ATTEMPTS})...`,
      });

      // 4a. Resolve IP
      emit("check", { name: "Resolving IP", status: "running" });
      const ipResult = await nodemavenApi.resolveIP(proxyConfig);

      if (ipResult.error) {
        emit("check", { name: "Resolving IP", status: "fail", detail: ipResult.error });

        if (attempt < MAX_ROTATE_ATTEMPTS) {
          proxyConfig = await rotateAndUpdate(profileId, opts);
          if (proxyConfig.error) {
            result.error = proxyConfig.error;
            break;
          }
          continue;
        }
        result.error = `Could not resolve proxy IP after ${attempt} attempts: ${ipResult.error}`;
        break;
      }

      const ip = ipResult.ip || ipResult.query;
      result.ip = ip;
      emit("check", { name: "Resolving IP", status: "pass", detail: ip });

      // 4b. Run 5-point check
      const checkResult = await proxyChecker.runPreflightCheck(ip, proxyConfig, {
        country: opts.country || "us",
        state: opts.state,
      });

      result.score = checkResult.score;
      result.verdict = checkResult.verdict;
      result.checks = checkResult.checks;

      // Emit each check result for UI
      checkResult.checks.forEach((check) => {
        emit("check", {
          name: check.name,
          status: check.pass ? "pass" : check.penalty < 20 ? "warn" : "fail",
          detail: check.issues.join("; ") || "Clean",
          penalty: check.penalty,
        });
      });

      emit("score", { score: checkResult.score, verdict: checkResult.verdict });

      // 4c. Check if passed
      if (checkResult.score >= minScore) {
        emit("status", { step: "passed", message: `Pre-flight passed! Score: ${checkResult.score}/100` });
        break;
      }

      // 4d. Failed — rotate if attempts remain
      if (attempt < MAX_ROTATE_ATTEMPTS) {
        emit("status", {
          step: "rotate",
          attempt,
          message: `Score ${checkResult.score} < ${minScore} — rotating IP (${attempt}/${MAX_ROTATE_ATTEMPTS})...`,
        });

        proxyConfig = await rotateAndUpdate(profileId, opts);
        if (proxyConfig.error) {
          result.error = proxyConfig.error;
          break;
        }
      } else {
        result.error = `Pre-flight failed after ${MAX_ROTATE_ATTEMPTS} attempts. Best score: ${checkResult.score}`;
        emit("status", { step: "blocked", message: result.error });
      }
    }

    // ─── Step 5: Launch if passed ───
    if (result.score >= minScore && !result.error) {
      emit("status", { step: "launch", message: "Launching profile..." });
      result.launchResult = await multiloginApi.startProfile(profileId, folderId);

      if (result.launchResult?.error) {
        result.error = `Launch failed: ${result.launchResult.error}`;
        emit("error", result);
      } else {
        result.success = true;
        emit("status", { step: "launched", message: "Profile launched successfully! 🚀" });
      }
    }
  } catch (e) {
    result.error = `Unexpected error: ${e.message}`;
    emit("error", result);
  }

  result.elapsed = Date.now() - startTime;
  emit("complete", result);

  // Log to history
  saveCheckHistory(result);

  return result;
}

/* ────────────────── Helper: Rotate & Update Profile ────────────────── */

async function rotateAndUpdate(profileId, opts) {
  const newConfig = nodemavenApi.rotateProxy({
    profileId,
    country: opts.country || "us",
    region: opts.state,
    city: opts.city,
    filter: opts.filter || "medium",
  });

  if (newConfig.error) return newConfig;

  // Update Multilogin profile with new proxy
  const mlxProxy = nodemavenApi.toMultiloginFormat(newConfig);
  await multiloginApi.updateProfile({
    id: profileId,
    network: {
      proxy: mlxProxy,
    },
  });

  return newConfig;
}

/* ────────────────── Quick Launch (no pre-flight) ────────────────── */

/**
 * Launch a profile directly without pre-flight.
 * Just assigns NodeMaven proxy and launches.
 */
async function quickLaunch(profileId, folderId, opts = {}) {
  return preflightLaunch(profileId, folderId, { ...opts, skipCheck: true });
}

/* ────────────────── Check Only (no launch) ────────────────── */

/**
 * Run pre-flight check only — don't launch the profile.
 * Useful for manual proxy quality inspection.
 */
async function checkOnly(profileId, opts = {}) {
  const proxyConfig = nodemavenApi.getProxyConfig({
    profileId,
    country: opts.country || "us",
    region: opts.state,
    city: opts.city,
    filter: opts.filter || "medium",
  });

  if (proxyConfig.error) return { error: proxyConfig.error };

  const ipResult = await nodemavenApi.resolveIP(proxyConfig);
  if (ipResult.error) return { error: ipResult.error };

  const ip = ipResult.ip || ipResult.query;
  return proxyChecker.runPreflightCheck(ip, proxyConfig, {
    country: opts.country || "us",
    state: opts.state,
  });
}

/* ────────────────── Check History (localStorage) ────────────────── */

const HISTORY_KEY = "proxy_check_history";
const MAX_HISTORY = 50;

function saveCheckHistory(result) {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    history.unshift({
      profileId: result.profileId,
      ip: result.ip,
      score: result.score,
      verdict: result.verdict,
      attempts: result.attempts,
      success: result.success,
      elapsed: result.elapsed,
      error: result.error,
      timestamp: new Date().toISOString(),
    });
    // Keep only last N entries
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch (e) {
    console.warn("[Preflight] Failed to save history:", e);
  }
}

function getCheckHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function clearCheckHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

/* ────────────────── Public API ────────────────── */

export const proxyPreflight = {
  // Main flows
  preflightLaunch,
  quickLaunch,
  checkOnly,

  // Events (for UI binding)
  on,
  emit,

  // History
  getCheckHistory,
  clearCheckHistory,

  // Config
  isPreflightEnabled,
  getMinScore,
  MAX_ROTATE_ATTEMPTS,
};
