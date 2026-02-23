import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MOCK = [
    { date: "2/22", account: "Acc-01", domain: "bearloannow", spend: 320, vat: 22.40, lcFee: 11.98, revenue: 520 },
    { date: "2/22", account: "Acc-03", domain: "loanbears", spend: 280, vat: 19.60, lcFee: 10.49, revenue: 460 },
    { date: "2/21", account: "Acc-01", domain: "bearloannow", spend: 340, vat: 23.80, lcFee: 12.73, revenue: 580 },
    { date: "2/21", account: "Acc-07", domain: "petcarefin", spend: 190, vat: 13.30, lcFee: 7.11, revenue: 380 },
    { date: "2/20", account: "Acc-05", domain: "vetpay", spend: 220, vat: 15.40, lcFee: 8.23, revenue: 310 },
];

export function DailyLogTab({ dailyData }) {
    const rows = dailyData?.length > 0 ? dailyData : MOCK;

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Daily Log</CardTitle>
                    <button className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition">
                        Export CSV
                    </button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead>Domain</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                            <TableHead className="text-right">VAT 7%</TableHead>
                            <TableHead className="text-right">LC Fee</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">P/L</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r, i) => {
                            const pl = r.revenue - r.spend - r.vat - r.lcFee;
                            return (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{r.date}</TableCell>
                                    <TableCell>{r.account}</TableCell>
                                    <TableCell className="text-[hsl(var(--muted-foreground))]">{r.domain}</TableCell>
                                    <TableCell className="text-right font-mono">{fmt(r.spend)}</TableCell>
                                    <TableCell className="text-right font-mono text-[hsl(var(--muted-foreground))]">{fmt(r.vat)}</TableCell>
                                    <TableCell className="text-right font-mono text-[hsl(var(--muted-foreground))]">{fmt(r.lcFee)}</TableCell>
                                    <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">{fmt(r.revenue)}</TableCell>
                                    <TableCell className={`text-right font-mono font-semibold ${pl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {pl >= 0 ? '+' : ''}{fmt(pl)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
