import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const API = import.meta.env.PUBLIC_API_BASE || 'https://lp-factory-api.misty-feather-556e.workers.dev';

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-800',
  high:     'bg-orange-100 text-orange-700',
  warn:     'bg-yellow-100 text-yellow-700',
  info:     'bg-blue-100 text-blue-700',
};

const ACK_COLORS = {
  pending:   'bg-gray-100 text-gray-600',
  acked:     'bg-green-100 text-green-700',
  dismissed: 'bg-slate-100 text-slate-500',
  resolved:  'bg-teal-100 text-teal-700',
};

const AGENT_COLORS = {
  AEGIS:  'bg-red-50 text-red-700 border border-red-200',
  SCOUT:  'bg-blue-50 text-blue-700 border border-blue-200',
  HERALD: 'bg-purple-50 text-purple-700 border border-purple-200',
  ORACLE: 'bg-amber-50 text-amber-700 border border-amber-200',
};

const TABS = [
  { id: 'alerts',   label: '🚨 Alerts' },
  { id: 'keywords', label: '🔑 Keywords' },
  { id: 'baselines',label: '📊 Baselines' },
];

function Badge({ label, colorClass }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function StatCard({ value, label, colorClass = 'bg-gray-50 text-gray-700' }) {
  return (
    <div className={`rounded-lg p-4 text-center ${colorClass}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-70">{label}</div>
    </div>
  );
}

function fmt(unixTs) {
  if (!unixTs) return '—';
  return new Date(unixTs * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Alerts Tab ──────────────────────────────────────────────────────────────

function AlertsTab() {
  const [alerts, setAlerts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [agentFilter, setAgentFilter] = useState('ALL');
  const [sevFilter, setSevFilter]   = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [acking, setAcking]         = useState(null);

  function loadAlerts() {
    setLoading(true);
    const params = new URLSearchParams({ limit: 200 });
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    fetch(`${API}/api/agents/state/alerts?${params}`)
      .then(r => r.json())
      .then(d => { setAlerts(d.alerts || d || []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(loadAlerts, [statusFilter]);

  async function ack(id) {
    setAcking(id);
    await fetch(`${API}/api/agents/state/alerts`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ack_status: 'acked', acked_by: 'dashboard' }),
    });
    setAcking(null);
    loadAlerts();
  }

  async function dismiss(id) {
    setAcking(id);
    await fetch(`${API}/api/agents/state/alerts`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ack_status: 'dismissed', acked_by: 'dashboard' }),
    });
    setAcking(null);
    loadAlerts();
  }

  const visible = alerts.filter(a => {
    if (agentFilter !== 'ALL' && a.agent !== agentFilter) return false;
    if (sevFilter !== 'ALL' && a.severity !== sevFilter) return false;
    return true;
  });

  const counts = alerts.reduce((acc, a) => {
    acc[a.agent] = (acc[a.agent] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Stat row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard value={counts.AEGIS  || 0} label="AEGIS"  colorClass="bg-red-50 text-red-700" />
        <StatCard value={counts.SCOUT  || 0} label="SCOUT"  colorClass="bg-blue-50 text-blue-700" />
        <StatCard value={counts.HERALD || 0} label="HERALD" colorClass="bg-purple-50 text-purple-700" />
        <StatCard value={alerts.filter(a => a.ack_status === 'pending').length} label="Pending" colorClass="bg-gray-50 text-gray-700" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1 bg-white">
          <option value="ALL">All agents</option>
          {['AEGIS','SCOUT','HERALD'].map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1 bg-white">
          <option value="ALL">All severities</option>
          {['critical','high','warn','info'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1 bg-white">
          <option value="pending">Pending</option>
          <option value="acked">Acked</option>
          <option value="dismissed">Dismissed</option>
          <option value="resolved">Resolved</option>
          <option value="ALL">All</option>
        </select>
        <span className="text-sm text-gray-400 self-center">{visible.length} alerts</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No alerts found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Agent</th>
                <th className="pb-2 pr-4">Severity</th>
                <th className="pb-2 pr-4 w-1/2">Title</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-400 whitespace-nowrap text-xs">{fmt(a.created_at)}</td>
                  <td className="py-2 pr-4">
                    <Badge label={a.agent} colorClass={AGENT_COLORS[a.agent] || 'bg-gray-100 text-gray-600'} />
                  </td>
                  <td className="py-2 pr-4">
                    <Badge label={a.severity} colorClass={SEVERITY_COLORS[a.severity] || 'bg-gray-100'} />
                  </td>
                  <td className="py-2 pr-4 text-gray-700 max-w-xs truncate" title={a.title}>{a.title}</td>
                  <td className="py-2 pr-4">
                    <Badge label={a.ack_status} colorClass={ACK_COLORS[a.ack_status] || 'bg-gray-100'} />
                  </td>
                  <td className="py-2">
                    {a.ack_status === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => ack(a.id)}
                          disabled={acking === a.id}
                          className="px-2 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >Ack</button>
                        <button
                          onClick={() => dismiss(a.id)}
                          disabled={acking === a.id}
                          className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300 disabled:opacity-50"
                        >Dismiss</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Keywords Tab ─────────────────────────────────────────────────────────────

function KeywordsTab() {
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch(`${API}/api/agents/state/oracle-keywords?limit=200`)
      .then(r => r.json())
      .then(d => { setKeywords(d.keywords || d || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...keywords].sort((a, b) => {
    const da = (b.volume || 0) - (b.weekly_baseline_volume || 0);
    const db = (a.volume || 0) - (a.weekly_baseline_volume || 0);
    return da - db;
  });

  const chartData = sorted.slice(0, 20).map(k => ({
    name: k.keyword?.length > 20 ? k.keyword.slice(0, 20) + '…' : k.keyword,
    volume: k.volume || 0,
    baseline: k.weekly_baseline_volume || 0,
  }));

  if (loading) return <div className="text-center py-12 text-gray-400">Loading…</div>;
  if (!keywords.length) return (
    <div className="text-center py-12 text-gray-400">
      No keywords yet — ORACLE runs weekly (Monday 09:00 UTC)
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{keywords.length} keywords in corpus</p>
      </div>

      {/* Bar chart top 20 */}
      <div className="bg-white rounded-lg border p-4">
        <p className="text-xs text-gray-400 mb-3">Top 20 by volume</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="volume"   name="This week"  fill="#f59e0b" radius={[3,3,0,0]} />
            <Bar dataKey="baseline" name="Last week"  fill="#d1d5db" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b">
              <th className="pb-2 pr-4">Keyword</th>
              <th className="pb-2 pr-4">Source</th>
              <th className="pb-2 pr-4 text-right">Volume</th>
              <th className="pb-2 pr-4 text-right">Baseline</th>
              <th className="pb-2 pr-4 text-right">Δ</th>
              <th className="pb-2">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((k, i) => {
              const delta = (k.volume || 0) - (k.weekly_baseline_volume || 0);
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium text-gray-800">{k.keyword}</td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">{k.source}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{(k.volume || 0).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-gray-400">{(k.weekly_baseline_volume || 0).toLocaleString()}</td>
                  <td className={`py-2 pr-4 text-right tabular-nums font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {delta > 0 ? '+' : ''}{delta.toLocaleString()}
                  </td>
                  <td className="py-2 text-xs text-gray-400">{fmt(k.last_seen_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Baselines Tab ────────────────────────────────────────────────────────────

function BaselinesTab() {
  const [heraldBaselines, setHeraldBaselines] = useState([]);
  const [aegisBaselines,  setAegisBaselines]  = useState([]);
  const [loading, setLoading]                 = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/agents/state/baselines?agent=HERALD`).then(r => r.json()),
      fetch(`${API}/api/agents/state/baselines?agent=AEGIS`).then(r => r.json()),
    ]).then(([h, a]) => {
      setHeraldBaselines(h.baselines || h || []);
      setAegisBaselines(a.baselines  || a || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading…</div>;

  const aegisBatchRow = aegisBaselines.find(b => b.metric === 'batch_offset');
  const aegisProgress = aegisBatchRow ? Math.min(100, Math.round((aegisBatchRow.value / 519) * 100)) : null;

  return (
    <div className="space-y-6">
      {/* AEGIS scan progress */}
      {aegisProgress !== null && (
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">AEGIS scan progress</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-100 rounded-full h-2.5">
              <div className="bg-red-500 h-2.5 rounded-full transition-all" style={{ width: `${aegisProgress}%` }} />
            </div>
            <span className="text-sm tabular-nums text-gray-500">
              {aegisBatchRow.value.toFixed(0)} / 519 keywords ({aegisProgress}%)
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Full scan completes in ~10 runs (every 2h)</p>
        </div>
      )}

      {/* HERALD baselines */}
      <div>
        <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">HERALD — Competitor Baselines</p>
        {heraldBaselines.filter(b => b.metric !== 'batch_offset').length === 0 ? (
          <p className="text-sm text-gray-400">No baselines yet — HERALD runs daily at 08:00 UTC</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b">
                  <th className="pb-2 pr-4">Metric</th>
                  <th className="pb-2 pr-4">Window</th>
                  <th className="pb-2 pr-4 text-right">Value</th>
                  <th className="pb-2">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {heraldBaselines.filter(b => b.metric !== 'batch_offset').map((b, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-700">{b.metric}</td>
                    <td className="py-2 pr-4 text-gray-400 text-xs">{b.window}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{Number(b.value).toFixed(2)}</td>
                    <td className="py-2 text-xs text-gray-400">{fmt(b.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function TrademarkDashboard() {
  const [tab, setTab] = useState('alerts');

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Trademark Monitoring</h1>
            <p className="text-sm text-gray-400 mt-0.5">AEGIS · SCOUT · HERALD · ORACLE</p>
          </div>
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">← Back</a>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-xl border p-6">
          {tab === 'alerts'    && <AlertsTab />}
          {tab === 'keywords'  && <KeywordsTab />}
          {tab === 'baselines' && <BaselinesTab />}
        </div>
      </div>
    </div>
  );
}
