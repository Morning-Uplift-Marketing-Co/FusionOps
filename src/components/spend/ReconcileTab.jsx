import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MOCK = [
    { date: "2/22", description: "GOOGLE*ADS $644.58", lcAmount: 644.58, ourAmount: 644.58, diff: 0, status: "matched" },
    { date: "2/22", description: "Intl Fee $12.89", lcAmount: 12.89, ourAmount: 12.89, diff: 0, status: "matched" },
    { date: "2/21", description: "GOOGLE*ADS $644.58", lcAmount: 644.58, ourAmount: 644.58, diff: 0, status: "matched" },
    { date: "2/20", description: "GOOGLE*ADS $580.00", lcAmount: 580.00, ourAmount: 577.32, diff: -2.68, status: "diff" },
    { date: "2/19", description: "Unknown $15.00", lcAmount: 15.00, ourAmount: 0, diff: 15.00, status: "missing" },
];

const statusBadge = (s) => {
    const map = { matched: { icon: "✅", label: "Match", cls: "bg-green-500/15 text-green-400" }, diff: { icon: "⚠️", label: "Diff", cls: "bg-yellow-500/15 text-yellow-400" }, missing: { icon: "❌", label: "Missing", cls: "bg-red-500/15 text-red-400" } };
    const m = map[s] || map.missing;
    return <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${m.cls}`}>{m.icon} {m.label}</span>;
};

export function ReconcileTab({ reconcileData }) {
    const rows = reconcileData?.length > 0 ? reconcileData : MOCK;
    const matched = rows.filter(r => r.status === "matched").length;
    const diffs = rows.filter(r => r.status === "diff").length;
    const missing = rows.filter(r => r.status === "missing").length;

    return (
        <div className="animate-[fadeIn_.3s_ease]">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-semibold">🔄 Reconcile LendingCard — Feb 2026</CardTitle>
                        <button className="text-[11px] px-3 py-1 rounded-md bg-[hsl(var(--primary))] text-white hover:opacity-90 transition">Upload Statement CSV</button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Summary */}
                    <div className="flex gap-4 mb-4 text-xs">
                        <span>{rows.length} transactions</span>
                        <span className="text-green-400">{matched} matched ✅</span>
                        <span className="text-yellow-400">{diffs} diff ⚠️</span>
                        <span className="text-red-400">{missing} missing ❌</span>
                    </div>

                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-[hsl(var(--border))]">
                                {["Date", "LC Statement", "Our Record", "Diff", "Status"].map(h => (
                                    <th key={h} className="text-left py-2 px-3 text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={i} className="border-b border-[hsl(var(--border))]/30 hover:bg-[hsl(var(--muted))]/30 transition">
                                    <td className="py-2.5 px-3 font-medium">{r.date}</td>
                                    <td className="py-2.5 px-3">{r.description} <span className="font-mono">{fmt(r.lcAmount)}</span></td>
                                    <td className="py-2.5 px-3 font-mono">{r.ourAmount ? fmt(r.ourAmount) : '—'}</td>
                                    <td className={`py-2.5 px-3 font-mono font-bold ${r.diff === 0 ? '' : r.diff > 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                                        {r.diff === 0 ? '$0.00' : (r.diff > 0 ? '+' : '') + fmt(r.diff)}
                                    </td>
                                    <td className="py-2.5 px-3">{statusBadge(r.status)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
