import React, { useState, useEffect } from "react";
import { THEME as T, COLORS, FONTS, LAYOUTS, RADIUS } from "../../constants";
import { hsl } from "../../utils";
import { generateFavicon, generateOgImage } from "../../utils/image-gen";
import { Field } from "../ui/field";

const DEFAULT_CAPS = {
    supportsWizardTheme: true,
    supportsCalculator: true,
    supportsSectionReorder: true,
};

export function StepDesign({ c, u, designCapabilities }) {
    const caps = { ...DEFAULT_CAPS, ...(designCapabilities || {}) };
    const [genLoading, setGenLoading] = useState(false);

    const hasThemePanel = caps.supportsWizardTheme;
    const hasCalculatorPanel = caps.supportsCalculator;
    const hasSectionPanel = caps.supportsSectionReorder;
    const hasAnyTunablePanel = hasThemePanel || hasCalculatorPanel || hasSectionPanel;

    const handleGenImages = async () => {
        setGenLoading(true);
        try {
            const siteWithFallback = { ...c, brand: c.brand?.trim() || "Brand" };
            const favicon = generateFavicon(siteWithFallback);
            u("faviconDataUrl", favicon);
            const ogImage = await generateOgImage(siteWithFallback);
            u("ogImageDataUrl", ogImage);
        } catch (e) {
            console.error("Image gen failed:", e);
        }
        setGenLoading(false);
    };

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
    }, [c.colorId, c.fontId, c.brand]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 24 }}>🎨</div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Design</h2>
                <p style={{ fontSize: 12, color: T.muted, marginTop: 6, maxWidth: 440, margin: "6px auto 0" }}>
                    Template is chosen in the previous step. Adjust only the options that apply to this template.
                </p>
            </div>

            {!hasAnyTunablePanel && (
                <div style={{ marginBottom: 16, padding: 12, background: T.input, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 }}>Template-controlled look</div>
                    <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.45 }}>
                        This template does not expose wizard theme or layout options. Defaults from the template and your brand step are used. You can still generate favicon and OG images below.
                    </div>
                </div>
            )}

            {hasThemePanel && (
                <>
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
                            <button onClick={() => u("colorId", "custom")} style={{
                                padding: "10px", background: c.colorId === "custom" ? T.primaryGlow : T.input,
                                border: `2px solid ${c.colorId === "custom" ? T.primary : T.border}`, borderRadius: 8, cursor: "pointer",
                            }}>
                                <div style={{ display: "flex", justifyContent: "center", gap: 3, marginBottom: 4 }}>
                                    <div style={{ width: 16, height: 16, borderRadius: 4, background: c.primaryColor || "#3b5bdb", border: `1px solid ${T.border}` }} />
                                    <div style={{ width: 16, height: 16, borderRadius: 4, background: "linear-gradient(135deg,#f97316,#a855f7)", border: `1px solid ${T.border}` }} />
                                    <div style={{ width: 16, height: 16, borderRadius: 4, background: c.accentColor || "#f97316", border: `1px solid ${T.border}` }} />
                                </div>
                                <div style={{ fontSize: 10, color: T.text, fontWeight: 600 }}>Custom</div>
                            </button>
                        </div>
                        {c.colorId === "custom" && (
                            <div style={{ marginTop: 10, padding: 12, background: T.input, borderRadius: 8, border: `1px solid ${T.border}` }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 8 }}>Custom Colors</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>Primary</span>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <input
                                                type="color"
                                                value={c.primaryColor || "#3b5bdb"}
                                                onChange={e => u("primaryColor", e.target.value)}
                                                style={{ width: 36, height: 28, border: "none", borderRadius: 4, cursor: "pointer", padding: 1 }}
                                            />
                                            <input
                                                type="text"
                                                value={c.primaryColor || "#3b5bdb"}
                                                onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) u("primaryColor", e.target.value); }}
                                                maxLength={7}
                                                style={{ flex: 1, padding: "4px 6px", background: T.surface || "#111", border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11, fontFamily: "monospace" }}
                                            />
                                        </div>
                                    </label>
                                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>Accent</span>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <input
                                                type="color"
                                                value={c.accentColor || "#f97316"}
                                                onChange={e => u("accentColor", e.target.value)}
                                                style={{ width: 36, height: 28, border: "none", borderRadius: 4, cursor: "pointer", padding: 1 }}
                                            />
                                            <input
                                                type="text"
                                                value={c.accentColor || "#f97316"}
                                                onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) u("accentColor", e.target.value); }}
                                                maxLength={7}
                                                style={{ flex: 1, padding: "4px 6px", background: T.surface || "#111", border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11, fontFamily: "monospace" }}
                                            />
                                        </div>
                                    </label>
                                </div>
                                <div style={{ marginTop: 8, fontSize: 10, color: T.muted }}>
                                    Sent as <code style={{ color: T.primary }}>PUBLIC_PRIMARYCOLOR</code> / <code style={{ color: T.primary }}>PUBLIC_ACCENTCOLOR</code> at deploy.
                                </div>
                            </div>
                        )}
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
                </>
            )}

            {hasCalculatorPanel && (
                <div style={{ marginTop: 16, padding: 12, background: T.input, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 8 }}>Calculator loan range</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>Min ($)</span>
                            <input
                                type="number"
                                value={c.amountMin ?? ""}
                                onChange={e => u("amountMin", Math.max(0, parseInt(e.target.value, 10) || 0))}
                                style={{ padding: "6px 8px", background: T.surface || "#111", border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11 }}
                            />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>Max ($)</span>
                            <input
                                type="number"
                                value={c.amountMax ?? ""}
                                onChange={e => u("amountMax", Math.max(0, parseInt(e.target.value, 10) || 0))}
                                style={{ padding: "6px 8px", background: T.surface || "#111", border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 11 }}
                            />
                        </label>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 10, color: T.muted }}>
                        APR defaults stay in site config unless you edit template copy. Range here drives calculator sliders where supported.
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

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 10 }}>Brand assets</div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
                    {hasThemePanel
                        ? "Auto-updates when colors change. Regenerate manually anytime."
                        : "Generated from your brand name and default colors."}
                </div>
                <button type="button" onClick={handleGenImages} disabled={genLoading} style={{
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
