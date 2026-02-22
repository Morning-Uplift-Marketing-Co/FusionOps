import React, { useState } from "react";
import { THEME as T, COLORS, FONTS } from "../constants";

export function TemplateEditor({ notify }) {
    const [selectedTemplate, setSelectedTemplate] = useState("elastic-credits-v4");
    const [config, setConfig] = useState({
        brand: "ElasticCredits",
        h1: "Fast Personal Loans Up To $5,000",
        cta: "Apply Now",
        colorId: "ocean",
        fontId: "dm-sans"
    });

    const templates = [
        { id: "elastic-credits-v4", name: "Elastic Credits V4", badge: "Premium", description: "Standard HTML template with trust badges and clean layout" },
        { id: "simple-lander", name: "Simple HTML Lander", badge: "Fast", description: "Minimalist HTML landing page for high conversion" }
    ];

    const handleDownload = () => {
        notify("Preparing HTML package...");
        // Logic to inject config into static HTML and trigger download
    };

    return (
        <div style={{ maxWidth: 1000, margin: "0 auto", animation: "fadeIn .3s" }}>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>🎨 Template Editor (Option 1)</h1>
                <p style={{ color: T.muted }}>Edit purchased HTML templates and download the modified source code.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: 24 }}>
                {/* Left: Content & Design */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>1. Select Template</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {templates.map(t => (
                                <div key={t.id}
                                    onClick={() => setSelectedTemplate(t.id)}
                                    style={{
                                        padding: 16, borderRadius: 12, border: `2px solid ${selectedTemplate === t.id ? T.primary : T.border}`,
                                        background: selectedTemplate === t.id ? `${T.primary}08` : "transparent",
                                        cursor: "pointer", transition: "all .2s"
                                    }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                        <b style={{ fontSize: 13 }}>{t.name}</b>
                                        <span style={{ fontSize: 9, background: T.primary, color: "#fff", padding: "2px 6px", borderRadius: 4 }}>{t.badge}</span>
                                    </div>
                                    <p style={{ fontSize: 11, color: T.dim, margin: 0 }}>{t.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>2. Edit Content</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: T.muted }}>Brand Name</label>
                                <input className="form-input" value={config.brand} onChange={e => setConfig({ ...config, brand: e.target.value })}
                                    style={{ width: "100%", padding: 12, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text }} />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: T.muted }}>Main Heading (H1)</label>
                                <input className="form-input" value={config.h1} onChange={e => setConfig({ ...config, h1: e.target.value })}
                                    style={{ width: "100%", padding: 12, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text }} />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: T.muted }}>Call to Action (CTA)</label>
                                <input className="form-input" value={config.cta} onChange={e => setConfig({ ...config, cta: e.target.value })}
                                    style={{ width: "100%", padding: 12, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Summary & Export */}
                <div style={{ position: "sticky", top: 100 }}>
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, boxShadow: "0 10px 30px rgba(0,0,0,.1)" }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Export Options</h3>

                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 12, color: T.dim, marginBottom: 4 }}>Resolution</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Pure HTML/CSS (Stateless)</div>
                        </div>

                        <button onClick={handleDownload} style={{
                            width: "100%", padding: 14, borderRadius: 10, border: "none",
                            background: T.grad, color: "#fff", fontWeight: 700, cursor: "pointer",
                            boxShadow: `0 4px 15px ${T.primary}44`, marginBottom: 12
                        }}>Download ZIP</button>

                        <div style={{ fontSize: 11, color: T.dim, textAlign: "center" }}>
                            * This will download a static version of the template with your changes applied.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
