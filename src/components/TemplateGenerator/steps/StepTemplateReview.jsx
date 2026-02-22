import { THEME as T } from "../../../constants";
import { Button } from "../../ui/button";
import { COLORS, FONTS } from "../../../constants";

export function StepTemplateReview({ c, u }) {
    const isCloneMode = !!c.sourceTemplate || (!c.colorId && !!c.generatedFiles);
    const selectedColor = COLORS.find((x) => x.id === c.colorId);
    const selectedFont = FONTS.find((x) => x.id === c.fontId);

    const features = [
        { key: "hasHeroForm", name: "Hero Form", icon: "📝" },
        { key: "hasCalculator", name: "Calculator", icon: "🧮" },
        { key: "hasTestimonials", name: "Testimonials", icon: "💬" },
        { key: "hasFAQ", name: "FAQ", icon: "❓" },
        { key: "hasTrustBadges", name: "Trust Badges", icon: "🛡️" },
        { key: "hasDarkMode", name: "Dark Mode", icon: "🌙" },
    ];

    const activeFeatures = features.filter((f) => c[f.key]);

    const copyCode = () => {
        if (c.generatedCode) {
            navigator.clipboard.writeText(c.generatedCode);
            u("copied", true);
            setTimeout(() => u("copied", false), 2000);
        }
    };

    const downloadCode = () => {
        if (c.generatedCode) {
            const blob = new Blob([c.generatedCode], { type: "text/javascript" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${c.templateName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-template.js`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Review & Save</h2>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    Your template is ready!
                </p>
            </div>

            {/* Template Info Card */}
            <div style={{
                padding: 20,
                background: T.input,
                borderRadius: 12,
                marginBottom: 16,
            }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <div style={{
                        width: 60,
                        height: 60,
                        borderRadius: 12,
                        background: selectedColor
                            ? `linear-gradient(135deg, hsl(${selectedColor.p[0]} ${selectedColor.p[1]}% ${selectedColor.p[2]}%) 0%, hsl(${selectedColor.s[0]} ${selectedColor.s[1]}% ${selectedColor.s[2]}%) 100%)`
                            : `linear-gradient(135deg, ${T.primary} 0%, ${T.primary}99 100%)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                        color: "#fff",
                        fontWeight: 800,
                    }}>
                        {c.templateName?.charAt(0) || "T"}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                                {c.templateName || "Untitled Template"}
                            </h3>
                            <span style={{
                                fontSize: 10,
                                padding: "2px 8px",
                                borderRadius: 10,
                                background: `${T.primary}20`,
                                color: T.primary,
                                fontWeight: 600,
                            }}>{c.badge}</span>
                        </div>
                        <p style={{ fontSize: 12, color: T.muted, margin: "0 0 8px" }}>
                            {c.templateDescription || "No description"}
                        </p>
                        <div style={{ display: "flex", gap: 8, fontSize: 11, flexWrap: "wrap" }}>
                            <span style={{ padding: "4px 8px", background: T.card2, borderRadius: 6 }}>
                                📁 {c.category || 'general'}
                            </span>
                            {c.sourceTemplate ? (
                                <span style={{ padding: "4px 8px", background: T.card2, borderRadius: 6 }}>
                                    📂 Cloned from: {c.sourceTemplate}
                                </span>
                            ) : isCloneMode ? (
                                <span style={{ padding: "4px 8px", background: T.card2, borderRadius: 6 }}>
                                    📦 Uploaded from ZIP
                                </span>
                            ) : (
                                <>
                                    {selectedColor && <span style={{ padding: "4px 8px", background: T.card2, borderRadius: 6 }}>🎨 {selectedColor.name}</span>}
                                    {selectedFont && <span style={{ padding: "4px 8px", background: T.card2, borderRadius: 6 }}>✍️ {selectedFont.name}</span>}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Features */}
            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 8 }}>
                    Features ({activeFeatures.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {activeFeatures.map((f) => (
                        <span
                            key={f.key}
                            style={{
                                fontSize: 12,
                                padding: "6px 12px",
                                background: `${T.primary}15`,
                                color: T.primary,
                                borderRadius: 8,
                                fontWeight: 600,
                            }}
                        >
                            {f.icon} {f.name}
                        </span>
                    ))}
                    {activeFeatures.length === 0 && (
                        <span style={{ fontSize: 12, color: T.muted, fontStyle: "italic" }}>
                            No features selected
                        </span>
                    )}
                </div>
            </div>

            {/* Generated Code Preview */}
            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 8 }}>
                    Generated Code
                </div>
                <div style={{
                    padding: 16,
                    background: "#1e1e1e",
                    borderRadius: 10,
                    maxHeight: 200,
                    overflow: "auto",
                }}>
                    <pre style={{
                        margin: 0,
                        fontSize: 11,
                        color: "#d4d4d4",
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                    }}>
                        {c.generatedCode ? (
                            <span>{c.generatedCode.substring(0, 500)}...</span>
                        ) : (
                            <span style={{ color: "#6a9955" }}>// No code generated yet</span>
                        )}
                    </pre>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Button
                        onClick={copyCode}
                        disabled={!c.generatedCode}
                        variant="ghost"
                        size="sm"
                        style={{ fontSize: 12 }}
                    >
                        {c.copied ? "✓ Copied!" : "📋 Copy Code"}
                    </Button>
                    <Button
                        onClick={downloadCode}
                        disabled={!c.generatedCode}
                        variant="ghost"
                        size="sm"
                        style={{ fontSize: 12 }}
                    >
                        💾 Download File
                    </Button>
                </div>
            </div>

            {/* Next Steps */}
            <div style={{
                padding: 16,
                background: `${T.primary}10`,
                borderRadius: 12,
                border: `1px solid ${T.primary}30`,
            }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.primary, marginBottom: 8 }}>
                    📝 Next Steps
                </div>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: T.muted }}>
                    <li>Click <strong>Save Template</strong> to save to the database</li>
                    <li>Template will appear instantly in LP Wizard → Design step</li>
                    <li>Select it when creating a new LP to use your custom template</li>
                </ol>
            </div>
        </>
    );
}
