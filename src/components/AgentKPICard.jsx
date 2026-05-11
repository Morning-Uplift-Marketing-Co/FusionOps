import React from "react";

const AGENT_COLORS = {
  argus: "#6366f1",
  nexus: "#f97316",
  iris: "#22c55e",
  chrono: "#3b82f6",
  verdict: "#dc2626",
};

const AGENT_ICONS = {
  argus: "👁",
  nexus: "🔗",
  iris: "🌸",
  chrono: "⏱",
  verdict: "⚖️",
};

export default function AgentKPICard({ agentName, metrics = [] }) {
  const color = AGENT_COLORS[agentName] || "#6b7280";
  const icon = AGENT_ICONS[agentName] || "🤖";

  return (
    <div
      style={{ borderColor: color }}
      className="rounded-lg border-2 bg-gray-900 p-4 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="font-bold text-white capitalize">{agentName}</span>
      </div>

      {metrics.length === 0 && (
        <p className="text-xs text-gray-500">No data in last 7 days</p>
      )}

      {metrics.map((m) => (
        <div key={m.metric} className="flex justify-between items-center text-sm">
          <span className="text-gray-400 truncate max-w-[60%]">{m.metric}</span>
          <span style={{ color }} className="font-mono font-semibold">
            {typeof m.avg_value === "number" ? m.avg_value.toFixed(1) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
