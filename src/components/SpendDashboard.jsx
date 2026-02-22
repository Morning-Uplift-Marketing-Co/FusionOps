import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { loadSettings } from "../services/neon";
import { fetchLendingCardTransactions, normalizeTransactions } from "../services/lendingcard";

import { OverviewTab } from "./spend/OverviewTab";
import { DailyLogTab } from "./spend/DailyLogTab";
import { PerAccountTab } from "./spend/PerAccountTab";
import { PerCardTab } from "./spend/PerCardTab";
import { PerDomainTab } from "./spend/PerDomainTab";
import { MonthlyPnLTab } from "./spend/MonthlyPnLTab";
import { ReconcileTab } from "./spend/ReconcileTab";
import { OpexTab } from "./spend/OpexTab";

const TABS = [
    { key: "overview", icon: "📊", label: "Overview" },
    { key: "daily", icon: "📋", label: "Daily Log" },
    { key: "account", icon: "👤", label: "Per Account" },
    { key: "card", icon: "💳", label: "Per Card" },
    { key: "domain", icon: "🌐", label: "Per Domain" },
    { key: "pnl", icon: "📈", label: "Monthly P&L" },
    { key: "reconcile", icon: "🔄", label: "Reconcile" },
    { key: "opex", icon: "🏢", label: "Opex" },
];

export function SpendDashboard({ apiOk, neonOk }) {
    const [tab, setTab] = useState("overview");
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalSpend: 0, trueCost: 0, conversions: 0, revenue: 0, roi: 0,
        lendingCardFees: 0, vat: 0, leadsSubmitted: 0, leadsSold: 0, leadsRejected: 0,
    });
    const [trendData, setTrendData] = useState([]);
    const [transactions, setTransactions] = useState([]);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const settings = await loadSettings() || {};
            const lcToken = settings.lendingCardApiToken
                || import.meta.env.PUBLIC_LENDINGCARD_API_TOKEN
                || localStorage.getItem("LC_API_TOKEN");

            if (lcToken) {
                try {
                    const txData = await fetchLendingCardTransactions(lcToken, '2026-02-01');
                    setTransactions(normalizeTransactions(txData).slice(0, 10));
                } catch (e) { console.warn("[SpendDashboard] LC fetch failed:", e); }
            }

            const vKeyId = settings.voluumAccessKeyId || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY_ID;
            const vKey = settings.voluumAccessKey || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY;

            let realStats = { ...stats };
            let dailyTrend = [];

            if (vKeyId && vKey) {
                try {
                    const { fetchVoluumSession, fetchVoluumReport, extractMetrics } = await import("../services/voluum.js");
                    const token = await fetchVoluumSession(vKeyId, vKey);
                    const toDate = new Date(); const fromDate = new Date(); fromDate.setDate(toDate.getDate() - 7);
                    const report = await fetchVoluumReport(token, fromDate, toDate);
                    const m = extractMetrics(report);
                    const spend = m.cost || 0, rev = m.revenue || 0;
                    const vat = spend * 0.07, lc = spend * 0.035, tc = spend + vat + lc;
                    const roi = tc > 0 ? ((rev - tc) / tc) * 100 : 0;

                    realStats = {
                        totalSpend: spend, vat, lendingCardFees: lc, trueCost: tc,
                        conversions: m.conversions || 0, revenue: rev, roi: parseFloat(roi.toFixed(1)),
                        leadsSubmitted: 0, leadsSold: 0, leadsRejected: 0
                    };

                    const trendReport = await fetchVoluumReport(token, fromDate, toDate, "UTC", "day");
                    if (trendReport?.rows) {
                        dailyTrend = trendReport.rows.map(row => {
                            const ds = row.day || row.id || "";
                            const dSpend = row.cost || 0, dRev = row.revenue || 0;
                            const dTC = dSpend + (dSpend * 0.07) + (dSpend * 0.035);
                            return { date: ds.slice(5, 10).replace("-", "/"), spend: +dSpend.toFixed(2), trueCost: +dTC.toFixed(2), revenue: +dRev.toFixed(2), roi: +(dTC > 0 ? ((dRev - dTC) / dTC * 100) : 0).toFixed(1) };
                        }).reverse();
                    }
                } catch (err) { console.error("[SpendDashboard] Voluum error:", err); }
            }

            setStats(realStats);
            setTrendData(dailyTrend);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const renderTab = () => {
        switch (tab) {
            case "overview": return <OverviewTab stats={stats} trendData={trendData} />;
            case "daily": return <DailyLogTab />;
            case "account": return <PerAccountTab />;
            case "card": return <PerCardTab />;
            case "domain": return <PerDomainTab />;
            case "pnl": return <MonthlyPnLTab />;
            case "reconcile": return <ReconcileTab />;
            case "opex": return <OpexTab />;
            default: return <OverviewTab stats={stats} trendData={trendData} />;
        }
    };

    return (
        <div className="animate-[fadeIn_.3s_ease]">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold m-0 flex items-center gap-2">💳 Spend Dashboard</h1>
                    <p className="text-[hsl(var(--muted-foreground))] text-sm mt-0.5">Full Accounting — True Cost & ROI Tracking</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadData} disabled={loading} className="text-xs">
                        {loading ? "⏳ Syncing..." : "🔄 Sync Now"}
                    </Button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-6 overflow-x-auto pb-1 border-b border-[hsl(var(--border))]">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-t-lg transition whitespace-nowrap
              ${tab === t.key
                                ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))] -mb-[1px]'
                                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/50'
                            }`}
                    >
                        <span>{t.icon}</span> {t.label}
                    </button>
                ))}
            </div>

            {/* Active Tab Content */}
            {renderTab()}
        </div>
    );
}
