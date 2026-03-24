import React, { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { THEME as T } from "../../constants";
import { Field } from "../ui/field";
import { getTemplateById, DEFAULT_TEMPLATE_ID, getAllTemplates, getTemplateDiagnostics, resolveWizardCategory } from "./template-utils";
import { getAllTemplatesAsync, deleteTemplate } from "../../utils/template-registry";

const CATEGORIES = [
    { id: "all", label: "All" },
    { id: "loan", label: "Loan" },
    { id: "pet", label: "Pet Finance" },
    { id: "custom", label: "Custom" },
];

export function StepTemplate({ c, u }) {
    const selectedTemplate = getTemplateById(c.templateId || DEFAULT_TEMPLATE_ID);
    const [templates, setTemplates] = useState(getAllTemplates());
    const [deletingId, setDeletingId] = useState(null);
    const [clearingBroken, setClearingBroken] = useState(false);
    const [filter, setFilter] = useState("all");
    const [showDebug, setShowDebug] = useState(false);

    useEffect(() => {
        let active = true;
        const load = () => {
            getAllTemplatesAsync().then(res => {
                if (active) setTemplates(res);
            });
        };
        load();
        const onRefresh = () => load();
        window.addEventListener('lp-template-refresh', onRefresh);
        return () => {
            active = false;
            window.removeEventListener('lp-template-refresh', onRefresh);
        };
    }, []);

    useEffect(() => {
        const current = templates.find(t => t.id === (c.templateId || DEFAULT_TEMPLATE_ID));
        if (current?.health && current.health.usable === false) {
            u("templateId", DEFAULT_TEMPLATE_ID);
        }
    }, [templates, c.templateId, u]);

    const handleDelete = async (e, tpl) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${tpl.name}"?`)) return;
        setDeletingId(tpl.dbId);
        try {
            await deleteTemplate(tpl.dbId);
            const updated = await getAllTemplatesAsync();
            setTemplates(updated);
            if (c.templateId === tpl.id) u("templateId", DEFAULT_TEMPLATE_ID);
        } catch (err) {
            console.error(err);
        } finally {
            setDeletingId(null);
        }
    };

    const handleClearAllBroken = async () => {
        const brokenCustom = templates.filter(t => t.source === 'api' && t.health && t.health.usable === false);
        const allCustom = templates.filter(t => t.source === 'api');
        const targets = brokenCustom.length > 0 ? brokenCustom : allCustom;
        if (targets.length === 0) { alert('No custom templates to clear.'); return; }
        const label = brokenCustom.length > 0 ? `${brokenCustom.length} broken custom template(s)` : `all ${allCustom.length} custom template(s)`;
        if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
        setClearingBroken(true);
        let failed = 0;
        for (const tpl of targets) {
            try { await deleteTemplate(tpl.dbId); } catch { failed++; }
        }
        const updated = await getAllTemplatesAsync();
        setTemplates(updated);
        if (targets.some(t => t.id === c.templateId)) u('templateId', DEFAULT_TEMPLATE_ID);
        setClearingBroken(false);
        if (failed > 0) alert(`Done. ${failed} template(s) failed to delete.`);
    };

    // Categorize templates
    const categorized = templates.map(tpl => ({ ...tpl, _cat: resolveWizardCategory(tpl) }));
    const filtered = filter === "all" ? categorized : categorized.filter(t => t._cat === filter);
    const diagnostics = getTemplateDiagnostics(categorized, { filterId: filter });
    const filterHiddenCount = diagnostics.hidden.filter((h) => h.reasons.some((r) => r.includes('Filtered out by category'))).length;
    const brokenCount = diagnostics.hidden.filter((h) => h.reasons.some((r) => !r.includes('Filtered out by category'))).length;

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🧩</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Template Selection</h2>
                <p style={{ fontSize: 12, color: T.muted }}>
                    Runtime templates loaded: {templates.length} ({diagnostics.bySource.module} module, {diagnostics.bySource.legacy} legacy, {diagnostics.bySource.api} custom)
                </p>
            </div>

            {/* Category Filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {CATEGORIES.map(cat => {
                    const count = cat.id === "all" ? categorized.length : categorized.filter(t => t._cat === cat.id).length;
                    if (count === 0 && cat.id !== "all") return null;
                    return (
                        <button key={cat.id} onClick={() => setFilter(cat.id)} style={{
                            padding: "6px 16px", fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: "pointer",
                            background: filter === cat.id ? T.primary : T.card2,
                            color: filter === cat.id ? "#fff" : T.text,
                            border: `1.5px solid ${filter === cat.id ? T.primary : T.border}`,
                            transition: "all 0.2s",
                        }}>
                            {cat.label} <span style={{ opacity: 0.6, marginLeft: 4 }}>({count})</span>
                        </button>
                    );
                })}
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 14 }}>
                {filter === "all"
                    ? `Visible ${filtered.length}/${categorized.length} templates. ${brokenCount > 0 ? `${brokenCount} broken.` : 'No broken templates detected.'}`
                    : `Filter "${filter}" hides ${filterHiddenCount} template(s). Showing ${filtered.length}.`}
            </div>

            {/* Template Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {filtered.map(tpl => {
                    const active = (c.templateId || DEFAULT_TEMPLATE_ID) === tpl.id;
                    const isCustom = tpl.source === 'api';
                    const isDeleting = deletingId === tpl.dbId;
                    const isBroken = tpl.health && tpl.health.usable === false;

                    // Preview gradient based on category
                    const previewBg = tpl._cat === 'pet'
                        ? "linear-gradient(160deg, hsl(35 80% 95%), hsl(170 40% 92%))"
                        : tpl._cat === 'custom'
                        ? "linear-gradient(135deg, hsl(280 40% 18%), hsl(260 35% 10%))"
                        : "linear-gradient(180deg, hsl(215 60% 52%), hsl(215 55% 38%))";
                    const previewDark = tpl._cat === 'pet';
                    const previewIcon = tpl._cat === 'pet' ? "🐾" : tpl._cat === 'custom' ? "⚡" : "💰";

                    return (
                        <div key={tpl.id} style={{ position: 'relative' }}>
                            <button
                                onClick={() => !isBroken && u("templateId", tpl.id)}
                                disabled={isDeleting || isBroken}
                                style={{
                                    width: '100%', padding: 0, overflow: "hidden", textAlign: "left", cursor: isDeleting ? "wait" : (isBroken ? "not-allowed" : "pointer"),
                                    background: active ? T.primaryGlow : T.card2,
                                    border: `2px solid ${active ? T.primary : T.border}`,
                                    borderRadius: 12, position: "relative", color: T.text,
                                    transition: "all 0.2s ease",
                                    boxShadow: active ? `0 0 24px ${T.primary}20` : "none",
                                    opacity: (isDeleting || isBroken) ? 0.5 : 1,
                                }}
                                title={isBroken ? (tpl.health?.reason || "Template is invalid") : ""}
                            >
                                {/* Thumbnail Preview */}
                                <div style={{
                                    height: 90, background: previewBg,
                                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                    gap: 2, position: "relative", borderBottom: `1px solid ${T.border}`,
                                }}>
                                    <div style={{ fontSize: 22 }}>{previewIcon}</div>
                                    <div style={{
                                        fontSize: 13, fontWeight: 800,
                                        color: previewDark ? "hsl(220 20% 18%)" : "#fff",
                                        letterSpacing: "-.3px",
                                    }}>{tpl.name}</div>

                                    {tpl.badge && (
                                        <div style={{
                                            position: "absolute", top: 8, right: 10,
                                            fontSize: 9, padding: "3px 10px", fontWeight: 800,
                                            background: tpl.badge === "V2" || tpl.badge === "Advanced"
                                                ? "hsl(250 60% 55%)" : "rgba(255,255,255,.2)",
                                            borderRadius: 6, color: "#fff",
                                            textTransform: "uppercase", letterSpacing: ".02em",
                                        }}>{tpl.badge}</div>
                                    )}
                                    {isBroken && (
                                        <div style={{
                                            position: "absolute", top: 8, left: 10,
                                            fontSize: 9, padding: "3px 8px", fontWeight: 800,
                                            background: "rgba(239,68,68,.85)",
                                            borderRadius: 6, color: "#fff",
                                            textTransform: "uppercase", letterSpacing: ".02em",
                                        }}>Broken</div>
                                    )}

                                    {active && (
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: T.primary
                                        }} />
                                    )}
                                </div>

                                {/* Info */}
                                <div style={{ padding: "10px 14px" }}>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>{tpl.name}</div>
                                    <div style={{ fontSize: 11, color: T.dim, marginTop: 3, lineHeight: 1.4 }}>{tpl.description}</div>
                                </div>
                            </button>

                            {/* Delete button for custom templates */}
                            {isCustom && !isDeleting && (
                                <button
                                    onClick={(e) => handleDelete(e, tpl)}
                                    style={{
                                        position: 'absolute', top: -6, right: -6,
                                        width: 24, height: 24, borderRadius: '50%',
                                        background: T.danger, color: '#fff', border: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                        zIndex: 5, opacity: 0, transition: 'opacity 0.2s',
                                    }}
                                    className="delete-tpl-btn"
                                    title="Delete template"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                            <style>{`div:hover > .delete-tpl-btn { opacity: 1 !important; }`}</style>
                        </div>
                    );
                })}
            </div>

            <div style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                    onClick={() => setShowDebug((p) => !p)}
                    style={{
                        padding: "7px 12px",
                        fontSize: 11,
                        borderRadius: 8,
                        border: `1px solid ${T.border}`,
                        background: T.card2,
                        color: T.text,
                        cursor: "pointer",
                    }}
                >
                    {showDebug ? "Hide Template Debug" : "Show Template Debug"}
                </button>
                {templates.some(t => t.source === 'api') && (
                    <button
                        onClick={handleClearAllBroken}
                        disabled={clearingBroken}
                        style={{
                            padding: "7px 12px",
                            fontSize: 11,
                            borderRadius: 8,
                            border: `1px solid ${T.danger}50`,
                            background: clearingBroken ? T.card2 : `${T.danger}15`,
                            color: clearingBroken ? T.muted : T.danger,
                            cursor: clearingBroken ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4,
                        }}
                    >
                        <Trash2 size={11} />
                        {clearingBroken ? 'Clearing...' : (
                            templates.filter(t => t.source === 'api' && t.health?.usable === false).length > 0
                                ? `Clear Broken (${templates.filter(t => t.source === 'api' && t.health?.usable === false).length})`
                                : 'Clear All Custom'
                        )}
                    </button>
                )}
            </div>

            {showDebug && (
                <div style={{
                    background: T.card2,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 20,
                    fontSize: 11,
                }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Template Diagnostics</div>
                    <div style={{ color: T.muted, marginBottom: 8 }}>
                        Total {diagnostics.total} · Visible {diagnostics.visibleCount} · Excluded/Non-selectable {diagnostics.hiddenCount}
                    </div>
                    <div style={{ marginBottom: 8, color: T.muted }}>
                        Sources: module {diagnostics.bySource.module}, legacy {diagnostics.bySource.legacy}, custom {diagnostics.bySource.api}
                    </div>
                    <div style={{ maxHeight: 160, overflowY: "auto", borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                        {diagnostics.hidden.length === 0 && <div style={{ color: T.success }}>No excluded templates.</div>}
                        {diagnostics.hidden.map((item) => (
                            <div key={item.id} style={{ padding: "5px 0", borderBottom: `1px dashed ${T.border}` }}>
                                <div style={{ fontWeight: 600 }}>{item.name} <span style={{ color: T.dim }}>({item.id})</span></div>
                                <div style={{ color: T.muted }}>source={item.source}, category={item.wizardCategory}</div>
                                <div style={{ color: T.warning }}>
                                    {item.reasons.join(" | ")}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Selected Summary */}
            <div style={{
                padding: "14px 18px",
                background: `${T.primary}08`,
                border: `1.5px solid ${T.primary}30`,
                borderRadius: 12,
                display: "flex", alignItems: "center", gap: 14,
            }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "linear-gradient(135deg, hsl(215 60% 52%), hsl(215 55% 38%))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0,
                }}>🧩</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedTemplate?.name || "Classic LP"}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{selectedTemplate?.description || "Default template"}</div>
                </div>
                <div style={{
                    fontSize: 10, fontWeight: 700, padding: "5px 12px",
                    background: `${T.primary}15`, color: T.primary,
                    borderRadius: 8, border: `1px solid ${T.primary}30`,
                }}>Selected</div>
            </div>
        </>
    );
}
