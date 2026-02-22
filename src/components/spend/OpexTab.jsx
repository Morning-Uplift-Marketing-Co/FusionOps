import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "../ui/table";
import { Button } from "../ui/button";

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORIES = ["proxy", "anti_detect", "tracking", "hosting", "domain", "payment", "other"];

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
        setItems(prev => [...prev, { ...newItem, id: Date.now(), is_active: 1 }]);
        setNewItem({ category: "proxy", item_name: "", monthly_cost: 0 });
        setShowAdd(false);
        onSave?.({ ...newItem, is_active: 1 });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Operating Expenses</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)} className="text-xs">+ Add Expense</Button>
                </div>
            </CardHeader>
            <CardContent>
                {showAdd && (
                    <div className="flex gap-2 mb-4 items-end p-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30">
                        <div className="flex-1">
                            <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Category</label>
                            <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm rounded-md bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                            </select>
                        </div>
                        <div className="flex-[2]">
                            <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Item Name</label>
                            <input value={newItem.item_name} onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm rounded-md bg-[hsl(var(--background))] border border-[hsl(var(--border))]" placeholder="e.g. NodeMaven" />
                        </div>
                        <div className="w-28">
                            <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Monthly $</label>
                            <input type="number" value={newItem.monthly_cost} onChange={e => setNewItem(p => ({ ...p, monthly_cost: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2 py-1.5 text-sm rounded-md bg-[hsl(var(--background))] border border-[hsl(var(--border))]" />
                        </div>
                        <Button size="sm" onClick={handleAdd}>Save</Button>
                    </div>
                )}

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Monthly</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(r => (
                            <TableRow key={r.id}>
                                <TableCell className="capitalize text-[hsl(var(--muted-foreground))]">{r.category.replace('_', ' ')}</TableCell>
                                <TableCell className="font-medium">{r.item_name}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(r.monthly_cost)}</TableCell>
                                <TableCell>
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400'
                                        }`}>{r.is_active ? 'Active' : 'Inactive'}</span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell className="font-bold">Total Opex</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right font-mono font-bold text-base">{fmt(total)}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </CardContent>
        </Card>
    );
}
