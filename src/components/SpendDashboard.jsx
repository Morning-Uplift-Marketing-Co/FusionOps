import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { loadSettings } from "../services/neon";
import { fetchLendingCardTransactions, normalizeTransactions } from "../services/lendingcard";

import { OverviewTab } from "./spend/OverviewTab";
import { DailyLogTab } from "./spend/DailyLogTab";
import { PerAccountTab } from "./spend/PerAccountTab";
import { PerCardTab } from "./spend/PerCardTab";
import { PerDomainTab } from "./spend/PerDomainTab";
import { MonthlyPnLTab } from "./spend/MonthlyPnLTab";
import { ReconcileTab } from "./spend/ReconcileTab";
import { TrackingReconcileTab } from "./spend/TrackingReconcileTab";
import { OpexTab } from "./spend/OpexTab";


const TAB_ITEMS = [
    { value: "overview", icon: "📊", label: "Overview" },
    { value: "daily", icon: "📋", label: "Daily Log" },
    { value: "account", icon: "👤", label: "Per Account" },
    { value: "card", icon: "💳", label: "Per Card" },
    { value: "domain", icon: "🌐", label: "Per Domain" },
    { value: "pnl", icon: "📈", label: "P&L" },
    { value: "reconcile", icon: "🔄", label: "Reconcile" },
    { value: "tracking_cv", icon: "🎯", label: "Tracking CV" },
    { value: "opex", icon: "🏢", label: "Opex" },
];

const RANGE_PRESETS = [
    { id: "7d", label: "7 Days", days: 7 },
    { id: "14d", label: "14 Days", days: 14 },
    { id: "30d", label: "30 Days", days: 30 },
    { id: "mtd", label: "MTD", days: 0 }, // special
    { id: "today", label: "Today", days: 1 },
];

function getDateRange(preset) {
    const to = new Date();
    const from = new Date();
    if (preset === "mtd") {
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
    } else {
        const days = RANGE_PRESETS.find(r => r.id === preset)?.days || 7;
        from.setDate(to.getDate() - days);
    }
    return { from, to };
}

