import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function MonthlyPnLTab({ pnlData }) {
    const d = pnlData || {
        grossRevenue: 26800, googleSpend: 16300, vatAmount: 1141, lendingcardFees: 609.93,
        totalCostOfRevenue: 18050.93, grossProfit: 8749.07, totalOpex: 384,
        netProfit: 8365.07, netMargin: 31.2, leadsSubmitted: 435, leadsSold: 382,
        leadsRejected: 53, activeAccounts: 10, activeDomains: 8,
    };

    const grossMargin = d.grossRevenue > 0 ? (d.grossProfit / d.grossRevenue * 100) : 0;

    const Section = ({ title, children }) => (
        <div className="mb-4">
            <div className="text-[11px] font-bold text-[hsl(var(--primary))] uppercase tracking-widest mb-2 border-b border-[hsl(var(--primary))]/30 pb-1">{title}</div>
            {children}
        </div>
    );

    const Row = ({ label, value, indent, bold, color }) => (
        <div className={`flex justify-between items-center py-1 ${indent ? 'pl-6' : ''}`}>
            <span className={`text-xs ${bold ? 'font-bold' : ''} ${indent ? 'text-[hsl(var(--muted-foreground))]' : ''}`}>{label}</span>
            <span className={`text-xs font-mono ${bold ? 'font-bold text-base' : ''} ${color || ''}`}>{fmt(value)}</span>
        </div>
    );

    return (
        <div className="animate-[fadeIn_.3s_ease]">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-semibold">📊 Monthly P&L — February 2026</CardTitle>
                        <div className="flex gap-2">
                            <button className="text-[11px] px-3 py-1 rounded-md bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-white transition">Export PDF</button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="max-w-2xl">
                    <Section title="Revenue">
                        <Row label="Gross Lead Revenue (Voluum)" value={d.grossRevenue} bold />
                    </Section>

                    <Section title="Cost of Revenue">
                        <Row label="Google Ads Spend" value={d.googleSpend} />
                        <Row label="VAT 7%" value={d.vatAmount} indent />
                        <Row label="LendingCard Fees 3.5%" value={d.lendingcardFees} indent />
                        <div className="border-t border-[hsl(var(--border))] mt-1 pt-1">
                            <Row label="Total Cost of Revenue" value={d.totalCostOfRevenue} bold />
                        </div>
                    </Section>

                    <Section title="Gross Profit">
                        <Row label="Gross Profit" value={d.grossProfit} bold color="text-green-400" />
                        <Row label={`Gross Margin: ${grossMargin.toFixed(1)}%`} value={null} />
                    </Section>

                    <Section title="Operating Expenses">
                        <Row label="Total Opex (from Opex tab)" value={d.totalOpex} />
                    </Section>

                    <div className="border-t-2 border-[hsl(var(--primary))] mt-2 pt-3">
                        <Row label="NET PROFIT" value={d.netProfit} bold color="text-green-400" />
                        <div className="flex justify-between py-1">
                            <span className="text-xs font-bold">Net Margin</span>
                            <span className="text-xs font-mono font-bold">{d.netMargin.toFixed(1)}%</span>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-[hsl(var(--border))] pt-4">
                        <div className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-2">Key Metrics</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { l: "Leads Submitted", v: d.leadsSubmitted },
                                { l: "Leads Sold", v: `${d.leadsSold} (${(d.leadsSold / d.leadsSubmitted * 100).toFixed(1)}%)` },
                                { l: "Leads Rejected", v: `${d.leadsRejected} (${(d.leadsRejected / d.leadsSubmitted * 100).toFixed(1)}%)` },
                                { l: "Active Accounts", v: d.activeAccounts },
                            ].map(({ l, v }) => (
                                <div key={l} className="bg-[hsl(var(--muted))]/30 rounded-lg p-3">
                                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{l}</div>
                                    <div className="text-sm font-bold mt-0.5">{v}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
