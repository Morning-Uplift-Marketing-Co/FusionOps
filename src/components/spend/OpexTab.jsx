import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORIES = ["proxy", "anti_detect", "tracking", "hosting", "domain", "payment", "other"];
const CAT_ICONS = { proxy: "🔒", anti_detect: "🌐", tracking: "📊", hosting: "🌐", domain: "🌐", payment: "💳", other: "📦" };

const MOCK = [
    { id: 1, category: "proxy", item_name: "NodeMaven", monthly_cost: 50, is_active: 1 },
    { id: 2, category: "proxy", item_name: "IPRoyal", monthly_cost: 30, is_active: 1 },
    { id: 3, category: "anti_detect", item_name: "Multilogin X", monthly_cost: 100, is_active: 1 },
    { id: 4, category: "anti_detect", item_name: "AdsPower", monthly_cost: 50, is_active: 1 },
    { id: 5, category: "tracking", item_name: "Voluum", monthly_cost: 99, is_active: 1 },
    { id: 6, category: "hosting", item_name: "Cloudflare Pro", monthly_cost: 20, is_active: 1 },
    { id: 7, category: "domain", item_name: "8 domains", monthly_cost: 10, is_active: 1 },
    { id: 8, category: "payment", item_name: "LendingCard sub", monthly_cost: 25, is_active: 1 },
];

export function OpexTab({ opexData, onSave }) {
    const [items, setItems] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newItem, setNewItem] = useState({ category: "proxy", item_name: "", monthly_cost: 0 });

    useEffect(() => { setItems(opexData?.length > 0 ? opexData : MOCK); }, [opexData]);

    const total = items.filter(i => i.is_active).reduce((s, i) => s + Number(i.monthly_cost), 0);

    const handleAdd = () => {
        if (!newItem.item_name) return;
        const item = { ...newItem, id: Date.now(), is_active: 1 };
        setItems(prev => [...prev, item]);
        setNewItem({ category: "proxy", item_name: "", monthly_cost: 0 });
        setShowAdd(false);
        onSave?.(item);
    };

    return (
        <div className="animate-[fadeIn_.3s_ease]">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-semibold">🏢 Operating Expenses</CardTitle>
                        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)} className="text-xs">+ Add Expense</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {showAdd && (
                        <div className="flex gap-2 mb-4 items-end p-3 rounded-lg bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))]">
                            <div className="flex-1">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Category</label>
                                <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                                    className="w-full mt-0.5 px-2 py-1.5 text-xs rounded bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c.replace('_', ' ')}</option>)}
                                </select>
                            </div>
                            <div className="flex-[2]">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Item Name</label>
                                <input value={newItem.item_name} onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))}
                                    className="w-full mt-0.5 px-2 py-1.5 text-xs rounded bg-[hsl(var(--background))] border border-[hsl(var(--border))]" placeholder="e.g. NodeMaven" />
                            </div>
                            <div className="w-24">
                                <label className="text-[10px] text-[hsl(var(--muted-foreground))]">Monthly $</label>
                                <input type="number" value={newItem.monthly_cost} onChange={e => setNewItem(p => ({ ...p, monthly_cost: parseFloat(e.target.value) || 0 }))}
                                    className="w-full mt-0.5 px-2 py-1.5 text-xs rounded bg-[hsl(var(--background))] border border-[hsl(var(--border))]" />
                            </div>
                            <Button size="sm" onClick={handleAdd} className="text-xs">Save</Button>
                        </div>
                    )}

                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-[hsl(var(--border))]">
                                {["Category", "Item", "Monthly", "Status"].map(h => (
                                    <th key={h} className="text-left py-2 px-3 text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(r => (
                                <tr key={r.id} className="border-b border-[hsl(var(--border))]/30 hover:bg-[hsl(var(--muted))]/30 transition">
                                    <td className="py-2.5 px-3">{CAT_ICONS[r.category] || "📦"} {r.category.replace('_', ' ')}</td>
                                    <td className="py-2.5 px-3 font-semibold">{r.item_name}</td>
                                    <td className="py-2.5 px-3 font-mono">{fmt(r.monthly_cost)}</td>
                                    <td className="py-2.5 px-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.is_active ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400'}`}>
                                            {r.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-[hsl(var(--border))] font-bold">
                                <td className="py-2.5 px-3">TOTAL OPEX</td>
                                <td className="py-2.5 px-3"></td>
                                <td className="py-2.5 px-3 font-mono text-base">{fmt(total)}</td>
                                <td className="py-2.5 px-3"></td>
                            </tr>
                        </tfoot>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
