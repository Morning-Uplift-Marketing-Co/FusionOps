import React from "react";
import { THEME as T } from "../../constants";
import { Field } from "../ui/field";
import { InputField as Inp } from "../ui/input-field";
import { generateBusinessAddress, generateDomainVanityPhone } from "../../utils/contact-gen";

export function StepBrand({ c, u, settings, cfAccounts = [], registrarAccounts = [] }) {
    const cfProfiles = Array.isArray(settings?.cfProfiles) ? settings.cfProfiles : [];
    const sourceRegistrarAccounts = Array.isArray(registrarAccounts) && registrarAccounts.length > 0
        ? registrarAccounts
        : settings?.registrarAccounts;
    const allRegistrarAccounts = Array.isArray(sourceRegistrarAccounts) ? sourceRegistrarAccounts : [];
    const providerOptions = Array.from(new Set(
        allRegistrarAccounts.map((acc) => String(acc?.provider || "").toLowerCase()).filter(Boolean)
    ));
    if (!providerOptions.includes("internetbs")) providerOptions.unshift("internetbs");
    const selectedProvider = c.domainProvider || (c.internetbsAccountId ? "internetbs" : "");
    const providerAccounts = allRegistrarAccounts.filter(
        (acc) => String(acc?.provider || "").toLowerCase() === selectedProvider
    );
    const hasDomain = !!String(c.domain || "").trim();
    const hasProviderSelection = !!selectedProvider;
    const showProviderAccountSelect = hasProviderSelection;
    const showCloudflareAccountSelect = hasProviderSelection;
    const selectedProviderAccountId = c.domainProviderAccountId || c.internetbsAccountId || "";
    const hasProviderAccountSelection = !!selectedProviderAccountId;
    const autoSelectedProviderAccount = providerAccounts.length === 1 ? providerAccounts[0] : null;
    const cloudflareHelp = hasProviderAccountSelection
        ? "Required for auto DNS sync on Next step"
        : "Choose Cloudflare account for zone + nameserver sync";
    const currentSyncKey = `${String(c.domain || "").trim().toLowerCase()}|${selectedProvider}|${selectedProviderAccountId}|${String(c.cfAccountId || "")}`;
    const isDnsSynced = !!c._step1DnsSyncKey && c._step1DnsSyncKey === currentSyncKey;
    const shouldShowProviderAccountSelect = showProviderAccountSelect && providerAccounts.length > 1;
    const autoPhone = React.useMemo(() => generateDomainVanityPhone(c.domain || "", c.brand || ""), [c.domain, c.brand]);
    const autoAddress = React.useMemo(() => generateBusinessAddress(c.domain || "", c.brand || ""), [c.domain, c.brand]);

    React.useEffect(() => {
        if (!hasProviderSelection) return;

        // If there is exactly one account for selected provider, auto-select it.
        if (providerAccounts.length === 1) {
            const onlyId = providerAccounts[0]?.id || "";
            if (onlyId && selectedProviderAccountId !== onlyId) {
                u("domainProviderAccountId", onlyId);
                if (selectedProvider === "internetbs") u("internetbsAccountId", onlyId);
            }
            return;
        }

        // If account list is empty, clear stale selection.
        if (providerAccounts.length === 0 && selectedProviderAccountId) {
            u("domainProviderAccountId", "");
            if (selectedProvider === "internetbs") u("internetbsAccountId", "");
        }
    }, [hasProviderSelection, providerAccounts, selectedProvider, selectedProviderAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

    React.useEffect(() => {
        if (!hasDomain) return;

        const phone = String(c.phone || "").trim();
        const address = String(c.address || "").trim();

        if ((!phone || c._phoneAuto) && autoPhone && c.phone !== autoPhone) {
            u("phone", autoPhone);
            u("_phoneAuto", true);
        }

        if ((!address || c._addressAuto) && autoAddress && c.address !== autoAddress) {
            u("address", autoAddress);
            u("_addressAuto", true);
        }
    }, [hasDomain, autoPhone, autoAddress, c.phone, c.address, c._phoneAuto, c._addressAuto]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Phone" help="Auto-generated from domain (vanity) — editable"><Inp value={c.phone || ""} onChange={v => { u("_phoneAuto", false); u("phone", v); }} placeholder="1-800-SCRATCH-TECH" /></Field>
                <Field label="Business Address" help="Deterministic real US office address from local dataset — editable"><Inp value={c.address || ""} onChange={v => { u("_addressAuto", false); u("address", v); }} placeholder="123 Main St, New York, NY 10001" /></Field>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button
                    type="button"
                    onClick={() => { u("phone", autoPhone); u("_phoneAuto", true); }}
                    style={{
                        border: `1px solid hsl(var(--border))`,
                        background: "hsl(var(--input))",
                        color: "hsl(var(--foreground))",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "6px 10px",
                        cursor: "pointer",
                    }}
                >
                    Auto Phone
                </button>
                <button
                    type="button"
                    onClick={() => { u("address", autoAddress); u("_addressAuto", true); }}
                    style={{
                        border: `1px solid hsl(var(--border))`,
                        background: "hsl(var(--input))",
                        color: "hsl(var(--foreground))",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "6px 10px",
                        cursor: "pointer",
                    }}
                >
                    Random Real Address
                </button>
                <div style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center" }}>
                    Address source is curated real offices (not DNS records).
                </div>
            </div>

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

            {hasDomain && (
                <div style={{ marginTop: 16 }}>
                    <Field label="Domain Provider" req help="Select provider used to register this domain">
                        <select
                            value={selectedProvider}
                            onChange={e => {
                                const provider = e.target.value;
                                u("domainProvider", provider);
                                u("domainProviderAccountId", "");
                                u("_step1DnsSyncKey", "");
                                u("_step1DnsSyncedAt", "");
                                u("_step1DnsNameservers", []);
                                // Current automation supports Internet.bs account mapping
                                if (provider !== "internetbs") u("internetbsAccountId", "");
                            }}
                            style={{
                                width: "100%", padding: "8px 12px", borderRadius: 8,
                                border: `1px solid hsl(var(--border))`, background: "hsl(var(--input))",
                                color: "hsl(var(--foreground))", fontSize: 13, outline: "none",
                            }}
                        >
                            <option value="">Select domain provider...</option>
                            {providerOptions.map((provider) => (
                                <option key={provider} value={provider}>
                                    {provider === "internetbs" ? "Internet.bs" : provider}
                                </option>
                            ))}
                        </select>
                    </Field>
                </div>
            )}

            {shouldShowProviderAccountSelect && (
                <div style={{ marginTop: 16 }}>
                    <Field label="Provider Account" req help="Account used to update nameservers via API">
                        <select
                            value={selectedProviderAccountId}
                            onChange={e => {
                                const accountId = e.target.value;
                                u("domainProviderAccountId", accountId);
                                // Backward compatibility for existing flows
                                if (selectedProvider === "internetbs") u("internetbsAccountId", accountId);
                                u("_step1DnsSyncKey", "");
                                u("_step1DnsSyncedAt", "");
                                u("_step1DnsNameservers", []);
                            }}
                            disabled={providerAccounts.length === 0}
                            style={{
                                width: "100%", padding: "8px 12px", borderRadius: 8,
                                border: `1px solid hsl(var(--border))`, background: "hsl(var(--input))",
                                color: "hsl(var(--foreground))", fontSize: 13, outline: "none",
                                opacity: providerAccounts.length === 0 ? 0.65 : 1,
                            }}
                        >
                            {providerAccounts.length === 0 ? (
                                <option value="">No account found for this provider (add in Ops Center)</option>
                            ) : (
                                <>
                                    <option value="">Select provider account...</option>
                                    {providerAccounts.map((acc) => (
                                        <option key={acc.id} value={acc.id}>
                                            {(acc.label || acc.name || acc.id)} ({String(acc.provider || "provider")})
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                    </Field>
                </div>
            )}

            {showProviderAccountSelect && autoSelectedProviderAccount && (
                <div
                    style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: `1px solid rgba(99,102,241,0.35)`,
                        background: "rgba(99,102,241,0.08)",
                        fontSize: 12,
                        color: "hsl(var(--foreground))",
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: 3 }}>Provider Account (Auto-selected)</div>
                    <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                        {(autoSelectedProviderAccount.label || autoSelectedProviderAccount.name || autoSelectedProviderAccount.id)} ({String(autoSelectedProviderAccount.provider || selectedProvider)})
                    </div>
                </div>
            )}

            {showProviderAccountSelect && providerAccounts.length === 0 && (
                <div
                    style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: `1px solid rgba(245,158,11,0.35)`,
                        background: "rgba(245,158,11,0.08)",
                        fontSize: 12,
                        color: "hsl(var(--warning))",
                    }}
                >
                    ⚠️ No account found for this provider. Add one in Ops Center first.
                </div>
            )}

            {showCloudflareAccountSelect && (
                <div style={{ marginTop: 16 }}>
                    <Field
                        label="Cloudflare Account"
                        req
                        help={cloudflareHelp}
                    >
                        <select
                            value={c.cfAccountId || ""}
                            onChange={e => {
                                u("cfAccountId", e.target.value);
                                u("_step1DnsSyncKey", "");
                                u("_step1DnsSyncedAt", "");
                                u("_step1DnsNameservers", []);
                            }}
                            disabled={!Array.isArray(cfAccounts) || cfAccounts.length === 0}
                            style={{
                                width: "100%", padding: "8px 12px", borderRadius: 8,
                                border: `1px solid hsl(var(--border))`, background: "hsl(var(--input))",
                                color: "hsl(var(--foreground))", fontSize: 13, outline: "none",
                                opacity: !Array.isArray(cfAccounts) || cfAccounts.length === 0 ? 0.65 : 1,
                            }}
                        >
                            {!Array.isArray(cfAccounts) || cfAccounts.length === 0 ? (
                                <option value="">No Cloudflare account found (add in Ops Center)</option>
                            ) : (
                                <>
                                    <option value="">Select Cloudflare account...</option>
                                    {cfAccounts.map((acc) => (
                                        <option key={acc.id || acc.accountId || acc.account_id} value={acc.id || acc.accountId || acc.account_id}>
                                            {(acc.label || acc.name || "Cloudflare")} ({(acc.accountId || acc.account_id || "").slice(0, 8)}...)
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                    </Field>
                </div>
            )}

            {isDnsSynced && (
                <div
                    style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: `1px solid rgba(16,185,129,0.35)`,
                        background: "rgba(16,185,129,0.08)",
                        fontSize: 12,
                        color: "hsl(var(--success))",
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>✅ DNS synced</div>
                    <div style={{ fontSize: 11, opacity: 0.9 }}>
                        {Array.isArray(c._step1DnsNameservers) && c._step1DnsNameservers.length > 0
                            ? c._step1DnsNameservers.join(", ")
                            : "Nameservers updated"}
                    </div>
                    {c._step1DnsSyncedAt && (
                        <div style={{ fontSize: 10, marginTop: 3, opacity: 0.8 }}>
                            Synced at: {c._step1DnsSyncedAt}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

