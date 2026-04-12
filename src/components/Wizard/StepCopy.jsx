import React from "react";
import { THEME as T } from "../../constants";
import { Field } from "../ui/field";
import { InputField as Inp } from "../ui/input-field";

const TITLE2_MAX = 40;

export function StepCopy({ c, u, onAiGenerate, aiLoading, onAiMeta, aiMetaLoading, onAiReviews, aiReviewsLoading, onAiTitle2, aiTitle2Loading }) {
    const metaTitleLen = (c.metaTitle || "").length;
    const metaDescLen = (c.metaDesc || "").length;
    const title2Len = (c.title2 || "").length;
    const title2Over = title2Len > TITLE2_MAX;

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 24 }}>✍️</div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Copy & CTA</h2>
            </div>

            {/* AI LP copy — Halbert × Schwartz masters */}
            <button
                type="button"
                title="Gary Halbert vs Eugene Schwartz — copywriting masters"
                onClick={onAiGenerate}
                disabled={aiLoading}
                style={{
                    width: "100%", padding: "12px", marginBottom: 20, background: aiLoading ? T.input : `${T.primary}15`,
                    border: `1px dashed ${T.primary}`, borderRadius: 8, cursor: aiLoading ? "not-allowed" : "pointer",
                    color: T.primary, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
            >
                {aiLoading ? "⏳ Generating..." : "✨ AI Copy — H×S"}
            </button>

            <Field label="H1 Headline"><Inp value={c.h1} onChange={v => u("h1", v)} placeholder="Get Cash Fast — Apply In Minutes" /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label={
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 8 }}>
                        <span>
                            Title 2{" "}
                            <span style={{ color: title2Over ? "#ef4444" : title2Len > 32 ? "#f59e0b" : T.dim, fontSize: 10, fontWeight: 400 }}>
                                ({title2Len}/{TITLE2_MAX})
                            </span>
                        </span>
                        {onAiTitle2 && (
                            <button
                                type="button"
                                onClick={onAiTitle2}
                                disabled={aiTitle2Loading}
                                title="AI-generate a concise Title 2 (≤40 chars)"
                                style={{
                                    padding: "3px 10px",
                                    background: aiTitle2Loading ? T.input : `linear-gradient(135deg, #8b5cf620, #6366f120)`,
                                    border: `1px dashed #8b5cf680`,
                                    borderRadius: 5,
                                    cursor: aiTitle2Loading ? "not-allowed" : "pointer",
                                    color: "#8b5cf6",
                                    fontSize: 10,
                                    fontWeight: 600,
                                    lineHeight: 1.2,
                                }}
                            >
                                {aiTitle2Loading ? "⏳" : "✨ AI Gen"}
                            </button>
                        )}
                    </span>
                }>
                    <Inp
                        value={c.title2}
                        onChange={v => u("title2", v.slice(0, TITLE2_MAX))}
                        placeholder="No Credit Check Required"
                        maxLength={TITLE2_MAX}
                    />
                </Field>
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

            {/* ─── Reviews ─── */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>⭐ Customer Reviews</div>
                        <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>AI-generated, unique per deploy</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>On LP</span>
                        {[
                            { v: true, label: "On" },
                            { v: false, label: "Off" },
                        ].map(({ v, label }) => (
                            <button
                                key={label}
                                type="button"
                                onClick={() => u("showReviews", v)}
                                style={{
                                    padding: "5px 12px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    border: `1px solid ${(c.showReviews !== false) === v ? T.primary : T.border}`,
                                    background: (c.showReviews !== false) === v ? `${T.primary}18` : T.input,
                                    color: (c.showReviews !== false) === v ? T.primary : T.dim,
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: T.dim, maxWidth: 280 }}>
                        Off = deployed page hides review cards (<code style={{ fontSize: 9 }}>PUBLIC_SHOW_REVIEWS</code>).
                    </div>
                    <button onClick={onAiReviews} disabled={aiReviewsLoading} style={{
                        padding: "6px 14px", background: aiReviewsLoading ? T.input : `linear-gradient(135deg, #10b98120, #06b6d420)`,
                        border: `1px dashed #10b98180`, borderRadius: 6, cursor: aiReviewsLoading ? "not-allowed" : "pointer",
                        color: "#10b981", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                    }}>
                        {aiReviewsLoading ? "⏳ ..." : "✨ Gen Reviews"}
                    </button>
                </div>
                {(c.reviews || []).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(c.reviews || []).map((r, i) => (
                            <div key={i} style={{ padding: "10px 12px", background: T.input, borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600, color: T.text }}>{r.name}</span>
                                    <span style={{ color: T.dim }}>{r.location}</span>
                                </div>
                                <div style={{ color: T.muted, lineHeight: 1.4 }}>"{r.text}"</div>
                                <div style={{ color: "#f59e0b", marginTop: 4, fontSize: 11 }}>{"★".repeat(r.rating || 5)} {r.rating || 5}.0</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
