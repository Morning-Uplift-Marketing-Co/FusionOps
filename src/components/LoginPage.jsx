import { useState } from "react";

export function LoginPage({ onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPw, setShowPw] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!email || !password) { setError("Please enter email and password."); return; }
        setLoading(true); setError("");
        try {
            if (onLogin) await onLogin(email, password);
        } catch (err) {
            setError(err?.message || "Invalid email or password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
            background: "hsl(var(--background))", fontFamily: "'Inter', sans-serif",
            padding: "24px",
        }}>
            {/* Background grid pattern */}
            <div style={{
                position: "fixed", inset: 0, pointerEvents: "none",
                backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
                backgroundSize: "28px 28px", opacity: 0.4,
            }} />

            <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
                {/* Logo / Brand */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 52, height: 52, borderRadius: 14,
                        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                        marginBottom: 16, fontSize: 22,
                        boxShadow: "0 8px 24px rgba(99,102,241,0.35)",
                    }}>⚡</div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "hsl(var(--foreground))", letterSpacing: "-0.5px" }}>
                        FusionOps
                    </h1>
                    <p style={{ margin: "6px 0 0", fontSize: 14, color: "hsl(var(--muted-foreground))" }}>
                        Sign in to your workspace
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 16,
                    padding: "32px 28px",
                    boxShadow: "0 4px 32px rgba(0,0,0,0.12)",
                }}>
                    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        {/* Email */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                Email
                            </label>
                            <input
                                type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="admin@company.com"
                                autoComplete="email" autoFocus
                                style={{
                                    padding: "10px 14px", borderRadius: 8, fontSize: 14,
                                    border: "1px solid hsl(var(--border))",
                                    background: "hsl(var(--background))",
                                    color: "hsl(var(--foreground))",
                                    outline: "none", transition: "border-color .15s",
                                }}
                                onFocus={e => e.target.style.borderColor = "#6366f1"}
                                onBlur={e => e.target.style.borderColor = "hsl(var(--border))"}
                            />
                        </div>

                        {/* Password */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <label style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                    Password
                                </label>
                                <button type="button" onClick={() => setShowPw(p => !p)}
                                    style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                                    {showPw ? "Hide" : "Show"}
                                </button>
                            </div>
                            <input
                                type={showPw ? "text" : "password"} value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                style={{
                                    padding: "10px 14px", borderRadius: 8, fontSize: 14,
                                    border: "1px solid hsl(var(--border))",
                                    background: "hsl(var(--background))",
                                    color: "hsl(var(--foreground))",
                                    outline: "none", transition: "border-color .15s",
                                }}
                                onFocus={e => e.target.style.borderColor = "#6366f1"}
                                onBlur={e => e.target.style.borderColor = "hsl(var(--border))"}
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                padding: "10px 14px", borderRadius: 8, fontSize: 13,
                                background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)",
                                color: "#dc2626", display: "flex", alignItems: "center", gap: 8,
                            }}>
                                <span>⚠</span> {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button type="submit" disabled={loading}
                            style={{
                                padding: "11px 0", borderRadius: 8, fontSize: 14, fontWeight: 600,
                                background: loading ? "hsl(var(--muted))" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                                color: loading ? "hsl(var(--muted-foreground))" : "#fff",
                                border: "none", cursor: loading ? "not-allowed" : "pointer",
                                transition: "opacity .15s", marginTop: 4,
                                boxShadow: loading ? "none" : "0 4px 14px rgba(99,102,241,0.4)",
                            }}>
                            {loading ? "Signing in…" : "Sign in"}
                        </button>
                    </form>
                </div>

                {/* Role hint (demo) */}
                <div style={{
                    marginTop: 20, padding: "12px 16px", borderRadius: 10,
                    background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))",
                    fontSize: 12, color: "hsl(var(--muted-foreground))", textAlign: "center",
                }}>
                    <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>Demo accounts</span>
                    <div style={{ marginTop: 6, display: "flex", gap: 16, justifyContent: "center" }}>
                        <span>👑 admin@fusionops.co · <code style={{ fontFamily: "monospace" }}>admin123</code></span>
                        <span>👤 staff@fusionops.co · <code style={{ fontFamily: "monospace" }}>staff123</code></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
