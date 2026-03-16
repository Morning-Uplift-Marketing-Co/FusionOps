import { useMemo, useState, useEffect } from "react";
import { THEME as T, COLORS } from "../constants";
import { hsl } from "../utils";
import { detectRisks } from "../utils/risk-engine";
import { leadingCardsApi } from "../services/leadingCards";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { BarChart, Bar, LineChart, Line, ResponsiveContainer } from "recharts";

/* ── mock data for charts ── */
const SUB_DATA = [
    { name: "Jan", v: 240 }, { name: "Feb", v: 300 }, { name: "Mar", v: 200 },
    { name: "Apr", v: 278 }, { name: "May", v: 189 }, { name: "Jun", v: 239 },
    { name: "Jul", v: 278 },
];
const REV_DATA = [
    { name: "Jan", v: 4000 }, { name: "Feb", v: 3000 }, { name: "Mar", v: 5000 },
    { name: "Apr", v: 4500 }, { name: "May", v: 6000 }, { name: "Jun", v: 5500 },
    { name: "Jul", v: 7000 },
];
const TREND_DATA = [
    { name: "Jan", a: 40, b: 24 }, { name: "Feb", a: 30, b: 14 },
    { name: "Mar", a: 20, b: 98 }, { name: "Apr", a: 28, b: 39 },
    { name: "May", a: 18, b: 48 }, { name: "Jun", a: 24, b: 38 },
    { name: "Jul", a: 35, b: 43 },
];
// Removed dummy RECENT_TXN — now uses live LeadingCards transactions

