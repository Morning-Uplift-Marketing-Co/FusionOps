import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { getAllTemplatesAsync, getTemplateDiagnostics, hideBuiltinTemplate } from "../utils/template-registry";

/* ── Extract og:image URL from template files ── */
function extractOgImage(template) {
  const files = typeof template.files === "object" && template.files ? template.files : {};
  const sourceCode = String(template.source_code || template.sourceCode || "");
  const combined = sourceCode + "\n" + Object.values(files).filter((v) => typeof v === "string").join("\n");
  const m = combined.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || combined.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1] : null;
}

/* ── Quality validation (unchanged business logic) ── */
function validateTemplateQuality(template) {
  const files = typeof template.files === "object" && template.files ? template.files : {};
  const sourceCode = String(template.source_code || template.sourceCode || "");
  const category = String(template.category || "").toLowerCase();
  const keys = Object.keys(files);
  const fileContents = Object.values(files).filter((v) => typeof v === "string").join("\n");
  const combined = sourceCode + "\n" + fileContents;
  const htmlCombined = keys
    .filter((k) => k.toLowerCase().endsWith(".html"))
    .map((k) => (typeof files[k] === "string" ? files[k] : ""))
    .join("\n") + "\n" + (/<html|<!doctype html/i.test(sourceCode) ? sourceCode : "");
  const entryOk = keys.some((k) => k.endsWith("index.astro") || k.endsWith("index.html")) || /<html|<!doctype html/i.test(sourceCode);
  const pixelMarker = /sendBeacon|sendPixelBeacon|fpPixel|__fpPixel|PX_ENDPOINT|t\.[^"' ]+\/e|window\.pixel/i.test(combined);
  const trackingMarker = /gtag\(|AW-\d+|form_start|form_submit/i.test(combined);
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(combined);
  const hasPrimaryToken = /--color-primary|--primary\s*:|--fo-primary|var\(--color-primary\)|var\(--primary\)|var\(--fo-primary\)|hsl\(var\(--primary\)\)/i.test(combined);
  const hasExpressionLeak = /\{title\}|\{\s*noindex\s*\?|\{\s*[a-zA-Z_$][\w$]*\s*&&\s*\(/.test(htmlCombined);
  const hasCalculator = /calculator|monthly payment|calcMonthly|loanAmount|payment estimate/i.test(combined);
  const hasAprCompare = /representative apr|apr range|<table[\s\S]*apr|term[\s\S]*apr/i.test(combined);
  const bannedPatterns = [/guaranteed approval/i, /guaranteed loan/i, /100%\s*approval/i, /everyone approved/i, /instant cash now/i, /free money/i, /zero risk/i];
  const matchedBanned = bannedPatterns.filter((p) => p.test(combined)).map((p) => p.toString());
  const blocking = [];
  const warnings = [];
  if (!entryOk) blocking.push("Missing template entry (index.astro or index.html).");
  if (!pixelMarker) blocking.push("Missing first-party pixel marker.");
  if (hasExpressionLeak) blocking.push("Potential Astro expression leak detected.");
  if (matchedBanned.length > 0) blocking.push(`Policy-risk copy: ${matchedBanned.join(", ")}`);
  if (/(installment|loan|pdl|pet-care)/i.test(category)) {
    if (!hasCalculator) blocking.push("Missing Payment Calculator for loan template.");
    if (!hasAprCompare) blocking.push("Missing APR Compare section for loan template.");
  }
  if (!hasViewport) warnings.push("Viewport meta not detected.");
  if (!hasPrimaryToken) warnings.push("Primary color token not detected.");
  if (!trackingMarker) warnings.push("Google Ads tracking markers not detected.");
  return { pass: blocking.length === 0, blocking, warnings };
}

function toDate(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ── Config ── */
const CATS = {
  loan:        { grad: "from-indigo-600 to-purple-700", icon: "💰", label: "Loan" },
  pet:         { grad: "from-emerald-600 to-teal-700",  icon: "🐾", label: "Pet" },
  "pet-care":  { grad: "from-emerald-600 to-teal-700",  icon: "🐾", label: "Pet" },
  custom:      { grad: "from-amber-600 to-orange-700",  icon: "🎨", label: "Custom" },
  general:     { grad: "from-slate-600 to-gray-700",    icon: "📄", label: "General" },
  installment: { grad: "from-indigo-600 to-purple-700", icon: "💳", label: "Installment" },
};
/* Smart category detection: check specific category first, then infer from name/id */
const catOf = (t) => {
  const cat = String(t.category || "").toLowerCase();
  // If a specific (non-general) category is set, use it
  if (cat && cat !== "general" && CATS[cat]) return CATS[cat];
  // Otherwise, infer from template name/id
  const name = String(t.name || t.id || "").toLowerCase();
  if (/pet|animal|vet|puppy|kitten/.test(name)) return CATS.pet;
  if (/installment|pdl|payday/.test(name)) return CATS.installment;
  if (/loan|lend|borrow|credit|finance|apr/.test(name)) return CATS.loan;
  // Fall back to explicit category or general
  return CATS[cat] || CATS.general;
};

const STAT = {
  active:     { cls: "text-emerald-400", dot: "bg-emerald-400", label: "Active" },
  draft:      { cls: "text-yellow-400",  dot: "bg-yellow-400",  label: "Draft" },
  deprecated: { cls: "text-orange-400",  dot: "bg-orange-400",  label: "Deprecated" },
  archived:   { cls: "text-gray-500",    dot: "bg-gray-500",    label: "Archived" },
};
const statOf = (s) => STAT[s] || STAT.draft;

/* ── Main Component ── */
export function TemplateManager({ sites = [], notify, onDefaultTemplateChange }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("grid");
  const [usage, setUsage] = useState({ usageCount: 0, sites: [] });
  const [versions, setVersions] = useState([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState("classic");
  const [publishing, setPublishing] = useState(false);

  /* ── Data loading ── */
  const loadAll = async () => {
    setLoading(true);
    try {
      const [allTemplates, defaultRes] = await Promise.all([getAllTemplatesAsync(), api.get("/templates/default")]);
      setTemplates(allTemplates || []);
      if (defaultRes?.templateId) setDefaultTemplateId(defaultRes.templateId);
      if (!selectedId && allTemplates?.length) setSelectedId(allTemplates[0].dbId || allTemplates[0].id);
    } finally { setLoading(false); }
  };
  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => templates.find((t) => (t.dbId || t.id) === selectedId) || null, [templates, selectedId]);

  useEffect(() => {
    if (!selected?.dbId) { setUsage({ usageCount: 0, sites: [] }); setVersions([]); return; }
    Promise.all([api.get(`/templates/${selected.dbId}/usage`), api.get(`/templates/${selected.dbId}/versions`)]).then(([u, v]) => {
      setUsage({ usageCount: u?.usageCount || 0, sites: u?.sites || [] });
      setVersions(v?.versions || []);
    });
  }, [selected?.dbId]);

  /* ── Derived data ── */
  const mergedTemplates = useMemo(() => (templates || []).map((t) => {
    const id = t.dbId || t.id;
    const siteUsage = sites.filter((s) => String(s.templateId || "") === String(t.id || t.template_id || "")).length;
    return { ...t, _id: id, _source: t.source || (t.dbId ? "api" : "module"), _status: t.status || (t.source === "api" ? "draft" : "active"), _usage: Number(t.usage_count || siteUsage || 0) };
  }), [templates, sites]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = mergedTemplates.filter((t) => {
      if (sourceFilter !== "all" && t._source !== sourceFilter) return false;
      if (statusFilter !== "all" && t._status !== statusFilter) return false;
      if (!q) return true;
      return [t.name, t.id, t.template_id, t.description, t.category].some((v) => String(v || "").toLowerCase().includes(q));
    });
    list.sort((a, b) => {
      if (sortBy === "usage") return (b._usage || 0) - (a._usage || 0);
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      return String(b.created_at || b.createdAt || "").localeCompare(String(a.created_at || a.createdAt || ""));
    });
    return list;
  }, [mergedTemplates, query, sourceFilter, statusFilter, sortBy]);

  const wizardDiagnostics = useMemo(() => getTemplateDiagnostics(mergedTemplates, { filterId: "all" }), [mergedTemplates]);
  const hiddenReasonsById = useMemo(() => {
    const map = new Map();
    for (const item of wizardDiagnostics.hidden || []) map.set(item.id, item.reasons.join(" | "));
    return map;
  }, [wizardDiagnostics.hidden]);

  const selectedQuality = useMemo(() => validateTemplateQuality(selected || {}), [selected]);

  /* ── Actions (unchanged logic) ── */
  const updateStatus = async (status) => {
    if (!selected?.dbId) return;
    const res = await api.put(`/templates/${selected.dbId}`, { status });
    if (res?.error) return notify?.(res.error, "danger");
    notify?.(`Status -> ${status}`, "success");
    await loadAll();
  };
  const createVersion = async () => {
    if (!selected?.dbId) return;
    const note = window.prompt("Version note:", "Manual snapshot") || "Manual snapshot";
    const res = await api.put(`/templates/${selected.dbId}`, { createVersion: true, note });
    if (res?.error) return notify?.(res.error, "danger");
    notify?.(`Created v${res.versionNumber || "?"}`, "success");
    await loadAll();
  };
  const publish = async (version = null) => {
    if (!selected?.dbId) return;
    if (!selectedQuality.pass) { notify?.("Publish blocked: fix critical errors first.", "danger"); return; }
    setPublishing(true);
    let res;
    try { res = await api.post(`/templates/${selected.dbId}/publish`, version ? { version } : {}); } finally { setPublishing(false); }
    if (res?.error) {
      const bb = Array.isArray(res?.quality?.blocking) ? res.quality.blocking : [];
      return notify?.(bb.length ? `${res.error}: ${bb.join(" | ")}` : res.error, "danger");
    }
    notify?.(`Published${version ? ` v${version}` : ""}`, "success");
    await loadAll();
  };
  const rollback = async (version) => {
    if (!selected?.dbId || !version) return;
    if (!window.confirm(`Rollback to v${version}?`)) return;
    const res = await api.post(`/templates/${selected.dbId}/rollback`, { version });
    if (res?.error) return notify?.(res.error, "danger");
    notify?.(`Rolled back to v${version}`, "success");
    await loadAll();
  };
  const softDelete = async () => {
    if (!selected?.dbId) return;
    if (!window.confirm(`Delete "${selected.name}"?`)) return;
    const res = await api.del(`/templates/${selected.dbId}`);
    if (res?.error) return notify?.(res.error, "danger");
    notify?.("Deleted", "success");
    setSelectedId("");
    await loadAll();
  };
  const hideBuiltin = () => {
    if (!selected) return;
    if (!window.confirm(`Hide "${selected.name}" from all lists?`)) return;
    hideBuiltinTemplate(selected.id);
    notify?.(`Hidden "${selected.name}"`, "success");
    setSelectedId("");
    loadAll();
  };
  const saveDefault = async (templateId) => {
    const res = await api.put("/templates/default", { templateId });
    if (res?.error) return notify?.(res.error, "danger");
    setDefaultTemplateId(templateId);
    onDefaultTemplateChange?.(templateId);
    notify?.(`Default: ${templateId}`, "success");
  };

  const panelOpen = !!selected;

  /* ── Render ── */
  return (
    <div className="flex flex-col h-full">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Template Manager</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{filtered.length} templates available</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="px-3 py-1.5 text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors">
            Refresh
          </button>
        </div>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] text-sm pointer-events-none">&#x1F50D;</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates..." className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--primary))] transition-colors" />
        </div>
        <Select value={sourceFilter} onChange={setSourceFilter} options={[["all","All Sources"],["module","Module"],["legacy","Legacy"],["api","Custom"]]} />
        <Select value={statusFilter} onChange={setStatusFilter} options={[["all","All Status"],["active","Active"],["draft","Draft"],["deprecated","Deprecated"],["archived","Archived"]]} />
        <Select value={sortBy} onChange={setSortBy} options={[["newest","Newest"],["usage","Most Used"],["name","A – Z"]]} />
        <div className="ml-auto flex rounded-lg border border-[hsl(var(--border))] overflow-hidden">
          {[["grid", "⊞"], ["list", "☰"]].map(([m, icon]) => (
            <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1.5 text-xs transition-colors ${viewMode === m ? "bg-[hsl(var(--primary))] text-white" : "bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"}`}>
              {icon} {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT AREA (grid + optional side panel) ── */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Grid / List */}
        <div className={`flex-1 overflow-y-auto pr-1 ${panelOpen ? "max-w-[calc(100%-380px)]" : ""}`}>
          {loading && <div className="text-[hsl(var(--muted-foreground))] text-sm py-10 text-center">Loading templates...</div>}
          {!loading && filtered.length === 0 && <div className="text-[hsl(var(--muted-foreground))] text-sm py-10 text-center">No templates match your filters.</div>}
          {!loading && viewMode === "grid" && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {filtered.map((tpl) => <TemplateCard key={tpl._id} tpl={tpl} selected={selectedId === tpl._id} defaultId={defaultTemplateId} hiddenHint={hiddenReasonsById.get(tpl.id)} quality={validateTemplateQuality(tpl)} onClick={() => setSelectedId(selectedId === tpl._id ? "" : tpl._id)} />)}
            </div>
          )}
          {!loading && viewMode === "list" && (
            <div className="flex flex-col gap-1.5">
              {filtered.map((tpl) => <TemplateRow key={tpl._id} tpl={tpl} selected={selectedId === tpl._id} defaultId={defaultTemplateId} quality={validateTemplateQuality(tpl)} onClick={() => setSelectedId(selectedId === tpl._id ? "" : tpl._id)} />)}
            </div>
          )}
        </div>

        {/* Side Panel */}
        {panelOpen && (
          <div className="w-[360px] shrink-0 border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-xl overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
            <SidePanel
              tpl={selected} quality={selectedQuality} usage={usage} versions={versions}
              defaultId={defaultTemplateId} publishing={publishing}
              hiddenHint={hiddenReasonsById.get(selected?.id)}
              onClose={() => setSelectedId("")}
              onSetDefault={() => saveDefault(selected.id || selected.template_id)}
              onUpdateStatus={updateStatus} onCreateVersion={createVersion}
              onPublish={publish} onRollback={rollback}
              onDelete={selected.dbId ? softDelete : hideBuiltin}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Select dropdown ── */
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="px-2.5 py-2 text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] focus:outline-none focus:border-[hsl(var(--primary))] transition-colors cursor-pointer">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

/* ── Template Card (Grid) ── */
function TemplateCard({ tpl, selected, defaultId, hiddenHint, quality, onClick }) {
  const cat = catOf(tpl);
  const st = statOf(tpl._status);
  const isDefault = defaultId === (tpl.id || tpl.template_id);
  const isBroken = tpl.health?.usable === false;
  const ogImage = useMemo(() => extractOgImage(tpl), [tpl]);
  return (
    <button onClick={onClick} className={`text-left rounded-xl border transition-all duration-200 overflow-hidden group hover:shadow-lg hover:shadow-black/20 ${selected ? "border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]/30" : isBroken ? "border-red-500/50" : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50"}`}>
      {/* Gradient header / OG image */}
      <div className={`h-20 bg-gradient-to-br ${cat.grad} flex items-center justify-center relative overflow-hidden`}>
        {ogImage ? (
          <img src={ogImage} alt={tpl.name || tpl.id} className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
        ) : (
          <span className="text-3xl opacity-80 group-hover:scale-110 transition-transform duration-300">{cat.icon}</span>
        )}
        {/* Quality indicator */}
        <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${quality.pass ? "bg-emerald-400" : "bg-red-400"}`} title={quality.pass ? "Quality: Pass" : "Quality: Fail"} />
        {isDefault && <span className="absolute top-2 left-2 text-[9px] font-bold bg-white/20 backdrop-blur-sm text-white px-1.5 py-0.5 rounded">DEFAULT</span>}
        {isBroken && <span className="absolute bottom-2 right-2 text-[9px] font-bold bg-red-500/80 text-white px-1.5 py-0.5 rounded">BROKEN</span>}
      </div>
      {/* Info */}
      <div className="p-3 bg-[hsl(var(--card))]">
        <div className="font-semibold text-xs text-[hsl(var(--foreground))] truncate">{tpl.name || tpl.id}</div>
        <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{tpl._source} {cat.label !== "General" ? `· ${cat.label}` : ""}</div>
        <div className="flex items-center gap-2 mt-1.5 text-[10px]">
          <span className={`flex items-center gap-1 ${st.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>
          <span className="text-[hsl(var(--muted-foreground))]">{tpl._usage} {tpl._usage === 1 ? "site" : "sites"}</span>
        </div>
        {hiddenHint && <div className="text-[9px] text-yellow-400 mt-1 truncate" title={hiddenHint}>⚠ {hiddenHint}</div>}
      </div>
    </button>
  );
}

/* ── Template Row (List) ── */
function TemplateRow({ tpl, selected, defaultId, quality, onClick }) {
  const cat = catOf(tpl);
  const st = statOf(tpl._status);
  const isDefault = defaultId === (tpl.id || tpl.template_id);
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${selected ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5" : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/40 bg-[hsl(var(--card))]"}`}>
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${cat.grad} flex items-center justify-center shrink-0`}>
        <span className="text-lg">{cat.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-xs text-[hsl(var(--foreground))] truncate">{tpl.name || tpl.id}</div>
        <div className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{tpl._source} {cat.label !== "General" ? `· ${cat.label}` : ""} · {tpl._usage} sites</div>
      </div>
      <span className={`flex items-center gap-1 text-[10px] ${st.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span>
      <span className={`w-2 h-2 rounded-full shrink-0 ${quality.pass ? "bg-emerald-400" : "bg-red-400"}`} title={quality.pass ? "Pass" : "Fail"} />
      {isDefault && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">DEFAULT</span>}
    </button>
  );
}

/* ── Side Panel ── */
function SidePanel({ tpl, quality, usage, versions, defaultId, publishing, hiddenHint, onClose, onSetDefault, onUpdateStatus, onCreateVersion, onPublish, onRollback, onDelete }) {
  const cat = catOf(tpl);
  const st = statOf(tpl._status);
  const isDefault = defaultId === (tpl.id || tpl.template_id);
  const isCustom = !!tpl.dbId;
  const [showQuality, setShowQuality] = useState(false);

  return (
    <div className="flex flex-col">
      {/* Header gradient / OG image */}
      <div className={`h-24 bg-gradient-to-br ${cat.grad} flex items-end p-4 relative overflow-hidden`}>
        {(() => { const og = extractOgImage(tpl); return og ? <img src={og} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" onError={(e) => { e.target.style.display = "none"; }} /> : null; })()}
        <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center text-sm transition-colors z-10">✕</button>
        <div>
          <div className="text-white font-bold text-sm leading-tight">{tpl.name || tpl.id}</div>
          <div className="text-white/70 text-[10px] mt-0.5">{tpl.id || tpl.template_id}</div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Meta tags */}
        <div className="flex flex-wrap gap-1.5">
          <Tag>{tpl._source}</Tag>
          <Tag>{cat.label}</Tag>
          <Tag className={st.cls}><span className={`w-1.5 h-1.5 rounded-full ${st.dot} inline-block mr-1`} />{st.label}</Tag>
          {tpl.componentSource?.tier && <Tag>{tpl.componentSource.tier}</Tag>}
          {isDefault && <Tag className="text-emerald-400 border-emerald-400/30">DEFAULT</Tag>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Usage" value={`${usage.usageCount || tpl.usage_count || 0}`} sub="sites" />
          <StatCard label="Version" value={`v${tpl.current_version || 1}`} />
          <StatCard label="Updated" value={toDate(tpl.updated_at || tpl.created_at)} />
        </div>

        {/* Quality Gate */}
        <div className={`rounded-lg border p-3 cursor-pointer transition-colors ${quality.pass ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`} onClick={() => setShowQuality(!showQuality)}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${quality.pass ? "text-emerald-400" : "text-red-400"}`}>
              Quality Gate {quality.pass ? "✓ Pass" : "✗ Fail"}
            </span>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{quality.blocking.length + quality.warnings.length} checks · {showQuality ? "▲" : "▼"}</span>
          </div>
          {showQuality && (
            <div className="mt-2 space-y-1">
              {quality.blocking.map((x) => <div key={x} className="text-[10px] text-red-400">• {x}</div>)}
              {quality.warnings.map((x) => <div key={x} className="text-[10px] text-yellow-400">• {x}</div>)}
              {quality.pass && quality.warnings.length === 0 && <div className="text-[10px] text-emerald-400">All checks passed.</div>}
            </div>
          )}
        </div>

        {hiddenHint && <div className="text-[10px] text-yellow-400 bg-yellow-400/5 rounded-lg p-2">⚠ Wizard excluded: {hiddenHint}</div>}

        {/* Actions */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Actions</div>
          <div className="flex flex-wrap gap-1.5">
            {!isDefault && <Btn onClick={onSetDefault}>Set Default</Btn>}
            {isCustom && (
              <>
                <Btn onClick={() => onPublish(null)} disabled={publishing} primary>{publishing ? "Publishing..." : "Publish"}</Btn>
                <Btn onClick={onCreateVersion}>New Version</Btn>
              </>
            )}
          </div>
          {isCustom && (
            <div className="flex flex-wrap gap-1.5">
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] w-full mb-0.5">Status:</div>
              {["draft", "active", "deprecated", "archived"].map((s) => (
                <Btn key={s} onClick={() => onUpdateStatus(s)} className={tpl._status === s ? "ring-1 ring-[hsl(var(--primary))]" : ""}>
                  {s[0].toUpperCase() + s.slice(1)}
                </Btn>
              ))}
            </div>
          )}
          <Btn onClick={onDelete} danger>{isCustom ? "Delete Template" : "Hide from Lists"}</Btn>
        </div>

        {/* Version History */}
        <div>
          <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Version History</div>
          {!isCustom && <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Built-in template (not editable)</div>}
          {isCustom && versions.length === 0 && <div className="text-[10px] text-[hsl(var(--muted-foreground))]">No versions yet.</div>}
          {isCustom && versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] last:border-0">
              <div>
                <div className="text-xs font-semibold text-[hsl(var(--foreground))]">
                  v{v.version_number} {Number(v.version_number) === Number(tpl.current_version || 1) ? <span className="text-emerald-400 text-[9px]">(current)</span> : ""}
                </div>
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{v.note || "No note"} · {toDate(v.created_at)}</div>
              </div>
              <div className="flex gap-1">
                <Btn small onClick={() => onPublish(v.version_number)}>Publish</Btn>
                <Btn small onClick={() => onRollback(v.version_number)}>Rollback</Btn>
              </div>
            </div>
          ))}
        </div>

        {/* Usage Detail */}
        {(usage.sites || []).length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Active Sites</div>
            {usage.sites.map((s) => (
              <div key={s.siteId} className="flex items-center gap-2 py-1.5 border-b border-[hsl(var(--border))] last:border-0">
                <div className="w-6 h-6 rounded bg-[hsl(var(--accent))] flex items-center justify-center text-[10px] font-bold text-[hsl(var(--foreground))]">{String(s.brand || s.siteId || "?")[0].toUpperCase()}</div>
                <div>
                  <div className="text-xs font-medium text-[hsl(var(--foreground))]">{s.brand || s.siteId}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.domain || "-"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tiny UI pieces ── */
function Tag({ children, className = "" }) {
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] ${className}`}>{children}</span>;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 p-2.5 text-center">
      <div className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold text-[hsl(var(--foreground))] mt-0.5">{value}</div>
      {sub && <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{sub}</div>}
    </div>
  );
}

function Btn({ children, onClick, disabled, primary, danger, small, className = "" }) {
  const base = "rounded-lg border font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const size = small ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs";
  const variant = danger
    ? "border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent"
    : primary
    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white hover:opacity-90"
    : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]";
  return <button onClick={onClick} disabled={disabled} className={`${base} ${size} ${variant} ${className}`}>{children}</button>;
}

export default TemplateManager;
