/**
 * DNS Record Modal
 *
 * Modal for adding or editing DNS records in Cloudflare
 */

import { useState } from "react";
import { THEME as T, DNS_RECORD_TYPES, DNS_TTL_OPTIONS } from "../../../constants";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { InputField as Inp } from "../../ui/input-field";

const S = {
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" },
    label: { fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4, color: T.text },
    select: { width: "100%", padding: 9, borderRadius: 7, background: T.input, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, boxSizing: "border-box" },
    fieldWrap: { marginBottom: 12 },
    row: { display: "flex", gap: 10 },
    btnRow: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 },
    error: { fontSize: 11, color: T.danger, marginTop: 4 },
    toggle: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
    toggleTrack: { width: 36, height: 20, borderRadius: 10, background: "#374151", position: "relative", transition: "background 0.2s" },
    toggleTrackOn: { background: T.primary },
    toggleKnob: { width: 16, height: 16, borderRadius: 8, background: "white", position: "absolute", top: 2, left: 2, transition: "left 0.2s" },
    toggleKnobOn: { left: 18 },
    priorityRow: { display: "flex", alignItems: "center", gap: 10 },
};

export function DnsRecordModal({ mode, record, zoneId, zoneName, cfAccountId, cfApiToken, onSave, onCancel }) {
    const isEdit = mode === "edit";
    const [form, setForm] = useState({
        type: record?.type || "A",
        name: record?.name || "",
        content: record?.content || "",
        ttl: record?.ttl || 3600,
        proxied: record?.proxied !== undefined ? record.proxied : true,
        priority: record?.priority || null,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Dynamic placeholder based on record type
    const getPlaceholder = () => {
        const typeInfo = DNS_RECORD_TYPES.find(t => t.id === form.type);
        return typeInfo?.placeholder || "Enter value";
    };

    // Validation based on record type
    const validateForm = () => {
        if (!form.name) {
            return "Name is required";
        }
        if (!form.content) {
            return "Content is required";
        }

        // Type-specific validation
        switch (form.type) {
            case "A":
                if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(form.content)) {
                    return "Invalid IPv4 address (e.g., 192.0.2.1)";
                }
                break;
            case "AAAA":
                if (!/^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/.test(form.content)) {
                    return "Invalid IPv6 address";
                }
                break;
            case "CNAME":
                if (form.content === "@") {
                    return "CNAME cannot point to @";
                }
                break;
            case "MX":
                if (!form.priority) {
                    return "MX records require a priority";
                }
                break;
        }

        return "";
    };

    const handleSave = async () => {
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setSaving(true);
        setError("");

        try {
            // Import dynamically to avoid circular dependency
            const cloudflareDns = (await import("../../../services/cloudflare-dns")).default;

            const recordData = {
                type: form.type,
                name: form.name,
                content: form.content,
                ttl: form.ttl === 1 ? "auto" : form.ttl,
                proxied: form.proxied,
            };

            // Add priority for MX records
            if (form.type === "MX" && form.priority) {
                recordData.priority = form.priority;
            }

            let result;
            if (isEdit && record?.id) {
                result = await cloudflareDns.updateDnsRecord({
                    dnsRecordId: record.id,
                    zoneId,
                    cfAccountId,
                    ...recordData,
                });
            } else {
                result = await cloudflareDns.createDnsRecord({
                    zoneId,
                    cfAccountId,
                    ...recordData,
                });
            }

            if (result.success) {
                onSave(result.record);
            } else {
                setError(result.error || "Failed to save DNS record");
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTypeChange = (type) => {
        setForm({ ...form, type });
        setError("");
    };

    // MX records can't be proxied
    const canBeProxied = !["MX", "TXT", "NS", "SRV", "CAA"].includes(form.type);

    return (
        <div style={S.overlay}>
            <Card style={{ width: 480, padding: 24, animation: "fadeIn .2s", maxHeight: "90vh", overflowY: "auto" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                    {isEdit ? "Edit DNS Record" : "Add DNS Record"}
                </h3>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 16 }}>
                    Zone: {zoneName || zoneId}
                </div>

                {/* Record Type */}
                <div style={S.fieldWrap}>
                    <label style={S.label}>Type</label>
                    <select
                        style={S.select}
                        value={form.type}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        disabled={isEdit}
                    >
                        {DNS_RECORD_TYPES.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.label} — {t.description}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Name */}
                <div style={S.fieldWrap}>
                    <label style={S.label}>Name</label>
                    <Inp
                        value={form.name}
                        onChange={(v) => setForm({ ...form, name: v })}
                        placeholder="@ or subdomain"
                    />
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                        {form.name === "@" || !form.name
                            ? `Root domain (${zoneName || "domain"})`
                            : `${form.name}.${zoneName || "domain"}`
                        }
                    </div>
                </div>

                {/* Content */}
                <div style={S.fieldWrap}>
                    <label style={S.label}>
                        Content {form.type === "CNAME" ? "(Target Domain)" : form.type === "A" ? "(IP Address)" : "(Value)"}
                    </label>
                    <Inp
                        value={form.content}
                        onChange={(v) => setForm({ ...form, content: v })}
                        placeholder={getPlaceholder()}
                    />
                    {form.type === "CNAME" && (
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                            Use @ to point to root domain
                        </div>
                    )}
                </div>

                {/* MX Priority */}
                {form.type === "MX" && (
                    <div style={S.fieldWrap}>
                        <label style={S.label}>Priority</label>
                        <div style={S.priorityRow}>
                            <input
                                type="number"
                                style={{ ...S.select, width: 80 }}
                                value={form.priority || 10}
                                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 10 })}
                                min={0}
                                max={65535}
                            />
                            <span style={{ fontSize: 11, color: T.muted }}>
                                Lower = Higher priority (10 is common)
                            </span>
                        </div>
                    </div>
                )}

                {/* TTL */}
                <div style={S.fieldWrap}>
                    <label style={S.label}>TTL (Time to Live)</label>
                    <select
                        style={S.select}
                        value={form.ttl}
                        onChange={(e) => setForm({ ...form, ttl: parseInt(e.target.value) })}
                    >
                        {DNS_TTL_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {/* Proxied Toggle */}
                {canBeProxied && (
                    <div style={S.fieldWrap}>
                        <label
                            style={{ ...S.toggle }}
                            onClick={() => setForm({ ...form, proxied: !form.proxied })}
                        >
                            <div
                                style={{
                                    ...S.toggleTrack,
                                    ...(form.proxied ? S.toggleTrackOn : {})
                                }}
                            >
                                <div
                                    style={{
                                        ...S.toggleKnob,
                                        ...(form.proxied ? S.toggleKnobOn : {})
                                    }}
                                />
                            </div>
                            <span style={{ fontSize: 12, color: T.text }}>
                                Proxy through Cloudflare (orange cloud)
                            </span>
                        </label>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 4, marginLeft: 44 }}>
                            {form.proxied
                                ? "Traffic goes through Cloudflare CDN and security"
                                : "DNS only — traffic goes directly to origin"
                            }
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div style={{ ...S.error, marginTop: 12, padding: 8, background: `${T.danger}15`, borderRadius: 6 }}>
                        {error}
                    </div>
                )}

                {/* Buttons */}
                <div style={S.btnRow}>
                    <Button variant="ghost"  onClick={onCancel} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : isEdit ? "Update Record" : "Add Record"}
                    </Button>
                </div>
            </Card>
        </div>
    );
}


