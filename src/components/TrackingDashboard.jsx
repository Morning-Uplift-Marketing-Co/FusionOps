import React, { useState, useEffect, useRef, useCallback } from "react";
import { THEME as T } from "../constants";

// ─── Status indicators ───
const Pass = () => <span style={{ color: T.success, fontWeight: 700 }}>✓</span>;
const Fail = () => <span style={{ color: T.danger, fontWeight: 700 }}>✗</span>;
const Warn = () => <span style={{ color: T.warning, fontWeight: 700 }}>◐</span>;
const StatusDot = ({ ok, warn }) => ok ? <Pass /> : warn ? <Warn /> : <Fail />;

// ─── Styles ───
const S = {
  page: { padding: "24px 28px", maxWidth: 1280, margin: "0 auto", color: T.text },
  header: { marginBottom: 28 },
  title: { fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", display: "flex", alignItems: "center", gap: 10 },
  subtitle: { fontSize: 13, color: T.muted, marginTop: 4 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 },
  gridFull: { display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 20 },
  card: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" },
  cardTitle: { fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, marginBottom: 4, fontSize: 13 },
  rowPass: { background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.15)" },
  rowFail: { background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.12)" },
  rowWarn: { background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.12)" },
  badge: (color) => ({
    display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
    borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: color === T.success ? "rgba(16,185,129,.12)" : color === T.danger ? "rgba(239,68,68,.12)" : "rgba(245,158,11,.12)",
    color,
  }),
  input: {
    width: "100%", padding: "10px 14px", background: T.input, border: `1px solid ${T.border}`,
    borderRadius: 10, color: T.text, fontSize: 14, outline: "none", fontFamily: "inherit",
  },
  btn: (bg = T.primary) => ({
    padding: "9px 18px", background: bg, color: "#fff", border: "none",
    borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    transition: "all .15s",
  }),
  btnOutline: {
    padding: "9px 18px", background: "transparent", color: T.text,
    border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },
  tabs: { display: "flex", gap: 2, marginBottom: 20, background: T.card, borderRadius: 10, padding: 3, border: `1px solid ${T.border}` },
  tab: (active) => ({
    padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
    background: active ? T.primary : "transparent", color: active ? "#fff" : T.muted,
    border: "none", fontFamily: "inherit", transition: "all .15s",
  }),
  sectionLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: T.muted, marginBottom: 8 },
  eventLog: {
    background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10,
    padding: 14, maxHeight: 320, overflowY: "auto", fontFamily: "monospace", fontSize: 12,
    color: T.muted, lineHeight: 1.8,
  },
  tag: (bg, fg) => ({
    display: "inline-block", padding: "1px 7px", borderRadius: 4,
    fontSize: 10, fontWeight: 700, background: bg, color: fg, marginRight: 4,
  }),
};

