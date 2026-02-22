/**
 * Deploy Section
 *
 * Deployment management section
 * - Select domain and deploy target
 * - Configure deployment settings
 * - Execute deployments
 * - View deployment results
 */

import { useState, useEffect } from "react";
import { THEME as T, DEPLOY_TARGETS, DEPLOY_ENVIRONMENTS } from "../../../constants";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { deployTo, getAvailableTargets, saveDeployConfig, getDeployConfig } from "../../../utils/deployers";
import cloudflareDns from "../../../services/cloudflare-dns";
import { generateHtmlByTemplate, generateApplyPageByTemplate } from "../../../utils/template-router";

const S = {
    section: { marginBottom: 24 },
    sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionTitle: { fontSize: 13, fontWeight: 700, color: T.text },
    row: { display: "flex", gap: 10 },
    select: { padding: 8, borderRadius: 6, background: T.input, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, minWidth: 150 },
    label: { fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 4, display: "block" },
    fieldWrap: { marginBottom: 12 },
    envTab: (active) => ({
        padding: "6px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer",
        background: active ? T.primary : "transparent", color: active ? "white" : T.muted,
        transition: "all 0.2s"
    }),
    targetCard: (configured) => ({
        padding: 12, borderRadius: 8, background: T.card2, border: `1px solid ${configured ? T.success : T.border}`,
        cursor: "pointer", transition: "all 0.2s", opacity: configured ? 1 : 0.6
    }),
    targetCardSelected: (selected) => ({
        borderColor: selected ? T.primary : T.border,
        background: selected ? `${T.primary}15` : T.card2
    }),
    progressContainer: { marginTop: 16, padding: 16, borderRadius: 8, background: T.card, border: `1px solid ${T.border}` },
    progressBar: { height: 4, borderRadius: 2, background: T.border, overflow: "hidden", marginBottom: 8 },
    progressFill: (pct) => ({ height: "100%", background: T.primary, width: `${pct}%`, transition: "width 0.3s" }),
    statusSuccess: { color: T.success },
    statusError: { color: T.danger },
    urlResult: { display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: 8, borderRadius: 6, background: `${T.success}10`, border: `1px solid ${T.success}30` }
};

