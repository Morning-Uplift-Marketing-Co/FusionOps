import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { uid, now } from "../utils";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
    { id: "backlog",     label: "Backlog",     icon: "📋", color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
    { id: "todo",        label: "Todo",        icon: "🔵", color: "#3b82f6", bg: "rgba(59,130,246,0.10)" },
    { id: "in_progress", label: "In Progress", icon: "🟡", color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
    { id: "review",      label: "Review",      icon: "🟣", color: "#8b5cf6", bg: "rgba(139,92,246,0.10)" },
    { id: "done",        label: "Done",        icon: "✅", color: "#10b981", bg: "rgba(16,185,129,0.10)" },
];

const PRIORITIES = [
    { id: "urgent", label: "Urgent", icon: "🔴", color: "#dc2626" },
    { id: "high",   label: "High",   icon: "🟠", color: "#f97316" },
    { id: "medium", label: "Medium", icon: "🟡", color: "#f59e0b" },
    { id: "low",    label: "Low",    icon: "⚪", color: "#6b7280" },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.id, s]));
const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map(p => [p.id, p]));

function isOverdue(due_date) {
    if (!due_date) return false;
    return new Date(due_date) < new Date(new Date().toDateString());
}

function formatDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Task Detail Modal ────────────────────────────────────────────────────────

