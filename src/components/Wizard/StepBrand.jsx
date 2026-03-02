import React, { useMemo, useState } from "react";
import { THEME as T } from "../../constants";
import { Field } from "../ui/field";
import { InputField as Inp } from "../ui/input-field";
import { getOrCreateZone } from "../../services/cloudflare-dns";
import { updateNameservers, getCloudflareNameservers } from "../../services/registrar";

function normalizeRegistrarProvider(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");
}

export function StepBrand({ c, u, settings, ops }) {
    const cfProfiles = settings?.cfProfiles || [];
    const registrarAccounts = ops?.registrarAccounts || [];
    const internetBsAccounts = useMemo(
        () => registrarAccounts.filter((r) => normalizeRegistrarProvider(r.provider) === "internetbs"),
        [registrarAccounts]
    );
    const [syncingDns, setSyncingDns] = useState(false);
    const [dnsStatus, setDnsStatus] = useState(null);

    const handleSyncDnsToInternetBs = async () => {
        setDnsStatus(null);
        setSyncingDns(true);

        try {
            const domain = String(c.domain || "").trim().toLowerCase();
            if (!domain) throw new Error("Domain is required");
            if (!c.cfProfileId) throw new Error("Select Cloudflare profile first");

            const cfProfile = cfProfiles.find((p) => p.id === c.cfProfileId);
            if (!cfProfile?.accountId || !cfProfile?.apiToken) {
                throw new Error("Cloudflare profile is incomplete (missing account/token)");
            }

            const registrarAccountId = c.registrarAccountId || internetBsAccounts[0]?.id;
            if (!registrarAccountId) throw new Error("No Internet.bs account found in Ops Center");

            const zone = await getOrCreateZone(domain, cfProfile.accountId, cfProfile.apiToken);
            if (!zone?.success) throw new Error(zone?.error || "Failed to fetch Cloudflare zone");

            const nameservers = Array.isArray(zone.nameservers) && zone.nameservers.length >= 2
                ? zone.nameservers
                : getCloudflareNameservers();

            const result = await updateNameservers(domain, nameservers, registrarAccountId);
            if (!result?.success) {
                throw new Error(result?.error || result?.message || "Failed to update nameservers");
            }

            u("registrarAccountId", registrarAccountId);
            u("_internetbsDnsUpdatedAt", new Date().toISOString());
            setDnsStatus({
                type: "success",
                message: `Updated Internet.bs nameservers for ${domain} → ${nameservers.join(", ")}`,
            });
        } catch (e) {
            setDnsStatus({ type: "error", message: e?.message || "DNS sync failed" });
        } finally {
            setSyncingDns(false);
        }
    };

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏢</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Brand Information</h2>
                <p style={{ fontSize: 12, color: T.muted }}>Define your brand identity</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Brand Name" req help="Public brand name used in headlines"><Inp value={c.brand} onChange={v => u("brand", v)} placeholder="LoanBridge" /></Field>
                <Field label="Domain" req help="Active domain name"><Inp value={c.domain} onChange={v => u("domain", v)} placeholder="loanbridge.com" /></Field>
            </div>
            <Field label="Brand Tagline" help="Sub headline or trust message"><Inp value={c.tagline} onChange={v => u("tagline", v)} placeholder="Fast. Simple. Trusted." /></Field>
            <Field label="Compliance Email" help="Used in footer and privacy policy"><Inp value={c.email} onChange={v => u("email", v)} placeholder="support@loanbridge.com" /></Field>

            {/* Cloudflare Profile Selection */}
            {cfProfiles.length > 0 && (
                <div style={{ marginTop: 16 }}>
                    <Field label="Cloudflare Profile" req help="Which CF account manages DNS & deploy for this domain">
                        <select
                            value={c.cfProfileId || ""}
                            onChange={e => u("cfProfileId", e.target.value)}
                            style={{
                                width: "100%", padding: "8px 12px", borderRadius: 8,
                                border: `1px solid hsl(var(--border))`, background: "hsl(var(--input))",
                                color: "hsl(var(--foreground))", fontSize: 13, outline: "none",
                            }}
                        >
                            <option value="">Select CF profile...</option>
                            {cfProfiles.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.accountId?.slice(0,8)}...)</option>
                            ))}
                        </select>
                    </Field>
                </div>
            )}

            {/* Internet.bs quick action */}
            <div style={{ marginTop: 16 }}>
                <Field label="Add DNS to Internet.bs" help="One-click update nameservers at Internet.bs using Cloudflare zone nameservers">
                    <div style={{ display: "grid", gap: 10 }}>
                        <select
                            value={c.registrarAccountId || ""}
                            onChange={e => u("registrarAccountId", e.target.value)}
                            style={{
                                width: "100%", padding: "8px 12px", borderRadius: 8,
                                border: `1px solid hsl(var(--border))`, background: "hsl(var(--input))",
                                color: "hsl(var(--foreground))", fontSize: 13, outline: "none",
                            }}
                        >
                            <option value="">Select Internet.bs account...</option>
                            {internetBsAccounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.label || acc.name || acc.id} ({acc.provider || "internetbs"})
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={handleSyncDnsToInternetBs}
                            disabled={
                                syncingDns ||
                                !c.domain ||
                                !c.cfProfileId ||
                                (!c.registrarAccountId && internetBsAccounts.length === 0)
                            }
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: 8,
                                border: "none",
                                background: "hsl(var(--primary))",
                                color: "hsl(var(--primary-foreground))",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: syncingDns ? "not-allowed" : "pointer",
                                opacity: syncingDns ? 0.6 : 1,
                            }}
                        >
                            {syncingDns ? "⏳ Updating nameservers..." : "🌐 Add DNS to Internet.bs"}
                        </button>

                        {dnsStatus && (
                            <div style={{
                                fontSize: 11,
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: `1px solid ${dnsStatus.type === "success" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                                background: dnsStatus.type === "success" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                                color: dnsStatus.type === "success" ? "hsl(var(--success))" : "hsl(var(--destructive))",
                                whiteSpace: "pre-wrap",
                                lineHeight: 1.4,
                            }}>
                                {dnsStatus.message}
                            </div>
                        )}
                    </div>
                </Field>
            </div>
        </>
    );
}
