import React, { useEffect, useMemo, useState } from "react";
import { THEME as T } from "../constants";
import { api } from "../services/api";
import { getAllTemplatesAsync } from "../utils/template-registry";

function validateTemplateQuality(template) {
  const files = typeof template.files === "object" && template.files ? template.files : {};
  const sourceCode = String(template.source_code || template.sourceCode || "");
  const keys = Object.keys(files);
  const entryOk = keys.some((k) => k.endsWith("index.astro") || k.endsWith("index.html")) || /<html|<!doctype html/i.test(sourceCode);
  const pixelMarker = /sendBeacon|t\.[^"' ]+\/e|window\.pixel/i.test(sourceCode + JSON.stringify(files));
  const trackingMarker = /gtag\(|AW-\d+|form_start|form_submit/i.test(sourceCode + JSON.stringify(files));
  const blocking = [];
  const warnings = [];
  if (!entryOk) blocking.push("Missing template entry (index.astro or index.html).");
  if (!pixelMarker) blocking.push("Missing first-party pixel marker (sendBeacon / t.domain/e).");
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
    if (res?.error) return notify?.(res.error, "danger");
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

  const saveDefault = async (templateId) => {
    const res = await api.put("/templates/default", { templateId });
    if (res?.error) return notify?.(res.error, "danger");
    setDefaultTemplateId(templateId);
    onDefaultTemplateChange?.(templateId);
    notify?.(`Default template set: ${templateId}`, "success");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Template Inventory</div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search template..." style={{ width: "100%", padding: 10, background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 8 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ padding: 8, background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8 }}>
            <option value="all">All Sources</option>
            <option value="module">Module</option>
            <option value="legacy">Legacy</option>
            <option value="api">API Custom</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: 8, background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8 }}>
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="deprecated">Deprecated</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: 8, background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8 }}>
            <option value="newest">Newest</option>
            <option value="usage">Most Used</option>
            <option value="name">Name</option>
          </select>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value)} style={{ padding: 8, background: T.input, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8 }}>
            <option value="grid">Grid</option>
            <option value="list">List</option>
          </select>
        </div>

        <div style={{ maxHeight: 560, overflow: "auto", display: "grid", gridTemplateColumns: viewMode === "grid" ? "1fr" : "1fr", gap: 8 }}>
          {loading && <div style={{ color: T.muted }}>Loading templates...</div>}
          {!loading && filtered.map((tpl) => (
            <button
              key={tpl._id}
              onClick={() => setSelectedId(tpl._id)}
              style={{
                textAlign: "left",
                background: selectedId === tpl._id ? `${T.primary}22` : T.card2,
                border: `1px solid ${selectedId === tpl._id ? T.primary : T.border}`,
                borderRadius: 8,
                padding: 10,
                color: T.text,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <b style={{ fontSize: 13 }}>{tpl.name || tpl.id}</b>
                <span style={{ fontSize: 10, color: T.muted }}>{tpl._source}</span>
              </div>
              <div style={{ fontSize: 11, color: T.dim, marginTop: 3 }}>{tpl.id || tpl.template_id}</div>
              <div style={{ marginTop: 6, display: "flex", gap: 6, fontSize: 10, color: T.muted }}>
                <span>Status: {tpl._status}</span>
                <span>Usage: {tpl._usage}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
        {!selected && <div style={{ color: T.muted }}>Select a template to view details.</div>}
        {selected && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{selected.name || selected.id}</div>
                <div style={{ color: T.muted, fontSize: 12 }}>{selected.id || selected.template_id} · {selected.source || "module"} · {selected.status || "active"}</div>
              </div>
              <button onClick={() => saveDefault(selected.id || selected.template_id)} style={{ padding: "8px 12px", background: defaultTemplateId === (selected.id || selected.template_id) ? T.success : T.primary, color: "#fff", border: 0, borderRadius: 8, cursor: "pointer" }}>
                {defaultTemplateId === (selected.id || selected.template_id) ? "Default Template" : "Set Default"}
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <Stat label="Usage Impact" value={`${usage.usageCount || selected.usage_count || 0} sites`} />
              <Stat label="Current Version" value={`v${selected.current_version || 1}`} />
              <Stat label="Updated" value={toDate(selected.updated_at || selected.created_at)} />
            </div>

            <div style={{ marginTop: 14, padding: 12, border: `1px solid ${selectedQuality.pass ? T.success : T.danger}`, borderRadius: 8, background: selectedQuality.pass ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Quality Gate {selectedQuality.pass ? "Pass" : "Fail"}</div>
              {selectedQuality.blocking.map((x) => <div key={x} style={{ color: T.danger, fontSize: 12 }}>- {x}</div>)}
              {selectedQuality.warnings.map((x) => <div key={x} style={{ color: T.warning, fontSize: 12 }}>- {x}</div>)}
              {selectedQuality.pass && selectedQuality.warnings.length === 0 && <div style={{ color: T.success, fontSize: 12 }}>All required checks passed.</div>}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selected.dbId && (
                <>
                  <button onClick={() => updateStatus("draft")} style={btnGhost}>Draft</button>
                  <button onClick={() => updateStatus("active")} style={btnGhost}>Active</button>
                  <button onClick={() => updateStatus("deprecated")} style={btnGhost}>Deprecated</button>
                  <button onClick={() => updateStatus("archived")} style={btnGhost}>Archived</button>
                  <button onClick={createVersion} style={btnGhost}>Create Version</button>
                  <button onClick={() => publish(null)} disabled={publishing} style={{ ...btnPrimary, opacity: publishing ? 0.6 : 1 }}>Publish</button>
                  <button onClick={softDelete} style={{ ...btnGhost, borderColor: T.danger, color: T.danger }}>Delete</button>
                </>
              )}
            </div>

            <div style={{ marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Version History</div>
              {!selected.dbId && <div style={{ color: T.muted, fontSize: 12 }}>Built-in template: version history not editable.</div>}
              {selected.dbId && versions.length === 0 && <div style={{ color: T.muted, fontSize: 12 }}>No versions yet.</div>}
              {selected.dbId && versions.map((v) => (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 6, background: T.card2 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>v{v.version_number} {Number(v.version_number) === Number(selected.current_version || 1) ? "(current)" : ""}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{v.note || "No note"} · {toDate(v.created_at)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => publish(v.version_number)} style={btnGhost}>Publish v{v.version_number}</button>
                    <button onClick={() => rollback(v.version_number)} style={btnGhost}>Rollback</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Usage Detail</div>
              {(usage.sites || []).length === 0 && <div style={{ color: T.muted, fontSize: 12 }}>No active site references found.</div>}
              {(usage.sites || []).map((s) => (
                <div key={s.siteId} style={{ fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                  <b>{s.brand || s.siteId}</b> <span style={{ color: T.muted }}>({s.domain || "-"})</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
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
