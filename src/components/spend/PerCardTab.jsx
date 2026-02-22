import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

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
        <div className="animate-[fadeIn_.3s_ease]">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-semibold">💳 Per Card</CardTitle>
                        <button className="text-[11px] px-3 py-1 rounded-md bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-white transition">Export</button>
                    </div>
                </CardHeader>
                <CardContent>
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-[hsl(var(--border))]">
                                {["Card", "Account", "Total Charged", "LC Fee", "Net Spend", "Status"].map(h => (
                                    <th key={h} className="text-left py-2 px-3 text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={i} className="border-b border-[hsl(var(--border))]/30 hover:bg-[hsl(var(--muted))]/30 transition cursor-pointer">
                                    <td className="py-2.5 px-3 font-mono font-bold">{r.card}</td>
                                    <td className="py-2.5 px-3">{r.account}</td>
                                    <td className="py-2.5 px-3 font-mono">{fmt(r.totalCharged)}</td>
                                    <td className="py-2.5 px-3 font-mono text-red-400">{fmt(r.lcFee)}</td>
                                    <td className="py-2.5 px-3 font-mono">{fmt(r.netSpend)}</td>
                                    <td className="py-2.5 px-3">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'Active' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
                                            {r.status === 'Active' ? '🟢' : '⚠️'} {r.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
