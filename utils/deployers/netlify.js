/**
 * Netlify Deploy (P2 - Secondary)
 * Extracted from Sites.jsx into standalone deployer module.
 */

import { updateDnsAfterDeploy } from "../../services/cloudflare-dns.js";

// Helper function to generate slug candidates
const generateSlugCandidates = (site) => {
  const slugBase = (site.domain || site.brand || "lp")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const siteIdPart = String(site.id || "x")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const primarySlug = `${slugBase}-${siteIdPart.slice(0, 8) || "x"}`.slice(0, 63);
  const legacySlug = `${slugBase}-${siteIdPart.slice(0, 4) || "x"}`.slice(0, 63);
  return Array.from(new Set([primarySlug, legacySlug]));
};

// Helper function to create auth headers
const createAuthHeaders = (netlifyToken, netlifyTeamSlug) => {
  const authH = { Authorization: `Bearer ${netlifyToken}` };
  const teamSlug = String(netlifyTeamSlug || "").trim();
  const withTeam = (url) => {
    if (!teamSlug) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}account_slug=${encodeURIComponent(teamSlug)}`;
  };
  return { authH, withTeam };
};

export async function deploy(content, site, settings) {
  const { netlifyToken, netlifyTeamSlug, cfAccountId, cfApiToken } = settings;
  if (!netlifyToken) {
    return { success: false, error: "Missing Netlify token. Configure in Settings." };
  }

  // Normalize content: string → single file, object → multi-file
  const fileEntries = typeof content === "string"
    ? { "/index.html": content }
    : Object.fromEntries(
        Object.entries(content).map(([k, v]) => [k.startsWith("/") ? k : `/${k}`, v])
      );

  const slugCandidates = generateSlugCandidates(site);
  const { authH, withTeam } = createAuthHeaders(netlifyToken, netlifyTeamSlug);

  try {
    // 1. Find existing site by slug candidates first
    let siteData;
    let activeSlug = slugCandidates[0];
    const findBySlug = async (slug) => {
      const existing = await fetch(
        withTeam(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(slug)}`),
        { headers: authH }
      );
      if (!existing.ok) return null;
      return existing.json();
    };

    for (const candidate of slugCandidates) {
      const found = await findBySlug(candidate);
      if (found) {
        console.log(`[Netlify] Found existing site: ${candidate} (${found.id})`);
        siteData = found;
        activeSlug = candidate;
        break;
      }
    }

    // Only create if absolutely no existing site found
    if (!siteData) {
      console.log(`[Netlify] No existing site found, creating new: ${activeSlug}`);
      const createWithName = async (name) => fetch(withTeam("https://api.netlify.com/api/v1/sites"), {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      let createRes = await createWithName(activeSlug);
      if (createRes.ok) {
        siteData = await createRes.json();
      } else {
        const createErr = await createRes.text().catch(() => "");

        // Race-safe re-check: site may have been created in parallel
        siteData = await findBySlug(activeSlug);

        // If slug is globally taken by another account/team, retry with unique slug
        if (!siteData && /must be unique/i.test(createErr)) {
          const uniqueSuffix = Date.now().toString(36).slice(-6);
          const retrySlug = `${slugCandidates[0]}-${uniqueSuffix}`.slice(0, 63);
          activeSlug = retrySlug;

          createRes = await createWithName(retrySlug);
          if (createRes.ok) {
            siteData = await createRes.json();
          } else {
            const retryErr = await createRes.text().catch(() => "");
            siteData = await findBySlug(retrySlug);
            if (!siteData) {
              return {
                success: false,
                error: `Failed to create/find Netlify site${netlifyTeamSlug ? ` in team '${netlifyTeamSlug}'` : ""}: ${retryErr || createErr || "Unknown Netlify API error"}`,
              };
            }
          }
        }

        if (!siteData) {
          return {
            success: false,
            error: `Failed to create/find Netlify site${netlifyTeamSlug ? ` in team '${netlifyTeamSlug}'` : ""}: ${createErr || "Unknown Netlify API error"}`,
          };
        }
      }
    }

    // 2. Deploy files (if any)
    if (Object.keys(fileEntries).length > 0) {
      // Deploy all files at once using the newer API
      const files = Object.entries(fileEntries).map(([path, content]) => ({
        file_path: path,
        data: content,
      }));

      const deployRes = await fetch(
        withTeam(`https://api.netlify.com/api/v1/sites/${siteData.id}/deploys`),
        {
          method: "POST",
          headers: { ...authH, "Content-Type": "application/json" },
          body: JSON.stringify({ files }),
        }
      );

      if (!deployRes.ok) {
        const deployErr = await deployRes.text().catch(() => "");
        return {
          success: false,
          error: `Deploy upload failed: ${deployErr}`,
        };
      }

      const deployData = await deployRes.json();
      console.log(`[Netlify] Deploy created: ${deployData.id}`);

      // Wait for deploy to be ready (optional but improves UX)
      let deployStatus = deployData;
      let attempts = 0;
      const maxAttempts = 12; // ~1 minute max

      while (attempts < maxAttempts && deployStatus.state === "processing") {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        const statusRes = await fetch(
          withTeam(`https://api.netlify.com/api/v1/sites/${siteData.id}/deploys/${deployData.id}`),
          { headers: authH }
        );
        if (statusRes.ok) {
          deployStatus = await statusRes.json();
        } else {
          break;
        }
      }

      if (deployStatus.state === "ready") {
        console.log(`[Netlify] Deploy ready: ${deployStatus.ssl_url}`);
      } else {
        console.log(`[Netlify] Deploy status: ${deployStatus.state}`);
      }
    }

    // 3. Update DNS if domain is configured
    let dnsUpdated = false;
    let dnsError = null;
    if (site.domain && cfAccountId && cfApiToken) {
      try {
        dnsUpdated = await updateDnsAfterDeploy(site.domain, siteData.ssl_url || siteData.url, cfAccountId, cfApiToken);
      } catch (dnsErr) {
        dnsError = dnsErr.message;
        console.warn(`[Netlify] DNS update failed: ${dnsErr.message}`);
      }
    }

    return {
      success: true,
      url: siteData.ssl_url || siteData.url,
      deployId: siteData.id,
      target: "netlify",
      dnsUpdated,
      dnsError,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function checkDeployStatus(site, settings) {
  const { netlifyToken, netlifyTeamSlug } = settings;
  if (!netlifyToken) return { success: false, error: "Missing Netlify token" };

  const slugCandidates = generateSlugCandidates(site);
  const { authH, withTeam } = createAuthHeaders(netlifyToken, netlifyTeamSlug);

  try {
    for (const slug of slugCandidates) {
      const res = await fetch(
        withTeam(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(slug)}`),
        { headers: authH }
      );
      if (!res.ok) continue;
      const siteData = await res.json();

      // Get latest deploy
      const deploysRes = await fetch(
        withTeam(`https://api.netlify.com/api/v1/sites/${siteData.id}/deploys?per_page=1`),
        { headers: authH }
      );
      if (!deploysRes.ok) {
        return { success: true, status: "unknown", url: siteData.ssl_url || siteData.url, platform: "netlify" };
      }
      const deploys = await deploysRes.json();
      const latest = deploys[0];
      if (!latest) return { success: true, status: "no_deploys", url: siteData.ssl_url || siteData.url, platform: "netlify" };

      const stateMap = { ready: "live", processing: "building", building: "building", error: "failed", new: "pending" };
      return {
        success: true,
        status: stateMap[latest.state] || latest.state,
        url: siteData.ssl_url || siteData.url,
        deployId: latest.id,
        createdAt: latest.created_at,
        platform: "netlify",
      };
    }
    return { success: false, error: "Site not found on Netlify" };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function deleteProject(site, settings) {
  const { netlifyToken, netlifyTeamSlug } = settings;
  if (!netlifyToken) {
    return { success: false, error: "Missing Netlify token. Configure in Settings." };
  }

  const slugCandidates = generateSlugCandidates(site);
  const { authH, withTeam } = createAuthHeaders(netlifyToken, netlifyTeamSlug);

  try {
    // Try to find and delete site by slug candidates
    for (const slug of slugCandidates) {
      try {
        const deleteRes = await fetch(
          withTeam(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(slug)}`),
          { 
            method: "DELETE",
            headers: authH 
          }
        );
        
        if (deleteRes.ok) {
          return { success: true, message: `Deleted Netlify site: ${slug}` };
        }
      } catch (e) {
        // Continue trying other slugs
        continue;
      }
    }
    
    return { success: false, error: "Netlify site not found or already deleted" };
  } catch (error) {
    return { success: false, error: `Delete failed: ${error.message}` };
  }
}
