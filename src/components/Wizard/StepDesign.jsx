import React, { useState, useEffect } from "react";
import { THEME as T, COLORS, FONTS, LAYOUTS, RADIUS } from "../../constants";
import { hsl } from "../../utils";
import { generateFavicon, generateOgImage } from "../../utils/image-gen";
import { getAllTemplates, getAllTemplatesAsync, clearCustomTemplatesCache, fetchCustomTemplates } from "../../utils/template-registry";
import { refreshCustomTemplates } from "../../utils/template-router";
import { api } from "../../services/api";
import { Field } from "../ui/field";

// Custom event for template refresh
const TEMPLATE_REFRESH_EVENT = 'lp-template-refresh';

export function StepDesign({ c, u, notify }) {
    const [genLoading, setGenLoading] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [deleting, setDeleting] = useState(null);
    const [generatingThumb, setGeneratingThumb] = useState(null);
    const [hoveredTemplate, setHoveredTemplate] = useState(null);
    const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

    // Load templates on mount
    const loadTemplates = (forceRefresh = false) => {
        getAllTemplatesAsync().then(allTemplates => {
            setTemplates(allTemplates);
            setLoadingTemplates(false);
        });
    };

    // Force reload templates from API
    const forceReloadTemplates = async () => {
        clearCustomTemplatesCache();
        refreshCustomTemplates();
        setLoadingTemplates(true);
        const custom = await fetchCustomTemplates(true); // Force refetch
        const builtin = getAllTemplates();
        setTemplates([...builtin, ...custom]);
        setLoadingTemplates(false);
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    // Refresh templates when component regains focus (user returns to this step)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                loadTemplates();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // Listen for template refresh events (when new template is saved)
    useEffect(() => {
        const handleTemplateRefresh = async () => {
            console.log('Template refresh event received, reloading templates...');
            await forceReloadTemplates();
        };
        window.addEventListener(TEMPLATE_REFRESH_EVENT, handleTemplateRefresh);
        return () => window.removeEventListener(TEMPLATE_REFRESH_EVENT, handleTemplateRefresh);
    }, []);

    const handleGenImages = async () => {
        setGenLoading(true);
        try {
            const siteWithFallback = { ...c, brand: c.brand?.trim() || 'Brand' };
            const favicon = generateFavicon(siteWithFallback);
            u("faviconDataUrl", favicon);
            const ogImage = await generateOgImage(siteWithFallback);
            u("ogImageDataUrl", ogImage);
        } catch (e) {
            console.error("Image gen failed:", e);
        }
        setGenLoading(false);
    };

    // Auto-regenerate assets when color scheme changes
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
            } catch (e) {
                console.error("Auto image gen failed:", e);
            }
        }, 150);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [c.colorId, c.fontId, c.brand]);

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 24 }}>🎨</div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Design</h2>
            </div>

            {/* Template Selector */}
            <Field label="Template" req>
                {loadingTemplates ? (
                    <div style={{ padding: 12, textAlign: "center", color: T.muted, fontSize: 12 }}>
                        Loading templates...
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                        {templates.map(t => {
                            const isSelected = c.templateId === t.id;
                            const isCustom = t.source === 'api';
                            return (
                                <div key={t.id} style={{ position: "relative" }}
                                    onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoverPos({ x: rect.right + 8, y: rect.top });
                                        setHoveredTemplate(t);
                                    }}
                                    onMouseLeave={() => setHoveredTemplate(null)}
                                >
                                    <button
                                        onClick={() => u("templateId", t.id)}
                                        style={{
                                            width: "100%",
                                            padding: 0,
                                            background: isSelected ? T.primaryGlow : T.input,
                                            border: `2px solid ${isSelected ? T.primary : T.border}`,
                                            borderRadius: 10,
                                            cursor: "pointer",
                                            textAlign: "left",
                                            transition: "all 0.2s",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {/* Thumbnail area */}
                                        <div style={{ width: "100%", height: 90, background: T.surface || "#1a1a2e", overflow: "hidden", position: "relative", borderRadius: "8px 8px 0 0" }}>
                                            {t.thumbnailUrl ? (
                                                <img
                                                    src={`https://lp-factory-api.misty-feather-556e.workers.dev${t.thumbnailUrl}?t=${t.thumbnailGeneratedAt ? new Date(t.thumbnailGeneratedAt).getTime() : 0}`}
                                                    alt={t.name}
                                                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                                                    onError={e => { e.target.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    <span style={{ fontSize: 28, opacity: 0.4 }}>⚡</span>
                                                </div>
                                            )}
                                            {/* Badges overlay */}
                                            <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 3 }}>
                                                {isCustom && (
                                                    <span style={{ fontSize: 8, padding: "2px 5px", borderRadius: 4, background: "#f59e0bcc", color: "#fff", fontWeight: 700 }}>API</span>
                                                )}
                                                {t.badge && (
                                                    <span style={{ fontSize: 8, padding: "2px 5px", borderRadius: 4, background: `${T.primary}cc`, color: "#fff", fontWeight: 700 }}>{t.badge}</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Name + description */}
                                        <div style={{ padding: "8px 10px" }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? "#fff" : T.text, marginBottom: 2 }}>
                                                {t.name}
                                            </div>
                                            {t.description && (
                                                <div style={{ fontSize: 10, color: isSelected ? "rgba(255,255,255,0.6)" : T.muted, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                                                    {t.description}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                    {isCustom && t.dbId && (
                                        <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", gap: 4, zIndex: 2 }}>
                                            {/* 📸 Generate thumbnail */}
                                            <button
                                                title="Generate thumbnail screenshot"
                                                disabled={generatingThumb === t.dbId}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    setGeneratingThumb(t.dbId);
                                                    try {
                                                        await api.post(`/templates/${t.dbId}/generate-thumb`, {});
                                                        await forceReloadTemplates();
                                                        notify?.('Thumbnail generated!', 'success');
                                                    } catch (err) {
                                                        notify?.(`Thumbnail failed: ${err.message}`, 'error');
                                                    } finally {
                                                        setGeneratingThumb(null);
                                                    }
                                                }}
                                                style={{
                                                    width: 24, height: 24, borderRadius: 6,
                                                    background: generatingThumb === t.dbId ? T.input : "#6366f120",
                                                    border: "1px solid #6366f140",
                                                    color: "#6366f1", fontSize: 12,
                                                    cursor: generatingThumb === t.dbId ? "wait" : "pointer",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                }}
                                            >
                                                {generatingThumb === t.dbId ? "⏳" : "📸"}
                                            </button>
                                            {/* 🗑 Delete */}
                                            <button
                                                title="Delete this custom template"
                                                disabled={deleting === t.dbId}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`Delete template "${t.name}"? This cannot be undone.`)) return;
                                                    setDeleting(t.dbId);
                                                    try {
                                                        await api.del(`/templates/${t.dbId}`);
                                                        if (c.templateId === t.id) u("templateId", "");
                                                        await forceReloadTemplates();
                                                        notify?.(`Template "${t.name}" deleted`, 'success');
                                                    } catch (err) {
                                                        notify?.(`Failed to delete: ${err.message}`, 'error');
                                                    } finally {
                                                        setDeleting(null);
                                                    }
                                                }}
                                                style={{
                                                    width: 24, height: 24, borderRadius: 6,
                                                    background: deleting === t.dbId ? T.input : "#ef444420",
                                                    border: "1px solid #ef444440",
                                                    color: "#ef4444", fontSize: 12,
                                                    cursor: deleting === t.dbId ? "wait" : "pointer",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                }}
                                            >
                                                {deleting === t.dbId ? "..." : "🗑"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                {/* ── Hover Preview Popup ── */}
                {hoveredTemplate && (() => {
                    const thumbUrl = hoveredTemplate.thumbnailUrl
                        ? `https://lp-factory-api.misty-feather-556e.workers.dev${hoveredTemplate.thumbnailUrl}`
                        : null;
                    const popupH = 420;
                    const popupW = 300;
                    const top = Math.min(hoverPos.y, window.innerHeight - popupH - 12);
                    // hoverPos.x = rect.right + 8, show popup to the right of the card
                    // clamp so popup doesn't overflow right edge of viewport
                    const left = Math.min(hoverPos.x, window.innerWidth - popupW - 8);
                    return (
                        <div style={{
                            position: "fixed",
                            left,
                            top,
                            width: popupW,
                            height: popupH,
                            background: T.card || "#1e1e2e",
                            border: `1px solid ${T.border}`,
                            borderRadius: 12,
                            overflow: "hidden",
                            zIndex: 9999,
                            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                            pointerEvents: "none",
                        }}>
                            {/* Header */}
                            <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{hoveredTemplate.name}</span>
                                {hoveredTemplate.badge && (
                                    <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: `${T.primary}cc`, color: "#fff", fontWeight: 700 }}>{hoveredTemplate.badge}</span>
                                )}
                            </div>
                            {/* Preview area */}
                            <div style={{ width: "100%", height: popupH - 36, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {thumbUrl ? (
                                    <img src={thumbUrl} alt={hoveredTemplate.name}
                                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 20px", textAlign: "center" }}>
                                        <span style={{ fontSize: 36 }}>📷</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>No preview yet</span>
                                        <span style={{ fontSize: 10, color: T.muted, lineHeight: 1.5 }}>
                                            Click the <strong style={{ color: T.text }}>📸</strong> button on this template card to generate a screenshot preview.
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Field>

            <Field label="Color Scheme" req>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                    {COLORS.map(cp => (
                        <button key={cp.id} onClick={() => u("colorId", cp.id)} style={{
                            padding: "10px", background: c.colorId === cp.id ? T.primaryGlow : T.input,
                            border: `2px solid ${c.colorId === cp.id ? T.primary : T.border}`, borderRadius: 8, cursor: "pointer",
                        }}>
                            <div style={{ display: "flex", justifyContent: "center", gap: 3, marginBottom: 4 }}>
                                <div style={{ width: 16, height: 16, borderRadius: 4, background: hsl(...cp.p) }} />
                                <div style={{ width: 16, height: 16, borderRadius: 4, background: hsl(...cp.s) }} />
                                <div style={{ width: 16, height: 16, borderRadius: 4, background: hsl(...cp.a) }} />
                            </div>
                            <div style={{ fontSize: 10, color: T.text, fontWeight: 600 }}>{cp.name}</div>
                        </button>
                    ))}
                </div>
            </Field>
            <Field label="Font">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                    {FONTS.map(f => (
                        <button key={f.id} onClick={() => u("fontId", f.id)} style={{
                            padding: "8px", background: c.fontId === f.id ? T.primaryGlow : T.input,
                            border: `2px solid ${c.fontId === f.id ? T.primary : T.border}`,
                            borderRadius: 6, cursor: "pointer", color: T.text, fontSize: 11, fontWeight: 600,
                        }}>{f.name}</button>
                    ))}
                </div>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Layout">
                    {LAYOUTS.map(l => (
                        <button key={l.id} onClick={() => u("layout", l.id)} style={{
                            width: "100%", padding: "8px 10px", marginBottom: 4, background: c.layout === l.id ? T.primaryGlow : T.input,
                            border: `2px solid ${c.layout === l.id ? T.primary : T.border}`, borderRadius: 6, cursor: "pointer", textAlign: "left",
                        }}><div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{l.label}</div><div style={{ fontSize: 10, color: T.dim }}>{l.desc}</div></button>
                    ))}
                </Field>
                <Field label="Radius">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {RADIUS.map(r => (
                            <button key={r.id} onClick={() => u("radius", r.id)} style={{
                                flex: 1, padding: "8px", background: c.radius === r.id ? T.primaryGlow : T.input,
                                border: `2px solid ${c.radius === r.id ? T.primary : T.border}`,
                                borderRadius: 6, cursor: "pointer", color: T.text, fontSize: 11, fontWeight: 600, minWidth: 60,
                            }}>{r.label}</button>
                        ))}
                    </div>
                </Field>
            </div>
            {/* AI Image Generation */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10 }}>🎨 Brand Assets (Use Current Design Colors)</div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>Auto-updates when Color Scheme changes. You can also regenerate manually.</div>
                <button onClick={handleGenImages} disabled={genLoading} style={{
                    width: "100%", padding: 12, marginBottom: 14, background: genLoading ? T.input : `linear-gradient(135deg, ${T.primary}15, ${T.accent}15)`,
                    border: `1px dashed ${T.primary}`, borderRadius: 8, cursor: genLoading ? "not-allowed" : "pointer",
                    color: T.primary, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                    {genLoading ? "⏳ Generating..." : "✨ Generate Favicon & OG Image"}
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
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>OG Image (1200×630)</div>
                                <img src={c.ogImageDataUrl} alt="OG Image" style={{ width: "100%", maxWidth: 360, borderRadius: 8, border: `1px solid ${T.border}` }} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

