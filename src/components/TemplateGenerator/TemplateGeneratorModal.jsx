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
    mode: MODE_BLANK,
    step: 0,
    templateName: "",
    templateDescription: "",
    category: "general",
    badge: "New",
    newFolderId: "",
    sourceTemplate: "",
    colorId: "",
    fontId: "",
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

    if (!open) return null;

    const update = (key, value) => {
        setState(prev => ({ ...prev, [key]: value }));
    };

    const resetAndSetMode = (mode) => {
        setState({ ...DEFAULT_STATE, mode, step: 1 });
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

    const handleSave = () => {
        if (onSave) {
            onSave(state);
        }
        handleClose();
    };

    const handleClose = () => {
        setState(DEFAULT_STATE);
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
    const showModeSelector = state.mode === MODE_BLANK ? state.step === 0 : false;

    return createPortal(
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
        }}>
            <div style={{
                background: T.card,
                borderRadius: 16,
                width: "90%",
                maxWidth: 700,
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
            }}>
                {/* Header */}
                <div style={{
                    padding: "20px 24px",
                    borderBottom: "1px solid " + T.border,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 24 }}>🧙</span>
                        <div>
                            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: T.text }}>
                                Template Generator Wizard
                            </h2>
                            <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>
                                Create custom LP templates
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        style={{
                            background: "none",
                            border: "none",
                            fontSize: 24,
                            cursor: "pointer",
                            color: T.muted,
                        }}
                    >×</button>
                </div>

                {/* Mode Selector */}
                {showModeSelector ? (
                    <div style={{
                        padding: "16px 24px",
                        borderBottom: "1px solid " + T.border,
                    }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 12 }}>
                            Choose Generation Mode
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                            {[
                                { mode: MODE_BLANK, icon: "📝", title: "Start from Scratch", desc: "Custom design with wizard" },
                                { mode: MODE_FROM_TEMPLATE, icon: "📂", title: "Clone Existing", desc: "From built-in templates" },
                                { mode: MODE_FROM_ZIP, icon: "�", title: "Upload ZIP", desc: "Import Astro project" },
                            ].map(({ mode, icon, title, desc }) => (
                                <button
                                    key={mode}
                                    onClick={() => setState({ ...DEFAULT_STATE, mode, step: 0 })}
                                    style={{
                                        padding: 16,
                                        borderRadius: 12,
                                        background: T.input,
                                        border: "2px solid " + T.border,
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        textAlign: "center",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = T.primaryGlow;
                                        e.currentTarget.style.borderColor = T.primary;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = T.input;
                                        e.currentTarget.style.borderColor = T.border;
                                    }}
                                >
                                    <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</div>
                                    <div style={{ fontSize: 11, color: T.muted }}>{desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Progress Steps */
                    <div style={{
                        padding: "16px 24px",
                        borderBottom: "1px solid " + T.border,
                        display: "flex",
                        gap: 8,
                        overflowX: "auto",
                    }}>
                        {steps.map((step, idx) => {
                            const isActive = idx === state.step;
                            const isComplete = idx < state.step;
                            return (
                                <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        background: isActive ? T.primaryGlow : (isComplete ? T.primary + "20" : T.input),
                                        color: (isActive || isComplete) ? "#fff" : T.muted,
                                        border: "2px solid " + (isActive ? T.primary : T.border),
                                    }}>
                                        {isComplete ? "✓" : step.icon}
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: (isActive ? T.text : T.muted) }}>
                                        {step.title}
                                    </span>
                                    {idx < steps.length - 1 && (
                                        <div style={{
                                            width: 24,
                                            height: 2,
                                            background: isComplete ? T.primary : T.border,
                                        }} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Content */}
                <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
                    {renderStep()}
                </div>

                {/* Footer */}
                <div style={{
                    padding: "16px 24px",
                    borderTop: "1px solid " + T.border,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                    <button
                        onClick={() => {
                            if (state.step === 0 && state.mode === MODE_BLANK) {
                                handleClose();
                            } else if (state.step === 0 && state.mode === MODE_FROM_TEMPLATE) {
                                // Go back to mode selector
                                setState({ ...DEFAULT_STATE, mode: MODE_BLANK, step: 0 });
                            } else {
                                goBack();
                            }
                        }}
                        style={{
                            padding: "10px 20px",
                            background: "transparent",
                            color: T.text,
                            border: "1px solid " + T.border,
                            borderRadius: 8,
                            cursor: "pointer",
                        }}
                    >
                        {state.step === 0 && state.mode === MODE_BLANK ? "Cancel" : "← Back"}
                    </button>

                    {(state.step === 4 && state.mode === MODE_BLANK) || (state.step === 1 && state.mode === MODE_FROM_TEMPLATE) || (state.step === 1 && state.mode === MODE_FROM_ZIP) ? (
                        <Button onClick={handleSave} style={{ background: "#22c55e", color: "#fff" }}>
                            Save Template
                        </Button>
                    ) : (
                        <button
                            onClick={goNext}
                            disabled={!canGoNext() || isGenerating}
                            style={{
                                padding: "12px 24px",
                                background: (canGoNext() ? T.primary : T.input),
                                color: "#fff",
                                borderRadius: 10,
                                fontSize: 15,
                                fontWeight: 700,
                                border: "none",
                                cursor: (canGoNext() && !isGenerating) ? "pointer" : "not-allowed",
                                opacity: (canGoNext() && !isGenerating) ? 1 : 0.5,
                            }}
                        >
                            Next →
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
