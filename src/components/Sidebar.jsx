import React, { useState } from "react";
import { THEME as T } from "../constants";
import { APP_VERSION } from "../constants";
import { cn } from "../lib/utils";

const CHANGELOG = [
    {
        version: "2.1.1",
        date: "2026-02-20",
        changes: [
            "🏷️ Policy Status Selector: Edit site policy status (Warming/Limited/Banned/Unknown) directly from cards",
            "🗑️ Bulk Delete All: Delete all projects + deployed sites with 2-step safety confirmation",
            "🐛 Error Log Tab: System-wide error tracking with filtering, export, and stack traces",
            "📊 Enhanced Grouping: Better site organization by Google Ads, Cloudflare, policy status, template",
            "🔍 Quick Filters: Deployed, Banned, Warming, No Domain, Not Deployed with persistent state",
            "⚡ Performance: Optimized badge rendering and dropdown interactions",
        ],
    },
    {
        version: "2.1.0",
        date: "2026-02-16",
        changes: [
            "🔧 Fix read-only DNS deletion — auto-removes domain from CF Workers / Vercel before retrying",
            "🌐 Update Vercel IP from 76.76.21.21 → 216.198.79.1 (new recommended)",
            "🔗 Netlify link now adds both @ and www CNAME records for DNS verification",
            "⚡ PageSpeed: rAF slider, deferred modals, CSS containment, content-visibility",
            "🏷️ Added OG, canonical, robots, referrer, format-detection meta tags to LP template",
            "📋 Added changelog version display",
        ],
    },
    {
        version: "2.0.0",
        date: "2026-02-15",
        changes: [
            "🚀 Launched LP Factory V2 — all-in-one PPC landing page platform",
            "🏢 Ops Center: manage domains, DNS, registrars, deployers",
            "🎨 Variant Studio: A/B test color, font, layout combos",
            "☁️ Multi-deployer: CF Workers, CF Pages, Vercel, Netlify",
            "💾 Neon DB: cloud persistence for settings, sites, deploys",
            "📡 API Worker proxy for CORS-free Vercel / Cloudflare API calls",
            "🔐 Internet.bs registrar integration + NS sync",
        ],
    },
    {
        version: "1.0.0",
        date: "2026-01-18",
        changes: [
            "🎉 Initial release — single-page LP generator",
            "📝 Wizard: brand, colors, fonts, loan config",
            "📦 ZIP download + deploy to Cloudflare Workers",
        ],
    },
];

