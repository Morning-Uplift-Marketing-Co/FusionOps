import { useEffect, useMemo, useState } from "react";
import { detectRisks } from "../utils/risk-engine";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { BarChart, Bar, LineChart, Line, ResponsiveContainer } from "recharts";

const TREND_DATA = [
    { name: "Jan", a: 40, b: 24 }, { name: "Feb", a: 30, b: 14 },
    { name: "Mar", a: 20, b: 98 }, { name: "Apr", a: 28, b: 39 },
    { name: "May", a: 18, b: 48 }, { name: "Jun", a: 24, b: 38 },
    { name: "Jul", a: 35, b: 43 },
];
// Removed dummy RECENT_TXN — now uses live LeadingCards transactions

export function Dashboard({ sites, stats, ops, setPage, startCreate, settings = {}, apiOk, neonOk, tasks = [] }) {
    const hideRevenue = settings.hideRevenue === true;
    const risks = useMemo(() => detectRisks(ops), [ops]);
    const [voluumRevenue, setVoluumRevenue] = useState(null);
    const [voluumRevenueSeries, setVoluumRevenueSeries] = useState([]);

    const configWarnings = [];
    if (!neonOk) configWarnings.push("Neon Database disconnected.");
    if (!settings.cfApiToken || !settings.cfAccountId) configWarnings.push("Cloudflare settings incomplete.");
    if (!settings.voluumAccessKey || !settings.voluumAccessKeyId) configWarnings.push("Voluum API keys missing.");

    const activeSites = sites.filter(s => s.status === "completed").length;

    const toStatus = (row) => String(
        row?.status
        ?? row?.cardStatus
        ?? row?.card_status
        ?? row?.state
        ?? ""
    ).trim().toLowerCase();

    const isActiveStatus = (s) => ["active", "activated", "open", "running"].includes(String(s || "").toLowerCase());

    const paymentRows = Array.isArray(ops?.payments) ? ops.payments : [];
    const activeCardsFromPayments = paymentRows.filter((p) => isActiveStatus(toStatus(p))).length;

    const accountRows = Array.isArray(ops?.accounts) ? ops.accounts : [];
    const activeCardUuidSet = new Set(
        accountRows
            .filter((a) => isActiveStatus(toStatus(a)) && a?.cardUuid)
            .map((a) => String(a.cardUuid))
    );

    const activeCards = Math.max(activeCardsFromPayments, activeCardUuidSet.size);
    const totalBuilds = Number.isFinite(Number(stats?.builds)) ? Number(stats.builds) : sites.length;

    const buildSeries = useMemo(() => {
        const now = new Date();
        const buckets = [];
        for (let i = 6; i >= 0; i -= 1) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            buckets.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                name: d.toLocaleString("en-US", { month: "short" }),
                v: 0,
            });
        }

        const byKey = new Map(buckets.map((b) => [b.key, b]));
        for (const s of sites || []) {
            const raw = s.createdAt || s.created_at || s.ts || s.updatedAt || s.updated_at;
            if (!raw) continue;
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) continue;
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const row = byKey.get(k);
            if (row) row.v += 1;
        }
        return buckets;
    }, [sites]);

    const todayKey = new Date().toISOString().slice(0, 10);
    const postbackRevenueSeries = useMemo(() => {
        const input = Array.isArray(stats?.revenueSeries) ? stats.revenueSeries : [];
        return input
            .map((r, i) => ({
                name: String(r.name || r.date || `P${i + 1}`),
                v: Number(r.v ?? r.value ?? r.revenue ?? 0),
            }))
            .filter((r) => Number.isFinite(r.v));
    }, [stats]);

    const postbackRevenueToday = useMemo(() => {
        const todayRows = postbackRevenueSeries.filter((r) => String(r.name || "").startsWith(todayKey));
        if (todayRows.length === 0) return null;
        return Number(todayRows.reduce((sum, r) => sum + Number(r.v || 0), 0));
    }, [postbackRevenueSeries, todayKey]);
    const hasPostbackRevenueToday = Number.isFinite(Number(postbackRevenueToday));

    const voluumAccessKeyId = settings?.voluumAccessKeyId
        || import.meta.env?.VITE_VOLUUM_ACCESS_KEY_ID
        || import.meta.env?.PUBLIC_VOLUUM_ACCESS_KEY_ID
        || "";
    const voluumAccessKey = settings?.voluumAccessKey
        || import.meta.env?.VITE_VOLUUM_ACCESS_KEY
        || import.meta.env?.PUBLIC_VOLUUM_ACCESS_KEY
        || "";

    useEffect(() => {
        let cancelled = false;

        async function loadVoluumRevenue() {
            if (hideRevenue) {
                setVoluumRevenue(null);
                setVoluumRevenueSeries([]);
                return;
            }
            if (!voluumAccessKeyId || !voluumAccessKey) {
                setVoluumRevenue(null);
                setVoluumRevenueSeries([]);
                return;
            }

            try {
                const { fetchVoluumSession, fetchVoluumReport, extractMetrics } = await import("../services/voluum.js");
                const token = await fetchVoluumSession(voluumAccessKeyId, voluumAccessKey);

                const toDate = new Date();
                const fromDate = new Date();
                fromDate.setHours(0, 0, 0, 0);

                const report = await fetchVoluumReport(token, fromDate, toDate);
                const m = extractMetrics(report);

                const trendReport = await fetchVoluumReport(token, fromDate, toDate, "UTC", "day");
                const series = Array.isArray(trendReport?.rows)
                    ? trendReport.rows.map((row, i) => ({
                        name: String(row.day || row.id || row.name || `D${i + 1}`),
                        v: Number(row.revenue || 0),
                    })).filter((r) => Number.isFinite(r.v))
                    : [];

                if (!cancelled) {
                    setVoluumRevenue(Number(m?.revenue || 0));
                    setVoluumRevenueSeries(series);
                }
            } catch (_e) {
                if (!cancelled) {
                    setVoluumRevenue(null);
                    setVoluumRevenueSeries([]);
                }
            }
        }

        loadVoluumRevenue();
        return () => { cancelled = true; };
    }, [hideRevenue, voluumAccessKeyId, voluumAccessKey]);

    const hasVoluumRevenueValue = Number.isFinite(Number(voluumRevenue));
    const displayRevenueValue = hasVoluumRevenueValue
        ? Number(voluumRevenue)
        : (hasPostbackRevenueToday ? Number(postbackRevenueToday) : null);
    const displayRevenueSeries = useMemo(() => {
        if (voluumRevenueSeries.length > 0) return voluumRevenueSeries;
        if (hasPostbackRevenueToday) return [{ name: "Today", v: Number(postbackRevenueToday || 0) }];
        return [];
    }, [voluumRevenueSeries, hasPostbackRevenueToday, postbackRevenueToday]);

    const portfolioMetrics = [
        { label: "Total Sites", value: sites.length, icon: "🌐", meta: "+12%" },
        { label: "Active Sites", value: activeSites, icon: "✅", meta: activeSites > 0 ? `+${activeSites}` : "0" },
        { label: "Ops Domains", value: ops.domains.length, icon: "🏢", meta: `${ops.domains.length}` },
        { label: "Active Cards", value: activeCards, icon: "💳", meta: activeCards > 0 ? "Active" : "—" },
        { label: "API Spend", value: `$${Number(stats.spend || 0).toFixed(2)}`, icon: "💰", meta: "This month" },
    ];

    return (
        <div className="space-y-6 animate-[fadeIn_.3s_ease]">
            {/* ─── Header ─── */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))]">
                        📅 {new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    <Button onClick={startCreate}>+ Create New LP</Button>
                </div>
            </div>

            {/* ─── Config Warning (compact) ─── */}
            {configWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/8 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                        <span>⚠</span>
                        <span>{configWarnings.join(" · ")}</span>
                    </div>
                    <button onClick={() => setPage("settings")} className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-transparent border-none cursor-pointer hover:underline whitespace-nowrap">
                        Fix in Settings →
                    </button>
                </div>
            )}

            {/* ─── Task Summary Widget ─── */}
            {tasks.length > 0 && (() => {
                const urgent = tasks.filter(t => t.priority === "urgent" && t.status !== "done").length;
                const inProgress = tasks.filter(t => t.status === "in_progress").length;
                const today = new Date().toISOString().slice(0, 10);
                const dueToday = tasks.filter(t => t.due_date === today && t.status !== "done").length;
                return (
                    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-5 text-sm">
                            {urgent > 0 && (
                                <span className="flex items-center gap-1.5 font-semibold text-red-500">
                                    🔴 <span>{urgent} Urgent</span>
                                </span>
                            )}
                            <span className="flex items-center gap-1.5 font-semibold text-amber-500">
                                🟡 <span>{inProgress} In Progress</span>
                            </span>
                            {dueToday > 0 && (
                                <span className="flex items-center gap-1.5 font-semibold text-orange-500">
                                    ⚠️ <span>{dueToday} Due Today</span>
                                </span>
                            )}
                            <span className="text-[hsl(var(--muted-foreground))]">
                                {tasks.filter(t => t.status !== "done").length} open tasks
                            </span>
                        </div>
                        <button
                            onClick={() => setPage("tasks")}
                            className="text-xs font-semibold text-[hsl(var(--primary))] bg-transparent border-none cursor-pointer hover:underline whitespace-nowrap"
                        >
                            View All Tasks →
                        </button>
                    </div>
                );
            })()}

            {/* ─── Row 1: Portfolio + Builds + Revenue ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Portfolio Summary */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Portfolio Summary</CardTitle>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Quick overview of your assets.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {portfolioMetrics.map((m, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg border border-[hsl(var(--border))] flex items-center justify-center text-base shrink-0">
                                        {m.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">{m.label}</div>
                                        <div className="text-xs text-[hsl(var(--muted-foreground))]">{m.meta}</div>
                                    </div>
                                </div>
                                <div className="text-lg font-bold shrink-0">{m.value}</div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Subscriptions / Builds stat + bar chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Builds</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight">{totalBuilds}</div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Total LP builds</p>
                        <div className="h-[140px] mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={buildSeries} barCategoryGap="20%">
                                    <Bar dataKey="v" fill="hsl(var(--foreground))" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Total Revenue stat + line chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Today's Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight">
                            {hideRevenue
                                ? "Hidden"
                                : displayRevenueValue !== null
                                    ? `$${displayRevenueValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : "N/A"}
                        </div>
                        <p className={`text-xs mt-1 ${hideRevenue ? "text-[hsl(var(--muted-foreground))]" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {hideRevenue
                                ? "Employee view is masking revenue metrics"
                                : hasVoluumRevenueValue && hasPostbackRevenueToday
                                    ? `Today · Voluum API: $${Number(voluumRevenue).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Postback: $${Number(postbackRevenueToday || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : hasVoluumRevenueValue
                                        ? "Today source: Voluum API"
                                        : hasPostbackRevenueToday
                                            ? "Today source: Postback (/v)"
                                            : "No revenue data connected"}
                        </p>
                        <div className="h-[140px] mt-4">
                            {hideRevenue || displayRevenueSeries.length === 0 ? (
                                <div className="h-full rounded-lg border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
                                    {hideRevenue ? "Revenue trend hidden" : "Revenue trend unavailable"}
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={displayRevenueSeries}>
                                        <Line type="monotone" dataKey="v" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Row 2: System Health (left) + Trend chart (right) ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* System Health + Quick Actions */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">System Status</CardTitle>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Integration health overview.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { label: "Data Store", ok: neonOk || apiOk, text: neonOk ? "Neon DB" : apiOk ? "API / D1" : "Local Only" },
                            { label: "Cloudflare Pages", ok: !!settings.cfApiToken, text: settings.cfApiToken ? "Ready" : "Not Set" },
                            { label: "Netlify Deploy", ok: !!settings.netlifyToken, text: settings.netlifyToken ? "Ready" : "Not Set" },
                            { label: "LendingCard API", ok: !!settings.lcToken, text: settings.lcToken ? "Connected" : "Not Set" },
                            { label: "Multilogin X", ok: !!settings.mlToken, text: settings.mlToken ? "Connected" : "Not Set" },
                        ].map((row, i) => (
                            <div key={i} className="flex justify-between items-center">
                                <span className="text-sm">{row.label}</span>
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${row.ok
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                                    : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'
                                    }`}>{row.text}</span>
                            </div>
                        ))}
                        <div className="border-t border-[hsl(var(--border))] pt-4 mt-2">
                            <div className="text-sm font-semibold mb-3">Quick Actions</div>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { l: "Build New", icon: "➕", fn: startCreate },
                                    { l: "AI Assets", icon: "✨", fn: () => setPage("variant") },
                                    { l: "Pixel Events", icon: "⚡", fn: () => setPage("realtime-events") },
                                    { l: "Ops Center", icon: "🏢", fn: () => setPage("ops") },
                                    { l: "Settings", icon: "⚙", fn: () => setPage("settings") },
                                ].map((a, i) => (
                                    <button key={i} onClick={a.fn}
                                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition text-xs cursor-pointer font-medium"
                                        style={{ color: 'hsl(var(--foreground))', backgroundColor: 'hsl(var(--card))' }}>
                                        <span>{a.icon}</span>{a.l}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Performance Trend chart (like Exercise Minutes in reference) */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold">Performance Trend</CardTitle>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Your campaigns are ahead of where you normally are.</p>
                            </div>
                            <Button variant="outline" className="text-xs h-8 gap-1.5">📊 Export</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={TREND_DATA}>
                                    <Line type="monotone" dataKey="a" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="b" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} strokeDasharray="4 4" opacity={0.5} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Risk Alert ─── */}
            {risks.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/8 px-4 py-3">
                    <div className="text-xs font-bold text-red-700 dark:text-red-400 mb-1">⚠ Correlation Risks</div>
                    {risks.slice(0, 3).map((r, i) => (
                        <div key={i} className="text-xs text-red-700 dark:text-red-300 py-0.5">{r.level}: {r.msg}</div>
                    ))}
                    <button onClick={() => setPage("ops")} className="text-xs text-red-700 dark:text-red-400 bg-transparent border-none cursor-pointer mt-1 p-0 hover:underline font-medium">
                        View Ops Center →
                    </button>
                </div>
            )}
        </div>
    );
}
