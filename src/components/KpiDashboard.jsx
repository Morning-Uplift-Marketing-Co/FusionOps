import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_USERS = [
    {
        id: "u1", display_name: "Alice K.", email: "alice@fusionops.co", role: "admin",
        avatar: "AK", color: "#6366f1",
        kpi: { sites_deployed: 8, health_checks: 34, issues_flagged: 1, sites_created: 5, notes_added: 12, proxy_setups: 3 },
        trend: [{ w: "W1", v: 6 }, { w: "W2", v: 9 }, { w: "W3", v: 7 }, { w: "W4", v: 8 }],
    },
    {
        id: "u2", display_name: "Bob T.", email: "bob@fusionops.co", role: "employee",
        avatar: "BT", color: "#10b981",
        kpi: { sites_deployed: 5, health_checks: 21, issues_flagged: 3, sites_created: 3, notes_added: 7, proxy_setups: 1 },
        trend: [{ w: "W1", v: 4 }, { w: "W2", v: 6 }, { w: "W3", v: 5 }, { w: "W4", v: 5 }],
    },
    {
        id: "u3", display_name: "Chan R.", email: "chan@fusionops.co", role: "employee",
        avatar: "CR", color: "#f59e0b",
        kpi: { sites_deployed: 3, health_checks: 18, issues_flagged: 0, sites_created: 2, notes_added: 4, proxy_setups: 2 },
        trend: [{ w: "W1", v: 2 }, { w: "W2", v: 4 }, { w: "W3", v: 3 }, { w: "W4", v: 3 }],
    },
    {
        id: "u4", display_name: "Dana P.", email: "dana@fusionops.co", role: "employee",
        avatar: "DP", color: "#ec4899",
        kpi: { sites_deployed: 2, health_checks: 9, issues_flagged: 2, sites_created: 1, notes_added: 3, proxy_setups: 0 },
        trend: [{ w: "W1", v: 3 }, { w: "W2", v: 2 }, { w: "W3", v: 2 }, { w: "W4", v: 2 }],
    },
];

const KPI_COLS = [
    { key: "sites_deployed", label: "Deployed", icon: "🚀", color: "#6366f1", good: true },
    { key: "health_checks", label: "Health", icon: "🔍", color: "#10b981", good: true },
    { key: "issues_flagged", label: "Issues", icon: "⚠", color: "#ef4444", good: false },
    { key: "sites_created", label: "Created", icon: "🆕", color: "#8b5cf6", good: true },
    { key: "notes_added", label: "Notes", icon: "📝", color: "#6b7280", good: true },
    { key: "proxy_setups", label: "Proxy", icon: "🔗", color: "#f59e0b", good: true },
];

const PERIODS = ["This Week", "This Month", "Last 30 days"];

function total(kpi) {
    return Object.values(kpi).reduce((s, v) => s + v, 0);
}

function rank(users) {
    return [...users].sort((a, b) => total(b.kpi) - total(a.kpi));
}

const RANK_MEDAL = ["🥇", "🥈", "🥉"];

