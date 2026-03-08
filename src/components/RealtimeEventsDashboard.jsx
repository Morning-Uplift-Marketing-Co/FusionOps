import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

const EVENT_COLORS = {
  pv: "bg-blue-500/15 text-blue-300",
  form_start: "bg-amber-500/15 text-amber-300",
  form_submit: "bg-red-500/15 text-red-300",
  sold_lead: "bg-emerald-500/15 text-emerald-300",
  default: "bg-slate-500/15 text-slate-300",
};

function normalizeRows(rows = []) {
  return rows
    .map((r) => {
      const tsValue = Number(r.ts || r.timestamp || 0);
      return {
        id: r.id || `${r.domain || "unknown"}-${r.event || "unknown"}-${tsValue}`,
        domain: String(r.domain || ""),
        event: String(r.event || "unknown"),
        ts: tsValue,
        gclid: String(r.gclid || ""),
        clickId: String(r.click_id || r.clickId || ""),
        data: String(r.data || r.details || ""),
      };
    })
    .sort((a, b) => b.ts - a.ts);
}

function prettyTs(ts) {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString();
}

export function RealtimeEventsDashboard({ sites = [] }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [windowMinutes, setWindowMinutes] = useState(15);
  const [pollSeconds, setPollSeconds] = useState(3);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const domainOptions = useMemo(() => {
    const fromSites = (sites || []).map((s) => s.domain).filter(Boolean);
    const fromEvents = events.map((e) => e.domain).filter(Boolean);
    return Array.from(new Set([...fromSites, ...fromEvents])).sort((a, b) => a.localeCompare(b));
  }, [sites, events]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    const since = Math.floor(Date.now() / 1000) - Math.max(1, Number(windowMinutes || 15)) * 60;
    const params = new URLSearchParams({
      limit: "400",
      since: String(since),
    });
    if (selectedDomain) params.set("domain", selectedDomain);

    try {
      const res = await api.get(`/api/pixel/events?${params.toString()}`);
      if (res?.error) {
        setError(res.error || "Failed to load events");
        return;
      }
      if (!res?.success) {
        setError(res?.error || "Unexpected response from events API");
        return;
      }

      const rows = normalizeRows(res.events || []);
      setEvents(rows);
      setLastUpdatedAt(new Date());
    } catch (e) {
      setError(e?.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [selectedDomain, windowMinutes]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (paused) return;
    const intervalMs = Math.max(1, Number(pollSeconds || 3)) * 1000;
    const id = setInterval(fetchEvents, intervalMs);
    return () => clearInterval(id);
  }, [fetchEvents, paused, pollSeconds]);

  const stats = useMemo(() => {
    const byEvent = events.reduce((acc, row) => {
      acc[row.event] = (acc[row.event] || 0) + 1;
      return acc;
    }, {});

    return {
      total: events.length,
      pv: byEvent.pv || 0,
      formStart: byEvent.form_start || 0,
      formSubmit: byEvent.form_submit || 0,
      soldLead: byEvent.sold_lead || 0,
      byEvent,
    };
  }, [events]);

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-4 text-[hsl(var(--foreground))]">
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-xl font-bold">⚡ Realtime Events Dashboard</h2>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            {lastUpdatedAt ? `Last update: ${lastUpdatedAt.toLocaleTimeString()}` : "Waiting for first fetch..."}
          </div>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Live polling from <code className="text-[11px]">/api/pixel/events</code> for first-party tracking events.
        </p>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <div className="grid md:grid-cols-4 gap-3">
          <label className="text-xs space-y-1">
            <span className="block text-[hsl(var(--muted-foreground))]">Domain Filter</span>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2"
            >
              <option value="">All domains</option>
              {domainOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>

          <label className="text-xs space-y-1">
            <span className="block text-[hsl(var(--muted-foreground))]">Time Window (minutes)</span>
            <input
              type="number"
              min={1}
              max={1440}
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(Number(e.target.value) || 15)}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2"
            />
          </label>

          <label className="text-xs space-y-1">
            <span className="block text-[hsl(var(--muted-foreground))]">Poll Interval (sec)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={pollSeconds}
              onChange={(e) => setPollSeconds(Number(e.target.value) || 3)}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2"
            />
          </label>

          <div className="text-xs flex items-end gap-2">
            <button
              type="button"
              onClick={fetchEvents}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-[hsl(var(--primary))] text-white font-semibold disabled:opacity-40"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              className="px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-transparent font-semibold"
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={() => setEvents([])}
              className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 font-semibold hover:bg-red-500/20"
            >
              Clear Log
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-5 gap-3">
        <StatCard label="Events" value={stats.total} />
        <StatCard label="Page Views (pv)" value={stats.pv} />
        <StatCard label="Form Start" value={stats.formStart} />
        <StatCard label="Form Submit" value={stats.formSubmit} />
        <StatCard label="Sold Lead" value={stats.soldLead} />
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        <div className="px-4 py-3 border-b border-[hsl(var(--border))] text-sm font-semibold">Recent Events</div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))]">
              <tr className="text-left text-[hsl(var(--muted-foreground))]">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Domain</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Click ID</th>
                <th className="px-3 py-2">GCLID</th>
                <th className="px-3 py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">
                    No events found for selected filters.
                  </td>
                </tr>
              ) : (
                events.map((row) => {
                  const chip = EVENT_COLORS[row.event] || EVENT_COLORS.default;
                  return (
                    <tr key={row.id} className="border-b border-[hsl(var(--border))/0.6]">
                      <td className="px-3 py-2 whitespace-nowrap">{prettyTs(row.ts)}</td>
                      <td className="px-3 py-2">{row.domain || "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${chip}`}>{row.event}</span>
                      </td>
                      <td className="px-3 py-2 font-mono">{row.clickId || "-"}</td>
                      <td className="px-3 py-2 font-mono">{row.gclid || "-"}</td>
                      <td className="px-3 py-2 max-w-[420px] truncate" title={row.data || ""}>{row.data || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default RealtimeEventsDashboard;
