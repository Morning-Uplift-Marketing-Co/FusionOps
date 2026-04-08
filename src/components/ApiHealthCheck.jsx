/**
 * ApiHealthCheck — Full Endpoint Health Monitor
 * Mirrors the API Docs design: grouped endpoints, method badges,
 * per-endpoint test, response viewer, Test All Endpoints.
 *
 * V3-1.4 — AI group includes generate-reviews; shared aiHealthBody() for key merge
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import { api } from "../services/api";
import { LS } from "../utils";

/** Shared POST body for AI health checks — same keys as Wizard (avoids duplicating gemini/anthropic fields). */
function aiHealthBody(extra = {}) {
  const s = LS.get("settings") || {};
  return {
    brand: "HealthCheck",
    loanType: "installment",
    amountMin: 100,
    amountMax: 5000,
    geminiKey: s.geminiKey || "",
    anthropicKey: s.anthropicKey || "",
    ...extra,
  };
}

// ─── resolve API base for display ───
function getApiBase() {
  const fromEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_API_BASE : "";
  return String(fromEnv || "https://lp-factory-api.misty-feather-556e.workers.dev/api").replace(/\/+$/, "");
}

// ═══════════════════════════════════════
// ENDPOINT DEFINITIONS (grouped)
// ═══════════════════════════════════════
const ENDPOINT_GROUPS = [
  {
    id: "core",
    name: "Core Data",
    icon: "🗄️",
    endpoints: [
      { id: "init", method: "GET", name: "Init (Bootstrap)", path: "/init", badge: "critical" },
      { id: "settings-get", method: "GET", name: "Settings GET", path: "/settings" },
      { id: "sites-get", method: "GET", name: "Sites", path: "/sites" },
      { id: "deploys-get", method: "GET", name: "Deploys", path: "/deploys" },
      { id: "variants-get", method: "GET", name: "Variants", path: "/variants" },
      { id: "templates-get", method: "GET", name: "Templates", path: "/templates" },
      { id: "stats", method: "GET", name: "Stats", path: "/stats" },
    ],
  },
  {
    id: "ops",
    name: "Ops Center",
    icon: "🏢",
    endpoints: [
      { id: "ops-accounts", method: "GET", name: "Accounts", path: "/ops/accounts" },
      { id: "ops-profiles", method: "GET", name: "Profiles", path: "/ops/profiles" },
      { id: "ops-payments", method: "GET", name: "Payments", path: "/ops/payments" },
      { id: "ops-logs", method: "GET", name: "Logs", path: "/ops/logs" },
      { id: "ops-deployments", method: "GET", name: "Deployment History", path: "/ops/deployments" },
      { id: "ops-deploy-stats", method: "GET", name: "Deploy Stats", path: "/ops/deployments/stats" },
      { id: "ops-deploy-configs", method: "GET", name: "Deploy Configs", path: "/ops/deploy-configs" },
    ],
  },
  {
    id: "accounts",
    name: "Accounts & Config",
    icon: "🔧",
    endpoints: [
      { id: "cf-accounts", method: "GET", name: "CF Accounts", path: "/cf-accounts" },
      { id: "registrar-accounts", method: "GET", name: "Registrar Accounts", path: "/registrar-accounts" },
      { id: "openapi", method: "GET", name: "OpenAPI Spec", path: "/openapi.json" },
    ],
  },
  {
    id: "ai",
    name: "AI Generation",
    icon: "🤖",
    endpoints: [
      {
        id: "ai-copy", method: "POST", name: "Generate Copy", path: "/ai/generate-copy",
        getBody: () => aiHealthBody({ lang: "English" }),
      },
      {
        id: "ai-meta", method: "POST", name: "Generate Meta", path: "/ai/generate-meta",
        getBody: () => aiHealthBody(),
      },
      {
        id: "ai-reviews", method: "POST", name: "Generate Reviews", path: "/ai/generate-reviews",
        getBody: () => aiHealthBody(),
        checkSuccess: (res) => Array.isArray(res) && res.length > 0 && Boolean(res[0]?.text),
      },
      {
        id: "ai-assets", method: "POST", name: "Generate Assets", path: "/ai/generate-assets",
        body: { brand: "HealthCheck" },
      },
    ],
  },
  {
    id: "voluum",
    name: "Voluum",
    icon: "🎯",
    endpoints: [
      {
        id: "voluum-session", method: "POST", name: "Session (auth)", path: "/voluum/session",
        needsCreds: "voluum",
        getBody: () => {
          const s = LS.get("settings") || {};
          return { accessId: s.voluumAccessKeyId || "", accessKey: s.voluumAccessKey || "" };
        },
      },
      {
        id: "voluum-proxy", method: "POST", name: "Generic Proxy", path: "/voluum/proxy",
        needsCreds: "voluum",
        getBody: async () => {
          const s = LS.get("settings") || {};
          try {
            const sess = await api.post("/voluum/session", { accessId: s.voluumAccessKeyId, accessKey: s.voluumAccessKey });
            return { token: sess.token, method: "GET", path: "/campaign", body: null };
          } catch {
            return { token: "", method: "GET", path: "/campaign", body: null };
          }
        },
      },
    ],
  },
  {
    id: "lendingcard",
    name: "LendingCards",
    icon: "💳",
    endpoints: [
      { id: "lc-cards", method: "GET", name: "Cards List", path: "/lc/cards" },
      {
        id: "lc-billing", method: "POST", name: "Billing", path: "/lc/billing",
        body: { action: "list" },
      },
    ],
  },
  {
    id: "multilogin",
    name: "Multilogin",
    icon: "🌐",
    endpoints: [
      { id: "ml-profiles", method: "GET", name: "Profiles", path: "/ml/profiles" },
    ],
  },
  {
    id: "registrar",
    name: "Automation: Registrar",
    icon: "📋",
    endpoints: [
      { id: "reg-ip", method: "GET", name: "Worker IP", path: "/automation/registrar/ip" },
      {
        id: "reg-ping", method: "POST", name: "Ping", path: "/automation/registrar/ping",
        needsCreds: "registrar",
        getBody: () => {
          const s = LS.get("settings") || {};
          return { apiKey: s.ibsApiKey || "", password: s.ibsPassword || "" };
        },
      },
    ],
  },
  {
    id: "cf-auto",
    name: "Automation: Cloudflare",
    icon: "☁️",
    endpoints: [
      {
        id: "cf-validate", method: "POST", name: "Validate Token", path: "/automation/cf-validate",
        needsCreds: "cloudflare",
        getBody: () => {
          const s = LS.get("settings") || {};
          const profiles = Array.isArray(s.cfProfiles) ? s.cfProfiles : [];
          return { cfApiToken: profiles[0]?.apiToken || s.cfApiToken || "", cfAccountId: profiles[0]?.accountId || s.cfAccountId || "" };
        },
      },
    ],
  },
  {
    id: "d1",
    name: "Automation: D1",
    icon: "💾",
    endpoints: [
      { id: "d1-test", method: "GET", name: "D1 Connection Test", path: "/automation/d1/test" },
    ],
  },
  {
    id: "pixel",
    name: "Pixel",
    icon: "📡",
    endpoints: [
      { id: "pixel-events", method: "GET", name: "Pixel Events", path: "/api/pixel/events?limit=5&since=0" },
      { id: "pixel-crawler-health", method: "GET", name: "Pixel crawler UA (Google)", path: "/api/pixel/crawler-health?since=0" },
      { id: "postbacks", method: "GET", name: "Voluum postbacks", path: "/api/postbacks?limit=5&since=0" },
    ],
  },
  {
    id: "proxy-tools",
    name: "Proxy Tools (Worker)",
    icon: "🔌",
    endpoints: [
      {
        id: "proxy-resolve", method: "POST", name: "Resolve IP", path: "/proxy/resolve-ip",
        body: { host: "1.1.1.1", port: "80", username: "user", password: "pwd" }, // dummy to bypass 400 bad request and test 502/401
        checkSuccess: (res) => {
          if (res?.error && String(res.error).includes("NETWORK_ERROR")) return false;
          return true; // 407/502/401 mean the worker is alive
        }
      },
      {
        id: "proxy-dns", method: "POST", name: "DNS Check", path: "/proxy/dns-check",
        body: { host: "1.1.1.1", port: "80", username: "user", password: "pwd" },
        checkSuccess: (res) => res?.error && String(res.error).includes("NETWORK_ERROR") ? false : true,
      },
      {
        id: "proxy-latency", method: "POST", name: "Latency Check", path: "/proxy/latency-check",
        body: { host: "1.1.1.1", port: "80", username: "user", password: "pwd" },
        checkSuccess: (res) => res?.error && String(res.error).includes("NETWORK_ERROR") ? false : true,
      },
    ],
  },
  {
    id: "ip-quality",
    name: "IP Quality Pipeline (External)",
    icon: "🛡️",
    endpoints: [
      {
        id: "ip-api", method: "GET", name: "IP-API (Geolocation)", path: "http://ip-api.com/json/8.8.8.8", isExternal: true,
        checkSuccess: (res, fetchRes) => res && res.status !== "fail" && fetchRes.ok
      },
      {
        id: "ipinfo", method: "GET", name: "IPinfo (ASN)", path: "https://ipinfo.io/8.8.8.8/json", isExternal: true,
        getUrl: () => {
          const s = LS.get("settings") || {};
          const t = s.ipinfoToken?.trim();
          if (t && t.toLowerCase().startsWith('bearer ')) {
            return "https://api.ipinfo.io/lite/8.8.8.8";
          }
          return t ? `https://ipinfo.io/8.8.8.8?token=${t}` : "https://ipinfo.io/8.8.8.8/json";
        },
        getHeaders: () => {
          const s = LS.get("settings") || {};
          const t = s.ipinfoToken?.trim();
          if (t && t.toLowerCase().startsWith('bearer ')) {
            return { "Authorization": t };
          }
          return {};
        },
        checkSuccess: (res, fetchRes) => fetchRes.ok
      },
      {
        id: "scamalytics", method: "GET", name: "Scamalytics (Fraud)", path: "https://api11.scamalytics.com/ip/8.8.8.8", isExternal: true,
        getUrl: () => {
          const s = LS.get("settings") || {};
          const key = s.scamalyticsKey?.trim();
          const user = s.scamalyticsUsername?.trim();
          if (!key) return "https://api11.scamalytics.com/ip/8.8.8.8";
          if (user) return `https://api11.scamalytics.com/v3/${user}/?key=${key}&ip=8.8.8.8`;
          return `https://api11.scamalytics.com/ip/8.8.8.8?key=${key}`;
        },
        checkSuccess: (res, fetchRes) => fetchRes.ok || fetchRes.status === 403 || fetchRes.status === 401
      },
      {
        id: "ip2location", method: "GET", name: "IP2Location (Proxy/VPN)", path: "https://api.ip2location.io/?ip=8.8.8.8", isExternal: true,
        getUrl: () => {
          const s = LS.get("settings") || {};
          const key = s.ip2LocationKey?.trim();
          return key ? `https://api.ip2location.io/?ip=8.8.8.8&key=${key}` : "https://api.ip2location.io/?ip=8.8.8.8";
        },
        checkSuccess: (res, fetchRes) => fetchRes.ok || fetchRes.status === 401 || fetchRes.status === 400
      },
      {
        id: "ipqs", method: "GET", name: "IPQualityScore (Fallback)", path: "https://www.ipqualityscore.com/api/json/ip/key/8.8.8.8", isExternal: true,
        getUrl: () => {
          const s = LS.get("settings") || {};
          const key = s.ipqsKey?.trim();
          return key ? `https://www.ipqualityscore.com/api/json/ip/${key}/8.8.8.8` : "https://www.ipqualityscore.com/api/json/ip/MISSING_KEY/8.8.8.8";
        },
        checkSuccess: (res, fetchRes) => res && res.success !== undefined ? true : false
      }
    ],
  },
];

