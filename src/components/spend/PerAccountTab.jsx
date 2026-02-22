import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "../ui/table";

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MOCK = [
    { account: "Acc-01", vertical: "Loan US", spend: 4200, trueCost: 4805, revenue: 7800, pl: 2995, roi: 62.3 },
    { account: "Acc-03", vertical: "Loan US", spend: 3800, trueCost: 4348, revenue: 6200, pl: 1852, roi: 42.6 },
    { account: "Acc-07", vertical: "Loan US", spend: 2900, trueCost: 3318, revenue: 5100, pl: 1782, roi: 53.7 },
    { account: "Acc-12", vertical: "Pet Fin", spend: 1600, trueCost: 1830, revenue: 3400, pl: 1570, roi: 85.8 },
    { account: "Acc-09", vertical: "Loan US", spend: 1800, trueCost: 2060, revenue: 1500, pl: -560, roi: -27.2 },
];

export function PerAccountTab({ accountData }) {
    const rows = accountData?.length > 0 ? accountData : MOCK;
    const totals = rows.reduce((a, r) => ({ spend: a.spend + r.spend, trueCost: a.trueCost + r.trueCost, revenue: a.revenue + r.revenue, pl: a.pl + r.pl }), { spend: 0, trueCost: 0, revenue: 0, pl: 0 });
    const totalRoi = totals.trueCost > 0 ? ((totals.revenue - totals.trueCost) / totals.trueCost * 100) : 0;

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Per Account</CardTitle>
                    <button className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition">Export</button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead>Vertical</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                            <TableHead className="text-right">True Cost</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">P/L</TableHead>
                            <TableHead className="text-right">ROI</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r, i) => (
                            <TableRow key={i} className="cursor-pointer">
                                <TableCell className="font-medium">{r.account}</TableCell>
                                <TableCell className="text-[hsl(var(--muted-foreground))]">{r.vertical}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(r.spend)}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(r.trueCost)}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(r.revenue)}</TableCell>
                                <TableCell className={`text-right font-mono font-semibold ${r.pl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {r.pl >= 0 ? '+' : ''}{fmt(r.pl)}
                                </TableCell>
                                <TableCell className="text-right font-mono">{r.roi.toFixed(1)}%</TableCell>
                                <TableCell>
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.roi >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                                            : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                                        }`}>
                                        {r.roi >= 0 ? 'Profitable' : 'Loss'}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell className="font-bold">Total</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right font-mono font-bold">{fmt(totals.spend)}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{fmt(totals.trueCost)}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{fmt(totals.revenue)}</TableCell>
                            <TableCell className={`text-right font-mono font-bold ${totals.pl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{totals.pl >= 0 ? '+' : ''}{fmt(totals.pl)}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{totalRoi.toFixed(1)}%</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </CardContent>
        </Card>
    );
}
