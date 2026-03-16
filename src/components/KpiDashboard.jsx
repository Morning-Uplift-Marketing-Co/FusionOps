import React, { useState, useEffect, useMemo } from "react";
import { THEME as T } from "../constants";
import { cn } from "../lib/utils";
import * as db from "../services/neon";
import { isAdmin } from "../services/auth";

/* ═══════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════ */

const PERIOD_OPTIONS = [
    { label: "Today", days: 1 },
    { label: "7 days", days: 7 },
    { label: "30 days", days: 30 },
    { label: "All time", days: 0 },
];

const METRIC_DEFS = [
    { key: "tasks_completed", label: "Tasks Done", icon: "✅", color: "#22c55e" },
    { key: "tasks_created", label: "Tasks Created", icon: "📋", color: "#6366f1" },
    { key: "deploys", label: "Deploys", icon: "🚀", color: "#f97316" },
    { key: "sites_created", label: "Sites Created", icon: "🌐", color: "#3b82f6" },
];

// Shared score formula — used for both sort and display
function calcScore(s) {
    return (s.tasks_completed || 0) * 3 + (s.tasks_created || 0) + (s.deploys || 0) * 2 + (s.sites_created || 0) * 2;
}

const SEV_COLOR = { error: "#dc2626", warning: "#f59e0b", info: "#6366f1", success: "#22c55e" };

/* ═══════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════ */

function StatCard({ icon, label, value, color, sub }) {
    return (
        <div
            style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 14,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>{label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: color || "hsl(var(--foreground))" }}>
                {value ?? "—"}
            </div>
            {sub && <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{sub}</div>}
        </div>
    );
}

function LeaderRow({ rank, name, email, stats, isMe }) {
    const medals = ["🥇", "🥈", "🥉"];
    const medal = medals[rank - 1] || `#${rank}`;
    const score = calcScore(stats);

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "32px 1fr repeat(4, 70px) 60px",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 10,
                background: isMe ? `${T.primary}10` : "transparent",
                border: isMe ? `1px solid ${T.primary}40` : "1px solid transparent",
                fontSize: 13,
            }}
        >
            <span style={{ fontSize: rank <= 3 ? 18 : 13, textAlign: "center" }}>{medal}</span>
            <div>
                <div style={{ fontWeight: 600 }}>{name || email?.split("@")[0]}</div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{email}</div>
            </div>
            {METRIC_DEFS.map((m) => (
                <div key={m.key} style={{ textAlign: "center", fontWeight: 700, color: m.color }}>
                    {stats[m.key] || 0}
                </div>
            ))}
            <div
                style={{
                    textAlign: "center",
                    fontWeight: 800,
                    fontSize: 14,
                    color: T.primary,
                }}
            >
                {score}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */

