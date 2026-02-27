/**
 * DNS Section
 *
 * DNS management section for Cloudflare zones
 * - List zones for selected account
 * - List DNS records for selected zone
 * - Add/Edit/Delete records
 * - Test DNS propagation
 */

import { useState, useEffect } from "react";
import { THEME as T, DNS_TEMPLATES } from "../../../constants";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import cloudflareZone from "../../../services/cloudflare-zone";
import cloudflareDns from "../../../services/cloudflare-dns";
import { DnsRecordModal } from "./DnsRecordModal";

const S = {
    section: { marginBottom: 24 },
    sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionTitle: { fontSize: 13, fontWeight: 700, color: T.text },
    row: { display: "flex", gap: 10 },
    select: { padding: 8, borderRadius: 6, background: T.input, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, minWidth: 150 },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 11 },
    tableHeader: { textAlign: "left", padding: "10px 12px", color: T.muted, fontWeight: 600, borderBottom: `1px solid ${T.border}` },
    tableCell: { padding: "10px 12px", borderBottom: `1px solid ${T.border}33` },
    tableRow: { transition: "background 0.15s", cursor: "pointer" },
    tableRowHover: { background: `${T.primary}08` },
    typeCell: { width: 50, fontWeight: 700, textTransform: "uppercase" },
    proxiedOn: { color: T.primary, fontSize: 14 },
    proxiedOff: { color: T.muted, opacity: 0.5 },
    propagationBar: { height: 4, borderRadius: 2, background: T.border, overflow: "hidden", marginTop: 4 },
    propagationFill: (pct) => ({ height: "100%", background: pct === 100 ? T.success : pct > 0 ? T.warning : T.danger, width: `${pct}%`, transition: "width 0.3s" }),
    templateGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 16 },
    templateCard: { padding: 12, borderRadius: 8, background: T.card2, border: `1px solid ${T.border}`, cursor: "pointer", transition: "all 0.2s" },
    templateCardHover: { borderColor: T.primary, background: `${T.primary}10` },
    searchWrap: { position: "relative", marginBottom: 12 },
    searchInput: { width: "100%", padding: "8px 12px 8px 32px", borderRadius: 6, background: T.input, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, boxSizing: "border-box" },
    searchIcon: { position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 12 },
    statusDot: (status) => ({
        width: 8, height: 8, borderRadius: "50%",
        background: status === "propagated" ? T.success : status === "propagating" ? T.warning : T.danger
    }),
};

