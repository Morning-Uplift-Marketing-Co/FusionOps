import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

const EVENT_COLORS = {
  pv: "bg-blue-500/15 text-blue-300",
  form_start: "bg-amber-500/15 text-amber-300",
  form_submit: "bg-red-500/15 text-red-300",
  sold_lead: "bg-emerald-500/15 text-emerald-300",
  lg_form_load: "bg-amber-500/15 text-amber-300",
  lg_form_ready: "bg-amber-500/15 text-amber-300",
  lg_step: "bg-sky-500/15 text-sky-300",
  lg_submit: "bg-red-500/15 text-red-300",
  lg_success: "bg-emerald-500/15 text-emerald-300",
  lg_success_all: "bg-emerald-500/15 text-emerald-300",
  default: "bg-slate-500/15 text-slate-300",
};

/** Map LeadsGate / legacy pixel names into funnel buckets for summary cards. */
function pixelEventFunnelBucket(event) {
  const e = String(event || "").trim().toLowerCase();
  if (["form_start", "fl", "lg_form_load", "lg_form_ready"].includes(e)) return "form_start";
  if (["form_submit", "fs", "lg_submit"].includes(e)) return "form_submit";
  if (["sold_lead", "success", "lg_success", "lg_success_all"].includes(e)) return "sold_lead";
  return null;
}

function normalizeTs(value) {
  if (value === null || value === undefined || value === "") return 0;

  const n = Number(value);
  if (Number.isFinite(n) && n > 0) {
    if (n > 1e15) return Math.floor(n / 1e6);
    if (n > 1e12) return Math.floor(n / 1e3);
    return Math.floor(n);
  }

  const parsed = Date.parse(String(value));
  if (!Number.isNaN(parsed) && parsed > 0) {
    return Math.floor(parsed / 1000);
  }

  return 0;
}

