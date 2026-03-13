/**
 * Profile Linker — Link Multilogin Profile + LendingCard + Proxy
 *
 * Anti Google Ads detection: ensures each account has unique,
 * validated Profile + Card + Proxy with consistent geo/timezone.
 *
 * Core flows:
 *   linkProfileCardProxy()  — Create a link with validated proxy
 *   unlinkProfile()         — Remove link + clear proxy
 *   prelaunchCheck()        — Validate proxy before opening profile
 *   rotateProxy()           — Rotate IP, keep geo locked
 *   validateLink()          — Check for conflicts before linking
 */

import { query, execute } from "./d1";
import { multiloginApi } from "./multilogin";
import { proxyProviders } from "./proxy-providers";
import { ipQualityPipeline } from "./ip-quality-pipeline";
import { leadingCardsApi } from "./leadingCards";

/* ────────────────── Helpers ────────────────── */

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

/* ────────────────── Validate Link (Conflict Check) ────────────────── */

/**
 * Check for conflicts before creating a link.
 *
 * Rules:
 *   1. Card must not be linked to another profile
 *   2. Profile must not be linked to another card
 *   3. Proxy IP must not be shared across profiles
 *
 * @param {object} opts
 * @param {string} opts.profileId - ops_profiles.id
 * @param {string} opts.cardUuid - LendingCard UUID
 * @param {string} [opts.excludeAccountId] - Exclude this account from conflict check (for updates)
 * @returns {object} { valid, conflicts[] }
 */
export async function validateLink({ profileId, cardUuid, excludeAccountId }) {
  const conflicts = [];

  // Check 1: Card already linked to another profile
  if (cardUuid) {
    const cardCheck = await query(
      "SELECT id, label, profile_id FROM ops_accounts WHERE card_uuid = ? AND status = 'active'",
      [cardUuid]
    );
    if (cardCheck.success && cardCheck.results.length > 0) {
      const existing = cardCheck.results[0];
      if (existing.id !== excludeAccountId) {
        conflicts.push({
          type: "card_duplicate",
          severity: "error",
          message: `Card already linked to account "${existing.label}" (${existing.id})`,
          existingAccountId: existing.id,
        });
      }
    }
  }

  // Check 2: Profile already linked to another card
  if (profileId) {
    const profileCheck = await query(
      "SELECT id, label, card_uuid FROM ops_accounts WHERE profile_id = ? AND status = 'active'",
      [profileId]
    );
    if (profileCheck.success && profileCheck.results.length > 0) {
      const existing = profileCheck.results[0];
      if (existing.id !== excludeAccountId) {
        conflicts.push({
          type: "profile_duplicate",
          severity: "error",
          message: `Profile already linked to account "${existing.label}" (card: ${existing.card_uuid?.slice(0, 8)}...)`,
          existingAccountId: existing.id,
        });
      }
    }
  }

  return {
    valid: conflicts.filter(c => c.severity === "error").length === 0,
    conflicts,
  };
}

/* ────────────────── Check IP Uniqueness ────────────────── */

async function checkIPUniqueness(ip, excludeProfileId) {
  if (!ip) return { unique: true };

  const check = await query(
    "SELECT id, name FROM ops_profiles WHERE last_ip = ? AND id != ?",
    [ip, excludeProfileId || ""]
  );

  if (check.success && check.results.length > 0) {
    return {
      unique: false,
      conflictProfile: check.results[0],
    };
  }
  return { unique: true };
}

/* ────────────────── Get Billing Geo ────────────────── */

/**
 * Resolve geo from Card's billing address via LendingCard API.
 */
async function resolveCardGeo(cardUuid) {
  try {
    const card = await leadingCardsApi.getCardDetail(cardUuid);
    if (card && card.billing_address) {
      const ba = card.billing_address;
      return {
        country: (ba.country || "TH").toUpperCase(),
        state: ba.state || ba.region || "",
        city: ba.city || "",
      };
    }
  } catch {
    // Fallback: try billing addresses list
    try {
      const addresses = await leadingCardsApi.getBillingAddresses();
      if (addresses && addresses.results && addresses.results.length > 0) {
        const addr = addresses.results[0];
        return {
          country: (addr.country || "TH").toUpperCase(),
          state: addr.state || addr.region || "",
          city: addr.city || "",
        };
      }
    } catch { /* ignore */ }
  }

  // Default: Thailand
  return { country: "TH", state: "", city: "" };
}

