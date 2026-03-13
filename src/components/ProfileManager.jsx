import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { multiloginApi } from "../services/multilogin";
import { leadingCardsApi } from "../services/leadingCards";
import { nodemavenApi } from "../services/nodemaven";
import { profileLinker } from "../services/profile-linker";
import d1Service from "../services/d1";

// ──────── Country flags ────────
const FLAGS = { TH: "🇹🇭", US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", JP: "🇯🇵", SG: "🇸🇬", AU: "🇦🇺", CA: "🇨🇦", FR: "🇫🇷", IN: "🇮🇳", VN: "🇻🇳", KR: "🇰🇷", MY: "🇲🇾", PH: "🇵🇭", ID: "🇮🇩", HK: "🇭🇰", TW: "🇹🇼", NL: "🇳🇱" };
const flag = (code) => FLAGS[(code || "").toUpperCase()] || "🌐";

// ──────── Status colors ────────
const STATUS_STYLES = {
  running: { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400", label: "Running" },
  started: { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400", label: "Running" },
  stopped: { bg: "bg-slate-500/15", text: "text-slate-400", dot: "bg-slate-500", label: "Stopped" },
  error: { bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400", label: "Error" },
};

// ──────── Trust score badge ────────
function TrustBadge({ score }) {
  if (score == null || score < 0) return <span className="text-xs text-slate-500">—</span>;
  const color = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
  const bg = score >= 70 ? "bg-emerald-500/10" : score >= 40 ? "bg-amber-500/10" : "bg-red-500/10";
  return <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${color} ${bg}`}>{score}</span>;
}

// ──────── Open status badge ────────
function OpenBadge({ status }) {
  const st = STATUS_STYLES[status] || STATUS_STYLES.stopped;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
      {st.label}
    </span>
  );
}

export function ProfileManager({ settings = {}, ops = {} }) {
  // ── State ──
  const [mlProfiles, setMlProfiles] = useState([]);
  const [d1Profiles, setD1Profiles] = useState([]);
  const [lcCards, setLcCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [actionLoading, setActionLoading] = useState({});
  const [flash, setFlash] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [sortCol, setSortCol] = useState("no");
  const [sortDir, setSortDir] = useState("asc");
  const [expandedRow, setExpandedRow] = useState(null);
  const [linkModal, setLinkModal] = useState(null); // { profileId, profileName }
  const [linkForm, setLinkForm] = useState({ cardUuid: "", provider: "", label: "" });
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState(null);
  const flashTimer = useRef(null);

  const showFlash = useCallback((msg, type = "success") => {
    setFlash({ msg, type });
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 4000);
  }, []);

  // ── Load data ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mlRes, d1Res, lcRes] = await Promise.allSettled([
        multiloginApi.getProfiles(),
        d1Service.query("SELECT * FROM ops_profiles ORDER BY created_at DESC"),
        leadingCardsApi.getCards(),
      ]);
      const mlData = mlRes.status === "fulfilled" ? (mlRes.value?.data?.profiles || (Array.isArray(mlRes.value) ? mlRes.value : [])) : [];
      setMlProfiles(Array.isArray(mlData) ? mlData : []);
      const d1Data = d1Res.status === "fulfilled" ? (d1Res.value?.results || d1Res.value || []) : [];
      setD1Profiles(Array.isArray(d1Data) ? d1Data : []);
      const lcData = lcRes.status === "fulfilled" ? (lcRes.value?.data || lcRes.value || []) : [];
      setLcCards(Array.isArray(lcData) ? lcData : []);
    } catch (e) {
      console.error("[ProfileManager] loadAll:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Merge profiles ──
  const mergedProfiles = useMemo(() => {
    const map = new Map();
    // D1 profiles first (has linking info)
    for (const dp of d1Profiles) {
      const key = dp.ml_profile_id || dp.mlProfileId || dp.id;
      map.set(key, {
        id: dp.id,
        mlId: dp.ml_profile_id || dp.mlProfileId,
        name: dp.name || dp.label,
        group: dp.group_name || dp.folder_name || "",
        browserType: dp.browser_type || dp.browserType || "",
        os: dp.os_type || dp.os || "",
        ip: dp.last_ip || dp.proxy_ip || "",
        proxyCountry: dp.proxy_geo_country || dp.proxyCountry || "TH",
        proxyState: dp.proxy_geo_state || "",
        proxyCity: dp.proxy_geo_city || "",
        proxyProvider: dp.proxy_provider || "",
        proxyScore: dp.last_trust_score ?? -1,
        trustScore: dp.last_trust_score ?? -1,
        lendingCard: dp.lending_card_uuid || dp.cardUuid || "",
        lendingCardName: dp.lending_card_name || dp.cardName || "",
        platform: dp.platform || "",
        status: "stopped",
        createdAt: dp.created_at || dp.createdAt || "",
        accountId: dp.account_id || dp.accountId || "",
        d1: dp,
        mlx: null,
      });
    }
    // MLX profiles
    for (const mp of mlProfiles) {
      const pid = mp.uuid || mp.id;
      const existing = map.get(pid);
      const proxyObj = mp.parameters?.proxy || (typeof mp.proxy === "object" ? mp.proxy : null);
      const proxyHost = proxyObj?.host ? `${proxyObj.host}:${proxyObj.port || ""}` : (typeof mp.proxy === "string" ? mp.proxy : "");
      if (existing) {
        existing.mlx = mp;
        existing.name = existing.name || mp.name || mp.label;
        existing.browserType = existing.browserType || mp.browser_type || "";
        existing.os = existing.os || mp.os_type || "";
        existing.status = mp.status || "stopped";
        existing.ip = existing.ip || proxyHost;
        existing.group = existing.group || mp.folder_name || "";
      } else {
        map.set(pid, {
          id: pid,
          mlId: pid,
          name: mp.name || mp.label || pid.slice(0, 10),
          group: mp.folder_name || "",
          browserType: mp.browser_type || "",
          os: mp.os_type || "",
          ip: proxyHost,
          proxyCountry: "",
          proxyState: "",
          proxyCity: "",
          proxyProvider: "",
          proxyScore: -1,
          trustScore: -1,
          lendingCard: "",
          lendingCardName: "",
          platform: "",
          status: mp.status || "stopped",
          createdAt: mp.created_at || "",
          accountId: "",
          d1: null,
          mlx: mp,
        });
      }
    }

    // Merge lending card names
    const cardMap = new Map();
    for (const c of lcCards) {
      cardMap.set(c.uuid || c.id, c);
    }
    for (const [, profile] of map) {
      if (profile.lendingCard && cardMap.has(profile.lendingCard)) {
        const card = cardMap.get(profile.lendingCard);
        profile.lendingCardName = card.label || card.name || card.card_number?.slice(-4) || profile.lendingCardName;
      }
    }

    return [...map.values()];
  }, [mlProfiles, d1Profiles, lcCards]);

  // ── Filter & sort ──
  const groups = useMemo(() => {
    const s = new Set();
    for (const p of mergedProfiles) if (p.group) s.add(p.group);
    return ["all", ...s];
  }, [mergedProfiles]);

  const filtered = useMemo(() => {
    let list = mergedProfiles;
    if (groupFilter !== "all") list = list.filter(p => p.group === groupFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.id || "").toLowerCase().includes(q) ||
        (p.ip || "").includes(q) ||
        (p.lendingCardName || "").toLowerCase().includes(q) ||
        (p.accountId || "").toLowerCase().includes(q)
      );
    }
    // Sort
    list = [...list].sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case "name": av = a.name || ""; bv = b.name || ""; break;
        case "ip": av = a.ip || ""; bv = b.ip || ""; break;
        case "card": av = a.lendingCardName || ""; bv = b.lendingCardName || ""; break;
        case "score": av = a.trustScore ?? -1; bv = b.trustScore ?? -1; break;
        case "status": av = a.status; bv = b.status; break;
        case "date": av = a.createdAt || ""; bv = b.createdAt || ""; break;
        default: av = 0; bv = 0;
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [mergedProfiles, groupFilter, search, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // ── Actions ──
  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map(p => p.id)));
  };

  const profileAction = async (profileId, action) => {
    setActionLoading(prev => ({ ...prev, [profileId]: action }));
    try {
      const profile = mergedProfiles.find(p => p.id === profileId);
      const pid = profile?.mlId || profileId;
      const folderId = profile?.mlx?.folder_id || settings.mlFolderId || "";

      switch (action) {
        case "start":
          await multiloginApi.startProfile(pid, folderId);
          showFlash(`Started: ${profile?.name || pid}`);
          break;
        case "stop":
          await multiloginApi.stopProfile(pid);
          showFlash(`Stopped: ${profile?.name || pid}`);
          break;
        case "clone":
          await multiloginApi.cloneProfile(pid);
          showFlash(`Cloned: ${profile?.name || pid}`);
          break;
        case "delete":
          if (!confirm(`Delete profile "${profile?.name || pid}"?`)) return;
          await multiloginApi.deleteProfiles([pid], folderId);
          showFlash(`Deleted: ${profile?.name || pid}`);
          break;
      }
      await loadAll();
    } catch (e) {
      showFlash(`${action} failed: ${e.message}`, "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [profileId]: null }));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await multiloginApi.syncProfiles();
      if (res?.error) showFlash(`Sync failed: ${res.error}`, "error");
      else showFlash(`Synced: ${res.created || 0} created, ${res.deleted || 0} removed`);
      await loadAll();
    } catch (e) {
      showFlash(`Sync failed: ${e.message}`, "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkAction = async (action) => {
    if (!selected.size) return;
    const ids = [...selected];
    for (const id of ids) {
      await profileAction(id, action);
    }
    setSelected(new Set());
  };

  // ── Link / Unlink ──
  const openLinkModal = (profile) => {
    setLinkModal({ profileId: profile.id, profileName: profile.name, mlId: profile.mlId });
    setLinkForm({ cardUuid: "", provider: "", label: profile.name || "" });
    setLinkResult(null);
  };

  const handleLink = async () => {
    if (!linkModal || !linkForm.cardUuid) {
      setLinkResult({ success: false, error: "Please select a card" });
      return;
    }
    setLinking(true);
    setLinkResult(null);
    try {
      const res = await profileLinker.linkProfileCardProxy({
        profileId: linkModal.profileId,
        cardUuid: linkForm.cardUuid,
        provider: linkForm.provider || undefined,
        label: linkForm.label || linkModal.profileName,
      });
      setLinkResult(res);
      if (res.success) {
        showFlash(`Linked: ${linkModal.profileName} → Card + Proxy (Score: ${res.qualityResult?.score || "—"})`);
        await loadAll();
        setTimeout(() => setLinkModal(null), 1500);
      }
    } catch (e) {
      setLinkResult({ success: false, error: e.message });
      showFlash(`Link failed: ${e.message}`, "error");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (profile) => {
    if (!profile.accountId) {
      showFlash("No linked account found", "error");
      return;
    }
    if (!confirm(`Unlink profile "${profile.name}"? This will remove the card + proxy assignment.`)) return;
    setActionLoading(prev => ({ ...prev, [profile.id]: "unlink" }));
    try {
      const res = await profileLinker.unlinkProfile(profile.accountId);
      if (res.success) {
        showFlash(`Unlinked: ${profile.name}`);
        await loadAll();
      } else {
        showFlash(`Unlink failed: ${res.error}`, "error");
      }
    } catch (e) {
      showFlash(`Unlink failed: ${e.message}`, "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [profile.id]: null }));
    }
  };

  const handlePrelaunch = async (profile) => {
    if (!profile.accountId) { showFlash("No linked account — link first", "error"); return; }
    setActionLoading(prev => ({ ...prev, [profile.id]: "prelaunch" }));
    try {
      const res = await profileLinker.prelaunchCheck(profile.id);
      if (res.pass) {
        showFlash(`✅ Pre-launch OK: ${profile.name} (Score: ${res.trustScore})`);
      } else {
        showFlash(`❌ Pre-launch FAIL: ${profile.name} — ${res.reason || "quality check failed"}`, "error");
      }
      await loadAll();
    } catch (e) {
      showFlash(`Pre-launch error: ${e.message}`, "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [profile.id]: null }));
    }
  };

  const handleRotateIP = async (profile) => {
    if (!profile.id) return;
    setActionLoading(prev => ({ ...prev, [profile.id]: "rotate" }));
    try {
      const res = await profileLinker.rotateProxy(profile.id);
      if (res.success) {
        showFlash(`🔄 IP rotated: ${profile.name} → ${res.newIp} (Score: ${res.qualityResult?.score || "—"})`);
        await loadAll();
      } else {
        showFlash(`Rotate failed: ${res.error}`, "error");
      }
    } catch (e) {
      showFlash(`Rotate failed: ${e.message}`, "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [profile.id]: null }));
    }
  };

  // ── Stats ──
  const stats = useMemo(() => {
    const total = mergedProfiles.length;
    const running = mergedProfiles.filter(p => p.status === "running" || p.status === "started").length;
    const linked = mergedProfiles.filter(p => p.lendingCard).length;
    const withProxy = mergedProfiles.filter(p => p.ip).length;
    const avgScore = mergedProfiles.filter(p => p.trustScore >= 0).reduce((s, p, _, a) => s + p.trustScore / a.length, 0);
    return { total, running, linked, withProxy, avgScore: Math.round(avgScore) };
  }, [mergedProfiles]);

  // ──────── SortHeader ────────
  const SortHeader = ({ col, children, className = "" }) => (
    <TableHead
      className={`cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors text-xs ${className}`}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortCol === col && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </span>
    </TableHead>
  );

  // ── Unlinked profiles for quick-link ──
  const unlinkedProfiles = useMemo(() => mergedProfiles.filter(p => !p.lendingCard), [mergedProfiles]);

  // ──────── Row action menu ────────
  const [menuOpen, setMenuOpen] = useState(null);
  const [showQuickLink, setShowQuickLink] = useState(false);
  const [quickLinkForm, setQuickLinkForm] = useState({ profileId: "", cardUuid: "", provider: "", label: "" });
  const [quickLinking, setQuickLinking] = useState(false);

  const handleQuickLink = async () => {
    if (!quickLinkForm.profileId || !quickLinkForm.cardUuid) {
      showFlash("Select both a profile and a card", "error");
      return;
    }
    const profile = mergedProfiles.find(p => p.id === quickLinkForm.profileId);
    setQuickLinking(true);
    try {
      const res = await profileLinker.linkProfileCardProxy({
        profileId: quickLinkForm.profileId,
        cardUuid: quickLinkForm.cardUuid,
        provider: quickLinkForm.provider || undefined,
        label: quickLinkForm.label || profile?.name || "",
      });
      if (res.success) {
        showFlash(`✅ Linked: ${profile?.name} → IP ${res.resolvedIp} (Score: ${res.qualityResult?.score || "—"})`);
        setQuickLinkForm({ profileId: "", cardUuid: "", provider: "", label: "" });
        setShowQuickLink(false);
        await loadAll();
      } else {
        showFlash(`❌ Link failed: ${res.error}`, "error");
      }
    } catch (e) {
      showFlash(`Link failed: ${e.message}`, "error");
    } finally {
      setQuickLinking(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold m-0">Profile Manager</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Multilogin profiles with linked cards & proxies · {stats.total} profiles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white px-3"
            onClick={() => setShowQuickLink(!showQuickLink)}
            disabled={unlinkedProfiles.length === 0}
          >
            🔗 Link Profile {unlinkedProfiles.length > 0 && <Badge className="ml-1 bg-amber-800 text-amber-200 text-[9px] px-1">{unlinkedProfiles.length}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="h-8 text-xs">
            {syncing ? "⏳ Syncing..." : "🔄 Sync MLX"}
          </Button>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="h-8 text-xs">
            ↻ Refresh
          </Button>
        </div>
      </div>

      {/* ── Quick Link Panel ── */}
      {showQuickLink && (
        <Card className="bg-[hsl(var(--card))] border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold">🔗 Quick Link: Profile + Card + Proxy</span>
              <button className="ml-auto text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => setShowQuickLink(false)}>✕ Close</button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {/* Profile select */}
              <div>
                <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] block mb-1">👤 Profile *</label>
                <select
                  value={quickLinkForm.profileId}
                  onChange={e => {
                    const p = mergedProfiles.find(x => x.id === e.target.value);
                    setQuickLinkForm(f => ({ ...f, profileId: e.target.value, label: p?.name || "" }));
                  }}
                  className="w-full h-8 px-2 text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                >
                  <option value="">Select profile...</option>
                  {unlinkedProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name || p.id.slice(0, 10)}</option>
                  ))}
                </select>
              </div>

              {/* Card select */}
              <div>
                <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] block mb-1">💳 Card *</label>
                <select
                  value={quickLinkForm.cardUuid}
                  onChange={e => setQuickLinkForm(f => ({ ...f, cardUuid: e.target.value }))}
                  className="w-full h-8 px-2 text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                >
                  <option value="">Select card...</option>
                  {lcCards.map(c => (
                    <option key={c.uuid || c.id} value={c.uuid || c.id}>
                      {c.label || c.name || `****${(c.card_number || "").slice(-4)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider select */}
              <div>
                <label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] block mb-1">🌐 Provider</label>
                <select
                  value={quickLinkForm.provider}
                  onChange={e => setQuickLinkForm(f => ({ ...f, provider: e.target.value }))}
                  className="w-full h-8 px-2 text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                >
                  <option value="">Auto (fallback)</option>
                  <option value="nodemaven">NodeMaven</option>
                  <option value="smartproxy">SmartProxy</option>
                  <option value="soax">SOAX</option>
                  <option value="brightdata">Bright Data</option>
                </select>
              </div>

              {/* Link button */}
              <div className="flex items-end">
                <Button
                  className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleQuickLink}
                  disabled={quickLinking || !quickLinkForm.profileId || !quickLinkForm.cardUuid}
                >
                  {quickLinking ? "⏳ Linking..." : "🔗 Validate & Link"}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2">
              Auto-resolves proxy IP → runs IP quality pipeline (ASN + Fraud + Timezone) → assigns to MLX profile → saves to D1
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Flash message ── */}
      {flash && (
        <div className={`px-3 py-2 rounded-md text-xs font-medium ${flash.type === "error" ? "bg-red-500/15 text-red-400 border border-red-500/20" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"}`}>
          {flash.msg}
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-[hsl(var(--foreground))]" },
          { label: "Running", value: stats.running, color: "text-emerald-400" },
          { label: "Card Linked", value: stats.linked, color: "text-blue-400" },
          { label: "With Proxy", value: stats.withProxy, color: "text-violet-400" },
          { label: "Avg Score", value: stats.avgScore || "—", color: stats.avgScore >= 70 ? "text-emerald-400" : stats.avgScore >= 40 ? "text-amber-400" : "text-red-400" },
        ].map(s => (
          <Card key={s.label} className="bg-[hsl(var(--card))]">
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[350px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search profiles, IPs, cards..."
            className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        {/* Group filter */}
        <select
          value={groupFilter}
          onChange={e => { setGroupFilter(e.target.value); setPage(1); }}
          className="h-8 px-2 text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
        >
          {groups.map(g => <option key={g} value={g}>{g === "all" ? "All groups" : g}</option>)}
        </select>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[hsl(var(--border))]">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{selected.size} selected</span>
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => handleBulkAction("start")}>▶ Open</Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => handleBulkAction("stop")}>⏹ Close</Button>
            <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2" onClick={() => handleBulkAction("delete")}>🗑 Delete</Button>
          </div>
        )}

        {/* Per-page */}
        <div className="ml-auto flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <span>Total: {filtered.length}</span>
          <select
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="h-7 px-1 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
          >
            {[25, 50, 100].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <Card className="bg-[hsl(var(--card))] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[hsl(var(--muted))]/30">
              <TableHead className="w-8 px-2">
                <input
                  type="checkbox"
                  checked={paginated.length > 0 && selected.size === paginated.length}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </TableHead>
              <SortHeader col="no" className="w-16">No.</SortHeader>
              <SortHeader col="name" className="min-w-[140px]">Profile</SortHeader>
              <TableHead className="text-xs">Voluum</TableHead>
              <SortHeader col="card">Lending Card</SortHeader>
              <SortHeader col="ip">IP</SortHeader>
              <SortHeader col="score">Score</SortHeader>
              <TableHead className="text-xs">Platform</TableHead>
              <SortHeader col="status">Status</SortHeader>
              <SortHeader col="date">Created</SortHeader>
              <TableHead className="text-xs text-center">Link</TableHead>
              <TableHead className="w-16 text-xs text-center">#</TableHead>
              <TableHead className="w-28 text-xs text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">
                  ⏳ Loading profiles...
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">
                  No profiles found. Click "Sync MLX" to fetch profiles.
                </TableCell>
              </TableRow>
            ) : paginated.map((profile, idx) => {
              const rowNum = (page - 1) * perPage + idx + 1;
              const isRunning = profile.status === "running" || profile.status === "started";
              const actionKey = actionLoading[profile.id];
              return (
                <TableRow
                  key={profile.id}
                  className={`group ${selected.has(profile.id) ? "bg-[hsl(var(--accent))]/30" : ""}`}
                >
                  {/* Checkbox */}
                  <TableCell className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(profile.id)}
                      onChange={() => toggleSelect(profile.id)}
                      className="rounded"
                    />
                  </TableCell>

                  {/* No. / ID */}
                  <TableCell className="py-2 px-2">
                    <div className="text-xs font-bold">{rowNum}</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono">{(profile.mlId || profile.id || "").slice(0, 7)}</div>
                  </TableCell>

                  {/* Profile Name */}
                  <TableCell className="py-2">
                    <div className="text-xs font-semibold truncate max-w-[160px]">{profile.name}</div>
                    {profile.group && <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{profile.group}</div>}
                  </TableCell>

                  {/* Voluum Test */}
                  <TableCell className="py-2">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {profile.accountId ? "RA" : "—"}
                    </span>
                  </TableCell>

                  {/* Lending Card */}
                  <TableCell className="py-2">
                    {profile.lendingCardName ? (
                      <Badge variant="outline" className="text-[10px] font-medium bg-blue-500/10 text-blue-400 border-blue-500/20">
                        💳 {profile.lendingCardName}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-slate-500">—</span>
                    )}
                  </TableCell>

                  {/* IP */}
                  <TableCell className="py-2">
                    {profile.ip ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px]">{flag(profile.proxyCountry)}</span>
                          <span className="text-[11px] font-mono text-emerald-400">{profile.ip.length > 20 ? profile.ip.slice(0, 20) + "…" : profile.ip}</span>
                        </div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {profile.proxyCountry || "—"}{profile.proxyCity ? ` · ${profile.proxyCity}` : ""}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500">No proxy</span>
                    )}
                  </TableCell>

                  {/* Score */}
                  <TableCell className="py-2 text-center">
                    <TrustBadge score={profile.trustScore} />
                  </TableCell>

                  {/* Platform */}
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1">
                      {profile.browserType && (
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {profile.browserType === "mimic" ? "🌐" : "🦊"} {profile.browserType}
                        </span>
                      )}
                    </div>
                    {profile.os && <div className="text-[10px] text-slate-500">{profile.os}</div>}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-2">
                    <OpenBadge status={profile.status} />
                  </TableCell>

                  {/* Created */}
                  <TableCell className="py-2">
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {profile.createdAt ? new Date(profile.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                  </TableCell>

                  {/* Link Status */}
                  <TableCell className="py-2 text-center">
                    {profile.lendingCard ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">✓ Linked</Badge>
                        <div className="flex gap-0.5">
                          <button
                            className="text-[9px] text-blue-400 hover:underline"
                            disabled={!!actionKey}
                            onClick={() => handlePrelaunch(profile)}
                          >{actionKey === "prelaunch" ? "⏳" : "🚀 Check"}</button>
                          <span className="text-slate-600">|</span>
                          <button
                            className="text-[9px] text-violet-400 hover:underline"
                            disabled={!!actionKey}
                            onClick={() => handleRotateIP(profile)}
                          >{actionKey === "rotate" ? "⏳" : "🔄 Rotate"}</button>
                          <span className="text-slate-600">|</span>
                          <button
                            className="text-[9px] text-red-400 hover:underline"
                            disabled={!!actionKey}
                            onClick={() => handleUnlink(profile)}
                          >{actionKey === "unlink" ? "⏳" : "✕"}</button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 border-dashed border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => openLinkModal(profile)}
                      >
                        🔗 Link
                      </Button>
                    )}
                  </TableCell>

                  {/* Row number */}
                  <TableCell className="py-2 text-center text-xs text-[hsl(var(--muted-foreground))]">
                    {rowNum}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-2 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {isRunning ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-6 text-[10px] px-2"
                          disabled={!!actionKey}
                          onClick={() => profileAction(profile.id, "stop")}
                        >
                          {actionKey === "stop" ? "..." : "Stop"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-6 text-[10px] px-2.5 bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={!!actionKey}
                          onClick={() => profileAction(profile.id, "start")}
                        >
                          {actionKey === "start" ? "..." : "Open"}
                        </Button>
                      )}
                      {/* 3-dot menu */}
                      <div className="relative">
                        <button
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] text-xs"
                          onClick={() => setMenuOpen(menuOpen === profile.id ? null : profile.id)}
                        >
                          ⋮
                        </button>
                        {menuOpen === profile.id && (
                          <div className="absolute right-0 top-7 z-50 w-40 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg py-1">
                            {!profile.lendingCard ? (
                              <button
                                className="w-full px-3 py-1.5 text-left text-xs text-amber-400 hover:bg-amber-500/10"
                                onClick={() => { openLinkModal(profile); setMenuOpen(null); }}
                              >🔗 Link Card + Proxy</button>
                            ) : (
                              <>
                                <button
                                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-[hsl(var(--muted))]"
                                  onClick={() => { handlePrelaunch(profile); setMenuOpen(null); }}
                                >🚀 Pre-launch Check</button>
                                <button
                                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-[hsl(var(--muted))]"
                                  onClick={() => { handleRotateIP(profile); setMenuOpen(null); }}
                                >🔄 Rotate IP</button>
                                <button
                                  className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10"
                                  onClick={() => { handleUnlink(profile); setMenuOpen(null); }}
                                >🔓 Unlink</button>
                              </>
                            )}
                            <hr className="my-1 border-[hsl(var(--border))]" />
                            <button
                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-[hsl(var(--muted))]"
                              onClick={() => { profileAction(profile.id, "clone"); setMenuOpen(null); }}
                            >📋 Clone</button>
                            <button
                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-[hsl(var(--muted))]"
                              onClick={() => { setExpandedRow(expandedRow === profile.id ? null : profile.id); setMenuOpen(null); }}
                            >📄 Details</button>
                            <hr className="my-1 border-[hsl(var(--border))]" />
                            <button
                              className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10"
                              onClick={() => { profileAction(profile.id, "delete"); setMenuOpen(null); }}
                            >🗑 Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
        <div>Total: {filtered.length}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            ‹
          </Button>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={page}
              min={1}
              max={totalPages}
              onChange={e => setPage(Math.min(totalPages, Math.max(1, Number(e.target.value) || 1)))}
              className="w-10 h-7 text-center text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
            />
            <span>/ {totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            ›
          </Button>
          <select
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="h-7 px-1 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
          >
            {[25, 50, 100].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      </div>

      {/* ── Link Modal ── */}
      {linkModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={() => !linking && setLinkModal(null)}>
          <div className="w-[480px] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
              <h2 className="text-base font-bold">🔗 Link Profile + Card + Proxy</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Profile: <span className="font-semibold text-[hsl(var(--foreground))]">{linkModal.profileName}</span>
              </p>
            </div>

            {/* Modal Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Account Label */}
              <div>
                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] block mb-1">Account Label</label>
                <input
                  type="text"
                  value={linkForm.label}
                  onChange={e => setLinkForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. RA1, Account-TH-01"
                  className="w-full h-8 px-3 text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                />
              </div>

              {/* Card Selection */}
              <div>
                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] block mb-1">💳 Lending Card *</label>
                <select
                  value={linkForm.cardUuid}
                  onChange={e => setLinkForm(f => ({ ...f, cardUuid: e.target.value }))}
                  className="w-full h-8 px-3 text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                >
                  <option value="">Select a card...</option>
                  {lcCards.map(c => (
                    <option key={c.uuid || c.id} value={c.uuid || c.id}>
                      {c.label || c.name || `Card ****${(c.card_number || "").slice(-4)}`}
                      {c.status ? ` (${c.status})` : ""}
                    </option>
                  ))}
                </select>
                {lcCards.length === 0 && (
                  <p className="text-[10px] text-amber-400 mt-1">No cards loaded. Check LendingCard API settings.</p>
                )}
              </div>

              {/* Provider Selection */}
              <div>
                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] block mb-1">🌐 Proxy Provider</label>
                <select
                  value={linkForm.provider}
                  onChange={e => setLinkForm(f => ({ ...f, provider: e.target.value }))}
                  className="w-full h-8 px-3 text-xs rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                >
                  <option value="">Auto (fallback chain)</option>
                  <option value="nodemaven">NodeMaven</option>
                  <option value="smartproxy">SmartProxy</option>
                  <option value="soax">SOAX</option>
                  <option value="brightdata">Bright Data</option>
                </select>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                  Auto = tries NodeMaven → SmartProxy → SOAX → Bright Data until quality passes
                </p>
              </div>

              {/* Result */}
              {linkResult && (
                <div className={`p-3 rounded-md text-xs ${linkResult.success
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
                }`}>
                  {linkResult.success ? (
                    <div>
                      <div className="font-bold">✅ Link successful!</div>
                      <div className="mt-1 space-y-0.5">
                        <div>IP: <span className="font-mono">{linkResult.resolvedIp}</span></div>
                        <div>Provider: {linkResult.proxyConfig?.providerName || linkResult.proxyConfig?.provider}</div>
                        <div>Trust Score: <span className="font-bold">{linkResult.qualityResult?.score || "—"}</span></div>
                        <div>Geo: {linkResult.geo?.city}, {linkResult.geo?.country}</div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-bold">❌ Link failed</div>
                      <div className="mt-1">{linkResult.error}</div>
                      {linkResult.conflicts?.length > 0 && (
                        <ul className="mt-1 list-disc list-inside">
                          {linkResult.conflicts.map((c, i) => <li key={i}>{c.message}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setLinkModal(null)} disabled={linking}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white px-4"
                onClick={handleLink}
                disabled={linking || !linkForm.cardUuid}
              >
                {linking ? "⏳ Validating & Linking..." : "🔗 Validate & Link"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
