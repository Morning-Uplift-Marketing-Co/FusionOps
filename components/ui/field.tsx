import * as React from "react";
import { THEME as T } from "../../constants";

interface FieldProps {
    label: string;
    req?: boolean;
    help?: string;
    children: React.ReactNode;
}

export function Field({ label, req, help, children }: FieldProps) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5, color: T.text }}>
                {label} {req && <span style={{ color: T.danger }}>*</span>}
            </label>
            {children}
            {help && <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>{help}</div>}
        </div>
    );
}