export function KpiDashboard({ user, users = [] }) {
    const [kpiData, setKpiData] = useState([]);
    const [auditLog, setAuditLog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(7);
    const [tab, setTab] = useState("leaderboard"); // leaderboard | my-stats | activity

    const admin = isAdmin(user);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [kpi, log] = await Promise.all([
                    db.getKpiStats().catch(() => []),
                    db.loadAuditEvents({ limit: 500 }).catch(() => []),
                ]);
                setKpiData(kpi);
                setAuditLog(log);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // Filter audit log by period (cutoff inside memo to avoid stale closure drift)
    const filteredLog = useMemo(() => {
        const cutoff = period > 0 ? Date.now() - period * 86_400_000 : 0;
        return auditLog.filter((e) => !cutoff || new Date(e.ts).getTime() >= cutoff);
    }, [auditLog, period]);

    // My activity (filtered to current user) — reused for stats and personal feed
    const myActivity = useMemo(
        () => filteredLog.filter((e) => {
            try {
                const meta = typeof e.meta === "string" ? JSON.parse(e.meta) : e.meta;
                return meta?.userId === user?.id;
            } catch { return false; }
        }),
        [filteredLog, user?.id]
    );

    // My stats — single reduce pass over pre-filtered events
    const myStats = useMemo(() => myActivity.reduce(
        (acc, e) => {
            if (e.event_type === "task_completed") acc.tasks_completed++;
            else if (e.event_type === "task_created") acc.tasks_created++;
            else if (e.event_type === "deploy_success") acc.deploys++;
            else if (e.event_type === "site_created") acc.sites_created++;
            return acc;
        },
        { tasks_completed: 0, tasks_created: 0, deploys: 0, sites_created: 0 }
    ), [myActivity]);

    const myScore = calcScore(myStats);

    // Leaderboard merged from DB KPI stats + users list
    const leaderboard = useMemo(() => {
        return kpiData
            .map((row) => {
                const u = users.find((u) => u.id === row.user_id);
                return {
                    user_id: row.user_id,
                    name: u?.name || row.user_name || "",
                    email: u?.email || "",
                    tasks_completed: Number(row.tasks_completed || 0),
                    tasks_created: Number(row.tasks_created || 0),
                    deploys: Number(row.deploys || 0),
                    sites_created: Number(row.sites_created || 0),
                };
            })
            .sort((a, b) => calcScore(b) - calcScore(a));
    }, [kpiData, users]);

    const recentActivity = useMemo(() => filteredLog.slice(0, 50), [filteredLog]);

    return (
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
                        📊 {admin ? "Team KPI Dashboard" : "My Performance"}
                    </h2>
                    <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 3 }}>
                        {admin ? "Leaderboard & team activity" : `Logged in as ${user?.email} (${user?.role})`}
                    </div>
                </div>

                {/* Period filter */}
                <div style={{ display: "flex", gap: 6 }}>
                    {PERIOD_OPTIONS.map((opt) => (
                        <button
                            key={opt.days}
                            onClick={() => setPeriod(opt.days)}
                            style={{
                                padding: "5px 12px",
                                borderRadius: 8,
                                border: "1.5px solid",
                                borderColor: period === opt.days ? T.primary : "hsl(var(--border))",
                                background: period === opt.days ? `${T.primary}15` : "transparent",
                                color: period === opt.days ? T.primary : "hsl(var(--muted-foreground))",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* My Stats cards (always visible) */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 12,
                    marginBottom: 24,
                }}
            >
                {METRIC_DEFS.map((m) => (
                    <StatCard
                        key={m.key}
                        icon={m.icon}
                        label={m.label}
                        value={myStats[m.key]}
                        color={m.color}
                    />
                ))}
                <StatCard icon="🏆" label="My Score" value={myScore} color={T.primary} sub="weighted points" />
            </div>

            {/* Tabs (admin only gets leaderboard + activity) */}
            {admin && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid hsl(var(--border))", paddingBottom: 0 }}>
                    {[
                        { id: "leaderboard", label: "🏆 Leaderboard" },
                        { id: "activity", label: "📋 Activity Log" },
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                padding: "8px 18px",
                                border: "none",
                                borderBottom: tab === t.id ? `2.5px solid ${T.primary}` : "2.5px solid transparent",
                                background: "transparent",
                                color: tab === t.id ? T.primary : "hsl(var(--muted-foreground))",
                                fontWeight: tab === t.id ? 700 : 500,
                                fontSize: 13,
                                cursor: "pointer",
                                marginBottom: -1,
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "hsl(var(--muted-foreground))" }}>
                    Loading KPI data…
                </div>
            ) : (
                <>
                    {/* Leaderboard */}
                    {admin && tab === "leaderboard" && (
                        <div
                            style={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 14,
                                overflow: "hidden",
                            }}
                        >
                            {/* Table header */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "32px 1fr repeat(4, 70px) 60px",
                                    gap: 8,
                                    padding: "10px 16px",
                                    borderBottom: "1px solid hsl(var(--border))",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: "hsl(var(--muted-foreground))",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                }}
                            >
                                <span>#</span>
                                <span>Member</span>
                                {METRIC_DEFS.map((m) => (
                                    <span key={m.key} style={{ textAlign: "center", color: m.color }}>
                                        {m.icon}
                                    </span>
                                ))}
                                <span style={{ textAlign: "center", color: T.primary }}>Score</span>
                            </div>

                            {leaderboard.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "32px 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
                                    No KPI data yet. Activity from audit log will appear here.
                                </div>
                            ) : (
                                <div style={{ padding: "8px" }}>
                                    {leaderboard.map((row, i) => (
                                        <LeaderRow
                                            key={row.user_id}
                                            rank={i + 1}
                                            name={row.name}
                                            email={row.email}
                                            stats={row}
                                            isMe={row.user_id === user?.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Activity Log */}
                    {admin && tab === "activity" && (
                        <div
                            style={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 14,
                                overflow: "hidden",
                            }}
                        >
                            <div style={{ overflowY: "auto", maxHeight: 500 }}>
                                {recentActivity.length === 0 ? (
                                    <div style={{ textAlign: "center", padding: "32px 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
                                        No activity in this period.
                                    </div>
                                ) : (
                                    recentActivity.map((ev, i) => {
                                        let meta = {};
                                        try { meta = typeof ev.meta === "string" ? JSON.parse(ev.meta) : (ev.meta || {}); } catch {}
                                        return (
                                            <div
                                                key={ev.id || i}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    gap: 12,
                                                    padding: "10px 16px",
                                                    borderBottom: "1px solid hsl(var(--border))",
                                                    fontSize: 13,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: "50%",
                                                        background: SEV_COLOR[ev.severity] || "#6366f1",
                                                        marginTop: 5,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <span style={{ fontWeight: 600 }}>{ev.title}</span>
                                                    {meta.userName && (
                                                        <span style={{ color: "hsl(var(--muted-foreground))", marginLeft: 6, fontSize: 11 }}>
                                                            by {meta.userName}
                                                        </span>
                                                    )}
                                                    {ev.detail && (
                                                        <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 12, marginTop: 2 }}>
                                                            {ev.detail}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>
                                                    {new Date(ev.ts).toLocaleString()}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Employee self-view — personal activity */}
                    {!admin && (
                        <div
                            style={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 14,
                                overflow: "hidden",
                            }}
                        >
                            <div style={{ padding: "14px 16px", borderBottom: "1px solid hsl(var(--border))", fontWeight: 700, fontSize: 14 }}>
                                📋 My Recent Activity
                            </div>
                            <div style={{ overflowY: "auto", maxHeight: 400 }}>
                                {myActivity.slice(0, 40).map((ev, i) => (
                                        <div
                                            key={ev.id || i}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 10,
                                                padding: "9px 16px",
                                                borderBottom: "1px solid hsl(var(--border))",
                                                fontSize: 13,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 7,
                                                    height: 7,
                                                    borderRadius: "50%",
                                                    background: SEV_COLOR[ev.severity] || "#6366f1",
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <span style={{ flex: 1 }}>{ev.title}</span>
                                            <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                                                {new Date(ev.ts).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                {myActivity.length === 0 && (
                                    <div style={{ textAlign: "center", padding: "32px 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
                                        No activity logged yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
