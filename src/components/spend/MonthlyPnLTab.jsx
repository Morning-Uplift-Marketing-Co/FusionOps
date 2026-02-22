import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const fmt = (n) => n == null ? '' : `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function MonthlyPnLTab({ pnlData }) {
    const d = pnlData || {
        grossRevenue: 26800, googleSpend: 16300, vatAmount: 1141, lendingcardFees: 609.93,
        totalCostOfRevenue: 18050.93, grossProfit: 8749.07, totalOpex: 384,
        netProfit: 8365.07, netMargin: 31.2, leadsSubmitted: 435, leadsSold: 382,
        leadsRejected: 53, activeAccounts: 10, activeDomains: 8,
    };
    const grossMargin = d.grossRevenue > 0 ? (d.grossProfit / d.grossRevenue * 100) : 0;

    const Section = ({ title, children }) => (
        <div className="mb-5">
            <div className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3 pb-2 border-b border-[hsl(var(--border))]">{title}</div>
            {children}
        </div>
    );
    const Row = ({ label, value, indent, bold }) => (
        <div className={`flex justify-between items-center py-1.5 ${indent ? 'pl-6' : ''}`}>
            <span className={`text-sm ${bold ? 'font-semibold' : ''} ${indent ? 'text-[hsl(var(--muted-foreground))]' : ''}`}>{label}</span>
            <span className={`text-sm font-mono ${bold ? 'font-bold' : ''}`}>{fmt(value)}</span>
        </div>
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Monthly P&L — February 2026</CardTitle>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Profit & Loss Statement</p>
                    </div>
                    <button className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition">Export PDF</button>
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
                    <div className="border-t border-[hsl(var(--border))] mt-2 pt-2">
                        <Row label="Total Cost of Revenue" value={d.totalCostOfRevenue} bold />
                    </div>
                </Section>
                <Section title="Gross Profit">
                    <Row label="Gross Profit" value={d.grossProfit} bold />
                    <div className="flex justify-between py-1.5">
                        <span className="text-sm">Gross Margin</span>
                        <span className="text-sm font-mono font-semibold">{grossMargin.toFixed(1)}%</span>
                    </div>
                </Section>
                <Section title="Operating Expenses">
                    <Row label="Total Opex (from Opex tab)" value={d.totalOpex} />
                </Section>

                <div className="border-t-2 border-[hsl(var(--foreground))] mt-3 pt-4">
                    <div className="flex justify-between items-center">
                        <span className="text-base font-bold">NET PROFIT</span>
                        <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{fmt(d.netProfit)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                        <span className="text-sm font-semibold">Net Margin</span>
                        <span className="text-sm font-mono font-bold">{d.netMargin.toFixed(1)}%</span>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[hsl(var(--border))]">
                    <div className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">Key Metrics</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { l: "Leads Submitted", v: d.leadsSubmitted },
                            { l: "Leads Sold", v: `${d.leadsSold} (${(d.leadsSold / d.leadsSubmitted * 100).toFixed(1)}%)` },
                            { l: "Leads Rejected", v: d.leadsRejected },
                            { l: "Active Accounts", v: d.activeAccounts },
                        ].map(({ l, v }) => (
                            <div key={l} className="rounded-lg border border-[hsl(var(--border))] p-3">
                                <div className="text-xs text-[hsl(var(--muted-foreground))]">{l}</div>
                                <div className="text-lg font-bold mt-0.5">{v}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
