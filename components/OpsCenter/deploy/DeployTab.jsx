/**
 * Deploy Tab
 *
 * Main container for DNS and Deployment management
 * Combines all deploy-related sections into one tab
 */

import { useState, useEffect, useCallback } from "react";
import { THEME as T } from "../../../constants";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { QuickActionsPanel } from "./QuickActionsPanel";
import { DnsSection } from "./DnsSection";
import { DeploySection } from "./DeploySection";
import { DeployHistory } from "./DeployHistory";
import { DeployDashboard } from "./DeployDashboard.jsx";

const S = {
    container: { padding: "16px 0" },
    tabs: { display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${T.border}` },
    tab: (active) => ({
        padding: "10px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
        color: active ? T.text : T.muted, borderBottom: active ? `2px solid ${T.primary}` : "2px solid transparent",
        transition: "all 0.2s"
    }),
    content: { animation: "fadeIn 0.2s" },
    emptyState: { padding: 48, textAlign: "center", color: T.muted },
    keyboardHint: { fontSize: 10, color: T.muted, marginTop: 4 },
    shortcutKey: {
        padding: "2px 6px", borderRadius: 4, background: T.card, border: `1px solid ${T.border}`,
        fontFamily: "monospace", fontSize: 9
    }
};

export function DeployTab({ data, settings, add, del, upd, notify }) {
    const [activeTab, setActiveTab] = useState("overview");
    const [statusMsg, setStatusMsg] = useState(null);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl/Cmd + D = Quick Deploy
            if ((e.ctrlKey || e.metaKey) && e.key === "d") {
                e.preventDefault();
                setActiveTab("deploy");
            }
            // Ctrl/Cmd + N = Add DNS Record
            if ((e.ctrlKey || e.metaKey) && e.key === "n") {
                e.preventDefault();
                setActiveTab("dns");
            }
            // Escape = Close/Open tab
            if (e.key === "Escape") {
                setActiveTab("overview");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const flash = useCallback((msg, type = "success") => {
        setStatusMsg({ msg, type });
        notify?.(msg, type);
        setTimeout(() => setStatusMsg(null), 3000);
    }, [notify]);

    const handleStatusMessage = useCallback((msg, type = "info") => {
        flash(msg, type);
    }, [flash]);

    const handleDeploy = useCallback(() => {
        // Refresh history after deploy
        window.dispatchEvent(new CustomEvent("deploy-completed"));
    }, []);

    const handleQuickAction = useCallback((actionType, result) => {
        flash(`Quick action "${actionType}" completed`, "success");
        // Navigate to relevant tab
        if (actionType === "test-dns") {
            setActiveTab("dns");
        } else if (actionType === "deploy-dns") {
            setActiveTab("deploy");
        }
    }, [flash]);

    return (
        <div style={S.container}>
            {/* Status Message */}
            {statusMsg && (
                <div style={{
                    padding: "10px 16px", borderRadius: 8, marginBottom: 16,
                    background: statusMsg.type === "error" ? `${T.danger}15` : `${T.success}15`,
                    border: `1px solid ${statusMsg.type === "error" ? `${T.danger}40` : `${T.success}40`}`,
                    color: statusMsg.type === "error" ? T.danger : T.success,
                    fontSize: 12, fontWeight: 600, animation: "fadeIn .2s"
                }}>
                    {statusMsg.msg}
                </div>
            )}

            {/* Sub-tabs */}
            <div style={S.tabs}>
                <div style={S.tab(activeTab === "overview")} onClick={() => setActiveTab("overview")}>
                    📊 Overview
                </div>
                <div style={S.tab(activeTab === "dns")} onClick={() => setActiveTab("dns")}>
                    🌐 DNS
                </div>
                <div style={S.tab(activeTab === "deploy")} onClick={() => setActiveTab("deploy")}>
                    🚀 Deploy
                </div>
                <div style={S.tab(activeTab === "history")} onClick={() => setActiveTab("history")}>
                    📜 History
                </div>
            </div>

            {/* Content */}
            <div style={S.content}>
                {activeTab === "overview" && (
                    <>
                        <QuickActionsPanel
                            domains={data.domains || []}
                            settings={settings}
                            cfAccounts={data.cfAccounts || []}
                            onAction={handleQuickAction}
                            onStatusMessage={handleStatusMessage}
                        />
                        <DeployDashboard />
                    </>
                )}

                {activeTab === "dns" && (
                    <DnsSection
                        cfAccounts={data.cfAccounts || []}
                        onStatusMessage={handleStatusMessage}
                    />
                )}

                {activeTab === "deploy" && (
                    <DeploySection
                        domains={data.domains || []}
                        settings={settings}
                        cfAccounts={data.cfAccounts || []}
                        onDeploy={handleDeploy}
                        onStatusMessage={handleStatusMessage}
                    />
                )}

                {activeTab === "history" && (
                    <DeployHistory
                        domains={data.domains || []}
                        onRedeploy={(record) => {
                            // Trigger redeploy
                            setActiveTab("deploy");
                            flash(`Redeploying ${record.domain} to ${record.target}...`, "info");
                        }}
                    />
                )}
            </div>

            {/* Keyboard Hints */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.border}`, display: "flex", gap: 16 }}>
                <div style={S.keyboardHint}>
                    <span style={S.shortcutKey}>Ctrl</span> + <span style={S.shortcutKey}>D</span> Quick Deploy
                </div>
                <div style={S.keyboardHint}>
                    <span style={S.shortcutKey}>Ctrl</span> + <span style={S.shortcutKey}>N</span> Add DNS
                </div>
                <div style={S.keyboardHint}>
                    <span style={S.shortcutKey}>Esc</span> Overview
                </div>
            </div>
        </div>
    );
}


