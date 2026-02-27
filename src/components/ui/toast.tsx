import * as React from "react";
import { THEME as T } from "../../constants";

interface ToastProps {
    msg: string;
    type?: "success" | "danger" | "warning" | string;
}

export function Toast({ msg, type }: ToastProps) {
    const c = type === "success" ? T.success : type === "danger" ? T.danger : type === "warning" ? T.warning : T.primary;
    return (
        <div style={{
            position: "fixed", top: 24, right: 24, padding: "12px 20px", background: T.card,
            border: `1px solid ${c}44`, borderLeft: `4px solid ${c}`, borderRadius: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,.4)", zIndex: 1000, color: "#fff", fontSize: 13,
            fontWeight: 600, animation: "slideIn .3s cubic-bezier(.17,.67,.83,.67)",
        }}>{msg}</div>
    );
}
