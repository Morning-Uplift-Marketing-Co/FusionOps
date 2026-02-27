import { THEME as T } from "../../../constants";
import { Field } from "../../ui/field";
import { InputField as Inp } from "../../ui/input-field";

export function StepTemplateCode({ c, u, onGenerate, isGenerating }) {
    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💻</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Custom Code</h2>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    Add custom CSS/JS or enable tracking (optional)
                </p>
            </div>

            <Field label="Include Tracking" help="Enable LeadsGate/Voluum tracking scripts">
                <button
                    onClick={() => u("includeTracking", !c.includeTracking)}
                    style={{
                        width: "100%",
                        padding: 14,
                        borderRadius: 10,
                        background: c.includeTracking ? `${T.primary}20` : T.input,
                        border: `2px solid ${c.includeTracking ? T.primary : T.border}`,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: c.includeTracking ? T.primary : T.text,
                    }}>
                        📊 Tracking Enabled
                    </span>
                    <div style={{
                        width: 48,
                        height: 26,
                        borderRadius: 13,
                        background: c.includeTracking ? T.primary : T.muted,
                        position: "relative",
                        transition: "all 0.2s",
                    }}>
                        <div style={{
                            position: "absolute",
                            top: 3,
                            left: c.includeTracking ? 25 : 3,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "all 0.2s",
                        }} />
                    </div>
                </button>
            </Field>

            <Field label="Custom CSS" help="Additional styles to include">
                <textarea
                    value={c.customCss}
                    onChange={(e) => u("customCss", e.target.value)}
                    placeholder="/* Your custom CSS */"
                    style={{
                        width: "100%",
                        minHeight: 100,
                        padding: "12px 14px",
                        background: T.input,
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        color: T.text,
                        fontSize: 13,
                        fontFamily: "monospace",
                        resize: "vertical",
                    }}
                />
            </Field>

            <Field label="Custom JavaScript" help="Additional scripts to include">
                <textarea
                    value={c.customJs}
                    onChange={(e) => u("customJs", e.target.value)}
                    placeholder="// Your custom JavaScript"
                    style={{
                        width: "100%",
                        minHeight: 100,
                        padding: "12px 14px",
                        background: T.input,
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        color: T.text,
                        fontSize: 13,
                        fontFamily: "monospace",
                        resize: "vertical",
                    }}
                />
            </Field>

            {/* Template Preview */}
            <div style={{
                marginTop: 20,
                padding: 16,
                background: T.input,
                borderRadius: 10,
                border: `1px solid ${T.border}`,
            }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 12 }}>
                    📋 Template Summary
                </div>
                <div style={{ fontSize: 12, display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: T.muted }}>Name:</span>
                        <span style={{ fontWeight: 600 }}>{c.templateName || "—"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: T.muted }}>Category:</span>
                        <span>{c.category}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: T.muted }}>Features:</span>
                        <span>
                            {["hasHeroForm", "hasCalculator", "hasTestimonials", "hasFAQ", "hasTrustBadges", "hasDarkMode"]
                                .filter((f) => c[f]).length} selected
                        </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: T.muted }}>Tracking:</span>
                        <span style={{ color: c.includeTracking ? "#22c55e" : T.muted }}>
                            {c.includeTracking ? "✓ Enabled" : "— Disabled"}
                        </span>
                    </div>
                </div>
            </div>

            <button
                onClick={onGenerate}
                disabled={isGenerating}
                style={{
                    width: "100%",
                    marginTop: 20,
                    padding: 16,
                    borderRadius: 12,
                    background: isGenerating ? T.input : `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryDark} 100%)`,
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                    border: "none",
                    cursor: isGenerating ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    transition: "all 0.2s",
                }}
            >
                {isGenerating ? (
                    <>
                        <span style={{ animation: "spin 1s linear infinite" }}>⚙️</span>
                        Generating Template Code...
                    </>
                ) : (
                    <>
                        <span>🚀</span>
                        Generate Template Code
                    </>
                )}
            </button>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
}
