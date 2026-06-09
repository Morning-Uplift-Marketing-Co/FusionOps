import React, { useState, useMemo, useEffect, useRef } from "react";
import { THEME as T } from "../constants";
import { uid, now } from "../utils";
import { generateHtmlByTemplate, generateApplyPageByTemplate, generateDeployAssetsByTemplate } from "../utils/template-router";
import { fetchCustomTemplates, getCustomTemplatesCache } from "../utils/template-registry";
import { resolveWizardTemplateCapabilities } from "../utils/wizard-template-capabilities.js";
import { api } from "../services/api";
import { getIbsApiBase } from "../utils/api-proxy";
import { getOrCreateZone, upsertDnsRecord, ensurePixelSubdomain } from "../services/cloudflare-dns";
import { deployTo, getAvailableTargets } from "../utils/deployers";
import { resolveDeployTargetForSite } from "../utils/deployers/deploy-target-guard.js";
import { MockPhone } from "./ui/mock-phone";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { StepBrand, StepProduct, StepTemplateDesign, StepCopy, StepTracking, StepReview } from "./Wizard/index.js";

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
function validateStep(stepNum, config, wizardCaps = null) {
    const errors = [];

    if (stepNum === 1) {
        if (!config.brand?.trim()) errors.push("Brand Name is required");
        if (!config.domain?.trim()) errors.push("Domain is required");
        // Validate domain format
        if (config.domain?.trim() && !DOMAIN_REGEX.test(config.domain.trim())) {
            errors.push("Invalid domain format (e.g., example.com)");
        }
        // Require CF profile if profiles exist (passed via config._cfProfilesExist)
        if (config._cfProfilesExist && !config.cfProfileId) {
            errors.push("Cloudflare Profile is required for DNS & deploy");
        }
        // Domain provider + account are optional — user may register domains externally
    }

    if (stepNum === 2) {
        if (!config.loanType) errors.push("Loan Type is required");
    }

    if (stepNum === 3) {
        if (!config.templateId) errors.push("Template is required");
        const themeOn = wizardCaps?.supportsWizardTheme !== false;
        if (themeOn && !config.colorId) errors.push("Color Scheme is required");
    }

    if (stepNum === 5) {
        const gtagId = config.gtagId || config.conversionId || "";
        if (!gtagId.trim()) {
            errors.push("Google Ads Conversion ID is required");
        }
        if (!config.aid?.toString().trim()) {
            errors.push("LeadsGate AID is required");
        }
        if ((config.trackingMode || "minimal") === "voluum") {
            if (!config.voluumCampaignId) errors.push("Voluum campaign must be selected");
            if (!config.voluumTrackingDomain && !config.domain) errors.push("Voluum tracking domain is required (set domain in Brand step)");
            if (!config.voluumClickUrl?.trim()) errors.push("Voluum Click URL is required");
        }
    }

    return { valid: errors.length === 0, errors };
}

const steps = ["Brand", "Product", "Template & Design", "Copy", "Tracking", "Review"];

