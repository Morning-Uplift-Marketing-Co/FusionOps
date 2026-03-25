import React from "react";
import { THEME as T, LOAN_TYPES } from "../../constants";
import { Field } from "../ui/field";

export function StepProduct({ c, u }) {
    return (
        <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 24 }}>💳</div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Loan product</h2>
                <p style={{ fontSize: 12, color: T.muted, marginTop: 8, maxWidth: 420, margin: "8px auto 0" }}>
                    Choose the loan category for this landing page. Loan amount range and APR use sensible defaults; you can tune calculator ranges later in Design if your template supports it.
                </p>
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
        </>
    );
}
