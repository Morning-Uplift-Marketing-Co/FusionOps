import React, { useState, useEffect, useMemo } from "react";
import { Trash2, Camera, Search, X } from "lucide-react";
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

/* ── Helpers ── */

/** Group templates by familyId. Standalone templates (no familyId) get their own group. */
function groupByFamily(templates) {
    const families = [];
    const familyMap = {};
    for (const tpl of templates) {
        const fid = tpl.familyId;
        if (fid) {
            if (!familyMap[fid]) {
                familyMap[fid] = { familyId: fid, variants: [] };
                families.push(familyMap[fid]);
            }
            familyMap[fid].variants.push(tpl);
        } else {
            families.push({ familyId: null, variants: [tpl] });
        }
    }
    return families;
}

/** Derive a display name for a family group. */
function familyDisplayName(group) {
    if (group.variants.length === 1) return group.variants[0].name;
    // Use the shortest common prefix, or just the family ID
    const names = group.variants.map(v => v.name);
    // Find common prefix
    let prefix = names[0] || "";
    for (let i = 1; i < names.length; i++) {
        while (!names[i].startsWith(prefix)) {
            prefix = prefix.slice(0, -1);
        }
    }
    // Clean up trailing separators
    prefix = prefix.replace(/[\s\-_]+$/, "").trim();
    return prefix || group.familyId || group.variants[0]?.name || "Template";
}

/* ── Subcomponents ── */

