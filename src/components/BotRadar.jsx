import React, { useEffect, useState, useMemo } from "react";
import { cn } from "../lib/utils";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://lp-factory-api.misty-feather-556e.workers.dev/api").replace(/\/api$/, "");

async function apiGet(path) {
    const url = `${API_BASE}${path}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}

function StatCard({ icon, label, value, sublabel, color = "primary" }) {
    return (
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{icon}</span>
                <span className={`text-[10px] uppercase tracking-wider text-${color === "primary" ? "[hsl(var(--primary))]" : color}`}>
                    {label}
                </span>
            </div>
            <div className="text-2xl font-bold">{value ?? "—"}</div>
            {sublabel && (
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                    {sublabel}
                </div>
            )}
        </div>
    );
}

function SummarySection({ summary }) {
    const totals = summary?.totals || {};
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
                icon="⏱️"
                label="Last 1h"
                value={totals.last_1h}
                sublabel="bot visits"
            />
            <StatCard
                icon="📅"
                label="Last 24h"
                value={totals.last_24h}
                sublabel="bot visits"
                color="amber"
            />
            <StatCard
                icon="📊"
                label="Last 7d"
                value={totals.last_7d}
                sublabel="bot visits"
            />
            <StatCard
                icon="🌐"
                label="Unique Sites"
                value={totals.unique_sites_24h}
                sublabel="touched (24h)"
            />
        </div>
    );
}

function BotTypeBreakdown({ summary }) {
    const types = summary?.by_type_24h || [];
    const total = types.reduce((acc, t) => acc + (t.count || 0), 0);
    const colorMap = {
        adsbot: "#ef4444",
        googlebot: "#3b82f6",
        mediapartners: "#f59e0b",
        inspection: "#8b5cf6",
        "other-search": "#94a3b8",
        unknown: "#64748b",
        verification: "#22c55e",
    };

    if (types.length === 0) {
        return (
            <div className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">
                No bot visits yet — pixel-worker needs traffic to populate
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {types.map(t => {
                const pct = total > 0 ? ((t.count / total) * 100).toFixed(1) : "0";
                return (
                    <div key={t.bot_type}>
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium">{t.bot_type}</span>
                            <span className="text-[hsl(var(--muted-foreground))]">
                                {t.count} ({pct}%)
                            </span>
                        </div>
                        <div className="h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${pct}%`,
                                    backgroundColor: colorMap[t.bot_type] || colorMap.unknown,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function TopIpsTable({ ips }) {
    if (!ips || ips.length === 0) {
        return (
            <div className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">
                No bot IPs detected (last 24h)
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead className="border-b border-[hsl(var(--border))]">
                    <tr className="text-left text-[hsl(var(--muted-foreground))]">
                        <th className="py-2 px-2 font-medium">IP</th>
                        <th className="py-2 px-2 font-medium">Type</th>
                        <th className="py-2 px-2 font-medium">Org</th>
                        <th className="py-2 px-2 font-medium">Cty</th>
                        <th className="py-2 px-2 font-medium">Sites / Accounts</th>
                        <th className="py-2 px-2 font-medium text-right">Visits</th>
                        <th className="py-2 px-2 font-medium text-right">Score</th>
                    </tr>
                </thead>
                <tbody>
                    {ips.map((ip, i) => (
                        <tr key={`${ip.ip}-${i}`} className="border-b border-[hsl(var(--border))]/30">
                            <td className="py-1.5 px-2 font-mono text-[11px]">{ip.ip}</td>
                            <td className="py-1.5 px-2">
                                <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                    ip.bot_type === "adsbot" && "bg-red-500/15 text-red-500",
                                    ip.bot_type === "googlebot" && "bg-blue-500/15 text-blue-500",
                                    ip.bot_type === "inspection" && "bg-purple-500/15 text-purple-500",
                                    !["adsbot", "googlebot", "inspection"].includes(ip.bot_type) && "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
                                )}>
                                    {ip.bot_type}
                                </span>
                            </td>
                            <td className="py-1.5 px-2 truncate max-w-[140px]" title={ip.org}>
                                AS{ip.asn} {ip.org}
                            </td>
                            <td className="py-1.5 px-2">{ip.country || "—"}</td>
                            <td className="py-1.5 px-2 max-w-[200px]">
                                {(ip.sites || []).map(s => (
                                    <div key={s.domain} className="flex items-center gap-1 flex-wrap">
                                        <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{s.domain}</span>
                                        {s.account && (
                                            <span className="text-[10px] px-1 py-0 rounded bg-blue-500/10 text-blue-600 font-medium" title={s.account.email}>
                                                {s.account.label || s.account.email || s.account.id}
                                            </span>
                                        )}
                                    </div>
                                ))}
                                {(!ip.sites || ip.sites.length === 0) && <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                            </td>
                            <td className="py-1.5 px-2 text-right font-semibold">{ip.visits}</td>
                            <td className="py-1.5 px-2 text-right">
                                <span className={cn(
                                    "font-mono text-[10px] px-1.5 py-0.5 rounded",
                                    ip.avg_score >= 0.85 && "bg-green-500/15 text-green-500",
                                    ip.avg_score < 0.85 && ip.avg_score >= 0.6 && "bg-amber-500/15 text-amber-500",
                                    ip.avg_score < 0.6 && "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
                                )}>
                                    {ip.avg_score?.toFixed(2)}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function AccountTags({ accounts }) {
    if (!accounts || accounts.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1 mt-1.5">
            {accounts.map(a => (
                <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium" title={a.email}>
                    {a.label || a.email || a.id}
                </span>
            ))}
        </div>
    );
}

function PreBanList({ sites }) {
    if (!sites || sites.length === 0) {
        return (
            <div className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">
                ✓ No pre-ban signals detected
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {sites.map(s => (
                <div
                    key={s.site_domain}
                    className={cn(
                        "border rounded-lg p-3",
                        s.status === "critical" && "border-red-500/40 bg-red-500/5",
                        s.status === "elevated" && "border-amber-500/40 bg-amber-500/5",
                        s.status === "normal" && "border-[hsl(var(--border))]"
                    )}
                >
                    <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-sm">{s.site_domain}</div>
                        <span className={cn(
                            "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded",
                            s.status === "critical" && "bg-red-500 text-white",
                            s.status === "elevated" && "bg-amber-500 text-white",
                            s.status === "normal" && "bg-[hsl(var(--secondary))]"
                        )}>
                            {s.status}
                        </span>
                    </div>
                    <AccountTags accounts={s.accounts} />
                    <div className="grid grid-cols-3 gap-3 text-[11px] mt-2">
                        <div>
                            <div className="text-[hsl(var(--muted-foreground))]">Visits 1h</div>
                            <div className="font-bold">{s.recent_bot_visits_1h}</div>
                        </div>
                        <div>
                            <div className="text-[hsl(var(--muted-foreground))]">Baseline/h</div>
                            <div className="font-bold">{Number(s.avg_baseline_per_hour).toFixed(1)}</div>
                        </div>
                        <div>
                            <div className="text-[hsl(var(--muted-foreground))]">Anomaly</div>
                            <div className="font-bold">{Number(s.anomaly_score).toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function SignalsPanel({ signals }) {
    if (!signals || signals.empty) {
        return (
            <div className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">
                Not enough data
            </div>
        );
    }

    const sigs = [
        { key: "ip_match", label: "IP CIDR Match", weight: "35%", color: "#3b82f6" },
        { key: "ptr_match", label: "Reverse DNS", weight: "35%", color: "#8b5cf6" },
        { key: "ua_match", label: "User-Agent", weight: "20%", color: "#f59e0b" },
        { key: "behavior", label: "CF Bot Score", weight: "10%", color: "#22c55e" },
    ];

    return (
        <div className="space-y-3">
            {sigs.map(s => {
                const avg = signals.averages?.[s.key] || 0;
                const hits = signals.hits?.[s.key] || 0;
                const total = signals.total_visits || 1;
                const hitPct = ((hits / total) * 100).toFixed(0);
                return (
                    <div key={s.key}>
                        <div className="flex items-center justify-between text-xs mb-1">
                            <div>
                                <span className="font-medium">{s.label}</span>
                                <span className="text-[10px] text-[hsl(var(--muted-foreground))] ml-2">
                                    weight {s.weight}
                                </span>
                            </div>
                            <div className="text-[hsl(var(--muted-foreground))]">
                                {hits}/{total} hits ({hitPct}%)
                            </div>
                        </div>
                        <div className="h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${avg * 100}%`, backgroundColor: s.color }}
                            />
                        </div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                            avg signal strength: {avg.toFixed(2)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function BotRadar() {
    const [summary, setSummary] = useState(null);
    const [topIps, setTopIps] = useState([]);
    const [preBan, setPreBan] = useState([]);
    const [signals, setSignals] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [refreshTick, setRefreshTick] = useState(0);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        Promise.allSettled([
            apiGet("/api/bot-radar/summary"),
            apiGet("/api/bot-radar/top-ips?limit=25"),
            apiGet("/api/bot-radar/pre-ban"),
            apiGet("/api/bot-radar/signals"),
        ]).then(results => {
            if (!mounted) return;
            const [s, ips, pb, sigs] = results;
            if (s.status === "fulfilled") setSummary(s.value);
            if (ips.status === "fulfilled") setTopIps(ips.value.ips || []);
            if (pb.status === "fulfilled") setPreBan(pb.value.sites || []);
            if (sigs.status === "fulfilled") setSignals(sigs.value);
            setLoading(false);
        }).catch(e => {
            setErr(e.message);
            setLoading(false);
        });
        return () => { mounted = false; };
    }, [refreshTick]);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">🤖 Bot Radar</h2>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        Google Ads/Search bot tracking — 4-signal detection + anomaly scoring
                    </p>
                </div>
                <button
                    onClick={() => setRefreshTick(t => t + 1)}
                    className="text-xs px-3 py-1.5 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]"
                >
                    {loading ? "⟳" : "↻ Refresh"}
                </button>
            </div>

            {err && (
                <div className="text-xs text-red-500 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                    Error loading data: {err}
                </div>
            )}

            {/* Summary stat cards */}
            <SummarySection summary={summary} />

            {/* 2-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4">
                    <div className="text-sm font-semibold mb-3">Bot Types (24h)</div>
                    <BotTypeBreakdown summary={summary} />
                </div>

                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4">
                    <div className="text-sm font-semibold mb-3">Detection Signals (24h)</div>
                    <SignalsPanel signals={signals} />
                </div>
            </div>

            {/* Pre-ban */}
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold">🚨 Pre-Ban Signals</div>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        anomaly_score &gt; 0.7 = critical
                    </span>
                </div>
                <PreBanList sites={preBan} />
            </div>

            {/* Top IPs */}
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold">Top Bot IPs (24h)</div>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {topIps.length} unique IPs
                    </span>
                </div>
                <TopIpsTable ips={topIps} />
            </div>
        </div>
    );
}
