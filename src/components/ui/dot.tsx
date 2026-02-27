import * as React from "react";

interface DotProps {
    c: string;
    label?: string;
}

export function Dot({ c, label }: DotProps) {
    return (
        <span style={{ fontSize: 11, color: c, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0 }} />
            {label}
        </span>
    );
}
