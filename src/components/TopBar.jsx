import React from "react";
import { THEME as T } from "../constants";

/* ── Inline SVG icons (16×16 viewBox) ── */
const I = ({ d, ...p }) => (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" {...p}>
        {typeof d === "string" ? <path d={d} /> : d}
    </svg>
);

const DbIcon = (p) => <I {...p} d={<><ellipse cx="8" cy="4" rx="5.5" ry="2.2" /><path d="M2.5 4v8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V4" /><path d="M2.5 8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2" /></>} />;
const CloudIcon = (p) => <I {...p} d="M4.5 12.5h7.2a3 3 0 0 0 .6-5.94A4 4 0 0 0 4.5 8a2.5 2.5 0 0 0 0 4.5z" />;
const ChartIcon = (p) => <I {...p} d={<><rect x="2" y="9" width="3" height="5" rx=".5" fill="currentColor" opacity=".4" /><rect x="6.5" y="5" width="3" height="9" rx=".5" fill="currentColor" opacity=".6" /><rect x="11" y="2" width="3" height="12" rx=".5" fill="currentColor" opacity=".8" /></>} />;
const CardIcon = (p) => <I {...p} d={<><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" /><line x1="1.5" y1="6.5" x2="14.5" y2="6.5" /><line x1="4" y1="9.5" x2="7" y2="9.5" /></>} />;
const GlobeIcon = (p) => <I {...p} d={<><circle cx="8" cy="8" r="6" /><ellipse cx="8" cy="8" rx="2.8" ry="6" /><line x1="2" y1="8" x2="14" y2="8" /></>} />;
const BotIcon = (p) => <I {...p} d={<><rect x="3" y="5" width="10" height="8" rx="2" /><circle cx="6" cy="9" r="1" fill="currentColor" /><circle cx="10" cy="9" r="1" fill="currentColor" /><line x1="8" y1="2" x2="8" y2="5" /><circle cx="8" cy="1.5" r="1" /></>} />;

/* ── StatusIcon: icon + color + glow + tooltip ── */
function StatusIcon({ icon: Icon, ok, warn, label }) {
    const color = warn ? T.warning : ok ? T.success : T.dim;
    const glow = ok && !warn ? `drop-shadow(0 0 4px ${T.success}66)` : warn ? `drop-shadow(0 0 4px ${T.warning}66)` : "none";
    return (
        <span
            title={label}
            style={{
                color,
                filter: glow,
                opacity: ok || warn ? 1 : 0.45,
                display: "inline-flex",
                cursor: "default",
                transition: "all .2s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
        >
            <Icon />
        </span>
    );
}

/* ── TopBar ── */
export function TopBar({ stats, settings, deploys, apiOk, neonOk, onReconnectNeon }) {
    const voluumOk = !!(
        (settings?.voluumAccessKeyId && settings?.voluumAccessKey) ||
        (import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY_ID && import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY)
    );
    const lcOk = !!(
        settings?.lcToken ||
        import.meta.env.PUBLIC_LENDINGCARD_API_TOKEN ||
        import.meta.env.VITE_LENDINGCARD_TOKEN
    );
    const cfOk = !!(settings?.cfApiToken && settings?.cfAccountId);
    const mlOk = !!settings?.mlToken;
    const aiOk = !!settings?.apiKey;
    const neonWarn = !neonOk && apiOk;

    const neonLabel = neonOk ? "Neon: Connected" : apiOk ? "Neon: API Fallback" : "Neon: Local Only";
    const cfLabel = cfOk ? "Cloudflare: Connected" : "Cloudflare: Not configured";
    const volLabel = voluumOk ? "Voluum: Connected" : "Voluum: Not configured";
    const lcLabel = lcOk ? "LendingCard: Connected" : "LendingCard: Not configured";
    const mlLabel = mlOk ? "Multilogin: Connected" : "Multilogin: Not configured";
    const aiLabel = aiOk ? "AI: Ready" : "AI: No API Key";

    return (
        <div className="h-12 border-b border-[hsl(var(--border))] flex items-center justify-between px-7 bg-[hsl(var(--card))]/85 backdrop-blur-md sticky top-0 z-50">
            {/* Left: stats */}
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
                Builds: <b className="text-[hsl(var(--foreground))]">{stats.builds}</b>
                <span className="mx-2.5 text-[hsl(var(--border))]">|</span>
                Cost: <b className="text-[hsl(var(--foreground))]">${stats.spend.toFixed(2)}</b>
                <span className="mx-2.5 text-[hsl(var(--border))]">|</span>
                Deployed: <b className="text-[hsl(var(--foreground))]">{deploys?.length || 0}</b>
            </div>

            {/* Right: service status icons */}
            <div className="flex items-center gap-2.5">
                <StatusIcon icon={DbIcon} ok={neonOk || apiOk} warn={neonWarn} label={neonLabel} />
                {!neonOk && settings.neonUrl && (
                    <button
                        onClick={onReconnectNeon}
                        className="text-[10px] px-1.5 py-0.5 bg-[hsl(var(--primary))] text-white border-none rounded cursor-pointer transition-all hover:opacity-90"
                        title="Reconnect to Neon database"
                    >
                        ↻
                    </button>
                )}
                <StatusIcon icon={CloudIcon} ok={cfOk} label={cfLabel} />
                <StatusIcon icon={ChartIcon} ok={voluumOk} label={volLabel} />
                <StatusIcon icon={CardIcon} ok={lcOk} label={lcLabel} />
                <StatusIcon icon={GlobeIcon} ok={mlOk} label={mlLabel} />
                <StatusIcon icon={BotIcon} ok={aiOk} warn={!aiOk} label={aiLabel} />
            </div>
        </div>
    );
}
