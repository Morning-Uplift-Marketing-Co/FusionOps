import * as React from "react";

interface MockPhoneProps {
    children?: React.ReactNode;
    style?: React.CSSProperties;
}

export function MockPhone({ children, style }: MockPhoneProps) {
    return (
        <div style={{
            width: 280, height: 560, background: "#111", borderRadius: 36, padding: 10,
            border: "6px solid #222", boxShadow: "0 24px 48px rgba(0,0,0,.4)", position: "relative",
            overflow: "hidden", ...style
        }}>
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 100, height: 20, background: "#222", borderBottomLeftRadius: 12, borderBottomRightRadius: 12, zIndex: 10 }} />
            <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: 28, overflow: "hidden" }}>
                {children}
            </div>
        </div>
    );
}
