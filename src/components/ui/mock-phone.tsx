import * as React from "react";

interface MockPhoneProps {
    children?: React.ReactNode;
    style?: React.CSSProperties;
}

export function MockPhone({ children, style }: MockPhoneProps) {
    return (
        <div style={{
            width: 440, height: 956, background: "#111", borderRadius: 52, padding: 14,
            border: "8px solid #222", boxShadow: "0 24px 48px rgba(0,0,0,.4)", position: "relative",
            overflow: "hidden", ...style
        }}>
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 140, height: 26, background: "#222", borderBottomLeftRadius: 16, borderBottomRightRadius: 16, zIndex: 10 }} />
            <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: 40, overflow: "hidden" }}>
                {children}
            </div>
        </div>
    );
}
