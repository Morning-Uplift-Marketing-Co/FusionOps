import { useState, useEffect } from "react";
import { leadingCardsApi } from "../services/leadingCards";
import { loadSettings } from "../services/neon";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { fetchLendingCardTransactions, normalizeTransactions } from "../services/lendingcard";


export function AccountMap({ ops }) {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState("today"); // today, yesterday, 7days
    const [mappedAccounts, setMappedAccounts] = useState([]);

    useEffect(() => {
        loadMapData();
    }, [dateRange, ops]);

    const loadMapData = async () => {
        setLoading(true);
        try {
            const settings = await loadSettings() || {};
            const lcToken = settings.lcToken || localStorage.getItem("LC_API_TOKEN");
            const vKeyId = settings.voluumAccessKeyId || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY_ID;
            const vKey = settings.voluumAccessKey || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY;

            // 1. Fetch LC Cards
            let fetchedCards = [];
            try {
                const res = await leadingCardsApi.getCards();
                fetchedCards = res.results || [];
                fetchedCards = res.results || [];
            } catch (e) {
                console.error("Failed fetching LC cards", e);
            }

            // 2. Fetch LC Transactions (for 'spend')
            let fetchedTx = [];
            if (lcToken) {
                try {
                    // Quick way to get recent transactions based on dateRange
                    const txData = await fetchLendingCardTransactions(lcToken, getStartDate(dateRange));
                    fetchedTx = normalizeTransactions(txData);
                    fetchedTx = normalizeTransactions(txData);
                } catch (e) {
                    console.error("Failed fetching LC transactions", e);
                }
            }

            // 3. Fetch Voluum Metrics (for 'revenue', 'clicks', 'conversions')
            let fetchedVData = [];
            if (vKeyId && vKey) {
                try {
                    const { fetchVoluumSession, fetchVoluumReport } = await import("../services/voluum.js");
                    const token = await fetchVoluumSession(vKeyId, vKey);

                    const toDate = new Date();
                    const fromDate = new Date(getStartDate(dateRange));

                    // Group by campaign/account to get per-account metrics
                    const report = await fetchVoluumReport(token, fromDate, toDate, "UTC", "campaign");
                    if (report && report.rows) {
                        fetchedVData = report.rows;
                    }
                } catch (err) {
                    console.error("Failed fetching Voluum data", err);
                }
            }

            // 4. Map everything together
            // The anchor is ops.accounts (which links cardUuid <-> profileId <-> label/account name)
            // If an account doesn't exist in ops.accounts, maybe map from fetchedCards directly
            const mapped = fetchedCards.map(card => {
                // Find DB linkage
                const link = ops.accounts.find(a => a.cardUuid === card.uuid);
                const accountName = link?.label || card.comment || "Unknown Account";

                // Find MLX profile
                const profile = ops.profiles.find(p => p.id === link?.profileId);

                // Calculate Card Spend from Transactions
                const cardTx = fetchedTx.filter(tx => tx.cardLast4 === card.card_last_4 && tx.amount < 0 && tx.status === 'APPROVED');
                const cardSpend = cardTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
                const trueCost = cardSpend + (cardSpend * 0.07) + (cardSpend * 0.035);

                // Calculate Revenue/Clicks from Voluum (matching by account name in campaign name, basic heuristic)
                const vRow = fetchedVData.find(v => v.campaignName && v.campaignName.toLowerCase().includes(accountName.toLowerCase()));
                const revenue = vRow ? (vRow.revenue || 0) : 0;
                const clicks = vRow ? (vRow.visits || 0) : 0;
                const conversions = vRow ? (vRow.conversions || 0) : 0;

                const pl = revenue - trueCost;
                const roi = trueCost > 0 ? ((revenue - trueCost) / trueCost) * 100 : 0;

                return {
                    id: card.uuid,
                    accountName,
                    cardLast4: card.card_last_4,
                    cardStatus: card.status,
                    cardBalance: card.balance,
                    cardLimit: card.limit,
                    profileName: profile ? profile.name : "Not Linked",
                    profileStatus: profile ? profile.status : "Offline",
                    metrics: {
                        spend: cardSpend,
                        trueCost,
                        revenue,
                        clicks,
                        conversions,
                        pl,
                        roi
                    }
                };
            });

            // Sort by P&L descending
            mapped.sort((a, b) => b.metrics.pl - a.metrics.pl);
            setMappedAccounts(mapped);

        } catch (e) {
            console.error("Account Map error:", e);
        }
        setLoading(false);
    };

    const getStartDate = (range) => {
        const d = new Date();
        if (range === "yesterday") {
            d.setDate(d.getDate() - 1);
        } else if (range === "7days") {
            d.setDate(d.getDate() - 7);
        }
        return d.toISOString().slice(0, 10);
    };

    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Account Map & Tracking</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Real-time linkage between Profiles, Ads, Cards, and Profitability.</p>
                </div>

                <div className="flex bg-[hsl(var(--muted))] p-1 rounded-lg">
                    {["today", "yesterday", "7days"].map(range => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === range ? "bg-[hsl(var(--background))] shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}
                        >
                            {range === "today" ? "Today" : range === "yesterday" ? "Yesterday" : "Last 7 Days"}
                        </button>
                    ))}
                    <Button variant="outline" size="sm" onClick={loadMapData} disabled={loading} className="ml-2 h-7 text-xs">
                        {loading ? "syncing..." : "🔄 Refresh"}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <Card key={i} className="animate-pulse bg-[hsl(var(--muted))/20] h-[300px] border-dashed" />
                    ))}
                </div>
            ) : mappedAccounts.length === 0 ? (
                <div className="text-center py-20 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl">
                    <div className="text-4xl mb-4">🗺️</div>
                    <h3 className="text-lg font-bold mb-2">No Accounts Mapped</h3>
                    <p className="text-[hsl(var(--muted-foreground))] text-sm max-w-md mx-auto">
                        Link your LeadingCards to Multilogin Profiles in the Ops Center to see them tracked here.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {mappedAccounts.map(acc => {
                        const m = acc.metrics;
                        const isProfitable = m.pl >= 0;

                        return (
                            <Card key={acc.id} className="overflow-hidden hover:shadow-md transition-all border-[hsl(var(--border))]">
                                <CardHeader className="pb-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/20]">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                {acc.accountName}
                                            </CardTitle>
                                            <div className="text-xs mt-1 flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
                                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: acc.profileStatus === "ACTIVE" || acc.profileStatus.includes("Running") ? "#22c55e" : "#ef4444" }}></span>
                                                {acc.profileName}
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={`font-mono text-[10px] ${acc.cardStatus === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : ''}`}>
                                            💳 {acc.cardLast4}
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-0">
                                    <div className="grid grid-cols-2 divide-x divide-y divide-[hsl(var(--border))] text-sm">

                                        {/* P&L Main Stat */}
                                        <div className="col-span-2 p-4 flex justify-between items-center" style={{ background: isProfitable ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider mb-1">P&L ({dateRange})</p>
                                                <p className={`text-2xl font-black tracking-tight font-mono ${isProfitable ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {isProfitable ? '+' : ''}{formatCurrency(m.pl)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider mb-1">ROI</p>
                                                <Badge variant="outline" className={isProfitable ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}>
                                                    {m.roi.toFixed(1)}%
                                                </Badge>
                                            </div>
                                        </div>

                                        {/* Financials Split */}
                                        <div className="p-4 space-y-1">
                                            <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider">Revenue</p>
                                            <p className="text-base font-semibold font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(m.revenue)}</p>
                                        </div>
                                        <div className="p-4 space-y-1">
                                            <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider">True Cost</p>
                                            <p className="text-base font-semibold font-mono text-red-600 dark:text-red-400">{formatCurrency(m.trueCost)}</p>
                                        </div>

                                        {/* Traffic Split */}
                                        <div className="p-4 space-y-1">
                                            <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider">Clicks</p>
                                            <p className="text-base font-semibold">{m.clicks.toLocaleString()}</p>
                                        </div>
                                        <div className="p-4 space-y-1">
                                            <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider">Conversions</p>
                                            <p className="text-base font-semibold">{m.conversions.toLocaleString()}</p>
                                        </div>

                                        {/* Card Status Bottom */}
                                        <div className="col-span-2 p-3 text-xs flex justify-between items-center text-[hsl(var(--muted-foreground))] bg-[hsl(var(--card))]">
                                            <div>Limit: <span className="font-mono text-[hsl(var(--foreground))]">{formatCurrency(acc.cardLimit)}</span></div>
                                            <div>Avail: <span className="font-mono text-[hsl(var(--foreground))]">{formatCurrency(acc.cardBalance)}</span></div>
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
