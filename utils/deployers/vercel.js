/**
 * Vercel Deploy
 * Uses Vercel Deployments API to publish a static single-file site.
 */

export async function deploy(content, site, settings) {
  const { vercelToken, vercelTeamId } = settings;
  if (!vercelToken) {
    return { success: false, error: "Missing Vercel token. Configure in Settings." };
  }

  const name = (site.domain || site.brand || "lp")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 40) + "-" + (site.id || "x").slice(0, 4);

  const authH = { Authorization: `Bearer ${vercelToken}` };
  const deployQuery = new URLSearchParams({ skipAutoDetectionConfirmation: "1" });
  if (vercelTeamId) {
    deployQuery.set("teamId", vercelTeamId);
  }
  const deployQueryString = `?${deployQuery.toString()}`;
  const teamQueryString = vercelTeamId ? `?teamId=${encodeURIComponent(vercelTeamId)}` : "";

  const files = typeof content === "string"
    ? [{ file: "index.html", data: content, encoding: "utf-8" }]
    : Object.entries(content || {}).map(([file, data]) => ({ file, data, encoding: "utf-8" }));

  console.log(`[Vercel] Deploying ${files.length} files:`, files.map(f => f.file));

  try {
    const response = await fetch(`https://api.vercel.com/v13/deployments${deployQueryString}`, {
      method: "POST",
      headers: {
        ...authH,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        files,
        target: "production",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `Vercel API error: ${errorData.error?.message || response.statusText}`,
      };
    }

    const data = await response.json();

    if (site.domain) {
      try {
        await fetch(`https://api.vercel.com/v9/projects/${name}/domains${teamQueryString}`, {
          method: "POST",
          headers: { ...authH, "Content-Type": "application/json" },
          body: JSON.stringify({ name: site.domain }),
        });
      } catch (e) {
        console.warn("Failed to link domain to Vercel project:", e.message);
      }
    }

    const url = site.domain
      ? `https://${site.domain}`
      : (data.url ? `https://${data.url}` : null);

    return {
      success: true,
      url,
      deployId: data.id,
      target: "vercel",
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function checkDeployStatus(site, settings) {
  const { vercelToken, vercelTeamId } = settings;
  if (!vercelToken) return { success: false, error: "Missing Vercel token" };

  const name = (site.domain || site.brand || "lp")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 40) + "-" + (site.id || "x").slice(0, 4);

  const authH = { Authorization: `Bearer ${vercelToken}` };
  const teamQ = vercelTeamId ? `?teamId=${encodeURIComponent(vercelTeamId)}` : "";

  try {
    const res = await fetch(
      `https://api.vercel.com/v13/deployments${teamQ ? teamQ + "&" : "?"}projectId=${encodeURIComponent(name)}&limit=1`,
      { headers: authH }
    );
    if (!res.ok) return { success: false, error: `Vercel API: ${res.status}` };
    const data = await res.json();
    const latest = data.deployments?.[0];
    if (!latest) return { success: true, status: "no_deploys", platform: "vercel" };

    const stateMap = { READY: "live", BUILDING: "building", QUEUED: "pending", ERROR: "failed", CANCELED: "failed" };
    return {
      success: true,
      status: stateMap[latest.state] || latest.state?.toLowerCase() || "unknown",
      url: latest.url ? `https://${latest.url}` : null,
      deployId: latest.uid,
      createdAt: latest.createdAt ? new Date(latest.createdAt).toISOString() : null,
      platform: "vercel",
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