export function SpendDashboard({ apiOk, neonOk, settings = {} }) {
    const hideRevenue = settings.hideRevenue === true;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [range, setRange] = useState("7d");
    const [stats, setStats] = useState({
        totalSpend: 0, trueCost: 0, conversions: 0, revenue: 0, roi: 0,
        lendingCardFees: 0, vat: 0, leadsSubmitted: 0, leadsSold: 0, leadsRejected: 0,
        visits: 0, clicks: 0, profit: 0,
    });
    const [trendData, setTrendData] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [lastSync, setLastSync] = useState(null);

    useEffect(() => { loadData(range); }, []);

    const loadData = async (selectedRange) => {
        setLoading(true);
        setError(null);
        const rng = selectedRange || range;
        try {
            const settings = await loadSettings() || {};

            // ── LendingCard ──
            const lcToken = settings.lcToken
                || import.meta.env.PUBLIC_LENDINGCARD_API_TOKEN
                || import.meta.env.VITE_LENDINGCARD_TOKEN
                || localStorage.getItem("LC_API_TOKEN");

            if (lcToken) {
                try {
                    const { from } = getDateRange(rng);
                    const fromStr = from.toISOString().slice(0, 10);
                    const txData = await fetchLendingCardTransactions(lcToken, fromStr);
                    setTransactions(normalizeTransactions(txData).slice(0, 50));
                } catch (e) { console.warn("[SpendDashboard] LC fetch failed:", e); }
            }

            // ── Voluum ──
            const vKeyId = settings.voluumAccessKeyId
                || import.meta.env.VITE_VOLUUM_ACCESS_KEY_ID
                || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY_ID;
            const vKey = settings.voluumAccessKey
                || import.meta.env.VITE_VOLUUM_ACCESS_KEY
                || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY;
            let realStats = { ...stats };
            let dailyTrend = [];

            if (vKeyId && vKey) {
                try {
                    const { fetchVoluumSession, fetchVoluumReport, extractMetrics } = await import("../services/voluum.js");
                    const token = await fetchVoluumSession(vKeyId, vKey);
                    const { from: fromDate, to: toDate } = getDateRange(rng);

                    // Main report — grouped by campaign
                    const report = await fetchVoluumReport(token, fromDate, toDate);
                    const m = extractMetrics(report);
                    const spend = m.cost || 0, rev = m.revenue || 0;
                    const vat = spend * 0.07, lc = spend * 0.035, tc = spend + vat + lc;
                    const roi = tc > 0 ? ((rev - tc) / tc) * 100 : 0;
                    realStats = {
                        totalSpend: spend, vat, lendingCardFees: lc, trueCost: tc,
                        conversions: m.conversions || 0, revenue: rev, roi: parseFloat(roi.toFixed(1)),
                        visits: m.visits || 0, clicks: m.clicks || 0, profit: m.profit || 0,
                        leadsSubmitted: 0, leadsSold: 0, leadsRejected: 0,
                    };

                    // Daily trend report
                    const trendReport = await fetchVoluumReport(token, fromDate, toDate, "UTC", "day");
                    if (trendReport?.rows) {
                        dailyTrend = trendReport.rows.map(row => {
                            const ds = row.day || row.id || row.name || "";
                            const dSpend = row.cost || 0, dRev = row.revenue || 0;
                            const dVat = dSpend * 0.07;
                            const dLcFee = dSpend * 0.035;
                            const dTC = dSpend + dVat + dLcFee;
                            return {
                                date: ds.length >= 10 ? ds.slice(5, 10).replace("-", "/") : ds,
                                spend: +dSpend.toFixed(2),
                                vat: +dVat.toFixed(2),
                                lcFee: +dLcFee.toFixed(2),
                                trueCost: +dTC.toFixed(2),
                                revenue: +dRev.toFixed(2),
                                profit: +(dRev - dTC).toFixed(2),
                                conversions: row.conversions || 0,
                                visits: row.visits || 0,
                                clicks: row.clicks || 0,
                                roi: +(dTC > 0 ? ((dRev - dTC) / dTC * 100) : 0).toFixed(1)
                            };
                        }).reverse();
                    }
                    setLastSync(new Date().toLocaleTimeString());
                } catch (err) {
                    console.error("[SpendDashboard] Voluum error:", err);
                    setError(`Voluum sync failed: ${err.message}`);
                }
            } else {
                setError("Voluum API keys not configured. Go to Settings → Voluum API to add your Access Key ID and Secret.");
            }
            setStats(realStats);
            setTrendData(dailyTrend);
        } catch (e) {
            console.error(e);
            setError(e.message);
        }
        setLoading(false);
    };

    const handleRangeChange = (newRange) => {
        setRange(newRange);
        loadData(newRange);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Spend Dashboard</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        Full Accounting — True Cost & ROI Tracking
                        {lastSync && <span className="ml-2 text-xs opacity-60">Last sync: {lastSync}</span>}
                    </p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    {/* Date Range Selector */}
                    <div className="flex rounded-md border border-[hsl(var(--border))] overflow-hidden">
                        {RANGE_PRESETS.map(r => (
                            <button
                                key={r.id}
                                onClick={() => handleRangeChange(r.id)}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                    range === r.id
                                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                                        : "hover:bg-[hsl(var(--muted))]"
                                }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <Button variant="outline" onClick={() => loadData(range)} disabled={loading} className="text-xs h-9">
                        {loading ? "⏳ Syncing..." : "🔄 Sync Now"}
                    </Button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{error}</span>
                    <button
                        onClick={() => setError(null)}
                        className="ml-auto text-red-400/60 hover:text-red-400 text-lg leading-none"
                    >×</button>
                </div>
            )}

            {/* Shadcn Tabs */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-8">
                    {TAB_ITEMS.map(t => (
                        <TabsTrigger key={t.value} value={t.value} className="text-xs gap-1">
                            <span>{t.icon}</span> {t.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="overview"><OverviewTab stats={stats} trendData={trendData} hideRevenue={hideRevenue} /></TabsContent>
                <TabsContent value="daily"><DailyLogTab dailyData={trendData} hideRevenue={hideRevenue} /></TabsContent>
                <TabsContent value="account"><PerAccountTab hideRevenue={hideRevenue} /></TabsContent>
                <TabsContent value="card"><PerCardTab /></TabsContent>
                <TabsContent value="domain"><PerDomainTab hideRevenue={hideRevenue} /></TabsContent>
                <TabsContent value="pnl"><MonthlyPnLTab hideRevenue={hideRevenue} /></TabsContent>
                <TabsContent value="reconcile"><ReconcileTab /></TabsContent>
                <TabsContent value="tracking_cv">
                    <TrackingReconcileTab
                        apiBase={settings.apiBase || import.meta.env?.VITE_API_BASE || ''}
                        apiHeaders={settings.apiSecret ? { Authorization: `Bearer ${settings.apiSecret}` } : {}}
                    />
                </TabsContent>
                <TabsContent value="opex"><OpexTab /></TabsContent>
            </Tabs>
        </div>
    );
}
