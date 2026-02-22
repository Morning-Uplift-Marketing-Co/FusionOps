import React, { useState, useMemo, useCallback } from "react";
import { THEME as T, COLORS, FONTS, RADIUS, LOAN_TYPES } from "../constants";
import { uid, now, hsl } from "../utils";
import { generateLP, makeThemeJson } from "../utils/lp-generator";
import { Dot } from "./ui/dot";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { InputField as Inp } from "./ui/input-field";
import { api } from "../services/api";

/* ─── Extracted to module level to avoid re-creation on every render ─── */
function VarCard({ variant, onBuild, onExport, showActions = true }) {
    const c = COLORS.find(x => x.id === variant.colorId) || COLORS[0];
    const f = FONTS.find(x => x.id === variant.fontId) || FONTS[0];
    return (
        <Card className="p-3 flex gap-3 items-center">
            <div className="w-11 h-11 rounded-[10px] flex items-center justify-center text-lg text-white font-bold shrink-0"
                style={{ background: hsl(...c.p) }}>{variant.brand?.[0]}</div>
            <div className="flex-1">
                <div className="text-[13px] font-bold">{variant.brand}</div>
                <div className="flex gap-2 mt-1">
                    <Dot c={hsl(...c.p)} label={c.name} />
                    <Dot c={T.primary} label={f.name} />
                </div>
            </div>
            {showActions && <div className="flex gap-1">
                <Button variant="ghost" onClick={() => onBuild(variant)} className="px-2 py-1 text-[10px] h-auto">Build</Button>
                <Button variant="ghost" onClick={() => onExport(variant)} className="px-2 py-1 text-[10px] h-auto">JSON</Button>
            </div>}
        </Card>
    );
}

