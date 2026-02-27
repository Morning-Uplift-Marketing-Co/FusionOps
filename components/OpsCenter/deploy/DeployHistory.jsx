/**
 * Deploy History
 *
 * Display deployment history with filtering and re-deploy capability
 */

import { useState, useEffect } from "react";
import { THEME as T } from "../../../constants";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { getDeploymentHistory, getDeploymentStats } from "../../../utils/deployers";

const S = {
    section: {},
    sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionTitle: { fontSize: 13, fontWeight: 700, color: T.text },
    filters: { display: "flex", gap: 8, marginBottom: 12 },
    filterBtn: (active) => ({
        padding: "4px 10px", borderRadius: 5, fontSize: 10, cursor: "pointer",
        background: active ? T.primary : "transparent",
        color: active ? "white" : T.muted,
        border: `1px solid ${active ? T.primary : T.border}`
    }),
    table: { width: "100%", borderCollapse: "collapse", fontSize: 11 },
    tableHeader: { textAlign: "left", padding: "10px 12px", color: T.muted, fontWeight: 600, borderBottom: `1px solid ${T.border}` },
    tableCell: { padding: "10px 12px", borderBottom: `1px solid ${T.border}33` },
    statusSuccess: { color: T.success },
    statusFailed: { color: T.danger },
    statCard: { padding: 16, borderRadius: 8, background: T.card2, border: `1px solid ${T.border}`, minWidth: 120 },
    statValue: { fontSize: 24, fontWeight: 700, color: T.text },
    statLabel: { fontSize: 10, color: T.muted, marginTop: 4 },
    emptyState: { padding: 32, textAlign: "center", color: T.muted }
};

export function DeployHistory({ domains, onRedeploy }) {
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState(null);
    const [statusFilter, setStatusFilter] = useState("all"); // all, success, failed
    const [domainFilter, setDomainFilter] = useState("all");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [historyData, statsData] = await Promise.all([
                getDeploymentHistory(null, null, null, 50),
                getDeploymentStats()
            ]);
            setHistory(historyData);
            setStats(statsData);
        } catch (e) {
            console.error("Failed to load deployment data:", e);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredHistory = () => {
        let filtered = history;

        if (statusFilter !== "all") {
            filtered = filtered.filter(h => h.status === statusFilter);
        }

        if (domainFilter !== "all") {
            filtered = filtered.filter(h => h.siteId === domainFilter || h.domain === domainFilter);
        }

        return filtered;
    };

    const formatDate = (iso) => {
        const date = new Date(iso);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    };

    const formatDuration = (ms) => {
        if (!ms) return "—";
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const handleRedeploy = (record) => {
        if (onRedeploy) {
            onRedeploy(record);
        }
    };

    const handleClearHistory = () => {
        if (confirm("Clear all deployment history?")) {
            localStorage.removeItem("lpf2-deploy-history");
            loadData();
        }
    };

    const filtered = getFilteredHistory();

    return (
        <div style={S.section}>
            {/* Header */}
            <div style={S.sectionHeader}>
                <div>
                    <div style={S.sectionTitle}>Deployment History</div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                        Track all deployments across targets
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="ghost"  size="sm" onClick={loadData}>
                        ↻ Refresh
                    </Button>
                    {history.length > 0 && (
                        <Button variant="ghost"  size="sm" onClick={handleClearHistory} style={{ color: T.danger }}>
                            Clear
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <div style={S.statCard}>
                        <div style={S.statValue}>{stats.total}</div>
                        <div style={S.statLabel}>Total Deploys</div>
                    </div>
                    <div style={S.statCard}>
                        <div style={{ ...S.statValue, color: T.success }}>{stats.successRate}%</div>
                        <div style={S.statLabel}>Success Rate</div>
                    </div>
                    <div style={S.statCard}>
                        <div style={S.statValue}>{stats.last24h}</div>
                        <div style={S.statLabel}>Last 24h</div>
                    </div>
                    <div style={S.statCard}>
                        <div style={S.statValue}>{formatDuration(stats.avgDuration)}</div>
                        <div style={S.statLabel}>Avg Duration</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={S.filters}>
                <div style={S.filterBtn(statusFilter === "all")} onClick={() => setStatusFilter("all")}>
                    All
                </div>
                <div style={S.filterBtn(statusFilter === "success")} onClick={() => setStatusFilter("success")}>
                    ✓ Success
                </div>
                <div style={S.filterBtn(statusFilter === "failed")} onClick={() => setStatusFilter("failed")}>
                    ✗ Failed
                </div>
                <select
                    style={{ marginLeft: "auto", padding: "4px 8px", borderRadius: 5, background: T.input, border: `1px solid ${T.border}`, color: T.text, fontSize: 10 }}
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(e.target.value)}
                >
                    <option value="all">All Domains</option>
                    {domains.map(d => (
                        <option key={d.id} value={d.id}>{d.domain || d.brand || "Unnamed"}</option>
                    ))}
                </select>
            </div>

            {/* History Table */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
                {loading ? (
                    <div style={S.emptyState}>Loading...</div>
                ) : filtered.length === 0 ? (
                    <div style={S.emptyState}>
                        {history.length === 0 ? "No deployments yet" : "No matching deployments"}
                    </div>
                ) : (
                    <table style={S.table}>
                        <thead>
                            <tr>
                                <th style={S.tableHeader}>Time</th>
                                <th style={S.tableHeader}>Domain</th>
                                <th style={S.tableHeader}>Target</th>
                                <th style={S.tableHeader}>Status</th>
                                <th style={S.tableHeader}>Duration</th>
                                <th style={S.tableHeader}>URL</th>
                                <th style={S.tableHeader}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(h => (
                                <tr key={h.id}>
                                    <td style={S.tableCell}>
                                        <div>{formatDate(h.timestamp)}</div>
                                        <div style={{ fontSize: 9, color: T.muted }}>
                                            {new Date(h.timestamp).toLocaleString()}
                                        </div>
                                    </td>
                                    <td style={S.tableCell}>
                                        <div style={{ fontWeight: 500 }}>{h.domain}</div>
                                        {h.dnsUpdated && (
                                            <div style={{ fontSize: 9, color: T.success }}>DNS ✓</div>
                                        )}
                                    </td>
                                    <td style={S.tableCell}>
                                        <Badge variant="outline">{h.target}</Badge>
                                    </td>
                                    <td style={S.tableCell}>
                                        {h.status === "success" ? (
                                            <span style={S.statusSuccess}>✓ Success</span>
                                        ) : (
                                            <span style={S.statusFailed}>✗ Failed</span>
                                        )}
                                        {h.dnsError && (
                                            <div style={{ fontSize: 9, color: T.warning }}>DNS warning</div>
                                        )}
                                    </td>
                                    <td style={S.tableCell}>{formatDuration(h.duration)}</td>
                                    <td style={S.tableCell}>
                                        {h.url ? (
                                            <a href={h.url} target="_blank" rel="noopener" style={{ color: T.primary, textDecoration: "none" }}>
                                                Open ↗
                                            </a>
                                        ) : (
                                            <span style={{ color: T.muted }}>—</span>
                                        )}
                                    </td>
                                    <td style={S.tableCell}>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            {h.status === "success" && (
                                                <button
                                                    style={{ background: "none", border: "none", color: T.primary, cursor: "pointer", fontSize: 10 }}
                                                    onClick={() => handleRedeploy(h)}
                                                >
                                                    Redeploy
                                                </button>
                                            )}
                                            {h.error && (
                                                <span style={{ fontSize: 9, color: T.danger, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {h.error}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
}


