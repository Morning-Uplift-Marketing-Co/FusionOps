import React, { useState, useMemo, useRef, useEffect } from "react";
import { THEME as T } from "../constants";

/* ═══════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════ */

const STATUSES = [
    { id: "backlog",     icon: "📋", label: "Backlog",     color: "#6b7280" },
    { id: "todo",        icon: "🔵", label: "Todo",        color: "#3b82f6" },
    { id: "in_progress", icon: "🟡", label: "In Progress", color: "#f59e0b" },
    { id: "review",      icon: "🟣", label: "Review",      color: "#8b5cf6" },
    { id: "done",        icon: "✅", label: "Done",        color: "#22c55e" },
];

const PRIORITIES = [
    { id: "urgent", icon: "🔴", label: "Urgent", color: "#dc2626" },
    { id: "high",   icon: "🟠", label: "High",   color: "#f97316" },
    { id: "medium", icon: "🟡", label: "Medium", color: "#f59e0b" },
    { id: "low",    icon: "⚪", label: "Low",    color: "#6b7280" },
];

const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

function getPriority(id) { return PRIORITIES.find(p => p.id === id) || PRIORITIES[2]; }
function getStatus(id)   { return STATUSES.find(s => s.id === id) || STATUSES[1]; }

function isOverdue(due_date) {
    if (!due_date) return false;
    return due_date < new Date().toISOString().slice(0, 10);
}
function isDueToday(due_date) {
    if (!due_date) return false;
    return due_date === new Date().toISOString().slice(0, 10);
}

/* ═══════════════════════════════════════════════════
   TASK DETAIL MODAL
═══════════════════════════════════════════════════ */

