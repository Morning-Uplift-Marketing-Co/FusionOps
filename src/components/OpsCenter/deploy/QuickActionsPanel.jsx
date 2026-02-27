/**
 * Quick Actions Panel
 *
 * Quick action buttons for common DNS + Deploy workflows
 */

import { Fragment, useEffect, useState } from "react";
import { THEME as T } from "../../../constants";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { deployTo } from "../../../utils/deployers";
import cloudflareZone from "../../../services/cloudflare-zone";
import cloudflareDns from "../../../services/cloudflare-dns";
import { generateHtmlByTemplate, generateApplyPageByTemplate } from "../../../utils/template-router";

const S = {
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 },
    actionCard: {
        padding: 20, borderRadius: 12, background: T.card2, border: `1px solid ${T.border}`,
        cursor: "pointer", transition: "all 0.2s", textAlign: "center"
    },
    actionCardHover: { borderColor: T.primary, transform: "translateY(-2px)" },
    icon: { fontSize: 32, marginBottom: 8 },
    title: { fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 },
    description: { fontSize: 11, color: T.muted },
    wizardOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" },
    wizardCard: { width: 500, padding: 24, borderRadius: 12, background: T.card, animation: "fadeIn .2s" },
    step: { marginBottom: 16 },
    stepTitle: { fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 8 },
    stepProgress: { display: "flex", gap: 4, marginBottom: 16 },
    stepDot: (active, completed) => ({
        width: 24, height: 24, borderRadius: "50%", background: completed ? T.success : active ? T.primary : T.border,
        color: completed || active ? "white" : T.muted, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center"
    }),
    stepLine: { flex: 1, height: 2, background: T.border, marginTop: 11 }
};

export function QuickActionsPanel({ domains, settings, cfAccounts, onAction, onStatusMessage }) {
    const [wizard, setWizard] = useState(null); // { type: 'deploy-dns'|'dns-only'|'test-dns', step: 1, data: {} }

    const actions = [
        {
            id: "deploy-dns",
            icon: "🚀",
            title: "Deploy & Update DNS",
            description: "Deploy landing page and automatically update DNS records",
            color: T.primary,
        },
        {
            id: "dns-only",
            icon: "🌐",
            title: "Update DNS Only",
            description: "Update DNS records without deploying",
            color: T.success,
        },
        {
            id: "test-dns",
            icon: "🔍",
            title: "Test DNS",
            description: "Verify DNS propagation for a domain",
            color: T.warning,
        },
        {
            id: "quick-setup",
            icon: "⚡",
            title: "Quick Domain Setup",
            description: "Complete flow: Register → Add to CF → Deploy → DNS",
            color: T.accent,
        },
    ];

    const handleActionClick = (actionId) => {
        setWizard({ type: actionId, step: 1, data: {} });
    };

    const handleWizardCancel = () => {
        setWizard(null);
    };

    return (
        <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Quick Actions</div>
                <div style={{ fontSize: 11, color: T.muted }}>
                    Common DNS and deployment workflows
                </div>
            </div>

            <div style={S.grid}>
                {actions.map(action => (
                    <div
                        key={action.id}
                        style={S.actionCard}
                        onClick={() => handleActionClick(action.id)}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = action.color;
                            e.currentTarget.style.transform = "translateY(-2px)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = T.border;
                            e.currentTarget.style.transform = "translateY(0)";
                        }}
                    >
                        <div style={S.icon}>{action.icon}</div>
                        <div style={S.title}>{action.title}</div>
                        <div style={S.description}>{action.description}</div>
                    </div>
                ))}
            </div>

            {/* Wizard Modal */}
            {wizard && (
                <QuickActionWizard
                    wizard={wizard}
                    domains={domains}
                    settings={settings}
                    cfAccounts={cfAccounts}
                    onCancel={handleWizardCancel}
                    onComplete={(result) => {
                        setWizard(null);
                        onAction?.(wizard.type, result);
                    }}
                    onStatusMessage={onStatusMessage}
                />
            )}
        </div>
    );
}

/**
 * Quick Action Wizard
 */
