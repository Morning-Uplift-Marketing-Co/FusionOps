import React from "react";
import { THEME as T, COPY_SETS } from "../../constants";
import { Field } from "../ui/field";
import { InputField as Inp } from "../ui/input-field";

export function StepCopy({ c, u, onAiGenerate, aiLoading, onAiMeta, aiMetaLoading }) {
    const applyTemplate = (tpl) => {
        u("h1", tpl.h1);
        u("h1span", tpl.h1span || "");
        u("badge", tpl.badge);
        u("cta", tpl.cta);
        u("sub", tpl.sub);
        if (!c.tagline) u("tagline", `${tpl.brand}: Fast. Simple. Trusted.`);
    };

    const metaTitleLen = (c.metaTitle || "").length;
    const metaDescLen = (c.metaDesc || "").length;

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 24 }}>✍️</div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Copy & CTA</h2>
            </div>

            {/* Quick-Start Templates */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Quick-Start Templates</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {COPY_SETS.map(t => (
                        <button key={t.id} onClick={() => applyTemplate(t)} style={{
                            padding: "10px 12px", background: T.input, border: `1px solid ${T.border}`,
                            borderRadius: 8, cursor: "pointer", textAlign: "left",
                            transition: "all 0.15s",
                        }} onMouseEnter={(e) => e.currentTarget.style.borderColor = T.primary}
                           onMouseLeave={(e) => e.currentTarget.style.borderColor = T.border}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{t.brand}</div>
                            <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>"{t.h1} {t.h1span}"</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* AI Generate LP Copy — 23 Pillars */}
            <button onClick={onAiGenerate} disabled={aiLoading} style={{
                width: "100%", padding: "12px", marginBottom: 20, background: aiLoading ? T.input : `${T.primary}15`,
                border: `1px dashed ${T.primary}`, borderRadius: 8, cursor: aiLoading ? "not-allowed" : "pointer",
                color: T.primary, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
                {aiLoading ? "⏳ Generating..." : "✨ Generate AI Copy (23 Pillars)"}
            </button>

            <Field label="H1 Headline"><Inp value={c.h1} onChange={v => u("h1", v)} placeholder="Get Cash Fast — Apply In Minutes" /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Badge Text"><Inp value={c.badge} onChange={v => u("badge", v)} placeholder="No Credit Check Required" /></Field>
                <Field label="CTA Button"><Inp value={c.cta} onChange={v => u("cta", v)} placeholder="Check Your Rate →" /></Field>
            </div>
            <Field label="Sub-headline"><Inp value={c.sub} onChange={v => u("sub", v)} placeholder="Get approved in minutes. Funds fast." /></Field>

            {/* ─── SEO Meta Section ─── */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>🔍 SEO Meta Tags</div>
                        <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>For Google SERP & ad-to-LP continuity</div>
                    </div>
                    <button onClick={onAiMeta} disabled={aiMetaLoading} style={{
                        padding: "6px 14px", background: aiMetaLoading ? T.input : `linear-gradient(135deg, #f59e0b20, #f9731620)`,
                        border: `1px dashed #f59e0b80`, borderRadius: 6, cursor: aiMetaLoading ? "not-allowed" : "pointer",
                        color: "#f59e0b", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                    }}>
                        {aiMetaLoading ? "⏳ ..." : "✨ AI Gen Meta"}
                    </button>
                </div>

                {/* Meta Title */}
                <Field label={<span>Meta Title <span style={{ color: metaTitleLen > 60 ? "#ef4444" : metaTitleLen > 50 ? "#f59e0b" : T.dim, fontSize: 10, fontWeight: 400 }}>({metaTitleLen}/60)</span></span>}>
                    <Inp value={c.metaTitle || ""} onChange={v => u("metaTitle", v)} placeholder="Get Fast Cash $100-$5,000 | QuickFund — Apply Now" />
                </Field>

                {/* Meta Description */}
                <Field label={<span>Meta Description <span style={{ color: metaDescLen > 160 ? "#ef4444" : metaDescLen > 140 ? "#f59e0b" : T.dim, fontSize: 10, fontWeight: 400 }}>({metaDescLen}/160)</span></span>}>
                    <textarea
                        value={c.metaDesc || ""}
                        onChange={e => u("metaDesc", e.target.value)}
                        placeholder="Need cash fast? Apply online in 2 minutes for $100-$5,000. No hidden fees, instant decision. Check your rate now — it won't affect your credit score!"
                        rows={3}
                        style={{
                            width: "100%", padding: "10px 14px", borderRadius: 8,
                            background: T.input, border: `1px solid ${T.border}`, color: T.text,
                            fontSize: 13, outline: "none", boxSizing: "border-box",
                            resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
                        }}
                    />
                </Field>

                {/* SERP Preview */}
                {(c.metaTitle || c.metaDesc) && (
                    <div style={{
                        marginTop: 10, padding: "14px 16px", background: "#fff", borderRadius: 10,
                        border: `1px solid #e0e0e0`,
                    }}>
                        <div style={{ fontSize: 10, color: "#70757a", marginBottom: 6, fontFamily: "Arial, sans-serif" }}>
                            {c.domain || "example.com"}
                        </div>
                        <div style={{
                            fontSize: 16, color: "#1a0dab", fontFamily: "Arial, sans-serif",
                            cursor: "pointer", marginBottom: 4, lineHeight: 1.3,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                            {c.metaTitle || "Page Title"}
                        </div>
                        <div style={{
                            fontSize: 13, color: "#4d5156", fontFamily: "Arial, sans-serif",
                            lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                            {c.metaDesc || "Meta description will appear here..."}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Language ─── */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                <Field label="Auto-Translate (Gemini)" help="Generate copy in a specific language">
                    <div style={{ display: "flex", gap: 10 }}>
                        {["English", "Spanish", "German", "French", "Italian"].map(l => (
                            <button key={l} onClick={() => u("lang", l)} style={{
                                flex: 1, padding: "8px", background: (c.lang || "English") === l ? T.primaryGlow : T.input,
                                border: `2px solid ${(c.lang || "English") === l ? T.primary : T.border}`,
                                borderRadius: 6, cursor: "pointer", color: T.text, fontSize: 11, fontWeight: 600,
                            }}>{l}</button>
                        ))}
                    </div>
                </Field>
            </div>
        </>
    );
}