/* ────────────────── Link Profile + Card + Proxy ────────────────── */

/**
 * Create a link between Profile, Card, and Proxy.
 *
 * @param {object} opts
 * @param {string} opts.accountId - ops_accounts.id (existing) or auto-generate
 * @param {string} opts.profileId - ops_profiles.id
 * @param {string} opts.cardUuid - LendingCard UUID
 * @param {object} [opts.geo] - { country, state, city } (auto-resolved from card if omitted)
 * @param {string} [opts.provider] - provider ID (auto-fallback if omitted)
 * @param {string} [opts.label] - Account label
 * @returns {object} { success, accountId, proxyConfig, qualityResult, error }
 */
export async function linkProfileCardProxy(opts) {
  const { profileId, cardUuid, label } = opts;
  const accountId = opts.accountId || uid();

  // Step 1: Validate (no conflicts)
  const validation = await validateLink({
    profileId,
    cardUuid,
    excludeAccountId: accountId,
  });

  if (!validation.valid) {
    return {
      success: false,
      error: "Conflicts detected",
      conflicts: validation.conflicts,
    };
  }

  // Step 2: Resolve geo from card billing
  const geo = opts.geo || await resolveCardGeo(cardUuid);

  // Step 3: Get approved proxy (with fallback)
  const proxyConfig = proxyProviders.getProxyConfigWithFallback({
    profileId,
    geo,
    providers: opts.provider ? [opts.provider] : undefined,
  });

  if (proxyConfig.error) {
    return { success: false, error: proxyConfig.error };
  }

  // Step 4: Resolve actual IP and run quality pipeline
  let resolvedIp = "";
  let qualityResult = null;

  try {
    // Use the proxy to resolve its actual IP
    const settings = JSON.parse(localStorage.getItem("lp_settings") || "{}");
    const apiBase = settings.apiBase || "";
    const workerBase = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;

    const ipRes = await fetch(`${workerBase}/api/proxy/resolve-ip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: proxyConfig.host,
        port: proxyConfig.port,
        username: proxyConfig.username,
        password: proxyConfig.password,
        protocol: proxyConfig.protocol,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (ipRes.ok) {
      const ipData = await ipRes.json();
      resolvedIp = ipData.ip || ipData.query || "";
    }
  } catch {
    // IP resolution optional — continue with proxy config
  }

  // Run quality pipeline if IP resolved
  if (resolvedIp) {
    qualityResult = await ipQualityPipeline.runQualityPipeline(resolvedIp, geo);

    if (qualityResult.verdict === "REJECT") {
      // Try rotating up to 2 more times
      for (let retry = 0; retry < 2; retry++) {
        const newConfig = proxyProviders.getProxyConfigWithFallback({
          profileId,
          geo,
          sessionId: proxyProviders.generateSessionId(profileId), // force new session
        });

        if (newConfig.error) break;

        // Re-resolve IP
        try {
          const settings = JSON.parse(localStorage.getItem("lp_settings") || "{}");
          const apiBase = settings.apiBase || "";
          const workerBase = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;

          const ipRes = await fetch(`${workerBase}/api/proxy/resolve-ip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              host: newConfig.host,
              port: newConfig.port,
              username: newConfig.username,
              password: newConfig.password,
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (ipRes.ok) {
            const ipData = await ipRes.json();
            resolvedIp = ipData.ip || ipData.query || "";
          }
        } catch { continue; }

        if (resolvedIp) {
          qualityResult = await ipQualityPipeline.runQualityPipeline(resolvedIp, geo);
          if (qualityResult.verdict === "APPROVE") {
            Object.assign(proxyConfig, newConfig);
            break;
          }
        }
      }

      // Final check
      if (qualityResult.verdict === "REJECT") {
        await logAudit({
          accountId,
          profileId,
          cardUuid,
          proxyIp: resolvedIp,
          proxyProvider: proxyConfig.provider,
          proxyGeo: `${geo.city || ""}, ${geo.country || ""}`.replace(/^, /, ""),
          trustScore: qualityResult.score,
          action: "link_failed",
          details: JSON.stringify({ reason: "quality_reject", steps: qualityResult.steps }),
        });

        return {
          success: false,
          error: `IP quality too low (score: ${qualityResult.score}). All retries failed.`,
          qualityResult,
        };
      }
    }

    // Check IP uniqueness
    const ipCheck = await checkIPUniqueness(resolvedIp, profileId);
    if (!ipCheck.unique) {
      return {
        success: false,
        error: `IP ${resolvedIp} already used by profile "${ipCheck.conflictProfile.name}"`,
      };
    }
  }

  // Step 5: Assign proxy to Multilogin profile
  try {
    // Get MLX profile ID and folder ID from D1
    const profileData = await query(
      "SELECT ml_profile_id, ml_folder_id FROM ops_profiles WHERE id = ?",
      [profileId]
    );

    if (profileData.success && profileData.results.length > 0) {
      const { ml_profile_id, ml_folder_id } = profileData.results[0];
      if (ml_profile_id) {
        const mlxProxy = proxyProviders.toMultiloginFormat(proxyConfig);
        await multiloginApi.assignProxyToProfile(ml_profile_id, ml_folder_id, mlxProxy);
      }
    }
  } catch (e) {
    console.warn("[profile-linker] MLX proxy assign failed:", e.message);
    // Non-fatal: proxy config saved in D1 even if MLX update fails
  }

  // Step 6: Save to D1
  const geoString = `${geo.city || ""}, ${geo.state || ""}, ${geo.country || ""}`.replace(/^, |, $/g, "").replace(/, ,/g, ",");

  // Update ops_profiles
  await execute(
    `UPDATE ops_profiles SET
      proxy_provider = ?, proxy_geo_country = ?, proxy_geo_state = ?,
      proxy_geo_city = ?, proxy_session_id = ?, last_ip = ?,
      last_ip_at = ?, last_trust_score = ?,
      proxy_host = ?, proxy_port = ?, proxy_user = ?
    WHERE id = ?`,
    [
      proxyConfig.provider, geo.country, geo.state,
      geo.city, proxyConfig.sessionId, resolvedIp,
      now(), qualityResult?.score || 0,
      proxyConfig.host, String(proxyConfig.port), proxyConfig.username,
      profileId,
    ]
  );

  // Upsert ops_accounts
  const existing = await query("SELECT id FROM ops_accounts WHERE id = ?", [accountId]);
  if (existing.success && existing.results.length > 0) {
    await execute(
      `UPDATE ops_accounts SET profile_id = ?, card_uuid = ?, proxy_ip = ?, status = 'active' WHERE id = ?`,
      [profileId, cardUuid, resolvedIp, accountId]
    );
  } else {
    await execute(
      `INSERT INTO ops_accounts (id, label, profile_id, card_uuid, proxy_ip, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [accountId, label || `Account ${accountId.slice(0, 6)}`, profileId, cardUuid, resolvedIp, now()]
    );
  }

  // Step 7: Audit log
  await logAudit({
    accountId,
    profileId,
    cardUuid,
    proxyIp: resolvedIp,
    proxyProvider: proxyConfig.provider,
    proxyGeo: geoString,
    trustScore: qualityResult?.score || 0,
    action: "link",
    details: JSON.stringify({
      provider: proxyConfig.providerName,
      sessionId: proxyConfig.sessionId,
      qualityVerdict: qualityResult?.verdict,
    }),
  });

  return {
    success: true,
    accountId,
    proxyConfig,
    qualityResult,
    resolvedIp,
    geo,
  };
}

/* ────────────────── Unlink Profile ────────────────── */

export async function unlinkProfile(accountId) {
  const account = await query("SELECT * FROM ops_accounts WHERE id = ?", [accountId]);
  if (!account.success || account.results.length === 0) {
    return { success: false, error: "Account not found" };
  }

  const acct = account.results[0];

  // Clear proxy from ops_profiles
  if (acct.profile_id) {
    await execute(
      `UPDATE ops_profiles SET last_ip = '', last_trust_score = 0, proxy_session_id = '' WHERE id = ?`,
      [acct.profile_id]
    );
  }

  // Deactivate account link
  await execute(
    `UPDATE ops_accounts SET status = 'unlinked', profile_id = '', card_uuid = '', proxy_ip = '' WHERE id = ?`,
    [accountId]
  );

  // Audit
  await logAudit({
    accountId,
    profileId: acct.profile_id,
    cardUuid: acct.card_uuid,
    proxyIp: acct.proxy_ip,
    action: "unlink",
    details: JSON.stringify({ previousLabel: acct.label }),
  });

  return { success: true };
}

/* ────────────────── Pre-launch Check ────────────────── */

/**
 * Validate proxy quality before opening a Multilogin profile.
 * Must be called before every profile launch.
 *
 * @param {string} profileId - ops_profiles.id
 * @returns {object} { approved, score, qualityResult, rotated }
 */
export async function prelaunchCheck(profileId) {
  // Get profile with geo lock
  const profile = await query(
    "SELECT * FROM ops_profiles WHERE id = ?",
    [profileId]
  );

  if (!profile.success || profile.results.length === 0) {
    return { approved: false, error: "Profile not found" };
  }

  const p = profile.results[0];
  const ip = p.last_ip || p.proxy_ip;

  if (!ip) {
    return { approved: false, error: "No proxy IP assigned to profile" };
  }

  const geo = {
    country: p.proxy_geo_country || "TH",
    state: p.proxy_geo_state || "",
    city: p.proxy_geo_city || "",
  };

  // Run quality pipeline
  let qualityResult = await ipQualityPipeline.runQualityPipeline(ip, geo);

  if (qualityResult.verdict === "APPROVE") {
    // Update trust score
    await execute(
      "UPDATE ops_profiles SET last_trust_score = ?, last_ip_at = ? WHERE id = ?",
      [qualityResult.score, now(), profileId]
    );

    await logAudit({
      profileId,
      proxyIp: ip,
      proxyProvider: p.proxy_provider,
      proxyGeo: `${geo.city}, ${geo.country}`.replace(/^, /, ""),
      trustScore: qualityResult.score,
      action: "prelaunch_pass",
      details: JSON.stringify({ asn: qualityResult.asn, isp: qualityResult.isp }),
    });

    return { approved: true, score: qualityResult.score, qualityResult, rotated: false };
  }

  // REJECT: try auto-rotate (max 3 times)
  for (let retry = 0; retry < 3; retry++) {
    const rotateResult = await rotateProxy(profileId);
    if (!rotateResult.success) continue;

    qualityResult = rotateResult.qualityResult;
    if (qualityResult && qualityResult.verdict === "APPROVE") {
      await logAudit({
        profileId,
        proxyIp: rotateResult.newIp,
        proxyProvider: p.proxy_provider,
        proxyGeo: `${geo.city}, ${geo.country}`.replace(/^, /, ""),
        trustScore: qualityResult.score,
        action: "prelaunch_pass",
        details: JSON.stringify({ rotated: true, attempt: retry + 1 }),
      });

      return { approved: true, score: qualityResult.score, qualityResult, rotated: true };
    }
  }

  // All retries failed
  await logAudit({
    profileId,
    proxyIp: ip,
    proxyProvider: p.proxy_provider,
    trustScore: qualityResult?.score || 0,
    action: "prelaunch_fail",
    details: JSON.stringify({ reason: "all_retries_failed", lastScore: qualityResult?.score }),
  });

  return {
    approved: false,
    score: qualityResult?.score || 0,
    qualityResult,
    error: "Proxy quality too low after all rotation attempts",
  };
}

/* ────────────────── Rotate Proxy ────────────────── */

/**
 * Rotate proxy IP for a profile, keeping geo locked.
 */
export async function rotateProxy(profileId) {
  const profile = await query("SELECT * FROM ops_profiles WHERE id = ?", [profileId]);
  if (!profile.success || profile.results.length === 0) {
    return { success: false, error: "Profile not found" };
  }

  const p = profile.results[0];
  const oldIp = p.last_ip || p.proxy_ip;
  const geo = {
    country: p.proxy_geo_country || "TH",
    state: p.proxy_geo_state || "",
    city: p.proxy_geo_city || "",
  };

  // Generate new proxy (new session = new IP, same geo)
  const provider = p.proxy_provider || proxyProviders.getPrimaryProvider();
  const newConfig = proxyProviders.getProxyConfig(provider, {
    profileId,
    geo,
    sessionId: proxyProviders.generateSessionId(profileId), // force new session
  });

  if (newConfig.error) {
    return { success: false, error: newConfig.error };
  }

  // Resolve new IP
  let newIp = "";
  try {
    const settings = JSON.parse(localStorage.getItem("lp_settings") || "{}");
    const apiBase = settings.apiBase || "";
    const workerBase = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;

    const res = await fetch(`${workerBase}/api/proxy/resolve-ip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: newConfig.host,
        port: newConfig.port,
        username: newConfig.username,
        password: newConfig.password,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = await res.json();
      newIp = data.ip || data.query || "";
    }
  } catch { /* continue without IP */ }

  // Quality check
  let qualityResult = null;
  if (newIp) {
    qualityResult = await ipQualityPipeline.runQualityPipeline(newIp, geo);
  }

  // Assign to MLX
  if (p.ml_profile_id) {
    try {
      const mlxProxy = proxyProviders.toMultiloginFormat(newConfig);
      await multiloginApi.assignProxyToProfile(p.ml_profile_id, p.ml_folder_id, mlxProxy);
    } catch (e) {
      console.warn("[profile-linker] MLX rotate assign failed:", e.message);
    }
  }

  // Update D1
  await execute(
    `UPDATE ops_profiles SET
      last_ip = ?, last_ip_at = ?, last_trust_score = ?,
      proxy_session_id = ?, proxy_host = ?, proxy_port = ?, proxy_user = ?
    WHERE id = ?`,
    [
      newIp, now(), qualityResult?.score || 0,
      newConfig.sessionId, newConfig.host, String(newConfig.port), newConfig.username,
      profileId,
    ]
  );

  // Update ops_accounts proxy_ip
  await execute(
    "UPDATE ops_accounts SET proxy_ip = ? WHERE profile_id = ? AND status = 'active'",
    [newIp, profileId]
  );

  // Audit
  await logAudit({
    profileId,
    proxyIp: newIp,
    proxyProvider: provider,
    proxyGeo: `${geo.city}, ${geo.country}`.replace(/^, /, ""),
    trustScore: qualityResult?.score || 0,
    action: "ip_rotate",
    details: JSON.stringify({ oldIp, newIp, newSession: newConfig.sessionId }),
  });

  return {
    success: true,
    oldIp,
    newIp,
    qualityResult,
    proxyConfig: newConfig,
  };
}