export function VariantStudio({ notify, sites, addSite, registry, setRegistry, apiOk }) {
    const [v, setV] = useState({
        brand: "QuickLoan", amountMin: 500, amountMax: 5000,
        colorId: COLORS[0].id, fontId: FONTS[0].id, radius: RADIUS[2].id,
        loanType: "personal", layout: "hero-left",
    });
    const [batch, setBatch] = useState(5);
    const [previews, setPreviews] = useState([]);
    const [assets, setAssets] = useState({ logo: null, hero: null });
    const [loadingAsset, setLoadingAsset] = useState(null);

    const set = (k, val) => setV(p => ({ ...p, [k]: val }));

    const randomize = () => {
        const c = COLORS[Math.floor(Math.random() * COLORS.length)];
        const f = FONTS[Math.floor(Math.random() * FONTS.length)];
        const r = RADIUS[Math.floor(Math.random() * RADIUS.length)];
        setV(p => ({ ...p, colorId: c.id, fontId: f.id, radius: r.id }));
    };

    const saveToReg = (val) => {
        const item = { ...val, id: uid(), createdAt: now() };
        setRegistry(p => [item, ...p]);
        notify("Saved to Variant Registry");
    };

    const batchGenerate = () => {
        const items = Array.from({ length: batch }).map(() => ({
            ...v, id: uid(), brand: v.brand + " " + Math.floor(Math.random() * 99),
            colorId: COLORS[Math.floor(Math.random() * COLORS.length)].id,
            fontId: FONTS[Math.floor(Math.random() * FONTS.length)].id,
            createdAt: now(),
        }));
        setPreviews(items);
    };

    const createFromVar = (val) => {
        addSite({ ...val, status: "completed" });
        notify("Created site from variant");
    };

    const exportVar = (val) => {
        const json = makeThemeJson(val);
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = `variant-${val.id || "new"}.json`; a.click();
    };

    const genAsset = async (type) => {
        setLoadingAsset(type);
        try {
            const res = await api.post("/ai/generate-assets", { brand: v.brand, type });
            if (res.url) setAssets(p => ({ ...p, [type]: res.url }));
        } catch (e) { notify("Asset creation failed", "danger"); }
        setLoadingAsset(null);
    };

    const selectCls = "w-full px-2 py-2 rounded-md bg-[hsl(var(--input))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xs cursor-pointer outline-none";
    const sectionLabel = "text-[13px] font-bold text-[hsl(var(--muted-foreground))] mb-3 mt-6 uppercase tracking-[1px]";

    return (
        <div className="animate-[fadeIn_.3s_ease]">
            <h1 className="text-[22px] font-bold m-0 mb-4">🎨 Variant Studio</h1>
            <div className="grid grid-cols-2 gap-6">
                <Card className="p-6">
                    <h3 className="text-[15px] font-bold mb-4">Configuration</h3>
                    <div className="mb-3.5">
                        <label className="text-[11px] font-bold block mb-1.5">Brand Name</label>
                        <Inp value={v.brand} onChange={val => set("brand", val)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                        <div>
                            <label className="text-[11px] font-bold block mb-1.5">Color</label>
                            <select value={v.colorId} onChange={e => set("colorId", e.target.value)} className={selectCls}>
                                {COLORS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold block mb-1.5">Font</label>
                            <select value={v.fontId} onChange={e => set("fontId", e.target.value)} className={selectCls}>
                                {FONTS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 mb-5">
                        <Button onClick={randomize} variant="ghost" className="flex-1">🎲 Randomize</Button>
                        <Button onClick={() => saveToReg(v)} className="flex-1">💾 Save Variant</Button>
                    </div>
                    <hr className="border-none border-t border-[hsl(var(--border))] my-5" />
                    <h3 className="text-[15px] font-bold mb-4">⚡ Batch Generation</h3>
                    <div className="flex gap-2.5 items-center">
                        <Inp type="number" value={batch} onChange={val => setBatch(+val)} style={{ width: 60 }} />
                        <Button onClick={batchGenerate} className="flex-1">Generate Multi-Variants</Button>
                    </div>
                </Card>

                <div>
                    <div className={sectionLabel}>Registry ({registry.length})</div>
                    <div className="flex flex-col gap-2 max-h-[280px] overflow-auto pr-1">
                        {registry.length === 0
                            ? <div className="text-center p-10 border border-dashed border-[hsl(var(--border))] rounded-[10px] text-[hsl(var(--muted-foreground))] text-xs">No saved variants</div>
                            : registry.map(rv => <VarCard key={rv.id} variant={rv} onBuild={createFromVar} onExport={exportVar} />)}
                    </div>

                    <div className={sectionLabel}>✨ AI Asset Studio</div>
                    <div className="grid grid-cols-2 gap-3">
                        <Card className="p-3 text-center">
                            <div className="h-[100px] bg-[hsl(var(--input))] rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                                {assets.logo ? <img src={assets.logo} className="w-full h-full object-contain" alt="Logo" /> : <div className="text-2xl">🏢</div>}
                            </div>
                            <Button variant="ghost" onClick={() => genAsset("logo")} disabled={loadingAsset === "logo"} className="w-full text-[11px]">
                                {loadingAsset === "logo" ? "Generating..." : "Generate Logo"}
                            </Button>
                        </Card>
                        <Card className="p-3 text-center">
                            <div className="h-[100px] bg-[hsl(var(--input))] rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                                {assets.hero ? <img src={assets.hero} className="w-full h-full object-cover" alt="Hero" /> : <div className="text-2xl">🖼️</div>}
                            </div>
                            <Button variant="ghost" onClick={() => genAsset("hero")} disabled={loadingAsset === "hero"} className="w-full text-[11px]">
                                {loadingAsset === "hero" ? "Generating..." : "Generate Hero"}
                            </Button>
                        </Card>
                    </div>

                    <div className={sectionLabel}>Generated Batch</div>
                    <div className="flex flex-col gap-2">
                        {previews.length === 0
                            ? <div className="text-center p-10 border border-dashed border-[hsl(var(--border))] rounded-[10px] text-[hsl(var(--muted-foreground))] text-xs">Click generate to see themes</div>
                            : previews.map(pv => <VarCard key={pv.id} variant={pv} onBuild={createFromVar} onExport={exportVar} />)}
                    </div>
                </div>
            </div>
        </div>
    );
}
