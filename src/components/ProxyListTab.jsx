/**
 * ProxyListTab — Proxy Pool Manager with D1 + Quality Scanning
 *
 * Full proxy pool: CRUD, bulk import, quality scan (ASN/Fraud/Proxy/Geo),
 * D1 persistence via ops_proxy_pool, assign to Multilogin profiles.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { LS } from "../utils";
import { generateProxyPoolRowsFromSettings, getAvailableProviders } from "../services/proxy-providers.js";
import { QUALITY_TRUST_APPROVE_THRESHOLD } from "../services/ip-quality-pipeline.js";

function proxyFailsQualityScore(p) {
    if (p.status === "rejected") return true;
    const t = Number(p.trust_score);
    if (Number.isFinite(t) && t >= 0 && t < QUALITY_TRUST_APPROVE_THRESHOLD) return true;
    return false;
}
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const PROXY_TYPES = ["residential", "isp", "datacenter", "mobile"];
const STATUS_OPTIONS = ["pending", "approved", "rejected"];

/* ── helpers ── */

function uid() {
    return `px_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseProxyLine(line) {
    const t = line.trim();
    if (!t || t.startsWith("#")) return null;

    let host = "", port = "", user = "", pass = "";
    const atIdx = t.indexOf("@");
    if (atIdx > 0) {
        const auth = t.slice(0, atIdx);
        const hp = t.slice(atIdx + 1);
        const authParts = auth.split(":");
        user = authParts[0] || "";
        pass = authParts.slice(1).join(":") || "";
        const hpParts = hp.split(":");
        host = hpParts[0] || "";
        port = hpParts[1] || "";
    } else {
        const parts = t.split(":");
        if (parts.length >= 4) {
            host = parts[0]; port = parts[1]; user = parts[2]; pass = parts.slice(3).join(":");
        } else if (parts.length === 2) {
            host = parts[0]; port = parts[1];
        } else if (parts.length === 3) {
            host = parts[0]; port = parts[1]; user = parts[2];
        }
    }
    if (!host) return null;
    return { host, port, user, pass };
}

function scoreColor(score) {
    if (score < 0) return "text-[hsl(var(--muted-foreground))] opacity-40";
    if (score >= 70) return "text-emerald-500";
    if (score >= 40) return "text-amber-500";
    return "text-red-500";
}

function statusBadge(status) {
    const map = {
        approved: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
        rejected: "bg-red-500/15 text-red-500 border-red-500/20",
        pending: "bg-slate-500/15 text-slate-400 border-slate-500/20",
    };
    return map[status] || map.pending;
}

/* ── D1 Service ── */

async function d1Query(sql, params = []) {
    try {
        const d1Service = (await import("../services/d1.js")).default;
        return await d1Service.query(sql, params);
    } catch (e) {
        console.warn("[ProxyPool] D1 query failed:", e?.message);
        return null;
    }
}

async function d1Execute(sql, params = []) {
    try {
        const d1Service = (await import("../services/d1.js")).default;
        return await d1Service.execute(sql, params);
    } catch (e) {
        console.warn("[ProxyPool] D1 execute failed:", e?.message);
        return null;
    }
}

/* ── Proxy Form ── */

function ProxyForm({ proxy, onSave, onCancel }) {
    const [form, setForm] = useState(proxy || {
        host: "", port: "", username: "", password: "",
        provider: "", country: "", city: "", state: "",
    });
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
    const Lbl = ({ children }) => <label className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">{children}</label>;

    return (
        <div className="space-y-3 p-4 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Lbl>Host</Lbl><input value={form.host} onChange={e => set("host", e.target.value)} placeholder="gate.proxy.com" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono" /></div>
                <div><Lbl>Port</Lbl><input value={form.port} onChange={e => set("port", e.target.value)} placeholder="8080" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono" /></div>
                <div><Lbl>Username</Lbl><input value={form.username} onChange={e => set("username", e.target.value)} placeholder="user" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono" /></div>
                <div><Lbl>Password</Lbl><input type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="pass" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono" /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Lbl>Provider</Lbl>
                    <select value={form.provider} onChange={e => set("provider", e.target.value)} className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
                        <option value="">— select —</option>
                        <option value="nodemaven">NodeMaven</option>
                        <option value="smartproxy">SmartProxy</option>
                        <option value="soax">SOAX</option>
                        <option value="brightdata">Bright Data</option>
                        <option value="manual">Manual</option>
                    </select>
                </div>
                <div><Lbl>Country</Lbl><input value={form.country} onChange={e => set("country", e.target.value.toUpperCase())} placeholder="TH" maxLength={2} className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono" /></div>
                <div><Lbl>State / Region</Lbl><input value={form.state} onChange={e => set("state", e.target.value)} placeholder="Bangkok" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]" /></div>
                <div><Lbl>City</Lbl><input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Bangkok" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]" /></div>
            </div>
            <div className="flex gap-2 justify-end">
                {onCancel && <Button variant="outline" size="sm" onClick={onCancel} className="text-xs h-7">Cancel</Button>}
                <Button size="sm" onClick={() => onSave(form)} className="text-xs h-7">{proxy ? "Update" : "Add Proxy"}</Button>
            </div>
        </div>
    );
}

/* ── Main Component ── */

export function ProxyListTab({ accounts = [], profiles = [] }) {
    const [proxies, setProxies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showBulk, setShowBulk] = useState(false);
    const [bulkText, setBulkText] = useState("");
    const [bulkProvider, setBulkProvider] = useState("nodemaven");
    const [bulkCountry, setBulkCountry] = useState("TH");
    const [showFromSettings, setShowFromSettings] = useState(false);
    const [pullProvider, setPullProvider] = useState("nodemaven");
    const [pullCount, setPullCount] = useState(10);
    const [pullCountry, setPullCountry] = useState("US");
    const [pullState, setPullState] = useState("");
    const [pullCity, setPullCity] = useState("");
    const [pullFilter, setPullFilter] = useState("medium");
    const [pulling, setPulling] = useState(false);
    const [pullError, setPullError] = useState(null);
    const [bulkDeletingScore, setBulkDeletingScore] = useState(false);
    const [filter, setFilter] = useState("all");
    const [scanning, setScanning] = useState(null); // null | "all" | proxy_id
    const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
    const abortRef = useRef(null);

    /* ── Load from D1 ── */
    const loadProxies = useCallback(async () => {
        setLoading(true);
        const result = await d1Query("SELECT * FROM ops_proxy_pool ORDER BY created_at DESC");
        if (result?.success && Array.isArray(result.results)) {
            setProxies(result.results);
        } else {
            // Fallback: load from localStorage for backward compat
            try {
                const raw = localStorage.getItem("fusionops_proxy_list");
                if (raw) {
                    const old = JSON.parse(raw);
                    // Migrate old format
                    setProxies(old.map(p => ({
                        id: p.id || uid(),
                        host: p.host || "",
                        port: p.port || "",
                        username: p.user || p.username || "",
                        password: p.pass || p.password || "",
                        provider: p.provider || "manual",
                        country: p.country || "",
                        city: p.city || "",
                        state: p.state || "",
                        asn: "", isp: "",
                        fraud_score: -1, trust_score: -1, latency_ms: -1,
                        timezone: "", is_proxy: -1,
                        status: p.status === "active" ? "pending" : p.status || "pending",
                        assigned_to: p.assignedTo || "",
                        scan_details: "",
                        last_scan_at: "",
                        created_at: p.createdAt || new Date().toISOString(),
                    })));
                }
            } catch { }
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadProxies(); }, [loadProxies]);

    /* ── D1 Persist ── */
    const saveProxy = async (proxy) => {
        const result = await d1Execute(
            `INSERT OR REPLACE INTO ops_proxy_pool (id, host, port, username, password, provider, country, city, state, asn, isp, fraud_score, trust_score, latency_ms, timezone, is_proxy, status, assigned_to, scan_details, last_scan_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [proxy.id, proxy.host, proxy.port, proxy.username, proxy.password, proxy.provider, proxy.country, proxy.city, proxy.state, proxy.asn || "", proxy.isp || "", proxy.fraud_score ?? -1, proxy.trust_score ?? -1, proxy.latency_ms ?? -1, proxy.timezone || "", proxy.is_proxy ?? -1, proxy.status || "pending", proxy.assigned_to || "", proxy.scan_details || "", proxy.last_scan_at || "", proxy.created_at || new Date().toISOString()]
        );
        if (!result || !result.success) {
            console.warn("[ProxyPool] saveProxy failed:", result?.error || "D1 unavailable");
            return false;
        }
        return true;
    };

    const deleteProxy = async (id) => {
        const result = await d1Execute("DELETE FROM ops_proxy_pool WHERE id = ?", [id]);
        if (!result || !result.success) {
            console.warn("[ProxyPool] deleteProxy failed:", result?.error || "D1 unavailable");
        }
        setProxies(prev => prev.filter(p => p.id !== id));
    };

    /** Remove proxies that failed quality scan (rejected or trust < threshold). */
    const purgeFailingByScore = async (includeAssigned) => {
        const failing = proxies.filter(proxyFailsQualityScore);
        const targets = includeAssigned ? failing : failing.filter((p) => !p.assigned_to);
        if (targets.length === 0) return;

        const assignedInTargets = targets.filter((p) => p.assigned_to).length;
        if (!includeAssigned && failing.length > targets.length) {
            const skipped = failing.length - targets.length;
            if (!window.confirm(
                `ลบ ${targets.length} พร็อกซีที่ไม่ผ่านเกณฑ์ (rejected หรือ Trust < ${QUALITY_TRUST_APPROVE_THRESHOLD}) — เฉพาะที่ยังไม่ assign\n` +
                `(ข้าม ${skipped} รายการที่ assign อยู่ — ใช้ปุ่ม "รวมที่ assign" ถ้าต้องการลบด้วย)`
            )) return;
        } else if (includeAssigned && assignedInTargets > 0) {
            if (!window.confirm(
                `ลบ ${targets.length} พร็อกซีที่ไม่ผ่านเกณฑ์ รวม ${assignedInTargets} รายการที่ผูก profile อยู่ — แน่ใจหรือไม่?`
            )) return;
        } else if (!window.confirm(
            `ลบ ${targets.length} พร็อกซีที่ไม่ผ่านเกณฑ์ (rejected หรือ Trust < ${QUALITY_TRUST_APPROVE_THRESHOLD})?`
        )) return;

        setBulkDeletingScore(true);
        const removed = [];
        try {
            for (const p of targets) {
                const result = await d1Execute("DELETE FROM ops_proxy_pool WHERE id = ?", [p.id]);
                if (result?.success) removed.push(p.id);
            }
            if (removed.length < targets.length) {
                console.warn("[ProxyPool] purgeFailingByScore: some D1 deletes failed");
            }
            const rm = new Set(removed);
            setProxies((prev) => prev.filter((p) => !rm.has(p.id)));
        } finally {
            setBulkDeletingScore(false);
        }
    };

    /* ── Add / Update ── */
    const addProxy = async (form) => {
        const proxy = {
            id: uid(), ...form,
            asn: "", isp: "",
            fraud_score: -1, trust_score: -1, latency_ms: -1,
            timezone: "", is_proxy: -1,
            status: "pending", assigned_to: "",
            scan_details: "", last_scan_at: "",
            created_at: new Date().toISOString(),
        };
        const saved = await saveProxy(proxy);
        if (!saved) {
            console.warn("[ProxyPool] addProxy: D1 save failed, adding to local state only");
        }
        setProxies(prev => [proxy, ...prev]);
        setShowAdd(false);
    };

    const updateProxy = async (form) => {
        const existing = proxies.find(p => p.id === editId);
        if (!existing) return;
        const updated = { ...existing, ...form };
        const saved = await saveProxy(updated);
        if (!saved) {
            console.warn("[ProxyPool] updateProxy: D1 save failed, updating local state only");
        }
        setProxies(prev => prev.map(p => p.id === editId ? updated : p));
        setEditId(null);
    };

    /* ── Bulk Import ── */
    const bulkImport = async () => {
        const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
        const parsed = lines.map(parseProxyLine).filter(Boolean);
        if (parsed.length === 0) return;

        const newProxies = parsed.map(p => ({
            id: uid(),
            host: p.host, port: p.port,
            username: p.user, password: p.pass,
            provider: bulkProvider,
            country: bulkCountry, city: "", state: "",
            asn: "", isp: "",
            fraud_score: -1, trust_score: -1, latency_ms: -1,
            timezone: "", is_proxy: -1,
            status: "pending", assigned_to: "",
            scan_details: "", last_scan_at: "",
            created_at: new Date().toISOString(),
        }));

        // Batch insert to D1
        for (const px of newProxies) {
            await saveProxy(px);
        }
        setProxies(prev => [...newProxies, ...prev]);
        setShowBulk(false);
        setBulkText("");
    };

    /* ── Generate rows from Settings credentials (gateway + session usernames) ── */
    const configuredProviders = useCallback(() => {
        const s = LS.get("settings") || {};
        return getAvailableProviders(s).filter((p) => p.configured);
    }, []);

    useEffect(() => {
        if (!showFromSettings) return;
        const list = configuredProviders();
        if (list.length && !list.some((p) => p.id === pullProvider)) {
            setPullProvider(list[0].id);
        }
    }, [showFromSettings, pullProvider, configuredProviders]);

    const pullFromSettings = async () => {
        setPullError(null);
        const s = LS.get("settings") || {};
        const available = getAvailableProviders(s).filter((p) => p.configured);
        if (available.length === 0) {
            setPullError("ยังไม่ได้ตั้งค่า proxy ใน Settings → ใส่ NodeMaven / SmartProxy / SOAX / Bright Data ก่อน");
            return;
        }
        if (!available.some((p) => p.id === pullProvider)) {
            setPullError("เลือกผู้ให้บริการที่ตั้งค่า credentials แล้ว");
            return;
        }
        setPulling(true);
        try {
            const { rows, error } = generateProxyPoolRowsFromSettings(
                pullProvider,
                pullCount,
                {
                    country: pullCountry.trim(),
                    state: pullState.trim(),
                    city: pullCity.trim(),
                    filter: pullFilter,
                    protocol: "http",
                },
                s
            );
            if (error) {
                setPullError(error);
                return;
            }
            const newProxies = rows.map((r) => ({
                id: uid(),
                host: r.host,
                port: r.port,
                username: r.username,
                password: r.password,
                provider: r.provider,
                country: r.country,
                city: r.city,
                state: r.state,
                asn: "",
                isp: "",
                fraud_score: -1,
                trust_score: -1,
                latency_ms: -1,
                timezone: "",
                is_proxy: -1,
                status: "pending",
                assigned_to: "",
                scan_details: "",
                last_scan_at: "",
                created_at: new Date().toISOString(),
            }));
            for (const px of newProxies) {
                await saveProxy(px);
            }
            setProxies((prev) => [...newProxies, ...prev]);
            setShowFromSettings(false);
        } catch (e) {
            setPullError(e?.message || "ดึงรายการไม่สำเร็จ");
        } finally {
            setPulling(false);
        }
    };

    /* ── Quality Scan ── */
    const scanProxy = async (proxy) => {
        try {
            const { runQualityPipeline } = await import("../services/ip-quality-pipeline.js");

            // First resolve the IP via proxy
            const { nodemavenApi } = await import("../services/nodemaven.js");
            const settings = LS.get("settings") || {};
            const ipResult = await nodemavenApi.resolveIP(
                {
                    host: proxy.host,
                    port: Number(proxy.port),
                    username: proxy.username,
                    password: proxy.password,
                    protocol: "http",
                },
                settings
            );

            const ip = ipResult?.ip || ipResult?.query;
            if (!ip) {
                return {
                    ...proxy,
                    status: "rejected",
                    trust_score: 0,
                    scan_details: JSON.stringify({ error: "Could not resolve IP" }),
                    last_scan_at: new Date().toISOString(),
                };
            }

            const result = await runQualityPipeline(ip, {
                country: proxy.country,
                state: proxy.state,
                city: proxy.city,
            });

            return {
                ...proxy,
                asn: result.steps?.find(s => s.name === "asn")?.asn || proxy.asn,
                isp: result.steps?.find(s => s.name === "asn")?.isp || proxy.isp,
                fraud_score: result.steps?.find(s => s.name === "fraud")?.fraudScore ?? proxy.fraud_score,
                trust_score: result.score ?? proxy.trust_score,
                latency_ms: result.steps?.find(s => s.name === "latency")?.latencyMs ?? proxy.latency_ms,
                timezone: result.steps?.find(s => s.name === "timezone_geo")?.ipTimezone || proxy.timezone,
                is_proxy: result.steps?.find(s => s.name === "proxy_vpn")?.isProxy ? 1 : 0,
                status: result.verdict === "APPROVE" ? "approved" : "rejected",
                scan_details: JSON.stringify(result),
                last_scan_at: new Date().toISOString(),
            };
        } catch (e) {
            return {
                ...proxy,
                status: "rejected",
                trust_score: 0,
                scan_details: JSON.stringify({ error: e?.message }),
                last_scan_at: new Date().toISOString(),
            };
        }
    };

    const scanSingle = async (proxyId) => {
        setScanning(proxyId);
        const proxy = proxies.find(p => p.id === proxyId);
        if (!proxy) { setScanning(null); return; }

        const updated = await scanProxy(proxy);
        await saveProxy(updated);
        setProxies(prev => prev.map(p => p.id === proxyId ? updated : p));
        setScanning(null);
    };

    const scanAll = async () => {
        const pending = proxies.filter(p => p.status === "pending" || p.trust_score < 0);
        if (pending.length === 0) return;

        setScanning("all");
        setScanProgress({ done: 0, total: pending.length });
        abortRef.current = false;

        for (let i = 0; i < pending.length; i++) {
            if (abortRef.current) break;
            const updated = await scanProxy(pending[i]);
            await saveProxy(updated);
            setProxies(prev => prev.map(p => p.id === updated.id ? updated : p));
            setScanProgress({ done: i + 1, total: pending.length });
        }
        setScanning(null);
    };

    /* ── Export ── */
    const exportList = () => {
        const text = proxies.map(p => {
            if (p.username && p.password) return `${p.host}:${p.port}:${p.username}:${p.password}`;
            return `${p.host}:${p.port}`;
        }).join("\n");
        navigator.clipboard.writeText(text).catch(() => { });
    };

    /* ── Filter ── */
    const filtered = proxies.filter(p => {
        if (filter === "all") return true;
        if (filter === "unassigned") return !p.assigned_to;
        if (filter === "assigned") return !!p.assigned_to;
        if (filter === "approved" || filter === "rejected" || filter === "pending") return p.status === filter;
        return true;
    });

    const counts = {
        total: proxies.length,
        approved: proxies.filter(p => p.status === "approved").length,
        rejected: proxies.filter(p => p.status === "rejected").length,
        pending: proxies.filter(p => p.status === "pending").length,
        assigned: proxies.filter(p => p.assigned_to).length,
    };

    const lsSettings = LS.get("settings") || {};
    const pullConfiguredProviders = getAvailableProviders(lsSettings).filter((p) => p.configured);

    const failingProxies = proxies.filter(proxyFailsQualityScore);
    const failingUnassignedCount = failingProxies.filter((p) => !p.assigned_to).length;
    const failingAssignedOnlyCount = failingProxies.filter((p) => !!p.assigned_to).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold">Proxy Pool</h3>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {counts.total} proxies &middot; {counts.approved} approved &middot; {counts.assigned} assigned &middot; {counts.pending} pending scan
                    </p>
                </div>
                <div className="flex gap-2">
                    {scanning === "all" ? (
                        <Button variant="outline" size="sm" onClick={() => { abortRef.current = true; }} className="text-xs h-7 text-amber-500 border-amber-500/30">
                            Stop ({scanProgress.done}/{scanProgress.total})
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={scanAll} disabled={!!scanning || counts.pending === 0} className="text-xs h-7">
                            Scan All ({counts.pending})
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => purgeFailingByScore(false)}
                        disabled={!!scanning || bulkDeletingScore || failingUnassignedCount === 0}
                        className="text-xs h-7 text-red-400 border-red-500/30 hover:bg-red-500/10"
                        title={`ลบรายการที่ status=rejected หรือ Trust ต่ำกว่า ${QUALITY_TRUST_APPROVE_THRESHOLD} (ยังไม่ assign)`}
                    >
                        {bulkDeletingScore ? "…" : `ลบไม่ผ่าน (${failingUnassignedCount})`}
                    </Button>
                    {failingAssignedOnlyCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => purgeFailingByScore(true)}
                            disabled={!!scanning || bulkDeletingScore}
                            className="text-xs h-7 text-amber-500/90 border-amber-500/35 hover:bg-amber-500/10"
                            title="ลบทุกรายการที่ไม่ผ่านเกณฑ์ รวมที่ assign แล้ว"
                        >
                            ลบรวม assign ({failingProxies.length})
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => { setShowFromSettings((v) => !v); setPullError(null); }} className="text-xs h-7">
                        จาก Settings
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowBulk(v => !v)} className="text-xs h-7">Bulk Import</Button>
                    <Button variant="outline" size="sm" onClick={exportList} className="text-xs h-7">Export</Button>
                    <Button size="sm" onClick={() => { setShowAdd(v => !v); setEditId(null); }} className="text-xs h-7">+ Add</Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-2">
                {[
                    { label: "Total", value: counts.total },
                    { label: "Approved", value: counts.approved, color: "text-emerald-500" },
                    { label: "Rejected", value: counts.rejected, color: "text-red-500" },
                    { label: "Pending", value: counts.pending, color: "text-slate-400" },
                    { label: "Assigned", value: counts.assigned, color: "text-blue-400" },
                ].map((k, i) => (
                    <div key={i} className="text-center p-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                        <div className={`text-lg font-bold ${k.color || ""}`}>{k.value}</div>
                        <div className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Generate from Settings (saved API credentials → gateway rows with unique sessions) */}
            {showFromSettings && (
                <Card>
                    <CardContent className="pt-4 space-y-3">
                        <h4 className="text-xs font-semibold">ดึงพร็อกซีจาก Settings</h4>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                            สร้างรายการ <code className="text-[9px]">host:port:user:pass</code> จาก credentials ที่บันทึกใน Settings (แยก session ต่อแถว)
                            — ไม่ต้องคัดลอกจากแดชบอร์ดผู้ให้บริการ โหมดนี้เหมาะกับ residential backconnect (NodeMaven, Decodo/SmartProxy ฯลฯ)
                        </p>
                        {pullError && (
                            <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">{pullError}</div>
                        )}
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))] block mb-1">ผู้ให้บริการ</label>
                                <select
                                    value={pullProvider}
                                    onChange={(e) => setPullProvider(e.target.value)}
                                    className="px-2 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] min-w-[140px]"
                                >
                                    {pullConfiguredProviders.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                    {pullConfiguredProviders.length === 0 && (
                                        <option value="nodemaven">— ตั้งค่าใน Settings ก่อน —</option>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))] block mb-1">จำนวนแถว</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={pullCount}
                                    onChange={(e) => setPullCount(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 10)))}
                                    className="w-20 px-2 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))] block mb-1">ประเทศ (optional)</label>
                                <input
                                    value={pullCountry}
                                    onChange={(e) => setPullCountry(e.target.value.toUpperCase())}
                                    maxLength={2}
                                    placeholder="US"
                                    className="w-14 px-2 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))] block mb-1">รัฐ/ภูมิภาค</label>
                                <input
                                    value={pullState}
                                    onChange={(e) => setPullState(e.target.value)}
                                    placeholder="optional"
                                    className="w-28 px-2 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))] block mb-1">เมือง</label>
                                <input
                                    value={pullCity}
                                    onChange={(e) => setPullCity(e.target.value)}
                                    placeholder="optional"
                                    className="w-28 px-2 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]"
                                />
                            </div>
                            {pullProvider === "nodemaven" && (
                                <div>
                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] block mb-1">IP quality filter</label>
                                    <select
                                        value={pullFilter}
                                        onChange={(e) => setPullFilter(e.target.value)}
                                        className="px-2 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]"
                                    >
                                        <option value="low">low</option>
                                        <option value="medium">medium</option>
                                        <option value="high">high</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowFromSettings(false)} className="text-xs h-7">
                                ปิด
                            </Button>
                            <Button size="sm" onClick={pullFromSettings} disabled={pulling} className="text-xs h-7">
                                {pulling ? "กำลังเพิ่ม…" : "เพิ่มเข้า Pool"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bulk Import */}
            {showBulk && (
                <Card>
                    <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <h4 className="text-xs font-semibold">Bulk Import</h4>
                            <select value={bulkProvider} onChange={e => setBulkProvider(e.target.value)} className="px-2 py-1 text-[10px] rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
                                <option value="nodemaven">NodeMaven</option>
                                <option value="smartproxy">SmartProxy</option>
                                <option value="soax">SOAX</option>
                                <option value="brightdata">Bright Data</option>
                                <option value="manual">Manual</option>
                            </select>
                            <input value={bulkCountry} onChange={e => setBulkCountry(e.target.value.toUpperCase())} maxLength={2} placeholder="TH" className="w-12 px-2 py-1 text-[10px] rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono text-center" />
                        </div>
                        <textarea
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            placeholder={"host:port:user:pass\nuser:pass@host:port\n# lines starting with # are ignored"}
                            rows={6}
                            className="w-full px-3 py-2 text-xs font-mono rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] resize-y"
                        />
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                {bulkText.split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).length} lines detected
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setShowBulk(false)} className="text-xs h-7">Cancel</Button>
                                <Button size="sm" onClick={bulkImport} className="text-xs h-7">Import</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Add/Edit form */}
            {showAdd && <ProxyForm onSave={addProxy} onCancel={() => setShowAdd(false)} />}
            {editId && <ProxyForm proxy={proxies.find(p => p.id === editId)} onSave={updateProxy} onCancel={() => setEditId(null)} />}

            {/* Filters */}
            <div className="flex gap-1.5">
                {[
                    { id: "all", label: "All" },
                    { id: "approved", label: "Approved" },
                    { id: "rejected", label: "Rejected" },
                    { id: "pending", label: "Pending" },
                    { id: "assigned", label: "Assigned" },
                    { id: "unassigned", label: "Unassigned" },
                ].map(f => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-colors ${filter === f.id
                            ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10 text-[hsl(var(--foreground))]"
                            : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                            }`}
                    >{f.label}</button>
                ))}
            </div>

            {/* Proxy Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="text-center py-12 text-sm text-[hsl(var(--muted-foreground))]">Loading proxy pool...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">No proxies. Add or bulk import your proxy list.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead>Host:Port</TableHead>
                                        <TableHead>Provider</TableHead>
                                        <TableHead>Country</TableHead>
                                        <TableHead>ASN / ISP</TableHead>
                                        <TableHead className="text-center">Trust</TableHead>
                                        <TableHead className="text-center">Fraud</TableHead>
                                        <TableHead className="text-center">Latency</TableHead>
                                        <TableHead>Timezone</TableHead>
                                        <TableHead>Assigned To</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-24"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(p => (
                                        <TableRow key={p.id} className={scanning === p.id ? "opacity-50" : ""}>
                                            <TableCell>
                                                <span className={`w-2 h-2 rounded-full inline-block ${p.status === "approved" ? "bg-emerald-500" : p.status === "rejected" ? "bg-red-500" : "bg-slate-400"}`} />
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {p.host}:{p.port}
                                                {p.username && <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate max-w-[120px]">{p.username}</div>}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px]">{p.provider || "manual"}</Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {p.country || "—"}
                                                {p.city && <span className="text-[hsl(var(--muted-foreground))]"> / {p.city}</span>}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {p.asn ? (
                                                    <div>
                                                        <span className="font-mono text-[10px]">{p.asn}</span>
                                                        {p.isp && <div className="text-[9px] text-[hsl(var(--muted-foreground))] truncate max-w-[100px]">{p.isp}</div>}
                                                    </div>
                                                ) : <span className="text-[hsl(var(--muted-foreground))] opacity-40">—</span>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`font-mono text-xs font-bold ${scoreColor(p.trust_score)}`}>
                                                    {p.trust_score >= 0 ? p.trust_score : "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`font-mono text-xs ${p.fraud_score >= 0 ? (p.fraud_score < 40 ? "text-emerald-500" : "text-red-500") : "text-[hsl(var(--muted-foreground))] opacity-40"}`}>
                                                    {p.fraud_score >= 0 ? p.fraud_score : "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`font-mono text-xs ${p.latency_ms >= 0 ? (p.latency_ms < 1000 ? "text-emerald-500" : p.latency_ms < 2000 ? "text-amber-500" : "text-red-500") : "text-[hsl(var(--muted-foreground))] opacity-40"}`}>
                                                    {p.latency_ms >= 0 ? `${p.latency_ms}ms` : "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-mono text-[10px]">
                                                {p.timezone || <span className="text-[hsl(var(--muted-foreground))] opacity-40">—</span>}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {p.assigned_to ? (
                                                    <span className="text-blue-400 font-medium truncate max-w-[80px] block">{p.assigned_to}</span>
                                                ) : (
                                                    <span className="text-[hsl(var(--muted-foreground))] opacity-40">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusBadge(p.status)}`}>
                                                    {p.status}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => scanSingle(p.id)}
                                                        disabled={!!scanning}
                                                        className="px-1.5 py-0.5 text-[10px] rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] disabled:opacity-30"
                                                        title="Scan quality"
                                                    >{scanning === p.id ? "..." : "Scan"}</button>
                                                    <button onClick={() => { setEditId(p.id); setShowAdd(false); }} className="px-1.5 py-0.5 text-[10px] rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]" title="Edit">Edit</button>
                                                    <button onClick={() => {
                                                        navigator.clipboard.writeText(`${p.host}:${p.port}${p.username ? `:${p.username}:${p.password}` : ""}`);
                                                    }} className="px-1.5 py-0.5 text-[10px] rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]" title="Copy">Copy</button>
                                                    <button onClick={() => deleteProxy(p.id)} className="px-1.5 py-0.5 text-[10px] rounded border border-red-500/30 hover:bg-red-500/10 text-red-500" title="Delete">&times;</button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default ProxyListTab;
