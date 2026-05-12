import React, { useState, useEffect } from 'react';
import { AgentKPICard } from './AgentKPICard.jsx';

const API = import.meta.env.PUBLIC_API_BASE || 'https://lp-factory-api.misty-feather-556e.workers.dev';

const VERDICT_COLORS = {
  healthy:  'bg-green-100 text-green-800',
  watch:    'bg-yellow-100 text-yellow-800',
  risk:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const LIFECYCLE_COLORS = {
  new:       'bg-gray-100 text-gray-600',
  warming:   'bg-blue-100 text-blue-700',
  active:    'bg-green-100 text-green-700',
  resting:   'bg-teal-100 text-teal-700',
  suspended: 'bg-orange-100 text-orange-700',
  retired:   'bg-red-100 text-red-600',
};

const FATIGUE_COLORS = {
  healthy:  'text-green-600',
  watch:    'text-yellow-600',
  fatigued: 'text-orange-500',
  retired:  'text-red-600',
};

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
      <div className="text-xs uppercase mt-1 tracking-wide">{label}</div>
    </div>
  );
}

export default function RiskDashboard() {
  const [riskAccounts, setRiskAccounts]       = useState([]);
  const [lifecycleAccounts, setLifecycleAccounts] = useState([]);
  const [pauseEvents, setPauseEvents]         = useState([]);
  const [fatigued, setFatigued]               = useState([]);
  const [tab, setTab]                         = useState('risk');
  const [loading, setLoading]                 = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/analysis/accounts`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API}/api/lifecycle/accounts`).then(r => r.json()).catch(() => ({ accounts: [] })),
    ]).then(([risk, lc]) => {
      setRiskAccounts(risk.data || []);
      setLifecycleAccounts(lc.accounts || []);
      setLoading(false);
    });
  }, []);

  // Load pause events + fatigued creatives when lifecycle tab active
  useEffect(() => {
    if (tab !== 'lifecycle') return;
    lifecycleAccounts.slice(0, 10).forEach(acc => {
      fetch(`${API}/api/lifecycle/pause-history/${acc.id}`)
        .then(r => r.json())
        .then(d => setPauseEvents(prev => [...prev, ...(d.events || [])]))
        .catch(() => {});
      fetch(`${API}/api/lifecycle/creative/${acc.id}?min_score=60`)
        .then(r => r.json())
        .then(d => setFatigued(prev => [...prev, ...(d.creatives || [])]))
        .catch(() => {});
    });
  }, [tab, lifecycleAccounts]);

  if (loading) return <p className="p-8 text-gray-400">Loading dashboard...</p>;

  // ── Risk summary counts ───────────────────────────────────────────────
  const riskCounts = riskAccounts.reduce((acc, s) => {
    acc[s.verdict_status] = (acc[s.verdict_status] || 0) + 1;
    return acc;
  }, {});

  // ── Lifecycle summary counts ──────────────────────────────────────────
  const lcCounts = lifecycleAccounts.reduce((acc, s) => {
    const st = s.lifecycle_state || 'new';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  const TABS = [
    { id: 'risk',      label: '🛡 Risk Scores' },
    { id: 'lifecycle', label: '🔄 Lifecycle' },
    { id: 'kpi',       label: '📊 Agent KPIs' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Google Ads OS — Control Room</h1>
        <span className="text-xs text-gray-400">
          {riskAccounts.length} risk accounts · {lifecycleAccounts.length} lifecycle accounts
        </span>
      </div>

      {/* ── Top summary row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
        <StatCard value={riskCounts.healthy  || 0} label="healthy"   colorClass="bg-green-100 text-green-800" />
        <StatCard value={riskCounts.watch    || 0} label="watch"     colorClass="bg-yellow-100 text-yellow-800" />
        <StatCard value={riskCounts.risk     || 0} label="risk"      colorClass="bg-orange-100 text-orange-700" />
        <StatCard value={riskCounts.critical || 0} label="critical"  colorClass="bg-red-100 text-red-700" />
        <StatCard value={lcCounts.warming   || 0} label="warming"   colorClass="bg-blue-100 text-blue-700" />
        <StatCard value={lcCounts.active    || 0} label="active"    colorClass="bg-green-100 text-green-700" />
        <StatCard value={lcCounts.suspended || 0} label="suspended" colorClass="bg-orange-100 text-orange-700" />
        <StatCard value={lcCounts.retired   || 0} label="retired"   colorClass="bg-red-100 text-red-600" />
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Risk Scores tab ───────────────────────────────────────────── */}
      {tab === 'risk' && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                {['Account', 'Domain', 'Score', 'Verdict', 'Proxy', 'Isolation', 'Traffic', 'Timeline'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {riskAccounts.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No risk data yet</td></tr>
              )}
              {riskAccounts.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{s.label || s.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{s.site_domain || '—'}</td>
                  <td className="px-4 py-3 font-bold">{s.verdict_score ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge label={s.verdict_status || 'unscored'} colorClass={VERDICT_COLORS[s.verdict_status] || 'bg-gray-100 text-gray-500'} />
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
      )}

      {/* ── Lifecycle tab ─────────────────────────────────────────────── */}
      {tab === 'lifecycle' && (
        <div className="space-y-6">

          {/* Accounts lifecycle state table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  {['Account', 'State', 'Day', 'Daily Cap', 'Risk', 'Safe Days', 'Updated'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lifecycleAccounts.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No lifecycle accounts</td></tr>
                )}
                {lifecycleAccounts.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{a.label || a.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={a.lifecycle_state || 'new'}
                        colorClass={LIFECYCLE_COLORS[a.lifecycle_state] || LIFECYCLE_COLORS.new}
                      />
                    </td>
                    <td className="px-4 py-3">{a.warming_day ?? 0}</td>
                    <td className="px-4 py-3">${a.daily_spend_cap?.toLocaleString() ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={a.last_risk_score >= 60 ? 'text-red-600 font-bold' : 'text-gray-700'}>
                        {a.last_risk_score ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">{a.consecutive_safe_days ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {a.lifecycle_updated_at
                        ? new Date(a.lifecycle_updated_at * 1000).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fatigued creatives */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-sm">🎨 Creative Fatigue (score ≥ 60)</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {fatigued.length === 0
                  ? <p className="px-4 py-6 text-gray-400 text-sm text-center">No fatigued creatives</p>
                  : fatigued.slice(0, 8).map(c => (
                    <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-mono text-gray-600">{c.ad_id}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{c.headline || '(no headline)'}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${FATIGUE_COLORS[c.fatigue_status] || 'text-gray-600'}`}>
                          {c.fatigue_score}
                        </p>
                        <p className={`text-xs ${FATIGUE_COLORS[c.fatigue_status] || 'text-gray-400'}`}>
                          {c.fatigue_status}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Recent pause events */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-sm">⏸ Recent Auto-Pause Events</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {pauseEvents.length === 0
                  ? <p className="px-4 py-6 text-gray-400 text-sm text-center">No pause events</p>
                  : pauseEvents.slice(0, 8).map(e => (
                    <div key={e.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">{e.rule_name}</span>
                        <Badge
                          label={e.action_taken}
                          colorClass={e.action_taken === 'pause' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{e.notes} · val={e.trigger_value}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Agent KPI tab ─────────────────────────────────────────────── */}
      {tab === 'kpi' && (
        <AgentKPIPanel accounts={riskAccounts} />
      )}
    </div>
  );
}

function AgentKPIPanel({ accounts }) {
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/analysis/agent-kpis`)
      .then(r => r.json())
      .then(d => { setKpis(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400 py-8">Loading KPIs...</p>;

  const agents = ['argus', 'nexus', 'iris', 'chrono', 'verdict'];
  const byAgent = agents.reduce((m, a) => {
    m[a] = kpis.filter(k => k.agent_name === a);
    return m;
  }, {});

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {agents.map(agent => (
        <AgentKPICard key={agent} agent={agent} kpis={byAgent[agent]} />
      ))}
    </div>
  );
}