// ─── Flatten for counting ───
function getAllEndpoints() {
  return ENDPOINT_GROUPS.flatMap((g) => g.endpoints);
}

// ═══════════════════════════════════════
// Method Badge
// ═══════════════════════════════════════
const METHOD_COLORS = {
  GET: { bg: "rgba(16,185,129,0.15)", text: "#10b981", border: "rgba(16,185,129,0.3)" },
  POST: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  PUT: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6", border: "rgba(59,130,246,0.3)" },
  DELETE: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", border: "rgba(239,68,68,0.3)" },
};

function MethodBadge({ method }) {
  const c = METHOD_COLORS[method] || METHOD_COLORS.GET;
  return (
    <span
      className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider leading-none"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, minWidth: 36 }}
    >
      {method}
    </span>
  );
}

// ═══════════════════════════════════════
// Status indicator
// ═══════════════════════════════════════
function StatusIndicator({ result }) {
  if (!result) return <span className="text-[hsl(var(--muted-foreground))]/40 text-[10px]">—</span>;
  if (result.checking) return <span className="text-blue-400 text-[10px] animate-pulse">⏳</span>;

  const ok = result.ok;
  const ms = result.ms;

  return (
    <div className="flex items-center gap-1.5">
      {ms != null && ms > 0 && (
        <span
          className="text-[10px] font-mono tabular-nums"
          style={{ color: ms <= 300 ? "#10b981" : ms <= 800 ? "#f59e0b" : "#ef4444" }}
        >
          {ms}ms
        </span>
      )}
      <span
        className={cn("inline-block w-2 h-2 rounded-full", ok ? "bg-emerald-500" : "bg-red-500")}
        style={{ boxShadow: ok ? "0 0 6px rgba(16,185,129,0.4)" : "0 0 6px rgba(239,68,68,0.4)" }}
      />
    </div>
  );
}

