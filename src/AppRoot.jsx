// CRITICAL: Import sentry FIRST — must init before any React rendering
import "./services/sentry";

import { StrictMode } from "react";
import * as Sentry from "@sentry/react";
import App from "./App.jsx";
import { ErrorBoundary as FallbackErrorBoundary } from "./components/ErrorBoundary.jsx";

const DSN = import.meta.env.VITE_SENTRY_DSN || "";

export default function AppRoot() {
    // If Sentry is configured, use its ErrorBoundary (reports to Sentry + shows fallback)
    // Otherwise fall back to our custom ErrorBoundary
    if (DSN) {
        return (
            <StrictMode>
                <Sentry.ErrorBoundary
                    fallback={({ error, resetError }) => (
                        <SentryFallback error={error} resetError={resetError} />
                    )}
                    showDialog={false}
                >
                    <App />
                </Sentry.ErrorBoundary>
            </StrictMode>
        );
    }

    return (
        <StrictMode>
            <FallbackErrorBoundary>
                <App />
            </FallbackErrorBoundary>
        </StrictMode>
    );
}

/** Sentry-aware fallback UI — matches existing ErrorBoundary style */
function SentryFallback({ error, resetError }) {
    const T = {
        bg: "#0a0a0a", text: "#e5e5e5", muted: "#a1a1aa", card: "#18181b",
        border: "#27272a", danger: "#ef4444", grad: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    };

    return (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100vh", background: T.bg, color: T.text,
            fontFamily: "'DM Sans',system-ui,sans-serif",
        }}>
            <div style={{ textAlign: "center", maxWidth: 520, padding: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
                <p style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.6 }}>
                    This error has been automatically reported to Sentry.
                </p>
                <div style={{
                    background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
                    padding: "12px 16px", marginBottom: 20, fontSize: 12, color: T.danger,
                    textAlign: "left", fontFamily: "'JetBrains Mono',monospace", wordBreak: "break-word",
                    maxHeight: 120, overflow: "auto",
                }}>
                    {error?.message || "Unknown error"}
                    {error?.stack && (
                        <div style={{ marginTop: 8, fontSize: 10, color: T.muted, whiteSpace: "pre-wrap" }}>
                            {error.stack.split("\n").slice(1, 4).join("\n")}
                        </div>
                    )}
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button
                        onClick={() => resetError?.()}
                        style={{
                            background: "transparent", color: T.muted, border: `1px solid ${T.border}`,
                            borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                        }}
                    >
                        Try Again
                    </button>
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
        </div>
    );
}
