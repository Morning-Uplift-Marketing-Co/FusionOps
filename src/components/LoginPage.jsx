import React, { useState, useEffect } from "react";
import { THEME as T } from "../constants";
import { checkUsersExist, seedFirstAdmin } from "../services/auth";

/* ═══════════════════════════════════════════════════
   FIRST-RUN SETUP FORM
═══════════════════════════════════════════════════ */

function SetupForm({ onSetupComplete }) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        if (password !== confirm) { setError("Passwords do not match"); return; }
        if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
        setSaving(true);
        try {
            const result = await seedFirstAdmin(email, password, name);
            if (result.ok) {
                onSetupComplete(email, password);
            } else {
                setError(result.error || "Setup failed");
            }
        } catch (err) {
            setError(err.message || "Unexpected error");
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={sectionNote}>
                🎉 Welcome! Create your <strong>admin account</strong> to get started.
            </div>

            <label style={labelStyle}>
                Your Name (optional)
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Display name" disabled={saving} style={inputStyle} />
            </label>

            <label style={labelStyle}>
                Admin Email
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="admin@company.com" required disabled={saving} style={inputStyle} autoComplete="email" />
            </label>

            <label style={labelStyle}>
                Password
                <div style={{ position: "relative" }}>
                    <input type={showPass ? "text" : "password"} value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min 8 characters" required disabled={saving}
                        style={{ ...inputStyle, paddingRight: 38 }} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                        style={eyeBtn}>{showPass ? "🙈" : "👁️"}</button>
                </div>
            </label>

            <label style={labelStyle}>
                Confirm Password
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••" required disabled={saving}
                    style={inputStyle} autoComplete="new-password" />
            </label>

            {error && <div style={errorBox}>⚠️ {error}</div>}

            <button type="submit" disabled={saving} style={{ ...submitBtn, background: saving ? "hsl(var(--muted))" : T.grad }}>
                {saving ? "Creating account…" : "Create Admin Account"}
            </button>
        </form>
    );
}

/* ═══════════════════════════════════════════════════
   MAIN LOGIN PAGE
═══════════════════════════════════════════════════ */

export function LoginPage({ onLogin, loading: extLoading }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    // First-run detection
    const [mode, setMode] = useState("check"); // check | login | setup
    const [setupDone, setSetupDone] = useState(false);

    const busy = loading || extLoading;

    useEffect(() => {
        checkUsersExist()
            .then(exists => setMode(exists ? "login" : "setup"))
            .catch(() => setMode("login")); // fallback to login on error
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const result = await onLogin(email, password);
            if (!result?.ok) setError(result?.error || "Login failed");
        } catch (err) {
            setError(err.message || "Unexpected error");
        } finally {
            setLoading(false);
        }
    }

    async function handleSetupComplete(adminEmail, adminPassword) {
        setSetupDone(true);
        setMode("login");
        setEmail(adminEmail);
        setPassword(adminPassword);
        // Auto-login after setup
        setLoading(true);
        try {
            const result = await onLogin(adminEmail, adminPassword);
            if (!result?.ok) {
                setError(result?.error || "Login failed after setup");
                setLoading(false);
            }
            // if ok, component unmounts — loading state doesn't matter
        } catch {
            setLoading(false);
        }
    }

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "hsl(var(--background))",
            padding: 24,
        }}>
            {/* Card */}
            <div style={{
                width: "100%",
                maxWidth: 420,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 20,
                padding: "40px 36px",
                boxShadow: "0 20px 60px rgba(0,0,0,.15)",
            }}>
                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div style={{
                        width: 52, height: 52, borderRadius: 14,
                        background: T.grad, display: "inline-flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: 24, marginBottom: 12,
                    }}>⚡</div>
                    <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>FusionOps 3.0</div>
                    <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                        {mode === "setup" ? "First-time setup" : "Sign in to your workspace"}
                    </div>
                </div>

                {/* Loading check */}
                {mode === "check" && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
                        Checking setup…
                    </div>
                )}

                {/* First-run setup */}
                {mode === "setup" && (
                    <SetupForm onSetupComplete={handleSetupComplete} />
                )}

                {/* Login form */}
                {mode === "login" && (
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {setupDone && (
                            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#16a34a", padding: "9px 13px", borderRadius: 8, fontSize: 13 }}>
                                ✅ Admin account created! Signing you in…
                            </div>
                        )}

                        <label style={labelStyle}>
                            Email
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="you@company.com" required autoComplete="email"
                                disabled={busy} style={inputStyle} />
                        </label>

                        <label style={labelStyle}>
                            Password
                            <div style={{ position: "relative" }}>
                                <input type={showPass ? "text" : "password"} value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••" required autoComplete="current-password"
                                    disabled={busy} style={{ ...inputStyle, paddingRight: 38 }} />
                                <button type="button" onClick={() => setShowPass(p => !p)}
                                    style={eyeBtn}>{showPass ? "🙈" : "👁️"}</button>
                            </div>
                        </label>

                        {error && <div style={errorBox}>⚠️ {error}</div>}

                        <button type="submit" disabled={busy}
                            style={{ ...submitBtn, background: busy ? "hsl(var(--muted))" : T.grad }}>
                            {loading ? "Signing in…" : "Sign In"}
                        </button>
                    </form>
                )}

                {/* Footer */}
                <div style={{ marginTop: 22, textAlign: "center", fontSize: 11, color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>
                    FusionOps 3.0 — Internal Dashboard
                    {mode === "login" && <><br />Contact admin to create your account.</>}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   SHARED STYLES
═══════════════════════════════════════════════════ */

const labelStyle = {
    display: "flex", flexDirection: "column", gap: 5,
    fontSize: 12, fontWeight: 600,
    color: "hsl(var(--muted-foreground))",
    textTransform: "uppercase", letterSpacing: "0.05em",
};

const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1.5px solid hsl(var(--border))",
    background: "hsl(var(--background))",
    color: "hsl(var(--foreground))", fontSize: 14,
    boxSizing: "border-box", outline: "none",
};

const eyeBtn = {
    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
    border: "none", background: "transparent", cursor: "pointer",
    color: "hsl(var(--muted-foreground))", fontSize: 15, padding: 0, lineHeight: 1,
};

const submitBtn = {
    padding: "11px 0", borderRadius: 10, border: "none",
    color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
    transition: "opacity .15s", marginTop: 4,
};

const errorBox = {
    background: "#fef2f2", border: "1px solid #fca5a5",
    color: "#dc2626", padding: "9px 13px", borderRadius: 8, fontSize: 13,
};

const sectionNote = {
    background: `${T.primary}10`, border: `1px solid ${T.primary}30`,
    color: "hsl(var(--foreground))", padding: "9px 13px",
    borderRadius: 8, fontSize: 13, lineHeight: 1.5,
};
