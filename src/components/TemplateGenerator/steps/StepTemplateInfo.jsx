import { THEME as T } from "../../../constants";
import { Field } from "../../ui/field";
import { InputField as Inp } from "../../ui/input-field";

const CATEGORIES = [
    { id: "general", name: "General", icon: "🌐" },
    { id: "pdl", name: "PDL/Loans", icon: "💰" },
    { id: "insurance", name: "Insurance", icon: "🛡️" },
    { id: "education", name: "Education", icon: "📚" },
];

const BADGES = [
    { id: "New", name: "New", color: "#22c55e" },
    { id: "Popular", name: "Popular", color: "#f59e0b" },
    { id: "Stable", name: "Stable", color: "#3b82f6" },
    { id: "Beta", name: "Beta", color: "#8b5cf6" },
    { id: "Advanced", name: "Advanced", color: "#ef4444" },
];

export function StepTemplateInfo({ c, u, templates }) {
    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Template Information</h2>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    Define your template identity
                </p>
            </div>

            <Field label="Template Name" req help="e.g. Modern Finance LP">
                <Inp
                    value={c.templateName}
                    onChange={(v) => u("templateName", v)}
                    placeholder="Modern Finance LP"
                />
            </Field>

            <Field label="Description" req help="Brief description of what this template does">
                <textarea
                    value={c.templateDescription}
                    onChange={(e) => u("templateDescription", e.target.value)}
                    placeholder="A modern, conversion-focused landing page for financial services with hero form and testimonials..."
                    style={{
                        width: "100%",
                        minHeight: 80,
                        padding: "12px 14px",
                        background: T.input,
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        color: T.text,
                        fontSize: 14,
                        fontFamily: "inherit",
                        resize: "vertical",
                    }}
                />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Category">
                    <select
                        value={c.category}
                        onChange={(e) => u("category", e.target.value)}
                        style={{
                            width: "100%",
                            padding: "12px 14px",
                            background: T.input,
                            border: `1px solid ${T.border}`,
                            borderRadius: 8,
                            color: T.text,
                            fontSize: 14,
                            cursor: "pointer",
                        }}
                    >
                        {CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.name}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field label="Badge">
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {BADGES.map((badge) => (
                            <button
                                key={badge.id}
                                onClick={() => u("badge", badge.id)}
                                style={{
                                    padding: "8px 14px",
                                    borderRadius: 20,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    border: `2px solid ${c.badge === badge.id ? badge.color : T.border}`,
                                    background: c.badge === badge.id ? `${badge.color}20` : T.input,
                                    color: c.badge === badge.id ? badge.color : T.text,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                }}
                            >
                                {badge.name}
                            </button>
                        ))}
                    </div>
                </Field>
            </div>

            <div style={{
                padding: 14,
                background: `${T.primary}10`,
                border: `1px solid ${T.primary}30`,
                borderRadius: 10,
                marginTop: 12,
            }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.primary, marginBottom: 6 }}>💡 Pro Tip</div>
                <div style={{ fontSize: 12, color: T.muted }}>
                    Choose a descriptive name and clear category so others can easily find and use your template.
                </div>
            </div>
        </>
    );
}