// ─── Analysis checks ───
function analyzeHtml(html) {
  const checks = {
    // Layer 1: gtag.js (AW-only)
    gtagScript: /gtag\/js\?id=AW-/.test(html),
    gtagConfig: /gtag\s*\(\s*['"]config['"]/.test(html),
    conversionId: (html.match(/AW-(\d+)/) || [])[1] || null,
    formStartLabel: /form_start/.test(html) || /formStartLabel/.test(html),
    formSubmitLabel: /form_submit/.test(html) || /formSubmitLabel/.test(html),

    // Layer 2: First-Party Pixel
    pixelInit: /sendBeacon|__pixel|pixel\s*\(/.test(html),
    pixelEndpoint: (html.match(/['"]https?:\/\/t\.([^'"\/]+)\/e['"]/) || [])[1] || null,
    pixelPV: /pixel\s*\(\s*['"]pv['"]/.test(html) || /event.*pv/.test(html),
    pixelScroll: /scroll_25|scroll_50|scroll_75|scroll_100/.test(html),
    pixelTime: /top_30s|top_60s/.test(html),
    pixelAmt: /pixel\s*\(\s*['"]amt['"]/.test(html) || /amount_selected/.test(html),
    pixelZip: /pixel\s*\(\s*['"]ze['"]/.test(html) || /zip_entered/.test(html),

    // Layer 3: Voluum
    voluumScript: /dtpCallback|delegate-ch|voluum/i.test(html),
    voluumDomain: (html.match(/(?:trk|link|vls)\.([a-z0-9.-]+)/) || [])[1] || null,
    voluumClickUrl: /(?:trk|link|vls)\.[^'"]+\/[a-f0-9-]{36}/.test(html) || /(?:trk|link|vls)\.[^'"]+\/click/.test(html),

    // Layer 4: GCLID capture
    gclidCapture: /gclid|sessionStorage.*gclid/i.test(html),
    clickIdCapture: /click_id|clickid/i.test(html),
    utmCapture: /utm_source|utm_medium|utm_campaign/i.test(html),

    // Layer 5: LeadsGate
    leadsGateForm: /_lg_form_init_|leadsgate/i.test(html),
    leadsGateAid: (html.match(/aid\s*[:=]\s*['"]?(\d+)/) || [])[1] || null,
    lgOnFormLoad: /onFormLoad/.test(html),
    lgOnSubmit: /onSubmit/.test(html),
    lgOnSuccess: /onSuccess/.test(html),
    lgOnStepChange: /onStepChange/.test(html),

    // Layer 6: Micro-conversions
    microConvOnce: /fireFormStart|form_start.*once|firedFormStart/i.test(html),
    amountSlider: /amountSlider|amount.*slider|amt-btn/i.test(html),
    zipInput: /zip.*input|zipCode|zip.*focus/i.test(html),

    // Layer 7: DataLayer
    dataLayer: /dataLayer/.test(html),
    dataLayerPush: /dataLayer\.push/.test(html),

    // General
    noGTM: !/googletagmanager\.com\/gtm\.js/.test(html),
    noGA4: !/G-[A-Z0-9]+/.test(html) || /AW-/.test(html),
    hasApplyPage: /\/apply/.test(html),
    sslBadge: /SSL|Encrypted|256-bit/i.test(html),
    complianceAPR: /APR|Annual Percentage Rate/i.test(html),
  };

  return checks;
}

function scoreChecks(checks) {
  const groups = {
    "GOOGLE ADS (gtag.js)": [
      { key: "gtagScript", label: "gtag.js Script Loaded", required: true },
      { key: "gtagConfig", label: "gtag Config Initialized", required: true },
      { key: "conversionId", label: `Conversion ID: ${checks.conversionId ? `AW-${checks.conversionId}` : "Not Found"}`, required: true },
      { key: "formStartLabel", label: "form_start Label Present", required: true },
      { key: "formSubmitLabel", label: "form_submit Label Present", required: true },
    ],
    "FIRST-PARTY PIXEL": [
      { key: "pixelInit", label: "Pixel Function Initialized", required: true },
      { key: "pixelEndpoint", label: `Endpoint: ${checks.pixelEndpoint ? `t.${checks.pixelEndpoint}/e` : "Not Found"}`, required: true },
      { key: "pixelPV", label: "Page View Event (pv)", required: true },
      { key: "pixelScroll", label: "Scroll Tracking (25/50/75/100%)", required: false },
      { key: "pixelTime", label: "Time on Page (30s/60s)", required: false },
      { key: "pixelAmt", label: "Amount Selected Event (amt)", required: false },
      { key: "pixelZip", label: "ZIP Entered Event (ze)", required: false },
    ],
    "VOLUUM ATTRIBUTION": [
      { key: "voluumScript", label: "Voluum Lander Script", required: true },
      { key: "voluumDomain", label: `Domain: ${checks.voluumDomain || "Not Found"}`, required: true },
      { key: "voluumClickUrl", label: "Voluum Click URL in CTA", required: true },
    ],
    "URL PARAMETERS": [
      { key: "gclidCapture", label: "GCLID Capture (sessionStorage)", required: true },
      { key: "clickIdCapture", label: "Click ID Parameter", required: true },
      { key: "utmCapture", label: "UTM Parameters", required: false },
    ],
    "LEADSGATE FORM": [
      { key: "leadsGateForm", label: "LeadsGate Form Embed", required: false },
      { key: "leadsGateAid", label: `AID: ${checks.leadsGateAid || "Not Found"}`, required: false },
      { key: "lgOnFormLoad", label: "onFormLoad Callback", required: false },
      { key: "lgOnSubmit", label: "onSubmit Callback", required: false },
      { key: "lgOnSuccess", label: "onSuccess Callback", required: false },
      { key: "lgOnStepChange", label: "onStepChange Callback", required: false },
    ],
    "MICRO-CONVERSIONS": [
      { key: "microConvOnce", label: "form_start Fires Once", required: false },
      { key: "amountSlider", label: "Amount Slider Interaction", required: false },
      { key: "zipInput", label: "ZIP Input Detection", required: false },
    ],
    "COMPLIANCE & SAFETY": [
      { key: "noGTM", label: "No GTM (Zero-GTM Architecture)", required: true },
      { key: "noGA4", label: "No GA4 (AW-only)", required: true },
      { key: "complianceAPR", label: "APR Disclosure Present", required: false },
      { key: "hasApplyPage", label: "/apply Page Link", required: false },
    ],
  };

  let total = 0, passed = 0;
  for (const items of Object.values(groups)) {
    for (const item of items) {
      total++;
      const val = checks[item.key];
      if (val === true || (typeof val === "string" && val)) passed++;
    }
  }

  return { groups, total, passed, pct: Math.round((passed / total) * 100) };
}

function normalizeTargetUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  let candidate = raw;
  if (candidate.startsWith("//")) {
    candidate = `https:${candidate}`;
  } else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

// ─── Main Component ───
export function TrackingDashboard({ settings, sites }) {
  const [tab, setTab] = useState("overview");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState(null);
  const [checks, setChecks] = useState(null);
  const [score, setScore] = useState(null);
  const [htmlApply, setHtmlApply] = useState(null);
  const [checksApply, setChecksApply] = useState(null);
  const [scoreApply, setScoreApply] = useState(null);
  const [events, setEvents] = useState([]);
  const [liveUrl, setLiveUrl] = useState(null);
  const iframeRef = useRef(null);
  const [selectedSite, setSelectedSite] = useState("");

  // Fetch and analyze LP (both index and /apply)
  const analyze = useCallback(async (targetUrl) => {
    const normalizedUrl = normalizeTargetUrl(targetUrl);
    if (!normalizedUrl) {
      addEvent("error", "Invalid URL. Please enter a valid domain or URL.");
      return;
    }

    if (normalizedUrl !== targetUrl) {
      setUrl(normalizedUrl);
    }

    setLoading(true);
    setEvents([]);
    
    // Helper function to fetch HTML
    const fetchHtml = async (url) => {
      try {
        const res = await fetch(url);
        return await res.text();
      } catch {
        try {
          const proxyRes = await fetch(`/api/proxy/pass?url=${encodeURIComponent(url)}`);
          return await proxyRes.text();
        } catch {
          return null;
        }
      }
    };

    try {
      // Fetch index page
      const fetchedHtml = await fetchHtml(normalizedUrl);
      if (fetchedHtml) {
        setHtml(fetchedHtml);
        const c = analyzeHtml(fetchedHtml);
        setChecks(c);
        setScore(scoreChecks(c));
        addEvent("info", `Analyzed INDEX: ${normalizedUrl} — ${fetchedHtml.length.toLocaleString()} bytes`);
      } else {
        addEvent("error", "Could not fetch INDEX page.");
      }

      // Fetch /apply page
      const applyUrl = normalizedUrl.replace(/\/$/, '') + '/apply';
      const fetchedHtmlApply = await fetchHtml(applyUrl);
      if (fetchedHtmlApply) {
        setHtmlApply(fetchedHtmlApply);
        const cApply = analyzeHtml(fetchedHtmlApply);
        setChecksApply(cApply);
        setScoreApply(scoreChecks(cApply));
        addEvent("info", `Analyzed APPLY: ${applyUrl} — ${fetchedHtmlApply.length.toLocaleString()} bytes`);
      } else {
        addEvent("warn", "Could not fetch /apply page. It may not exist or is blocked.");
        setHtmlApply(null);
        setChecksApply(null);
        setScoreApply(null);
      }
    } catch (e) {
      addEvent("error", `Analysis failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Analyze from template source
  const analyzeFromSource = useCallback((site) => {
    if (!site) return;
    try {
      // Import dynamically
      import("../utils/template-router.js").then(({ generateHtmlByTemplate }) => {
        const generated = generateHtmlByTemplate(site);
        if (generated) {
          setHtml(generated);
          const c = analyzeHtml(generated);
          setChecks(c);
          setScore(scoreChecks(c));
          setUrl(site.domain ? `https://${site.domain}` : "");
          addEvent("info", `Analyzed from template source — ${generated.length.toLocaleString()} bytes`);
        }
      });
    } catch (e) {
      addEvent("error", `Source analysis failed: ${e.message}`);
    }
  }, []);

  const addEvent = (type, msg) => {
    setEvents(prev => [{ ts: new Date().toISOString(), type, msg }, ...prev].slice(0, 200));
  };

  // Open live monitor
  const openLiveMonitor = () => {
    const normalizedUrl = normalizeTargetUrl(url);
    if (!normalizedUrl) {
      addEvent("error", "Live monitor requires a valid URL.");
      return;
    }
    if (normalizedUrl !== url) setUrl(normalizedUrl);
    setLiveUrl(normalizedUrl);
    setTab("monitor");
    addEvent("info", `Live monitor opened: ${normalizedUrl}`);
  };

  // Tabs
  const TABS = [
    { id: "overview", label: "Overview", icon: "📋" },
    { id: "events", label: "Events", icon: "📡" },
    { id: "monitor", label: "Live Monitor", icon: "🔴" },
    { id: "help", label: "Spec Reference", icon: "📖" },
  ];

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.title}>
          <span>🔬</span> Tracking Verification Dashboard
        </div>
        <div style={S.subtitle}>
          Analyze LP tracking layers: gtag.js, First-Party Pixel, Voluum, GCLID, LeadsGate, Micro-Conversions
        </div>
      </div>

      {/* URL Input */}
      <div style={{ ...S.card, marginBottom: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <input
            style={S.input}
            placeholder="Enter LP URL to analyze (e.g., https://bearloannow.com)"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && analyze(url)}
          />
        </div>
        <button style={S.btn()} onClick={() => analyze(url)} disabled={loading || !url}>
          {loading ? "⏳ Analyzing..." : "🔍 Analyze URL"}
        </button>
        {sites?.length > 0 && (
          <select
            style={{ ...S.input, width: "auto", minWidth: 180 }}
            value={selectedSite}
            onChange={e => {
              setSelectedSite(e.target.value);
              const site = sites.find(s => s.id === e.target.value);
              if (site) analyzeFromSource(site);
            }}
          >
            <option value="">— Analyze from Site —</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.brand || s.domain || s.id}</option>
            ))}
          </select>
        )}
        {url && (
          <button style={S.btnOutline} onClick={openLiveMonitor}>
            🔴 Live Monitor
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && <OverviewTab checks={checks} score={score} checksApply={checksApply} scoreApply={scoreApply} />}
      {tab === "events" && <EventsTab events={events} />}
      {tab === "monitor" && <MonitorTab url={liveUrl} iframeRef={iframeRef} addEvent={addEvent} />}
      {tab === "help" && <HelpTab />}
    </div>
  );
}

// ─── Overview Tab ───
function OverviewTab({ checks, score, checksApply, scoreApply }) {
  if (!checks || !score) {
    return (
      <div style={{ ...S.card, textAlign: "center", padding: 48, color: T.muted }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔬</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No Analysis Yet</div>
        <div style={{ fontSize: 13 }}>Enter a deployed LP URL or select a site to analyze tracking implementation.</div>
      </div>
    );
  }

  const pctColor = score.pct >= 80 ? T.success : score.pct >= 50 ? T.warning : T.danger;
  const pctColorApply = scoreApply ? (scoreApply.pct >= 80 ? T.success : scoreApply.pct >= 50 ? T.warning : T.danger) : T.muted;

  return (
    <>
      {/* Score Summary - Index Page */}
      <div style={{ ...S.card, marginBottom: 20, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          border: `3px solid ${pctColor}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 800, color: pctColor,
          background: `${pctColor}11`,
        }}>
          {score.pct}%
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            📄 INDEX Page — Tracking Verification <span style={S.badge(pctColor)}>{score.passed}/{score.total}</span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
            {score.pct >= 80 ? "All critical tracking layers detected" :
             score.pct >= 50 ? "Some tracking layers missing — check details below" :
             "Major tracking gaps detected — review implementation"}
          </div>
        </div>
      </div>

      {/* Score Summary - Apply Page */}
      {scoreApply && (
        <div style={{ ...S.card, marginBottom: 20, display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            border: `3px solid ${pctColorApply}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 800, color: pctColorApply,
            background: `${pctColorApply}11`,
          }}>
            {scoreApply.pct}%
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              📝 APPLY Page — Tracking Verification <span style={S.badge(pctColorApply)}>{scoreApply.passed}/{scoreApply.total}</span>
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {scoreApply.pct >= 80 ? "All critical tracking layers detected" :
               scoreApply.pct >= 50 ? "Some tracking layers missing — check details below" :
               "Major tracking gaps detected — review implementation"}
            </div>
          </div>
        </div>
      )}

      {/* INDEX Page - Check Groups */}
      <div style={{ ...S.sectionLabel, marginTop: 20 }}>📄 INDEX PAGE ANALYSIS</div>
      <div style={S.grid}>
        {Object.entries(score.groups).map(([group, items]) => {
          const passed = items.filter(i => {
            const v = checks[i.key];
            return v === true || (typeof v === "string" && v);
          }).length;
          const total = items.length;
          const groupColor = passed === total ? T.success : passed > 0 ? T.warning : T.danger;

          return (
            <div key={group} style={S.card}>
              <div style={S.cardTitle}>
                <span style={S.badge(groupColor)}>{passed}/{total}</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: .5, color: T.muted }}>{group}</span>
              </div>
              {items.map(item => {
                const val = checks[item.key];
                const ok = val === true || (typeof val === "string" && val);
                const style = ok ? S.rowPass : item.required ? S.rowFail : S.rowWarn;
                return (
                  <div key={item.key} style={{ ...S.row, ...style }}>
                    <span>{item.label}</span>
                    <StatusDot ok={ok} warn={!item.required} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* APPLY Page - Check Groups */}
      {scoreApply && checksApply && (
        <>
          <div style={{ ...S.sectionLabel, marginTop: 32 }}>📝 APPLY PAGE ANALYSIS</div>
          <div style={S.grid}>
            {Object.entries(scoreApply.groups).map(([group, items]) => {
              const passed = items.filter(i => {
                const v = checksApply[i.key];
                return v === true || (typeof v === "string" && v);
              }).length;
              const total = items.length;
              const groupColor = passed === total ? T.success : passed > 0 ? T.warning : T.danger;

              return (
                <div key={group} style={S.card}>
                  <div style={S.cardTitle}>
                    <span style={S.badge(groupColor)}>{passed}/{total}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: .5, color: T.muted }}>{group}</span>
                  </div>
                  {items.map(item => {
                    const val = checksApply[item.key];
                    const ok = val === true || (typeof val === "string" && val);
                    const style = ok ? S.rowPass : item.required ? S.rowFail : S.rowWarn;
                    return (
                      <div key={item.key} style={{ ...S.row, ...style }}>
                        <span>{item.label}</span>
                        <StatusDot ok={ok} warn={!item.required} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ─── Events Tab ───
function EventsTab({ events }) {
  const typeColors = {
    info: { bg: "rgba(99,102,241,.15)", fg: T.primary },
    error: { bg: "rgba(239,68,68,.15)", fg: T.danger },
    event: { bg: "rgba(16,185,129,.15)", fg: T.success },
    pixel: { bg: "rgba(34,211,238,.15)", fg: T.accent },
    gtag: { bg: "rgba(245,158,11,.15)", fg: T.warning },
  };

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>📡 Event Log</div>
      {events.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32, color: T.muted, fontSize: 13 }}>
          No events yet. Analyze a URL or open the Live Monitor to capture events.
        </div>
      ) : (
        <div style={S.eventLog}>
          {events.map((e, i) => {
            const c = typeColors[e.type] || typeColors.info;
            return (
              <div key={i} style={{ borderBottom: `1px solid ${T.border}`, padding: "4px 0" }}>
                <span style={{ color: T.dim, marginRight: 8 }}>{new Date(e.ts).toLocaleTimeString()}</span>
                <span style={S.tag(c.bg, c.fg)}>{e.type.toUpperCase()}</span>
                <span style={{ color: e.type === "error" ? T.danger : T.text }}>{e.msg}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Live Monitor Tab ───
function MonitorTab({ url, iframeRef, addEvent }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [frameBlocked, setFrameBlocked] = useState(false);

  useEffect(() => {
    if (!url) return;
    setIframeLoaded(false);
    setFrameBlocked(false);

    // Many production LPs block framing via X-Frame-Options/CSP.
    // If iframe never loads, show actionable fallback instead of a confusing blank/404 view.
    const timer = setTimeout(() => {
      setFrameBlocked(true);
      addEvent("error", "Live monitor iframe blocked by site security headers (X-Frame-Options/CSP). Use 'Open in new tab'.");
    }, 4500);

    return () => clearTimeout(timer);
  }, [url, addEvent]);

  if (!url) {
    return (
      <div style={{ ...S.card, textAlign: "center", padding: 48, color: T.muted }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔴</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Live Monitor</div>
        <div style={{ fontSize: 13 }}>Enter a URL and click "Live Monitor" to open real-time tracking monitoring.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...S.card, marginBottom: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: iframeLoaded ? T.success : T.warning,
          animation: iframeLoaded ? "none" : "pulse 1.5s infinite",
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: iframeLoaded ? T.success : T.warning }}>
          {iframeLoaded ? "Connected" : "Loading..."}
        </span>
        <span style={{ fontSize: 12, color: T.muted, flex: 1 }}>{url}</span>
        <a href={url} target="_blank" rel="noopener" style={{ fontSize: 12, color: T.primary, textDecoration: "none" }}>
          Open in new tab ↗
        </a>
      </div>
      <div style={{
        background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12,
        overflow: "hidden", height: 600,
      }}>
        {frameBlocked ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>This site blocks iframe embedding</div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>
                Security headers like <code>X-Frame-Options</code> or <code>CSP frame-ancestors</code> prevent in-app preview.
              </div>
              <a href={url} target="_blank" rel="noopener" style={{ ...S.btn(), display: "inline-block", textDecoration: "none" }}>
                Open Live Monitor In New Tab ↗
              </a>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            style={{ width: "100%", height: "100%", border: "none" }}
            onLoad={() => {
              setIframeLoaded(true);
              setFrameBlocked(false);
              addEvent("info", "iframe loaded successfully");
            }}
            sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: T.dim }}>
        ⚠️ Note: Cross-origin restrictions may limit event capture. For full monitoring, use browser DevTools on the actual page.
      </div>
    </div>
  );
}

// ─── Help/Spec Tab ───
function HelpTab() {
  return (
    <div style={S.grid}>
      <div style={S.card}>
        <div style={S.cardTitle}>📐 Architecture: Zero-GTM</div>
        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
          <div><strong style={{ color: T.text }}>Layer 1:</strong> gtag.js (AW-only) — micro-conv to train Google Ads AI</div>
          <div><strong style={{ color: T.text }}>Layer 2:</strong> Custom First-Party Pixel — sendBeacon → t.{"{domain}"}/e → D1</div>
          <div><strong style={{ color: T.text }}>Layer 3:</strong> Voluum — Lander tracking script + click URL</div>
          <div style={{ marginTop: 8, color: T.warning }}>⚠️ NO Google Tag Manager. NO GA4.</div>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>🎯 Only 3 Conversion Actions</div>
        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
          <div><span style={S.tag("rgba(245,158,11,.15)", T.warning)}>SECONDARY</span> <strong style={{ color: T.text }}>form_start</strong> — onFormLoad OR amount/zip interact</div>
          <div><span style={S.tag("rgba(239,68,68,.15)", T.danger)}>PRIMARY</span> <strong style={{ color: T.text }}>form_submit</strong> — LeadsGate onSubmit</div>
          <div><span style={S.tag("rgba(16,185,129,.15)", T.success)}>PRIMARY</span> <strong style={{ color: T.text }}>sold_lead</strong> — Voluum s2s postback (server-side)</div>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>📡 Pixel Events</div>
        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
          {["pv (page_view)", "fl (form_load)", "fs (form_submit)", "cta (cta_click)", "step (step_change)", "success",
            "scroll_25 / 50 / 75 / 100", "top_30s / top_60s", "amt (amount_selected)", "ze (zip_entered)"
          ].map(e => <div key={e}>• <code style={{ color: T.accent, fontSize: 11 }}>{e}</code></div>)}
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>🔗 LeadsGate Callbacks</div>
        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
          <div>• <strong style={{ color: T.text }}>onFormLoad</strong> → gtag form_start + pixel('fl')</div>
          <div>• <strong style={{ color: T.text }}>onStepChange</strong> → pixel('step', {"{step}"})</div>
          <div>• <strong style={{ color: T.text }}>onSubmit</strong> → gtag form_submit + pixel('fs')</div>
          <div>• <strong style={{ color: T.text }}>onSuccess</strong> → pixel('success') only — LG auto-redirects</div>
          <div style={{ marginTop: 8 }}>
            <strong style={{ color: T.text }}>Required params:</strong> aid, click_id
          </div>
        </div>
      </div>
      <div style={{ ...S.card, gridColumn: "1 / -1" }}>
        <div style={S.cardTitle}>🏗️ Tracking Flow</div>
        <pre style={{
          fontSize: 11, color: T.muted, lineHeight: 1.6, whiteSpace: "pre-wrap",
          background: T.card2, padding: 14, borderRadius: 8, border: `1px solid ${T.border}`,
        }}>
{`User lands on LP
  ├─ trackingBodyScript fires:
  │   ├─ Capture GCLID + click_id + UTMs → sessionStorage
  │   ├─ Generate session ID
  │   ├─ sendBeacon page_view → t.{domain}/e
  │   ├─ Voluum dtpCallback loads
  │   ├─ Scroll listeners (25/50/75/100%)
  │   ├─ Time listeners (30s, 60s)
  │   └─ Expose window.__TRK + window.pixel
  │
  ├─ User interacts with amount slider:
  │   ├─ fireFormStart() ONCE → gtag form_start
  │   └─ pixel('amt', {amount})
  │
  ├─ User clicks CTA:
  │   ├─ pixel('cta')
  │   └─ Redirect → trk.{voluumDomain}/click
  │
  └─ /apply page loads:
      ├─ LG form loads → gtag form_start + pixel('fl')
      ├─ Step change → pixel('step')
      ├─ Form submit → gtag form_submit + pixel('fs')
      └─ Lead success → pixel('success') (LG auto-redirects)`}
        </pre>
      </div>
    </div>
  );
}

export default TrackingDashboard;
