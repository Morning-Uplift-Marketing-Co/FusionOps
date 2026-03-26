import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { buildApiUrlWithBase } from "../../services/api.js";

async function fetchTrackingJson(url, label, headers) {
    const res = await fetch(url, { headers: headers || {} });
    const text = await res.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith("<")) {
        throw new Error(
            `${label}: ได้หน้า HTML แทน JSON — ตั้ง VITE_API_BASE หรือ Settings → API base ให้ชี้ Cloudflare Worker (ลงท้าย /api) เพื่อ /api/postbacks และ /api/pixel/events`
        );
    }
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`${label}: ตอบกลับไม่ใช่ JSON (HTTP ${res.status})`);
    }
    if (!res.ok) {
        const msg = data?.error || data?.message || String(JSON.stringify(data)).slice(0, 160);
        throw new Error(`${label}: HTTP ${res.status} — ${msg}`);
    }
    return data;
}

const fmt$ = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtTime = (ts) => {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const STATUS = {
    matched:        { label: "Matched",       cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
    postback_only:  { label: "No Pixel",      cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
    pixel_only:     { label: "No Postback",   cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
    unknown:        { label: "Unknown",       cls: "bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400" },
};

function reconcile(postbacks, pixelEvents) {
    const rows = [];

    // Index pixel events by click_id (keep last lg_success/lg_approved/lg_submit per click_id)
    const pixelMap = new Map();
    for (const ev of pixelEvents) {
        const cid = ev.click_id;
        if (!cid) continue;
        const existing = pixelMap.get(cid);
        if (!existing || ev.ts > existing.ts) pixelMap.set(cid, ev);
    }

    // Index postbacks by click_id (keep last per click_id)
    const postbackMap = new Map();
    for (const pb of postbacks) {
        const cid = pb.click_id;
        if (!cid) continue;
        const existing = postbackMap.get(cid);
        if (!existing || pb.ts > existing.ts) postbackMap.set(cid, pb);
    }

    // All postbacks → matched or postback_only
    for (const [cid, pb] of postbackMap) {
        const px = pixelMap.get(cid);
        rows.push({
            click_id: cid,
            domain: pb.domain || "—",
            payout: pb.payout,
            type: pb.type,
            lead_id: pb.lead_id,
            postback_ts: pb.ts,
            pixel_ts: px?.ts || null,
            pixel_event: px?.event || null,
            status: px ? "matched" : "postback_only",
        });
    }

    // Pixel events with no postback (lg_submit or lg_success only)
    const submitEvents = new Set(["lg_submit", "lg_success", "lg_approved", "lg_form_load"]);
    for (const [cid, px] of pixelMap) {
        if (postbackMap.has(cid)) continue;
        if (!submitEvents.has(px.event)) continue;
        rows.push({
            click_id: cid,
            domain: px.domain || "—",
            payout: 0,
            type: "—",
            lead_id: "—",
            postback_ts: null,
            pixel_ts: px.ts,
            pixel_event: px.event,
            status: "pixel_only",
        });
    }

    rows.sort((a, b) => Math.max(b.postback_ts || 0, b.pixel_ts || 0) - Math.max(a.postback_ts || 0, a.pixel_ts || 0));
    return rows;
}

export function TrackingReconcileTab({ apiBase, apiHeaders }) {
    const [postbacks, setPostbacks]   = useState([]);
    const [pixelEvents, setPixelEvents] = useState([]);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState(null);
    const [domain, setDomain]         = useState("");
    const [range, setRange]           = useState("24h");
    const [filter, setFilter]         = useState("all");

    const sinceForRange = useCallback(() => {
        const now = Math.floor(Date.now() / 1000);
        const map = { "1h": 3600, "6h": 21600, "24h": 86400, "7d": 604800 };
        return now - (map[range] || 86400);
    }, [range]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const since = sinceForRange();
            const domainQ = domain ? `&domain=${encodeURIComponent(domain)}` : "";
            const qs = `since=${since}&limit=500${domainQ}`;
            const baseOpt = apiBase && String(apiBase).trim() !== "" ? apiBase : undefined;
            const pbUrl = buildApiUrlWithBase(`/api/postbacks?${qs}`, baseOpt);
            const pxUrl = buildApiUrlWithBase(`/api/pixel/events?${qs}`, baseOpt);
            const [pbData, pxData] = await Promise.all([
                fetchTrackingJson(pbUrl, "Postbacks", apiHeaders),
                fetchTrackingJson(pxUrl, "Pixel events", apiHeaders),
            ]);
            setPostbacks(pbData.postbacks || []);
            setPixelEvents(pxData.events || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [apiBase, apiHeaders, domain, sinceForRange]);

    useEffect(() => { load(); }, [load]);

    const rows = reconcile(postbacks, pixelEvents);
    const filtered = filter === "all" ? rows : rows.filter(r => r.status === filter);

    const matched       = rows.filter(r => r.status === "matched").length;
    const noPixel       = rows.filter(r => r.status === "postback_only").length;
    const noPostback    = rows.filter(r => r.status === "pixel_only").length;
    const totalPayout   = rows.filter(r => r.status === "matched").reduce((s, r) => s + (r.payout || 0), 0);
    const matchRate     = rows.length > 0 ? Math.round((matched / Math.max(matched + noPixel, 1)) * 100) : 0;

    return (
        <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Matched", value: matched, cls: "text-emerald-600 dark:text-emerald-400" },
                    { label: "No Pixel", value: noPixel, cls: noPixel > 0 ? "text-amber-600 dark:text-amber-400" : "" },
                    { label: "No Postback", value: noPostback, cls: "text-blue-600 dark:text-blue-400" },
                    { label: "Match Rate", value: `${matchRate}%`, cls: matchRate < 80 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400" },
                ].map(k => (
                    <Card key={k.label}>
                        <CardContent className="pt-4 pb-3">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{k.label}</p>
                            <p className={`text-2xl font-bold mt-0.5 ${k.cls}`}>{k.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <CardTitle>Tracking Cross-Validation</CardTitle>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                                {rows.length} click IDs · {fmt$(totalPayout)} confirmed revenue · Voluum postbacks vs first-party pixel
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {/* Range */}
                            <select
                                value={range}
                                onChange={e => setRange(e.target.value)}
                                className="text-xs px-2 py-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]"
                            >
                                {[["1h","Last 1h"],["6h","Last 6h"],["24h","Last 24h"],["7d","Last 7d"]].map(([v,l]) => (
                                    <option key={v} value={v}>{l}</option>
                                ))}
                            </select>
                            {/* Domain filter */}
                            <input
                                type="text"
                                placeholder="domain filter"
                                value={domain}
                                onChange={e => setDomain(e.target.value)}
                                className="text-xs px-2 py-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] w-36"
                            />
                            {/* Status filter */}
                            <select
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="text-xs px-2 py-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]"
                            >
                                <option value="all">All</option>
                                <option value="matched">Matched</option>
                                <option value="postback_only">No Pixel</option>
                                <option value="pixel_only">No Postback</option>
                            </select>
                            <button
                                onClick={load}
                                disabled={loading}
                                className="text-xs px-3 py-1.5 rounded-md bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:opacity-90 disabled:opacity-50"
                            >
                                {loading ? "Loading…" : "Refresh"}
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="text-sm text-red-500 mb-3 p-2 rounded bg-red-50 dark:bg-red-500/10">{error}</div>
                    )}
                    {filtered.length === 0 && !loading ? (
                        <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">
                            {rows.length === 0 ? "No postbacks or pixel events in this range" : "No results for selected filter"}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Click ID</TableHead>
                                        <TableHead>Domain</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Payout</TableHead>
                                        <TableHead>Postback Time</TableHead>
                                        <TableHead>Pixel Event</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((r, i) => {
                                        const s = STATUS[r.status] || STATUS.unknown;
                                        return (
                                            <TableRow key={i}>
                                                <TableCell className="font-mono text-xs max-w-[120px] truncate" title={r.click_id}>
                                                    {r.click_id ? r.click_id.slice(0, 16) + (r.click_id.length > 16 ? "…" : "") : "—"}
                                                </TableCell>
                                                <TableCell className="text-xs">{r.domain}</TableCell>
                                                <TableCell className="text-xs">{r.type}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">
                                                    {r.payout > 0 ? fmt$(r.payout) : "—"}
                                                </TableCell>
                                                <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                                                    {fmtTime(r.postback_ts)}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {r.pixel_event ? (
                                                        <span className="font-mono">{r.pixel_event}</span>
                                                    ) : (
                                                        <span className="text-[hsl(var(--muted-foreground))]">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
