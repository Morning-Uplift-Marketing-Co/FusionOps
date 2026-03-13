/**
 * ProxyHealthTab — Real-time Proxy Health Monitor
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

const REFRESH_INTERVAL = 5 * 60 * 1000;
const SCORE_COLORS = { good: "hsl(142,71%,45%)", ok: "hsl(38,92%,50%)", bad: "hsl(0,84%,60%)" };
function getScoreColor(s) { return s >= 90 ? SCORE_COLORS.good : s >= 70 ? SCORE_COLORS.ok : SCORE_COLORS.bad; }

function TrustBadge({ score }) {
  const c = getScoreColor(score);
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${c}18`, color: c, border: `1px solid ${c}33` }}>{score}</span>;
}

function StatusDot({ status }) {
  const m = { healthy: "bg-green-500", warning: "bg-yellow-500", critical: "bg-red-500", unknown: "bg-gray-400", checking: "bg-blue-400 animate-pulse" };
  return <span className={`inline-block w-2 h-2 rounded-full ${m[status] || m.unknown}`} />;
}

function ProfileRow({ profile, onCheck, onRotate, checking }) {
  const h = profile.health;
  const status = !h ? "unknown" : h.score >= 90 ? "healthy" : h.score >= 70 ? "warning" : "critical";
  const lastCheck = h?.timestamp ? new Date(h.timestamp).toLocaleTimeString() : "—";
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30 transition-colors">
      <StatusDot status={checking ? "checking" : status} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium truncate">{profile.name || profile.id}</div>
        <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">{profile.mlProfileId ? `MLX: ${profile.mlProfileId.slice(0, 8)}…` : "No MLX ID"}</div>
      </div>
      <div className="w-28 text-center">{h?.ip ? <div className="text-[11px] font-mono">{h.ip}</div> : <div className="text-[10px] text-[hsl(var(--muted-foreground))]">—</div>}</div>
      <div className="w-24 text-center">{h?.geo ? <div className="text-[10px]"><span className="font-medium">{h.geo.countryCode}</span>{h.geo.regionName && <span className="text-[hsl(var(--muted-foreground))]"> {h.geo.regionName}</span>}</div> : <div className="text-[10px] text-[hsl(var(--muted-foreground))]">—</div>}</div>
      <div className="w-32 text-center hidden xl:block">{h?.geo?.isp ? <div className="text-[10px] truncate text-[hsl(var(--muted-foreground))]">{h.geo.isp}</div> : <div className="text-[10px] text-[hsl(var(--muted-foreground))]">—</div>}</div>
      <div className="w-16 text-center">{h?.score != null ? <TrustBadge score={h.score} /> : <span className="text-[10px] text-[hsl(var(--muted-foreground))]">—</span>}</div>
      <div className="w-16 text-center text-[9px] text-[hsl(var(--muted-foreground))]">{lastCheck}</div>
      <div className="flex gap-1">
        <button onClick={() => onCheck(profile)} disabled={checking} className="px-2 py-1 text-[9px] rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] disabled:opacity-40" title="Re-check">{checking ? "⏳" : "🔍"}</button>
        <button onClick={() => onRotate(profile)} disabled={checking} className="px-2 py-1 text-[9px] rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] disabled:opacity-40" title="Rotate IP">🔄</button>
      </div>
    </div>
  );
}

function SummaryCards({ profiles }) {
  const wh = profiles.filter(p => p.health);
  const healthy = wh.filter(p => p.health.score >= 90).length;
  const warning = wh.filter(p => p.health.score >= 70 && p.health.score < 90).length;
  const critical = wh.filter(p => p.health.score < 70).length;
  const unchecked = profiles.length - wh.length;
  const avg = wh.length ? Math.round(wh.reduce((s, p) => s + p.health.score, 0) / wh.length) : 0;
  const items = [
    { label: "Total", value: profiles.length, color: "hsl(var(--foreground))" },
    { label: "Healthy", value: healthy, color: SCORE_COLORS.good },
    { label: "Warning", value: warning, color: SCORE_COLORS.ok },
    { label: "Critical", value: critical, color: SCORE_COLORS.bad },
    { label: "Unchecked", value: unchecked, color: "hsl(var(--muted-foreground))" },
    { label: "Avg Score", value: avg, color: getScoreColor(avg) },
  ];
  return (
    <div className="grid grid-cols-6 gap-2 mb-4">
      {items.map(i => (
        <div key={i.label} className="text-center p-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div className="text-[18px] font-bold" style={{ color: i.color }}>{i.value}</div>
          <div className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{i.label}</div>
        </div>
      ))}
    </div>
  );
}

function AlertBanner({ alerts, onDismiss }) {
  if (!alerts.length) return null;
  return (
    <div className="mb-4 flex flex-col gap-1">
      {alerts.slice(0, 5).map((a, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.12)]">
          <span>⚠️</span><span className="flex-1">{a.message}</span>
          <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{new Date(a.timestamp).toLocaleTimeString()}</span>
          <button onClick={() => onDismiss(i)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">✕</button>
        </div>
      ))}
    </div>
  );
}

export function ProxyHealthTab({ profiles: rawProfiles = [], settings = {}, standalone = false }) {
  const [profileHealth, setProfileHealth] = useState({});
  const [checking, setChecking] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastScan, setLastScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState("all");
  const intervalRef = useRef(null);

  const profiles = rawProfiles.map(p => ({ ...p, health: profileHealth[p.id] || null }));

  const filtered = profiles.filter(p => {
    if (filter === "all") return true;
    if (filter === "unchecked") return !p.health;
    if (filter === "healthy") return p.health?.score >= 90;
    if (filter === "warning") return p.health?.score >= 70 && p.health?.score < 90;
    if (filter === "critical") return p.health?.score < 70;
    return true;
  });

  const checkProfile = useCallback(async (profile) => {
    const pid = profile.id;
    setChecking(prev => ({ ...prev, [pid]: true }));
    try {
      const { proxyPreflight } = await import("../services/proxy-preflight.js");
      const result = await proxyPreflight.checkOnly(
        profile.mlProfileId || pid, profile.mlFolderId || "",
        { country: profile.proxyCountry || settings.defaultProxyCountry || "us", state: profile.proxyState || "", city: profile.proxyCity || "", filter: settings.nmProxyFilter || "medium" }
      );
      const healthData = { ip: result.ip, score: result.score, verdict: result.verdict, checks: result.checks || [], geo: result.checks?.find(c => c.name === "Geo Verification")?.data || null, timestamp: Date.now() };
      const prev = profileHealth[pid];
      if (prev?.ip && prev.ip !== healthData.ip) setAlerts(a => [{ message: `🔀 IP changed for "${profile.name}": ${prev.ip} → ${healthData.ip}`, timestamp: Date.now(), profileId: pid }, ...a]);
      if (prev?.score && prev.score >= 70 && healthData.score < 70) setAlerts(a => [{ message: `📉 Score dropped for "${profile.name}": ${prev.score} → ${healthData.score}`, timestamp: Date.now(), profileId: pid }, ...a]);
      setProfileHealth(prev => ({ ...prev, [pid]: healthData }));
    } catch (e) {
      setProfileHealth(prev => ({ ...prev, [pid]: { ip: null, score: 0, verdict: "ERROR", error: e.message, timestamp: Date.now() } }));
    } finally {
      setChecking(prev => ({ ...prev, [pid]: false }));
    }
  }, [profileHealth, settings]);

  const rotateProfile = useCallback(async (profile) => {
    const pid = profile.id;
    setChecking(prev => ({ ...prev, [pid]: true }));
    try {
      const { nodemavenApi } = await import("../services/nodemaven.js");
      const config = nodemavenApi.rotateProxy({ profileId: profile.mlProfileId || pid, country: profile.proxyCountry || "us", state: profile.proxyState || "", city: profile.proxyCity || "", filter: settings.nmProxyFilter || "medium" });
      const { multiloginApi } = await import("../services/multilogin.js");
      await multiloginApi.updateProfile(profile.mlProfileId, profile.mlFolderId, { proxy: nodemavenApi.toMultiloginFormat(config) });
      await checkProfile(profile);
      setAlerts(a => [{ message: `🔄 IP rotated for "${profile.name}"`, timestamp: Date.now(), profileId: pid }, ...a]);
    } catch (e) { console.warn(`[ProxyHealth] Rotate failed:`, e.message); }
    finally { setChecking(prev => ({ ...prev, [pid]: false })); }
  }, [checkProfile, settings]);

  const scanAll = useCallback(async () => {
    setScanning(true);
    for (let i = 0; i < profiles.length; i += 3) {
      await Promise.allSettled(profiles.slice(i, i + 3).map(p => checkProfile(p)));
    }
    setLastScan(Date.now());
    setScanning(false);
  }, [profiles, checkProfile]);

  useEffect(() => {
    if (autoRefresh && profiles.length > 0) intervalRef.current = setInterval(scanAll, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, profiles.length, scanAll]);

  useEffect(() => {
    try { const s = localStorage.getItem("lp_proxy_health"); if (s) { const p = JSON.parse(s), c = Date.now() - 30 * 60000, f = {}; Object.entries(p).forEach(([k, v]) => { if (v.timestamp > c) f[k] = v; }); if (Object.keys(f).length) setProfileHealth(f); } } catch (_) {}
  }, []);

  useEffect(() => {
    if (Object.keys(profileHealth).length) try { localStorage.setItem("lp_proxy_health", JSON.stringify(profileHealth)); } catch (_) {}
  }, [profileHealth]);

  const filterBtns = [
    { id: "all", label: "All", count: profiles.length },
    { id: "healthy", label: "Healthy", count: profiles.filter(p => p.health?.score >= 90).length },
    { id: "warning", label: "Warning", count: profiles.filter(p => p.health?.score >= 70 && p.health?.score < 90).length },
    { id: "critical", label: "Critical", count: profiles.filter(p => p.health?.score < 70).length },
    { id: "unchecked", label: "Unchecked", count: profiles.filter(p => !p.health).length },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          {standalone
            ? <><h1 className="text-[22px] font-bold m-0">Proxy Health Monitor</h1><p className="text-sm text-[hsl(var(--muted-foreground))]">Real-time IP quality monitoring{lastScan && <> · Last scan: {new Date(lastScan).toLocaleTimeString()}</>}</p></>
            : <><h3 className="text-sm font-bold">🛡️ Proxy Health Monitor</h3><p className="text-[10px] text-[hsl(var(--muted-foreground))]">Real-time IP quality monitoring{lastScan && <> · Last scan: {new Date(lastScan).toLocaleTimeString()}</>}</p></>
          }
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer"><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />Auto (5min)</label>
          <Button onClick={scanAll} disabled={scanning || !profiles.length} className="px-3 h-7 text-[10px]">{scanning ? "⏳ Scanning..." : "🔍 Scan All"}</Button>
        </div>
      </div>
      <AlertBanner alerts={alerts} onDismiss={i => setAlerts(a => a.filter((_, j) => j !== i))} />
      <SummaryCards profiles={profiles} />
      <div className="flex gap-1.5 mb-3">
        {filterBtns.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-colors ${filter === f.id ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 text-[hsl(var(--foreground))]" : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"}`}>{f.label} ({f.count})</button>
        ))}
      </div>
      <div className="flex items-center gap-3 px-3 py-1.5 text-[9px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium border-b border-[hsl(var(--border))] mb-1">
        <span className="w-2" /><span className="flex-1">Profile</span><span className="w-28 text-center">IP Address</span><span className="w-24 text-center">Location</span><span className="w-32 text-center hidden xl:block">ISP</span><span className="w-16 text-center">Score</span><span className="w-16 text-center">Checked</span><span className="w-14" />
      </div>
      <div className="flex flex-col gap-1">
        {filtered.length === 0 ? (
          <Card className="text-center py-8"><p className="text-[hsl(var(--muted-foreground))] text-sm">{profiles.length === 0 ? "No profiles found. Add profiles in Profiles tab." : `No profiles match "${filter}" filter.`}</p></Card>
        ) : filtered.map(p => <ProfileRow key={p.id} profile={p} onCheck={checkProfile} onRotate={rotateProfile} checking={!!checking[p.id]} />)}
      </div>
      {!settings.nmProxyUser && (
        <div className="mt-4 p-3 rounded-lg bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.12)] text-[11px] text-[hsl(var(--muted-foreground))]">
          💡 <strong>Setup required:</strong> Add NodeMaven proxy credentials in Settings → NodeMaven Proxy to enable pre-flight checks.
        </div>
      )}
    </div>
  );
}

export default ProxyHealthTab;
