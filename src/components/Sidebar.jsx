import React, { useState } from "react";
import { THEME as T } from "../constants";
import { APP_VERSION } from "../constants";
import { cn } from "../lib/utils";
import { isAdmin } from "../services/auth";

const CHANGELOG = [
    {
        version: "3.6.2",
        date: "2026-03-27",
        changes: [
            "🧩 LP Wizard — merge Step 3 (Template) + Step 4 (Design) into single unified step (6 steps total)",
            "📱 Template Selection — compact list + live phone preview on hover/select",
        ],
    },
    {
        version: "3.6.1",
        date: "2026-03-26",
        changes: [
            "🛡️ IP Quality Pipeline — dynamic endpoint handling, fallback to IPinfo Lite with Bearer Auth, custom Scamalytics user config to avoid 404s",
            "🔌 Proxy Tools — new Proxy Gateway Worker fallback + API Health Check endpoints integration",
            "🐛 LendingCards — correctly parse paginated API responses from provider",
            "🔧 OpsCenter — fix missing mlProfiles map errors on UI load",
            "🔒 Security — tighten worker read-only query permissions when API_SECRET is unset, protect template mutations",
        ],
    },
    {
        version: "3.6.0",
        date: "2026-03-23",
        changes: [
            "📜 Release — standard-version v3.6.0; full conventional changelog in repo CHANGELOG.md",
            "🚀 Deploy — prioritize GitHub Actions; drop S3 and VPS deploy targets",
            "🖥️ Dashboard — revenue sourcing and admin UX improvements",
            "🧙 Wizard — optional Domain Provider on Step 1; Cloudflare account visible without registrar",
            "📡 Tracking — Cross-Validation dashboard tab (postbacks vs pixel events)",
        ],
    },
    {
        version: "3.5.1",
        date: "2026-03-23",
        changes: [
            "🔧 LeadsGate Form Tracking — Enhanced MutationObserver fallback with 15s timeout",
            "📊 Form Load Detection — Added lg_form_ready event for better validation tracking",
            "🐛 Error Handling — Improved debugging with console warnings for form loading failures",
            "🔗 Click ID Handling — Enhanced parameter format support across tracking systems",
            "📝 Workflow Documentation — Updated convert-astro-template.md with enhanced patterns",
        ],
    },
    {
        version: "3.5.0",
        date: "2026-03-16",
        changes: [
            "✅ Task Manager — Kanban + List view task system for PPC/LP campaigns",
            "📋 Kanban Board — 5-column board (Backlog → Todo → In Progress → Review → Done)",
            "⚡ Quick Add — inline task creation per column; Enter to save, Esc to cancel",
            "☰ List View — sortable table with bulk-select delete",
            "🔍 Filter Bar — search, status, priority, site, assignee filters",
            "🗄️ Neon tasks table + D1 fire-and-forget backup",
            "📊 Dashboard Task Summary widget — urgent / in-progress / due-today",
            "🏆 KPI integration — task_created & task_completed scored in leaderboard",
        ],
    },
    {
        version: "3.4.1",
        date: "2026-03-16",
        changes: [
            "🐛 Auth race — getMe() guards findSession() behind connection check, preserving valid sessions on boot",
            "🐛 KPI sort mismatch fixed — shared calcScore() aligns leaderboard rank with displayed scores",
            "🐛 Audit meta — severity no longer duplicated inside meta JSONB",
            "⚡ createSession + updateLastLogin run in parallel (Promise.all)",
            "⚡ KPI Dashboard — myActivity memo, single-pass myStats reduce, memoised recentActivity",
            "🧹 UserManager notify() setTimeout cleared on unmount",
            "🔁 Sidebar uses imported isAdmin() from auth service",
        ],
    },
    {
        version: "3.4.0",
        date: "2026-03-16",
        changes: [
            "🔐 Auth System — PBKDF2 login, session management, role-based access (admin/employee)",
            "👥 User Manager — admin CRUD for team accounts: create, edit, activate/deactivate",
            "🏆 KPI Dashboard — team leaderboard (admin) + personal stats (employee) from audit log",
            "🔒 Data Sanitizer — strips revenue/profit/roi/payout for employee role server-side",
            "💾 Neon DB — users, sessions, site_audit_log tables with indices",
            "🧭 Route Guard — app requires login, shows LoginPage when session expired",
            "📌 Sidebar — user identity panel, role badge, logout button (↩)",
        ],
    },
    {
        version: "3.0.0",
        date: "2026-03-13",
        changes: [
            "🚀 FusionOps 3.0 branding update — standardized product naming across UI and changelog surfaces",
            "📦 Template Manager + registry updates shipped in dashboard latest bundle",
            "🔒 MCP auth flow fixed — /api/mcp routes now use x-mcp-secret path cleanly with updated docs",
        ],
    },
    {
        version: "V3-1.1",
        date: "2026-02-28",
        changes: [
            "☁️ CF Multi-Profile System — manage multiple Cloudflare accounts in Settings with CRUD, test, auto-migration",
            "🌐 Zone Explorer — OpsCenter CF Accounts tab with expandable zone list + DNS record viewer per profile",
            "⚡ Workers Route Auto-Create — deploy now creates Workers Routes for root domain + t. pixel subdomain",
            "📡 Voluum DNS Provisioning — StepTracking wizard creates CloudFront + ACM cert CNAMEs in Cloudflare",
            "🔧 DNS Auto-Provisioning — deploy creates A (root), A (t.), CNAME (trk.) records automatically",
            "🔄 App.jsx Profile Sync — Settings cfProfiles auto-sync to OpsCenter cfAccounts",
        ],
    },
    {
        version: "V3-1.0",
        date: "2026-02-27",
        time: "16:42",
        changes: [
            "🧩 Template Selection — dedicated Step 3 with gallery view, category filters & thumbnail previews",
            "📦 Template gallery loads from registry + API custom templates with delete support",
            "📊 Wizard expanded to 7 steps: Brand → Product → Template → Design → Copy → Tracking → Review",
            "🏢 Brand step simplified — template selection moved to its own step",
            "🔍 Template info shown in Review summary",
        ],
    },
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
            "🚀 Launched FusionOps 3.0 — all-in-one PPC landing page platform",
            "🏢 Ops Center: manage domains, DNS, registrars, deployers",
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

export function Sidebar({ page, setPage, siteCount, taskBadge, startCreate, startTemplateGen, collapsed, toggle, user, onLogout }) {
    const [showLog, setShowLog] = useState(false);
    const admin = isAdmin(user);

    const baseItems = [
        { id: "dashboard", icon: "📊", label: "Dashboard" },
        { id: "tasks", icon: "✅", label: "Tasks", badge: taskBadge },
        { id: "kpi", icon: "🏆", label: "KPI Dashboard" },
        { id: "voluum", icon: "🎯", label: "Voluum Explorer" },
        { id: "account-map", icon: "🗺️", label: "Account Map" },
        { id: "sites", icon: "🌐", label: "My Sites", badge: siteCount },
        { id: "template-manager", icon: "🗂️", label: "Template Manager" },
        { id: "template-gen", icon: "🧙", label: "Template Wizard", action: startTemplateGen },
        { id: "create", icon: "⚡", label: "LP Wizard", action: startCreate },
        { id: "profile-manager", label: "Multilogin X", brand: "multilogin" },
        { id: "adspower-profiles", label: "AdsPower", brand: "adspower" },
        { id: "ops", icon: "🏢", label: "Ops Center" },
        { id: "deploys", icon: "🚀", label: "Deploys" },
        { id: "tracking", icon: "🔬", label: "Tracking Test" },
        { id: "realtime-events", icon: "⚡", label: "Realtime Events" },
        { id: "proxy-health", icon: "🛡️", label: "Proxy Health" },
        { id: "risk-dashboard", icon: "🔴", label: "FBIS Dashboard" },
        { id: "observability", icon: "🔭", label: "Observability" },
        { id: "error-log", icon: "🐛", label: "Error Log" },
        { id: "api-health", icon: "🩺", label: "API Health" },
        { id: "docs", icon: "📚", label: "API Docs", external: true, href: "/docs" },
        { id: "settings", icon: "⚙️", label: "Settings" },
    ];

    // Admin-only items
    const adminItems = [
        { id: "spend", icon: "💳", label: "Spend Dashboard" },
        { id: "users", icon: "👥", label: "User Manager" },
    ];

    const items = admin ? [...baseItems, ...adminItems] : baseItems;

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
                        className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer shrink-0"
                        style={{ background: T.grad }}
                    >
                        <svg width="14" height="16" viewBox="0 0 26 30" fill="none">
                            <rect x="2" y="0" width="7" height="30" rx="1.5" fill="white"/>
                            <rect x="2" y="0" width="22" height="7.5" rx="1.5" fill="white"/>
                            <rect x="2" y="12" width="16" height="6.5" rx="1.5" fill="white"/>
                        </svg>
                    </div>
                    {!collapsed && (
                        <div>
                            <div className="text-[15px] font-bold whitespace-nowrap">FusionOps 3.0</div>
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

                {/* Nav — aria-label so collapsed rail + Playwright target the app sidebar, not Astro dev overlays */}
                <nav className="p-1.5 flex-1" aria-label="FusionOps main">
                    {items.map(it => {
                        const active = page === it.id;
                        const ButtonWrapper = it.external ? 'a' : 'button';
                        const buttonProps = it.external ? { href: it.href, target: "_blank", rel: "noopener noreferrer" } : {};
                        return (
                            <ButtonWrapper
                                key={it.id}
                                type={it.external ? undefined : "button"}
                                aria-label={it.label}
                                title={
                                    collapsed
                                        ? it.label
                                        : it.id === "sites" && it.badge
                                          ? `Total LP sites: ${it.badge} (search / Only issues / quick filters can show fewer on the list)`
                                          : undefined
                                }
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
                                <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                                    {it.brand === "multilogin" ? (
                                        <img
                                            src="/vendor-icons/multilogin-favicon.ico"
                                            alt=""
                                            width={20}
                                            height={20}
                                            decoding="async"
                                            className="h-5 w-5 object-contain rounded-[4px]"
                                        />
                                    ) : it.brand === "adspower" ? (
                                        <img
                                            src="/vendor-icons/adspower-favicon.svg"
                                            alt=""
                                            width={20}
                                            height={20}
                                            decoding="async"
                                            className="h-5 w-5 object-contain rounded-[4px]"
                                        />
                                    ) : (
                                        <span className="text-[15px] w-5 text-center leading-none">{it.icon}</span>
                                    )}
                                </span>
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
                <div className="border-t border-[hsl(var(--border))]">
                    {/* User info */}
                    {!collapsed && user && (
                        <div className="px-3.5 py-2.5 flex items-center gap-2">
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                                style={{ background: T.grad }}
                            >
                                {(user.name || user.email || "?")[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-semibold truncate">{user.name || user.email?.split("@")[0]}</div>
                                <div className="text-[10px] text-[hsl(var(--muted-foreground))] capitalize">{user.role}</div>
                            </div>
                            {onLogout && (
                                <button
                                    onClick={onLogout}
                                    title="Sign out"
                                    className="text-[12px] text-[hsl(var(--muted-foreground))] hover:text-red-500 border-none bg-transparent cursor-pointer px-1"
                                >
                                    ↩
                                </button>
                            )}
                        </div>
                    )}
                    {collapsed && onLogout && (
                        <button
                            onClick={onLogout}
                            title="Sign out"
                            className="w-full py-2.5 flex items-center justify-center border-none bg-transparent cursor-pointer text-[hsl(var(--muted-foreground))] hover:text-red-500 text-[14px]"
                        >
                            ↩
                        </button>
                    )}
                    {!collapsed && (
                        <div
                            className="px-3.5 py-2 text-[10px] text-[hsl(var(--muted-foreground))] cursor-pointer transition-colors hover:text-[hsl(var(--primary))]"
                            onClick={() => setShowLog(true)}
                        >
                            📋 v{APP_VERSION} • View Changelog
                        </div>
                    )}
                </div>
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
                                <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">FusionOps 3.0</div>
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
                                        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{release.date}{release.time ? ` · ${release.time}` : ""}</span>
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
