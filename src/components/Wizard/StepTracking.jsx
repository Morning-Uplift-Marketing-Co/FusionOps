import React from "react";
import { THEME as T, NETWORKS_AFF } from "../../constants";
import { Field } from "../ui/field";
import { InputField as Inp } from "../ui/input-field";

export function StepTracking({ c, u }) {
    const hasValidEmbed = c.formEmbed?.trim() && /<(script|div|iframe)/i.test(c.formEmbed);
    const embedWarning = c.formEmbed?.trim() && !hasValidEmbed;
    const hasAid = !!c.aid?.trim();

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 24 }}>📊</div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Tracking & Conversion</h2>
            </div>

            {/* Google Ads — Layer 1 */}
            <div style={{ padding: 12, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: T.muted }}>Layer 1: Google Ads Conversion</div>
                <Field label="Google Ads Conversion ID"><Inp value={c.conversionId} onChange={v => u("conversionId", v)} placeholder="AW-123456789" /></Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Field label="form_start Label (Secondary)"><Inp value={c.formStartLabel} onChange={v => u("formStartLabel", v)} placeholder="AbCdEfGhIjK" /></Field>
                    <Field label="form_submit Label (Primary)"><Inp value={c.formSubmitLabel} onChange={v => u("formSubmitLabel", v)} placeholder="XyZaBcDeFgH" /></Field>
                </div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>Only gtag.js — no GTM, no GA4. Easy to swap per account.</div>
            </div>

            {/* Custom Pixel — Layer 2 (automatic, no config needed) */}
            <div style={{ padding: 12, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: T.muted }}>Layer 2: First-Party Pixel</div>
                <div style={{ fontSize: 10, color: T.muted }}>Auto-configured. Sends events to t.&#123;domain&#125;/e via sendBeacon. No setup needed.</div>
            </div>

            {/* Voluum — Layer 3 */}
            <div style={{ padding: 12, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: T.muted }}>Layer 3: Voluum (Click Tracking + S2S Postback)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Field label="Voluum Pixel ID"><Inp value={c.voluumId} onChange={v => u("voluumId", v)} placeholder="v-id-xxxx" /></Field>
                    <Field label="Voluum Domain"><Inp value={c.voluumDomain} onChange={v => u("voluumDomain", v)} placeholder="trk.domain.com" /></Field>
                </div>
            </div>

            {/* LeadsGate / Affiliate Form */}
            <div style={{ padding: 12, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: T.muted }}>LeadsGate Form</div>
                <Field label="LeadsGate AID" help="Auto-generates form embed with tracking callbacks">
                    <Inp value={c.aid} onChange={v => u("aid", v)} placeholder="14881" />
                </Field>
                {hasAid && <div style={{ fontSize: 10, color: "#22c55e", marginTop: 4 }}>Auto-embed with onFormLoad, onStepChange, onSubmit, onSuccess callbacks</div>}
                <Field label="Affiliate Network">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {NETWORKS_AFF.map(n => (
                            <button key={n} onClick={() => u("network", n)} style={{
                                padding: "7px 14px", background: c.network === n ? T.primaryGlow : T.input,
                                border: `2px solid ${c.network === n ? T.primary : T.border}`,
                                borderRadius: 6, cursor: "pointer", color: T.text, fontSize: 11, fontWeight: 600,
                            }}>{n}</button>
                        ))}
                    </div>
                </Field>
            </div>

            {/* Redirect URL */}
            <Field label="Redirect URL" help="Where users go after clicking CTA (if no AID)"><Inp value={c.redirectUrl} onChange={v => u("redirectUrl", v)} placeholder="https://offers.leadsgate.com/..." /></Field>

            {/* Form Embed Code (Advanced) - Always visible for custom configurations */}
            <Field label="Form Embed Code (Advanced)" help="Raw embed code — tracking callbacks NOT auto-added">
                <textarea
                    value={c.formEmbed || ""}
                    placeholder={`<script src="https://forms.leadsgate.com/form/embed/${c.aid || "14881"}"></script>
<div id="leadsgate-form-container"></div>

<script>
const _lg_form_init_ = {
    aid: "${c.aid || "14881"}",
    template: "fresh",
    hooks: {
        onFormLoad: function () {
            console.log("Form loaded");
        },
        onStepChange: function (data) {
            // console.log("Step:", data.step);
        },
        onSubmit: function () {
            console.log("Form submitted");
        },
        onLeadSold: function (data) {
            console.log("Lead sold:", data.leadId, data.price);
        },
        onLeadRejected: function (data) {
            console.log("Lead rejected:", data.leadId);
        },
        onLeadFinished: function (data) {
            console.log("Lead finished:", data.leadId, data.price);
        }
    }
};
</script>`}
                    onChange={e => u("formEmbed", e.target.value)}
                    style={{
                        width: "100%", minHeight: 120, padding: "10px 12px",
                        background: T.input, border: `1px solid ${embedWarning ? T.danger : T.border}`,
                        borderRadius: 8, color: T.text, fontSize: 11, fontFamily: "monospace",
                        resize: "vertical",
                    }}
                />
                {embedWarning && <div style={{ fontSize: 10, color: T.danger, marginTop: 4 }}>Embed should contain &lt;script&gt;, &lt;div&gt;, or &lt;iframe&gt; tags</div>}
            </Field>
        </>
    );
}

