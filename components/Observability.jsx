import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";

// Hetzner host where observability stack lives
const HETZNER_HOST = "178.105.137.23";

// Service registry — single source of truth for observability endpoints
const SERVICES = [
    {
        id: "clawmetry",
        name: "ClawMetry",
        category: "Observability",
        icon: "🐾",
        url: `http://${HETZNER_HOST}:8900`,
        description: "Hermes Agent telemetry — skills, sessions, cron jobs, infra metrics",
        healthPath: "/api/health",
        capabilities: ["Skills (85)", "Sessions", "Crons", "Infra"]
    },
    {
        id: "langfuse",
        name: "Langfuse",
        category: "LLM Observability",
        icon: "📊",
        url: `http://${HETZNER_HOST}:3030`,
        description: "LLM trace + cost tracking — tokens, latency, model usage",
        healthPath: "/api/public/health",
        capabilities: ["Traces", "Costs", "Tokens", "Analytics"]
    },
    {
        id: "litellm",
        name: "LiteLLM Proxy",
        category: "LLM Gateway",
        icon: "🔀",
        url: `http://${HETZNER_HOST}:4000`,
        docsPath: "/docs",
        description: "Multi-provider LLM proxy — OpenRouter → Anthropic/Google → Langfuse",
        healthPath: "/health",
        capabilities: ["Routing", "Fallback", "Cost Tracking"]
    },
    {
        id: "fbis-mcp",
        name: "FBIS MCP",
        category: "Agent Tools",
        icon: "🛡️",
        url: `http://${HETZNER_HOST}:8765`,
        description: "Ban Intelligence MCP server — account risk, proxy pool, pixel events",
        capabilities: ["Risk Scoring", "Pixel Events", "Proxy Pool"]
    }
];

// 4-agent Hermes team
const AGENTS = [
    {
        id: "aegis",
        name: "AEGIS",
        purpose: "Brand-Jack Detection",
        schedule: "Every 2 hours",
        cronExpr: "0 */2 * * *",
        icon: "⚔️",
        color: "#ef4444",
        api: "DataForSEO Ads Advertisers",
        stateFile: "~/.hermes/aegis-state/alerts.jsonl"
    },
    {
        id: "scout",
        name: "SCOUT",
        purpose: "Competitor Ad Copy Intel",
        schedule: "Daily 06:00 UTC",
        cronExpr: "0 6 * * *",
        icon: "🔭",
        color: "#3b82f6",
        api: "DataForSEO Ads Search (by target)",
        stateFile: "~/.hermes/scout-state/diffs.jsonl"
    },
    {
        id: "herald",
        name: "HERALD",
        purpose: "Trend & Reputation Monitor",
        schedule: "Daily 08:00 UTC",
        cronExpr: "0 8 * * *",
        icon: "📣",
        color: "#f59e0b",
        api: "Google Trends + Trustpilot + CFPB",
        stateFile: "~/.hermes/herald-state/alerts.jsonl"
    },
    {
        id: "oracle",
        name: "ORACLE",
        purpose: "Keyword Discovery",
        schedule: "Weekly Mon 09:00 UTC",
        cronExpr: "0 9 * * 1",
        icon: "🔮",
        color: "#8b5cf6",
        api: "DataForSEO Labs + Autocomplete",
        stateFile: "~/.hermes/oracle-state/keywords.jsonl"
    }
];

function HealthDot({ status }) {
    const color = status === "ok" ? "#22c55e" : status === "fail" ? "#ef4444" : "#94a3b8";
    return (
        <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
            title={status}
        />
    );
}