function normalizeRows(rows = []) {
  return rows
    .map((r) => {
      const tsValue = normalizeTs(r.ts ?? r.timestamp ?? r.created_at ?? 0);
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

function normalizePostbackRows(rows = []) {
  return (rows || [])
    .map((r) => {
      const tsValue = normalizeTs(r.ts ?? 0);
      return {
        id: String(r.id || `pb-${r.domain || "x"}-${tsValue}`),
        domain: String(r.domain || ""),
        clickId: String(r.click_id || ""),
        leadId: String(r.lead_id || ""),
        payout: Number(r.payout || 0),
        type: String(r.type || ""),
        ts: tsValue,
        voluumDomain: r.voluum_domain != null ? String(r.voluum_domain) : "",
        forwardStatus: r.forward_status != null ? String(r.forward_status) : "",
        forwardHttp: r.forward_http_status != null && r.forward_http_status !== "" ? Number(r.forward_http_status) : null,
        forwardError: r.forward_error != null ? String(r.forward_error).slice(0, 240) : "",
      };
    })
    .sort((a, b) => b.ts - a.ts);
}

const FORWARD_STATUS_COLORS = {
  ok: "bg-emerald-500/15 text-emerald-300",
  skipped: "bg-slate-500/15 text-slate-300",
  pending: "bg-amber-500/15 text-amber-300",
  http_error: "bg-orange-500/15 text-orange-300",
  error: "bg-red-500/15 text-red-300",
  bad_host: "bg-red-500/15 text-red-200",
  default: "bg-slate-500/15 text-slate-300",
};

function prettyTs(ts) {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString();
}

export function RealtimeEventsDashboard({ sites = [], embedded = false }) {
  const [view, setView] = useState("pixel");
  const [events, setEvents] = useState([]);
  const [postbacks, setPostbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [postbackError, setPostbackError] = useState("");
  const [paused, setPaused] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [windowMinutes, setWindowMinutes] = useState(15);
  const [pollSeconds, setPollSeconds] = useState(3);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [crawlerHealth, setCrawlerHealth] = useState(null);
  const [crawlerError, setCrawlerError] = useState("");

  const domainOptions = useMemo(() => {
    const fromSites = (sites || []).map((s) => s.domain).filter(Boolean);
    const fromEvents = events.map((e) => e.domain).filter(Boolean);
    const fromPb = postbacks.map((p) => p.domain).filter(Boolean);
    return Array.from(new Set([...fromSites, ...fromEvents, ...fromPb])).sort((a, b) => a.localeCompare(b));
  }, [sites, events, postbacks]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    setPostbackError("");
    setCrawlerError("");
    const since = Math.floor(Date.now() / 1000) - Math.max(1, Number(windowMinutes || 15)) * 60;
    const pixelParams = new URLSearchParams({ limit: "400", since: String(since) });
    if (selectedDomain) pixelParams.set("domain", selectedDomain);
    const pbParams = new URLSearchParams({ limit: "300", since: String(since) });
    if (selectedDomain) pbParams.set("domain", selectedDomain);

    try {
      const res = await api.get(`/api/pixel/events?${pixelParams.toString()}`);
      if (res?.error) setError(res.error || "Failed to load pixel events");
      else if (!res?.success) setError(res?.error || "Unexpected response from /api/pixel/events");
      else setEvents(normalizeRows(res.events || []));
    } catch (e) {
      setError(e?.message || "Failed to load pixel events");
    }

    try {
      const chParams = new URLSearchParams({ since: String(since) });
      if (selectedDomain) chParams.set("domain", selectedDomain);
      const ch = await api.get(`/api/pixel/crawler-health?${chParams.toString()}`);
      if (ch?.error) setCrawlerError(ch.error || "Failed to load crawler health");
      else if (!ch?.success) setCrawlerError(ch?.error || "Unexpected response from /api/pixel/crawler-health");
      else setCrawlerHealth(ch);
    } catch (e) {
      setCrawlerError(e?.message || "Failed to load crawler health");
      setCrawlerHealth(null);
    }

    try {
      const pb = await api.get(`/api/postbacks?${pbParams.toString()}`);
      if (pb?.error) setPostbackError(pb.error || "Failed to load postbacks");
      else if (!pb?.success) setPostbackError(pb?.error || "Unexpected response from /api/postbacks");
      else setPostbacks(normalizePostbackRows(pb.postbacks || []));
    } catch (e) {
      setPostbackError(e?.message || "Failed to load postbacks");
    }

    setLastUpdatedAt(new Date());
    setLoading(false);
  }, [selectedDomain, windowMinutes]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (paused) return;
    const intervalMs = Math.max(1, Number(pollSeconds || 3)) * 1000;
    const id = setInterval(refreshAll, intervalMs);
    return () => clearInterval(id);
  }, [refreshAll, paused, pollSeconds]);

  const stats = useMemo(() => {
    const byEvent = events.reduce((acc, row) => {
      acc[row.event] = (acc[row.event] || 0) + 1;
      return acc;
    }, {});

    let formStart = 0;
    let formSubmit = 0;
    let soldLead = 0;
    for (const row of events) {
      const b = pixelEventFunnelBucket(row.event);
      if (b === "form_start") formStart += 1;
      else if (b === "form_submit") formSubmit += 1;
      else if (b === "sold_lead") soldLead += 1;
    }

    return {
      total: events.length,
      pv: byEvent.pv || 0,
      formStart,
      formSubmit,
      soldLead,
      byEvent,
    };
  }, [events]);

  const postbackStats = useMemo(() => {
    let revenue = 0;
    let sold = 0;
    let forwardOk = 0;
    let forwardIssues = 0;
    for (const row of postbacks) {
      const t = String(row.type || "").toLowerCase();
      if (t === "soldlead" || t === "sold_lead") {
        sold += 1;
        revenue += Number(row.payout || 0);
      }
      const fs = String(row.forwardStatus || "");
      if (fs === "ok") forwardOk += 1;
      else if (["http_error", "error", "bad_host"].includes(fs)) forwardIssues += 1;
    }
    return {
      total: postbacks.length,
      sold,
      revenue,
      forwardOk,
      forwardIssues,
    };
  }, [postbacks]);

  const outerClass = embedded
    ? "max-w-[1400px] mx-auto py-2 space-y-3 text-[hsl(var(--foreground))]"
    : "max-w-[1400px] mx-auto p-6 space-y-4 text-[hsl(var(--foreground))]";

  return (
    <div className={outerClass}>
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className={embedded ? "text-lg font-bold" : "text-xl font-bold"}>
            {embedded ? "⚡ Live pixel events" : "⚡ Realtime Events Dashboard"}
          </h2>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            {lastUpdatedAt ? `Last update: ${lastUpdatedAt.toLocaleTimeString()}` : "Waiting for first fetch..."}
          </div>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Polling <code className="text-[11px]">/api/pixel/events</code> (first-party pixel) and{" "}
          <code className="text-[11px]">/api/postbacks</code> (Voluum relay <code className="text-[11px]">/v</code>) together.
          {embedded ? " Same view as sidebar → Realtime Events." : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("pixel")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
            view === "pixel"
              ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
              : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]"
          }`}
        >
          First-party pixel
        </button>
        <button
          type="button"
          onClick={() => setView("postbacks")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
            view === "postbacks"
              ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
              : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]"
          }`}
        >
          Voluum postbacks (/v)
        </button>
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
              onClick={refreshAll}
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
              onClick={() => (view === "pixel" ? setEvents([]) : setPostbacks([]))}
              className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 font-semibold hover:bg-red-500/20"
            >
              Clear log
            </button>
          </div>
        </div>

        {(error || postbackError || crawlerError) && (
          <div className="mt-3 space-y-2">
            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                Pixel: {error}
              </div>
            )}
            {crawlerError && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Crawler UA summary: {crawlerError}
              </div>
            )}
            {postbackError && (
              <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
                Postbacks: {postbackError}
              </div>
            )}
          </div>
        )}
      </div>

      {view === "pixel" ? (
        <>
          <div className="grid md:grid-cols-5 gap-3">
            <StatCard label="Events" value={stats.total} />
            <StatCard label="Page Views (pv)" value={stats.pv} />
            <StatCard label="Form Start" value={stats.formStart} />
            <StatCard label="Form Submit" value={stats.formSubmit} />
            <StatCard label="Sold Lead" value={stats.soldLead} />
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 space-y-2">
            <div className="text-sm font-semibold">Google crawler–like hits (pixel User-Agent)</div>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
              {crawlerHealth?.disclaimer ||
                "Counts User-Agent on hits to the first-party pixel endpoint only. HTML-only fetches may not execute the pixel."}
            </p>
            {crawlerHealth?.buckets ? (
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <StatCard
                  label="AdsBot-Google"
                  value={crawlerHealth.buckets.adsbot_google ?? 0}
                />
                <StatCard
                  label="Mediapartners-Google"
                  value={crawlerHealth.buckets.mediapartners_google ?? 0}
                />
                <StatCard
                  label="Google Ads–related UA"
                  value={crawlerHealth.buckets.google_ads_related_ua_hits ?? 0}
                />
                <StatCard
                  label="Googlebot (non-AdsBot)"
                  value={crawlerHealth.buckets.googlebot ?? 0}
                />
              </div>
            ) : (
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                No crawler bucket data yet (see disclaimer above or deploy latest API Worker).
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="grid md:grid-cols-5 gap-3">
          <StatCard label="Postbacks" value={postbackStats.total} />
          <StatCard label="Sold (type)" value={postbackStats.sold} />
          <StatCard label="Revenue (payout)" value={`$${postbackStats.revenue.toFixed(2)}`} />
          <StatCard label="Relay OK" value={postbackStats.forwardOk} />
          <StatCard label="Relay errors" value={postbackStats.forwardIssues} />
        </div>
      )}

      {view === "pixel" ? (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))] text-sm font-semibold">Recent pixel events</div>
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
      ) : (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))] text-sm font-semibold">Recent Voluum postbacks</div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))]">
                <tr className="text-left text-[hsl(var(--muted-foreground))]">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Domain</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Click ID</th>
                  <th className="px-3 py-2">Lead ID</th>
                  <th className="px-3 py-2">Payout</th>
                  <th className="px-3 py-2">Voluum host</th>
                  <th className="px-3 py-2">Relay</th>
                  <th className="px-3 py-2">HTTP</th>
                </tr>
              </thead>
              <tbody>
                {postbacks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">
                      No postbacks in this window. Set LeadsGate postback to your Worker route, e.g.{" "}
                      <code className="text-[11px]">https://t.example.com/v?vd=...</code>
                    </td>
                  </tr>
                ) : (
                  postbacks.map((row) => {
                    const fchip = FORWARD_STATUS_COLORS[row.forwardStatus] || FORWARD_STATUS_COLORS.default;
                    return (
                      <tr key={row.id} className="border-b border-[hsl(var(--border))/0.6]">
                        <td className="px-3 py-2 whitespace-nowrap">{prettyTs(row.ts)}</td>
                        <td className="px-3 py-2">{row.domain || "-"}</td>
                        <td className="px-3 py-2 font-mono">{row.type || "-"}</td>
                        <td className="px-3 py-2 font-mono max-w-[100px] truncate" title={row.clickId}>{row.clickId || "-"}</td>
                        <td className="px-3 py-2 font-mono max-w-[100px] truncate" title={row.leadId}>{row.leadId || "-"}</td>
                        <td className="px-3 py-2">{Number.isFinite(row.payout) ? row.payout.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 max-w-[120px] truncate" title={row.voluumDomain}>{row.voluumDomain || "-"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${fchip}`} title={row.forwardError || ""}>
                            {row.forwardStatus || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono">{row.forwardHttp != null ? String(row.forwardHttp) : "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
