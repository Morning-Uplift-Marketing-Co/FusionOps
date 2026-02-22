import React from "react";
import { THEME as T } from "../constants";
import { Dot } from "./ui/dot";

export function TopBar({ stats, settings, deploys, apiOk, neonOk, onReconnectNeon }) {
    return (
        <div className="h-12 border-b border-[hsl(var(--border))] flex items-center justify-between px-7 bg-[rgba(11,13,20,.85)] backdrop-blur-md sticky top-0 z-50">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
                Builds: <b className="text-[hsl(var(--foreground))]">{stats.builds}</b>
                <span className="mx-2.5 text-[hsl(var(--border))]">│</span>
                Cost: <b className="text-[hsl(var(--accent))]">${stats.spend.toFixed(2)}</b>
                <span className="mx-2.5 text-[hsl(var(--border))]">│</span>
                Deployed: <b className="text-[hsl(var(--success))]">{deploys?.length || 0}</b>
            </div>
            <div className="flex items-center gap-3">
                <Dot c={neonOk ? T.success : T.warning} label={neonOk ? "Neon ✓" : apiOk ? "API ✓" : "Local"} />
                {!neonOk && settings.neonUrl && (
                    <button
                        onClick={onReconnectNeon}
                        className="text-[11px] px-2 py-1 bg-[hsl(var(--primary))] text-white border-none rounded cursor-pointer transition-all hover:opacity-90"
                        title="Reconnect to Neon database"
                    >
                        Reconnect
                    </button>
                )}
                {settings.netlifyToken && <Dot c={T.success} label="Netlify" />}
                <Dot c={settings.apiKey ? T.success : T.danger} label={settings.apiKey ? "AI OK" : "No AI"} />
                <Dot c={settings.lcToken ? T.success : T.dim} label={settings.lcToken ? "LC ✓" : "LC"} />
                <Dot c={settings.mlToken ? T.success : T.dim} label={settings.mlToken ? "ML ✓" : "ML"} />
            </div>
        </div>
    );
}