export function Sidebar({ page, setPage, siteCount, startCreate, startTemplateGen, collapsed, toggle }) {
    const [showLog, setShowLog] = useState(false);

    const items = [
        { id: "dashboard", icon: "📊", label: "Dashboard" },
        { id: "sites", icon: "🌐", label: "My Sites", badge: siteCount },
        { id: "template-editor", icon: "🎨", label: "Template Editor" },
        { id: "template-gen", icon: "🧙", label: "Template Wizard", action: startTemplateGen },
        { id: "create", icon: "⚡", label: "LP Wizard", action: startCreate },
        { id: "variant", icon: "🧪", label: "Variant Studio" },
        { id: "ops", icon: "🏢", label: "Ops Center" },
        { id: "deploys", icon: "🚀", label: "Deploys" },
        { id: "error-log", icon: "🐛", label: "Error Log" },
        { id: "docs", icon: "📚", label: "API Docs", external: true, href: "/docs" },
        { id: "settings", icon: "⚙️", label: "Settings" },
    ];

    return (
        <>
            <div
                className="fixed top-0 left-0 bottom-0 flex flex-col z-[100] overflow-hidden transition-[width] duration-200 bg-[hsl(var(--card))] border-r border-[hsl(var(--border))]"
                style={{ width: collapsed ? 64 : 220 }}
            >
                {/* Logo */}
                <div className={cn("flex items-center gap-2.5 border-b border-[hsl(var(--border))]", collapsed ? "px-3 py-4" : "px-4 py-4")}>
                    <div
                        onClick={toggle}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm cursor-pointer shrink-0"
                        style={{ background: T.grad }}
                    >⚡</div>
                    {!collapsed && (
                        <div>
                            <div className="text-[15px] font-bold whitespace-nowrap">LP Factory</div>
                            <div
                                className="text-[10px] text-[hsl(var(--muted-foreground))] cursor-pointer"
                                onClick={() => setShowLog(true)}
                                title="View Changelog"
                            >
                                v{APP_VERSION} — All-in-One
                            </div>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav className="p-1.5 flex-1">
                    {items.map(it => {
                        const active = page === it.id;
                        const ButtonWrapper = it.external ? 'a' : 'button';
                        const buttonProps = it.external ? { href: it.href, target: "_blank", rel: "noopener noreferrer" } : {};
                        return (
                            <ButtonWrapper
                                key={it.id}
                                onClick={() => {
                                    if (it.external) return;
                                    console.log("Sidebar click:", it.id);
                                    if (it.action) { it.action(); } else { setPage(it.id); }
                                }}
                                {...buttonProps}
                                className={cn(
                                    "w-full flex items-center gap-2.5 mb-0.5 rounded-lg border-none cursor-pointer text-[13px] transition-all duration-150 no-underline",
                                    collapsed ? "justify-center px-0 py-2.5" : "justify-start px-3 py-[9px]",
                                    active
                                        ? "bg-[hsl(var(--primary))/12] text-[hsl(var(--primary))] font-semibold border-l-[3px] border-[hsl(var(--primary))]"
                                        : "bg-transparent text-[hsl(var(--muted-foreground))] font-medium border-l-[3px] border-transparent hover:bg-[hsl(var(--secondary))]"
                                )}
                            >
                                <span className="text-[15px] shrink-0 w-5 text-center">{it.icon}</span>
                                {!collapsed && <span className="flex-1 text-left whitespace-nowrap">{it.label}</span>}
                                {!collapsed && it.badge > 0 && (
                                    <span className="bg-[hsl(var(--primary))] text-white text-[10px] font-bold px-1.5 py-px rounded-lg min-w-[18px] text-center">
                                        {it.badge}
                                    </span>
                                )}
                                {it.external && !collapsed && <span className="text-[10px] opacity-50">↗</span>}
                            </ButtonWrapper>
                        );
                    })}
                </nav>

                {/* Footer */}
                {!collapsed && (
                    <div
                        className="px-3.5 py-2.5 border-t border-[hsl(var(--border))] text-[10px] text-[hsl(var(--muted-foreground))] cursor-pointer transition-colors hover:text-[hsl(var(--primary))]"
                        onClick={() => setShowLog(true)}
                    >
                        📋 v{APP_VERSION} • View Changelog
                    </div>
                )}
            </div>

            {/* Changelog Modal */}
            {showLog && (
                <div
                    onClick={e => { if (e.target === e.currentTarget) setShowLog(false); }}
                    className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center animate-[fadeIn_.2s]"
                >
                    <div className="bg-[hsl(var(--card))] rounded-2xl w-[90%] max-w-[560px] max-h-[80vh] flex flex-col shadow-[0_25px_60px_rgba(0,0,0,.3)] border border-[hsl(var(--border))] animate-[slideIn_.25s]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                            <div>
                                <div className="text-base font-bold">📋 Changelog</div>
                                <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">LP Factory v{APP_VERSION}</div>
                            </div>
                            <button
                                onClick={() => setShowLog(false)}
                                className="w-[30px] h-[30px] rounded-full border-none bg-[hsl(var(--border))] cursor-pointer text-base flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]"
                            >✕</button>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto px-5 py-4">
                            {CHANGELOG.map((release, i) => (
                                <div key={release.version} className={i < CHANGELOG.length - 1 ? "mb-6" : ""}>
                                    <div className="flex items-center gap-2 mb-2.5">
                                        <span className={cn(
                                            "text-[11px] font-bold px-2.5 py-0.5 rounded-md",
                                            i === 0
                                                ? "bg-[hsl(var(--primary))] text-white"
                                                : "bg-[hsl(var(--primary))/18] text-[hsl(var(--primary))]"
                                        )}>v{release.version}</span>
                                        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{release.date}</span>
                                        {i === 0 && (
                                            <span className="text-[9px] font-bold text-[#22c55e] bg-[#22c55e18] px-2 py-0.5 rounded uppercase tracking-wide">
                                                Latest
                                            </span>
                                        )}
                                    </div>
                                    <ul className="m-0 p-0 list-none">
                                        {release.changes.map((change, j) => (
                                            <li
                                                key={j}
                                                className={cn(
                                                    "text-xs text-[hsl(var(--foreground))] py-1 pl-3 ml-1 leading-relaxed",
                                                    i === 0
                                                        ? "border-l-2 border-[hsl(var(--primary))]"
                                                        : "border-l-2 border-[hsl(var(--border))]"
                                                )}
                                            >{change}</li>
                                        ))}
                                    </ul>
                                    {i < CHANGELOG.length - 1 && <div className="border-b border-[hsl(var(--border))] mt-4" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