function TaskModal({ task, sites, onSave, onClose }) {
    const isNew = !task?.id;
    const [form, setForm] = useState({
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        assignee_name: "",
        site_id: null,
        due_date: "",
        tags: [],
        ...task,
    });
    const [tagInput, setTagInput] = useState("");

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const addTag = () => {
        const t = tagInput.trim();
        if (t && !form.tags.includes(t)) {
            set("tags", [...form.tags, t]);
        }
        setTagInput("");
    };

    const removeTag = (tag) => set("tags", form.tags.filter(t => t !== tag));

    const handleSave = () => {
        if (!form.title.trim()) return;
        onSave({
            ...form,
            id: form.id || uid(),
            title: form.title.trim(),
            created_at: form.created_at || now(),
            updated_at: now(),
        });
        onClose();
    };

    const inputStyle = {
        width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
        border: "1px solid hsl(var(--border))", background: "hsl(var(--background))",
        color: "hsl(var(--foreground))", outline: "none", boxSizing: "border-box",
    };

    const labelStyle = {
        fontSize: 12, fontWeight: 600, color: "hsl(var(--muted-foreground))",
        textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, display: "block",
    };

    return createPortal(
        <div
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: "fixed", inset: 0, zIndex: 9999,
                background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 24,
            }}
        >
            <div style={{
                background: "hsl(var(--card))", borderRadius: 16,
                border: "1px solid hsl(var(--border))",
                width: "100%", maxWidth: 560, maxHeight: "90vh",
                display: "flex", flexDirection: "column",
                boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
            }}>
                {/* Header */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "18px 22px", borderBottom: "1px solid hsl(var(--border))",
                }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(var(--foreground))" }}>
                        {isNew ? "✅ New Task" : "✏️ Edit Task"}
                    </div>
                    <button onClick={onClose} style={{
                        width: 28, height: 28, borderRadius: "50%", border: "none",
                        background: "hsl(var(--border))", cursor: "pointer", fontSize: 13,
                        color: "hsl(var(--muted-foreground))", display: "flex",
                        alignItems: "center", justifyContent: "center",
                    }}>✕</button>
                </div>

                {/* Body */}
                <div style={{ overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Title */}
                    <div>
                        <label style={labelStyle}>Title *</label>
                        <input
                            value={form.title} onChange={e => set("title", e.target.value)}
                            placeholder="Task title..."
                            style={inputStyle}
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label style={labelStyle}>Description</label>
                        <textarea
                            value={form.description} onChange={e => set("description", e.target.value)}
                            placeholder="Add details..."
                            rows={3}
                            style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
                        />
                    </div>

                    {/* Status + Priority row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                            <label style={labelStyle}>Status</label>
                            <select value={form.status} onChange={e => set("status", e.target.value)} style={inputStyle}>
                                {STATUSES.map(s => (
                                    <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Priority</label>
                            <select value={form.priority} onChange={e => set("priority", e.target.value)} style={inputStyle}>
                                {PRIORITIES.map(p => (
                                    <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Assignee + Site row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                            <label style={labelStyle}>Assignee</label>
                            <input
                                value={form.assignee_name || ""} onChange={e => set("assignee_name", e.target.value)}
                                placeholder="Name..."
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Linked Site</label>
                            <select value={form.site_id || ""} onChange={e => set("site_id", e.target.value || null)} style={inputStyle}>
                                <option value="">— None —</option>
                                {(sites || []).map(s => (
                                    <option key={s.id} value={s.id}>{s.brand || s.domain || s.id}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Due Date */}
                    <div>
                        <label style={labelStyle}>Due Date</label>
                        <input
                            type="date" value={form.due_date || ""}
                            onChange={e => set("due_date", e.target.value || null)}
                            style={inputStyle}
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <label style={labelStyle}>Tags</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                            {form.tags.map(tag => (
                                <span key={tag} style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                                    background: "hsl(var(--muted))", color: "hsl(var(--foreground))",
                                    border: "1px solid hsl(var(--border))",
                                }}>
                                    {tag}
                                    <button onClick={() => removeTag(tag)} style={{
                                        background: "none", border: "none", cursor: "pointer",
                                        color: "hsl(var(--muted-foreground))", padding: 0, fontSize: 11,
                                    }}>✕</button>
                                </span>
                            ))}
                        </div>
                        <input
                            value={tagInput} onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                            placeholder="Type tag + Enter..."
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    display: "flex", justifyContent: "flex-end", gap: 10,
                    padding: "14px 22px", borderTop: "1px solid hsl(var(--border))",
                }}>
                    <button onClick={onClose} style={{
                        padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                        border: "1px solid hsl(var(--border))", background: "transparent",
                        color: "hsl(var(--muted-foreground))", cursor: "pointer",
                    }}>Cancel</button>
                    <button onClick={handleSave} disabled={!form.title.trim()} style={{
                        padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: "none", cursor: form.title.trim() ? "pointer" : "not-allowed",
                        background: form.title.trim()
                            ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                            : "hsl(var(--muted))",
                        color: form.title.trim() ? "#fff" : "hsl(var(--muted-foreground))",
                        boxShadow: form.title.trim() ? "0 4px 12px rgba(99,102,241,0.35)" : "none",
                    }}>
                        {isNew ? "Create Task" : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ── Task Card (Kanban) ───────────────────────────────────────────────────────

function TaskCard({ task, sites, onClick }) {
    const pri = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
    const site = sites?.find(s => s.id === task.site_id);
    const overdue = isOverdue(task.due_date);

    return (
        <div
            onClick={onClick}
            style={{
                background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                borderRadius: 10, padding: "12px 14px", cursor: "pointer",
                transition: "box-shadow .15s, transform .1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.12)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}
        >
            {/* Priority + Tags row */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
                    background: `${pri.color}20`, color: pri.color,
                    border: `1px solid ${pri.color}40`,
                }}>
                    {pri.icon} {pri.label}
                </span>
                {task.tags?.slice(0, 2).map(tag => (
                    <span key={tag} style={{
                        fontSize: 10, padding: "1px 5px", borderRadius: 4,
                        background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))",
                        border: "1px solid hsl(var(--border))",
                    }}>{tag}</span>
                ))}
            </div>

            {/* Title */}
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))", lineHeight: 1.4, marginBottom: 4 }}>
                {task.title}
            </div>

            {/* Description preview */}
            {task.description && (
                <div style={{
                    fontSize: 11, color: "hsl(var(--muted-foreground))", lineHeight: 1.4,
                    marginBottom: 8, overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                }}>
                    {task.description}
                </div>
            )}

            {/* Footer row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {site && (
                        <span style={{
                            fontSize: 10, padding: "2px 7px", borderRadius: 20,
                            background: "rgba(99,102,241,0.10)", color: "#6366f1",
                            border: "1px solid rgba(99,102,241,0.2)", fontWeight: 500,
                        }}>
                            {site.brand || site.domain}
                        </span>
                    )}
                    {task.assignee_name && (
                        <span style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: "#6366f1", color: "#fff",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 700,
                        }}>
                            {task.assignee_name.slice(0, 2).toUpperCase()}
                        </span>
                    )}
                </div>
                {task.due_date && (
                    <span style={{
                        fontSize: 10, fontWeight: 500,
                        color: overdue ? "#ef4444" : "hsl(var(--muted-foreground))",
                    }}>
                        {overdue ? "⚠ " : ""}{formatDate(task.due_date)}
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({ status, tasks, sites, onCardClick, onAddTask }) {
    const [quickAdd, setQuickAdd] = useState(false);
    const [quickTitle, setQuickTitle] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        if (quickAdd && inputRef.current) inputRef.current.focus();
    }, [quickAdd]);

    const handleQuickSave = () => {
        if (!quickTitle.trim()) { setQuickAdd(false); return; }
        onAddTask({ title: quickTitle.trim(), status: status.id, priority: "medium", tags: [], site_id: null });
        setQuickTitle("");
        setQuickAdd(false);
    };

    return (
        <div style={{
            minWidth: 220, width: 220, display: "flex", flexDirection: "column", flexShrink: 0,
        }}>
            {/* Column header */}
            <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderRadius: 10, marginBottom: 10,
                background: status.bg, border: `1px solid ${status.color}30`,
            }}>
                <span style={{ fontSize: 14 }}>{status.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: status.color, flex: 1 }}>{status.label}</span>
                <span style={{
                    fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
                    background: status.bg, color: status.color, border: `1px solid ${status.color}40`,
                }}>{tasks.length}</span>
            </div>

            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 40 }}>
                {tasks.map(t => (
                    <TaskCard key={t.id} task={t} sites={sites} onClick={() => onCardClick(t)} />
                ))}
            </div>

            {/* Quick add */}
            {quickAdd ? (
                <div style={{ marginTop: 8 }}>
                    <input
                        ref={inputRef}
                        value={quickTitle}
                        onChange={e => setQuickTitle(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter") handleQuickSave();
                            if (e.key === "Escape") { setQuickAdd(false); setQuickTitle(""); }
                        }}
                        placeholder="Task title…"
                        style={{
                            width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13,
                            border: "1px solid #6366f1", background: "hsl(var(--background))",
                            color: "hsl(var(--foreground))", outline: "none", boxSizing: "border-box",
                        }}
                    />
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button onClick={handleQuickSave} style={{
                            flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 12, fontWeight: 600,
                            border: "none", background: "#6366f1", color: "#fff", cursor: "pointer",
                        }}>Add</button>
                        <button onClick={() => { setQuickAdd(false); setQuickTitle(""); }} style={{
                            padding: "6px 10px", borderRadius: 7, fontSize: 12,
                            border: "1px solid hsl(var(--border))", background: "transparent",
                            color: "hsl(var(--muted-foreground))", cursor: "pointer",
                        }}>✕</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setQuickAdd(true)} style={{
                    marginTop: 8, width: "100%", padding: "7px 0", borderRadius: 8, fontSize: 12,
                    border: "1px dashed hsl(var(--border))", background: "transparent",
                    color: "hsl(var(--muted-foreground))", cursor: "pointer",
                    transition: "all .15s",
                }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.color = ""; }}
                >
                    + Add
                </button>
            )}
        </div>
    );
}

