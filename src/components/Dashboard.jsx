import React, { useMemo } from "react";
import { THEME as T, COLORS, APP_VERSION } from "../constants";
import { hsl } from "../utils";
import { detectRisks } from "../utils/risk-engine";
import { Dot } from "./ui/dot";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function Dashboard({ sites, stats, ops, setPage, startCreate, settings = {}, apiOk, neonOk }) {
    const recent = sites.slice(0, 5);
    const risks = useMemo(() => detectRisks(ops), [ops]);
    const buildMode = String(import.meta.env?.MODE || "unknown");
    const codeMarker = String(
        import.meta.env?.VITE_GIT_SHA
        || import.meta.env?.VITE_COMMIT_SHA
        || import.meta.env?.VITE_BUILD_TIME
        || "local-dev"
    );

    return (
        <div className="animate-[fadeIn_.3s_ease]">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold m-0 flex items-center gap-2">
                        Dashboard
                        <span className="text-[10px] font-bold tracking-wide uppercase text-[hsl(var(--primary))] bg-[hsl(var(--primary))/12] border border-[hsl(var(--primary))/40] rounded-full px-2 py-0.5">
                            v{APP_VERSION}
                        </span>
                    </h1>
                    <p className="text-[hsl(var(--muted-foreground))] text-sm mt-0.5">LP portfolio overview — Elastic Credits Engine</p>
                    <div className="mt-2 flex gap-2 items-center flex-wrap">
                        <Badge variant="success">Current Code</Badge>
                        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                            mode: <strong className="text-[hsl(var(--foreground))]">{buildMode}</strong>
                        </span>
                        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                            marker: <strong className="text-[hsl(var(--foreground))]">{codeMarker}</strong>
                        </span>
                    </div>
                </div>
                <Button onClick={startCreate}>➕ Create New LP</Button>
            </div>

            {/* Code Signature */}
            <Card className="mb-4 border-[hsl(var(--success))/40] bg-[hsl(var(--success))/8] p-3">
                <div className="text-[11px] font-extrabold text-[hsl(var(--success))] tracking-wide uppercase mb-1.5">
                    Current Code Signature
                </div>
                <div className="flex gap-4 flex-wrap text-xs">
                    <span><strong>version:</strong> {APP_VERSION}</span>
                    <span><strong>mode:</strong> {buildMode}</span>
                    <span className="font-mono"><strong>marker:</strong> {codeMarker}</span>
                </div>
            </Card>

            {/* Metrics */}
            <div className="grid grid-cols-6 gap-3 mb-6">
                {[
                    { l: "Total Sites", v: sites.length, c: T.primary, icon: "🌐" },
                    { l: "Active", v: sites.filter(s => s.status === "completed").length, c: T.success, icon: "✅" },
                    { l: "Builds", v: stats.builds, c: T.accent, icon: "🔨" },
                    { l: "API Spend", v: `$${stats.spend.toFixed(2)}`, c: T.warning, icon: "💰" },
                    { l: "Ops Domains", v: ops.domains.length, c: "#a78bfa", icon: "🏢" },
                    { l: "Active Cards", v: ops.payments?.filter(p => p.status === "active" || p.cardStatus === "active").length || 0, c: T.success, icon: "💳" },
                ].map((m, i) => (
                    <Card key={i} className="relative p-4">
                        <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{m.l}</div>
                        <div className="text-[26px] font-bold mt-0.5" style={{ color: m.c }}>{m.v}</div>
                        <div className="absolute right-3.5 top-3.5 text-lg opacity-50">{m.icon}</div>
                    </Card>
                ))}
            </div>

            {/* Risk Alert */}
            {risks.length > 0 && (
                <Card className="mb-4 border-[hsl(var(--destructive))/27] p-4">
                    <div className="text-xs font-bold text-[hsl(var(--destructive))] mb-1.5">⚠ Correlation Risks Detected</div>
                    {risks.slice(0, 3).map((r, i) => (
                        <div key={i} className="text-xs text-[hsl(var(--muted-foreground))] py-0.5 flex items-center gap-2">
                            <Badge variant="danger">{r.level}</Badge>
                            <span>{r.msg}</span>
                        </div>
                    ))}
                    <button onClick={() => setPage("ops")} className="text-[11px] text-[hsl(var(--primary))] bg-transparent border-none cursor-pointer mt-1.5 p-0 hover:underline">
                        View Ops Center →
                    </button>
                </Card>
            )}

            <div className="grid gap-4" style={{ gridTemplateColumns: "2fr 1.2fr" }}>
                <div className="flex flex-col gap-4">
                    {/* Recent Sites */}
                    <Card className="flex-1">
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">🕐 Recent Sites</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {recent.length === 0 ? (
                                <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                                    <div className="text-3xl mb-1.5">🚀</div>
                                    <div className="text-sm">No sites yet</div>
                                </div>
                            ) : recent.map(s => {
                                const c = COLORS.find(x => x.id === s.colorId);
                                return (
                                    <div key={s.id} className="flex items-center gap-2.5 py-2.5 border-b border-[hsl(var(--border))]">
                                        <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-sm text-white font-bold shrink-0"
                                            style={{ background: c ? hsl(...c.p) : T.primary }}>
                                            {s.brand?.[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold">{s.brand}</div>
                                            <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{s.domain || "no domain"}</div>
                                        </div>
                                        <Badge variant="success">Active</Badge>
                                    </div>
                                );
                            })}
                            <Button variant="ghost" onClick={() => setPage("sites")} className="w-full mt-3 text-[11px]">
                                View All Sites →
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold">⚡ Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { l: "Build New", icon: "➕", fn: startCreate },
                                    { l: "AI Assets", icon: "✨", fn: () => setPage("variant") },
                                    { l: "Ops Center", icon: "🏢", fn: () => setPage("ops") },
                                    { l: "Settings", icon: "⚙", fn: () => setPage("settings") },
                                ].map((a, i) => (
                                    <Button key={i} variant="ghost" onClick={a.fn} className="flex items-center justify-start gap-2.5 p-3 h-auto">
                                        <span className="text-base">{a.icon}</span>
                                        <span className="text-xs font-semibold">{a.l}</span>
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col gap-4">
                    {/* AI Insight Card */}
                    <Card className="border-none text-white" style={{ background: T.grad }}>
                        <CardHeader>
                            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">✨ AI Performance Hack</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs leading-relaxed opacity-90">
                                {sites.length > 0 ?
                                    `Your brand "${recent[0]?.brand}" can improve CTR by 15% by using a "Limited Time" badge in the copy step.` :
                                    "Ready to scale? Gemini AI can generate high-converting copy in 5+ languages automatically."
                                }
                            </p>
                            <div className="mt-4 pt-3 border-t border-white/20 text-[10px] font-semibold uppercase tracking-wide">
                                Action: Enable Micro-Conversions
                            </div>
                        </CardContent>
                    </Card>

                    {/* System Health */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">System Health</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-2.5">
                                {[
                                    { label: "Data Store", dot: neonOk ? T.success : apiOk ? T.success : T.warning, text: neonOk ? "Neon DB" : apiOk ? "API / D1" : "Local Only" },
                                    { label: "CF Pages Deploy", dot: settings.cfApiToken ? T.success : T.dim, text: settings.cfApiToken ? "Ready" : "Not Set" },
                                    { label: "Netlify Deploy", dot: settings.netlifyToken ? T.success : T.dim, text: settings.netlifyToken ? "Ready" : "Not Set" },
                                    { label: "LeadingCards API", dot: settings.lcToken ? T.success : T.dim, text: settings.lcToken ? "Connected" : "Not Set" },
                                    { label: "Multilogin X", dot: settings.mlToken ? T.success : T.dim, text: settings.mlToken ? "Connected" : "Not Set" },
                                ].map((row, i) => (
                                    <div key={i} className="flex justify-between items-center">
                                        <span className="text-xs">{row.label}</span>
                                        <Dot c={row.dot} label={row.text} />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
