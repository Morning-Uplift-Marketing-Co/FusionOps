import React, { useState, useEffect, useMemo } from "react";
import AgentKPICard from "./AgentKPICard";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://lp-factory-api.misty-feather-556e.workers.dev/api";

function riskColor(score) {
  if (score >= 0.85) return "#dc2626";
  if (score >= 0.7) return "#f97316";
  if (score >= 0.6) return "#eab308";
  if (score >= 0.3) return "#3b82f6";
  return "#22c55e";
}

function riskLabel(score) {
  if (score >= 0.85) return "Critical";
  if (score >= 0.7) return "High";
  if (score >= 0.6) return "Caution";
  if (score >= 0.3) return "Monitor";
  return "Clean";
}

async function fetchJson(path) {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export default function RiskDashboard() {
  const [accounts, setAccounts] = useState([]);
  const [riskScores, setRiskScores] = useState([]);
  const [banEvents, setBanEvents] = useState([]);
  const [agentKpis, setAgentKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("accounts");

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchJson("/analysis/accounts"),
      fetchJson("/analysis/risk-scores"),
      fetchJson("/analysis/ban-events"),
      fetchJson("/analysis/agent-kpis"),
    ])
      .then(([acc, risk, bans, kpis]) => {
        setAccounts(acc.data || []);
        setRiskScores(risk.data || []);
        setBanEvents(bans.data || []);
        setAgentKpis(kpis.data || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // merge risk scores into accounts
  const enrichedAccounts = useMemo(() => {
    const scoreMap = Object.fromEntries(riskScores.map((r) => [r.account_id, r]));
    return accounts.map((a) => ({ ...a, _risk: scoreMap[a.id] || null }));
  }, [accounts, riskScores]);

  // group agent KPIs by agent_name
  const kpisByAgent = useMemo(() => {
    const map = {};
    for (const k of agentKpis) {
      if (!map[k.agent_name]) map[k.agent_name] = [];
      map[k.agent_name].push(k);
    }
    return map;
  }, [agentKpis]);

  const TABS = ["accounts", "bans", "agents"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Loading risk data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded bg-red-950 border border-red-700 p-4 text-red-300 text-sm">
        Failed to load: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 text-sm text-gray-200">
      <h2 className="text-xl font-bold text-white">Risk Dashboard</h2>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-t capitalize font-medium transition-colors ${
              tab === t
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Accounts tab */}
      {tab === "accounts" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 text-left border-b border-gray-800">
                <th className="pb-2 pr-4">Account</th>
                <th className="pb-2 pr-4">Stage</th>
                <th className="pb-2 pr-4">Risk Score</th>
                <th className="pb-2 pr-4">Proxy</th>
                <th className="pb-2 pr-4">Spend / mo</th>
                <th className="pb-2">Sites</th>
              </tr>
            </thead>
            <tbody>
              {enrichedAccounts.map((a) => {
                const score = a._risk?.score ?? a.risk_score ?? 0;
                return (
                  <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-4 font-medium text-white">{a.label || a.id}</td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 capitalize">
                        {a.lifecycle_stage || "active"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span style={{ color: riskColor(score) }} className="font-mono font-bold">
                        {score.toFixed(2)}
                      </span>
                      <span style={{ color: riskColor(score) }} className="ml-2 text-xs">
                        {riskLabel(score)}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-gray-400">{a.proxy_ip || "—"}</td>
                    <td className="py-2 pr-4 font-mono">
                      ${(a.monthly_spend || 0).toLocaleString()}
                    </td>
                    <td className="py-2">{a.linked_sites ?? 0}</td>
                  </tr>
                );
              })}
              {enrichedAccounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    No accounts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Ban events tab */}
      {tab === "bans" && (
        <div className="flex flex-col gap-2">
          {banEvents.length === 0 && (
            <p className="text-gray-500 text-center py-6">No ban events recorded</p>
          )}
          {banEvents.map((b) => (
            <div key={b.id} className="rounded-lg bg-gray-800 p-3 border-l-4 border-red-600">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-white">{b.ban_type}</span>
                <span className="text-gray-500 text-xs">{b.occurred_at?.slice(0, 10)}</span>
              </div>
              <div className="text-gray-400 mt-1">
                Account: <span className="text-gray-200">{b.account_id}</span>
                {b.platform && (
                  <span className="ml-3 px-2 py-0.5 rounded bg-gray-700 text-xs">{b.platform}</span>
                )}
              </div>
              {b.reason && <p className="text-gray-400 text-xs mt-1">{b.reason}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Agents tab */}
      {tab === "agents" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {["argus", "nexus", "iris", "chrono", "verdict"].map((name) => (
            <AgentKPICard key={name} agentName={name} metrics={kpisByAgent[name] || []} />
          ))}
        </div>
      )}
    </div>
  );
}
