import React, { useState, useEffect, useMemo } from "react";
import { Trash2, Camera } from "lucide-react";
import { THEME as T } from "../../constants";
import { generateFavicon, generateOgImage } from "../../utils/image-gen";
import { getTemplateById, DEFAULT_TEMPLATE_ID, getAllTemplates, getTemplateDiagnostics, resolveWizardCategory, buildTemplateThumbnailUrl } from "./template-utils";
import { getAllTemplatesAsync, deleteTemplate } from "../../utils/template-registry";
import { api } from "../../services/api";
import { buildThumbnailPreviewDocument } from "../../utils/template-thumbnail-preview.js";
import { getTemplateFileContent } from "../../utils/template-analyzer.js";

const CATEGORIES = [
    { id: "all", label: "All" },
    { id: "loan", label: "Loan" },
    { id: "pet", label: "Pet Finance" },
    { id: "custom", label: "Custom" },
];

/** Small inline preview for a template row (56x56px area). */
function RowThumb({ tpl }) {
    const isCustom = tpl.source === "api";
    const hasDistIndex =
        isCustom &&
        tpl.dbId &&
        tpl.files &&
        typeof tpl.files === "object" &&
        !!getTemplateFileContent(tpl.files, "dist/index.html");

    const thumbSrc = buildTemplateThumbnailUrl(tpl);

    const doc = useMemo(() => {
        if (!hasDistIndex) return "";
        try {
            return buildThumbnailPreviewDocument(tpl.files, { dbId: tpl.dbId, brand: tpl.name || "Preview" });
        } catch { return ""; }
    }, [hasDistIndex, tpl.files, tpl.dbId, tpl.name]);

    const previewBg = tpl._cat === "pet"
        ? "linear-gradient(160deg, hsl(35 80% 95%), hsl(170 40% 92%))"
        : tpl._cat === "custom"
        ? "linear-gradient(135deg, hsl(280 40% 18%), hsl(260 35% 10%))"
        : "linear-gradient(180deg, hsl(215 60% 52%), hsl(215 55% 38%))";
    const icon = tpl._cat === "pet" ? "🐾" : tpl._cat === "custom" ? "⚡" : "💰";

    return (
        <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", flexShrink: 0, position: "relative", background: "#0f1419" }}>
            {doc ? (
                <iframe
                    title=""
                    srcDoc={doc}
                    sandbox="allow-scripts allow-same-origin"
                    style={{
                        position: "absolute", top: 0, left: "50%",
                        width: 390, height: 844, marginLeft: -195, border: "none",
                        transform: "scale(0.143)", transformOrigin: "top center",
                        pointerEvents: "none",
                    }}
                />
            ) : thumbSrc ? (
                <img src={thumbSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} onError={e => { e.target.style.display = "none"; }} />
            ) : (
                <div style={{ width: "100%", height: "100%", background: previewBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{icon}</div>
            )}
        </div>
    );
}

export function StepTemplateDesign({ c, u, notify, onHoverTemplate, designCapabilities }) {
    const caps = {
        supportsSectionReorder: true,
        ...(designCapabilities || {}),
    };

    const selectedTemplate = getTemplateById(c.templateId || DEFAULT_TEMPLATE_ID);
    const [templates, setTemplates] = useState(getAllTemplates());
    const [deletingId, setDeletingId] = useState(null);
    const [clearingBroken, setClearingBroken] = useState(false);
    const [filter, setFilter] = useState("all");
    const [showDebug, setShowDebug] = useState(false);
    const [generatingThumb, setGeneratingThumb] = useState(null);
    const [uploadingThumb, setUploadingThumb] = useState(null);
    const [genLoading, setGenLoading] = useState(false);

    const hasSectionPanel = caps.supportsSectionReorder;

    useEffect(() => {
        let active = true;
        const load = () => {
            getAllTemplatesAsync().then(res => { if (active) setTemplates(res); });
        };
        load();
        const onRefresh = () => load();
        window.addEventListener("lp-template-refresh", onRefresh);
        return () => { active = false; window.removeEventListener("lp-template-refresh", onRefresh); };
    }, []);

    useEffect(() => {
        const current = templates.find(t => t.id === (c.templateId || DEFAULT_TEMPLATE_ID));
        if (current?.health && current.health.usable === false) u("templateId", DEFAULT_TEMPLATE_ID);
    }, [templates, c.templateId, u]);

    // Auto-generate brand images when brand changes
    useEffect(() => {
        if (!c.brand?.trim()) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const favicon = generateFavicon(c);
                const ogImage = await generateOgImage(c);
                if (cancelled) return;
                u("faviconDataUrl", favicon);
                u("ogImageDataUrl", ogImage);
            } catch (e) { console.error("Auto image gen failed:", e); }
        }, 150);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [c.brand]); // eslint-disable-line react-hooks/exhaustive-deps

    const refreshTemplates = async () => {
        const updated = await getAllTemplatesAsync();
        setTemplates(updated);
        window.dispatchEvent(new CustomEvent("lp-template-refresh"));
    };

    const handleDelete = async (e, tpl) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${tpl.name}"?`)) return;
        setDeletingId(tpl.dbId);
        try {
            await deleteTemplate(tpl.dbId);
            const updated = await getAllTemplatesAsync();
            setTemplates(updated);
            if (c.templateId === tpl.id) u("templateId", DEFAULT_TEMPLATE_ID);
        } catch (err) { console.error(err); }
        finally { setDeletingId(null); }
    };

    const handleGenerateThumb = async (e, tpl) => {
        e.preventDefault(); e.stopPropagation();
        if (!tpl.dbId) return;
        setGeneratingThumb(tpl.dbId);
        notify?.("กำลังโหลดรายละเอียดเทมเพลต + สร้างภาพ…", "info");
        const detail = await api.get(`/templates/${tpl.dbId}`);
        if (detail?.error) { setGeneratingThumb(null); notify?.(String(detail.error), "warning"); return; }
        const files = detail?.files && typeof detail.files === "object" ? detail.files : {};
        if (!Object.keys(files).length) { setGeneratingThumb(null); notify?.("ไม่มีไฟล์ในเทมเพลต", "warning"); return; }
        let previewHtml;
        try {
            previewHtml = buildThumbnailPreviewDocument(files, { dbId: tpl.dbId, brand: detail?.name || tpl.name });
        } catch (err) { setGeneratingThumb(null); notify?.(String(err?.message || err), "warning"); return; }
        const res = await api.post(`/templates/${tpl.dbId}/generate-thumb`, { previewHtml });
        setGeneratingThumb(null);
        if (res.error) { notify?.(String(res.error), "warning"); return; }
        notify?.("บันทึก thumbnail แล้ว", "success");
        await refreshTemplates();
    };

    const handleUploadThumb = async (e, tpl) => {
        e.preventDefault(); e.stopPropagation();
        const input = e.target;
        const file = input.files?.[0];
        input.value = "";
        if (!file || !tpl.dbId) return;
        setUploadingThumb(tpl.dbId);
        const fd = new FormData();
        fd.append("image", file);
        const res = await api.postForm(`/templates/${tpl.dbId}/upload-thumb`, fd);
        setUploadingThumb(null);
        if (res.error) { notify?.(String(res.error), "warning"); return; }
        notify?.("อัปโหลด thumbnail แล้ว", "success");
        await refreshTemplates();
    };

    const handleClearAllBroken = async () => {
        const brokenCustom = templates.filter(t => t.source === "api" && t.health?.usable === false);
        const allCustom = templates.filter(t => t.source === "api");
        const targets = brokenCustom.length > 0 ? brokenCustom : allCustom;
        if (targets.length === 0) { alert("No custom templates to clear."); return; }
        const label = brokenCustom.length > 0 ? `${brokenCustom.length} broken custom template(s)` : `all ${allCustom.length} custom template(s)`;
        if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
        setClearingBroken(true);
        let failed = 0;
        for (const tpl of targets) { try { await deleteTemplate(tpl.dbId); } catch { failed++; } }
        const updated = await getAllTemplatesAsync();
        setTemplates(updated);
        if (targets.some(t => t.id === c.templateId)) u("templateId", DEFAULT_TEMPLATE_ID);
        setClearingBroken(false);
        if (failed > 0) alert(`Done. ${failed} template(s) failed to delete.`);
    };

    const handleGenImages = async () => {
        setGenLoading(true);
        try {
            const siteWithFallback = { ...c, brand: c.brand?.trim() || "Brand" };
            const favicon = generateFavicon(siteWithFallback);
            u("faviconDataUrl", favicon);
            const ogImage = await generateOgImage(siteWithFallback);
            u("ogImageDataUrl", ogImage);
        } catch (e) { console.error("Image gen failed:", e); }
        setGenLoading(false);
    };

    const categorized = templates.map(tpl => ({ ...tpl, _cat: resolveWizardCategory(tpl) }));
    const filtered = filter === "all" ? categorized : categorized.filter(t => t._cat === filter);
    const diagnostics = getTemplateDiagnostics(categorized, { filterId: filter });
    const filterHiddenCount = diagnostics.hidden.filter(h => h.reasons.some(r => r.includes("Filtered out by category"))).length;
    const brokenCount = diagnostics.hidden.filter(h => h.reasons.some(r => !r.includes("Filtered out by category"))).length;


    return (
        <>
            {/* ── Section: Template ── */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 24 }}>🧩</div>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: "4px 0 0" }}>Template & Design</h2>
                <p style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
                    Pick a template and customize look & feel in one step.
                </p>
            </div>

            {/* Category Filter */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {CATEGORIES.map(cat => {
                    const count = cat.id === "all" ? categorized.length : categorized.filter(t => t._cat === cat.id).length;
                    if (count === 0 && cat.id !== "all") return null;
                    return (
                        <button key={cat.id} onClick={() => setFilter(cat.id)} style={{
                            padding: "5px 14px", fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: "pointer",
                            background: filter === cat.id ? T.primary : T.card2,
                            color: filter === cat.id ? "#fff" : T.text,
                            border: `1.5px solid ${filter === cat.id ? T.primary : T.border}`,
                        }}>
                            {cat.label} <span style={{ opacity: 0.6 }}>({count})</span>
                        </button>
                    );
                })}
            </div>

            {showDebug && (
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
                    {templates.length} loaded ({diagnostics.bySource.module} module, {diagnostics.bySource.legacy} legacy, {diagnostics.bySource.api} custom).
                    {filter === "all"
                        ? ` Visible ${filtered.length}/${categorized.length}. ${brokenCount > 0 ? `${brokenCount} broken.` : "No broken."}`
                        : ` Filter "${filter}" hides ${filterHiddenCount}. Showing ${filtered.length}.`}
                </div>
            )}

            {/* Compact template list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {filtered.map(tpl => {
                    const active = (c.templateId || DEFAULT_TEMPLATE_ID) === tpl.id;
                    const isCustom = tpl.source === "api";
                    const isDeleting = deletingId === tpl.dbId;
                    const isBroken = tpl.health?.usable === false;

                    return (
                        <div
                            key={tpl.id}
                            style={{ position: "relative" }}
                            onMouseEnter={() => onHoverTemplate?.(tpl.id)}
                            onMouseLeave={() => onHoverTemplate?.(null)}
                        >
                            <button
                                onClick={() => !isBroken && u("templateId", tpl.id)}
                                disabled={isDeleting || isBroken}
                                style={{
                                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                                    padding: "10px 12px", borderRadius: 10, cursor: isBroken ? "not-allowed" : "pointer",
                                    background: active ? T.primaryGlow : T.card2,
                                    border: `2px solid ${active ? T.primary : T.border}`,
                                    boxShadow: active ? `0 0 16px ${T.primary}20` : "none",
                                    opacity: (isDeleting || isBroken) ? 0.5 : 1,
                                    transition: "all 0.15s ease", textAlign: "left", color: T.text,
                                }}
                                title={isBroken ? (tpl.health?.reason || "Template is invalid") : ""}
                            >
                                <RowThumb tpl={tpl} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{tpl.name}</div>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                        {tpl._cat && tpl._cat !== "loan" && (
                                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, background: tpl._cat === "pet" ? "#f59e0b20" : "#6366f120", color: tpl._cat === "pet" ? "#f59e0b" : "#6366f1", fontWeight: 700, textTransform: "uppercase" }}>{tpl._cat}</span>
                                        )}
                                        {tpl.badge && (
                                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, background: "hsl(250 60% 55%)", color: "#fff", fontWeight: 700, textTransform: "uppercase" }}>{tpl.badge}</span>
                                        )}
                                        {isBroken && (
                                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, background: "rgba(239,68,68,.2)", color: "#ef4444", fontWeight: 700 }}>Broken</span>
                                        )}
                                    </div>
                                </div>
                                {active && (
                                    <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, flexShrink: 0 }}>✓ Selected</div>
                                )}
                            </button>

                            {/* Delete button */}
                            {isCustom && !isDeleting && (
                                <button
                                    onClick={(e) => handleDelete(e, tpl)}
                                    style={{
                                        position: "absolute", top: -6, right: -6,
                                        width: 22, height: 22, borderRadius: "50%",
                                        background: T.danger, color: "#fff", border: "none",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer", zIndex: 5, opacity: 0, transition: "opacity 0.2s",
                                    }}
                                    className="delete-tpl-btn"
                                    title="Delete template"
                                >
                                    <Trash2 size={11} />
                                </button>
                            )}
                            <style>{`div:hover > .delete-tpl-btn { opacity: 1 !important; }`}</style>

                            {/* Gen/Up thumbnail buttons */}
                            {isCustom && tpl.dbId && (
                                <div
                                    style={{ position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)", display: "flex", gap: 4, zIndex: 6 }}
                                    onClick={ev => ev.stopPropagation()}
                                >
                                    <button
                                        type="button" title="Generate thumbnail"
                                        disabled={!!generatingThumb || !!uploadingThumb}
                                        onClick={ev => handleGenerateThumb(ev, tpl)}
                                        style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 7px", fontSize: 10, fontWeight: 700, borderRadius: 6, border: `1px solid ${T.border}`, background: "rgba(15,20,25,0.75)", color: "#e8eef5", cursor: generatingThumb === tpl.dbId ? "wait" : "pointer" }}
                                    >
                                        <Camera size={10} />{generatingThumb === tpl.dbId ? "…" : "Gen"}
                                    </button>
                                    <label title="Upload PNG/JPEG as thumbnail" style={{ display: "flex", alignItems: "center", padding: "3px 7px", fontSize: 10, fontWeight: 700, borderRadius: 6, border: `1px solid ${T.border}`, background: "rgba(15,20,25,0.75)", color: "#e8eef5", cursor: "pointer" }}>
                                        {uploadingThumb === tpl.dbId ? "…" : "Up"}
                                        <input type="file" accept="image/*" style={{ display: "none" }} disabled={!!generatingThumb || !!uploadingThumb} onChange={ev => handleUploadThumb(ev, tpl)} />
                                    </label>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Debug / Clear buttons */}
            <div style={{ marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setShowDebug(p => !p)} style={{ padding: "6px 12px", fontSize: 11, borderRadius: 8, border: `1px solid ${T.border}`, background: T.card2, color: T.text, cursor: "pointer" }}>
                    {showDebug ? "Hide Debug" : "Template Debug"}
                </button>
                {templates.some(t => t.source === "api") && (
                    <button onClick={handleClearAllBroken} disabled={clearingBroken} style={{ padding: "6px 12px", fontSize: 11, borderRadius: 8, border: `1px solid ${T.danger}50`, background: `${T.danger}15`, color: T.danger, cursor: clearingBroken ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <Trash2 size={11} />
                        {clearingBroken ? "Clearing..." : templates.filter(t => t.source === "api" && t.health?.usable === false).length > 0 ? `Clear Broken (${templates.filter(t => t.source === "api" && t.health?.usable === false).length})` : "Clear All Custom"}
                    </button>
                )}
            </div>

            {showDebug && (
                <div style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Template Diagnostics</div>
                    <div style={{ color: T.muted, marginBottom: 6 }}>Total {diagnostics.total} · Visible {diagnostics.visibleCount} · Excluded {diagnostics.hiddenCount}</div>
                    <div style={{ maxHeight: 140, overflowY: "auto", borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                        {diagnostics.hidden.length === 0 && <div style={{ color: T.success }}>No excluded templates.</div>}
                        {diagnostics.hidden.map(item => (
                            <div key={item.id} style={{ padding: "5px 0", borderBottom: `1px dashed ${T.border}` }}>
                                <div style={{ fontWeight: 600 }}>{item.name} <span style={{ color: T.dim }}>({item.id})</span></div>
                                <div style={{ color: T.warning }}>{item.reasons.join(" | ")}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Divider ── */}
            <div style={{ borderTop: `1px solid ${T.border}`, margin: "4px 0 20px", position: "relative" }}>
                <span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: T.card2 || T.surface, padding: "0 12px", fontSize: 11, color: T.muted, fontWeight: 600 }}>
                    Design
                </span>
            </div>

            {/* ── Section: Design ── */}
            {!hasSectionPanel && (
                <div style={{ marginBottom: 16, padding: 12, background: T.input, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 }}>Template-controlled look</div>
                    <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.45 }}>
                        This template does not expose layout options. Brand assets can still be generated below.
                    </div>
                </div>
            )}

            {hasSectionPanel && (
                <div style={{ marginTop: 16, padding: 12, background: T.input, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 8 }}>Section order</div>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
                        This template supports custom section ordering. Reorder in preview when available.
                    </div>
                    <div style={{ padding: 10, background: T.surface || "#111", borderRadius: 6, border: `1px dashed ${T.border}`, fontSize: 10, color: T.muted, textAlign: "center" }}>
                        Section reordering available in preview
                    </div>
                </div>
            )}

            {/* Brand assets */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10 }}>Brand assets</div>
                <button type="button" onClick={handleGenImages} disabled={genLoading} style={{
                    width: "100%", padding: 12, marginBottom: 14, background: genLoading ? T.input : `linear-gradient(135deg, ${T.primary}15, ${T.accent}15)`,
                    border: `1px dashed ${T.primary}`, borderRadius: 8, cursor: genLoading ? "not-allowed" : "pointer",
                    color: T.primary, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                    {genLoading ? "Generating..." : "Generate Favicon & OG Image"}
                </button>
                {(c.faviconDataUrl || c.ogImageDataUrl) && (
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "start" }}>
                        {c.faviconDataUrl && (
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>Favicon</div>
                                <img src={c.faviconDataUrl} alt="Favicon" style={{ width: 48, height: 48, borderRadius: 8, border: `1px solid ${T.border}` }} />
                            </div>
                        )}
                        {c.ogImageDataUrl && (
                            <div>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>OG Image (1200x630)</div>
                                <img src={c.ogImageDataUrl} alt="OG Image" style={{ width: "100%", maxWidth: 360, borderRadius: 8, border: `1px solid ${T.border}` }} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
