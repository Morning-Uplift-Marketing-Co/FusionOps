import { Component } from "react";
import { THEME as T } from "../constants";
import { logError } from "./ErrorLog";

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught:", error, errorInfo);
        logError(error, { severity: "critical", componentStack: errorInfo?.componentStack });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    height: "100vh", background: T.bg, color: T.text,
                    fontFamily: "'DM Sans',system-ui,sans-serif",
                }}>
                    <div style={{ textAlign: "center", maxWidth: 480, padding: 32 }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
                        <p style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.6 }}>
                            An unexpected error occurred. Please reload the page to continue.
                        </p>
                        <div style={{
                            background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
                            padding: "12px 16px", marginBottom: 20, fontSize: 12, color: T.danger,
                            textAlign: "left", fontFamily: "'JetBrains Mono',monospace", wordBreak: "break-word",
                        }}>
                            {this.state.error?.message || "Unknown error"}
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: T.grad, color: "#fff", border: "none", borderRadius: 8,
                                padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                            }}
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