// ═══════════════════════════════════════
// Endpoint Row
// ═══════════════════════════════════════
function EndpointRow({ ep, result, onTest, onToggle, expanded }) {
  return (
    <div className="border-b border-[hsl(var(--border))]/40 last:border-0">
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted))]/15 transition-colors cursor-pointer group"
        onClick={() => result && !result.checking && onToggle(ep.id)}
      >
        <MethodBadge method={ep.method} />

        <span className="text-[12px] font-medium flex-1">
          {ep.name}
          {ep.badge === "critical" && (
            <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 uppercase font-bold tracking-wider">
              critical
            </span>
          )}
        </span>

        {/* Status */}
        <div className="w-20 flex justify-end">
          <StatusIndicator result={result} />
        </div>

        {/* Test button */}
        <button
          onClick={(e) => { e.stopPropagation(); onTest(ep); }}
          disabled={result?.checking}
          className="px-2 py-1 text-[9px] font-medium rounded border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] disabled:opacity-40 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          ▶
        </button>
      </div>

      {/* Expanded response viewer */}
      {expanded && result && !result.checking && (
        <div className="px-4 pb-3 ml-12">
          <div className="rounded-lg border border-[hsl(var(--border))]/50 bg-[hsl(var(--card))]/80 overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/20">
              <div className="flex items-center gap-2">
                <span className={cn("w-1.5 h-1.5 rounded-full", result.ok ? "bg-emerald-500" : "bg-red-500")} />
                <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                  {result.ok ? "200 OK" : "Error"} — {result.ms || 0}ms
                </span>
              </div>
              <span className="text-[9px] text-[hsl(var(--muted-foreground))]/60 font-mono">
                {ep.method} {ep.path}
              </span>
            </div>

            {/* Response body */}
            <pre className="p-3 text-[10px] font-mono leading-relaxed text-[hsl(var(--muted-foreground))] max-h-48 overflow-auto whitespace-pre-wrap break-all">
              {result.responseText || result.detail || "No response data"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Group Card
// ═══════════════════════════════════════
function GroupCard({ group, results, onTest, expandedEps, toggleEp, collapsed, toggleCollapse }) {
  const total = group.endpoints.length;
  const tested = group.endpoints.filter((ep) => results[ep.id] && !results[ep.id].checking);
  const ok = tested.filter((ep) => results[ep.id]?.ok).length;
  const errors = tested.filter((ep) => results[ep.id] && !results[ep.id].ok).length;

  return (
    <Card className="mb-3 overflow-hidden">
      {/* Group header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[hsl(var(--muted))]/10 transition-colors select-none"
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{group.icon}</span>
          <span className="text-[13px] font-bold">{group.name}</span>
          <span className="text-[11px] text-[hsl(var(--muted-foreground))]">({total})</span>

          {/* Group status summary */}
          {tested.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2">
              {ok > 0 && <span className="text-[9px] text-emerald-400 font-medium">{ok}✓</span>}
              {errors > 0 && <span className="text-[9px] text-red-400 font-medium">{errors}✗</span>}
            </div>
          )}
        </div>

        <span className="text-[hsl(var(--muted-foreground))] text-xs transition-transform" style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}>
          ▼
        </span>
      </div>

      {/* Endpoints */}
      {!collapsed && (
        <div className="border-t border-[hsl(var(--border))]/40">
          {group.endpoints.map((ep) => (
            <EndpointRow
              key={ep.id}
              ep={ep}
              result={results[ep.id]}
              onTest={onTest}
              expanded={expandedEps.has(ep.id)}
              onToggle={toggleEp}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════
// Summary Bar
// ═══════════════════════════════════════
function SummaryBar({ results }) {
  const all = getAllEndpoints();
  const tested = all.filter((ep) => results[ep.id] && !results[ep.id].checking);
  const ok = tested.filter((ep) => results[ep.id]?.ok).length;
  const errors = tested.filter((ep) => results[ep.id] && !results[ep.id].ok).length;

  const latencies = tested.filter((ep) => results[ep.id]?.ok && results[ep.id]?.ms).map((ep) => results[ep.id].ms);
  const avgMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const maxMs = latencies.length > 0 ? Math.max(...latencies) : 0;

  return (
    <div className="grid grid-cols-5 gap-2.5 mb-5">
      {[
        { label: "Total", value: all.length, color: "hsl(var(--foreground))", icon: "📊" },
        { label: "Passed", value: ok, color: "#10b981", icon: "✅" },
        { label: "Failed", value: errors, color: "#ef4444", icon: "❌" },
        { label: "Avg Latency", value: avgMs > 0 ? `${avgMs}ms` : "—", color: avgMs <= 300 ? "#10b981" : avgMs <= 800 ? "#f59e0b" : "#ef4444", icon: "⚡" },
        { label: "Slowest", value: maxMs > 0 ? `${maxMs}ms` : "—", color: maxMs <= 500 ? "#10b981" : maxMs <= 1500 ? "#f59e0b" : "#ef4444", icon: "🐢" },
      ].map((c) => (
        <div key={c.label} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{c.label}</span>
            <span className="text-xs">{c.icon}</span>
          </div>
          <div className="text-lg font-bold" style={{ color: c.color }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export function ApiHealthCheck() {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [expandedEps, setExpandedEps] = useState(new Set());

  const apiBase = useMemo(getApiBase, []);

  // ─── Test single endpoint ───
  const testEndpoint = useCallback(async (ep) => {
    setResults((prev) => ({ ...prev, [ep.id]: { checking: true } }));
    const t0 = performance.now();
    try {
      let res;
      if (ep.isExternal) {
        // Direct fetch for external APIs
        let url = ep.path;
        let headers = {};
        if (ep.getUrl) url = await ep.getUrl();
        if (ep.getHeaders) headers = await ep.getHeaders();
        
        const fetchRes = await fetch(url, {
          method: ep.method,
          headers,
          signal: AbortSignal.timeout(8000)
        });
        
        const contentType = fetchRes.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          res = await fetchRes.json();
        } else {
          res = { status: fetchRes.status, text: await fetchRes.text() };
        }
        
        // Custom success logic for external APIs
        let ok = fetchRes.ok;
        if (ep.checkSuccess) ok = ep.checkSuccess(res, fetchRes);
        else if (res.status === "fail" || res.error) ok = false;
        
        const ms = Math.round(performance.now() - t0);
        
        let responseText;
        try {
          responseText = JSON.stringify(res, null, 2);
          if (responseText.length > 4000) responseText = responseText.slice(0, 4000) + "\n\n... (truncated)";
        } catch {
          responseText = String(res);
        }

        setResults((prev) => ({
          ...prev,
          [ep.id]: { ok, ms, detail: ok ? `${ms}ms` : `HTTP ${fetchRes.status}`, responseText },
        }));
        return;
      }

      // Internal API via api service
      if (ep.method === "GET") {
        res = await api.get(ep.path);
      } else {
        let body = ep.body || {};
        if (ep.getBody) {
          body = await ep.getBody();
        }
        res = await api.post(ep.path, body);
      }
      
      const ms = Math.round(performance.now() - t0);
      let ok = res && !res.error;
      if (ep.checkSuccess) {
        ok = ep.checkSuccess(res);
      }

      let responseText;
      try {
        responseText = JSON.stringify(res, null, 2);
        if (responseText.length > 4000) {
          responseText = responseText.slice(0, 4000) + "\n\n... (truncated)";
        }
      } catch {
        responseText = String(res);
      }

      setResults((prev) => ({
        ...prev,
        [ep.id]: { ok, ms, detail: ok ? `${ms}ms` : (res?.error || "Error"), responseText },
      }));
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      setResults((prev) => ({
        ...prev,
        [ep.id]: { ok: false, ms, detail: e.message, responseText: `Error: ${e.message}` },
      }));
    }
  }, []);

  // ─── Test all endpoints (parallel with concurrency limit) ───
  const testAll = useCallback(async () => {
    setRunning(true);
    const allEps = getAllEndpoints();

    // Mark all as checking
    const checking = {};
    allEps.forEach((ep) => (checking[ep.id] = { checking: true }));
    setResults(checking);

    // Open all groups
    setCollapsedGroups(new Set());

    // Run in parallel with concurrency limit of 3
    const queue = [...allEps];
    const concurrent = 3;
    const active = [];

    while (queue.length > 0 || active.length > 0) {
      while (active.length < concurrent && queue.length > 0) {
        const ep = queue.shift();
        const promise = testEndpoint(ep).then(() => {
          active.splice(active.indexOf(promise), 1);
        });
        active.push(promise);
      }
      if (active.length > 0) await Promise.race(active);
    }

    setRunning(false);
  }, [testEndpoint]);

  // ─── Toggle helpers ───
  const toggleGroup = useCallback((groupId) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  }, []);

  const toggleEp = useCallback((epId) => {
    setExpandedEps((prev) => {
      const next = new Set(prev);
      next.has(epId) ? next.delete(epId) : next.add(epId);
      return next;
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto animate-[fadeIn_.3s]">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-[20px] font-bold m-0">API Health Check</h1>
        <Button
          onClick={testAll}
          disabled={running}
          className="text-[11px] px-4 py-2"
          style={{ background: running ? undefined : "linear-gradient(135deg, #ef4444, #f97316)" }}
        >
          {running ? "⏳ Testing..." : "🚀 Test All Endpoints"}
        </Button>
      </div>

      {/* Worker URL */}
      <div className="text-[11px] text-[hsl(var(--muted-foreground))] mb-5 flex items-center gap-2">
        <span>Worker:</span>
        <a
          href={apiBase}
          target="_blank"
          rel="noopener"
          className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          {apiBase}
        </a>
      </div>

      {/* Summary */}
      <SummaryBar results={results} />

      {/* Endpoint Groups */}
      {ENDPOINT_GROUPS.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          results={results}
          onTest={testEndpoint}
          expandedEps={expandedEps}
          toggleEp={toggleEp}
          collapsed={collapsedGroups.has(group.id)}
          toggleCollapse={() => toggleGroup(group.id)}
        />
      ))}

      {/* Deploy section */}
      <Card className="mt-5 p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-base">🚀</span>
          <span className="text-[13px] font-bold">Deploy FusionOps</span>
        </div>
        <div className="flex items-center gap-3">
          <select className="text-[11px] px-3 py-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))]">
            <option>Worker + Pages (both)</option>
            <option>Worker only</option>
            <option>Pages only</option>
          </select>
          <a
            href="https://github.com/songsawat-w/ppc-gen-cfca/actions"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-white transition-colors"
            style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }}
          >
            🚀 Deploy via GitHub Actions
          </a>
        </div>
        <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-2 font-mono">
          Triggers deploy-dashboard.yml workflow. Requires CLOUDFLARE_API_TOKEN & CLOUDFLARE_ACCOUNT_ID secrets in GitHub repo.
        </p>
      </Card>
    </div>
  );
}
