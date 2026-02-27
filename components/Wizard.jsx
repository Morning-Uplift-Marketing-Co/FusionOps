import React, { useState, useMemo, useEffect, useRef } from "react";
import { THEME as T } from "../constants";
import { uid, now } from "../utils";
import { generateHtmlByTemplate } from "../utils/template-router";
import { api } from "../services/api";
import { MockPhone } from "./ui/mock-phone";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { StepBrand, StepProduct, StepDesign, StepCopy, StepTracking, StepReview } from "./Wizard/index.js";

// Domain validation regex
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;

// URL validation for redirect URLs
const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// Validation function for each step
function validateStep(stepNum, config) {
    const errors = [];

    if (stepNum === 1) {
        if (!config.brand?.trim()) errors.push("Brand Name is required");
        if (!config.domain?.trim()) errors.push("Domain is required");
        // Validate domain format
        if (config.domain?.trim() && !DOMAIN_REGEX.test(config.domain.trim())) {
            errors.push("Invalid domain format (e.g., example.com)");
        }
    }

    if (stepNum === 2) {
        if (!config.loanType) errors.push("Loan Type is required");
        if (config.amountMin < 0) errors.push("Min Amount cannot be negative");
        if (config.amountMax < 0) errors.push("Max Amount cannot be negative");
        if (config.amountMin >= config.amountMax) errors.push("Min Amount must be less than Max Amount");
        if (config.aprMin < 0) errors.push("Min APR cannot be negative");
        if (config.aprMax < 0) errors.push("Max APR cannot be negative");
        if (config.aprMin >= config.aprMax) errors.push("Min APR must be less than Max APR");
    }

    if (stepNum === 3) {
        if (!config.colorId) errors.push("Color Scheme is required");
    }

    if (stepNum === 5) {
        const hasRedirect = config.redirectUrl?.trim();
        const hasEmbed = config.formEmbed?.trim();
        if (!hasRedirect && !hasEmbed) {
            errors.push("At least one destination required: Redirect URL or Form Embed");
        }
        // Validate redirect URL format
        if (hasRedirect && !isValidUrl(hasRedirect)) {
            errors.push("Redirect URL must be a valid URL (e.g., https://example.com)");
        }
        if (hasEmbed && !/<(script|div|iframe)/i.test(hasEmbed)) {
            errors.push("Form Embed should contain &lt;script&gt;, &lt;div&gt;, or &lt;iframe&gt; tags");
        }
    }

    return { valid: errors.length === 0, errors };
}

const steps = ["Brand", "Product", "Design", "Copy", "Tracking", "Review"];

