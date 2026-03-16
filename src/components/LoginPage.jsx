import React, { useState } from "react";
import { THEME as T } from "../constants";

export function LoginPage({ onLogin, loading: extLoading }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const busy = loading || extLoading;

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const result = await onLogin(email, password);
            if (!result?.ok) {
                setError(result?.error || "Login failed");
            }
        } catch (err) {
            setError(err.message || "Unexpected error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "hsl(var(--background))",
                padding: 24,
            }}
        >
            {/* Card */}
            <div
                style={{
                    width: "100%",
                    maxWidth: 420,
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 20,
                    padding: "40px 36px",
                    boxShadow: "0 20px 60px rgba(0,0,0,.15)",
                }}
            >
                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: 14,
                            background: T.grad,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 24,
                            marginBottom: 12,
                        }}
                    >
                        ⚡
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                        FusionOps 3.0
                    </div>
                    <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                        Sign in to your workspace
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Email */}
                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "hsl(var(--muted-foreground))",
                                marginBottom: 5,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            required
                            autoComplete="email"
                            disabled={busy}
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                borderRadius: 10,
                                border: "1.5px solid hsl(var(--border))",
                                background: "hsl(var(--background))",
                                color: "hsl(var(--foreground))",
                                fontSize: 14,
                                boxSizing: "border-box",
                                outline: "none",
                                transition: "border-color .15s",
                            }}
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "hsl(var(--muted-foreground))",
                                marginBottom: 5,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            Password
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type={showPass ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                                disabled={busy}
                                style={{
                                    width: "100%",
                                    padding: "10px 40px 10px 14px",
                                    borderRadius: 10,
                                    border: "1.5px solid hsl(var(--border))",
                                    background: "hsl(var(--background))",
                                    color: "hsl(var(--foreground))",
                                    fontSize: 14,
                                    boxSizing: "border-box",
                                    outline: "none",
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass((p) => !p)}
                                style={{
                                    position: "absolute",
                                    right: 12,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    color: "hsl(var(--muted-foreground))",
                                    fontSize: 15,
                                    padding: 0,
                                    lineHeight: 1,
                                }}
                            >
                                {showPass ? "🙈" : "👁️"}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div
                            style={{
                                background: "#fef2f2",
                                border: "1px solid #fca5a5",
                                color: "#dc2626",
                                padding: "9px 13px",
                                borderRadius: 8,
                                fontSize: 13,
                            }}
                        >
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={busy}
                        style={{
                            padding: "11px 0",
                            borderRadius: 10,
                            border: "none",
                            background: busy ? "hsl(var(--muted))" : T.grad,
                            color: "white",
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: busy ? "not-allowed" : "pointer",
                            transition: "opacity .15s",
                            marginTop: 4,
                        }}
                    >
                        {loading ? "Signing in…" : "Sign In"}
                    </button>
                </form>

                {/* Footer note */}
                <div
                    style={{
                        marginTop: 22,
                        textAlign: "center",
                        fontSize: 11,
                        color: "hsl(var(--muted-foreground))",
                        lineHeight: 1.6,
                    }}
                >
                    FusionOps 3.0 — Internal Dashboard
                    <br />
                    Contact admin to create your account.
                </div>
            </div>
        </div>
    );
}
