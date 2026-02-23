import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MOCK = [
    { date: "2/22", description: "GOOGLE*ADS $644.58", lcAmount: 644.58, ourAmount: 644.58, diff: 0, status: "matched" },
    { date: "2/22", description: "Intl Fee $12.89", lcAmount: 12.89, ourAmount: 12.89, diff: 0, status: "matched" },
    { date: "2/21", description: "GOOGLE*ADS $644.58", lcAmount: 644.58, ourAmount: 644.58, diff: 0, status: "matched" },
    { date: "2/20", description: "GOOGLE*ADS $580.00", lcAmount: 580.00, ourAmount: 577.32, diff: -2.68, status: "diff" },
    { date: "2/19", description: "Unknown $15.00", lcAmount: 15.00, ourAmount: 0, diff: 15.00, status: "missing" },
];

const statusMap = {
    matched: { label: "Match", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
    diff: { label: "Diff", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
    missing: { label: "Missing", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
};

export function ReconcileTab({ reconcileData }) {
    const rows = reconcileData?.length > 0 ? reconcileData : MOCK;
    const matched = rows.filter(r => r.status === "matched").length;
    const diffs = rows.filter(r => r.status === "diff").length;
    const missing = rows.filter(r => r.status === "missing").length;

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Reconcile LendingCard — Feb 2026</CardTitle>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{rows.length} transactions • {matched} matched • {diffs} diff • {missing} missing</p>
                    </div>
                    <button className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:opacity-90 transition">
                        Upload Statement CSV
                    </button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>LC Statement</TableHead>
                            <TableHead className="text-right">Our Record</TableHead>
                            <TableHead className="text-right">Diff</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r, i) => {
                            const s = statusMap[r.status] || statusMap.missing;
                            return (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{r.date}</TableCell>
                                    <TableCell>{r.description}</TableCell>
                                    <TableCell className="text-right font-mono">{r.ourAmount ? fmt(r.ourAmount) : '—'}</TableCell>
                                    <TableCell className={`text-right font-mono font-semibold ${r.diff === 0 ? '' : r.diff > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                        {fmt(r.diff)}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>
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
