import React, { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { THEME as T } from "../../constants";
import { Field } from "../ui/field";
import { InputField as Inp } from "../ui/input-field";
import { getTemplateById, DEFAULT_TEMPLATE_ID, getAllTemplates } from "./template-utils";
import { getAllTemplatesAsync, deleteTemplate } from "../../utils/template-registry";

export function StepBrand({ c, u }) {
    const selectedTemplate = getTemplateById(c.templateId || DEFAULT_TEMPLATE_ID);
    const [templates, setTemplates] = useState(getAllTemplates());
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        let active = true;
        const load = () => {
            getAllTemplatesAsync().then(res => {
                if (active) setTemplates(res);
            });
        };

        load();

        const onRefresh = () => load();
        window.addEventListener('lp-template-refresh', onRefresh);

        return () => {
            active = false;
            window.removeEventListener('lp-template-refresh', onRefresh);
        };
    }, []);

    const handleDelete = async (e, tpl) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${tpl.name}"?`)) return;

        setDeletingId(tpl.dbId);
        try {
            await deleteTemplate(tpl.dbId);
            const updated = await getAllTemplatesAsync();
            setTemplates(updated);
            if (c.templateId === tpl.id) {
                u("templateId", DEFAULT_TEMPLATE_ID);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏢</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Brand Information</h2>
                <p style={{ fontSize: 12, color: T.muted }}>Define your brand and choose a base template</p>
            </div>

            <Field label="Template Architecture" req help="Select the core layout and component set">
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginTop: 8
                }}>
                    {templates.map(tpl => {
                        const active = (c.templateId || DEFAULT_TEMPLATE_ID) === tpl.id;
                        const isCustom = tpl.source === 'api';
                        const isDeleting = deletingId === tpl.dbId;

                        return (
                            <div key={tpl.id} style={{ position: 'relative' }}>
                                <button
                                    onClick={() => u("templateId", tpl.id)}
                                    disabled={isDeleting}
                                    style={{
                                        width: '100%',
                                        padding: "14px 16px",
                                        background: active ? T.primaryGlow : T.card2,
                                        border: `1.5px solid ${active ? T.primary : T.border}`,
                                        borderRadius: 12,
                                        cursor: isDeleting ? "wait" : "pointer",
                                        textAlign: "left",
                                        color: T.text,
                                        transition: "all 0.2s ease",
                                        boxShadow: active ? `0 0 20px ${T.primary}20` : "none",
                                        position: 'relative',
                                        overflow: 'hidden',
                                        opacity: isDeleting ? 0.5 : 1,
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>{tpl.name}</div>
                                        <span style={{
                                            fontSize: 9,
                                            fontWeight: 800,
                                            color: active ? "#fff" : T.muted,
                                            background: active ? T.primary : T.card,
                                            padding: "2px 8px",
                                            borderRadius: 6,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.02em',
                                            border: `1px solid ${active ? 'transparent' : T.border}`
                                        }}>
                                            {tpl.badge || (isCustom ? 'Custom' : '')}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: T.dim, marginTop: 4, lineHeight: 1.4 }}>{tpl.description}</div>

                                    {active && (
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: T.primary
                                        }} />
                                    )}
                                </button>

                                {isCustom && !isDeleting && (
                                    <button
                                        onClick={(e) => handleDelete(e, tpl)}
                                        style={{
                                            position: 'absolute',
                                            top: -6,
                                            right: -6,
                                            width: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            background: T.danger,
                                            color: '#fff',
                                            border: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                            zIndex: 5,
                                            opacity: 0,
                                            transition: 'opacity 0.2s',
                                        }}
                                        className="delete-tpl-btn"
                                        title="Delete template"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                                <style>{`
                                    div:hover > .delete-tpl-btn { opacity: 1 !important; }
                                `}</style>
                            </div>
                        );
                    })}
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>
                    Selected Architecture: <b style={{ color: T.primary }}>{selectedTemplate?.name}</b>
                </div>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                <Field label="Brand Name" req help="Public brand name used in headlines"><Inp value={c.brand} onChange={v => u("brand", v)} placeholder="LoanBridge" /></Field>
                <Field label="Domain" req help="Active domain name"><Inp value={c.domain} onChange={v => u("domain", v)} placeholder="loanbridge.com" /></Field>
            </div>
            <Field label="Brand Tagline" help="Sub headline or trust message"><Inp value={c.tagline} onChange={v => u("tagline", v)} placeholder="Fast. Simple. Trusted." /></Field>
            <Field label="Compliance Email" help="Used in footer and privacy policy"><Inp value={c.email} onChange={v => u("email", v)} placeholder="support@loanbridge.com" /></Field>
        </>
    );
}

