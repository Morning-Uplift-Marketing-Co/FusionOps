import React, { useState, useEffect } from "react";
import { THEME as T } from "../../constants";
import { generateFavicon, generateOgImage } from "../../utils/image-gen";

const DEFAULT_CAPS = {
    supportsSectionReorder: true,
};

export function StepDesign({ c, u, designCapabilities }) {
    const caps = { ...DEFAULT_CAPS, ...(designCapabilities || {}) };
    const [genLoading, setGenLoading] = useState(false);

    const hasSectionPanel = caps.supportsSectionReorder;

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
    }, [c.brand]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 24 }}>🎨</div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Design</h2>
                <p style={{ fontSize: 12, color: T.muted, marginTop: 6, maxWidth: 440, margin: "6px auto 0" }}>
                    Template is chosen in the previous step. Adjust only the options that apply to this template.
                </p>
            </div>

            {!hasSectionPanel && (
                <div style={{ marginBottom: 16, padding: 12, background: T.input, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 }}>Template-controlled look</div>
                    <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.45 }}>
                        This template does not expose layout options. You can still generate favicon and OG images below.
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
                    Generated from your brand name and colors. Regenerate manually anytime.
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