// ── List View ────────────────────────────────────────────────────────────────

function ListView({ tasks, sites, onCardClick, onDelete }) {
    const [sortKey, setSortKey] = useState("updated_at");
    const [sortDir, setSortDir] = useState(-1);
    const [selected, setSelected] = useState(new Set());

    const sorted = useMemo(() => {
        return [...tasks].sort((a, b) => {
            const va = a[sortKey] || "";
            const vb = b[sortKey] || "";
            return sortDir * (va < vb ? -1 : va > vb ? 1 : 0);
        });
    }, [tasks, sortKey, sortDir]);

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => -d);
        else { setSortKey(key); setSortDir(-1); }
    };

    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const th = (key, label) => (
        <th
            onClick={() => toggleSort(key)}
            style={{
                padding: "10px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                color: sortKey === key ? "#6366f1" : "hsl(var(--muted-foreground))",
                textAlign: "left", whiteSpace: "nowrap", userSelect: "none",
            }}
        >
            {label} {sortKey === key ? (sortDir === 1 ? "↑" : "↓") : ""}
        </th>
    );

    return (
        <div>
            {selected.size > 0 && (
                <div style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderRadius: 8, marginBottom: 10,
                    background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
                }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#6366f1" }}>{selected.size} selected</span>
                    <button
                        onClick={() => { selected.forEach(id => onDelete(id)); setSelected(new Set()); }}
                        style={{
                            padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                            border: "none", background: "#ef4444", color: "#fff", cursor: "pointer",
                        }}
                    >Delete</button>
                    <button
                        onClick={() => setSelected(new Set())}
                        style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 12,
                            border: "1px solid hsl(var(--border))", background: "transparent",
                            color: "hsl(var(--muted-foreground))", cursor: "pointer",
                        }}
                    >Clear</button>
                </div>
            )}
            <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--muted))" }}>
                            <th style={{ padding: "10px 14px", width: 32 }}>
                                <input type="checkbox"
                                    checked={selected.size === tasks.length && tasks.length > 0}
                                    onChange={e => setSelected(e.target.checked ? new Set(tasks.map(t => t.id)) : new Set())}
                                />
                            </th>
                            {th("priority", "Priority")}
                            {th("title", "Title")}
                            {th("status", "Status")}
                            {th("assignee_name", "Assignee")}
                            <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>Site</th>
                            {th("due_date", "Due")}
                            <th style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 && (
                            <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>No tasks</td></tr>
                        )}
                        {sorted.map(task => {
                            const pri = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                            const sts = STATUS_MAP[task.status] || STATUS_MAP.todo;
                            const site = sites?.find(s => s.id === task.site_id);
                            const overdue = isOverdue(task.due_date);
                            return (
                                <tr key={task.id} style={{
                                    borderBottom: "1px solid hsl(var(--border))",
                                    background: selected.has(task.id) ? "rgba(99,102,241,0.06)" : "transparent",
                                }}>
                                    <td style={{ padding: "10px 14px" }}>
                                        <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggleSelect(task.id)} />
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                                            background: `${pri.color}20`, color: pri.color,
                                            border: `1px solid ${pri.color}40`, whiteSpace: "nowrap",
                                        }}>{pri.icon} {pri.label}</span>
                                    </td>
                                    <td style={{ padding: "10px 14px", maxWidth: 240 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))", truncate: "ellipsis" }}>{task.title}</div>
                                        {task.tags?.length > 0 && (
                                            <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                                                {task.tags.slice(0, 3).map(tag => (
                                                    <span key={tag} style={{
                                                        fontSize: 9, padding: "1px 5px", borderRadius: 4,
                                                        background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))",
                                                    }}>{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                        <span style={{
                                            fontSize: 11, padding: "3px 8px", borderRadius: 6,
                                            background: sts.bg, color: sts.color,
                                            border: `1px solid ${sts.color}40`,
                                            whiteSpace: "nowrap",
                                        }}>{sts.icon} {sts.label}</span>
                                    </td>
                                    <td style={{ padding: "10px 14px", fontSize: 12, color: "hsl(var(--foreground))" }}>
                                        {task.assignee_name || "—"}
                                    </td>
                                    <td style={{ padding: "10px 14px", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                                        {site ? (site.brand || site.domain) : "—"}
                                    </td>
                                    <td style={{ padding: "10px 14px", fontSize: 12, whiteSpace: "nowrap",
                                        color: overdue ? "#ef4444" : "hsl(var(--muted-foreground))",
                                        fontWeight: overdue ? 600 : 400,
                                    }}>
                                        {task.due_date ? `${overdue ? "⚠ " : ""}${formatDate(task.due_date)}` : "—"}
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <button onClick={() => onCardClick(task)} style={{
                                                padding: "4px 10px", borderRadius: 6, fontSize: 11,
                                                border: "1px solid hsl(var(--border))", background: "transparent",
                                                color: "hsl(var(--foreground))", cursor: "pointer",
                                            }}>Edit</button>
                                            <button onClick={() => onDelete(task.id)} style={{
                                                padding: "4px 10px", borderRadius: 6, fontSize: 11,
                                                border: "1px solid rgba(239,68,68,0.3)", background: "transparent",
                                                color: "#ef4444", cursor: "pointer",
                                            }}>✕</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function TaskManager({ tasks = [], sites = [], addTask, updateTask, deleteTask, user }) {
    const [view, setView] = useState("kanban");
    const [modal, setModal] = useState(null); // null | "new" | task object
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterPriority, setFilterPriority] = useState("all");
    const [filterSite, setFilterSite] = useState("all");

    // Filtered tasks
    const filtered = useMemo(() => {
        return tasks.filter(t => {
            if (filterStatus !== "all" && t.status !== filterStatus) return false;
            if (filterPriority !== "all" && t.priority !== filterPriority) return false;
            if (filterSite !== "all" && t.site_id !== filterSite) return false;
            if (search) {
                const q = search.toLowerCase();
                return t.title.toLowerCase().includes(q)
                    || (t.description || "").toLowerCase().includes(q)
                    || (t.assignee_name || "").toLowerCase().includes(q)
                    || (t.tags || []).some(g => g.toLowerCase().includes(q));
            }
            return true;
        });
    }, [tasks, filterStatus, filterPriority, filterSite, search]);

    const handleSave = (taskData) => {
        if (tasks.find(t => t.id === taskData.id)) {
            updateTask(taskData);
        } else {
            addTask(taskData);
        }
    };

    const openNew = (defaultStatus = "todo") => {
        setModal({ status: defaultStatus, priority: "medium", tags: [], title: "", description: "" });
    };

    const selectStyle = {
        padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500,
        border: "1px solid hsl(var(--border))", background: "hsl(var(--background))",
        color: "hsl(var(--foreground))", cursor: "pointer", outline: "none",
    };

    // Unique site options from tasks + sites prop
    const siteOptions = useMemo(() => {
        const ids = new Set(tasks.map(t => t.site_id).filter(Boolean));
        return (sites || []).filter(s => ids.has(s.id) || ids.size === 0).slice(0, 30);
    }, [tasks, sites]);

    return (
        <div style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", color: "hsl(var(--foreground))" }}>
                        ✅ Tasks
                    </h1>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "hsl(var(--muted-foreground))" }}>
                        Manage and prioritize team tasks
                    </p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {/* View toggle */}
                    <div style={{
                        display: "flex", gap: 2, padding: 3,
                        background: "hsl(var(--muted))", borderRadius: 9,
                        border: "1px solid hsl(var(--border))",
                    }}>
                        {[{ id: "kanban", icon: "📋", label: "Kanban" }, { id: "list", icon: "☰", label: "List" }].map(v => (
                            <button key={v.id} onClick={() => setView(v.id)} style={{
                                padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                                border: "none", cursor: "pointer", transition: "all .15s",
                                background: view === v.id ? "hsl(var(--card))" : "transparent",
                                color: view === v.id ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                boxShadow: view === v.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                            }}>{v.icon} {v.label}</button>
                        ))}
                    </div>
                    <button onClick={() => openNew()} style={{
                        padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                        border: "none", cursor: "pointer",
                        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                        color: "#fff", boxShadow: "0 4px 12px rgba(99,102,241,0.35)",
                    }}>+ New Task</button>
                </div>
            </div>

            {/* Filter bar */}
            <div style={{
                display: "flex", gap: 10, alignItems: "center", marginBottom: 20,
                flexWrap: "wrap",
            }}>
                <div style={{ position: "relative", flex: "1 1 180px" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13 }}>🔍</span>
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search tasks..."
                        style={{
                            width: "100%", padding: "7px 10px 7px 30px", borderRadius: 8, fontSize: 13,
                            border: "1px solid hsl(var(--border))", background: "hsl(var(--background))",
                            color: "hsl(var(--foreground))", outline: "none", boxSizing: "border-box",
                        }}
                    />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
                    <option value="all">All Status</option>
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={selectStyle}>
                    <option value="all">All Priority</option>
                    {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                </select>
                <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={selectStyle}>
                    <option value="all">All Sites</option>
                    {siteOptions.map(s => <option key={s.id} value={s.id}>{s.brand || s.domain}</option>)}
                </select>
                {(search || filterStatus !== "all" || filterPriority !== "all" || filterSite !== "all") && (
                    <button onClick={() => { setSearch(""); setFilterStatus("all"); setFilterPriority("all"); setFilterSite("all"); }}
                        style={{
                            padding: "6px 12px", borderRadius: 8, fontSize: 12,
                            border: "1px solid hsl(var(--border))", background: "transparent",
                            color: "hsl(var(--muted-foreground))", cursor: "pointer",
                        }}>
                        Clear ✕
                    </button>
                )}
            </div>

            {/* Content */}
            {view === "kanban" ? (
                <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
                    {STATUSES.map(status => {
                        const colTasks = filtered.filter(t => t.status === status.id);
                        return (
                            <KanbanColumn
                                key={status.id}
                                status={status}
                                tasks={colTasks}
                                sites={sites}
                                onCardClick={task => setModal(task)}
                                onAddTask={t => addTask({ ...t, status: status.id })}
                            />
                        );
                    })}
                </div>
            ) : (
                <ListView
                    tasks={filtered}
                    sites={sites}
                    onCardClick={task => setModal(task)}
                    onDelete={deleteTask}
                />
            )}

            {/* Modal */}
            {modal !== null && (
                <TaskModal
                    task={modal}
                    sites={sites}
                    onSave={handleSave}
                    onClose={() => setModal(null)}
                />
            )}
        </div>
    );
}
