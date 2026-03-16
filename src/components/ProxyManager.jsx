import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { uid, now } from "../utils";

const PROTOCOLS = ['http', 'socks5'];
const PROVIDERS = ['BrightData', 'Smartproxy', 'OxyLabs', 'IPRoyal', 'Residential', 'custom'];
const STATUSES = [
    { value: 'active',   label: '● Active',   color: '#16a34a' },
    { value: 'rotating', label: '↻ Rotating', color: '#3b82f6' },
    { value: 'flagged',  label: '⚠ Flagged',  color: '#f59e0b' },
    { value: 'dead',     label: '✕ Dead',     color: '#dc2626' },
];

const DEFAULT_FORM = {
    label: '', ip: '', port: '', protocol: 'http', provider: 'custom',
    country: '', city: '', username: '', password: '',
    status: 'active', assignedSites: [], assignedAccounts: [], notes: '',
};

function statusMeta(s) {
    return STATUSES.find(x => x.value === s) || STATUSES[0];
}

export function ProxyManager({ proxies = [], addProxy, updateProxy, deleteProxy, sites = [] }) {
    const [filter, setFilter] = useState('all');
    const [editing, setEditing] = useState(null); // proxy obj | 'new'
    const [form, setForm] = useState(DEFAULT_FORM);
    const [showPass, setShowPass] = useState({});
    const [expandedId, setExpandedId] = useState(null);

    const isDark = true; // follows parent app dark mode assumption
    const bg = '#09090b';
    const surface = '#18181b';
    const surfaceHover = '#27272a';
    const border = '#3f3f46';
    const text = '#fafafa';
    const textSub = '#a1a1aa';
    const textFaint = '#52525b';
    const accent = '#ea580c';
    const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${border}`, background: '#09090b', color: text, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
    const labelStyle = { display: 'flex', flexDirection: 'column', gap: 4 };
    const labelTextStyle = { fontSize: 10, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em' };

    const filtered = useMemo(() => {
        if (filter === 'all') return proxies;
        return proxies.filter(p => p.status === filter);
    }, [proxies, filter]);

    const siteById = useMemo(() => {
        const m = {};
        sites.forEach(s => { if (s.id) m[s.id] = s; });
        return m;
    }, [sites]);

    const openNew = () => {
        setForm({ ...DEFAULT_FORM });
        setEditing('new');
    };

    const openEdit = (proxy) => {
        setForm({ ...DEFAULT_FORM, ...proxy });
        setEditing(proxy);
    };

    const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.ip || !form.label) return;
        if (editing === 'new') {
            await addProxy({ ...form, id: uid(), createdAt: now(), updatedAt: now() });
        } else {
            await updateProxy({ ...editing, ...form, updatedAt: now() });
        }
        setEditing(null);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this proxy?')) return;
        await deleteProxy(id);
    };

    const toggleSiteAssign = (proxyId, siteId) => {
        const proxy = proxies.find(p => p.id === proxyId);
        if (!proxy) return;
        const current = proxy.assignedSites || [];
        const next = current.includes(siteId)
            ? current.filter(s => s !== siteId)
            : [...current, siteId];
        updateProxy({ ...proxy, assignedSites: next });
    };

    return (
        <div style={{ color: text, fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🔗 Proxy Manager</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: textSub }}>{proxies.length} proxies configured</p>
                </div>
                <button onClick={openNew}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Add Proxy
                </button>
            </div>

            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {[['all', 'All'], ...STATUSES.map(s => [s.value, s.label])].map(([v, l]) => (
                    <button key={v} onClick={() => setFilter(v)}
                        style={{ padding: '4px 12px', borderRadius: 999, border: `1px solid ${filter === v ? accent : border}`, background: filter === v ? `${accent}18` : 'transparent', color: filter === v ? accent : textSub, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {l}
                        {v !== 'all' && <span style={{ marginLeft: 4, opacity: 0.7 }}>({proxies.filter(p => p.status === v).length})</span>}
                    </button>
                ))}
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: textFaint, fontSize: 13 }}>
                    No proxies found. Click "+ Add Proxy" to add one.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtered.map(proxy => {
                        const st = statusMeta(proxy.status);
                        const isExpanded = expandedId === proxy.id;
                        const assignedSiteLabels = (proxy.assignedSites || []).map(id => siteById[id]?.brand || id.slice(0, 8)).filter(Boolean);

                        return (
                            <div key={proxy.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                                {/* Row */}
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr auto', gap: 12, padding: '12px 16px', alignItems: 'center', fontSize: 13 }}>
                                    {/* Label + IP */}
                                    <div>
                                        <div style={{ fontWeight: 600, color: text }}>{proxy.label || 'Untitled'}</div>
                                        <div style={{ fontSize: 11, color: textSub, marginTop: 2 }}>{proxy.ip}:{proxy.port} · {proxy.protocol?.toUpperCase()}</div>
                                    </div>
                                    {/* Provider + Country */}
                                    <div>
                                        <div style={{ color: textSub, fontSize: 12 }}>{proxy.provider || '—'}</div>
                                        <div style={{ fontSize: 11, color: textFaint }}>{[proxy.country, proxy.city].filter(Boolean).join(', ') || '—'}</div>
                                    </div>
                                    {/* Assigned sites */}
                                    <div style={{ fontSize: 11, color: textSub }}>
                                        {assignedSiteLabels.length > 0 ? assignedSiteLabels.slice(0, 2).join(', ') + (assignedSiteLabels.length > 2 ? ` +${assignedSiteLabels.length - 2}` : '') : '—'}
                                    </div>
                                    {/* Status */}
                                    <div>
                                        <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, background: `${st.color}18`, color: st.color, fontWeight: 500 }}>
                                            {st.label}
                                        </span>
                                    </div>
                                    {/* Last checked */}
                                    <div style={{ fontSize: 11, color: textFaint }}>
                                        {proxy.lastCheckedAt ? new Date(proxy.lastCheckedAt).toLocaleDateString() : '—'}
                                    </div>
                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => setExpandedId(isExpanded ? null : proxy.id)}
                                            style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${border}`, background: 'transparent', color: textSub, fontSize: 11, cursor: 'pointer' }}>
                                            {isExpanded ? '▲' : '▼'}
                                        </button>
                                        <button onClick={() => openEdit(proxy)}
                                            style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${border}`, background: 'transparent', color: textSub, fontSize: 11, cursor: 'pointer' }}>
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(proxy.id)}
                                            style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid #dc262630`, background: 'transparent', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>
                                            Del
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div style={{ borderTop: `1px solid ${border}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                                        {/* Credentials */}
                                        {(proxy.username || proxy.password) && (
                                            <div style={{ display: 'flex', gap: 16 }}>
                                                <span style={{ color: textSub }}>User: <span style={{ color: text }}>{proxy.username || '—'}</span></span>
                                                <span style={{ color: textSub }}>
                                                    Pass: <span style={{ color: text }}>
                                                        {showPass[proxy.id] ? proxy.password : '●●●●●●'}
                                                    </span>
                                                    {proxy.password && (
                                                        <button onClick={() => setShowPass(p => ({ ...p, [proxy.id]: !p[proxy.id] }))}
                                                            style={{ marginLeft: 6, background: 'none', border: 'none', color: textSub, cursor: 'pointer', fontSize: 10, padding: 0 }}>
                                                            {showPass[proxy.id] ? 'hide' : 'show'}
                                                        </button>
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        {/* Assigned sites toggle */}
                                        {sites.length > 0 && (
                                            <div>
                                                <div style={{ color: textSub, marginBottom: 6 }}>Assign to sites:</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {sites.map(s => {
                                                        const assigned = (proxy.assignedSites || []).includes(s.id);
                                                        return (
                                                            <button key={s.id} onClick={() => toggleSiteAssign(proxy.id, s.id)}
                                                                style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, border: `1px solid ${assigned ? accent : border}`, background: assigned ? `${accent}18` : 'transparent', color: assigned ? accent : textSub, cursor: 'pointer', fontFamily: 'inherit' }}>
                                                                {s.brand || s.domain || s.id.slice(0, 8)}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Notes */}
                                        {proxy.notes && (
                                            <div style={{ color: textSub }}>Notes: <span style={{ color: text }}>{proxy.notes}</span></div>
                                        )}

                                        {/* Assigned Accounts */}
                                        {proxy.assignedAccounts?.length > 0 && (
                                            <div style={{ color: textSub }}>Accounts: <span style={{ color: text }}>{proxy.assignedAccounts.join(', ')}</span></div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Modal */}
            {editing && createPortal(
                <div onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <form onSubmit={handleSave}
                        style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,.4)', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 14, color: text }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{editing === 'new' ? '+ Add Proxy' : `Edit: ${form.label}`}</div>
                            <button type="button" onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: textSub, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <label style={labelStyle}>
                                <span style={labelTextStyle}>Label *</span>
                                <input value={form.label} onChange={e => setF('label', e.target.value)} required style={inputStyle} placeholder="e.g. BrightData US-1" />
                            </label>
                            <label style={labelStyle}>
                                <span style={labelTextStyle}>Provider</span>
                                <select value={form.provider} onChange={e => setF('provider', e.target.value)} style={inputStyle}>
                                    {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                            <label style={labelStyle}>
                                <span style={labelTextStyle}>IP Address *</span>
                                <input value={form.ip} onChange={e => setF('ip', e.target.value)} required style={inputStyle} placeholder="1.2.3.4" />
                            </label>
                            <label style={labelStyle}>
                                <span style={labelTextStyle}>Port</span>
                                <input value={form.port} onChange={e => setF('port', e.target.value)} style={inputStyle} placeholder="8080" />
                            </label>
                            <label style={labelStyle}>
                                <span style={labelTextStyle}>Protocol</span>
                                <select value={form.protocol} onChange={e => setF('protocol', e.target.value)} style={inputStyle}>
                                    {PROTOCOLS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                                </select>
                            </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <label style={labelStyle}>
                                <span style={labelTextStyle}>Country (2-char)</span>
                                <input value={form.country} onChange={e => setF('country', e.target.value.toUpperCase().slice(0, 2))} style={inputStyle} placeholder="US" maxLength={2} />
                            </label>
                            <label style={labelStyle}>
                                <span style={labelTextStyle}>City</span>
                                <input value={form.city} onChange={e => setF('city', e.target.value)} style={inputStyle} placeholder="New York" />
                            </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <label style={labelStyle}>
                                <span style={labelTextStyle}>Username</span>
                                <input value={form.username} onChange={e => setF('username', e.target.value)} style={inputStyle} placeholder="optional" autoComplete="off" />
                            </label>
                            <label style={labelStyle}>
                                <span style={labelTextStyle}>Password</span>
                                <input type="password" value={form.password} onChange={e => setF('password', e.target.value)} style={inputStyle} placeholder="optional" autoComplete="new-password" />
                            </label>
                        </div>

                        <label style={labelStyle}>
                            <span style={labelTextStyle}>Status</span>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {STATUSES.map(s => (
                                    <button key={s.value} type="button" onClick={() => setF('status', s.value)}
                                        style={{ padding: '5px 12px', borderRadius: 999, border: `1px solid ${form.status === s.value ? s.color : border}`, background: form.status === s.value ? `${s.color}20` : 'transparent', color: form.status === s.value ? s.color : textSub, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </label>

                        <label style={labelStyle}>
                            <span style={labelTextStyle}>Assigned Google Ads Accounts (one per line)</span>
                            <textarea value={(form.assignedAccounts || []).join('\n')} onChange={e => setF('assignedAccounts', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Account name or ID" />
                        </label>

                        <label style={labelStyle}>
                            <span style={labelTextStyle}>Notes</span>
                            <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Optional notes…" />
                        </label>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                            <button type="button" onClick={() => setEditing(null)}
                                style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                                Cancel
                            </button>
                            <button type="submit"
                                style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {editing === 'new' ? 'Add Proxy →' : 'Save Changes →'}
                            </button>
                        </div>
                    </form>
                </div>,
                document.body
            )}
        </div>
    );
}
