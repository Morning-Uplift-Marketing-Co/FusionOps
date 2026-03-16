import React, { useState, useEffect } from "react";
import { THEME as T } from "../constants";
import * as db from "../services/neon";
import { register, updatePassword } from "../services/auth";

/* ═══════════════════════════════════════════════════
   USER FORM MODAL
═══════════════════════════════════════════════════ */

function UserModal({ user: editUser, onSave, onClose }) {
    const isEdit = !!editUser;
    const [email, setEmail] = useState(editUser?.email || "");
    const [name, setName] = useState(editUser?.name || "");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState(editUser?.role || "employee");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleSave(e) {
        e.preventDefault();
        setError("");
        if (!isEdit && !password) { setError("Password is required"); return; }
        if (!isEdit && password.length < 8) { setError("Password must be at least 8 characters"); return; }
        setSaving(true);
        try {
            if (isEdit) {
                // Update role
                await db.updateUserRole(editUser.id, role);
                // Update password if provided
                if (password) {
                    const res = await updatePassword(editUser.id, password);
                    if (!res.ok) { setError(res.error); setSaving(false); return; }
                }
                onSave({ ...editUser, role, name });
            } else {
                const res = await register(email, password, role, name);
                if (!res.ok) { setError(res.error); setSaving(false); return; }
                onSave(res.user);
            }
        } catch (err) {
            setError(err.message || "Unexpected error");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(0,0,0,.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
        >
            <div
                style={{
                    background: "hsl(var(--card))",
                    borderRadius: 16,
                    border: "1px solid hsl(var(--border))",
                    padding: "28px 28px 24px",
                    width: "100%",
                    maxWidth: 400,
                    boxShadow: "0 20px 60px rgba(0,0,0,.25)",
                }}
            >
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}>
                    {isEdit ? "✏️ Edit User" : "➕ Add User"}
                </div>

                <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Email (read-only on edit) */}
                    <label style={labelStyle}>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required={!isEdit}
                            disabled={isEdit || saving}
                            placeholder="user@company.com"
                            style={inputStyle}
                        />
                    </label>

                    {/* Name */}
                    <label style={labelStyle}>
                        Name (optional)
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={saving}
                            placeholder="Display name"
                            style={inputStyle}
                        />
                    </label>

                    {/* Role */}
                    <label style={labelStyle}>
                        Role
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            disabled={saving}
                            style={{ ...inputStyle, appearance: "none" }}
                        >
                            <option value="employee">Employee</option>
                            <option value="admin">Admin</option>
                        </select>
                    </label>

                    {/* Password */}
                    <label style={labelStyle}>
                        {isEdit ? "New Password (leave blank to keep)" : "Password"}
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required={!isEdit}
                            disabled={saving}
                            placeholder={isEdit ? "••••••••" : "Min 8 characters"}
                            style={inputStyle}
                        />
                    </label>

                    {error && (
                        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 12 }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            style={{ ...btnStyle, background: "hsl(var(--secondary))", color: "hsl(var(--foreground))", flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            style={{ ...btnStyle, background: T.grad, color: "white", flex: 2 }}
                        >
                            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */

export function UserManager({ currentUser }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | "add" | {user object}
    const [delConfirm, setDelConfirm] = useState(null);
    const [msg, setMsg] = useState(null); // { text, type }

    function notify(text, type = "success") {
        setMsg({ text, type });
        setTimeout(() => setMsg(null), 3000);
    }

    useEffect(() => {
        load();
    }, []);

    async function load() {
        setLoading(true);
        try {
            const rows = await db.loadUsers();
            setUsers(rows);
        } catch (e) {
            notify("Failed to load users: " + e.message, "error");
        } finally {
            setLoading(false);
        }
    }

    async function handleSaved(savedUser) {
        setModal(null);
        notify(savedUser?.email ? `User ${savedUser.email} saved` : "User saved");
        await load();
    }

    async function toggleStatus(user) {
        try {
            await db.updateUserStatus(user.id, !user.is_active);
            notify(`${user.email} ${user.is_active ? "deactivated" : "activated"}`);
            setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
        } catch (e) {
            notify("Failed: " + e.message, "error");
        }
    }

    async function handleDelete(user) {
        if (user.id === currentUser?.id) { notify("Cannot delete your own account", "error"); return; }
        try {
            await db.deleteUser(user.id);
            notify(`${user.email} deleted`);
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
        } catch (e) {
            notify("Failed: " + e.message, "error");
        } finally {
            setDelConfirm(null);
        }
    }

    return (
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>👥 User Manager</h2>
                    <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 3 }}>
                        Create and manage team members
                    </div>
                </div>
                <button
                    onClick={() => setModal("add")}
                    style={{ ...btnStyle, background: T.grad, color: "white", padding: "9px 18px", fontSize: 13 }}
                >
                    + Add User
                </button>
            </div>

            {/* Toast */}
            {msg && (
                <div
                    style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        marginBottom: 14,
                        fontSize: 13,
                        background: msg.type === "error" ? "#fef2f2" : "#f0fdf4",
                        border: `1px solid ${msg.type === "error" ? "#fca5a5" : "#86efac"}`,
                        color: msg.type === "error" ? "#dc2626" : "#16a34a",
                    }}
                >
                    {msg.type === "error" ? "⚠️" : "✅"} {msg.text}
                </div>
            )}

            {/* Table */}
            <div
                style={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 14,
                    overflow: "hidden",
                }}
            >
                {/* Table header */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 120px 90px 90px 120px",
                        gap: 8,
                        padding: "11px 16px",
                        borderBottom: "1px solid hsl(var(--border))",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "hsl(var(--muted-foreground))",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                    }}
                >
                    <span>User</span>
                    <span>Role</span>
                    <span>Status</span>
                    <span>Last Login</span>
                    <span style={{ textAlign: "right" }}>Actions</span>
                </div>

                {loading ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "hsl(var(--muted-foreground))" }}>
                        Loading…
                    </div>
                ) : users.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
                        No users yet. Click "Add User" to create the first account.
                    </div>
                ) : (
                    users.map((u) => (
                        <div
                            key={u.id}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 120px 90px 90px 120px",
                                gap: 8,
                                alignItems: "center",
                                padding: "11px 16px",
                                borderBottom: "1px solid hsl(var(--border))",
                                fontSize: 13,
                                background: u.id === currentUser?.id ? `${T.primary}08` : "transparent",
                            }}
                        >
                            {/* User info */}
                            <div>
                                <div style={{ fontWeight: 600 }}>
                                    {u.name || u.email.split("@")[0]}
                                    {u.id === currentUser?.id && (
                                        <span style={{ fontSize: 10, marginLeft: 6, color: T.primary, background: `${T.primary}20`, padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>
                                            YOU
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{u.email}</div>
                            </div>

                            {/* Role badge */}
                            <div>
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        padding: "3px 9px",
                                        borderRadius: 6,
                                        background: u.role === "admin" ? `${T.primary}20` : "hsl(var(--secondary))",
                                        color: u.role === "admin" ? T.primary : "hsl(var(--muted-foreground))",
                                    }}
                                >
                                    {u.role === "admin" ? "🔑 Admin" : "👤 Employee"}
                                </span>
                            </div>

                            {/* Status */}
                            <div>
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: u.is_active ? "#16a34a" : "#dc2626",
                                    }}
                                >
                                    {u.is_active ? "● Active" : "○ Inactive"}
                                </span>
                            </div>

                            {/* Last login */}
                            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                                {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                                <button
                                    onClick={() => setModal(u)}
                                    title="Edit"
                                    style={iconBtn}
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => toggleStatus(u)}
                                    title={u.is_active ? "Deactivate" : "Activate"}
                                    style={iconBtn}
                                >
                                    {u.is_active ? "🚫" : "✅"}
                                </button>
                                {u.id !== currentUser?.id && (
                                    <button
                                        onClick={() => setDelConfirm(u)}
                                        title="Delete"
                                        style={{ ...iconBtn, color: "#dc2626" }}
                                    >
                                        🗑️
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* User Modal */}
            {modal && (
                <UserModal
                    user={modal === "add" ? null : modal}
                    onSave={handleSaved}
                    onClose={() => setModal(null)}
                />
            )}

            {/* Delete Confirm */}
            {delConfirm && (
                <div
                    onClick={(e) => { if (e.target === e.currentTarget) setDelConfirm(null); }}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        background: "rgba(0,0,0,.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <div
                        style={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 14,
                            padding: "24px 28px",
                            maxWidth: 360,
                            textAlign: "center",
                        }}
                    >
                        <div style={{ fontSize: 32, marginBottom: 10 }}>🗑️</div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Delete User?</div>
                        <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 20 }}>
                            This will permanently delete <strong>{delConfirm.email}</strong> and all their sessions.
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => setDelConfirm(null)}
                                style={{ ...btnStyle, background: "hsl(var(--secondary))", color: "hsl(var(--foreground))", flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(delConfirm)}
                                style={{ ...btnStyle, background: "#dc2626", color: "white", flex: 1 }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════ */

const labelStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    color: "hsl(var(--muted-foreground))",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
};

const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 9,
    border: "1.5px solid hsl(var(--border))",
    background: "hsl(var(--background))",
    color: "hsl(var(--foreground))",
    fontSize: 13,
    boxSizing: "border-box",
    outline: "none",
};

const btnStyle = {
    padding: "9px 16px",
    borderRadius: 9,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
};

const iconBtn = {
    padding: "4px 8px",
    borderRadius: 7,
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--secondary))",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
};
