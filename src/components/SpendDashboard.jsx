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
import { OpexTab } from "./spend/OpexTab";

const TAB_ITEMS = [
    { value: "overview", icon: "📊", label: "Overview" },
    { value: "daily", icon: "📋", label: "Daily Log" },
    { value: "account", icon: "👤", label: "Per Account" },
    { value: "card", icon: "💳", label: "Per Card" },
    { value: "domain", icon: "🌐", label: "Per Domain" },
    { value: "pnl", icon: "📈", label: "P&L" },
    { value: "reconcile", icon: "🔄", label: "Reconcile" },
    { value: "opex", icon: "🏢", label: "Opex" },
];

export function SpendDashboard({ apiOk, neonOk }) {
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Spend Dashboard</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Full Accounting — True Cost & ROI Tracking</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadData} disabled={loading} className="text-xs h-9">
                        {loading ? "⏳ Syncing..." : "🔄 Sync Now"}
                    </Button>
                </div>
            </div>

            {/* Shadcn Tabs */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-8">
                    {TAB_ITEMS.map(t => (
                        <TabsTrigger key={t.value} value={t.value} className="text-xs gap-1">
                            <span>{t.icon}</span> {t.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="overview"><OverviewTab stats={stats} trendData={trendData} /></TabsContent>
                <TabsContent value="daily"><DailyLogTab /></TabsContent>
                <TabsContent value="account"><PerAccountTab /></TabsContent>
                <TabsContent value="card"><PerCardTab /></TabsContent>
                <TabsContent value="domain"><PerDomainTab /></TabsContent>
                <TabsContent value="pnl"><MonthlyPnLTab /></TabsContent>
                <TabsContent value="reconcile"><ReconcileTab /></TabsContent>
                <TabsContent value="opex"><OpexTab /></TabsContent>
            </Tabs>
        </div>
    );
}
