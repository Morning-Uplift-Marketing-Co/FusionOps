import React from "react";
import { THEME as T, COPY_SETS } from "../../constants";
import { Field } from "../ui/field";
import { InputField as Inp } from "../ui/input-field";

export function StepCopy({ c, u, onAiGenerate, aiLoading }) {
    const applyTemplate = (tpl) => {
        u("h1", tpl.h1);
        u("h1span", tpl.h1span || "");
        u("badge", tpl.badge);
        u("cta", tpl.cta);
        u("sub", tpl.sub);
        if (!c.tagline) u("tagline", `${tpl.brand}: Fast. Simple. Trusted.`);
    };

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

            {/* AI Generate Button */}
            <button onClick={onAiGenerate} disabled={aiLoading} style={{
                width: "100%", padding: "12px", marginBottom: 20, background: aiLoading ? T.input : `${T.primary}15`,
                border: `1px dashed ${T.primary}`, borderRadius: 8, cursor: aiLoading ? "not-allowed" : "pointer",
                color: T.primary, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
                {aiLoading ? "⏳ Generating..." : "✨ Generate AI Copy"}
            </button>

            <Field label="H1 Headline"><Inp value={c.h1} onChange={v => u("h1", v)} placeholder="Fast Personal Loans Up To $5,000" /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Badge Text"><Inp value={c.badge} onChange={v => u("badge", v)} placeholder="No Credit Check Required" /></Field>
                <Field label="CTA Button"><Inp value={c.cta} onChange={v => u("cta", v)} placeholder="Check Your Rate →" /></Field>
            </div>
            <Field label="Sub-headline"><Inp value={c.sub} onChange={v => u("sub", v)} placeholder="Get approved in minutes. Funds fast." /></Field>
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