export function DeploySection({ domains, settings, cfAccounts = [], onDeploy, onStatusMessage }) {
    const [selectedDomainId, setSelectedDomainId] = useState("");
    const [selectedTarget, setSelectedTarget] = useState("");
    const [selectedEnv, setSelectedEnv] = useState("production");
    const [deployConfig, setDeployConfig] = useState({});
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployProgress, setDeployProgress] = useState(0);
    const [deployStatus, setDeployStatus] = useState("idle"); // idle, deploying, success, error
    const [deployResult, setDeployResult] = useState(null);
    const [availableTargets, setAvailableTargets] = useState([]);
    const [updateDns, setUpdateDns] = useState(true);
    const [deployLog, setDeployLog] = useState([]);

    // Load available targets
    useEffect(() => {
        setAvailableTargets(getAvailableTargets(settings));
    }, [settings]);

    // Load deploy config when domain+target selected
    useEffect(() => {
        const loadConfig = async () => {
            if (selectedDomainId && selectedTarget) {
                const config = await getDeployConfig(selectedDomainId, `${selectedEnv}-${selectedTarget}`);
                setDeployConfig(config || {
                    branch: "main",
                    buildCommand: "npm run build",
                    outputDir: "dist",
                });
            }
        };
        loadConfig();
    }, [selectedDomainId, selectedTarget, selectedEnv]);

    const handleDeploy = async () => {
        if (!selectedDomainId || !selectedTarget) {
            onStatusMessage?.("Select domain and deploy target", "error");
            return;
        }

        const targetInfo = DEPLOY_TARGETS.find(t => t.id === selectedTarget);
        const domain = domains.find(d => d.id === selectedDomainId);

        if (!domain) {
            onStatusMessage?.("Domain not found", "error");
            return;
        }

        // Resolve Cloudflare credentials for this specific domain first,
        // then fall back to global Settings values.
        const domainCfAccountId = domain.cfAccountId || domain.cf_account_id;
        const linkedCfAccount = cfAccounts.find(a =>
            a.id === domainCfAccountId ||
            a.accountId === domainCfAccountId ||
            a.account_id === domainCfAccountId
        );
        const linkedCfToken = (linkedCfAccount?.apiKey || linkedCfAccount?.api_key || "").trim();
        const linkedCfAccountRef = (linkedCfAccount?.accountId || linkedCfAccount?.account_id || domainCfAccountId || "").trim();

        const effectiveSettings = {
            ...settings,
            cfApiToken: (linkedCfToken || settings.cfApiToken || "").trim(),
            cfAccountId: (linkedCfAccountRef || settings.cfAccountId || "").trim(),
        };

        setIsDeploying(true);
        setDeployStatus("deploying");
        setDeployProgress(0);
        setDeployLog([]);
        setDeployResult(null);

        // Simulate progress
        const progressInterval = setInterval(() => {
            setDeployProgress(p => Math.min(p + 10, 90));
        }, 500);

        try {
            addLog(`Starting deployment to ${targetInfo.label}...`);
            addLog(`Domain: ${domain.domain || domain.brand}`);
            addLog(`Environment: ${selectedEnv}`);
            if (selectedTarget === "cf-pages" || selectedTarget === "cf-workers") {
                const maskedCf = effectiveSettings.cfAccountId
                    ? `${effectiveSettings.cfAccountId.slice(0, 8)}...`
                    : "not set";
                addLog(`Cloudflare account: ${maskedCf}`);
            }

            // Build the HTML
            addLog("Building landing page...");
            const html = await buildHtmlForDomain(domain);
            addLog("HTML built successfully ✓");

            // Generate apply page and attach as extra file
            const applyHtml = generateApplyPageByTemplate(domain);
            const domainWithFiles = { ...domain, _extraFiles: { "/apply.html": applyHtml } };
            addLog(`Built apply.html (${applyHtml.length} bytes) ✓`);

            // Deploy
            addLog(`Deploying to ${targetInfo.label}...`);
            const result = await deployTo(selectedTarget, html, domainWithFiles, effectiveSettings);

            clearInterval(progressInterval);
            setDeployProgress(100);

            if (result.success) {
                if (result.queued) {
                    addLog(`Deployment queued! ⏳`);
                    addLog(`Workflow: ${result.url}`);
                } else {
                    addLog(`Deployment successful! ✓`);
                    addLog(`URL: ${result.url}`);
                }

                // Update DNS if requested
                if (updateDns && domain.domain && effectiveSettings.cfAccountId && effectiveSettings.cfApiToken) {
                    addLog("Updating DNS records...");
                    try {
                        const dnsResult = await cloudflareDns.updateDnsAfterDeploy({
                            domain: domain.domain,
                            cfAccountId: effectiveSettings.cfAccountId,
                            cfApiToken: effectiveSettings.cfApiToken,
                            deployTarget: selectedTarget,
                            deployUrl: result.url,
                            proxied: true,
                        });

                        if (dnsResult.success) {
                            addLog(`DNS updated successfully ✓ (${dnsResult.message})`);
                        } else {
                            addLog(`DNS update failed: ${dnsResult.error}`);
                        }
                    } catch (e) {
                        addLog(`DNS update error: ${e.message}`);
                    }
                }

                // Save deploy config
                saveDeployConfig(selectedDomainId, `${selectedEnv}-${selectedTarget}`, deployConfig);

                setDeployStatus("success");
                setDeployResult(result);
                if (result.queued) {
                    onStatusMessage?.(`Queued ${targetInfo.label}: ${result.url}`, "success");
                } else {
                    onStatusMessage?.(`Deployed to ${targetInfo.label}: ${result.url}`, "success");
                }
                onDeploy?.(result);
            } else {
                addLog(`Deployment failed: ${result.error}`);
                setDeployStatus("error");
                setDeployResult(result);
                onStatusMessage?.(`Deployment failed: ${result.error}`, "error");
            }
        } catch (e) {
            clearInterval(progressInterval);
            addLog(`Error: ${e.message}`);
            setDeployStatus("error");
            onStatusMessage?.(`Error: ${e.message}`, "error");
        } finally {
            setIsDeploying(false);
        }
    };

    const buildHtmlForDomain = async (domain) => {
        try {
            return generateHtmlByTemplate(domain);
        } catch (e) {
            console.error("Failed to generate LP:", e);
            throw new Error(`Generator failed: ${e.message}`);
        }
    };

    const addLog = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        setDeployLog(prev => [...prev, `[${timestamp}] ${message}`]);
    };

    const selectedDomain = domains.find(d => d.id === selectedDomainId);

    return (
        <div style={S.section}>
            {/* Header */}
            <div style={S.sectionHeader}>
                <div>
                    <div style={S.sectionTitle}>Deploy Management</div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                        Deploy landing pages to various platforms
                    </div>
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>
                    {deployStatus === "success" && <span style={S.statusSuccess}>✓ Last deploy successful</span>}
                    {deployStatus === "error" && <span style={S.statusError}>✗ Last deploy failed</span>}
                </div>
            </div>

            {/* Environment Tabs */}
            <div style={{ ...S.row, marginBottom: 16 }}>
                {DEPLOY_ENVIRONMENTS.map(env => (
                    <div
                        key={env.id}
                        style={S.envTab(selectedEnv === env.id)}
                        onClick={() => setSelectedEnv(env.id)}
                    >
                        {env.icon} {env.label}
                    </div>
                ))}
            </div>

            {/* Domain Selector */}
            <div style={{ ...S.row, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                    <label style={S.label}>Select Domain</label>
                    <select
                        style={S.select}
                        value={selectedDomainId}
                        onChange={(e) => setSelectedDomainId(e.target.value)}
                        disabled={isDeploying}
                    >
                        <option value="">Select a domain...</option>
                        {domains.map(d => (
                            <option key={d.id} value={d.id}>{d.domain || d.brand || "Unnamed"}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Deploy Target Selection */}
            {selectedDomainId && (
                <>
                    <div style={{ marginBottom: 12 }}>
                        <label style={S.label}>Deploy Target</label>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
                        {availableTargets.map(t => (
                            <div
                                key={t.id}
                                style={{
                                    ...S.targetCard(t.configured),
                                    ...S.targetCardSelected(selectedTarget === t.id)
                                }}
                                onClick={() => !isDeploying && setSelectedTarget(t.id)}
                            >
                                <div style={{ fontSize: 20 }}>{t.icon}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{t.label}</div>
                                <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{t.description}</div>
                                {!t.configured && (
                                    <div style={{ fontSize: 10, color: T.danger, marginTop: 4 }}>
                                        ⚠️ Not configured
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Deploy Settings */}
            {selectedDomainId && selectedTarget && (
                <Card style={{ padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                        Deploy Settings
                    </div>

                    {/* CF Pages Settings */}
                    {selectedTarget === "cf-pages" && (
                        <div style={S.row}>
                            <div style={{ flex: 1 }}>
                                <label style={S.label}>Branch</label>
                                <input
                                    type="text"
                                    style={S.select}
                                    value={deployConfig.branch || "main"}
                                    onChange={(e) => setDeployConfig({ ...deployConfig, branch: e.target.value })}
                                    disabled={isDeploying}
                                />
                            </div>
                        </div>
                    )}

                    {/* VPS Settings */}
                    {selectedTarget === "vps-ssh" && (
                        <>
                            <div style={S.row}>
                                <div style={{ flex: 1 }}>
                                    <label style={S.label}>Host</label>
                                    <input
                                        type="text"
                                        style={S.select}
                                        value={settings.vpsHost || ""}
                                        disabled
                                        placeholder="Configure in Settings"
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={S.label}>Path</label>
                                    <input
                                        type="text"
                                        style={S.select}
                                        value={settings.vpsPath || ""}
                                        disabled
                                        placeholder="Configure in Settings"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* DNS Update Toggle */}
                    {selectedDomain?.domain && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={updateDns}
                                    onChange={(e) => setUpdateDns(e.target.checked)}
                                    disabled={isDeploying}
                                />
                                <span style={{ fontSize: 12 }}>
                                    Update DNS records automatically after deploy
                                </span>
                            </label>
                            {updateDns && (!settings.cfAccountId || !settings.cfApiToken) && (
                                <div style={{ fontSize: 10, color: T.danger, marginTop: 4, marginLeft: 20 }}>
                                    ⚠️ Cloudflare credentials required for DNS update
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            )}

            {/* Deploy Progress */}
            {(isDeploying || deployResult) && (
                <Card style={S.progressContainer}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                            {isDeploying ? "Deploying..." : deployStatus === "success" ? "Deployment Complete" : "Deployment Failed"}
                        </span>
                        <span style={{ fontSize: 11, color: T.muted }}>{deployProgress}%</span>
                    </div>

                    <div style={S.progressBar}>
                        <div style={S.progressFill(deployProgress)} />
                    </div>

                    {/* Log */}
                    {deployLog.length > 0 && (
                        <div style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 6,
                            background: T.card2,
                            fontSize: 10,
                            fontFamily: "monospace",
                            maxHeight: 120,
                            overflowY: "auto"
                        }}>
                            {deployLog.map((log, i) => (
                                <div key={i}>{log}</div>
                            ))}
                        </div>
                    )}

                    {/* Result URL */}
                    {deployResult?.url && (
                        <div style={S.urlResult}>
                            <span style={{ color: T.success }}>✓</span>
                            <a href={deployResult.url} target="_blank" rel="noopener" style={{ color: T.text, textDecoration: "none" }}>
                                {deployResult.url}
                            </a>
                            <button
                                onClick={() => navigator.clipboard.writeText(deployResult.url)}
                                style={{ marginLeft: "auto", background: "none", border: "none", color: T.primary, cursor: "pointer", fontSize: 10 }}
                            >
                                Copy
                            </button>
                        </div>
                    )}
                </Card>
            )}

            {/* Deploy Button */}
            {selectedDomainId && selectedTarget && !isDeploying && (
                <Button
                    variant="primary"
                    size="lg"
                    onClick={handleDeploy}
                    disabled={isDeploying}
                    style={{ width: "100%", padding: 16 }}
                >
                    Deploy to {DEPLOY_TARGETS.find(t => t.id === selectedTarget)?.label}
                </Button>
            )}
        </div>
    );
}


