import { useState } from "react";
import { createPortal } from "react-dom";
import { THEME as T } from "../../constants";
import { Button } from "../ui/button";

// Steps
import { StepTemplateInfo } from "./steps/StepTemplateInfo";
import { StepTemplateDesign } from "./steps/StepTemplateDesign";
import { StepTemplateFeatures } from "./steps/StepTemplateFeatures";
import { StepTemplateCode } from "./steps/StepTemplateCode";
import { StepTemplateReview } from "./steps/StepTemplateReview";
import { StepTemplateFromDir } from "./steps/StepTemplateFromDir";
import { StepTemplateFromZip } from "./steps/StepTemplateFromZip";
import { generateTemplateCode } from "./generateTemplateCode";

const MODE_BLANK = "blank";
const MODE_FROM_TEMPLATE = "from-template";
const MODE_FROM_ZIP = "from-zip";

const STEPS_BLANK = [
    { id: "info", title: "Template Info", icon: "📝" },
    { id: "design", title: "Design", icon: "🎨" },
    { id: "features", title: "Features", icon: "⚡" },
    { id: "code", title: "Generate", icon: "💻" },
    { id: "review", title: "Review", icon: "✅" },
];

const STEPS_FROM_TEMPLATE = [
    { id: "from-dir", title: "Clone Template", icon: "📂" },
    { id: "review", title: "Review", icon: "✅" },
];

const STEPS_FROM_ZIP = [
    { id: "from-zip", title: "Upload ZIP", icon: "📦" },
    { id: "review", title: "Review", icon: "✅" },
];

const DEFAULT_STATE = {
    mode: null,
    step: 0,
    templateName: "",
    templateDescription: "",
    category: "general",
    badge: "New",
    newFolderId: "",
    sourceTemplate: "",
    colorId: "ocean",
    fontId: "inter",
    heroStyle: "gradient",
    layout: "centered",
    hasHeroForm: true,
    hasCalculator: false,
    hasTestimonials: false,
    hasFAQ: false,
    hasTrustBadges: false,
    hasDarkMode: false,
    customCss: "",
    customJs: "",
    includeTracking: true,
    generatedCode: null,
    generatedFiles: null,
};