export function DnsSection({ cfAccounts, onStatusMessage }) {
    const [selectedAccountId, setSelectedAccountId] = useState("");
    const [selectedZone, setSelectedZone] = useState(null);
    const [zones, setZones] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [modal, setModal] = useState(null); // { type: 'add'|'edit', record?, zone?, template? }
    const [propagationStatus, setPropagationStatus] = useState({});
    const [showTemplates, setShowTemplates] = useState(false);

    // Load zones when account is selected
    useEffect(() => {
        if (!selectedAccountId) {
            setZones([]);
            setRecords([]);
            setSelectedZone(null);
            return;
        }

        loadZones();
    }, [selectedAccountId]);

    // Load records when zone is selected
    useEffect(() => {
        if (selectedZone) {
            loadRecords();
            checkPropagation();
        } else {
            setRecords([]);
        }
    }, [selectedZone]);

    // Check propagation periodically
    useEffect(() => {
        if (!selectedZone) return;

        const interval = setInterval(() => {
            checkPropagation();
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [selectedZone]);

    const loadZones = async () => {
        setLoading(true);
        try {
            const account = cfAccounts.find(a => a.id === selectedAccountId);
            if (!account?.account_id || !account?.api_key) {
                onStatusMessage?.("Account missing credentials", "error");
                setLoading(false);
                return;
            }

            const result = await cloudflareZone.listZones(account.account_id, account.api_key, { perPage: 100 });

            if (result.success) {
                setZones(result.zones);
            } else {
                onStatusMessage?.(`Failed to load zones: ${result.error}`, "error");
            }
        } catch (e) {
            onStatusMessage?.(`Error loading zones: ${e.message}`, "error");
        } finally {
            setLoading(false);
        }
    };

    const loadRecords = async () => {
        if (!selectedZone) return;

        setLoadingRecords(true);
        try {
            const account = cfAccounts.find(a => a.id === selectedAccountId);
            const result = await cloudflareDns.listDnsRecords(selectedZone.id, account.account_id);

            if (result.success) {
                setRecords(result.records || []);
            } else {
                onStatusMessage?.(`Failed to load records: ${result.error}`, "error");
            }
        } catch (e) {
            onStatusMessage?.(`Error loading records: ${e.message}`, "error");
        } finally {
            setLoadingRecords(false);
        }
    };

    const checkPropagation = async () => {
        if (!selectedZone) return;

        // Check propagation for A/AAAA/CNAME records
        const recordsToCheck = records.filter(r => ["A", "AAAA", "CNAME"].includes(r.type));
        const newStatus = {};

        for (const record of recordsToCheck) {
            const hostname = record.name === "@"
                ? selectedZone.name
                : `${record.name}.${selectedZone.name}`;

            const result = await cloudflareZone.checkDnsPropagation(
                hostname,
                record.type,
                record.content
            );

            newStatus[record.id] = {
                propagated: result.propagated,
                servers: result.servers,
                checkedAt: Date.now(),
            };
        }

        setPropagationStatus(newStatus);
    };

    const handleAddRecord = () => {
        setModal({ type: "add", zone: selectedZone });
    };

    const handleEditRecord = (record) => {
        setModal({ type: "edit", record, zone: selectedZone });
    };

    const handleDeleteRecord = async (record) => {
        if (!confirm(`Delete ${record.type} record for ${record.name}?`)) {
            return;
        }

        const account = cfAccounts.find(a => a.id === selectedAccountId);
        const result = await cloudflareDns.deleteDnsRecord(record.id, selectedZone.id, account.account_id);

        if (result.success) {
            onStatusMessage?.("DNS record deleted");
            loadRecords();
        } else {
            onStatusMessage?.(`Failed to delete: ${result.error}`, "error");
        }
    };

    const handleSaveRecord = () => {
        setModal(null);
        loadRecords();
        checkPropagation();
    };

    const handleApplyTemplate = async (template) => {
        if (!selectedZone) {
            onStatusMessage?.("Select a zone first", "error");
            return;
        }

        const account = cfAccounts.find(a => a.id === selectedAccountId);
        let created = 0;
        let failed = 0;

        for (const rec of template.records) {
            // Replace placeholders
            const content = rec.content.replace("192.0.2.1", account.defaultIp || "192.0.2.1");

            const result = await cloudflareDns.createDnsRecord({
                zoneId: selectedZone.id,
                cfAccountId: account.account_id,
                type: rec.type,
                name: rec.name,
                content,
                ttl: rec.ttl,
                proxied: rec.proxied,
                priority: rec.priority,
            });

            if (result.success) {
                created++;
            } else {
                failed++;
            }
        }

        onStatusMessage?.(`Template applied: ${created} created, ${failed} failed`);
        loadRecords();
        setShowTemplates(false);
    };

    const getPropagationPct = (recordId) => {
        const status = propagationStatus[recordId];
        if (!status) return 0;

        const successCount = status.servers?.filter(s => s.success && s.matches).length || 0;
        return Math.round((successCount / status.servers.length) * 100);
    };

    const getPropagationStatus = (recordId) => {
        const status = propagationStatus[recordId];
        if (!status) return "unknown";
        if (status.propagated) return "propagated";
        const pct = getPropagationPct(recordId);
        if (pct > 0) return "propagating";
        return "not-propagated";
    };

    // Filter records by search
    const filteredRecords = records.filter(r => {
        const q = searchQuery.toLowerCase();
        return r.type.toLowerCase().includes(q) ||
               r.name.toLowerCase().includes(q) ||
               r.content.toLowerCase().includes(q);
    });

    const selectedAccount = cfAccounts.find(a => a.id === selectedAccountId);

    return (
        <div style={S.section}>
            {/* Header */}
            <div style={S.sectionHeader}>
                <div>
                    <div style={S.sectionTitle}>DNS Management</div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                        Manage DNS records across Cloudflare zones
                    </div>
                </div>
                <div style={S.row}>
                    <Button
                        variant={showTemplates ? "primary" : "ghost"}
                        size="sm"
                        onClick={() => setShowTemplates(!showTemplates)}
                    >
                        {showTemplates ? "Hide Templates" : "Use Template"}
                    </Button>
                    {selectedZone && (
                        <Button variant="ghost"
                            
                            size="sm"
                            onClick={checkPropagation}
                        >
                            ↻ Check Propagation
                        </Button>
                    )}
                </div>
            </div>

            {/* Account Selector */}
            <div style={{ ...S.row, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 4, display: "block" }}>
                        Cloudflare Account
                    </label>
                    <select
                        style={S.select}
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                    >
                        <option value="">Select account...</option>
                        {cfAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.label || a.email}</option>
                        ))}
                    </select>
                </div>
                {zones.length > 0 && (
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 4, display: "block" }}>
                            Zone (Domain)
                        </label>
                        <select
                            style={S.select}
                            value={selectedZone?.id || ""}
                            onChange={(e) => {
                                const zone = zones.find(z => z.id === e.target.value);
                                setSelectedZone(zone || null);
                            }}
                        >
                            <option value="">Select zone...</option>
                            {zones.map(z => (
                                <option key={z.id} value={z.id}>{z.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* DNS Templates */}
            {showTemplates && (
                <Card style={{ padding: 16, marginBottom: 16, background: T.card }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                        Quick Templates
                    </div>
                    <div style={S.templateGrid}>
                        {DNS_TEMPLATES.map(t => (
                            <div
                                key={t.id}
                                style={S.templateCard}
                                onClick={() => handleApplyTemplate(t)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = T.primary;
                                    e.currentTarget.style.background = `${T.primary}10`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = T.border;
                                    e.currentTarget.style.background = T.card2;
                                }}
                            >
                                <div style={{ fontSize: 18 }}>{t.icon}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{t.name}</div>
                                <div style={{ fontSize: 10, color: T.muted }}>{t.description}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Records Table */}
            {selectedZone && (
                <Card style={{ padding: 0, overflow: "hidden" }}>
                    {/* Search */}
                    <div style={S.searchWrap}>
                        <span style={S.searchIcon}>🔍</span>
                        <input
                            type="text"
                            style={S.searchInput}
                            placeholder="Search DNS records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Table */}
                    {loadingRecords ? (
                        <div style={{ padding: 32, textAlign: "center", color: T.muted }}>
                            Loading DNS records...
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div style={{ padding: 32, textAlign: "center", color: T.muted }}>
                            {searchQuery ? "No matching records found" : "No DNS records found"}
                        </div>
                    ) : (
                        <table style={S.table}>
                            <thead>
                                <tr>
                                    <th style={S.tableHeader}>Type</th>
                                    <th style={S.tableHeader}>Name</th>
                                    <th style={S.tableHeader}>Content</th>
                                    <th style={S.tableHeader}>TTL</th>
                                    <th style={S.tableHeader}>Proxy</th>
                                    <th style={S.tableHeader}>Propagation</th>
                                    <th style={S.tableHeader}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map(r => {
                                    const propagationPct = getPropagationPct(r.id);
                                    const propagationStat = getPropagationStatus(r.id);

                                    return (
                                        <tr
                                            key={r.id}
                                            style={S.tableRow}
                                            onMouseEnter={(e) => e.currentTarget.style.background = `${T.primary}08`}
                                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                        >
                                            <td style={{ ...S.tableCell, ...S.typeCell, color: T.primary }}>
                                                {r.type}
                                            </td>
                                            <td style={S.tableCell}>
                                                <div style={{ fontWeight: 500 }}>{r.name}</div>
                                                <div style={{ fontSize: 10, color: T.muted }}>
                                                    {r.name === "@" ? selectedZone.name : `${r.name}.${selectedZone.name}`}
                                                </div>
                                            </td>
                                            <td style={S.tableCell}>
                                                <div style={{
                                                    maxWidth: 200,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap"
                                                }}>
                                                    {r.content}
                                                </div>
                                            </td>
                                            <td style={S.tableCell}>{r.ttl === 1 ? "Auto" : r.ttl}s</td>
                                            <td style={S.tableCell}>
                                                {r.proxied !== undefined ? (
                                                    <span style={r.proxied ? S.proxiedOn : S.proxiedOff}>
                                                        {r.proxied ? "☁️" : "🔴"}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: T.muted }}>—</span>
                                                )}
                                            </td>
                                            <td style={S.tableCell}>
                                                {["A", "AAAA", "CNAME"].includes(r.type) ? (
                                                    <div>
                                                        <div style={S.propagationBar}>
                                                            <div style={S.propagationFill(propagationPct)} />
                                                        </div>
                                                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                                                            {propagationPct === 100 ? "✓ Propagated" : propagationPct > 0 ? `${propagationPct}%` : "Checking..."}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: T.muted }}>—</span>
                                                )}
                                            </td>
                                            <td style={S.tableCell}>
                                                <div style={S.row}>
                                                    <button
                                                        style={{ background: "none", border: "none", color: T.primary, cursor: "pointer", fontSize: 10 }}
                                                        onClick={() => handleEditRecord(r)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 10 }}
                                                        onClick={() => handleDeleteRecord(r)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Add Record Button */}
                    <div style={{ padding: 12, borderTop: `1px solid ${T.border}` }}>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleAddRecord}
                            disabled={loadingRecords}
                        >
                            + Add DNS Record
                        </Button>
                    </div>
                </Card>
            )}

            {/* Modal */}
            {modal && modal.zone && (
                <DnsRecordModal
                    mode={modal.type}
                    record={modal.record}
                    zoneId={modal.zone.id}
                    zoneName={modal.zone.name}
                    cfAccountId={selectedAccount?.account_id}
                    cfApiToken={selectedAccount?.api_key}
                    onSave={handleSaveRecord}
                    onCancel={() => setModal(null)}
                />
            )}
        </div>
    );
}


