import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

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
        <div className="animate-[fadeIn_.3s_ease]">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-semibold">🌐 Per Domain</CardTitle>
                        <button className="text-[11px] px-3 py-1 rounded-md bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-white transition">Export</button>
                    </div>
                </CardHeader>
                <CardContent>
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-[hsl(var(--border))]">
                                {["Domain", "Vertical", "Spend", "True Cost", "Revenue", "P/L", "ROI"].map(h => (
                                    <th key={h} className="text-left py-2 px-3 text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={i} className="border-b border-[hsl(var(--border))]/30 hover:bg-[hsl(var(--muted))]/30 transition cursor-pointer">
                                    <td className="py-2.5 px-3 font-semibold text-[hsl(var(--primary))]">{r.domain}</td>
                                    <td className="py-2.5 px-3">{r.vertical}</td>
                                    <td className="py-2.5 px-3 font-mono">{fmt(r.spend)}</td>
                                    <td className="py-2.5 px-3 font-mono">{fmt(r.trueCost)}</td>
                                    <td className="py-2.5 px-3 font-mono text-green-400">{fmt(r.revenue)}</td>
                                    <td className={`py-2.5 px-3 font-mono font-bold ${r.pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{r.pl >= 0 ? '+' : ''}{fmt(r.pl)}</td>
                                    <td className="py-2.5 px-3">
                                        <span className={`font-bold ${r.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{r.roi}% {r.roi >= 0 ? '🟢' : '🔴'}</span>
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
