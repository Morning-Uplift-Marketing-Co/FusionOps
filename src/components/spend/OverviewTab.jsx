import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from "recharts";

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
const HIDDEN_VALUE = "Hidden";

function KpiCard({ label, value, sub, change, changeType }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{label}</CardTitle>
                    {change !== undefined && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${changeType === "up" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                                : changeType === "down" ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                                    : "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400"
                            }`}>
                            {changeType === "up" ? "+" : changeType === "down" ? "" : ""}{change}
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {sub && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{sub}</p>}
            </CardContent>
        </Card>
    );
}

export function OverviewTab({ stats, trendData, hideRevenue = false }) {
    const s = stats || {};
    const netProfit = (s.revenue || 0) - (s.trueCost || 0);
    const avgCpa = s.conversions > 0 ? s.trueCost / s.conversions : 0;
    const chartData = trendData?.length > 0 ? trendData : MOCK_TREND;

    return (
        <div className="space-y-6">
            {/* Row 1: Core KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Ad Spend" value={fmt(s.totalSpend)} sub={`+ ${fmt(s.vat)} VAT (7%)`} change="+6.1%" changeType="up" />
                <KpiCard label="True Cost (Loaded)" value={fmt(s.trueCost)} sub={`+ ${fmt(s.lendingCardFees)} LC Fees`} change="+19.2%" changeType="up" />
                <KpiCard
                    label="Gross Revenue"
                    value={hideRevenue ? HIDDEN_VALUE : fmt(s.revenue)}
                    sub={`${s.conversions || 0} Conversions`}
                    {...(hideRevenue ? {} : { change: "+12.5%", changeType: "up" })}
                />
                <KpiCard
                    label="True ROI"
                    value={hideRevenue ? HIDDEN_VALUE : `${s.roi || 0}%`}
                    sub={hideRevenue ? "Employee view enabled" : "Loaded Cost Basis"}
                    {...(hideRevenue ? {} : { change: "-1.2%", changeType: "down" })}
                />
            </div>

            {/* Row 2: Secondary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                    label="Net Profit"
                    value={hideRevenue ? HIDDEN_VALUE : fmt(netProfit)}
                    sub={hideRevenue ? "Employee view enabled" : netProfit >= 0 ? "▲ Positive" : "▼ Negative"}
                    {...(hideRevenue ? {} : { change: netProfit >= 0 ? "+15%" : "-5%", changeType: netProfit >= 0 ? "up" : "down" })}
                />
                <KpiCard label="Avg CPA" value={fmt(avgCpa)} sub="per lead" />
                <KpiCard label="Avg Payout" value={hideRevenue ? HIDDEN_VALUE : fmt(s.leadsSold > 0 ? s.revenue / s.leadsSold : 0)} sub={hideRevenue ? "Employee view enabled" : "per sold"} />
                <KpiCard label="Rejection Rate" value={`${s.leadsSubmitted > 0 ? ((s.leadsRejected || 0) / s.leadsSubmitted * 100).toFixed(1) : '0.0'}%`} sub="rate" />
            </div>

            {/* Charts + Top Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Revenue Chart */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Total Revenue</CardTitle>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">{hideRevenue ? "Revenue trend hidden in employee view" : "Income in the last 7 days"}</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full overflow-hidden">
                            {hideRevenue ? (
                                <div className="h-full rounded-lg border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
                                    Revenue chart hidden
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                                    <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: 'hsl(var(--foreground))' }} />
                                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                        <Bar name="Revenue" dataKey="revenue" fill="hsl(var(--foreground))" radius={[4, 4, 0, 0]} />
                                        <Bar name="True Cost" dataKey="trueCost" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Returning Rate / Line chart */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>ROI Trend</CardTitle>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">7-day rolling</p>
                            </div>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">+2.5%</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full overflow-hidden">
                            <ResponsiveContainer width="100%" height={300} minWidth={0}>
                                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: 'hsl(var(--foreground))' }} />
                                    <Line type="monotone" dataKey="roi" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Performers Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Top Performers</CardTitle>
                        <button className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition flex items-center gap-1">
                            View more →
                        </button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Account</TableHead>
                                <TableHead>Domain</TableHead>
                                <TableHead className="text-right">Profit</TableHead>
                                <TableHead className="text-right">ROI</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(s.topAccounts || [
                                { name: "Acc-01", domain: "bearloannow.com", profit: 2995, roi: 62.3, status: "active" },
                                { name: "Acc-03", domain: "loanbears.com", profit: 1852, roi: 42.6, status: "active" },
                                { name: "Acc-07", domain: "petcarefin.com", profit: 1570, roi: 85.8, status: "active" },
                                { name: "Acc-09", domain: "loanfast.com", profit: -560, roi: -27.2, status: "paused" },
                            ]).map((a, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{a.name}</TableCell>
                                    <TableCell className="text-[hsl(var(--muted-foreground))]">{a.domain}</TableCell>
                                    <TableCell className={`text-right font-mono font-semibold ${hideRevenue ? "text-[hsl(var(--muted-foreground))]" : a.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {hideRevenue ? HIDDEN_VALUE : `${a.profit >= 0 ? '+' : ''}${fmt(a.profit)}`}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{hideRevenue ? HIDDEN_VALUE : `${a.roi}%`}</TableCell>
                                    <TableCell>
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${a.status === 'active'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                            }`}>
                                            {a.status === 'active' ? 'Active' : 'Paused'}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
