import React, { useState, useEffect } from 'react';
import { AgentKPICard } from './AgentKPICard.jsx';

const API = import.meta.env.PUBLIC_API_BASE || 'https://lp-factory-api.misty-feather-556e.workers.dev';

const VERDICT_COLORS = {
  healthy: 'bg-green-100 text-green-800',
  watch: 'bg-yellow-100 text-yellow-800',
  risk: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function RiskDashboard() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/analysis/accounts`)
      .then(r => r.json())
      .then(d => { setAccounts(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-8 text-gray-400">Loading risk data...</p>;

  const counts = accounts.reduce((acc, s) => {
    acc[s.verdict_status] = (acc[s.verdict_status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Google Ads OS — Risk Dashboard</h1>

      <div className="grid grid-cols-4 gap-3">
        {['healthy', 'watch', 'risk', 'critical'].map(status => (
          <div key={status} className={`rounded-lg p-4 text-center ${VERDICT_COLORS[status]}`}>
            <div className="text-3xl font-bold">{counts[status] || 0}</div>
            <div className="text-sm uppercase mt-1">{status}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              {['Account', 'Domain', 'Score', 'Status', 'Proxy Risk', 'Isolation', 'Traffic', 'Timeline'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{s.label || s.id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-gray-600">{s.site_domain || '—'}</td>
                <td className="px-4 py-3 font-bold">{s.verdict_score ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VERDICT_COLORS[s.verdict_status] || ''}`}>
                    {s.verdict_status || 'unscored'}
                  </span>
                </td>
                <td className="px-4 py-3">{s.proxy_risk ?? '—'}</td>
                <td className="px-4 py-3">{s.isolation_score ?? '—'}</td>
                <td className="px-4 py-3">{s.traffic_quality ?? '—'}</td>
                <td className="px-4 py-3">{s.timeline_risk ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