const statusCls = {
    Success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    Processing: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    Failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

export function Dashboard({ sites, stats, ops, setPage, startCreate, settings = {}, apiOk, neonOk, tasks = [] }) {
    const hideRevenue = settings.hideRevenue === true;
    const recent = sites.slice(0, 5);
    const risks = useMemo(() => detectRisks(ops), [ops]);
    const [txFilter, setTxFilter] = useState("");
    const [liveTxn, setLiveTxn] = useState([]);
    const [txnLoading, setTxnLoading] = useState(false);

    // ─── Fetch real transactions from LeadingCards ───
    useEffect(() => {
        let cancelled = false;
        setTxnLoading(true);
        const to = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        leadingCardsApi.getTransactions(from, to)
            .then(res => {
                if (cancelled) return;
                const txs = res?.results || (Array.isArray(res) ? res : []);
                setLiveTxn(txs.slice(0, 20)); // latest 20
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setTxnLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const configWarnings = [];
    if (!neonOk) configWarnings.push("Neon Database disconnected.");
    if (!settings.cfApiToken || !settings.cfAccountId) configWarnings.push("Cloudflare settings incomplete.");
    if (!settings.voluumAccessKey || !settings.voluumAccessKeyId) configWarnings.push("Voluum API keys missing.");

    const activeSites = sites.filter(s => s.status === "completed").length;
    const activeCards = ops.payments?.filter(p => p.status === "active" || p.cardStatus === "active").length || 0;

    const filteredTxn = liveTxn.filter(t => {
        if (!txFilter) return true;
        const q = txFilter.toLowerCase();
        return (t.merchant_name || t.description || "").toLowerCase().includes(q)
            || (t.card_last_4 || "").includes(q)
            || (t.type || "").toLowerCase().includes(q);
    });

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

            {/* ─── Row 1: Team + Subscriptions + Total Revenue (3 cols like reference) ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Team Members / Recent Sites */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Recent Sites</CardTitle>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Your latest landing pages.</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {recent.length === 0 ? (
                            <div className="text-center py-6">
                                <div className="text-3xl mb-2">🚀</div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">No sites yet</p>
                                <Button onClick={startCreate} variant="outline" className="mt-3 text-xs">+ Create LP</Button>
                            </div>
                        ) : recent.map(s => {
                            const c = COLORS.find(x => x.id === s.colorId);
                            return (
                                <div key={s.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs text-white font-bold shrink-0"
                                            style={{ background: c ? hsl(...c.p) : T.primary }}>
                                            {s.brand?.[0]}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">{s.brand}</div>
                                            <div className="text-xs text-[hsl(var(--muted-foreground))]">{s.domain || "no domain"}</div>
                                        </div>
                                    </div>
                                    <span className="text-xs font-medium px-2.5 py-1 rounded-md border border-[hsl(var(--border))]">Active</span>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* Subscriptions / Builds stat + bar chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Builds</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight">+{stats.builds || 0}</div>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">+180.1% from last month</p>
                        <div className="h-[140px] mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={SUB_DATA} barCategoryGap="20%">
                                    <Bar dataKey="v" fill="hsl(var(--foreground))" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Total Revenue stat + line chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight">{hideRevenue ? "Hidden" : `$${(stats.spend * 3.2 || 15231.89).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</div>
                        <p className={`text-xs mt-1 ${hideRevenue ? "text-[hsl(var(--muted-foreground))]" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {hideRevenue ? "Employee view is masking revenue metrics" : "+20.1% from last month"}
                        </p>
                        <div className="h-[140px] mt-4">
                            {hideRevenue ? (
                                <div className="h-full rounded-lg border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
                                    Revenue trend hidden
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={REV_DATA}>
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

            {/* ─── Row 3: Latest Activity table + KPI cards (like Payments + Payment Method) ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Latest Activity table */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold">Latest Activity</CardTitle>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Recent transactions and events.</p>
                            </div>
                            <input
                                className="w-48 px-3 py-1.5 text-sm rounded-md border border-[hsl(var(--border))] bg-transparent placeholder:text-[hsl(var(--muted-foreground))]"
                                placeholder="Filter activity..."
                                value={txFilter}
                                onChange={e => setTxFilter(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tag</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Type</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {txnLoading ? (
                                    <TableRow><TableCell colSpan={3} className="text-center text-[hsl(var(--muted-foreground))] py-8">Loading transactions...</TableCell></TableRow>
                                ) : filteredTxn.length === 0 ? (
                                    <TableRow><TableCell colSpan={3} className="text-center text-[hsl(var(--muted-foreground))] py-8">No transactions found</TableCell></TableRow>
                                ) : filteredTxn.map((t, i) => {
                                    const txType = t.type || "auth";
                                    const txStatus = txType === "decline" ? "Failed" : txType === "refund" ? "Processing" : "Success";
                                    const tag = t.comment || t.tag || (t.card_last_4 ? `****${t.card_last_4}` : "—");
                                    return (
                                        <TableRow key={t.uuid || i}>
                                            <TableCell className="font-medium">{tag}</TableCell>
                                            <TableCell className="text-right font-mono">{txType === "decline" ? "DECLINED" : `${Number(t.amount || 0).toFixed(2)}`}</TableCell>
                                            <TableCell>
                                                <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${statusCls[txStatus] || ""}`}>{txType}</span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Stats summary cards (like Payment Method in reference) */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Portfolio Summary</CardTitle>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Quick overview of your assets.</p>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {[
                            { label: "Total Sites", value: sites.length, icon: "🌐", pct: "+12%" },
                            { label: "Active Sites", value: activeSites, icon: "✅", pct: activeSites > 0 ? `+${activeSites}` : "0" },
                            { label: "Ops Domains", value: ops.domains.length, icon: "🏢", pct: `${ops.domains.length}` },
                            { label: "Active Cards", value: activeCards, icon: "💳", pct: activeCards > 0 ? "Active" : "—" },
                            { label: "API Spend", value: `$${stats.spend.toFixed(2)}`, icon: "💰", pct: "This month" },
                        ].map((m, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg border border-[hsl(var(--border))] flex items-center justify-center text-lg">
                                        {m.icon}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">{m.label}</div>
                                        <div className="text-xs text-[hsl(var(--muted-foreground))]">{m.pct}</div>
                                    </div>
                                </div>
                                <div className="text-lg font-bold">{m.value}</div>
                            </div>
                        ))}
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
