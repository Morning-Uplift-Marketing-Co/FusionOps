import { THEME as T } from "../../../constants";
import { COLORS, FONTS } from "../../../constants";
import { Field } from "../../ui/field";

const HERO_STYLES = [
    { id: "gradient", name: "Gradient", icon: "🌅", color: "#667eea" },
    { id: "solid", name: "Solid", icon: "🎨", color: "#3b82f6" },
    { id: "minimal", name: "Minimal", icon: "✨", color: "#ffffff" },
];

const LAYOUTS = [
    { id: "centered", name: "Centered", icon: "🎯" },
    { id: "split", name: "Split", icon: "⚖️" },
    { id: "left", name: "Left", icon: "⬅️" },
];

export function StepTemplateDesign({ c, u }) {
    const selectedColor = COLORS.find((x) => x.id === c.colorId) || COLORS[0];
    const selectedFont = FONTS.find((x) => x.id === c.fontId) || FONTS[0];
    const heroStyle = HERO_STYLES.find((s) => s.id === c.heroStyle) || HERO_STYLES[0];

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎨</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Design System</h2>
                <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    Choose colors, fonts, and layout
                </p>
            </div>

            {/* Color Selection */}
            <Field label="Primary Color" req>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                    {COLORS.map((color) => {
                        const isActive = c.colorId === color.id;
                        const bg = "hsl(" + color.p[0] + " " + color.p[1] + "% " + color.p[2] + "%)";
                        return (
                            <button
                                key={color.id}
                                onClick={() => u("colorId", color.id)}
                                title={color.name}
                                style={{
                                    width: "100%",
                                    aspectRatio: 1,
                                    borderRadius: 10,
                                    background: bg,
                                    border: "3px solid " + (isActive ? T.text : "transparent"),
                                    cursor: "pointer",
                                    position: "relative",
                                }}
                            >
                                {isActive && (
                                    <span style={{
                                        position: "absolute",
                                        inset: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 16,
                                    }}>✓</span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
                    Selected: <b>{selectedColor.name}</b>
                </div>
            </Field>

            {/* Font Selection */}
            <Field label="Typography" req>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {FONTS.map((font) => {
                        const isActive = c.fontId === font.id;
                        return (
                            <button
                                key={font.id}
                                onClick={() => u("fontId", font.id)}
                                style={{
                                    padding: 14,
                                    borderRadius: 10,
                                    background: isActive ? T.primaryGlow : T.input,
                                    border: "2px solid " + (isActive ? T.primary : T.border),
                                    cursor: "pointer",
                                    textAlign: "left",
                                }}
                            >
                                <div style={{
                                    fontFamily: font.family,
                                    fontSize: 16,
                                    fontWeight: 700,
                                    marginBottom: 4,
                                    color: isActive ? "#fff" : T.text,
                                }}>
                                    {font.name}
                                </div>
                                <div style={{ fontSize: 10, color: isActive ? "rgba(255,255,255,0.7)" : T.muted }}>
                                    {font.style}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </Field>

            {/* Hero Style */}
            <Field label="Hero Style">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {HERO_STYLES.map((style) => {
                        const isActive = c.heroStyle === style.id;
                        return (
                            <button
                                key={style.id}
                                onClick={() => u("heroStyle", style.id)}
                                style={{
                                    padding: 12,
                                    borderRadius: 10,
                                    background: isActive ? T.primaryGlow : T.input,
                                    border: "2px solid " + (isActive ? T.primary : T.border),
                                    cursor: "pointer",
                                }}
                            >
                                <div style={{ fontSize: 20, marginBottom: 6 }}>{style.icon}</div>
                                <div style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: isActive ? "#fff" : T.text,
                                }}>{style.name}</div>
                            </button>
                        );
                    })}
                </div>
            </Field>

            {/* Layout */}
            <Field label="Layout">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {LAYOUTS.map((layout) => {
                        const isActive = c.layout === layout.id;
                        return (
                            <button
                                key={layout.id}
                                onClick={() => u("layout", layout.id)}
                                style={{
                                    padding: 16,
                                    borderRadius: 10,
                                    background: isActive ? T.primaryGlow : T.input,
                                    border: "2px solid " + (isActive ? T.primary : T.border),
                                    cursor: "pointer",
                                }}
                            >
                                <div style={{ fontSize: 24, marginBottom: 8 }}>{layout.icon}</div>
                                <div style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: isActive ? "#fff" : T.text,
                                }}>{layout.name}</div>
                            </button>
                        );
                    })}
                </div>
            </Field>

            {/* Preview */}
            <div style={{
                marginTop: 20,
                padding: 20,
                borderRadius: 12,
                border: "1px solid " + T.border,
                background: T.bg,
            }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: T.muted }}>
                    Live Preview
                </div>
                <div style={{
                    padding: 40,
                    borderRadius: 10,
                    background: heroStyle.color,
                    color: c.heroStyle === "minimal" ? T.text : "#fff",
                    textAlign: c.layout === "centered" ? "center" : "left",
                    fontFamily: selectedFont.family,
                }}>
                    <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 12px" }}>
                        Your Headline
                    </h1>
                    <p style={{ fontSize: 16, opacity: 0.9, margin: 0 }}>
                        Your subheadline
                    </p>
                    <div style={{
                        marginTop: 20,
                        display: "inline-block",
                        padding: "12px 24px",
                        background: c.heroStyle === "minimal" ? (selectedColor.a ? "hsl(" + selectedColor.a[0] + " " + selectedColor.a[1] + "% " + selectedColor.a[2] + "%)" : T.primary) : "#fff",
                        color: c.heroStyle === "minimal" ? "#fff" : (selectedColor.a ? "hsl(" + selectedColor.a[0] + " " + selectedColor.a[1] + "% " + selectedColor.a[2] + "%)" : T.text),
                        borderRadius: 8,
                        fontWeight: 700,
                    }}>
                        Get Started
                    </div>
                </div>
            </div>
        </>
    );
}