export function Wizard({ config, setConfig, addSite, addDeploy, setPage, settings, notify, cfAccounts = [], registrarAccounts = [] }) {
    const asArray = (v) => Array.isArray(v) ? v : [];
    const [step, setStep] = useState(1);
    const [building, setBuilding] = useState(false);
    const [validationErrors, setValidationErrors] = useState([]);
    const [trackingWarnings, setTrackingWarnings] = useState([]);
    const [trackingGateOpen, setTrackingGateOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiMetaLoading, setAiMetaLoading] = useState(false);
    const [aiReviewsLoading, setAiReviewsLoading] = useState(false);
    const [nextLoading, setNextLoading] = useState(false);
    const [initialConfig, setInitialConfig] = useState(null);
    const [demoMode, setDemoMode] = useState(false);
    const [hoverTemplateId, setHoverTemplateId] = useState(null);
    const cardRef = useRef(null);
    const deployTargets = useMemo(() => getAvailableTargets(settings), [settings]);

    const wizardCaps = useMemo(
        () => resolveWizardTemplateCapabilities(config.templateId),
        [config.templateId]
    );
    const supportsCalculator = wizardCaps.supportsCalculator;
    const supportsSectionReorder = wizardCaps.supportsSectionReorder;
    // Adapter-shaped object for steps that still receive `capabilities={capabilities}`
    const capabilities = useMemo(
        () => ({
            supportsCalculator: wizardCaps.supportsCalculator,
            supportsSectionReorder: wizardCaps.supportsSectionReorder,
            supportsWizardTheme: wizardCaps.supportsWizardTheme,
        }),
        [wizardCaps]
    );

    const isUnsupportedCapabilityChange = (k, v) => {
        const calculatorUnsupported =
            supportsCalculator === false &&
            (
                (k === "features.calculator" && v === true) ||
                (k === "features" && v && typeof v === "object" && v.calculator === true)
            );

        const sectionReorderUnsupported =
            supportsSectionReorder === false &&
            (
                k === "layout.sectionOrder" ||
                (k === "layout" && v && typeof v === "object" && Array.isArray(v.sectionOrder))
            );

        return calculatorUnsupported || sectionReorderUnsupported;
    };

    const upd = (k, v) => {
        if (isUnsupportedCapabilityChange(k, v)) return;
        setConfig(p => ({ ...p, [k]: v }));
    };

    // Set helper flag for validation
    useEffect(() => {
        const hasProfiles = asArray(settings?.cfProfiles).length > 0;
        if (hasProfiles !== config._cfProfilesExist) {
            setConfig(p => ({ ...p, _cfProfilesExist: hasProfiles }));
        }
    }, [settings?.cfProfiles]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const resolveCfCredentials = (selectedCfAccountId, selectedCfProfileId) => {
        const cfAccountEntry = asArray(cfAccounts).find(a => (a.id || a.accountId || a.account_id) === selectedCfAccountId);
        const cfProfile = asArray(settings?.cfProfiles).find(p => p.id === selectedCfProfileId);
        return {
            cfAccountId: cfAccountEntry?.accountId || cfAccountEntry?.account_id || cfProfile?.accountId || settings?.cfAccountId,
            cfApiToken: cfAccountEntry?.apiToken || cfAccountEntry?.api_key || cfAccountEntry?.apiKey || cfProfile?.apiToken || settings?.cfApiToken,
        };
    };

    const handleNext = async () => {
        const { valid, errors } = validateStep(step, config, wizardCaps);
        if (!valid) {
            setValidationErrors(errors);
            cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }

        if (step === 1 && config.domainProvider) {
            const provider = String(config.domainProvider || "").toLowerCase();
            const domain = String(config.domain || "").trim().toLowerCase();
            const providerAccountId = String(config.domainProviderAccountId || config.internetbsAccountId || "").trim();
            const { cfAccountId, cfApiToken } = resolveCfCredentials(config.cfAccountId, config.cfProfileId);
            const syncKey = `${domain}|${provider}|${providerAccountId}|${String(config.cfAccountId || "")}`;

            if (!domain || !providerAccountId || !cfAccountId || !cfApiToken) {
                setValidationErrors(["Domain / Provider account / Cloudflare account is incomplete"]);
                cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
            }

            if (config._step1DnsSyncKey !== syncKey) {
                setNextLoading(true);
                try {
                    const zone = await getOrCreateZone(domain, cfAccountId, cfApiToken);
                    if (!zone?.success || !Array.isArray(zone.nameservers) || zone.nameservers.length < 2) {
                        const zErr = zone?.error || "Cloudflare nameservers not ready yet";
                        if (zErr === "NETWORK_ERROR" || String(zErr).includes("NETWORK_ERROR")) {
                            throw new Error(
                                `Cannot reach LP API${zone?.detail ? `: ${zone.detail}` : ""}. Check internet/VPN/firewall, Settings → API base URL, and that the Worker keeps workers.dev enabled (workers_dev = true on lp-factory-api).`
                            );
                        }
                        throw new Error(zone?.detail ? `${zErr} (${zone.detail})` : zErr);
                    }

                    const res = await api.put("/automation/registrar/nameservers", {
                        domain,
                        nameservers: zone.nameservers,
                        provider,
                        accountId: providerAccountId,
                    });

                    if (!res?.success) {
                        const err = res?.error || res?.message || "Failed to sync nameservers";
                        if (err === "NETWORK_ERROR" || String(err).includes("NETWORK_ERROR")) {
                            throw new Error(
                                `Cannot reach LP API${res?.detail ? `: ${res.detail}` : ""}. Check network and Settings → API base URL.`
                            );
                        }
                        throw new Error(res?.message || err);
                    }

                    setConfig((p) => ({
                        ...p,
                        _step1DnsSyncKey: syncKey,
                        _step1DnsSyncedAt: new Date().toLocaleString(),
                        _step1DnsNameservers: zone.nameservers,
                    }));
                    if (res?.alreadySynced) {
                        notify(`✅ DNS already matched: ${zone.nameservers.join(", ")}`);
                    } else if (res?.verified) {
                        notify(`✅ DNS synced & verified: ${zone.nameservers.join(", ")}`);
                    } else {
                        notify(`✅ DNS sync sent: ${zone.nameservers.join(", ")}`);
                    }
                } catch (e) {
                    const msg = e?.message || "DNS sync failed";
                    setValidationErrors([`DNS sync failed: ${msg}`]);
                    notify(`⚠️ ${msg}`, "warning");
                    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setNextLoading(false);
                    return;
                }
                setNextLoading(false);
            }
        }

        setValidationErrors([]);
        if (step < 6) setStep(s => s + 1);
    };

    const handleDemoJump = () => {
        setDemoMode(true);
        setValidationErrors([]);
        setStep(3);
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
                lang: config.lang || "English",
                geminiKey: settings?.geminiKey || "",
                anthropicKey: settings?.anthropicKey || "",
            });

            if (p && !p.error) {
                if (p.h1) upd("h1", p.h1);
                if (p.title2 || p.badge) upd("title2", p.title2 || p.badge);
                if (p.cta) upd("cta", p.cta);
                if (p.sub) upd("sub", p.sub);
                if (p.tagline) upd("tagline", p.tagline);
                if (p.metaTitle) upd("metaTitle", p.metaTitle);
                if (p.metaDesc) upd("metaDesc", p.metaDesc);
                notify("AI copy generated! (Halbert × Schwartz)");
            } else {
                notify(p?.error || "AI generation failed. Check your API key.", "warning");
            }
        } catch (e) {
            notify(e?.message || "AI generation failed. Check your Gemini API Key in Settings.", "warning");
        } finally {
            setAiLoading(false);
        }
    };

    const handleAiMeta = async () => {
        setAiMetaLoading(true);
        try {
            const p = await api.post("/ai/generate-meta", {
                brand: config.brand,
                domain: config.domain,
                loanType: config.loanType,
                amountMin: config.amountMin,
                amountMax: config.amountMax,
                h1: config.h1,
                cta: config.cta,
                sub: config.sub,
                lang: config.lang || "English",
                geminiKey: settings?.geminiKey || "",
                anthropicKey: settings?.anthropicKey || "",
            });
            if (p && !p.error) {
                if (p.metaTitle) upd("metaTitle", p.metaTitle);
                if (p.metaDesc) upd("metaDesc", p.metaDesc);
                notify("Meta tags generated!");
            } else {
                notify(p?.error || "Meta generation failed.", "warning");
            }
        } catch (e) {
            notify(e?.message || "Meta generation failed. Check your Gemini API Key in Settings.", "warning");
        } finally {
            setAiMetaLoading(false);
        }
    };

    const [aiTitle2Loading, setAiTitle2Loading] = useState(false);
    const handleAiTitle2 = async () => {
        setAiTitle2Loading(true);
        try {
            const p = await api.post("/ai/generate-copy", {
                brand: config.brand,
                loanType: config.loanType,
                amountMin: config.amountMin,
                amountMax: config.amountMax,
                lang: config.lang || "English",
                field: "title2",
                constraint: "max 40 characters, 3-6 words, concise supporting subheadline, no trailing period",
                geminiKey: settings?.geminiKey || "",
                anthropicKey: settings?.anthropicKey || "",
            });
            if (p && !p.error) {
                let v = (p.title2 || p.badge || p.text || "").trim();
                // Strip wrapping quotes and trailing punctuation, enforce 40-char cap
                v = v.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").replace(/[.!]+$/, "").trim();
                if (v.length > 40) v = v.slice(0, 40).replace(/\s+\S*$/, "").trim() || v.slice(0, 40);
                if (v) {
                    upd("title2", v);
                    notify("Title 2 generated!");
                } else {
                    notify("AI returned empty Title 2. Try again.", "warning");
                }
            } else {
                notify(p?.error || "Title 2 generation failed.", "warning");
            }
        } catch (e) {
            notify(e?.message || "Title 2 generation failed. Check your Gemini API Key in Settings.", "warning");
        } finally {
            setAiTitle2Loading(false);
        }
    };

    const handleAiReviews = async () => {
        setAiReviewsLoading(true);
        try {
            const p = await api.post("/ai/generate-reviews", {
                brand: config.brand,
                loanType: config.loanType,
                amountMax: config.amountMax,
                geminiKey: settings?.geminiKey || "",
                anthropicKey: settings?.anthropicKey || "",
            });
            if (Array.isArray(p) && p.length > 0) {
                upd("reviews", p);
                notify("Reviews generated!");
            } else {
                notify(p?.error || "Reviews generation failed.", "warning");
            }
        } catch (e) {
            notify(e?.message || "Reviews generation failed.", "warning");
        } finally {
            setAiReviewsLoading(false);
        }
    };

    const checkTrackingCompleteness = (cfg) => {
        const warnings = [];
        const gtagId = cfg.gtagId || cfg.conversionId || "";
        if (!gtagId.trim()) warnings.push("❌ Google Ads Conversion ID missing — gtag.js will not fire");
        if (!cfg.aid?.toString().trim()) warnings.push("❌ LeadsGate AID missing — form callbacks won't track");
        if ((cfg.trackingMode || "minimal") === "voluum") {
            if (!cfg.voluumClickUrl?.trim()) warnings.push("❌ Voluum Click URL missing — CTA will not track");
            if (!cfg.voluumTrackingDomain?.trim() && !cfg.domain?.trim()) warnings.push("❌ Voluum tracking domain missing");
        }
        if (!cfg.formStartLabel?.trim()) warnings.push("⚠️ form_start label missing — micro-conversion won't fire");
        if (!cfg.formSubmitLabel?.trim()) warnings.push("⚠️ form_submit label missing — conversion won't be reported");
        return warnings;
    };

    const handleBuild = async () => {
        // Tracking gate — warn before building if critical tracking is missing
        if (!trackingGateOpen) {
            const warnings = checkTrackingCompleteness(config);
            if (warnings.length > 0) {
                setTrackingWarnings(warnings);
                setTrackingGateOpen(true);
                return; // pause — user must confirm
            }
        }
        setTrackingGateOpen(false);
        setBuilding(true);
        let finalConfig = { ...config };
        // Backward compatibility: older saved sites used `badge` for this copy slot.
        if (!finalConfig.title2 && finalConfig.badge) finalConfig.title2 = finalConfig.badge;
        console.log("[Wizard] handleBuild - finalConfig.templateId:", finalConfig.templateId);
        console.log("[Wizard] handleBuild - finalConfig keys:", Object.keys(finalConfig));

        // Only generate AI copy if fields are empty
        const needsAiCopy = !finalConfig.h1 || !finalConfig.title2 || !finalConfig.cta || !finalConfig.sub;
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
                    if (!finalConfig.title2 && (p.title2 || p.badge)) finalConfig.title2 = p.title2 || p.badge;
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

        const siteId = finalConfig._editMode ? finalConfig.id : uid();
        const sitePayload = finalConfig._editMode
            ? { ...finalConfig, id: siteId, status: "completed", updatedAt: now() }
            : { ...finalConfig, id: siteId, status: "completed", createdAt: now(), cost: 0.001 };

        // One-flow mode: save + deploy + DNS in one click
        if (finalConfig.deployOnBuild) {
            try {
                const requested = finalConfig.deployTarget || "github-actions";
                const resolved = resolveDeployTargetForSite(sitePayload, requested);
                const target = resolved.target;
                if (resolved.redirected) {
                    notify(resolved.reason, "warning");
                }
                const targetConfig = deployTargets.find(t => t.id === target);
                if (!targetConfig?.configured) {
                    notify(`Deploy target "${target}" is not configured in Settings`, "warning");
                } else {
                    const assets = generateDeployAssetsByTemplate(sitePayload);
                    const applyHtml = generateApplyPageByTemplate(sitePayload);
                    const deployContent = typeof assets === "string"
                        ? { "index.html": assets, "apply.html": applyHtml }
                        : { ...assets, "apply.html": applyHtml };

                    const deployResult = await deployTo(target, deployContent, sitePayload, settings);
                    if (deployResult.success) {
                        addDeploy?.({
                            id: uid(),
                            siteId: sitePayload.id,
                            brand: sitePayload.brand,
                            url: deployResult.url,
                            ts: now(),
                            type: "deploy",
                            target,
                        });
                        if (deployResult.queued && deployResult.pixelHealthOk) {
                            notify(`✅ Queued GitHub Actions — Pixel t.${sitePayload.domain}/e ✓`);
                        } else if (deployResult.pixelHealthOk) {
                            notify(`✅ Save + Deploy complete (${target}) — Pixel t.${sitePayload.domain}/e ✓`);
                        } else if (deployResult.pixelHealthError) {
                            notify(`✅ Deploy done, but pixel not ready: ${deployResult.pixelHealthError}`, "warning");
                        } else if (deployResult.queued) {
                            notify(`✅ Queued ${target} — CI building. Track: ${deployResult.url}`);
                        } else {
                            notify(`✅ Save + Deploy complete (${target})`);
                        }
                    } else {
                        notify(`Saved, but deploy failed: ${deployResult.error}`, "warning");
                    }
                }
            } catch (e) {
                notify(`Saved, but deploy error: ${e.message}`, "warning");
            }
        }

        await addSite(sitePayload);

        // ── Auto-provision DNS subdomains (t. + trk.) ──
        const domain = finalConfig.domain?.trim();
        // Resolve CF credentials from selected account/profile, fallback to legacy settings
        const cfAccountEntry = asArray(cfAccounts).find(a => (a.id || a.accountId || a.account_id) === finalConfig.cfAccountId);
        const cfProfile = asArray(settings?.cfProfiles).find(p => p.id === finalConfig.cfProfileId);
        const cfAccountId = cfAccountEntry?.accountId || cfAccountEntry?.account_id || cfProfile?.accountId || settings?.cfAccountId;
        const cfApiToken = cfAccountEntry?.apiToken || cfAccountEntry?.apiKey || cfAccountEntry?.api_key || cfProfile?.apiToken || settings?.cfApiToken;
        if (domain && cfAccountId && cfApiToken) {
            try {
                // 1. Ensure t.{domain} pixel subdomain
                ensurePixelSubdomain({ domain, cfAccountId, cfApiToken }).then(r => {
                    if (r.success) notify?.(`✅ t.${domain} DNS provisioned`);
                    else console.warn("[DNS] pixel subdomain:", r.error);
                });

                // 2. Ensure trk.{domain} for Voluum (only if Voluum mode)
                // Never fallback to legacy track.voluum.com to avoid repeatedly overwriting DNS.
                if (finalConfig.trackingMode === "voluum" && finalConfig.voluumTrackingDomain) {
                    const trkHost = finalConfig.voluumTrackingDomain; // e.g. trk.domain.com
                    const trkSub = trkHost.split(".")[0]; // "trk"
                    const trkTarget = String(finalConfig.voluumCfCname || "").trim();
                    if (!trkTarget) {
                        notify?.("⚠️ Voluum DNS skipped: missing CloudFront CNAME target", "warning");
                        console.warn("[DNS] trk CNAME skipped: missing voluumCfCname");
                    }
                    // Skip if DNS already provisioned via StepTracking button
                    if (trkTarget && !finalConfig._trkDnsProvisioned) {
                        getOrCreateZone(domain, cfAccountId, cfApiToken).then(zone => {
                            if (!zone.success || !zone.zoneId) return;
                            upsertDnsRecord({
                                zoneId: zone.zoneId,
                                cfAccountId,
                                cfApiToken,
                                domain,
                                type: "CNAME",
                                name: `${trkSub}.${domain}`,
                                content: trkTarget,
                                proxied: false,
                            }).then(r => {
                                if (r.success) notify?.(`✅ ${trkHost} DNS → ${trkTarget.slice(0, 30)}...`);
                                else console.warn("[DNS] trk CNAME:", r.error);
                            });

                            // Also create ACM cert CNAME if provided
                            if (finalConfig.voluumAcmName && finalConfig.voluumAcmValue) {
                                upsertDnsRecord({
                                    zoneId: zone.zoneId,
                                    cfAccountId,
                                    cfApiToken,
                                    domain,
                                    type: "CNAME",
                                    name: finalConfig.voluumAcmName,
                                    content: finalConfig.voluumAcmValue,
                                    proxied: false,
                                }).then(r => {
                                    if (r.success) notify?.(`✅ ACM cert CNAME created`);
                                    else console.warn("[DNS] ACM CNAME:", r.error);
                                });
                            }
                        });
                    } else {
                        console.log("[DNS] trk DNS already provisioned via StepTracking, skipping");
                    }
                }

                // 3. Sync provider nameservers to Cloudflare zone NS (optional, best-effort).
                // Skip if already synced in Step 1.
                const provider = String(finalConfig.domainProvider || "internetbs").toLowerCase();
                const providerAccountId = String(finalConfig.domainProviderAccountId || finalConfig.internetbsAccountId || "");
                const step1SyncKey = `${String(domain || "").toLowerCase()}|${provider}|${providerAccountId}|${String(finalConfig.cfAccountId || "")}`;
                if (providerAccountId && finalConfig._step1DnsSyncKey !== step1SyncKey) {
                    getOrCreateZone(domain, cfAccountId, cfApiToken).then(async zone => {
                        if (!zone.success || !Array.isArray(zone.nameservers) || zone.nameservers.length < 2) {
                            notify?.("⚠️ Provider sync skipped: Cloudflare nameservers not ready yet", "warning");
                            return;
                        }

                        const res = await api.put("/automation/registrar/nameservers", {
                            domain,
                            nameservers: zone.nameservers,
                            provider,
                            accountId: providerAccountId,
                        });

                        if (res?.success) {
                            notify?.(`✅ Provider NS sync sent`);
                        } else {
                            notify?.(`⚠️ Provider NS sync failed: ${res?.message || res?.error || "unknown error"}`, "warning");
                        }
                    }).catch((e) => {
                        notify?.(`⚠️ Provider NS sync error: ${e?.message || e}`, "warning");
                    });
                }
            } catch (e) {
                console.warn("[DNS] auto-provision failed:", e.message);
            }
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

    // Live preview HTML for steps 3(Template+Design), 4(Copy), 6(Review)
    const [previewHtml, setPreviewHtml] = useState(() => generateHtmlByTemplate(config));
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!getCustomTemplatesCache()) await fetchCustomTemplates();
            const previewConfig = hoverTemplateId ? { ...config, templateId: hoverTemplateId } : config;
            if (!cancelled) setPreviewHtml(generateHtmlByTemplate(previewConfig));
        };
        run();
        return () => { cancelled = true; };
    }, [config.templateId, config.brand, config.domain, config.loanType, config.colorId, config.fontId, config.layout, config.radius, config.h1, config.title2, config.cta, config.sub, config.amountMin, config.amountMax, config.redirectUrl, config.conversionId, hoverTemplateId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Two-column layout for steps 3(Template+Design), 4(Copy), 6(Review)
    const showPreview = step === 3 || step === 4 || step === 6;
    const mainMaxWidth = showPreview ? 680 : 780;

    return (
        <div className="max-w-[1060px] mx-auto animate-[fadeIn_.3s_ease]" onKeyDown={handleKeyDown}>
            <div className="flex items-center justify-between mb-1">
                <h1 className="text-[20px] font-bold m-0">Create New LP</h1>
                {step <= 2 && (
                    <button
                        onClick={handleDemoJump}
                        title="Skip to Step 4 Design preview without domain validation"
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: demoMode ? '#f59e0b20' : '#6366f120', border: `1px solid ${demoMode ? '#f59e0b' : '#6366f1'}`, color: demoMode ? '#f59e0b' : '#6366f1', cursor: 'pointer', fontWeight: 600 }}
                    >
                        {demoMode ? '🎭 Demo Mode ON' : '🎭 Demo Preview'}
                    </button>
                )}
            </div>
            <p className="text-[hsl(var(--muted-foreground))] text-xs mb-5">Build a PPC-optimized loan landing page</p>

            <Card className="px-4 py-3.5 mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                    <b>Step {step}/6</b>
                    <span className="text-[hsl(var(--muted-foreground))]">{steps[step - 1]}</span>
                </div>
                {(!supportsCalculator || !supportsSectionReorder) && (
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-1.5" title="Not supported by selected template">
                        Not supported by selected template
                    </div>
                )}
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
                <div className="grid gap-6 items-start" style={{ gridTemplateColumns: "1fr 460px" }}>
                    <Card className="p-7 mb-4" ref={cardRef}>
                        <div style={{ zoom: '115%' }}>
                        {step === 1 && <StepBrand c={config} u={upd} settings={settings} cfAccounts={cfAccounts} registrarAccounts={registrarAccounts} capabilities={capabilities} />}
                        {step === 2 && <StepProduct c={config} u={upd} capabilities={capabilities} />}
                        {step === 3 && <StepTemplateDesign c={config} u={upd} notify={notify} onHoverTemplate={setHoverTemplateId} designCapabilities={wizardCaps} />}
                        {step === 4 && <StepCopy c={config} u={upd} onAiGenerate={handleAiGenerate} aiLoading={aiLoading} onAiMeta={handleAiMeta} aiMetaLoading={aiMetaLoading} onAiReviews={handleAiReviews} aiReviewsLoading={aiReviewsLoading} onAiTitle2={handleAiTitle2} aiTitle2Loading={aiTitle2Loading} capabilities={capabilities} />}
                        {step === 5 && <StepTracking c={config} u={upd} capabilities={capabilities} />}
                        {step === 6 && <StepReview c={config} building={building} capabilities={capabilities} />}
                        </div>
                        {step === 6 && trackingGateOpen && (
                            <div className="mt-4 p-4 rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.06)]">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-bold text-[hsl(0,84%,60%)]">⚠️ Tracking Incomplete</span>
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">— LP will build but tracking won't work</span>
                                </div>
                                <ul className="flex flex-col gap-1 mb-3">
                                    {trackingWarnings.map((w, i) => (
                                        <li key={i} className="text-xs text-[hsl(var(--muted-foreground))]">{w}</li>
                                    ))}
                                </ul>
                                <div className="flex gap-2">
                                    <Button onClick={() => { setStep(5); setTrackingGateOpen(false); }} className="h-7 px-3 text-xs" variant="outline">← Fix Tracking</Button>
                                    <Button onClick={handleBuild} className="h-7 px-3 text-xs bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.4)] text-[hsl(0,84%,60%)] hover:bg-[rgba(239,68,68,0.25)]">Build Anyway</Button>
                                </div>
                            </div>
                        )}
                        {step === 6 && (
                            <div className="mt-4 p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))/30]">
                                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                                    <input
                                        type="checkbox"
                                        checked={!!config.deployOnBuild}
                                        onChange={(e) => upd("deployOnBuild", e.target.checked)}
                                    />
                                    Save + Deploy + DNS in one flow
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">Deploy target:</span>
                                    <select
                                        className="text-xs bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded px-2 py-1"
                                        value={config.deployTarget || "github-actions"}
                                        onChange={(e) => upd("deployTarget", e.target.value)}
                                        disabled={!config.deployOnBuild}
                                    >
                                        {deployTargets.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.label}{t.configured ? "" : " (not configured)"}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </Card>
                    <div className="sticky top-6">
                        <MockPhone>
                            <iframe title="mobile-preview" className="w-full h-full border-none" srcDoc={previewHtml} />
                        </MockPhone>
                    </div>
                </div>
            ) : (
                <Card className="p-7 mb-4 max-w-[780px] mx-auto" ref={cardRef}>
                    <div style={{ zoom: '115%' }}>
                    {step === 1 && <StepBrand c={config} u={upd} settings={settings} cfAccounts={cfAccounts} registrarAccounts={registrarAccounts} capabilities={capabilities} />}
                    {step === 2 && <StepProduct c={config} u={upd} capabilities={capabilities} />}
                    {step === 5 && <StepTracking c={config} u={upd} capabilities={capabilities} />}
                    </div>
                </Card>
            )}

            <div className="flex justify-between max-w-[780px]">
                <Button variant="ghost" onClick={handleBackOrCancel}>
                    ← {step === 1 ? "Cancel" : "Back"}
                </Button>
                {step < 6 ? (
                    <Button onClick={handleNext} disabled={nextLoading}>
                        {nextLoading ? "⏳ Syncing DNS..." : "Next →"}
                    </Button>
                ) : (
                    <Button onClick={handleBuild} disabled={building} className="px-6 py-2.5">
                        {building ? "⏳ Saving..." : config._editMode ? "✅ Update & Save" : "🚀 Build & Save"}
                    </Button>
                )}
            </div>
        </div>
    );
}