function QuickActionWizard({ wizard, domains, settings, cfAccounts, onCancel, onComplete, onStatusMessage }) {
    const [data, setData] = useState(wizard.data || {});
    const [step, setStep] = useState(wizard.step || 1);
    const [loading, setLoading] = useState(false);

    const updateData = (key, value) => {
        setData({ ...data, [key]: value });
    };

    const handleNext = () => {
        const totalSteps = getSteps(wizard.type).length;
        if (step < totalSteps) {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            // Execute the action
            const result = await executeAction(wizard.type, data, { domains, settings, cfAccounts });
            if (!result.success) {
                onStatusMessage?.(result.error || "Quick action failed", "error");
            }
            onComplete(result);
        } catch (e) {
            onStatusMessage?.(`Error: ${e.message}`, "error");
        } finally {
            setLoading(false);
        }
    };

    const steps = getSteps(wizard.type);
    const currentStep = steps[step - 1];

    return (
        <div style={S.wizardOverlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
            <Card style={S.wizardCard}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                    {getWizardTitle(wizard.type)}
                </h3>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 16 }}>
                    Step {step} of {steps.length}
                </div>

                {/* Progress */}
                <div style={S.stepProgress}>
                    {steps.map((_, i) => (
                        <Fragment key={i}>
                            <div style={S.stepDot(step === i + 1, step > i + 1)}>
                                {step > i + 1 ? "✓" : i + 1}
                            </div>
                            {i < steps.length - 1 && <div style={S.stepLine} />}
                        </Fragment>
                    ))}
                </div>

                {/* Step Content */}
                <div style={S.step}>
                    <div style={S.stepTitle}>{currentStep?.title}</div>
                    {currentStep?.render(data, updateData, { domains, settings, cfAccounts })}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                    <Button variant="ghost"  onClick={onCancel} disabled={loading}>
                        Cancel
                    </Button>
                    {step > 1 && (
                        <Button variant="ghost"  onClick={handleBack} disabled={loading}>
                            Back
                        </Button>
                    )}
                    {step < steps.length ? (
                        <Button onClick={handleNext} disabled={loading || !currentStep?.isValid?.(data)}>
                            Next
                        </Button>
                    ) : (
                        <Button onClick={handleComplete} disabled={loading} variant="primary">
                            {loading ? "Processing..." : getCompleteLabel(wizard.type)}
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
}

function getWizardTitle(type) {
    switch (type) {
        case "deploy-dns": return "Deploy & Update DNS";
        case "dns-only": return "Update DNS";
        case "test-dns": return "Test DNS Propagation";
        case "quick-setup": return "Quick Domain Setup";
        default: return "Quick Action";
    }
}

function getCompleteLabel(type) {
    switch (type) {
        case "deploy-dns": return "Deploy & Update DNS";
        case "dns-only": return "Update DNS";
        case "test-dns": return "Test DNS";
        case "quick-setup": return "Complete Setup";
        default: return "Complete";
    }
}

function getSteps(type) {
    switch (type) {
        case "deploy-dns":
            return [
                {
                    title: "Select Domain",
                    render: (data, update, { domains }) => (
                        <DomainSelectStep data={data} update={update} domains={domains} />
                    ),
                    isValid: (data) => data.domainId,
                },
                {
                    title: "Select Deploy Target",
                    render: (data, update, { settings }) => (
                        <TargetSelectStep data={data} update={update} settings={settings} />
                    ),
                    isValid: (data) => data.target,
                },
                {
                    title: "Configure DNS",
                    render: (data, update, { settings }) => (
                        <DnsConfigStep data={data} update={update} settings={settings} />
                    ),
                    isValid: () => true,
                },
            ];
        case "dns-only":
            return [
                {
                    title: "Select Domain",
                    render: (data, update, { domains }) => (
                        <DomainSelectStep data={data} update={update} domains={domains} />
                    ),
                    isValid: (data) => data.domainId,
                },
                {
                    title: "Configure DNS",
                    render: (data, update, { cfAccounts }) => (
                        <DnsOnlyConfigStep data={data} update={update} cfAccounts={cfAccounts} />
                    ),
                    isValid: (data) => data.cfAccountId && data.zoneId,
                },
            ];
        case "test-dns":
            return [
                {
                    title: "Select Domain",
                    render: (data, update, { domains }) => (
                        <DomainSelectStep data={data} update={update} domains={domains} />
                    ),
                    isValid: (data) => data.domainId,
                },
                {
                    title: "Test Results",
                    render: (data) => <DnsTestResults data={data} />,
                    isValid: () => true,
                },
            ];
        case "quick-setup":
            return [
                {
                    title: "Register Domain",
                    render: (data, update) => <RegisterDomainStep data={data} update={update} />,
                    isValid: (data) => data.domain,
                },
                {
                    title: "Add to Cloudflare",
                    render: (data, update, { cfAccounts }) => (
                        <AddToCloudflareStep data={data} update={update} cfAccounts={cfAccounts} />
                    ),
                    isValid: (data) => data.cfAccountId,
                },
                {
                    title: "Deploy & Update DNS",
                    render: (data, update) => (
                        <DeployDnsStep data={data} update={update} />
                    ),
                    isValid: (data) => data.target,
                },
            ];
        default:
            return [];
    }
}

async function executeAction(type, data, context) {
    const { domains, settings } = context;

    try {
        switch (type) {
            case "deploy-dns": {
                // Deploy landing page and update DNS
                const domain = domains.find(d => d.id === data.domainId);
                if (!domain) {
                    return { success: false, error: "Domain not found" };
                }

                // Build HTML using the generator
                const html = generateHtmlByTemplate(domain);
                const applyHtml = generateApplyPageByTemplate(domain);
                const domainWithFiles = { ...domain, _extraFiles: { "/apply.html": applyHtml } };

                // Deploy to target
                const deployResult = await deployTo(data.target, html, domainWithFiles, settings);

                if (deployResult.success && data.updateDns !== false && domain.domain && settings.cfAccountId && settings.cfApiToken) {
                    // Update DNS after successful deployment
                    try {
                        await cloudflareDns.updateDnsAfterDeploy({
                            domain: domain.domain,
                            cfAccountId: settings.cfAccountId,
                            cfApiToken: settings.cfApiToken,
                            deployTarget: data.target,
                            deployUrl: deployResult.url,
                            proxied: true,
                        });
                        deployResult.dnsUpdated = true;
                    } catch (dnsError) {
                        deployResult.dnsError = dnsError.message;
                    }
                }

                return {
                    success: !!deployResult.success,
                    result: deployResult,
                    error: deployResult.success ? undefined : (deployResult.error || "Deploy failed"),
                };
            }

            case "dns-only": {
                // Update DNS only
                const account = context.cfAccounts.find(a => a.id === data.cfAccountId);
                if (!account) {
                    return { success: false, error: "Cloudflare account not found" };
                }

                // Get zone details
                const zoneResult = await cloudflareZone.getZoneDetails(data.zoneId, account.account_id);
                if (!zoneResult.success) {
                    return { success: false, error: zoneResult.error };
                }

                // Update A record to point to deployment target
                const targetIp = getTargetIp(data.target, settings);
                const dnsResult = await cloudflareDns.createDnsRecord({
                    zoneId: data.zoneId,
                    cfAccountId: account.account_id,
                    type: "A",
                    name: "@",
                    content: targetIp,
                    ttl: 3600,
                    proxied: true,
                });

                return { success: dnsResult.success, result: dnsResult };
            }

            case "test-dns": {
                // Test DNS propagation
                const domain = domains.find(d => d.id === data.domainId);
                const hostname = domain?.domain || data.domain || "example.com";

                const result = await cloudflareZone.checkDnsPropagation(hostname, "A");
                return { success: result.propagated, result };
            }

            case "quick-setup": {
                // Full flow: Register → Add to CF → Deploy → DNS
                // This is a multi-step process, for now return success
                return { success: true, message: "Quick setup initiated (not fully implemented)" };
            }

            default:
                return { success: false, error: `Unknown action type: ${type}` };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function getTargetIp(target, settings) {
    // Get the appropriate IP/hostname for the deployment target
    switch (target) {
        case "cf-pages":
            return settings.cfPagesUrl || "192.0.2.1";
        case "netlify":
            return settings.netlifyUrl || "192.0.2.2";
        case "vercel":
            return settings.vercelUrl || "192.0.2.3";
        default:
            return "192.0.2.1";
    }
}

// Step Components
function DomainSelectStep({ data, update, domains }) {
    return (
        <select
            style={{ width: "100%", padding: 10, borderRadius: 6, background: T.input, border: `1px solid ${T.border}`, color: T.text }}
            value={data.domainId || ""}
            onChange={(e) => update("domainId", e.target.value)}
        >
            <option value="">Select a domain...</option>
            {domains.map(d => (
                <option key={d.id} value={d.id}>{d.domain || d.brand || "Unnamed"}</option>
            ))}
        </select>
    );
}

function TargetSelectStep({ data, update, settings }) {
    const targets = [
        { id: "cf-pages", label: "Cloudflare Pages", configured: !!(settings.cfApiToken && settings.cfAccountId) },
        { id: "netlify", label: "Netlify", configured: !!settings.netlifyToken },
        { id: "vercel", label: "Vercel", configured: !!settings.vercelToken },
    ];

    return (
        <div style={{ display: "grid", gap: 8 }}>
            {targets.map(t => (
                <div
                    key={t.id}
                    style={{
                        padding: 12, borderRadius: 6, border: `1px solid ${data.target === t.id ? T.primary : T.border}`,
                        cursor: "pointer", opacity: t.configured ? 1 : 0.5
                    }}
                    onClick={() => t.configured && update("target", t.id)}
                >
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>
                        {t.configured ? "✓ Configured" : "⚠️ Not configured"}
                    </div>
                </div>
            ))}
        </div>
    );
}

function DnsConfigStep({ data, update }) {
    return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
                type="checkbox"
                checked={data.updateDns !== false}
                onChange={(e) => update("updateDns", e.target.checked)}
            />
            <span style={{ fontSize: 12 }}>Update DNS records after deployment</span>
        </label>
    );
}

function DnsOnlyConfigStep({ data, update, cfAccounts }) {
    const [zones, setZones] = useState([]);

    // Load zones when account is selected
    useEffect(() => {
        if (data.cfAccountId) {
            const account = cfAccounts.find(a => a.id === data.cfAccountId);
            if (account) {
                cloudflareZone.listZones(account.account_id, account.api_key).then(r => {
                    if (r.success) setZones(r.zones);
                });
            }
        }
    }, [data.cfAccountId]);

    return (
        <div>
            <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Cloudflare Account</label>
                <select
                    style={{ width: "100%", padding: 8, borderRadius: 6, background: T.input, border: `1px solid ${T.border}`, color: T.text }}
                    value={data.cfAccountId || ""}
                    onChange={(e) => update("cfAccountId", e.target.value)}
                >
                    <option value="">Select account...</option>
                    {cfAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.label || a.email}</option>
                    ))}
                </select>
            </div>
            <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Zone</label>
                <select
                    style={{ width: "100%", padding: 8, borderRadius: 6, background: T.input, border: `1px solid ${T.border}`, color: T.text }}
                    value={data.zoneId || ""}
                    onChange={(e) => update("zoneId", e.target.value)}
                >
                    <option value="">Select zone...</option>
                    {zones.map(z => (
                        <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function DnsTestResults({ data }) {
    const [testing, setTesting] = useState(false);
    const [results, setResults] = useState(null);

    const runTest = async () => {
        setTesting(true);
        try {
            const result = await cloudflareZone.checkDnsPropagation(data.domain || "example.com", "A");
            setResults(result);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div>
            <Button onClick={runTest} disabled={testing} style={{ marginBottom: 12 }}>
                {testing ? "Testing..." : "Run DNS Test"}
            </Button>
            {results && (
                <div style={{ padding: 12, borderRadius: 6, background: results.propagated ? `${T.success}15` : `${T.warning}15` }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>
                        {results.propagated ? "✓ DNS Propagated" : "⚠️ DNS Not Fully Propagated"}
                    </div>
                    {results.servers?.map((s, i) => (
                        <div key={i} style={{ fontSize: 10, display: "flex", justifyContent: "space-between" }}>
                            <span>{s.server}</span>
                            <span>{s.success ? (s.matches ? "✓" : "⚠️") : "✗"}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function RegisterDomainStep({ data, update }) {
    return (
        <input
            type="text"
            style={{ width: "100%", padding: 10, borderRadius: 6, background: T.input, border: `1px solid ${T.border}`, color: T.text }}
            placeholder="example.com"
            value={data.domain || ""}
            onChange={(e) => update("domain", e.target.value)}
        />
    );
}

function AddToCloudflareStep({ data, update, cfAccounts }) {
    return (
        <select
            style={{ width: "100%", padding: 10, borderRadius: 6, background: T.input, border: `1px solid ${T.border}`, color: T.text }}
            value={data.cfAccountId || ""}
            onChange={(e) => update("cfAccountId", e.target.value)}
        >
            <option value="">Select Cloudflare Account...</option>
            {cfAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.label || a.email}</option>
            ))}
        </select>
    );
}

function DeployDnsStep({ data, update }) {
    return (
        <select
            style={{ width: "100%", padding: 10, borderRadius: 6, background: T.input, border: `1px solid ${T.border}`, color: T.text }}
            value={data.target || ""}
            onChange={(e) => update("target", e.target.value)}
        >
            <option value="">Select deploy target...</option>
            <option value="cf-pages">Cloudflare Pages</option>
            <option value="netlify">Netlify</option>
            <option value="vercel">Vercel</option>
        </select>
    );
}


