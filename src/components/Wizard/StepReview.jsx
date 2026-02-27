import React, { useState, useMemo } from "react";
import { THEME as T, COLORS, LOAN_TYPES } from "../../constants";
import { hsl } from "../../utils";
import { generateAstroProjectByTemplate } from "../../utils/template-router";
import { getTemplateById } from "./template-utils";

export function StepReview({ c, building }) {
    const co = COLORS.find(x => x.id === c.colorId) || COLORS[0];
    const selectedTemplate = getTemplateById(c.templateId || "classic");
    const astroFiles = useMemo(() => {
        try { return Object.keys(generateAstroProjectByTemplate(c)); }
        catch (e) {
            console.warn("[Wizard] Failed to generate Astro files list:", e?.message || e);
            return [];
        }
    }, [c.templateId, c.brand, c.domain, c.colorId, c.fontId]);
    const [showTree, setShowTree] = useState(false);

    const rows = [
        ["Brand", c.brand], ["Domain", c.domain || "—"], ["Type", LOAN_TYPES.find(l => l.id === c.loanType)?.label],
        ["Template", selectedTemplate?.name || "Classic LP"],
        ["Range", `$${c.amountMin}–$${c.amountMax}`], ["APR", `${c.aprMin}%–${c.aprMax}%`],
        ["Colors", co.name], ["Ads ID", c.conversionId || "—"], ["AID", c.aid || "—"],
    ];

    // Build a tree structure from file paths
    const buildTree = (paths) => {
        const tree = {};
        for (const p of paths) {
            const parts = p.split("/");
            let node = tree;
            for (let i = 0; i < parts.length; i++) {
                const name = parts[i];
                if (i === parts.length - 1) {
                    node[name] = null; // leaf file
                } else {
                    if (!node[name]) node[name] = {};
                    node = node[name];
                }
            }
        }
        return tree;
    };

    const renderTree = (node, depth = 0) => {
        if (!node) return null;
        return Object.entries(node).sort(([a, av], [b, bv]) => {
            // Directories first
            if (av !== null && bv === null) return -1;
            if (av === null && bv !== null) return 1;
            return a.localeCompare(b);
        }).map(([name, children]) => {
            const isDir = children !== null;
            const ext = name.split(".").pop();
            const iconMap = { astro: "🟣", js: "🟡", mjs: "🟡", ts: "🔵", json: "📋", css: "🎨", md: "📄", env: "🔐" };
            const icon = isDir ? "📁" : (iconMap[ext] || "📄");
            return (
                <div key={name + depth}>
                    <div style={{ padding: "2px 0", paddingLeft: depth * 14, fontSize: 11, fontFamily: "monospace", color: isDir ? T.text : T.muted, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10 }}>{icon}</span>
                        <span style={{ fontWeight: isDir ? 600 : 400 }}>{name}</span>
                    </div>
                    {isDir && renderTree(children, depth + 1)}
                </div>
            );
        });
    };

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 24 }}>🔍</div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Review & Build</h2>
            </div>
            <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "10px 16px", fontWeight: 600, fontSize: 13, borderBottom: `1px solid ${T.border}` }}>Configuration</div>
                {rows.map(([l, v], i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none", fontSize: 12 }}>
                        <span style={{ color: T.muted }}>{l}</span><span style={{ fontWeight: 500 }}>{v}</span>
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {["p", "s", "a"].map(k => <div key={k} style={{ flex: 1, padding: "8px", borderRadius: 8, background: hsl(...co[k]), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>{k.toUpperCase()}</div>)}
            </div>

            {/* Astro Project File Tree */}
            <div style={{ background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                <button onClick={() => setShowTree(!showTree)} style={{
                    width: "100%", padding: "10px 16px", fontWeight: 600, fontSize: 13,
                    borderBottom: showTree ? `1px solid ${T.border}` : "none",
                    background: "transparent", border: "none", color: T.text,
                    cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                    <span>🚀 Astro Project ({astroFiles.length} files)</span>
                    <span style={{ fontSize: 10, color: T.muted }}>{showTree ? "▲" : "▼"}</span>
                </button>
                {showTree && (
                    <div style={{ padding: "8px 12px", maxHeight: 200, overflowY: "auto" }}>
                        {renderTree(buildTree(astroFiles))}
                    </div>
                )}
            </div>

            {building && <div style={{ textAlign: "center", padding: 12, background: T.primaryGlow, borderRadius: 8, color: T.primary, fontSize: 13, fontWeight: 600, animation: "pulse 1s infinite" }}>⚡ AI is crafting your site...</div>}
        </div>
    );
}

