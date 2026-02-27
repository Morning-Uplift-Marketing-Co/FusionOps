/**
 * ProxyListTab — Manage Residential/ISP Proxy Pool
 * CRUD proxy list, assign to accounts/profiles, bulk import
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const PROXY_TYPES = ["residential", "isp", "datacenter", "mobile"];

function parseProxyLine(line) {
    // Supports: host:port:user:pass  |  host:port@user:pass  |  user:pass@host:port  |  host:port
    const t = line.trim();
    if (!t || t.startsWith("#")) return null;

    let host = "", port = "", user = "", pass = "";

    // user:pass@host:port
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
            // host:port:user:pass
            host = parts[0];
            port = parts[1];
            user = parts[2];
            pass = parts.slice(3).join(":");
        } else if (parts.length === 2) {
            host = parts[0];
            port = parts[1];
        } else if (parts.length === 3) {
            host = parts[0];
            port = parts[1];
            user = parts[2];
        }
    }

    if (!host) return null;
    return { host, port, user, pass };
}

function ProxyForm({ proxy, onSave, onCancel }) {
    const [form, setForm] = useState(proxy || { host: "", port: "", user: "", pass: "", type: "residential", country: "US", label: "", assignedTo: "" });
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    return (
        <div className="space-y-3 p-4 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                    <label className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Host</label>
                    <input value={form.host} onChange={e => set("host", e.target.value)} placeholder="gate.proxy.com" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono" />
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Port</label>
                    <input value={form.port} onChange={e => set("port", e.target.value)} placeholder="9000" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono" />
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Username</label>
                    <input value={form.user} onChange={e => set("user", e.target.value)} placeholder="user" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono" />
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Password</label>
                    <input type="password" value={form.pass} onChange={e => set("pass", e.target.value)} placeholder="pass" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono" />
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                    <label className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Type</label>
                    <select value={form.type} onChange={e => set("type", e.target.value)} className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
                        {PROXY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Country</label>
                    <input value={form.country} onChange={e => set("country", e.target.value.toUpperCase())} placeholder="US" maxLength={2} className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono" />
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Label</label>
                    <input value={form.label} onChange={e => set("label", e.target.value)} placeholder="Acc-01 proxy" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]" />
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Assigned To</label>
                    <input value={form.assignedTo} onChange={e => set("assignedTo", e.target.value)} placeholder="Account name" className="w-full px-2.5 py-1.5 text-xs rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]" />
                </div>
            </div>
            <div className="flex gap-2 justify-end">
                {onCancel && <Button variant="outline" size="sm" onClick={onCancel} className="text-xs h-7">Cancel</Button>}
                <Button size="sm" onClick={() => onSave(form)} className="text-xs h-7">{proxy ? "Update" : "Add Proxy"}</Button>
            </div>
        </div>
    );
}

const LS_KEY = "fusionops_proxy_list";

export function ProxyListTab({ accounts = [], profiles = [] }) {
    const [proxies, setProxies] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showBulk, setShowBulk] = useState(false);
    const [bulkText, setBulkText] = useState("");
    const [bulkType, setBulkType] = useState("residential");
    const [bulkCountry, setBulkCountry] = useState("US");
    const [filter, setFilter] = useState("all");

    // Load from localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) setProxies(JSON.parse(raw));
        } catch { }
    }, []);

    // Persist
    const persist = useCallback((list) => {
        setProxies(list);
        localStorage.setItem(LS_KEY, JSON.stringify(list));
    }, []);

    const addProxy = (form) => {
        const id = `px_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        persist([{ id, ...form, status: "active", createdAt: new Date().toISOString() }, ...proxies]);
        setShowAdd(false);
    };

    const updateProxy = (form) => {
        persist(proxies.map(p => p.id === editId ? { ...p, ...form } : p));
        setEditId(null);
    };

    const deleteProxy = (id) => {
        persist(proxies.filter(p => p.id !== id));
    };

    const toggleStatus = (id) => {
        persist(proxies.map(p => p.id === id ? { ...p, status: p.status === "active" ? "paused" : "active" } : p));
    };

    const bulkImport = () => {
        const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
        const parsed = lines.map(parseProxyLine).filter(Boolean);
        if (parsed.length === 0) return;

        const newProxies = parsed.map((p, i) => ({
            id: `px_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
            ...p,
            type: bulkType,
            country: bulkCountry,
            label: "",
            assignedTo: "",
            status: "active",
            createdAt: new Date().toISOString(),
        }));
        persist([...newProxies, ...proxies]);
        setShowBulk(false);
        setBulkText("");
    };

    const exportList = () => {
        const text = proxies.map(p => {
            if (p.user && p.pass) return `${p.host}:${p.port}:${p.user}:${p.pass}`;
            return `${p.host}:${p.port}`;
        }).join("\n");
        navigator.clipboard.writeText(text).catch(() => { });
    };

    const filtered = proxies.filter(p => {
        if (filter === "all") return true;
        if (filter === "unassigned") return !p.assignedTo;
        if (filter === "assigned") return !!p.assignedTo;
        return p.type === filter;
    });

    const typeCounts = PROXY_TYPES.reduce((acc, t) => {
        acc[t] = proxies.filter(p => p.type === t).length;
        return acc;
    }, {});

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold">🌐 Proxy Pool Manager</h3>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {proxies.length} proxies • {proxies.filter(p => p.assignedTo).length} assigned • {proxies.filter(p => !p.assignedTo).length} available
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowBulk(v => !v)} className="text-xs h-7">📋 Bulk Import</Button>
                    <Button variant="outline" size="sm" onClick={exportList} className="text-xs h-7">📤 Export</Button>
                    <Button size="sm" onClick={() => { setShowAdd(v => !v); setEditId(null); }} className="text-xs h-7">+ Add Proxy</Button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-6 gap-2">
                {[
                    { label: "Total", value: proxies.length },
                    { label: "Active", value: proxies.filter(p => p.status === "active").length, color: "emerald" },
                    ...PROXY_TYPES.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: typeCounts[t] || 0 })),
                ].map((k, i) => (
                    <div key={i} className="text-center p-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                        <div className={`text-lg font-bold ${k.color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{k.value}</div>
                        <div className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Bulk Import */}
            {showBulk && (
                <Card>
                    <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <h4 className="text-xs font-semibold">Bulk Import</h4>
                            <select value={bulkType} onChange={e => setBulkType(e.target.value)} className="px-2 py-1 text-[10px] rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
                                {PROXY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input value={bulkCountry} onChange={e => setBulkCountry(e.target.value.toUpperCase())} maxLength={2} placeholder="US" className="w-12 px-2 py-1 text-[10px] rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono text-center" />
                        </div>
                        <textarea
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            placeholder={"host:port:user:pass\nhost:port:user:pass\nuser:pass@host:port\n# lines starting with # are ignored"}
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
                    { id: "assigned", label: "Assigned" },
                    { id: "unassigned", label: "Unassigned" },
                    ...PROXY_TYPES.map(t => ({ id: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
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
                    {filtered.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-3xl mb-2">🌐</div>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">No proxies yet. Add or bulk import your proxy list.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead>Host:Port</TableHead>
                                        <TableHead>Auth</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Country</TableHead>
                                        <TableHead>Label</TableHead>
                                        <TableHead>Assigned To</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-20"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell>
                                                <span className={`w-2 h-2 rounded-full inline-block ${p.status === "active" ? "bg-emerald-500" : "bg-gray-400"}`} />
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{p.host}:{p.port}</TableCell>
                                            <TableCell className="text-xs">
                                                {p.user ? <span className="text-[hsl(var(--muted-foreground))]">{p.user}:••••</span> : <span className="text-[hsl(var(--muted-foreground))] opacity-40">none</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{p.country || "—"}</TableCell>
                                            <TableCell className="text-xs">{p.label || "—"}</TableCell>
                                            <TableCell className="text-xs font-medium">
                                                {p.assignedTo ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400">{p.assignedTo}</span>
                                                ) : (
                                                    <span className="text-[hsl(var(--muted-foreground))] opacity-50">unassigned</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    onClick={() => toggleStatus(p.id)}
                                                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full cursor-pointer ${p.status === "active"
                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                                                        : "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400"
                                                        }`}
                                                >{p.status}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <button onClick={() => { setEditId(p.id); setShowAdd(false); }} className="px-1.5 py-0.5 text-[10px] rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]" title="Edit">✏️</button>
                                                    <button onClick={() => { navigator.clipboard.writeText(`${p.host}:${p.port}${p.user ? `:${p.user}:${p.pass}` : ""}`); }} className="px-1.5 py-0.5 text-[10px] rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]" title="Copy">📋</button>
                                                    <button onClick={() => deleteProxy(p.id)} className="px-1.5 py-0.5 text-[10px] rounded border border-red-500/30 hover:bg-red-500/10 text-red-500" title="Delete">✕</button>
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