// ── Employee self-view ────────────────────────────────────────────────────────
function SelfView({ user }) {
    return (
        <div>
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "20px 24px", borderRadius: 12, marginBottom: 24,
                background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)",
                border: "1px solid rgba(99,102,241,0.2)",
            }}>
                <div style={{
                    width: 52, height: 52, borderRadius: "50%", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700,
                    color: "#fff", background: user.color, flexShrink: 0,
                }}>{user.avatar}</div>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "hsl(var(--foreground))" }}>{user.display_name}</div>
                    <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>{user.email}</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#6366f1" }}>{total(user.kpi)}</div>
                    <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>Total Actions</div>
                </div>
            </div>

            {/* KPI cards grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
                {KPI_COLS.map(col => (
                    <div key={col.key} style={{
                        background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                        borderRadius: 12, padding: "18px 16px",
                    }}>
                        <div style={{ fontSize: 20, marginBottom: 8 }}>{col.icon}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: col.color }}>{user.kpi[col.key]}</div>
                        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>{col.label}</div>
                    </div>
                ))}
            </div>

            {/* Sparkline */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-semibold">Activity Trend (Last 4 Weeks)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div style={{ height: 80 }}>
                        <ResponsiveContainer width="100%" height={80} minWidth={0}>
                            <BarChart data={user.trend} barCategoryGap="30%">
                                <Bar dataKey="v" fill="#6366f1" radius={[3, 3, 0, 0]} />
                                <Tooltip
                                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                                    formatter={v => [`${v} actions`, ""]}
                                    labelFormatter={l => l}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ── Admin leaderboard ─────────────────────────────────────────────────────────
function AdminLeaderboard({ users }) {
    const ranked = rank(users);

    return (
        <div>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
                {[
                    { label: "Team Members", value: users.length, icon: "👥", color: "#6366f1" },
                    { label: "Total Deploys", value: users.reduce((s, u) => s + u.kpi.sites_deployed, 0), icon: "🚀", color: "#10b981" },
                    { label: "Issues Flagged", value: users.reduce((s, u) => s + u.kpi.issues_flagged, 0), icon: "⚠", color: "#ef4444" },
                    { label: "Health Checks", value: users.reduce((s, u) => s + u.kpi.health_checks, 0), icon: "🔍", color: "#8b5cf6" },
                ].map(m => (
                    <div key={m.label} style={{
                        background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                        borderRadius: 12, padding: "16px 18px",
                    }}>
                        <div style={{ fontSize: 20, marginBottom: 6 }}>{m.icon}</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: m.color }}>{m.value}</div>
                        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>{m.label}</div>
                    </div>
                ))}
            </div>

            {/* Leaderboard table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-semibold">Leaderboard</CardTitle>
                </CardHeader>
                <CardContent style={{ padding: 0 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                                {["#", "Employee", ...KPI_COLS.map(c => c.icon + " " + c.label), "Total"].map((h, i) => (
                                    <th key={i} style={{
                                        padding: "10px 14px", fontSize: 12, fontWeight: 600,
                                        color: "hsl(var(--muted-foreground))",
                                        textAlign: i === 0 ? "center" : i === 1 ? "left" : "right",
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ranked.map((u, idx) => {
                                const t = total(u.kpi);
                                return (
                                    <tr key={u.id} style={{
                                        borderBottom: "1px solid hsl(var(--border))",
                                        background: idx === 0 ? "rgba(99,102,241,0.04)" : "transparent",
                                    }}>
                                        {/* Rank */}
                                        <td style={{ padding: "12px 14px", textAlign: "center", fontSize: 16 }}>
                                            {RANK_MEDAL[idx] || `${idx + 1}`}
                                        </td>
                                        {/* Employee */}
                                        <td style={{ padding: "12px 14px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: "50%",
                                                    background: u.color, color: "#fff",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                                                }}>{u.avatar}</div>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>{u.display_name}</div>
                                                    <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{u.role}</div>
                                                </div>
                                            </div>
                                        </td>
                                        {/* KPI columns */}
                                        {KPI_COLS.map(col => {
                                            const val = u.kpi[col.key];
                                            const isAlert = !col.good && val > 0;
                                            return (
                                                <td key={col.key} style={{ padding: "12px 14px", textAlign: "right" }}>
                                                    <span style={{
                                                        fontSize: 13, fontWeight: 600,
                                                        color: isAlert ? "#ef4444" : val > 0 ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                                    }}>{val}</span>
                                                </td>
                                            );
                                        })}
                                        {/* Total */}
                                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                                            <span style={{
                                                fontSize: 13, fontWeight: 700, color: "#6366f1",
                                                background: "rgba(99,102,241,0.1)", padding: "2px 8px",
                                                borderRadius: 6,
                                            }}>{t}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* Trend sparklines row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 16 }}>
                {ranked.map(u => (
                    <Card key={u.id}>
                        <CardContent style={{ padding: "14px 14px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <div style={{
                                    width: 24, height: 24, borderRadius: "50%",
                                    background: u.color, color: "#fff",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 9, fontWeight: 700,
                                }}>{u.avatar}</div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))" }}>{u.display_name.split(" ")[0]}</span>
                            </div>
                            <div style={{ height: 50 }}>
                                <ResponsiveContainer width="100%" height={50} minWidth={0}>
                                    <BarChart data={u.trend} barCategoryGap="30%">
                                        <Bar dataKey="v" fill={u.color} radius={[2, 2, 0, 0]} opacity={0.85} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function KpiDashboard({ user }) {
    const [period, setPeriod] = useState("This Week");
    // Demo: if no user passed or admin, show admin view
    const isAdmin = !user || user.role === "admin";
    const selfUser = user ? MOCK_USERS.find(u => u.role === user.role && u.id === "u2") || MOCK_USERS[1] : MOCK_USERS[1];

    return (
        <div style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", color: "hsl(var(--foreground))" }}>
                        📊 Team KPI
                    </h1>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "hsl(var(--muted-foreground))" }}>
                        {isAdmin ? "Performance overview — all employees" : "Your personal performance stats"}
                    </p>
                </div>

                {/* Period tabs */}
                <div style={{
                    display: "flex", gap: 4, padding: 4,
                    background: "hsl(var(--muted))", borderRadius: 10,
                    border: "1px solid hsl(var(--border))",
                }}>
                    {PERIODS.map(p => (
                        <button key={p} onClick={() => setPeriod(p)}
                            style={{
                                padding: "6px 14px", borderRadius: 7, fontSize: 13, fontWeight: 500,
                                border: "none", cursor: "pointer", transition: "all .15s",
                                background: period === p ? "hsl(var(--card))" : "transparent",
                                color: period === p ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                boxShadow: period === p ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                            }}>{p}</button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {isAdmin
                ? <AdminLeaderboard users={MOCK_USERS} />
                : <SelfView user={selfUser} />
            }
        </div>
    );
}
