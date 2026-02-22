import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MOCK = [
    { domain: "bearloannow.com", vertical: "Loan US", spend: 4200, trueCost: 4805, revenue: 7800, pl: 2995, roi: 62 },
    { domain: "loanbears.com", vertical: "Loan US", spend: 3800, trueCost: 4348, revenue: 6200, pl: 1852, roi: 43 },
    { domain: "petcarefin.com", vertical: "Pet Fin", spend: 1600, trueCost: 1830, revenue: 3400, pl: 1570, roi: 86 },
    { domain: "quickcash.com", vertical: "Loan US", spend: 2900, trueCost: 3318, revenue: 5100, pl: 1782, roi: 54 },
    { domain: "loanfast.com", vertical: "Loan US", spend: 1800, trueCost: 2060, revenue: 1500, pl: -560, roi: -27 },
];

export function PerDomainTab({ domainData }) {
    const rows = domainData?.length > 0 ? domainData : MOCK;
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Per Domain</CardTitle>
                    <button className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition">Export</button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Domain</TableHead>
                            <TableHead>Vertical</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                            <TableHead className="text-right">True Cost</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">P/L</TableHead>
                            <TableHead>ROI</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r, i) => (
                            <TableRow key={i} className="cursor-pointer">
                                <TableCell className="font-medium">{r.domain}</TableCell>
                                <TableCell className="text-[hsl(var(--muted-foreground))]">{r.vertical}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(r.spend)}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(r.trueCost)}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(r.revenue)}</TableCell>
                                <TableCell className={`text-right font-mono font-semibold ${r.pl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {r.pl >= 0 ? '+' : ''}{fmt(r.pl)}
                                </TableCell>
                                <TableCell>
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.roi >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                                            : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                                        }`}>{r.roi}%</span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
