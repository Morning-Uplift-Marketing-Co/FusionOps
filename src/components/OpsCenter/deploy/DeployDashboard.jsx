/**
 * Deploy Dashboard
 *
 * Visual dashboard showing deployment statistics and metrics
 */

import { useState, useEffect } from "react";
import { THEME as T } from "../../../constants";
import { Card } from "../../ui/card";
import { getDeploymentStats, getDeploymentHistory } from "../../../utils/deployers";

const S = {
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 },
    statCard: { padding: 16, borderRadius: 8, background: T.card2, border: `1px solid ${T.border}` },
    statValue: { fontSize: 28, fontWeight: 700, color: T.text },
    statLabel: { fontSize: 10, color: T.muted, marginTop: 4 },
    statTrend: { fontSize: 10, marginTop: 4 },
    trendUp: { color: T.success },
    trendDown: { color: T.danger },
    chartContainer: { height: 120, marginTop: 16, position: "relative" },
    chartBar: (height, color) => ({
        position: "absolute", bottom: 0, width: "100%", height: `${height}%`,
        background: color, borderRadius: "4px 4px 0 0", transition: "height 0.3s"
    }),
    targetGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 },
    targetCard: { padding: 12, borderRadius: 6, background: T.card, border: `1px solid ${T.border}` },
    targetBar: { height: 4, borderRadius: 2, background: T.border, marginTop: 8, overflow: "hidden" },
    targetFill: (pct) => ({ height: "100%", background: T.primary, width: `${pct}%` })
};

export function DeployDashboard() {
    const [stats, setStats] = useState(null);
    const [dailyData, setDailyData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            const s = await getDeploymentStats();
            setStats(s);

            // Get history for daily chart
            const history = await getDeploymentHistory(null, null, null, 1000);
            const daily = {};
            history.forEach(h => {
                const day = new Date(h.createdAt || h.timestamp).toDateString();
                daily[day] = (daily[day] || 0) + 1;
            });

            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayStr = d.toDateString();
                last7Days.push({
                    day: d.toLocaleDateString("en", { weekday: "short" }),
                    count: daily[dayStr] || 0,
                });
            }
            setDailyData(last7Days);
        } catch (e) {
            console.error("Failed to load dashboard stats:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card style={{ padding: 32, textAlign: "center", color: T.muted }}>
                Loading dashboard...
            </Card>
        );
    }

    if (!stats) {
        return (
            <Card style={{ padding: 32, textAlign: "center", color: T.muted }}>
                No deployment data yet
            </Card>
        );
    }

    const maxCount = Math.max(...dailyData.map(d => d.count), 1);

    return (
        <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Deploy Dashboard</div>
                <div style={{ fontSize: 11, color: T.muted }}>
                    Overview of deployment activity
                </div>
            </div>

            {/* Main Stats */}
            <div style={S.grid}>
                <div style={S.statCard}>
                    <div style={{ ...S.statValue, color: T.primary }}>{stats.total}</div>
                    <div style={S.statLabel}>Total Deploys</div>
                    <div style={{ ...S.statTrend, ...S.trendUp }}>
                        ↑ {stats.last24h} today
                    </div>
                </div>

                <div style={S.statCard}>
                    <div style={{ ...S.statValue, color: T.success }}>{stats.successRate}%</div>
                    <div style={S.statLabel}>Success Rate</div>
                    <div style={{ ...S.statTrend, ...S.trendUp }}>
                        {stats.failed === 0 ? "No failures" : `${stats.failed} failed`}
                    </div>
                </div>

                <div style={S.statCard}>
                    <div style={{ ...S.statValue }}>{stats.lastWeek}</div>
                    <div style={S.statLabel}>This Week</div>
                    <div style={{ ...S.statTrend }}>
                        {stats.last24h} today
                    </div>
                </div>

                <div style={S.statCard}>
                    <div style={{ ...S.statValue }}>{stats.avgDuration}ms</div>
                    <div style={S.statLabel}>Avg Duration</div>
                    <div style={{ ...S.statTrend }}>
                        {(stats.avgDuration / 1000).toFixed(1)}s
                    </div>
                </div>
            </div>

            {/* Daily Chart */}
            <Card style={{ padding: 16, marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                    Last 7 Days
                </div>
                <div style={{ display: "flex", gap: 8, height: 120, alignItems: "flex-end" }}>
                    {dailyData.map((d, i) => (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: "100%", height: 100, position: "relative" }}>
                                <div style={S.chartBar((d.count / maxCount) * 100 || 2, T.primary)} />
                            </div>
                            <div style={{ fontSize: 9, color: T.muted, marginTop: 4 }}>{d.day}</div>
                            <div style={{ fontSize: 10, fontWeight: 600 }}>{d.count}</div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Target Breakdown */}
            <Card style={{ padding: 16, marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                    Deploys by Target
                </div>
                <div style={S.targetGrid}>
                    {Object.entries(stats.byTarget || {}).map(([target, count]) => {
                        const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                        const targetInfo = {
                            "cf-pages": { label: "CF Pages", color: "#F48120" },
                            "netlify": { label: "Netlify", color: "#00C7B7" },
                            "vercel": { label: "Vercel", color: "#000000" },
                            "cf-workers": { label: "Workers", color: "#F48120" },
                            "s3-cloudfront": { label: "S3+CF", color: "#FF9900" },
                            "vps-ssh": { label: "VPS", color: "#6366F1" },
                        }[target] || { label: target, color: T.muted };

                        return (
                            <div key={target} style={S.targetCard}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 10 }}>{targetInfo.label}</span>
                                    <span style={{ fontSize: 10, fontWeight: 600 }}>{count}</span>
                                </div>
                                <div style={S.targetBar}>
                                    <div style={{ ...S.targetFill(pct), background: targetInfo.color }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}


