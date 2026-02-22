import React, { useState, useEffect, useMemo } from "react";
import { THEME as T } from "../constants";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { fetchLendingCardTransactions, normalizeTransactions } from "../services/lendingcard";
import { loadSettings } from "../services/neon";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const MOCK_DATA = [
    { date: "02/10", spend: 450, trueCost: 515, revenue: 1000, roi: 94 },
    { date: "02/11", spend: 600, trueCost: 687, revenue: 1200, roi: 74 },
    { date: "02/12", spend: 800, trueCost: 916, revenue: 1800, roi: 96 },
    { date: "02/13", spend: 400, trueCost: 458, revenue: 700, roi: 52 },
    { date: "02/14", spend: 550, trueCost: 629, revenue: 1400, roi: 122 },
];

export function SpendDashboard({ apiOk, neonOk }) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalSpend: 0,
        trueCost: 0,
        conversions: 0,
        revenue: 0,
        roi: 0,
        lendingCardFees: 0,
        vat: 0
    });
    const [trendData, setTrendData] = useState([]);

    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const settings = await loadSettings() || {};
            // Try settings first, then Vite env var, then fallback to testing localStorage
            const lcToken = settings.lendingCardApiToken
                || import.meta.env.PUBLIC_LENDINGCARD_API_TOKEN
                || localStorage.getItem("LC_API_TOKEN");

            if (lcToken) {
                const txData = await fetchLendingCardTransactions(lcToken, '2026-02-01');
                const cleanTxs = normalizeTransactions(txData);
                setTransactions(cleanTxs.slice(0, 5)); // First 5 for UI table
            } else {
                console.warn("[SpendDashboard] No LendingCard API token found.");
            }

            const vKeyId = settings.voluumAccessKeyId || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY_ID;
            const vKey = settings.voluumAccessKey || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY;

            let realStats = {
                totalSpend: 0,
                vat: 0,
                lendingCardFees: 0,
                trueCost: 0,
                conversions: 0,
                revenue: 0,
                roi: 0
            };

            let dailyTrend = [];

            if (!vKeyId || !vKey) {
                console.warn("[SpendDashboard] No Voluum API keys found. Using zeroed stats.");
            } else {
                try {
                    const { fetchVoluumSession, fetchVoluumReport, extractMetrics } = await import("../services/voluum.js");
                    const token = await fetchVoluumSession(vKeyId, vKey);

                    // Fetch last 7 days for the top level KPI
                    const toDate = new Date();
                    const fromDate = new Date();
                    fromDate.setDate(toDate.getDate() - 7);

                    const report = await fetchVoluumReport(token, fromDate, toDate);
                    const metrics = extractMetrics(report);

                    const spend = metrics.cost || 0;
                    const rev = metrics.revenue || 0;
                    const vat = spend * 0.07;
                    const lc = spend * 0.035;
                    const tc = spend + vat + lc;
                    const roi = tc > 0 ? ((rev - tc) / tc) * 100 : 0;

                    realStats = {
                        totalSpend: spend,
                        vat: vat,
                        lendingCardFees: lc,
                        trueCost: tc,
                        conversions: metrics.conversions || 0,
                        revenue: rev,
                        roi: parseFloat(roi.toFixed(1))
                    };

                    const trendReport = await fetchVoluumReport(token, fromDate, toDate, "UTC", "day");
                    if (trendReport && trendReport.rows) {
                        dailyTrend = trendReport.rows.map(row => {
                            const dateStr = row.day || row.id || "";
                            const shortDate = dateStr.slice(5, 10).replace("-", "/"); // Keep MM/DD

                            const dSpend = row.cost || 0;
                            const dRev = row.revenue || 0;
                            const dTrueCost = dSpend + (dSpend * 0.07) + (dSpend * 0.035);
                            const dRoi = dTrueCost > 0 ? ((dRev - dTrueCost) / dTrueCost) * 100 : 0;

                            return {
                                date: shortDate,
                                spend: parseFloat(dSpend.toFixed(2)),
                                trueCost: parseFloat(dTrueCost.toFixed(2)),
                                revenue: parseFloat(dRev.toFixed(2)),
                                roi: parseFloat(dRoi.toFixed(1))
                            };
                        }).reverse();
                    }
                } catch (err) {
                    console.error("[SpendDashboard] Failed to fetch real Voluum data:", err);
                }
            }

            setStats(realStats);
            setTrendData(dailyTrend);
            setLoading(false);

        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    return (
        <div className="animate-[fadeIn_.3s_ease]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold m-0 flex items-center gap-2">
                        💳 Spend Dashboard
                    </h1>
                    <p className="text-[hsl(var(--muted-foreground))] text-sm mt-0.5">True Cost & ROI Tracking combining Google Ads, VAT, and Bank Fees</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadData} disabled={loading}>
                        {loading ? "Syncing..." : "🔄 Sync Now"}
                    </Button>
                </div>
            </div>

            {/* Top Level KPIs */}
            <div className="grid grid-cols-4 gap-3 mb-6">
                <Card className="relative p-4 border-[hsl(var(--warning))/30] bg-[hsl(var(--warning))/5]">
                    <div className="text-[11px] font-bold text-[hsl(var(--warning))] uppercase tracking-wider">Google Ad Spend</div>
                    <div className="text-[26px] font-bold mt-0.5">${stats.totalSpend.toLocaleString()}</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">+ $196 VAT (7%)</div>
                </Card>
                <Card className="relative p-4 border-[hsl(var(--destructive))/30] bg-[hsl(var(--destructive))/5]">
                    <div className="text-[11px] font-bold text-[hsl(var(--destructive))] uppercase tracking-wider">True Cost (Loaded)</div>
                    <div className="text-[26px] font-bold mt-0.5">${stats.trueCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">+ $98 LC Fees (3.5%)</div>
                </Card>
                <Card className="relative p-4 border-[hsl(var(--success))/30] bg-[hsl(var(--success))/5]">
                    <div className="text-[11px] font-bold text-[hsl(var(--success))] uppercase tracking-wider">Gross Revenue</div>
                    <div className="text-[26px] font-bold mt-0.5">${stats.revenue.toLocaleString()}</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{stats.conversions} Conversions</div>
                </Card>
                <Card className="relative p-4 border-[hsl(var(--primary))/30] bg-[hsl(var(--primary))/5]">
                    <div className="text-[11px] font-bold text-[hsl(var(--primary))] uppercase tracking-wider">True ROI</div>
                    <div className="text-[26px] font-bold mt-0.5">{stats.roi}%</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Loaded Cost Basis</div>
                </Card>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: "2fr 1.2fr" }}>
                {/* Trend Chart */}
                <Card className="flex-1">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold flex items-center justify-between">
                            📈 7 Day Trend
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="h-[280px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData.length > 0 ? trendData : MOCK_DATA} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                                        itemStyle={{ color: '#f8fafc' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                    <Line type="monotone" name="True Cost" dataKey="trueCost" stroke="#ff4d4f" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    <Line type="monotone" name="Revenue" dataKey="revenue" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-4">
                    {/* Deposit Fees Log */}
                    <Card className="flex-1">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold flex items-center justify-between">
                                🏛️ Recent LC Deposits
                                <span className="text-[10px] font-normal text-muted-foreground bg-[hsl(var(--border))] px-2 py-0.5 rounded">Auto-sync</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {transactions.length === 0 ? (
                                <div className="text-center py-6 text-[hsl(var(--muted-foreground))]">
                                    <div className="text-2xl mb-1.5">📡</div>
                                    <div className="text-[11px]">No transactions synced yet</div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {transactions.map(tx => (
                                        <div key={tx.id} className="flex justify-between items-center pb-3 border-b border-[hsl(var(--border))] last:border-0 last:pb-0">
                                            <div>
                                                <div className="text-xs font-semibold">{tx.merchant}</div>
                                                <div className="text-[10px] text-muted-foreground">{new Date(tx.date).toLocaleDateString()} • {tx.card_last4 ? `*${tx.card_last4}` : 'Card'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold">${parseFloat(tx.amount).toFixed(2)}</div>
                                                <div className="text-[10px] text-destructive">Fee: ${parseFloat(tx.deposit_fee).toFixed(2)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

        </div>
    );
}
