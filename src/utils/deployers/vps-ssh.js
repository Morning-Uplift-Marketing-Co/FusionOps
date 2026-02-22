/**
 * VPS Deploy via SSH/rsync (P6)
 * Cannot SSH directly from browser — routes through Worker proxy endpoint.
 * Requires the Worker at lp-factory-api to have the /api/deploy/vps route.
 */

const WORKER_BASE = "https://lp-factory-api.songsawat-w.workers.dev";

export async function deploy(html, site, settings) {
  const { vpsHost, vpsUser, vpsPath, vpsPort, vpsAuthMethod, vpsKey } = settings;
  if (!vpsHost || !vpsUser || !vpsPath) {
    return { success: false, error: "Missing VPS host, user, or path. Configure in Settings." };
  }

  try {
    const res = await fetch(`${WORKER_BASE}/api/deploy/vps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html,
        host: vpsHost,
        port: vpsPort || 22,
        user: vpsUser,
        remotePath: vpsPath,
        authMethod: vpsAuthMethod || "key",
        key: vpsKey || "",
        siteName: site.brand || site.domain || "lp",
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: `VPS deploy failed: ${errData.error || res.statusText}` };
    }

    const data = await res.json();
    const url = `http://${vpsHost}${vpsPath.endsWith("/") ? vpsPath : vpsPath + "/"}`;
    return { success: true, url: data.url || url, deployId: `vps-${Date.now()}`, target: "vps-ssh" };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