function ServiceCard({ service }) {
    const [health, setHealth] = useState("checking");

    useEffect(() => {
        if (!service.healthPath) {
            setHealth("unknown");
            return;
        }
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        fetch(service.url + service.healthPath, { signal: ctrl.signal, mode: "no-cors" })
            .then(() => setHealth("ok"))
            .catch(() => setHealth("fail"))
            .finally(() => clearTimeout(timeout));
        return () => { ctrl.abort(); clearTimeout(timeout); };
    }, [service.url, service.healthPath]);

    return (
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4 hover:border-[hsl(var(--primary))] transition-colors">
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{service.icon}</span>
                    <div>
                        <div className="text-sm font-semibold flex items-center gap-2">
                            {service.name}
                            <HealthDot status={health} />
                        </div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                            {service.category}
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed min-h-[2.5rem]">
                {service.description}
            </div>

            {service.capabilities && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {service.capabilities.map(cap => (
                        <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">
                            {cap}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <a
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center text-xs px-3 py-1.5 rounded-md bg-[hsl(var(--primary))] text-white font-medium no-underline hover:opacity-90 transition-opacity"
                >
                    Open ↗
                </a>
                {service.docsPath && (
                    <a
                        href={service.url + service.docsPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] no-underline hover:bg-[hsl(var(--secondary))]"
                    >
                        Docs
                    </a>
                )}
            </div>

            <div className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))] font-mono truncate" title={service.url}>
                {service.url}
            </div>
        </div>
    );
}

function AgentCard({ agent }) {
    return (
        <div
            className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4"
            style={{ borderLeftWidth: "4px", borderLeftColor: agent.color }}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{agent.icon}</span>
                    <div>
                        <div className="text-sm font-bold" style={{ color: agent.color }}>
                            {agent.name}
                        </div>
                        <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                            {agent.purpose}
                        </div>
                    </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#22c55e18] text-[#22c55e] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                    Active
                </span>
            </div>

            <div className="space-y-1.5 mt-3 text-xs">
                <div className="flex justify-between">
                    <span className="text-[hsl(var(--muted-foreground))]">Schedule</span>
                    <span className="font-medium">{agent.schedule}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-[hsl(var(--muted-foreground))]">Cron</span>
                    <code className="text-[10px] bg-[hsl(var(--secondary))] px-1.5 py-0.5 rounded">
                        {agent.cronExpr}
                    </code>
                </div>
                <div className="flex justify-between">
                    <span className="text-[hsl(var(--muted-foreground))]">API</span>
                    <span className="font-medium text-right">{agent.api}</span>
                </div>
            </div>

            <div className="mt-3 text-[10px] text-[hsl(var(--muted-foreground))] font-mono truncate" title={agent.stateFile}>
                📂 {agent.stateFile}
            </div>
        </div>
    );
}

export function Observability() {
    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-1">🔭 Observability & Agents</h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Monitor the FusionOps observability stack and Hermes agent team running on Hetzner (
                    <code className="text-xs">{HETZNER_HOST}</code>)
                </p>
            </div>

            {/* Services Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">Services</h2>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {SERVICES.length} services
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SERVICES.map(service => (
                        <ServiceCard key={service.id} service={service} />
                    ))}
                </div>
            </div>

            {/* Hermes Agents Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">Hermes Trademark-Monitoring Team</h2>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {AGENTS.length} agents — DataForSEO + Telegram alerts
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {AGENTS.map(agent => (
                        <AgentCard key={agent.id} agent={agent} />
                    ))}
                </div>
            </div>

            {/* Quick Commands */}
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-5">
                <h2 className="text-lg font-semibold mb-3">🔧 Quick Commands</h2>
                <div className="space-y-3 text-xs font-mono">
                    <div>
                        <div className="text-[hsl(var(--muted-foreground))] mb-1">SSH to Hetzner</div>
                        <code className="block bg-[hsl(var(--secondary))] px-3 py-2 rounded select-all">
                            ssh -i ~/.ssh/fusionops_hetzner root@{HETZNER_HOST}
                        </code>
                    </div>
                    <div>
                        <div className="text-[hsl(var(--muted-foreground))] mb-1">List Hermes cron jobs</div>
                        <code className="block bg-[hsl(var(--secondary))] px-3 py-2 rounded select-all">
                            hermes cron list
                        </code>
                    </div>
                    <div>
                        <div className="text-[hsl(var(--muted-foreground))] mb-1">Trigger AEGIS manually</div>
                        <code className="block bg-[hsl(var(--secondary))] px-3 py-2 rounded select-all">
                            hermes cron run aegis-brand-jack
                        </code>
                    </div>
                    <div>
                        <div className="text-[hsl(var(--muted-foreground))] mb-1">View recent alerts (AEGIS)</div>
                        <code className="block bg-[hsl(var(--secondary))] px-3 py-2 rounded select-all">
                            tail -20 ~/.hermes/aegis-state/alerts.jsonl | jq -r .
                        </code>
                    </div>
                    <div>
                        <div className="text-[hsl(var(--muted-foreground))] mb-1">Hermes service status</div>
                        <code className="block bg-[hsl(var(--secondary))] px-3 py-2 rounded select-all">
                            systemctl status hermes-gateway clawmetry
                        </code>
                    </div>
                </div>
            </div>
        </div>
    );
}
