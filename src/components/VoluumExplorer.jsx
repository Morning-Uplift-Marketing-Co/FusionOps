import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";

import { LS } from "../utils";

const fmt = (n) => `${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

const RANGE_PRESETS = [
    { id: "today", label: "Today", days: 1 },
    { id: "7d", label: "7 Days", days: 7 },
    { id: "14d", label: "14 Days", days: 14 },
    { id: "30d", label: "30 Days", days: 30 },
    { id: "mtd", label: "MTD", days: 0 },
];

function getDateRange(preset) {
    const to = new Date();
    const from = new Date();
    if (preset === "mtd") {
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
    } else if (preset === "today") {
        from.setHours(0, 0, 0, 0);
    } else {
        const days = RANGE_PRESETS.find(r => r.id === preset)?.days || 7;
        from.setDate(to.getDate() - days);
    }
    return { from, to };
}

// ═══════════════════════════════════════
// Sub-views
// ═══════════════════════════════════════

function CampaignsView({ campaigns, campaignReport }) {
    const rows = campaignReport?.rows || [];
    const campMap = new Map((campaigns || []).map(c => [c.id, c]));

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Campaign Performance</CardTitle>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            {rows.length} campaigns • grouped by Voluum campaign
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">No campaign data yet. Click "Fetch Data" above.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campaign</TableHead>
                                    <TableHead>Domain</TableHead>
                                    <TableHead className="text-right">Visits</TableHead>
                                    <TableHead className="text-right">Clicks</TableHead>
                                    <TableHead className="text-right">Conv</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                    <TableHead className="text-right">Profit</TableHead>
                                    <TableHead className="text-right">ROI</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((r, i) => {
                                    const camp = campMap.get(r.campaignId || r.id) || {};
                                    const profit = (r.revenue || 0) - (r.cost || 0);
                                    return (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium max-w-[200px] truncate" title={r.name || r.campaignName}>
                                                {r.name || r.campaignName || r.id?.slice(0, 12) || "—"}
                                            </TableCell>
                                            <TableCell className="text-[hsl(var(--muted-foreground))] text-xs font-mono">
                                                {camp.trackingDomain || "—"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{(r.visits || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-mono">{(r.clicks || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-mono font-semibold">{r.conversions || 0}</TableCell>
                                            <TableCell className="text-right font-mono">{fmt(r.cost)}</TableCell>
                                            <TableCell className="text-right font-mono">{fmt(r.revenue)}</TableCell>
                                            <TableCell className={`text-right font-mono font-semibold ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                                {profit >= 0 ? "+" : ""}{fmt(profit)}
                                            </TableCell>
                                            <TableCell className={`text-right font-mono ${(r.roi || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                                {pct(r.roi)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ConversionsView({ conversions }) {
    const rows = conversions?.rows || [];
    const total = conversions?.totalRows || rows.length;

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Conversion Log</CardTitle>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            {rows.length} shown of {total} total • click-level conversion data
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
                        No conversions loaded. Enable "Include Conversions" and fetch again.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Click ID</TableHead>
                                    <TableHead>Campaign</TableHead>
                                    <TableHead>Offer</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                    <TableHead>Country</TableHead>
                                    <TableHead>Conversion Time</TableHead>
                                    <TableHead>External ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((r, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-mono text-xs max-w-[120px] truncate" title={r.clickId}>
                                            {r.clickId?.slice(0, 16) || "—"}
                                        </TableCell>
                                        <TableCell className="max-w-[160px] truncate text-sm" title={r.campaignName}>
                                            {r.campaignName || r.campaignId?.slice(0, 12) || "—"}
                                        </TableCell>
                                        <TableCell className="text-sm">{r.offerName || "—"}</TableCell>
                                        <TableCell className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                            {fmt(r.revenue)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{fmt(r.cost)}</TableCell>
                                        <TableCell>{r.country || "—"}</TableCell>
                                        <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                                            {r.conversionTimestamp ? new Date(r.conversionTimestamp).toLocaleString() : "—"}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{r.externalId || "—"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function OffersView({ offers }) {
    const rows = offers || [];

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Offers</CardTitle>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            {rows.length} offers from Voluum
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">No offers loaded yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Offer</TableHead>
                                    <TableHead>URL</TableHead>
                                    <TableHead>Payout Mode</TableHead>
                                    <TableHead className="text-right">Payout</TableHead>
                                    <TableHead>Country</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((o, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium max-w-[200px] truncate">{o.name || "—"}</TableCell>
                                        <TableCell className="text-xs font-mono max-w-[200px] truncate text-[hsl(var(--muted-foreground))]" title={o.url}>{o.url || "—"}</TableCell>
                                        <TableCell className="text-sm">{o.payoutMode || "—"}</TableCell>
                                        <TableCell className="text-right font-mono font-semibold">{fmt(o.payout)}</TableCell>
                                        <TableCell>{o.country || "—"}</TableCell>
                                        <TableCell>
                                            <Badge variant={o.status === "ACTIVE" ? "success" : "secondary"}>
                                                {o.status || "—"}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function MatchingView({ conversions, matchResults }) {
    const rows = matchResults || [];
    const matched = rows.filter(r => r._matched).length;
    const unmatched = rows.length - matched;
    const totalRevVoluum = rows.reduce((s, r) => s + (r.revenue || 0), 0);
    const totalRevAffiliate = rows.filter(r => r._matched).reduce((s, r) => s + (r._affiliate?.payout || r._affiliate?.revenue || 0), 0);

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Conversion Matching</CardTitle>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Voluum ↔ Affiliate Network reconciliation
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Badge variant={matched > 0 ? "success" : "secondary"}>✅ {matched} matched</Badge>
                        <Badge variant={unmatched > 0 ? "destructive" : "secondary"}>❌ {unmatched} unmatched</Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <div className="text-center py-8 space-y-3">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            No match data yet. Fetch conversions first, then click "Match Affiliate Data" to paste your affiliate JSON.
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            Matching uses <code className="bg-[hsl(var(--muted))] px-1 py-0.5 rounded text-[10px]">clickId</code> to
                            join Voluum conversions with LeadsGate / ZeroParallel lead records.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div className="rounded-lg border border-[hsl(var(--border))] p-3 text-center">
                                <div className="text-lg font-bold">{rows.length}</div>
                                <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Total</div>
                            </div>
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{matched}</div>
                                <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Matched</div>
                            </div>
                            <div className="rounded-lg border border-[hsl(var(--border))] p-3 text-center">
                                <div className="text-lg font-bold">{fmt(totalRevVoluum)}</div>
                                <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Voluum Rev</div>
                            </div>
                            <div className="rounded-lg border border-[hsl(var(--border))] p-3 text-center">
                                <div className="text-lg font-bold">{fmt(totalRevAffiliate)}</div>
                                <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Affiliate Rev</div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Click ID</TableHead>
                                        <TableHead>Campaign</TableHead>
                                        <TableHead className="text-right">V.Revenue</TableHead>
                                        <TableHead className="text-right">A.Payout</TableHead>
                                        <TableHead className="text-right">Diff</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.slice(0, 200).map((r, i) => {
                                        const affPay = r._affiliate?.payout || r._affiliate?.revenue || 0;
                                        const diff = (r.revenue || 0) - affPay;
                                        return (
                                            <TableRow key={i}>
                                                <TableCell>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r._matched
                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                                                        : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                                                        }`}>
                                                        {r._matched ? "Match" : "Missing"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{r.clickId?.slice(0, 16) || "—"}</TableCell>
                                                <TableCell className="text-sm truncate max-w-[140px]">{r.campaignName || "—"}</TableCell>
                                                <TableCell className="text-right font-mono">{fmt(r.revenue)}</TableCell>
                                                <TableCell className="text-right font-mono">{r._matched ? fmt(affPay) : "—"}</TableCell>
                                                <TableCell className={`text-right font-mono font-semibold ${r._matched ? (Math.abs(diff) < 0.01 ? "" : diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : "text-[hsl(var(--muted-foreground))]"}`}>
                                                    {r._matched ? fmt(diff) : "—"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════

export function VoluumExplorer() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [data, setData] = useState(null);
    const [offers, setOffers] = useState([]);
    const [includeConversions, setIncludeConversions] = useState(true);
    const [matchResults, setMatchResults] = useState([]);
    const [range, setRange] = useState("7d");
    const [lastSync, setLastSync] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            let accessId = "", accessKey = "";

            // 1) LS utility (same key as App.jsx)
            try {
                const s = LS.get("settings") || {};
                accessId = s.voluumAccessKeyId || "";
                accessKey = s.voluumAccessKey || "";
            } catch { /* noop */ }

            // 2) Neon fallback
            if (!accessId || !accessKey) {
                try {
                    const { loadSettings } = await import("../services/neon");
                    const settings = await loadSettings();
                    accessId = settings?.voluumAccessKeyId || "";
                    accessKey = settings?.voluumAccessKey || "";
                } catch { /* noop */ }
            }

            // 3) Env fallback
            if (!accessId || !accessKey) {
                accessId = import.meta.env?.VITE_VOLUUM_ACCESS_KEY_ID || "";
                accessKey = import.meta.env?.VITE_VOLUUM_ACCESS_KEY || "";
            }

            if (!accessId || !accessKey) {
                setError("Voluum credentials not found. Configure in Settings → Voluum.");
                return;
            }

            const { fetchAllVoluumData, fetchOffers: fetchOffersApi } = await import("../services/voluum");
            const { from, to } = getDateRange(range);

            const result = await fetchAllVoluumData(accessId, accessKey, from, to, {
                includeConversions,
                conversionLimit: 5000,
            });

            // Fetch offers separately
            try {
                const offersData = await fetchOffersApi(result.token);
                setOffers(offersData);
            } catch { /* noop */ }

            setData(result);
            setLastSync(new Date().toLocaleTimeString());
        } catch (e) {
            console.error("[VoluumExplorer] fetch error:", e);
            setError(e.message || "Failed to fetch Voluum data");
        } finally {
            setLoading(false);
        }
    }, [range, includeConversions]);

    const handleMatchPaste = useCallback(() => {
        if (!data?.conversions?.rows?.length) {
            setError("Fetch Voluum conversions first before matching.");
            return;
        }
        const input = prompt(
            "Paste affiliate data as JSON array:\n" +
            '[{"clickId":"abc","payout":25.00,"status":"sold"}, ...]'
        );
        if (!input) return;
        try {
            const affiliateData = JSON.parse(input);
            if (!Array.isArray(affiliateData)) throw new Error("Expected JSON array");
            import("../services/voluum").then(({ matchConversions }) => {
                const results = matchConversions(data.conversions.rows, affiliateData);
                setMatchResults(results);
            });
        } catch (e) {
            setError(`Invalid JSON: ${e.message}`);
        }
    }, [data]);

    const metrics = data?.campaignReport || {};

    return (
        <div className="space-y-6">
            {/* ═══ Header ═══ */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Voluum Explorer</h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        Campaigns, conversions & affiliate matching
                        {lastSync && <span className="ml-2 text-xs opacity-60">Last sync: {lastSync}</span>}
                    </p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    {/* Range selector */}
                    <div className="flex rounded-md border border-[hsl(var(--border))] overflow-hidden">
                        {RANGE_PRESETS.map(r => (
                            <button
                                key={r.id}
                                onClick={() => setRange(r.id)}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                    range === r.id
                                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                                        : "hover:bg-[hsl(var(--muted))]"
                                }`}
                            >{r.label}</button>
                        ))}
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeConversions}
                            onChange={e => setIncludeConversions(e.target.checked)}
                            className="rounded border-[hsl(var(--border))]"
                        />
                        <span className="text-xs">Conversions</span>
                    </label>

                    {data?.conversions?.rows?.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handleMatchPaste} className="text-xs h-9">
                            🔗 Match Affiliate
                        </Button>
                    )}

                    <Button onClick={fetchData} disabled={loading} className="text-xs h-9">
                        {loading ? "⏳ Fetching..." : "🎯 Fetch Data"}
                    </Button>
                </div>
            </div>

            {/* ═══ Error ═══ */}
            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                    <span>⚠️</span><span>{error}</span>
                    <button onClick={() => setError("")} className="ml-auto text-red-400/60 hover:text-red-400 text-lg leading-none">×</button>
                </div>
            )}

            {/* ═══ KPI Strip ═══ */}
            {data && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {[
                        { label: "Visits", value: (metrics.visits || 0).toLocaleString() },
                        { label: "Clicks", value: (metrics.clicks || 0).toLocaleString() },
                        { label: "Conversions", value: (metrics.conversions || 0).toLocaleString() },
                        { label: "Cost", value: fmt(metrics.cost) },
                        { label: "Revenue", value: fmt(metrics.revenue), color: "emerald" },
                        { label: "ROI", value: pct(metrics.roi), color: (metrics.roi || 0) >= 0 ? "emerald" : "red" },
                    ].map((k, i) => (
                        <div key={i} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                            <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">{k.label}</div>
                            <div className={`text-lg font-bold ${k.color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : k.color === "red" ? "text-red-600 dark:text-red-400" : ""}`}>
                                {k.value}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ═══ Tabs ═══ */}
            {data && (
                <Tabs defaultValue="campaigns" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="campaigns" className="text-xs gap-1">
                            <span>📊</span> Campaigns
                        </TabsTrigger>
                        <TabsTrigger value="conversions" className="text-xs gap-1">
                            <span>🔄</span> Conversions {data?.conversions?.rows?.length > 0 && `(${data.conversions.rows.length})`}
                        </TabsTrigger>
                        <TabsTrigger value="offers" className="text-xs gap-1">
                            <span>💰</span> Offers {offers.length > 0 && `(${offers.length})`}
                        </TabsTrigger>
                        <TabsTrigger value="matching" className="text-xs gap-1">
                            <span>🔗</span> Matching {matchResults.length > 0 && `(${matchResults.length})`}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="campaigns">
                        <CampaignsView campaigns={data.campaigns} campaignReport={data.campaignReport} />
                    </TabsContent>
                    <TabsContent value="conversions">
                        <ConversionsView conversions={data.conversions} />
                    </TabsContent>
                    <TabsContent value="offers">
                        <OffersView offers={offers} />
                    </TabsContent>
                    <TabsContent value="matching">
                        <MatchingView conversions={data.conversions} matchResults={matchResults} />
                    </TabsContent>
                </Tabs>
            )}

            {/* ═══ Empty state ═══ */}
            {!data && !loading && !error && (
                <Card>
                    <CardContent className="py-16 text-center space-y-4">
                        <div className="text-5xl">🎯</div>
                        <h3 className="text-lg font-semibold">Voluum Explorer</h3>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md mx-auto">
                            View campaign performance, conversion logs, offers, and match Voluum data
                            with LeadsGate / ZeroParallel affiliate records.
                        </p>
                        <Button onClick={fetchData} className="text-sm">
                            🎯 Fetch Voluum Data
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
