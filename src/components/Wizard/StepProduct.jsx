import React from "react";
import { THEME as T, LOAN_TYPES } from "../../constants";
import { Field } from "../ui/field";
import { InputField as Inp } from "../ui/input-field";

const AMOUNT_PRESETS = [
    { min: 100, max: 5000, label: "$100–$5K" },
    { min: 500, max: 10000, label: "$500–$10K" },
    { min: 1000, max: 25000, label: "$1K–$25K" },
    { min: 1000, max: 50000, label: "$1K–$50K" },
    { min: 5000, max: 100000, label: "$5K–$100K" },
];

export function StepProduct({ c, u }) {
    const isPresetActive = (p) => c.amountMin === p.min && c.amountMax === p.max;

    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 24 }}>💳</div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Loan Product</h2>
            </div>
            <Field label="Loan Type" req>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                    {LOAN_TYPES.map(lt => (
                        <button key={lt.id} onClick={() => u("loanType", lt.id)} style={{
                            padding: "12px 8px", background: c.loanType === lt.id ? T.primaryGlow : T.input,
                            border: `2px solid ${c.loanType === lt.id ? T.primary : T.border}`,
                            borderRadius: 8, cursor: "pointer", color: T.text, textAlign: "center",
                        }}>
                            <div style={{ fontSize: 18 }}>{lt.icon}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{lt.label}</div>
                        </button>
                    ))}
                </div>
            </Field>

            <Field label="Loan Amount Range" req help="Choose a preset or enter custom values">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {AMOUNT_PRESETS.map(p => (
                        <button key={p.label} onClick={() => { u("amountMin", p.min); u("amountMax", p.max); }} style={{
                            padding: "6px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: "pointer",
                            background: isPresetActive(p) ? T.primary : T.input,
                            color: isPresetActive(p) ? "#fff" : T.text,
                            border: `1px solid ${isPresetActive(p) ? T.primary : T.border}`,
                        }}>{p.label}</button>
                    ))}
                </div>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Min ($)" req><Inp type="number" min={0} value={c.amountMin} onChange={v => u("amountMin", Math.max(0, +v))} /></Field>
                <Field label="Max ($)" req><Inp type="number" min={0} value={c.amountMax} onChange={v => u("amountMax", Math.max(0, +v))} /></Field>
                <Field label="APR Min (%)" req><Inp type="number" step="0.01" min={0} value={c.aprMin} onChange={v => u("aprMin", Math.max(0, +v))} /></Field>
                <Field label="APR Max (%)" req><Inp type="number" step="0.01" min={0} value={c.aprMax} onChange={v => u("aprMax", Math.max(0, +v))} /></Field>
            </div>
        </>
    );
}

