import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MOCK = [
    { card: "*6977", account: "Acc-01", totalCharged: 4965.30, lcFee: 173.79, netSpend: 4791.51, status: "Active" },
    { card: "*4568", account: "Acc-03", totalCharged: 4491.96, lcFee: 157.22, netSpend: 4334.74, status: "Active" },
    { card: "*2341", account: "Acc-07", totalCharged: 3425.82, lcFee: 119.90, netSpend: 3305.92, status: "Active" },
    { card: "*8890", account: "Acc-12", totalCharged: 1890.30, lcFee: 66.16, netSpend: 1824.14, status: "Active" },
    { card: "*5512", account: "Acc-09", totalCharged: 2127.60, lcFee: 74.47, netSpend: 2053.13, status: "Paused" },
];

export function PerCardTab({ cardData }) {
    const rows = cardData?.length > 0 ? cardData : MOCK;
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Per Card</CardTitle>
                    <button className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition">Export</button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Card</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Total Charged</TableHead>
                            <TableHead className="text-right">LC Fee</TableHead>
                            <TableHead className="text-right">Net Spend</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r, i) => (
                            <TableRow key={i} className="cursor-pointer">
                                <TableCell className="font-mono font-bold">{r.card}</TableCell>
                                <TableCell>{r.account}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(r.totalCharged)}</TableCell>
                                <TableCell className="text-right font-mono text-red-600 dark:text-red-400">{fmt(r.lcFee)}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(r.netSpend)}</TableCell>
                                <TableCell>
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.status === 'Active'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                        }`}>{r.status}</span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
