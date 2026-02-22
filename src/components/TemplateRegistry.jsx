/**
 * Template Registry UI
 * Display and manage available landing page templates
 */

import React, { useState, useEffect } from "react";
import { THEME as T } from "../constants";
import { getAllTemplates, getTemplateById, resolveTemplateId } from "../utils/template-registry.js";

const TEMPLATE_CATEGORIES = {
    module: { label: "Module Templates", color: T.primary },
    legacy: { label: "Legacy Templates", color: "#f59e0b" },
};

export function TemplateRegistry({ selectedId, onSelect, readonly = false }) {
    const [templates, setTemplates] = useState([]);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        setTemplates(getAllTemplates());
    }, []);

    const filteredTemplates = templates.filter(t => {
        if (filter === "all") return true;
        return t.source === filter;
    });

    const selectedTemplate = selectedId ? getTemplateById(selectedId) : null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Template Registry</h3>
                    <p style={{ fontSize: 12, color: T.muted, margin: "4px 0 0" }}>
                        {templates.length} templates available
                    </p>
                </div>

                {/* Filter */}
                {!readonly && (
                    <div style={{ display: "flex", gap: 8 }}>
                        {["all", "module", "legacy"].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                style={{
                                    padding: "6px 12px",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: filter === f ? T.primary : T.card2,
                                    color: filter === f ? "#fff" : T.text,
                                    border: filter === f ? `1px solid ${T.primary}` : `1px solid ${T.border}`,
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    textTransform: "capitalize",
                                }}
                            >
                                {f === "all" ? "All" : f}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Templates Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {filteredTemplates.map(tpl => (
                    <TemplateCard
                        key={tpl.id}
                        template={tpl}
                        selected={selectedId === tpl.id}
                        onClick={() => !readonly && onSelect?.(tpl.id)}
                    />
                ))}
            </div>

            {/* Selected Template Info */}
            {selectedTemplate && (
                <div style={{
                    padding: 12,
                    background: T.card2,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>Selected Template</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {selectedTemplate.name}
                        {selectedTemplate.badge && (
                            <span style={{
                                marginLeft: 8,
                                fontSize: 10,
                                padding: "2px 8px",
                                background: T.primary,
                                color: "#fff",
                                borderRadius: 4,
                            }}>
                                {selectedTemplate.badge}
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
                        {selectedTemplate.description}
                    </div>
                </div>
            )}
        </div>
    );
}

function TemplateCard({ template, selected, onClick }) {
    const category = TEMPLATE_CATEGORIES[template.source];
    const hasClick = !!onClick;

    return (
        <div
            onClick={hasClick ? onClick : undefined}
            style={{
                padding: 14,
                background: selected ? `${T.primary}15` : T.card2,
                border: `2px solid ${selected ? T.primary : T.border}`,
                borderRadius: 10,
                cursor: hasClick ? "pointer" : "default",
                transition: "all 0.2s",
                ...(hasClick && {
                    ":hover": {
                        borderColor: T.primary,
                        boxShadow: `0 4px 12px ${T.primary}30`,
                    },
                }),
            }}
        >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                        {template.name}
                    </div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                        ID: <code style={{ background: T.input, padding: "2px 4px", borderRadius: 3 }}>{template.id}</code>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {template.badge && (
                        <span style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "3px 6px",
                            background: selected ? T.primary : T.card3,
                            color: selected ? "#fff" : T.muted,
                            border: `1px solid ${selected ? T.primary : T.border}`,
                            borderRadius: 4,
                        }}>
                            {template.badge}
                        </span>
                    )}
                    <span style={{
                        fontSize: 9,
                        fontWeight: 600,
                        padding: "3px 6px",
                        background: `${category?.color}15`,
                        color: category?.color,
                        borderRadius: 4,
                        textTransform: "uppercase",
                    }}>
                        {template.source}
                    </span>
                </div>
            </div>

            {/* Description */}
            <div style={{ fontSize: 11, color: T.dim, lineHeight: 1.4 }}>
                {template.description}
            </div>

            {/* Category */}
            {template.category && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: category?.color || T.primary,
                    }} />
                    <span style={{ fontSize: 10, color: T.muted }}>
                        {template.category}
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * Compact template selector for inline use
 */
export function TemplateSelector({ value, onChange, size = "md" }) {
    const templates = getAllTemplates();
    const selected = getTemplateById(value);

    const sizeStyles = {
        sm: { padding: "6px 10px", fontSize: 11 },
        md: { padding: "8px 12px", fontSize: 12 },
        lg: { padding: "10px 14px", fontSize: 13 },
    };

    const style = sizeStyles[size] || sizeStyles.md;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selected && (
                <div style={{ fontSize: 11, color: T.muted }}>
                    Selected: <b style={{ color: T.text }}>{selected.name}</b>
                </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {templates.map(tpl => (
                    <button
                        key={tpl.id}
                        onClick={() => onChange?.(tpl.id)}
                        style={{
                            ...style,
                            background: value === tpl.id ? `${T.primary}15` : T.input,
                            border: `1px solid ${value === tpl.id ? T.primary : T.border}`,
                            borderRadius: 6,
                            cursor: "pointer",
                            color: T.text,
                            textAlign: "left",
                            transition: "all 0.15s",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 600 }}>{tpl.name}</span>
                            {tpl.badge && (
                                <span style={{
                                    fontSize: 9,
                                    padding: "2px 5px",
                                    background: value === tpl.id ? T.primary : T.card3,
                                    color: value === tpl.id ? "#fff" : T.muted,
                                    borderRadius: 3,
                                    whiteSpace: "nowrap",
                                }}>
                                    {tpl.badge}
                                </span>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

/**
 * Template badge component
 */
export function TemplateBadge({ templateId, size = "sm" }) {
    const template = getTemplateById(templateId);
    if (!template) return null;

    const sizeStyles = {
        sm: { fontSize: 9, padding: "2px 6px" },
        md: { fontSize: 10, padding: "3px 8px" },
        lg: { fontSize: 11, padding: "4px 10px" },
    };

    const style = sizeStyles[size] || sizeStyles.sm;

    return (
        <span style={{
            ...style,
            fontWeight: 600,
            background: `${T.primary}15`,
            color: T.primary,
            border: `1px solid ${T.primary}40`,
            borderRadius: 4,
            whiteSpace: "nowrap",
        }}>
            {template.badge || template.name}
        </span>
    );
}
