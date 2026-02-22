import { THEME as T } from "../../../constants";

const FEATURES = [
    { id: "hasHeroForm", name: "Hero Form", icon: "📝", desc: "Email capture form in hero section" },
    { id: "hasCalculator", name: "Calculator", icon: "🧮", desc: "Interactive payment/calculator widget" },
    { id: "hasTestimonials", name: "Testimonials", icon: "💬", desc: "Customer review/testimonial section" },
    { id: "hasFAQ", name: "FAQ Section", icon: "❓", desc: "Collapsible FAQ accordion" },
    { id: "hasTrustBadges", name: "Trust Badges", icon: "🛡️", desc: "Security/trust indicators" },
    { id: "hasDarkMode", name: "Dark Mode", icon: "🌙", desc: "Automatic dark mode support" },
];

export function StepTemplateFeatures({ c, u }) {
    const toggleFeature = (id) => {
        u(id, !c[id]);
    };

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Features</h2>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    Select the features you want in your template
                </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {FEATURES.map((feature) => {
                    const isActive = c[feature.id];
                    return (
                        <button
                            key={feature.id}
                            onClick={() => toggleFeature(feature.id)}
                            style={{
                                padding: 16,
                                borderRadius: 12,
                                background: isActive ? T.primaryGlow : T.input,
                                border: `2px solid ${isActive ? T.primary : T.border}`,
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.2s",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 12,
                            }}
                        >
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                background: isActive ? `${T.primary}30` : T.card2,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 22,
                                flexShrink: 0,
                            }}>
                                {feature.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: isActive ? "#fff" : T.text,
                                    marginBottom: 2,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}>
                                    {feature.name}
                                    {isActive && (
                                        <span style={{
                                            fontSize: 10,
                                            background: "#22c55e",
                                            color: "#fff",
                                            padding: "2px 6px",
                                            borderRadius: 4,
                                            marginLeft: "auto",
                                        }}>ON</span>
                                    )}
                                </div>
                                <div style={{
                                    fontSize: 11,
                                    color: isActive ? "rgba(255,255,255,0.7)" : T.muted,
                                }}>
                                    {feature.desc}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Presets */}
            <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 10 }}>
                    Quick Presets
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                        onClick={() => {
                            u("hasHeroForm", true);
                            u("hasCalculator", true);
                            u("hasTestimonials", true);
                            u("hasFAQ", true);
                            u("hasTrustBadges", true);
                            u("hasDarkMode", true);
                        }}
                        style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: T.input,
                            border: `1px solid ${T.border}`,
                            color: T.text,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        🚀 All Features
                    </button>
                    <button
                        onClick={() => {
                            u("hasHeroForm", true);
                            u("hasCalculator", false);
                            u("hasTestimonials", false);
                            u("hasFAQ", false);
                            u("hasTrustBadges", true);
                            u("hasDarkMode", false);
                        }}
                        style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: T.input,
                            border: `1px solid ${T.border}`,
                            color: T.text,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        ⚡ Minimal
                    </button>
                    <button
                        onClick={() => {
                            u("hasHeroForm", false);
                            u("hasCalculator", false);
                            u("hasTestimonials", true);
                            u("hasFAQ", true);
                            u("hasTrustBadges", false);
                            u("hasDarkMode", true);
                        }}
                        style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: T.input,
                            border: `1px solid ${T.border}`,
                            color: T.text,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        📄 Content Only
                    </button>
                    <button
                        onClick={() => {
                            u("hasHeroForm", false);
                            u("hasCalculator", false);
                            u("hasTestimonials", false);
                            u("hasFAQ", false);
                            u("hasTrustBadges", false);
                            u("hasDarkMode", false);
                        }}
                        style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: T.input,
                            border: `1px solid ${T.border}`,
                            color: T.text,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        🧹 Clear All
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div style={{
                marginTop: 20,
                padding: 14,
                background: T.input,
                borderRadius: 10,
                border: `1px solid ${T.border}`,
            }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 8 }}>
                    Selected Features ({FEATURES.filter((f) => c[f.id]).length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {FEATURES.filter((f) => c[f.id]).map((f) => (
                        <span
                            key={f.id}
                            style={{
                                fontSize: 11,
                                padding: "4px 10px",
                                background: `${T.primary}20`,
                                color: T.primary,
                                borderRadius: 6,
                                fontWeight: 600,
                            }}
                        >
                            {f.icon} {f.name}
                        </span>
                    ))}
                    {FEATURES.filter((f) => c[f.id]).length === 0 && (
                        <span style={{ fontSize: 12, color: T.muted, fontStyle: "italic" }}>
                            No features selected
                        </span>
                    )}
                </div>
            </div>
        </>
    );
}
