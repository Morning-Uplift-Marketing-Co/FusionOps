import React from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

export function DeployHistory({ deploys }) {
    return (
        <div className="animate-[fadeIn_.3s_ease]">
            <h1 className="text-[22px] font-bold m-0 mb-1">🚀 Deploy History</h1>
            <p className="text-[hsl(var(--muted-foreground))] text-xs mb-5">All Netlify deployments</p>
            {deploys.length === 0 ? (
                <Card className="text-center p-12">
                    <div className="text-4xl mb-2">🚀</div>
                    <div className="text-[15px] font-semibold">No deployments yet</div>
                </Card>
            ) : deploys.map(d => (
                <Card key={d.id} className="px-4 py-3 mb-1.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base ${d.type === "new" ? "bg-[hsl(var(--success))/13]" : "bg-[hsl(var(--accent))/13]"}`}>
                        {d.type === "new" ? "🆕" : "🔄"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold">{d.brand}</div>
                        <a href={d.url} target="_blank" rel="noreferrer"
                            className="text-[11px] text-[hsl(var(--accent))] no-underline">{d.url}</a>
                    </div>
                    <div className="text-right">
                        <Badge variant={d.type === "new" ? "success" : "default"}>{d.type}</Badge>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{new Date(d.ts).toLocaleString()}</div>
                    </div>
                </Card>
            ))}
        </div>
    );
}