/** Card thumbnail — renders iframe preview, image, or icon fallback. */
function CardThumb({ tpl, style }) {
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
    const icon = tpl._cat === "pet" ? "\uD83D\uDC3E" : tpl._cat === "custom" ? "\u26A1" : "\uD83D\uDCB0";

    return (
        <div style={{ width: "100%", height: 120, borderRadius: "8px 8px 0 0", overflow: "hidden", position: "relative", background: "#0f1419", ...style }}>
            {doc ? (
                <iframe
                    title=""
                    srcDoc={doc}
                    sandbox="allow-scripts allow-same-origin"
                    style={{
                        position: "absolute", top: 0, left: "50%",
                        width: 390, height: 844, marginLeft: -195, border: "none",
                        transform: "scale(0.31)", transformOrigin: "top center",
                        pointerEvents: "none",
                    }}
                />
            ) : thumbSrc ? (
                <img src={thumbSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} onError={e => { e.target.style.display = "none"; }} />
            ) : (
                <div style={{ width: "100%", height: "100%", background: previewBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>{icon}</div>
            )}
        </div>
    );
}

/** Mini variant thumbnail (40x40) for the variant strip. */
function VariantThumb({ tpl, active, onClick }) {
    const thumbSrc = buildTemplateThumbnailUrl(tpl);
    const previewBg = tpl._cat === "pet"
        ? "linear-gradient(160deg, hsl(35 80% 95%), hsl(170 40% 92%))"
        : tpl._cat === "custom"
        ? "linear-gradient(135deg, hsl(280 40% 18%), hsl(260 35% 10%))"
        : "linear-gradient(180deg, hsl(215 60% 52%), hsl(215 55% 38%))";
    const icon = tpl._cat === "pet" ? "\uD83D\uDC3E" : tpl._cat === "custom" ? "\u26A1" : "\uD83D\uDCB0";

    return (
        <button
            type="button"
            onClick={onClick}
            title={tpl.variantLabel || tpl.name}
            style={{
                width: 40, height: 40, borderRadius: 6, overflow: "hidden", flexShrink: 0,
                border: active ? `2px solid ${T.primary}` : "2px solid transparent",
                boxShadow: active ? `0 0 0 1px ${T.primary}, 0 0 8px ${T.primary}40` : "none",
                padding: 0, cursor: "pointer", position: "relative", background: "#0f1419",
                transition: "all 0.15s ease",
            }}
        >
            {thumbSrc ? (
                <img src={thumbSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} onError={e => { e.target.style.display = "none"; }} />
            ) : (
                <div style={{ width: "100%", height: "100%", background: previewBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{icon}</div>
            )}
            {tpl.variantLabel && (
                <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0, padding: "1px 2px",
                    background: "rgba(0,0,0,0.7)", fontSize: 7, fontWeight: 700,
                    color: "#fff", textAlign: "center", lineHeight: 1.2,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{tpl.variantLabel}</div>
            )}
        </button>
    );
}

/* ── Main Component ── */

export function StepTemplateDesign({ c, u, notify, onHoverTemplate, designCapabilities }) {
    const caps = {
        supportsSectionReorder: true,
        ...(designCapabilities || {}),
    };

    const [templates, setTemplates] = useState(getAllTemplates());
    const [deletingId, setDeletingId] = useState(null);
    const [clearingBroken, setClearingBroken] = useState(false);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
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
        notify?.("\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E40\u0E17\u0E21\u0E40\u0E1E\u0E25\u0E15 + \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E20\u0E32\u0E1E\u2026", "info");
        const detail = await api.get(`/templates/${tpl.dbId}`);
        if (detail?.error) { setGeneratingThumb(null); notify?.(String(detail.error), "warning"); return; }
        const files = detail?.files && typeof detail.files === "object" ? detail.files : {};
        if (!Object.keys(files).length) { setGeneratingThumb(null); notify?.("\u0E44\u0E21\u0E48\u0E21\u0E35\u0E44\u0E1F\u0E25\u0E4C\u0E43\u0E19\u0E40\u0E17\u0E21\u0E40\u0E1E\u0E25\u0E15", "warning"); return; }
        let previewHtml;
        try {
            previewHtml = buildThumbnailPreviewDocument(files, { dbId: tpl.dbId, brand: detail?.name || tpl.name });
        } catch (err) { setGeneratingThumb(null); notify?.(String(err?.message || err), "warning"); return; }
        const res = await api.post(`/templates/${tpl.dbId}/generate-thumb`, { previewHtml });
        setGeneratingThumb(null);
        if (res.error) { notify?.(String(res.error), "warning"); return; }
        notify?.("\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 thumbnail \u0E41\u0E25\u0E49\u0E27", "success");
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
        notify?.("\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14 thumbnail \u0E41\u0E25\u0E49\u0E27", "success");
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

    /* ── Derived data ── */

    const categorized = templates.map(tpl => ({ ...tpl, _cat: resolveWizardCategory(tpl) }));
    const filtered = useMemo(() => {
        let list = filter === "all" ? categorized : categorized.filter(t => t._cat === filter);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(t => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.variantLabel || "").toLowerCase().includes(q));
        }
        return list;
    }, [categorized, filter, search]);

    const familyGroups = useMemo(() => groupByFamily(filtered), [filtered]);

    const diagnostics = getTemplateDiagnostics(categorized, { filterId: filter });
    const brokenCount = diagnostics.hidden.filter(h => h.reasons.some(r => !r.includes("Filtered out by category"))).length;

    const activeTemplateId = c.templateId || DEFAULT_TEMPLATE_ID;

    /** For a family group, determine which variant to show as the main card. */
    const getDisplayVariant = (group) => {
        // If the currently selected template is in this family, show it
        const selected = group.variants.find(v => v.id === activeTemplateId);
        if (selected) return selected;
        // Otherwise show the first variant
        return group.variants[0];
    };

    return (
        <>
            {/* ── Header ── */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 24 }}>{"\uD83E\uDDE9"}</div>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: "4px 0 0" }}>Template & Design</h2>
                <p style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
                    Pick a template and color variant.
                </p>
            </div>

            {/* ── Search bar ── */}
            <div style={{ position: "relative", marginBottom: 12 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none" }} />
                <input
                    type="text"
                    placeholder="Search templates..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: "100%", padding: "8px 32px 8px 32px", fontSize: 12,
                        background: T.input, color: T.text, border: `1px solid ${T.border}`,
                        borderRadius: 8, outline: "none", boxSizing: "border-box",
                    }}
                />
                {search && (
                    <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 2, display: "flex" }}>
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* ── Category pills ── */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {CATEGORIES.map(cat => {
                    const count = cat.id === "all" ? categorized.length : categorized.filter(t => t._cat === cat.id).length;
                    if (count === 0 && cat.id !== "all") return null;
                    return (
                        <button key={cat.id} onClick={() => setFilter(cat.id)} style={{
                            padding: "4px 12px", fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: "pointer",
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
                        ? ` Visible ${filtered.length}/${categorized.length}. ${brokenCount > 0 ? `${brokenCount} broken.` : "No broken."} ${familyGroups.length} groups.`
                        : ` Filter "${filter}". Showing ${filtered.length}. ${familyGroups.length} groups.`}
                </div>
            )}

            {/* ── Card grid (grouped by family) ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {familyGroups.map((group, gi) => {
                    const displayTpl = getDisplayVariant(group);
                    const isFamily = group.variants.length > 1;
                    const familyActive = group.variants.some(v => v.id === activeTemplateId);
                    const isCustom = displayTpl.source === "api";
                    const isDeleting = deletingId === displayTpl.dbId;
                    const isBroken = displayTpl.health?.usable === false;

                    return (
                        <div
                            key={group.familyId || displayTpl.id}
                            style={{ position: "relative" }}
                            onMouseEnter={() => onHoverTemplate?.(displayTpl.id)}
                            onMouseLeave={() => onHoverTemplate?.(null)}
                        >
                            <button
                                onClick={() => !isBroken && u("templateId", displayTpl.id)}
                                disabled={isDeleting || isBroken}
                                style={{
                                    width: "100%", display: "flex", flexDirection: "column",
                                    borderRadius: 10, cursor: isBroken ? "not-allowed" : "pointer",
                                    background: familyActive ? T.primaryGlow : T.card2,
                                    border: `2px solid ${familyActive ? T.primary : T.border}`,
                                    boxShadow: familyActive ? `0 0 20px ${T.primary}30` : "none",
                                    opacity: (isDeleting || isBroken) ? 0.5 : 1,
                                    transition: "all 0.15s ease", textAlign: "left", color: T.text,
                                    overflow: "hidden", padding: 0,
                                }}
                                title={isBroken ? (displayTpl.health?.reason || "Template is invalid") : ""}
                            >
                                {/* Thumbnail of current/display variant */}
                                <CardThumb tpl={displayTpl} />

                                {/* Info section */}
                                <div style={{ padding: "8px 10px 10px" }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {isFamily ? familyDisplayName(group) : displayTpl.name}
                                    </div>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: isFamily ? 6 : 0 }}>
                                        {displayTpl._cat && displayTpl._cat !== "loan" && (
                                            <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4, background: displayTpl._cat === "pet" ? "#f59e0b20" : "#6366f120", color: displayTpl._cat === "pet" ? "#f59e0b" : "#6366f1", fontWeight: 700, textTransform: "uppercase" }}>{displayTpl._cat}</span>
                                        )}
                                        {displayTpl.badge && (
                                            <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4, background: "hsl(250 60% 55%)", color: "#fff", fontWeight: 700, textTransform: "uppercase" }}>{displayTpl.badge}</span>
                                        )}
                                        {isFamily && (
                                            <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4, background: `${T.primary}20`, color: T.primary, fontWeight: 700 }}>{group.variants.length} variants</span>
                                        )}
                                        {isBroken && (
                                            <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4, background: "rgba(239,68,68,.2)", color: "#ef4444", fontWeight: 700 }}>Broken</span>
                                        )}
                                        {familyActive && (
                                            <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4, background: `${T.primary}30`, color: T.primary, fontWeight: 700 }}>Selected</span>
                                        )}
                                    </div>

                                    {/* Variant thumbnails — show for families when any variant in this family is selected */}
                                    {isFamily && familyActive && (
                                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                                            {group.variants.map(v => (
                                                <VariantThumb
                                                    key={v.id}
                                                    tpl={v}
                                                    active={activeTemplateId === v.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        u("templateId", v.id);
                                                        onHoverTemplate?.(v.id);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </button>

                            {/* Delete button (custom templates only) */}
                            {isCustom && !isDeleting && (
                                <button
                                    onClick={(e) => handleDelete(e, displayTpl)}
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
                            {isCustom && displayTpl.dbId && (
                                <div
                                    style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 3, zIndex: 6, opacity: 0, transition: "opacity 0.2s" }}
                                    className="thumb-actions"
                                    onClick={ev => ev.stopPropagation()}
                                >
                                    <button
                                        type="button" title="Generate thumbnail"
                                        disabled={!!generatingThumb || !!uploadingThumb}
                                        onClick={ev => handleGenerateThumb(ev, displayTpl)}
                                        style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 7px", fontSize: 10, fontWeight: 700, borderRadius: 6, border: `1px solid ${T.border}`, background: "rgba(15,20,25,0.85)", color: "#e8eef5", cursor: generatingThumb === displayTpl.dbId ? "wait" : "pointer", backdropFilter: "blur(4px)" }}
                                    >
                                        <Camera size={10} />{generatingThumb === displayTpl.dbId ? "\u2026" : "Gen"}
                                    </button>
                                    <label title="Upload PNG/JPEG as thumbnail" style={{ display: "flex", alignItems: "center", padding: "3px 7px", fontSize: 10, fontWeight: 700, borderRadius: 6, border: `1px solid ${T.border}`, background: "rgba(15,20,25,0.85)", color: "#e8eef5", cursor: "pointer", backdropFilter: "blur(4px)" }}>
                                        {uploadingThumb === displayTpl.dbId ? "\u2026" : "Up"}
                                        <input type="file" accept="image/*" style={{ display: "none" }} disabled={!!generatingThumb || !!uploadingThumb} onChange={ev => handleUploadThumb(ev, displayTpl)} />
                                    </label>
                                </div>
                            )}
                            <style>{`div:hover > .thumb-actions { opacity: 1 !important; }`}</style>
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: T.muted, fontSize: 13 }}>
                    No templates match {search ? `"${search}"` : "this filter"}.
                </div>
            )}

            {/* Debug / Clear buttons */}
            <div style={{ marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setShowDebug(p => !p)} style={{ padding: "6px 12px", fontSize: 11, borderRadius: 8, border: `1px solid ${T.border}`, background: T.card2, color: T.text, cursor: "pointer" }}>
                    {showDebug ? "Hide Debug" : "Debug"}
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
