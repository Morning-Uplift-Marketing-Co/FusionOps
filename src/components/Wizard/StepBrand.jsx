import React from "react";
import { THEME as T } from "../../constants";
import { Field } from "../ui/field";
import { InputField as Inp } from "../ui/input-field";

export function StepBrand({ c, u, settings }) {
    const cfProfiles = settings?.cfProfiles || [];

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
        </>
    );
}

