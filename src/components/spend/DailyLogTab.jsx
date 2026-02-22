import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MOCK = [
    { date: "2/22", account: "Acc-01", domain: "bearloannow", spend: 320, vat: 22.40, lcFee: 11.98, revenue: 520, pl: 165.62, card: "*6977" },
    { date: "2/22", account: "Acc-03", domain: "loanbears", spend: 280, vat: 19.60, lcFee: 10.49, revenue: 460, pl: 149.91, card: "*4568" },
    { date: "2/21", account: "Acc-01", domain: "bearloannow", spend: 340, vat: 23.80, lcFee: 12.73, revenue: 580, pl: 203.47, card: "*6977" },
    { date: "2/21", account: "Acc-07", domain: "petcarefin", spend: 190, vat: 13.30, lcFee: 7.11, revenue: 380, pl: 169.59, card: "*2341" },
    { date: "2/20", account: "Acc-05", domain: "vetpay", spend: 220, vat: 15.40, lcFee: 8.23, revenue: 310, pl: 66.37, card: "*8890" },
];

export function DailyLogTab({ dailyData }) {
    const rows = dailyData?.length > 0 ? dailyData : MOCK;

    return (
        <div className="animate-[fadeIn_.3s_ease]">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-semibold">📋 Daily Log</CardTitle>
                        <div className="flex gap-2">
                            <button className="text-[11px] px-3 py-1 rounded-md bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-white transition">Export CSV</button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[hsl(var(--border))]">
                                    {["Date", "Account", "Domain", "Spend", "VAT 7%", "LC Fee", "Revenue", "P/L"].map(h => (
                                        <th key={h} className="text-left py-2 px-3 text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => {
                                    const pl = r.pl ?? (r.revenue - r.spend - r.vat - r.lcFee);
                                    return (
                                        <tr key={i} className="border-b border-[hsl(var(--border))]/30 hover:bg-[hsl(var(--muted))]/30 transition">
                                            <td className="py-2.5 px-3 font-medium">{r.date}</td>
                                            <td className="py-2.5 px-3">{r.account}</td>
                                            <td className="py-2.5 px-3 text-[hsl(var(--primary))]">{r.domain}</td>
                                            <td className="py-2.5 px-3 font-mono">{fmt(r.spend)}</td>
                                            <td className="py-2.5 px-3 font-mono text-[hsl(var(--muted-foreground))]">{fmt(r.vat)}</td>
                                            <td className="py-2.5 px-3 font-mono text-[hsl(var(--muted-foreground))]">{fmt(r.lcFee)}</td>
                                            <td className="py-2.5 px-3 font-mono text-green-400">{fmt(r.revenue)}</td>
                                            <td className={`py-2.5 px-3 font-mono font-bold ${pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {pl >= 0 ? '+' : ''}{fmt(pl)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
