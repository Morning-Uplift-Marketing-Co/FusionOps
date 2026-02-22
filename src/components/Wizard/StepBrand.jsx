import React, { useState, useEffect } from "react";
import { THEME as T } from "../../constants";
import { Field } from "../ui/field";
import { InputField as Inp } from "../ui/input-field";
import { getTemplateById, DEFAULT_TEMPLATE_ID, getAllTemplates } from "./template-utils";
import { getAllTemplatesAsync } from "../../utils/template-registry";

export function StepBrand({ c, u }) {
    const selectedTemplate = getTemplateById(c.templateId || DEFAULT_TEMPLATE_ID);
    const [templates, setTemplates] = useState(getAllTemplates());

    useEffect(() => {
        getAllTemplatesAsync().then(setTemplates);
    }, []);

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 24 }}>🏢</div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Brand Information</h2>
            </div>

            <Field label="Template" req help="Select the landing page architecture">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {templates.map(tpl => {
                        const active = (c.templateId || DEFAULT_TEMPLATE_ID) === tpl.id;
                        return (
                            <button key={tpl.id} onClick={() => u("templateId", tpl.id)} style={{
                                padding: "10px 12px",
                                background: active ? T.primaryGlow : T.input,
                                border: `2px solid ${active ? T.primary : T.border}`,
                                borderRadius: 8,
                                cursor: "pointer",
                                textAlign: "left",
                                color: T.text,
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700 }}>{tpl.name}</div>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: active ? "#fff" : T.muted, background: active ? T.primary : T.card2, border: `1px solid ${active ? T.primary : T.border}`, padding: "2px 6px", borderRadius: 999 }}>{tpl.badge}</span>
                                </div>
                                <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>{tpl.description}</div>
                            </button>
                        );
                    })}
                </div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>Selected: <b style={{ color: T.text }}>{selectedTemplate?.name}</b></div>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Brand Name" req help="e.g. LoanBridge"><Inp value={c.brand} onChange={v => u("brand", v)} placeholder="LoanBridge" /></Field>
                <Field label="Domain" req help="e.g. loanbridge.com"><Inp value={c.domain} onChange={v => u("domain", v)} placeholder="loanbridge.com" /></Field>
            </div>
            <Field label="Tagline"><Inp value={c.tagline} onChange={v => u("tagline", v)} placeholder="Fast. Simple. Trusted." /></Field>
            <Field label="Compliance Email"><Inp value={c.email} onChange={v => u("email", v)} placeholder="support@loanbridge.com" /></Field>
        </>
    );
}

