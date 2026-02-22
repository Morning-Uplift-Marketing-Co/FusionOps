import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const MOCK_TREND = [
    { date: "02/17", spend: 450, trueCost: 515, revenue: 1000, roi: 94 },
    { date: "02/18", spend: 600, trueCost: 687, revenue: 1200, roi: 74 },
    { date: "02/19", spend: 800, trueCost: 916, revenue: 1800, roi: 96 },
    { date: "02/20", spend: 400, trueCost: 458, revenue: 700, roi: 52 },
    { date: "02/21", spend: 550, trueCost: 629, revenue: 1400, roi: 122 },
    { date: "02/22", spend: 720, trueCost: 823, revenue: 1600, roi: 94 },
    { date: "02/23", spend: 680, trueCost: 778, revenue: 1500, roi: 93 },
];

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function KpiCard({ label, value, sub, color }) {
    const borderC = `hsl(var(--${color}))`;
    return (
        <Card className="relative p-4" style={{ borderColor: `${borderC}30`, background: `${borderC}08` }}>
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: borderC }}>{label}</div>
            <div className="text-[26px] font-bold mt-0.5">{value}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{sub}</div>
        </Card>
    );
}

export function OverviewTab({ stats, trendData }) {
    const s = stats || {};
    const netProfit = (s.revenue || 0) - (s.trueCost || 0);
    const avgCpa = s.conversions > 0 ? s.trueCost / s.conversions : 0;
    const rejRate = s.leadsSubmitted > 0 ? ((s.leadsRejected || 0) / s.leadsSubmitted) * 100 : 0;
    const avgPayout = s.leadsSold > 0 ? s.revenue / s.leadsSold : 0;
    const chartData = trendData?.length > 0 ? trendData : MOCK_TREND;

    return (
        <div className="space-y-6 animate-[fadeIn_.3s_ease]">
            {/* Row 1: Core KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Ad Spend" value={fmt(s.totalSpend)} sub={`+ ${fmt(s.vat)} VAT (7%)`} color="warning" />
                <KpiCard label="True Cost (Loaded)" value={fmt(s.trueCost)} sub={`+ ${fmt(s.lendingCardFees)} LC (3.5%)`} color="destructive" />
                <KpiCard label="Gross Revenue" value={fmt(s.revenue)} sub={`${s.conversions || 0} Conversions`} color="success" />
                <KpiCard label="True ROI" value={`${s.roi || 0}%`} sub="Loaded Cost Basis" color="primary" />
            </div>

            {/* Row 2: Net KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Net Profit" value={fmt(netProfit)} sub={netProfit >= 0 ? "▲ Positive" : "▼ Negative"} color={netProfit >= 0 ? "success" : "destructive"} />
                <KpiCard label="Avg CPA" value={fmt(avgCpa)} sub="per lead" color="primary" />
                <KpiCard label="Avg Payout" value={fmt(avgPayout)} sub="per sold" color="primary" />
                <KpiCard label="Rejection" value={`${rejRate.toFixed(1)}%`} sub="rate" color={rejRate > 20 ? "destructive" : "warning"} />
            </div>

            {/* Chart + Top accounts */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "2fr 1.2fr" }}>
                <Card>
                    <CardHeader><CardTitle className="text-sm font-semibold">📈 7 Day Trend</CardTitle></CardHeader>
                    <CardContent className="pt-2">
                        <div className="h-[280px] w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="date" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#f8fafc' }} />
                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                    <Line type="monotone" name="True Cost" dataKey="trueCost" stroke="#ff4d4f" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    <Line type="monotone" name="Revenue" dataKey="revenue" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-sm font-semibold">🏆 Top Performers</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-[11px] text-[hsl(var(--muted-foreground))] mb-3">Ranked by net profit (MTD)</div>
                        {(s.topAccounts || [
                            { name: "Acc-01", profit: 820, domain: "bearloannow" },
                            { name: "Acc-03", profit: 650, domain: "loanbears" },
                            { name: "Acc-07", profit: 540, domain: "petcarefin" },
                        ]).map((a, i) => (
                            <div key={i} className="flex justify-between items-center py-2 border-b border-[hsl(var(--border))] last:border-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))]">#{i + 1}</span>
                                    <div>
                                        <div className="text-xs font-semibold">{a.name}</div>
                                        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{a.domain}</div>
                                    </div>
                                </div>
                                <span className={`text-xs font-bold ${a.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {a.profit >= 0 ? '+' : ''}{fmt(a.profit)}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
