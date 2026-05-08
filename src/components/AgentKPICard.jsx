import React from 'react';

const STATUS_COLOR = {
  healthy: 'text-green-600',
  watch: 'text-yellow-600',
  risk: 'text-orange-500',
  critical: 'text-red-600',
};

export function AgentKPICard({ agent, kpis = [] }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
      <h3 className="font-bold text-lg uppercase tracking-wide mb-3">{agent}</h3>
      <ul className="space-y-2">
        {kpis.map((k) => {
          const onTarget = k.kpi_value >= k.kpi_target;
          return (
            <li key={k.kpi_name} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{k.kpi_name}</span>
              <span className={`text-sm font-mono font-semibold ${onTarget ? 'text-green-600' : 'text-red-500'}`}>
                {k.kpi_value}{k.kpi_unit} / {k.kpi_target}{k.kpi_unit}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