export function TemplateGeneratorModal({ open, onClose, onSave, templates }) {
    const [state, setState] = useState(DEFAULT_STATE);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // { step, message, ok, error }

    if (!open) return null;

    const update = (key, value) => {
        setState(prev => ({ ...prev, [key]: value }));
    };

    

    const goNext = () => {
        if (state.step < getSteps().length - 1) {
            setState(prev => ({ ...prev, step: prev.step + 1 }));
        }
    };

    const goBack = () => {
        if (state.step > 0) {
            setState(prev => ({ ...prev, step: prev.step - 1 }));
        }
    };

    const getSteps = () => {
        if (state.mode === MODE_FROM_TEMPLATE) return STEPS_FROM_TEMPLATE;
        if (state.mode === MODE_FROM_ZIP) return STEPS_FROM_ZIP;
        return STEPS_BLANK;
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            await new Promise(r => setTimeout(r, 500));
            const templateCode = generateTemplateCode(state);
            setState(prev => ({ ...prev, generatedCode: templateCode, step: 4 }));
        } catch (error) {
            console.error("Generation failed:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!onSave) return;
        setIsSaving(true);
        setSaveStatus({ step: 'saving', message: 'Saving template to database...' });
        try {
            await onSave(state, (status) => setSaveStatus(status));
            setSaveStatus({ step: 'done', message: '✅ Template saved & pushed to GitHub!', ok: true });
            setTimeout(() => handleClose(), 1200);
        } catch (e) {
            setSaveStatus({ step: 'error', message: `❌ ${e.message}`, error: true });
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        if (isSaving) return;
        setState(DEFAULT_STATE);
        setSaveStatus(null);
        setIsSaving(false);
        onClose();
    };

    const handleGenerateResult = (result) => {
        if (typeof result === 'string') {
            setState(prev => ({ ...prev, generatedCode: result, step: 1 }));
        } else {
            setState(prev => ({ ...prev, generatedCode: result.sourceCode, generatedFiles: result.files, step: 1 }));
        }
    };

    const renderStep = () => {
        if (state.mode === MODE_FROM_TEMPLATE) {
            if (state.step === 0) {
                return <StepTemplateFromDir c={state} u={update} onGenerate={handleGenerateResult} isGenerating={isGenerating} />;
            }
            return <StepTemplateReview c={state} u={update} />;
        }

        if (state.mode === MODE_FROM_ZIP) {
            if (state.step === 0) {
                return <StepTemplateFromZip c={state} u={update} onGenerate={handleGenerateResult} />;
            }
            return <StepTemplateReview c={state} u={update} />;
        }
        // Blank mode
        switch (state.step) {
            case 0: return <StepTemplateInfo c={state} u={update} templates={templates} />;
            case 1: return <StepTemplateDesign c={state} u={update} />;
            case 2: return <StepTemplateFeatures c={state} u={update} />;
            case 3: return <StepTemplateCode c={state} u={update} onGenerate={handleGenerate} isGenerating={isGenerating} />;
            case 4: return <StepTemplateReview c={state} u={update} />;
            default: return null;
        }
    };

    const canGoNext = () => {
        if (state.mode === MODE_FROM_TEMPLATE) {
            if (state.step === 0) {
                return state.newFolderId && state.sourceTemplate;
            }
            return state.generatedCode !== null;
        }

        if (state.mode === MODE_FROM_ZIP) {
            if (state.step === 0) {
                return state.newFolderId && state.templateName && state.generatedFiles !== null;
            }
            return state.generatedCode !== null;
        }
        switch (state.step) {
            case 0: return state.templateName && state.templateDescription;
            case 1: return state.colorId && state.fontId;
            case 2: return true;
            case 3: return state.generatedCode !== null;
            case 4: return true;
            default: return false;
        }
    };

    const steps = getSteps();
    const showModeSelector = state.mode === null;
    const isLastStep = state.mode !== null && state.step === steps.length - 1;

    return createPortal(
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "fadeIn .2s ease-out",
        }}>
            <div style={{
                background: "linear-gradient(165deg, #1a1d2e 0%, #0b0d14 100%)",
                borderRadius: 24,
                width: "92%",
                maxWidth: 800,
                maxHeight: "92vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
            }}>
                {/* Premium Header */}
                <div style={{
                    padding: "32px 40px 24px 40px",
                    background: "linear-gradient(to right, rgba(99,102,241,0.08), transparent)",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    position: "relative",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            background: "rgba(99,102,241,0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 32,
                            boxShadow: "inset 0 0 20px rgba(99,102,241,0.2)",
                            border: "1px solid rgba(99,102,241,0.3)",
                        }}>🧙</div>
                        <div>
                            <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "#fff", letterSpacing: "-0.02em" }}>
                                Template <span style={{ color: T.primary }}>Wizard</span>
                            </h2>
                            <p style={{ fontSize: 13, color: T.muted, margin: "2px 0 0 0", fontWeight: 500 }}>
                                Craft high-performance LP architectures
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 12,
                            width: 40,
                            height: 40,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            color: T.muted,
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                            e.currentTarget.style.color = "#ef4444";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                            e.currentTarget.style.color = T.muted;
                        }}
                    >✕</button>
                </div>


                {/* Content Area with background glow */}
                <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
                    {/* Mode Selector */}
                    {showModeSelector ? (
                        <div style={{ padding: "48px 40px" }}>
                            <div style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: T.primary,
                                marginBottom: 32,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                display: "flex",
                                alignItems: "center",
                                gap: 12
                            }}>
                                <div style={{ width: 32, height: 2, background: T.primary, borderRadius: 1 }} />
                                Choose Your Architecture Path
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                                {[
                                    { mode: MODE_BLANK, icon: "✨", title: "Blank Canvas", desc: "Build a bespoke design from the ground up" },
                                    { mode: MODE_FROM_TEMPLATE, icon: "📂", title: "Rapid Blueprint", desc: "Clone and refine an industry-standard template" },
                                    { mode: MODE_FROM_ZIP, icon: "📦", title: "Smart Import", desc: "Upload Astro source and optimize with AI" },
                                ].map(({ mode, icon, title, desc }) => (
                                    <button
                                        key={mode}
                                        onClick={() => setState({ ...DEFAULT_STATE, mode, step: 0 })}
                                        style={{
                                            padding: "32px 24px",
                                            borderRadius: 24,
                                            background: "rgba(255,255,255,0.03)",
                                            border: "1px solid rgba(255,255,255,0.06)",
                                            cursor: "pointer",
                                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                            textAlign: "center",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            backdropFilter: "blur(4px)",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                                            e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)";
                                            e.currentTarget.style.transform = "translateY(-6px)";
                                            e.currentTarget.style.boxShadow = "0 30px 60px rgba(0,0,0,0.4), 0 0 30px rgba(99,102,241,0.1)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                                            e.currentTarget.style.transform = "translateY(0)";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                    >
                                        <div style={{
                                            fontSize: 40,
                                            marginBottom: 20,
                                            filter: "drop-shadow(0 0 15px rgba(255,255,255,0.15))",
                                        }}>{icon}</div>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 10 }}>{title}</div>
                                        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, fontWeight: 400 }}>{desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Progress Steps Modern Wrapper */
                        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                            <div style={{
                                padding: "24px 40px",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                display: "flex",
                                gap: 6,
                                background: "rgba(0,0,0,0.15)",
                            }}>
                                {steps.map((s, idx) => {
                                    const isActive = idx === state.step;
                                    const isComplete = idx < state.step;
                                    return (
                                        <div key={s.id} style={{
                                            flex: 1,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 10,
                                            position: "relative",
                                            opacity: isActive ? 1 : isComplete ? 0.9 : 0.3,
                                            transition: "all 0.4s ease"
                                        }}>
                                            <div style={{
                                                height: 3,
                                                borderRadius: 1.5,
                                                background: isActive ? T.primary : isComplete ? T.success : "rgba(255,255,255,0.1)",
                                                boxShadow: isActive ? `0 0 20px ${T.primary}aa` : "none",
                                            }} />
                                            <div style={{
                                                fontSize: 10,
                                                fontWeight: 800,
                                                color: isActive ? T.primary : "#fff",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.08em",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6
                                            }}>
                                                <span style={{ fontSize: 12 }}>{isComplete ? "✓" : s.icon}</span>
                                                <span style={{ whiteSpace: "nowrap" }}>{s.title}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ padding: "40px", flex: 1 }}>
                                {renderStep()}
                            </div>
                        </div>
                    )}
                </div>

                {/* Premium Footer */}
                <div style={{
                    padding: "32px 40px",
                    background: "rgba(0,0,0,0.3)",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                    <div style={{ display: "flex", gap: 12 }}>
                        {!showModeSelector && (
                            <button
                                onClick={() => {
                                    if (state.step === 0) {
                                        setState({ ...DEFAULT_STATE, mode: null });
                                    } else {
                                        goBack();
                                    }
                                }}
                                disabled={isGenerating}
                                style={{
                                    padding: "12px 24px",
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 14,
                                    color: "#fff",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                            >
                                ← Back
                            </button>
                        )}
                        <button
                            onClick={handleClose}
                            disabled={isGenerating}
                            style={{
                                padding: "12px 24px",
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.05)",
                                borderRadius: 14,
                                color: T.muted,
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Cancel
                        </button>
                    </div>

                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        {isSaving && saveStatus && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 12,
                                background: saveStatus.error ? 'rgba(239,68,68,0.12)' : saveStatus.ok ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)',
                                border: `1px solid ${saveStatus.error ? 'rgba(239,68,68,0.3)' : saveStatus.ok ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}`,
                            }}>
                                {!saveStatus.ok && !saveStatus.error && (
                                    <div style={{ width: 14, height: 14, border: `2px solid ${T.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                                )}
                                <span style={{ fontSize: 13, fontWeight: 600, color: saveStatus.error ? '#ef4444' : saveStatus.ok ? '#22c55e' : T.primary }}>
                                    {saveStatus.message}
                                </span>
                            </div>
                        )}
                        {isGenerating && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div className="animate-spin" style={{ width: 14, height: 14, border: `2px solid ${T.primary}`, borderTopColor: "transparent", borderRadius: "50%" }} />
                                <span style={{ fontSize: 13, color: T.primary, fontWeight: 700 }}>
                                    Constructors...
                                </span>
                            </div>
                        )}

                        {!showModeSelector && (isLastStep ? (
                            <button
                                onClick={handleSave}
                                disabled={isGenerating || isSaving}
                                style={{
                                    padding: "14px 40px",
                                    background: T.grad,
                                    border: "none",
                                    borderRadius: 14,
                                    color: "#fff",
                                    fontSize: 14,
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                    boxShadow: `0 10px 30px rgba(168, 85, 247, 0.4)`,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "scale(1.05)";
                                    e.currentTarget.style.boxShadow = `0 15px 40px rgba(168, 85, 247, 0.6)`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "scale(1)";
                                    e.currentTarget.style.boxShadow = `0 10px 30px rgba(168, 85, 247, 0.4)`;
                                }}
                            >
                                {isGenerating ? "Finalizing..." : "🚀 Finalize Architecture"}
                            </button>
                        ) : (
                            <button
                                onClick={goNext}
                                disabled={!canGoNext() || isGenerating}
                                style={{
                                    padding: "14px 36px",
                                    background: canGoNext() ? T.primary : "rgba(255,255,255,0.05)",
                                    border: "none",
                                    borderRadius: 14,
                                    color: canGoNext() ? "#fff" : "rgba(255,255,255,0.2)",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: canGoNext() ? "pointer" : "not-allowed",
                                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                    boxShadow: canGoNext() ? `0 10px 25px ${T.primary}40` : "none",
                                }}
                                onMouseEnter={(e) => {
                                    if (canGoNext()) {
                                        e.currentTarget.style.background = T.primaryH;
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (canGoNext()) {
                                        e.currentTarget.style.background = T.primary;
                                        e.currentTarget.style.transform = "translateY(0)";
                                    }
                                }}
                            >
                                Next Step →
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