/* ────────────────── Get Linked Stack ────────────────── */

/**
 * Get the complete linked stack for an account.
 */
export async function getLinkedStack(accountId) {
  const account = await query("SELECT * FROM ops_accounts WHERE id = ?", [accountId]);
  if (!account.success || account.results.length === 0) return null;

  const acct = account.results[0];

  let profile = null;
  if (acct.profile_id) {
    const p = await query("SELECT * FROM ops_profiles WHERE id = ?", [acct.profile_id]);
    if (p.success && p.results.length > 0) profile = p.results[0];
  }

  return {
    account: acct,
    profile,
    cardUuid: acct.card_uuid,
    proxyIp: acct.proxy_ip || profile?.last_ip,
    geo: profile ? {
      country: profile.proxy_geo_country,
      state: profile.proxy_geo_state,
      city: profile.proxy_geo_city,
    } : null,
    provider: profile?.proxy_provider,
    trustScore: profile?.last_trust_score,
  };
}

/* ────────────────── Audit Logger ────────────────── */

async function logAudit(entry) {
  try {
    await execute(
      `INSERT INTO ops_link_audit (id, account_id, profile_id, card_uuid, proxy_ip, proxy_provider, proxy_geo, trust_score, action, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid(),
        entry.accountId || "",
        entry.profileId || "",
        entry.cardUuid || "",
        entry.proxyIp || "",
        entry.proxyProvider || "",
        entry.proxyGeo || "",
        entry.trustScore || 0,
        entry.action || "",
        entry.details || "",
        now(),
      ]
    );
  } catch (e) {
    console.error("[profile-linker] Audit log failed:", e);
  }
}

/* ────────────────── Export ────────────────── */

export const profileLinker = {
  linkProfileCardProxy,
  unlinkProfile,
  prelaunchCheck,
  rotateProxy,
  validateLink,
  getLinkedStack,
};