function TaskModal({ task, sites, users, onSave, onClose }) {
    const isNew = !task?.id;
    const [title, setTitle] = useState(task?.title || "");
    const [description, setDescription] = useState(task?.description || "");
    const [status, setStatus] = useState(task?.status || "todo");
    const [priority, setPriority] = useState(task?.priority || "medium");
    const [assigneeId, setAssigneeId] = useState(task?.assignee_id || "");
    const [siteId, setSiteId] = useState(task?.site_id || "");
    const [dueDate, setDueDate] = useState(task?.due_date || "");
    const [tags, setTags] = useState(task?.tags || []);
    const [tagInput, setTagInput] = useState("");
    const [saving, setSaving] = useState(false);

    function handleTagKey(e) {
        if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
            e.preventDefault();
            const tag = tagInput.trim().toLowerCase().replace(/,/g, "");
            if (tag && !tags.includes(tag)) setTags(prev => [...prev, tag]);
            setTagInput("");
        }
        if (e.key === "Backspace" && !tagInput && tags.length) {
            setTags(prev => prev.slice(0, -1));
        }
    }

    function handleSave(e) {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        const assignee = users.find(u => u.id === assigneeId);
        onSave({
            ...(task || {}),
            title: title.trim(),
            description: description.trim(),
            status,
            priority,
            assignee_id: assigneeId || null,
            assignee_name: assignee ? (assignee.name || assignee.email?.split("@")[0]) : (task?.assignee_name || null),
            site_id: siteId || null,
            due_date: dueDate || null,
            tags,
        });
    }

    return (
        <div
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: "fixed", inset: 0, zIndex: 9999,
                background: "rgba(0,0,0,.55)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
            }}
        >
            <div style={{
                background: "hsl(var(--card))", borderRadius: 18,
                border: "1px solid hsl(var(--border))",
                padding: "28px 28px 24px", width: "100%", maxWidth: 520,
                boxShadow: "0 24px 64px rgba(0,0,0,.3)",
                maxHeight: "90vh", overflowY: "auto",
            }}>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 20 }}>
                    {isNew ? "➕ New Task" : "✏️ Edit Task"}
                </div>

                <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Title */}
                    <label style={lbl}>
                        Title *
                        <input
                            value={title} onChange={e => setTitle(e.target.value)}
                            required autoFocus disabled={saving}
                            placeholder="What needs to be done?"
                            style={inp}
                        />
                    </label>

                    {/* Description */}
                    <label style={lbl}>
                        Description
                        <textarea
                            value={description} onChange={e => setDescription(e.target.value)}
                            disabled={saving} rows={3}
                            placeholder="Optional details..."
                            style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
                        />
                    </label>

                    {/* Status + Priority */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <label style={lbl}>
                            Status
                            <select value={status} onChange={e => setStatus(e.target.value)} disabled={saving} style={{ ...inp, appearance: "none" }}>
                                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                            </select>
                        </label>
                        <label style={lbl}>
                            Priority
                            <select value={priority} onChange={e => setPriority(e.target.value)} disabled={saving} style={{ ...inp, appearance: "none" }}>
                                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                            </select>
                        </label>
                    </div>

                    {/* Assignee + Due Date */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <label style={lbl}>
                            Assignee
                            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} disabled={saving} style={{ ...inp, appearance: "none" }}>
                                <option value="">— Unassigned —</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name || u.email?.split("@")[0]}</option>
                                ))}
                            </select>
                        </label>
                        <label style={lbl}>
                            Due Date
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={saving} style={inp} />
                        </label>
                    </div>

                    {/* Linked Site */}
                    <label style={lbl}>
                        Linked Site
                        <select value={siteId} onChange={e => setSiteId(e.target.value)} disabled={saving} style={{ ...inp, appearance: "none" }}>
                            <option value="">— None —</option>
                            {sites.map(s => (
                                <option key={s.id} value={s.id}>{s.brand || s.domain}</option>
                            ))}
                        </select>
                    </label>

                    {/* Tags */}
                    <label style={lbl}>
                        Tags
                        <div style={{
                            display: "flex", flexWrap: "wrap", gap: 5,
                            border: "1.5px solid hsl(var(--border))", borderRadius: 9,
                            background: "hsl(var(--background))",
                            padding: "6px 10px", minHeight: 38,
                        }}>
                            {tags.map(t => (
                                <span key={t} style={{
                                    background: `${T.primary}20`, color: T.primary,
                                    borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600,
                                    display: "flex", alignItems: "center", gap: 4,
                                }}>
                                    {t}
                                    <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))}
                                        style={{ border: "none", background: "none", cursor: "pointer", color: T.primary, fontSize: 12, padding: 0, lineHeight: 1 }}>
                                        ×
                                    </button>
                                </span>
                            ))}
                            <input
                                value={tagInput} onChange={e => setTagInput(e.target.value)}
                                onKeyDown={handleTagKey} disabled={saving}
                                placeholder={tags.length === 0 ? "Type tag + Enter" : ""}
                                style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, flex: 1, minWidth: 80, color: "hsl(var(--foreground))" }}
                            />
                        </div>
                    </label>

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button type="button" onClick={onClose} disabled={saving}
                            style={{ ...btnSec, flex: 1 }}>Cancel</button>
                        <button type="submit" disabled={saving || !title.trim()}
                            style={{ ...btnPri, flex: 2 }}>
                            {saving ? "Saving…" : isNew ? "Create Task" : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   TASK CARD (Kanban)
═══════════════════════════════════════════════════ */

function TaskCard({ task, onOpen, onStatusChange }) {
    const pri = getPriority(task.priority);
    const overdue = isOverdue(task.due_date);
    const dueToday = isDueToday(task.due_date);
    const site = task.site_id; // just show id — parent can resolve

    return (
        <div
            onClick={() => onOpen(task)}
            style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 10,
                padding: "11px 13px",
                cursor: "pointer",
                transition: "box-shadow .15s",
                userSelect: "none",
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.12)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
        >
            {/* Priority badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{
                    fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5,
                    background: `${pri.color}18`, color: pri.color, textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}>
                    {pri.icon} {pri.label}
                </span>
                {/* Quick status changer */}
                <select
                    value={task.status}
                    onChange={e => { e.stopPropagation(); onStatusChange(task, e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        fontSize: 10, border: "1px solid hsl(var(--border))",
                        borderRadius: 5, padding: "2px 4px",
                        background: "hsl(var(--background))",
                        color: "hsl(var(--muted-foreground))", cursor: "pointer",
                    }}
                >
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
            </div>

            {/* Title */}
            <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.4, marginBottom: 6 }}>
                {task.title}
            </div>

            {/* Description preview */}
            {task.description && (
                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 7, lineHeight: 1.4,
                    overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {task.description}
                </div>
            )}

            {/* Tags */}
            {task.tags?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 7 }}>
                    {task.tags.slice(0, 3).map(t => (
                        <span key={t} style={{ fontSize: 10, background: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", padding: "1px 6px", borderRadius: 4 }}>
                            {t}
                        </span>
                    ))}
                    {task.tags.length > 3 && <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>+{task.tags.length - 3}</span>}
                </div>
            )}

            {/* Footer: assignee + due date */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                {task.assignee_name ? (
                    <div style={{
                        width: 22, height: 22, borderRadius: "50%", background: T.grad,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 700, color: "white",
                        title: task.assignee_name,
                    }}>
                        {(task.assignee_name || "?")[0].toUpperCase()}
                    </div>
                ) : <div />}

                {task.due_date && (
                    <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: overdue ? "#dc2626" : dueToday ? "#f59e0b" : "hsl(var(--muted-foreground))",
                    }}>
                        {overdue ? "⚠️ " : dueToday ? "📅 " : ""}
                        {task.due_date}
                    </span>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   QUICK ADD (inline Kanban)
═══════════════════════════════════════════════════ */

function QuickAdd({ status, onAdd, onCancel }) {
    const [title, setTitle] = useState("");
    const ref = useRef(null);
    useEffect(() => { ref.current?.focus(); }, []);

    function handleKey(e) {
        if (e.key === "Enter" && title.trim()) { onAdd(title.trim()); }
        if (e.key === "Escape") { onCancel(); }
    }

    return (
        <div style={{ padding: "6px 4px" }}>
            <input
                ref={ref}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Task title… Enter to save, Esc to cancel"
                style={{
                    width: "100%", padding: "8px 10px", borderRadius: 8,
                    border: `1.5px solid ${T.primary}`,
                    background: "hsl(var(--background))",
                    color: "hsl(var(--foreground))", fontSize: 13,
                    boxSizing: "border-box", outline: "none",
                }}
            />
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   KANBAN VIEW
═══════════════════════════════════════════════════ */

function KanbanView({ filtered, onOpen, onStatusChange, onAdd }) {
    const [quickAdd, setQuickAdd] = useState(null); // status id

    return (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {STATUSES.map(col => {
                const colTasks = filtered
                    .filter(t => t.status === col.id)
                    .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

                return (
                    <div key={col.id} style={{
                        minWidth: 240, width: 240, flexShrink: 0,
                        background: "hsl(var(--secondary)/50%)",
                        borderRadius: 14,
                        border: "1px solid hsl(var(--border))",
                        display: "flex", flexDirection: "column",
                    }}>
                        {/* Column header */}
                        <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 12px 8px", borderBottom: "1px solid hsl(var(--border))",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
                                <span>{col.icon}</span>
                                <span>{col.label}</span>
                                <span style={{
                                    background: col.color + "20", color: col.color,
                                    borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700,
                                }}>
                                    {colTasks.length}
                                </span>
                            </div>
                        </div>

                        {/* Cards */}
                        <div style={{ flex: 1, padding: "8px", display: "flex", flexDirection: "column", gap: 7, overflowY: "auto", maxHeight: 600 }}>
                            {colTasks.map(t => (
                                <TaskCard key={t.id} task={t} onOpen={onOpen} onStatusChange={onStatusChange} />
                            ))}
                            {quickAdd === col.id && (
                                <QuickAdd
                                    status={col.id}
                                    onAdd={title => { onAdd(title, col.id); setQuickAdd(null); }}
                                    onCancel={() => setQuickAdd(null)}
                                />
                            )}
                        </div>

                        {/* + Add button */}
                        {quickAdd !== col.id && (
                            <button
                                onClick={() => setQuickAdd(col.id)}
                                style={{
                                    margin: "6px 8px 8px", padding: "6px 0", borderRadius: 8,
                                    border: "1.5px dashed hsl(var(--border))",
                                    background: "transparent", cursor: "pointer",
                                    fontSize: 12, color: "hsl(var(--muted-foreground))",
                                    fontWeight: 600,
                                }}
                            >
                                + Add
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   LIST VIEW
═══════════════════════════════════════════════════ */

function ListView({ filtered, onOpen, onDelete }) {
    const [selected, setSelected] = useState(new Set());
    const [sortKey, setSortKey] = useState("updated_at");
    const [sortDir, setSortDir] = useState("desc");

    function toggleSort(key) {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    }

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            let av = a[sortKey] ?? "", bv = b[sortKey] ?? "";
            if (sortKey === "priority") { av = priorityOrder[av] ?? 2; bv = priorityOrder[bv] ?? 2; }
            const res = av < bv ? -1 : av > bv ? 1 : 0;
            return sortDir === "asc" ? res : -res;
        });
    }, [filtered, sortKey, sortDir]);

    function toggleAll() {
        if (selected.size === sorted.length) setSelected(new Set());
        else setSelected(new Set(sorted.map(t => t.id)));
    }

    function SortBtn({ label, k }) {
        const active = sortKey === k;
        return (
            <button onClick={() => toggleSort(k)} style={{
                border: "none", background: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 11, color: active ? T.primary : "hsl(var(--muted-foreground))",
                textTransform: "uppercase", letterSpacing: "0.05em",
                display: "flex", alignItems: "center", gap: 3,
            }}>
                {label} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </button>
        );
    }

    return (
        <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 14, overflow: "hidden" }}>
            {/* Header */}
            <div style={{
                display: "grid", gridTemplateColumns: "32px 60px 1fr 100px 100px 80px 100px 80px",
                gap: 8, padding: "10px 14px",
                borderBottom: "1px solid hsl(var(--border))",
                fontSize: 11,
            }}>
                <input type="checkbox" checked={selected.size === sorted.length && sorted.length > 0}
                    onChange={toggleAll} style={{ cursor: "pointer" }} />
                <SortBtn label="Priority" k="priority" />
                <SortBtn label="Title" k="title" />
                <SortBtn label="Status" k="status" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Assignee</span>
                <SortBtn label="Site" k="site_id" />
                <SortBtn label="Due Date" k="due_date" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Actions</span>
            </div>

            {sorted.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
                    No tasks match your filters.
                </div>
            ) : sorted.map(task => {
                const pri = getPriority(task.priority);
                const st = getStatus(task.status);
                const overdue = isOverdue(task.due_date);
                const dueToday = isDueToday(task.due_date);
                return (
                    <div key={task.id} style={{
                        display: "grid", gridTemplateColumns: "32px 60px 1fr 100px 100px 80px 100px 80px",
                        gap: 8, alignItems: "center", padding: "10px 14px",
                        borderBottom: "1px solid hsl(var(--border))",
                        fontSize: 13,
                        background: selected.has(task.id) ? `${T.primary}08` : "transparent",
                    }}>
                        <input type="checkbox" checked={selected.has(task.id)}
                            onChange={() => setSelected(prev => { const s = new Set(prev); s.has(task.id) ? s.delete(task.id) : s.add(task.id); return s; })}
                            style={{ cursor: "pointer" }} />

                        <span style={{ fontSize: 10, fontWeight: 800, color: pri.color, background: `${pri.color}15`,
                            padding: "2px 6px", borderRadius: 5 }}>
                            {pri.icon} {pri.label}
                        </span>

                        <span style={{ fontWeight: 600, cursor: "pointer" }} onClick={() => onOpen(task)}>
                            {task.title}
                            {task.tags?.length > 0 && (
                                <span style={{ marginLeft: 6, fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
                                    {task.tags.slice(0, 2).map(t => `#${t}`).join(" ")}
                                </span>
                            )}
                        </span>

                        <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: `${st.color}15`,
                            padding: "2px 8px", borderRadius: 5 }}>
                            {st.icon} {st.label}
                        </span>

                        <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                            {task.assignee_name || "—"}
                        </span>

                        <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                            {task.site_id ? "🌐" : "—"}
                        </span>

                        <span style={{ fontSize: 11, fontWeight: 600,
                            color: overdue ? "#dc2626" : dueToday ? "#f59e0b" : "hsl(var(--muted-foreground))" }}>
                            {task.due_date || "—"}
                        </span>

                        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                            <button onClick={() => onOpen(task)} style={iconBtn} title="Edit">✏️</button>
                            <button onClick={() => onDelete(task.id)} style={{ ...iconBtn, color: "#dc2626" }} title="Delete">🗑️</button>
                        </div>
                    </div>
                );
            })}

            {/* Bulk actions */}
            {selected.size > 0 && (
                <div style={{ padding: "10px 14px", background: `${T.primary}10`, borderTop: "1px solid hsl(var(--border))",
                    display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
                    <button onClick={() => { selected.forEach(id => onDelete(id)); setSelected(new Set()); }}
                        style={{ ...btnSec, color: "#dc2626", fontSize: 12, padding: "4px 12px" }}>
                        🗑️ Delete Selected
                    </button>
                    <button onClick={() => setSelected(new Set())}
                        style={{ ...btnSec, fontSize: 12, padding: "4px 12px" }}>
                        Clear
                    </button>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */

export function TaskManager({ tasks, sites, users, addTask, updateTask, deleteTask, user, setPage, auditLog }) {
    const [view, setView] = useState("kanban"); // kanban | list
    const [modal, setModal] = useState(null);   // null | task object | "new"
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterPriority, setFilterPriority] = useState("all");
    const [filterSite, setFilterSite] = useState("all");
    const [filterAssignee, setFilterAssignee] = useState("all");
    const [delConfirm, setDelConfirm] = useState(null);

    // Filtered tasks
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return tasks.filter(t => {
            if (filterStatus !== "all" && t.status !== filterStatus) return false;
            if (filterPriority !== "all" && t.priority !== filterPriority) return false;
            if (filterSite !== "all" && t.site_id !== filterSite) return false;
            if (filterAssignee !== "all" && t.assignee_id !== filterAssignee) return false;
            if (q && !t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [tasks, search, filterStatus, filterPriority, filterSite, filterAssignee]);

    function handleSave(taskData) {
        const isNew = !taskData.id;
        if (isNew) {
            addTask(taskData);
            if (auditLog) auditLog(taskData.site_id || "global", "task_created",
                `Task: ${taskData.title}`, "", { priority: taskData.priority });
        } else {
            const prev = tasks.find(t => t.id === taskData.id);
            updateTask(taskData);
            if (auditLog && taskData.status === "done" && prev?.status !== "done") {
                auditLog(taskData.site_id || "global", "task_completed",
                    `Completed: ${taskData.title}`, "", { taskId: taskData.id });
            }
        }
        setModal(null);
    }

    function handleStatusChange(task, newStatus) {
        const updated = { ...task, status: newStatus };
        updateTask(updated);
        if (auditLog && newStatus === "done" && task.status !== "done") {
            auditLog(task.site_id || "global", "task_completed",
                `Completed: ${task.title}`, "", { taskId: task.id });
        }
    }

    function handleQuickAdd(title, status) {
        const task = { title, status, priority: "medium", description: "", tags: [] };
        addTask(task);
        if (auditLog) auditLog("global", "task_created", `Task: ${title}`, "", { priority: "medium" });
    }

    function handleDelete(id) {
        deleteTask(id);
        setDelConfirm(null);
    }

    const activeSites = useMemo(() => {
        const ids = new Set(tasks.filter(t => t.site_id).map(t => t.site_id));
        return sites.filter(s => ids.has(s.id));
    }, [tasks, sites]);

    const activeAssignees = useMemo(() => {
        const ids = new Set(tasks.filter(t => t.assignee_id).map(t => t.assignee_id));
        return users.filter(u => ids.has(u.id));
    }, [tasks, users]);

    const openCount = tasks.filter(t => t.status !== "done").length;

    return (
        <div style={{ maxWidth: 1300, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>✅ Tasks</h2>
                    <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 3 }}>
                        {openCount} open · {tasks.filter(t => t.status === "done").length} done
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* View toggle */}
                    <div style={{ display: "flex", border: "1px solid hsl(var(--border))", borderRadius: 8, overflow: "hidden" }}>
                        {[{ id: "kanban", label: "📋 Kanban" }, { id: "list", label: "☰ List" }].map(v => (
                            <button key={v.id} onClick={() => setView(v.id)}
                                style={{
                                    padding: "6px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                                    background: view === v.id ? T.primary : "hsl(var(--card))",
                                    color: view === v.id ? "white" : "hsl(var(--muted-foreground))",
                                }}>
                                {v.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setModal("new")} style={{ ...btnPri, padding: "7px 16px", fontSize: 13 }}>
                        + New Task
                    </button>
                </div>
            </div>

            {/* Filter bar */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Search tasks…"
                    style={{ ...inp, maxWidth: 220, flex: 1 }}
                />
                {[
                    { value: filterStatus, set: setFilterStatus, options: [["all", "All Status"], ...STATUSES.map(s => [s.id, `${s.icon} ${s.label}`])] },
                    { value: filterPriority, set: setFilterPriority, options: [["all", "All Priority"], ...PRIORITIES.map(p => [p.id, `${p.icon} ${p.label}`])] },
                ].map((f, i) => (
                    <select key={i} value={f.value} onChange={e => f.set(e.target.value)}
                        style={{ ...inp, width: "auto", appearance: "none", paddingRight: 28 }}>
                        {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                ))}
                {activeSites.length > 0 && (
                    <select value={filterSite} onChange={e => setFilterSite(e.target.value)}
                        style={{ ...inp, width: "auto", appearance: "none" }}>
                        <option value="all">All Sites</option>
                        {activeSites.map(s => <option key={s.id} value={s.id}>{s.brand || s.domain}</option>)}
                    </select>
                )}
                {activeAssignees.length > 0 && (
                    <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                        style={{ ...inp, width: "auto", appearance: "none" }}>
                        <option value="all">All Assignees</option>
                        {activeAssignees.map(u => <option key={u.id} value={u.id}>{u.name || u.email?.split("@")[0]}</option>)}
                    </select>
                )}
                {(search || filterStatus !== "all" || filterPriority !== "all" || filterSite !== "all" || filterAssignee !== "all") && (
                    <button onClick={() => { setSearch(""); setFilterStatus("all"); setFilterPriority("all"); setFilterSite("all"); setFilterAssignee("all"); }}
                        style={{ ...btnSec, fontSize: 12, padding: "6px 12px" }}>
                        Clear ×
                    </button>
                )}
            </div>

            {/* Views */}
            {tasks.length === 0 ? (
                <div style={{
                    textAlign: "center", padding: "64px 0",
                    background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 16,
                }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No tasks yet</div>
                    <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 20 }}>
                        Create your first task to track team work
                    </div>
                    <button onClick={() => setModal("new")} style={btnPri}>+ Create First Task</button>
                </div>
            ) : view === "kanban" ? (
                <KanbanView
                    filtered={filtered}
                    onOpen={task => setModal(task)}
                    onStatusChange={handleStatusChange}
                    onAdd={handleQuickAdd}
                />
            ) : (
                <ListView
                    filtered={filtered}
                    onOpen={task => setModal(task)}
                    onDelete={id => setDelConfirm(id)}
                />
            )}

            {/* Task Modal */}
            {modal && (
                <TaskModal
                    task={modal === "new" ? null : modal}
                    sites={sites}
                    users={users}
                    onSave={handleSave}
                    onClose={() => setModal(null)}
                />
            )}

            {/* Delete Confirm */}
            {delConfirm && (
                <div
                    onClick={e => { if (e.target === e.currentTarget) setDelConfirm(null); }}
                    style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.5)",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                        borderRadius: 14, padding: "24px 28px", maxWidth: 340, textAlign: "center" }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>🗑️</div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Delete Task?</div>
                        <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 20 }}>
                            This action cannot be undone.
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setDelConfirm(null)} style={{ ...btnSec, flex: 1 }}>Cancel</button>
                            <button onClick={() => handleDelete(delConfirm)} style={{ ...btnPri, background: "#dc2626", flex: 1 }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   SHARED STYLES
═══════════════════════════════════════════════════ */

const lbl = {
    display: "flex", flexDirection: "column", gap: 5,
    fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))",
    textTransform: "uppercase", letterSpacing: "0.05em",
};

const inp = {
    width: "100%", padding: "9px 12px", borderRadius: 9,
    border: "1.5px solid hsl(var(--border))",
    background: "hsl(var(--background))",
    color: "hsl(var(--foreground))", fontSize: 13,
    boxSizing: "border-box", outline: "none",
};

const btnPri = {
    padding: "9px 18px", borderRadius: 9, border: "none",
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
};

const btnSec = {
    padding: "9px 16px", borderRadius: 9,
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--secondary))",
    color: "hsl(var(--foreground))", fontWeight: 600, fontSize: 13, cursor: "pointer",
};

const iconBtn = {
    padding: "4px 8px", borderRadius: 7,
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--secondary))",
    cursor: "pointer", fontSize: 14, lineHeight: 1,
};