export function Wizard({ config, setConfig, addSite, setPage, settings, notify }) {
    const [step, setStep] = useState(1);
    const [building, setBuilding] = useState(false);
    const [validationErrors, setValidationErrors] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [initialConfig, setInitialConfig] = useState(null);
    const cardRef = useRef(null);

    const upd = (k, v) => setConfig(p => ({ ...p, [k]: v }));

    // Safe JSON serializer — strips non-serializable values (DOM nodes, functions, circular refs)
    const safeStringify = (obj) => {
        try {
            return JSON.stringify(obj, (_, v) => {
                if (typeof v === "function" || (typeof v === "object" && v !== null && (v instanceof Node || v === window))) return undefined;
                return v;
            });
        } catch {
            return "{}";
        }
    };

    // Track initial state for dirty detection
    useEffect(() => {
        if (config && !initialConfig) {
            setInitialConfig(safeStringify(config));
        }
    }, [config, initialConfig]);

    const isDirty = initialConfig && safeStringify(config) !== initialConfig;

    // beforeunload handler for unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    const handleNext = () => {
        const { valid, errors } = validateStep(step, config);
        if (!valid) {
            setValidationErrors(errors);
            cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }
        setValidationErrors([]);
        if (step < 6) setStep(s => s + 1);
    };

    const handleBackOrCancel = () => {
        if (isDirty && step > 1) {
            if (confirm("You have unsaved changes. Are you sure you want to go back?")) {
                step === 1 ? setPage("dashboard") : setStep(s => s - 1);
            }
        } else {
            step === 1 ? setPage("dashboard") : setStep(s => s - 1);
        }
    };

    const handleAiGenerate = async () => {
        setAiLoading(true);
        try {
            const p = await api.post("/ai/generate-copy", {
                brand: config.brand,
                loanType: config.loanType,
                amountMin: config.amountMin,
                amountMax: config.amountMax,
                lang: config.lang || "English"
            });

            if (p && !p.error) {
                if (p.h1) upd("h1", p.h1);
                if (p.badge) upd("badge", p.badge);
                if (p.cta) upd("cta", p.cta);
                if (p.sub) upd("sub", p.sub);
                if (p.tagline) upd("tagline", p.tagline);
                notify("AI copy generated!");
            } else {
                notify(p?.error || "AI generation failed. Check your API key.", "warning");
            }
        } catch (e) {
            console.warn("[Wizard] AI generation failed:", e?.message || e);
            notify("AI generation failed. Check your API key.", "warning");
        } finally {
            setAiLoading(false);
        }
    };

    const handleBuild = async () => {
        setBuilding(true);
        let finalConfig = { ...config };
        console.log("[Wizard] handleBuild - finalConfig.templateId:", finalConfig.templateId);
        console.log("[Wizard] handleBuild - finalConfig keys:", Object.keys(finalConfig));

        // Only generate AI copy if fields are empty
        const needsAiCopy = !finalConfig.h1 || !finalConfig.badge || !finalConfig.cta || !finalConfig.sub;
        if (needsAiCopy) {
            try {
                const p = await api.post("/ai/generate-copy", {
                    brand: finalConfig.brand,
                    loanType: finalConfig.loanType,
                    amountMin: finalConfig.amountMin,
                    amountMax: finalConfig.amountMax,
                    lang: finalConfig.lang || "English"
                });

                if (p && !p.error) {
                    if (!finalConfig.h1 && p.h1) finalConfig.h1 = p.h1;
                    if (!finalConfig.badge && p.badge) finalConfig.badge = p.badge;
                    if (!finalConfig.cta && p.cta) finalConfig.cta = p.cta;
                    if (!finalConfig.sub && p.sub) finalConfig.sub = p.sub;
                    if (!finalConfig.tagline && p.tagline) finalConfig.tagline = p.tagline;
                    setConfig(prev => ({ ...prev, ...finalConfig }));
                }
            } catch (e) {
                // AI copy generation is optional - continue with default values
                console.warn("[Wizard] Auto AI generation skipped:", e?.message || e);
            }
        }

        await new Promise(r => setTimeout(r, 1000));
        if (finalConfig._editMode) {
            // Edit mode: update existing site, keep same ID
            addSite({ ...finalConfig, status: "completed", updatedAt: now() });
        } else {
            // New site
            addSite({ ...finalConfig, id: uid(), status: "completed", createdAt: now(), cost: 0.001 });
        }
        setBuilding(false);
    };

    // Enter key navigation (skip if target is textarea)
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
            e.preventDefault();
            if (step < 6) handleNext();
        }
    };

    // Live preview HTML for steps 3, 4, 6
    const previewHtml = useMemo(
        () => generateHtmlByTemplate(config),
        [config.templateId, config.brand, config.domain, config.loanType, config.colorId, config.fontId, config.layout, config.radius, config.trustBadgeStyle, config.trustBadgeIconTone, config.h1, config.badge, config.cta, config.sub, config.amountMin, config.amountMax, config.redirectUrl, config.conversionId]
    );

    // Two-column layout for steps 3, 4, 6
    const showPreview = step === 3 || step === 4 || step === 6;
    const mainMaxWidth = showPreview ? 680 : 780;

    return (
        <div className="max-w-[1060px] mx-auto animate-[fadeIn_.3s_ease]" onKeyDown={handleKeyDown}>
            <h1 className="text-[20px] font-bold m-0 mb-1">Create New LP</h1>
            <p className="text-[hsl(var(--muted-foreground))] text-xs mb-5">Build a PPC-optimized loan landing page</p>

            <Card className="px-4 py-3.5 mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                    <b>Step {step}/6</b>
                    <span className="text-[hsl(var(--muted-foreground))]">{steps[step - 1]}</span>
                </div>
                <div className="h-1 bg-[hsl(var(--border))] rounded-sm">
                    <div className="h-full bg-[hsl(var(--primary))] rounded-sm transition-[width_.3s]" style={{ width: `${step / 6 * 100}%` }} />
                </div>
            </Card>

            {validationErrors.length > 0 && (
                <div className="bg-[hsl(var(--destructive))/8] border border-[hsl(var(--destructive))/33] rounded-lg px-4 py-3 mb-4">
                    <div className="text-xs font-semibold text-[hsl(var(--destructive))] mb-1.5">⚠️ Please fix before continuing:</div>
                    {validationErrors.map((err, i) => (
                        <div key={i} className="text-[11px] text-[hsl(var(--destructive))] ml-1">• {err}</div>
                    ))}
                </div>
            )}

            {showPreview ? (
                <div className="grid gap-6 items-start" style={{ gridTemplateColumns: "1fr 340px" }}>
                    <Card className="p-7 mb-4" ref={cardRef}>
                        {step === 1 && <StepBrand c={config} u={upd} />}
                        {step === 2 && <StepProduct c={config} u={upd} />}
                        {step === 3 && <StepDesign c={config} u={upd} notify={notify} />}
                        {step === 4 && <StepCopy c={config} u={upd} onAiGenerate={handleAiGenerate} aiLoading={aiLoading} />}
                        {step === 5 && <StepTracking c={config} u={upd} />}
                        {step === 6 && <StepReview c={config} building={building} />}
                    </Card>
                    <div className="sticky top-6">
                        <MockPhone>
                            <iframe title="mobile-preview" className="w-full h-full border-none" srcDoc={previewHtml} />
                        </MockPhone>
                    </div>
                </div>
            ) : (
                <Card className="p-7 mb-4 max-w-[780px] mx-auto" ref={cardRef}>
                    {step === 1 && <StepBrand c={config} u={upd} />}
                    {step === 2 && <StepProduct c={config} u={upd} />}
                    {step === 3 && <StepDesign c={config} u={upd} notify={notify} />}
                    {step === 4 && <StepCopy c={config} u={upd} onAiGenerate={handleAiGenerate} aiLoading={aiLoading} />}
                    {step === 5 && <StepTracking c={config} u={upd} />}
                    {step === 6 && <StepReview c={config} building={building} />}
                </Card>
            )}

            <div className="flex justify-between max-w-[780px]">
                <Button variant="ghost" onClick={handleBackOrCancel}>
                    ← {step === 1 ? "Cancel" : "Back"}
                </Button>
                {step < 6 ? (
                    <Button onClick={handleNext}>Next →</Button>
                ) : (
                    <Button onClick={handleBuild} disabled={building} className="px-6 py-2.5">
                        {building ? "⏳ Saving..." : config._editMode ? "✅ Update & Save" : "🚀 Build & Save"}
                    </Button>
                )}
            </div>
        </div>
    );
}
