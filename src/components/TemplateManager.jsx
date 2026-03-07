import React, { useEffect, useMemo, useState } from "react";
import { THEME as T } from "../constants";
import { api } from "../services/api";
import { getAllTemplatesAsync, getTemplateDiagnostics, hideBuiltinTemplate } from "../utils/template-registry";

function validateTemplateQuality(template) {
  const files = typeof template.files === "object" && template.files ? template.files : {};
  const sourceCode = String(template.source_code || template.sourceCode || "");
  const category = String(template.category || "").toLowerCase();
  const keys = Object.keys(files);
  const combined = sourceCode + JSON.stringify(files);
  const entryOk = keys.some((k) => k.endsWith("index.astro") || k.endsWith("index.html")) || /<html|<!doctype html/i.test(sourceCode);
  const pixelMarker = /sendBeacon|t\.[^"' ]+\/e|window\.pixel/i.test(combined);
  const trackingMarker = /gtag\(|AW-\d+|form_start|form_submit/i.test(combined);
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(combined);
  const hasPrimaryToken = /--color-primary|var\(--color-primary\)|hsl\(var\(--primary\)\)/i.test(combined);
  const hasExpressionLeak = /\{title\}|\{description\}|\{\s*noindex\s*\?|\{\s*[a-zA-Z_$][\w$]*\s*&&\s*\(/.test(combined);
  const hasCalculator = /calculator|monthly payment|calcMonthly|loanAmount|payment estimate/i.test(combined);
  const hasAprCompare = /representative apr|apr range|<table[\s\S]*apr|term[\s\S]*apr/i.test(combined);
  const bannedPatterns = [
    /guaranteed approval/i,
    /guaranteed loan/i,
    /100%\s*approval/i,
    /everyone approved/i,
    /instant cash now/i,
    /free money/i,
    /zero risk/i,
  ];
  const matchedBanned = bannedPatterns.filter((p) => p.test(combined)).map((p) => p.toString());
  const blocking = [];
  const warnings = [];
  if (!entryOk) blocking.push("Missing template entry (index.astro or index.html).");
  if (!pixelMarker) blocking.push("Missing first-party pixel marker (sendBeacon / t.domain/e).");
  if (hasExpressionLeak) blocking.push("Potential Astro expression leak detected ({title}/{...&&(...)}).");
  if (matchedBanned.length > 0) blocking.push(`Policy-risk copy detected: ${matchedBanned.join(", ")}`);
  if (/(installment|loan|pdl|pet-care)/i.test(category)) {
    if (!hasCalculator) blocking.push("Missing Payment Calculator section for loan template.");
    if (!hasAprCompare) blocking.push("Missing APR Compare/Representative APR section for loan template.");
  }
  if (!hasViewport) warnings.push("Viewport meta not detected (mobile UX risk).");
  if (!hasPrimaryToken) warnings.push("Primary color token not detected (--color-primary / var(--primary)).");
  if (!trackingMarker) warnings.push("Google Ads tracking markers not detected.");
  return {
    pass: blocking.length === 0,
    blocking,
    warnings,
  };
}

function toDate(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
}

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

  const loadAll = async () => {
    setLoading(true);
    try {
      const [allTemplates, defaultRes] = await Promise.all([
        getAllTemplatesAsync(),
        api.get("/templates/default"),
      ]);
      setTemplates(allTemplates || []);
      if (defaultRes?.templateId) setDefaultTemplateId(defaultRes.templateId);
      if (!selectedId && allTemplates?.length) {
        setSelectedId(allTemplates[0].dbId || allTemplates[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => {
    return templates.find((t) => (t.dbId || t.id) === selectedId) || null;
  }, [templates, selectedId]);

  useEffect(() => {
    const loadMeta = async () => {
      if (!selected?.dbId) {
        setUsage({ usageCount: 0, sites: [] });
        setVersions([]);
        return;
      }
      const [u, v] = await Promise.all([
        api.get(`/templates/${selected.dbId}/usage`),
        api.get(`/templates/${selected.dbId}/versions`),
      ]);
      setUsage({ usageCount: u?.usageCount || 0, sites: u?.sites || [] });
      setVersions(v?.versions || []);
    };
    loadMeta();
  }, [selected?.dbId]);

  const mergedTemplates = useMemo(() => {
    return (templates || []).map((t) => {
      const id = t.dbId || t.id;
      const siteUsage = sites.filter((s) => String(s.templateId || "") === String(t.id || t.template_id || "")).length;
      return {
        ...t,
        _id: id,
        _source: t.source || (t.dbId ? "api" : "module"),
        _status: t.status || (t.source === "api" ? "draft" : "active"),
        _usage: Number(t.usage_count || siteUsage || 0),
      };
    });
  }, [templates, sites]);

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
    for (const item of wizardDiagnostics.hidden || []) {
      map.set(item.id, item.reasons.join(" | "));
    }
    return map;
  }, [wizardDiagnostics.hidden]);

  const selectedQuality = useMemo(() => validateTemplateQuality(selected || {}), [selected]);

  const updateStatus = async (status) => {
    if (!selected?.dbId) return;
    const res = await api.put(`/templates/${selected.dbId}`, { status });
    if (res?.error) return notify?.(res.error, "danger");
    notify?.(`Template status -> ${status}`, "success");
    await loadAll();
  };

  const createVersion = async () => {
    if (!selected?.dbId) return;
    const note = window.prompt("Version note (optional):", "Manual snapshot") || "Manual snapshot";
    const res = await api.put(`/templates/${selected.dbId}`, { createVersion: true, note });
    if (res?.error) return notify?.(res.error, "danger");
    notify?.(`Created version v${res.versionNumber || "?"}`, "success");
    await loadAll();
  };

  const publish = async (version = null) => {
    if (!selected?.dbId) return;
    if (!selectedQuality.pass) {
      notify?.("Publish blocked: fix critical validation errors first.", "danger");
      return;
    }
    setPublishing(true);
    let res;
    try {
      res = await api.post(`/templates/${selected.dbId}/publish`, version ? { version } : {});
    } finally {
      setPublishing(false);
    }
    if (res?.error) {
      const backendBlocking = Array.isArray(res?.quality?.blocking) ? res.quality.blocking : [];
      if (backendBlocking.length > 0) {
        return notify?.(`${res.error}: ${backendBlocking.join(" | ")}`, "danger");
      }
      return notify?.(res.error, "danger");
    }
    notify?.(`Published template${version ? ` v${version}` : ""}`, "success");
    await loadAll();
  };

  const rollback = async (version) => {
    if (!selected?.dbId || !version) return;
    const ok = window.confirm(`Rollback to v${version}?`);
    if (!ok) return;
    const res = await api.post(`/templates/${selected.dbId}/rollback`, { version });
    if (res?.error) return notify?.(res.error, "danger");
    notify?.(`Rolled back to v${version}`, "success");
    await loadAll();
  };

  const softDelete = async () => {
    if (!selected?.dbId) return;
    if (!window.confirm(`Delete template "${selected.name}"?`)) return;
    const res = await api.del(`/templates/${selected.dbId}`);
    if (res?.error) return notify?.(res.error, "danger");
    notify?.("Template deleted", "success");
    await loadAll();
  };

  const hideBuiltin = () => {
    if (!selected) return;
    if (!window.confirm(`Hide "${selected.name}" from all lists? (Can restore via browser console: localStorage.removeItem('lp_hidden_builtin_templates'))`)) return;
    hideBuiltinTemplate(selected.id);
    notify?.(`Hidden "${selected.name}" from template lists`, "success");
    setSelectedId("");
    loadAll();
  };

  const saveDefault = async (templateId) => {
    const res = await api.put("/templates/default", { templateId });
    if (res?.error) return notify?.(res.error, "danger");
    setDefaultTemplateId(templateId);
    onDefaultTemplateChange?.(templateId);
    notify?.(`Default template set: ${templateId}`, "success");
  };

  return (
    <div>
      {/* ── TOOLBAR ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginRight: 4 }}>
          Templates <span style={{ color: T.muted, fontWeight: 400, fontSize: 12 }}>({filtered.length})</span>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          style={{ padding: "7px 12px", background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, width: 180, fontSize: 13 }}
        />
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ padding: "7px 10px", background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}>
          <option value="all">All Sources</option>
          <option value="module">Module</option>
          <option value="legacy">Legacy</option>
          <option value="api">API Custom</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "7px 10px", background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="deprecated">Deprecated</option>
          <option value="archived">Archived</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: "7px 10px", background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }}>
          <option value="newest">Newest</option>
          <option value="usage">Most Used</option>
          <option value="name">Name A–Z</option>
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {["grid", "list"].map((m) => (
            <button key={m} onClick={() => setViewMode(m)} style={{ padding: "6px 12px", background: viewMode === m ? T.primary : T.card2, color: viewMode === m ? "#fff" : T.text, border: `1px solid ${viewMode === m ? T.primary : T.border}`, borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
              {m === "grid" ? "⊞ Grid" : "☰ List"}
            </button>
          ))}
        </div>
      </div>

      {/* ── FULL TEMPLATE GRID ── */}
      {loading && <div style={{ color: T.muted, padding: 20 }}>Loading templates...</div>}
      {!loading && (
        <div style={{
          display: "grid",
          gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fill, minmax(260px, 1fr))" : "1fr",
          gap: viewMode === "grid" ? 10 : 6,
        }}>
          {filtered.map((tpl) => {
            const isSelected = selectedId === tpl._id;
            const isDefault = defaultTemplateId === (tpl.id || tpl.template_id);
            const hiddenHint = hiddenReasonsById.get(tpl.id);
            const isBroken = tpl.health?.usable === false;
            return (
              <button
                key={tpl._id}
                onClick={() => setSelectedId(isSelected ? "" : tpl._id)}
                style={{
                  textAlign: "left",
                  background: isSelected ? `${T.primary}18` : T.card,
                  border: `1.5px solid ${isSelected ? T.primary : isBroken ? T.danger : T.border}`,
                  borderRadius: 10,
                  padding: viewMode === "grid" ? "12px 14px" : "9px 12px",
                  color: T.text,
                  cursor: "pointer",
                  transition: "border-color .15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                  <b style={{ fontSize: 13, lineHeight: 1.3 }}>{tpl.name || tpl.id}</b>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {isDefault && <span style={{ fontSize: 9, background: T.success, color: "#fff", borderRadius: 4, padding: "2px 5px", fontWeight: 700 }}>DEFAULT</span>}
                    {isBroken && <span style={{ fontSize: 9, background: T.danger, color: "#fff", borderRadius: 4, padding: "2px 5px", fontWeight: 700 }}>BROKEN</span>}
                    {tpl.badge && <span style={{ fontSize: 9, background: `${T.primary}22`, color: T.primary, borderRadius: 4, padding: "2px 5px", fontWeight: 700 }}>{tpl.badge}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{tpl.id || tpl.template_id}</div>
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: "3px 10px", fontSize: 10, color: T.muted }}>
                  <span>{tpl._source}</span>
                  <span>·</span>
                  <span style={{ color: tpl._status === "active" ? T.success : T.muted }}>{tpl._status}</span>
                  <span>·</span>
                  <span>Usage: {tpl._usage}</span>
                  {tpl.category && <><span>·</span><span>{tpl.category}</span></>}
                </div>
                {hiddenHint && (
                  <div style={{ marginTop: 5, fontSize: 10, color: T.warning, lineHeight: 1.3 }}>⚠ {hiddenHint}</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── DETAIL PANEL (inline below selected card) ── */}
      {selected && (
        <div style={{ marginTop: 16, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{selected.name || selected.id}</div>
              <div style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>
                {selected.id || selected.template_id} · {selected.sourceResolved || selected.source || "module"} · {selected.status || "active"} · {selected.componentSource?.label || "Internal"} ({selected.componentSource?.tier || "free"})
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => saveDefault(selected.id || selected.template_id)} style={{ padding: "7px 12px", background: defaultTemplateId === (selected.id || selected.template_id) ? T.success : T.primary, color: "#fff", border: 0, borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
                {defaultTemplateId === (selected.id || selected.template_id) ? "✓ Default" : "Set Default"}
              </button>
              <button onClick={() => setSelectedId("")} style={{ ...btnGhost, padding: "7px 10px" }}>✕ Close</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <Stat label="Usage Impact" value={`${usage.usageCount || selected.usage_count || 0} sites`} />
            <Stat label="Current Version" value={`v${selected.current_version || 1}`} />
            <Stat label="Updated" value={toDate(selected.updated_at || selected.created_at)} />
          </div>

          <div style={{ padding: 12, border: `1px solid ${selectedQuality.pass ? T.success : T.danger}`, borderRadius: 8, background: selectedQuality.pass ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Quality Gate {selectedQuality.pass ? "✓ Pass" : "✗ Fail"}</div>
            {selectedQuality.blocking.map((x) => <div key={x} style={{ color: T.danger, fontSize: 12 }}>- {x}</div>)}
            {selectedQuality.warnings.map((x) => <div key={x} style={{ color: T.warning, fontSize: 12 }}>- {x}</div>)}
            {selectedQuality.pass && selectedQuality.warnings.length === 0 && <div style={{ color: T.success, fontSize: 12 }}>All checks passed.</div>}
          </div>

          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>
            Registry: {selected.registryPath || "n/a"}
            {selected.collisionReason ? ` · Collision: ${selected.collisionReason}` : ""}
            {hiddenReasonsById.get(selected.id) ? ` · ⚠ Wizard excluded: ${hiddenReasonsById.get(selected.id)}` : ""}
          </div>

          {selected.dbId ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <button onClick={() => updateStatus("draft")} style={btnGhost}>Draft</button>
              <button onClick={() => updateStatus("active")} style={btnGhost}>Active</button>
              <button onClick={() => updateStatus("deprecated")} style={btnGhost}>Deprecated</button>
              <button onClick={() => updateStatus("archived")} style={btnGhost}>Archived</button>
              <button onClick={createVersion} style={btnGhost}>Create Version</button>
              <button onClick={() => publish(null)} disabled={publishing} style={{ ...btnPrimary, opacity: publishing ? 0.6 : 1 }}>Publish</button>
              <button onClick={softDelete} style={{ ...btnGhost, borderColor: T.danger, color: T.danger }}>Delete</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: T.muted }}>Built-in template — cannot delete from DB</span>
              <button onClick={hideBuiltin} style={{ ...btnGhost, borderColor: T.warning, color: T.warning }}>Hide from Lists</button>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Version History</div>
              {!selected.dbId && <div style={{ color: T.muted, fontSize: 12 }}>Built-in: not editable.</div>}
              {selected.dbId && versions.length === 0 && <div style={{ color: T.muted, fontSize: 12 }}>No versions yet.</div>}
              {selected.dbId && versions.map((v) => (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 6, background: T.card2 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>v{v.version_number} {Number(v.version_number) === Number(selected.current_version || 1) ? "(current)" : ""}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{v.note || "No note"} · {toDate(v.created_at)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => publish(v.version_number)} style={btnGhost}>Publish</button>
                    <button onClick={() => rollback(v.version_number)} style={btnGhost}>Rollback</button>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Usage Detail</div>
              {(usage.sites || []).length === 0 && <div style={{ color: T.muted, fontSize: 12 }}>No active site references.</div>}
              {(usage.sites || []).map((s) => (
                <div key={s.siteId} style={{ fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                  <b>{s.brand || s.siteId}</b> <span style={{ color: T.muted }}>({s.domain || "-"})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 10, color: T.muted }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const btnGhost = {
  padding: "8px 10px",
  background: T.card2,
  color: T.text,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
};

const btnPrimary = {
  ...btnGhost,
  background: T.primary,
  color: "#fff",
  borderColor: T.primary,
};

export default TemplateManager;
