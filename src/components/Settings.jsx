import { useState, useEffect } from "react";

import { InputField as Inp, SelectField as Sel } from "./ui/input-field";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { api } from "../services/api";
import { multiloginApi } from "../services/multilogin";
import { getCfApiBase } from "../utils/api-proxy";
import { detectIncompleteSettings } from "../services/account-lock";
import { migrateSitesToD1 } from "../services/d1";
import { loadSites } from "../services/neon";

/* ── Appearance / Theme Color ─────────────────────────────────── */
const COLOR_PRESETS = [
    { label: "Red/Orange",  primary: "#ef4444", gradEnd: "#f97316", hsl: "0 84% 60%",    primaryH: "#f87171" },
    { label: "Rose",        primary: "#f43f5e", gradEnd: "#e11d48", hsl: "347 89% 60%",  primaryH: "#fb7185" },
    { label: "Crimson",     primary: "#dc2626", gradEnd: "#991b1b", hsl: "0 72% 51%",    primaryH: "#ef4444" },
    { label: "Blue",        primary: "#3b82f6", gradEnd: "#06b6d4", hsl: "217 91% 60%",  primaryH: "#60a5fa" },
    { label: "Teal",        primary: "#14b8a6", gradEnd: "#06b6d4", hsl: "173 80% 40%",  primaryH: "#2dd4bf" },
    { label: "Green",       primary: "#10b981", gradEnd: "#059669", hsl: "160 84% 39%",  primaryH: "#34d399" },
    { label: "Amber",       primary: "#f59e0b", gradEnd: "#d97706", hsl: "38 92% 50%",   primaryH: "#fbbf24" },
    { label: "Purple",      primary: "#6366f1", gradEnd: "#a855f7", hsl: "239 84% 67%",  primaryH: "#818cf8" },
];

function AppearanceSection() {
    const saved = (() => { try { return JSON.parse(localStorage.getItem("theme-color") || "null"); } catch { return null; } })();
    const [primary, setPrimary] = useState(saved?.primary || "#ef4444");
    const [gradEnd, setGradEnd] = useState(saved?.gradEnd || "#f97316");
    const [active, setActive] = useState(saved?.primary || "#ef4444");

    function applyPreset(p) {
        setPrimary(p.primary);
        setGradEnd(p.gradEnd);
        setActive(p.primary);
        localStorage.setItem("theme-color", JSON.stringify({
            primary: p.primary, gradEnd: p.gradEnd, primaryH: p.primaryH,
            grad: `linear-gradient(135deg,${p.primary},${p.gradEnd})`,
            hsl: p.hsl,
        }));
        window.location.reload();
    }

    function applyCustom() {
        localStorage.setItem("theme-color", JSON.stringify({
            primary, gradEnd, primaryH: primary,
            grad: `linear-gradient(135deg,${primary},${gradEnd})`,
            hsl: "",
        }));
        window.location.reload();
    }

    function reset() {
        localStorage.removeItem("theme-color");
        window.location.reload();
    }

    return (
        <Card className="mb-4">
            <CardHeader><CardTitle>Theme Color</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">
                    เลือกสี accent / gradient ของแอป — บันทึกไว้ใน browser (preview mode)
                </p>
                {/* Presets */}
                <div className="grid grid-cols-4 gap-2">
                    {COLOR_PRESETS.map(p => (
                        <button key={p.label} onClick={() => applyPreset(p)}
                            title={p.label}
                            style={{ background: `linear-gradient(135deg,${p.primary},${p.gradEnd})`, outline: active === p.primary ? "2px solid white" : "none", outlineOffset: 2 }}
                            className="h-9 rounded-lg text-white text-[10px] font-semibold shadow-sm cursor-pointer border-0 transition-transform hover:scale-105">
                            {p.label}
                        </button>
                    ))}
                </div>
                {/* Custom picker */}
                <div className="flex gap-3 items-end">
                    <label className="flex flex-col gap-1 text-[10px] text-[hsl(var(--muted-foreground))] font-semibold uppercase">
                        Primary
                        <input type="color" value={primary} onChange={e => setPrimary(e.target.value)}
                            className="h-9 w-16 rounded cursor-pointer border border-[hsl(var(--border))] bg-transparent" />
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] text-[hsl(var(--muted-foreground))] font-semibold uppercase">
                        Gradient End
                        <input type="color" value={gradEnd} onChange={e => setGradEnd(e.target.value)}
                            className="h-9 w-16 rounded cursor-pointer border border-[hsl(var(--border))] bg-transparent" />
                    </label>
                    <div className="flex-1 h-9 rounded-lg shadow-sm" style={{ background: `linear-gradient(135deg,${primary},${gradEnd})` }} />
                    <Button onClick={applyCustom} className="h-9 px-3 text-[11px]">Apply</Button>
                </div>
                <div className="flex justify-end">
                    <Button variant="ghost" onClick={reset} className="h-7 px-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                        Reset to Default
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export function Settings({ settings, setSettings, stats, apiOk, neonOk }) {
    const asArray = (v) => Array.isArray(v) ? v : [];
    const [neonUrl, setNeonUrl] = useState(settings.neonUrl || import.meta.env.VITE_NEON_URL || "");
    const [apiKey, setApiKey] = useState(settings.apiKey || "");
    const [geminiKey, setGeminiKey] = useState(settings.geminiKey || "");
    const [netlifyToken, setNetlifyToken] = useState(settings.netlifyToken || "");
    const [netlifyTeamSlug, setNetlifyTeamSlug] = useState(settings.netlifyTeamSlug || "");
    const [lcToken, setLcToken] = useState(settings.lcToken || import.meta.env.VITE_LENDINGCARD_TOKEN || import.meta.env.PUBLIC_LENDINGCARD_API_TOKEN || "");
    const [mlToken, setMlToken] = useState(settings.mlToken || "");
    const [mlEmail, setMlEmail] = useState(settings.mlEmail || "");
    const [mlPassword, setMlPassword] = useState(settings.mlPassword || "");
    const [mlFolderId, setMlFolderId] = useState(settings.mlFolderId || "");

    // Voluum API
    const [voluumAccessKeyId, setVoluumAccessKeyId] = useState(settings.voluumAccessKeyId || import.meta.env.VITE_VOLUUM_ACCESS_KEY_ID || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY_ID || "");
    const [voluumAccessKey, setVoluumAccessKey] = useState(settings.voluumAccessKey || import.meta.env.VITE_VOLUUM_ACCESS_KEY || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY || "");

    // Deploy credentials
    const [cfApiToken, setCfApiToken] = useState(settings.cfApiToken || import.meta.env.VITE_CF_API_TOKEN || "");
    const [cfAccountId, setCfAccountId] = useState(settings.cfAccountId || import.meta.env.VITE_CF_ACCOUNT_ID || "");

    // ── Cloudflare Profiles (multi-account) ──
    const [cfProfiles, setCfProfiles] = useState(() => {
        const saved = asArray(settings.cfProfiles);
        // Migrate legacy single-account into profiles if needed
        if (saved.length === 0 && (settings.cfAccountId || settings.cfApiToken)) {
            return [{ id: "legacy", name: "Default", accountId: settings.cfAccountId || "", apiToken: settings.cfApiToken || "" }];
        }
        return saved;
    });
    const [editingProfile, setEditingProfile] = useState(null); // null | profile obj
    const [profileTestResult, setProfileTestResult] = useState({});
    // Vercel deploy token
    const [vercelToken, setVercelToken] = useState(settings.vercelToken || "");
    // Git push pipeline settings
    const [githubToken, setGithubToken] = useState(settings.githubToken || "");
    const [githubRepoOwner, setGithubRepoOwner] = useState(settings.githubRepoOwner || "");
    const [githubRepoName, setGithubRepoName] = useState(settings.githubRepoName || "");
    const [githubRepoBranch, setGithubRepoBranch] = useState(settings.githubRepoBranch || "main");
    const [githubDeployWorkflow, setGithubDeployWorkflow] = useState(settings.githubDeployWorkflow || "deploy-lp.yml");

    // D1 Database credentials
    const [d1AccountId, setD1AccountId] = useState(settings.d1AccountId || "");
    const [d1DatabaseId, setD1DatabaseId] = useState(settings.d1DatabaseId || "");
    const [d1ApiToken, setD1ApiToken] = useState(settings.d1ApiToken || "");
    const [d1Result, setD1Result] = useState(null);
    const [d1MigrateResult, setD1MigrateResult] = useState(null);
    const [migrating, setMigrating] = useState(false);

    // NodeMaven Proxy Pre-flight
    const [nmProxyUser, setNmProxyUser] = useState(settings.nmProxyUser || "");
    const [nmProxyPassword, setNmProxyPassword] = useState(settings.nmProxyPassword || "");
    const [ipqsApiKey, setIpqsApiKey] = useState(settings.ipqsApiKey || "");
    const [proxyCheckEnabled, setProxyCheckEnabled] = useState(settings.proxyCheckEnabled !== false);
    const [proxyMinScore, setProxyMinScore] = useState(settings.proxyMinScore || 70);

    // Proxy Providers (fallback)
    const [spProxyUser, setSpProxyUser] = useState(settings.spProxyUser || "");
    const [spProxyPassword, setSpProxyPassword] = useState(settings.spProxyPassword || "");
    const [soaxProxyUser, setSoaxProxyUser] = useState(settings.soaxProxyUser || "");
    const [soaxProxyPassword, setSoaxProxyPassword] = useState(settings.soaxProxyPassword || "");
    const [bdCustomer, setBdCustomer] = useState(settings.bdCustomer || "");
    const [bdZone, setBdZone] = useState(settings.bdZone || "");
    const [bdPassword, setBdPassword] = useState(settings.bdPassword || "");
    const [proxyPrimaryProvider, setProxyPrimaryProvider] = useState(settings.proxyPrimaryProvider || "nodemaven");

    // IP Quality APIs
    const [ipinfoToken, setIpinfoToken] = useState(settings.ipinfoToken || "");
    const [scamalyticsKey, setScamalyticsKey] = useState(settings.scamalyticsKey || "");
    const [ip2locationKey, setIp2locationKey] = useState(settings.ip2locationKey || "");

    const [hideRevenue, setHideRevenue] = useState(settings.hideRevenue === true);


    const [testing, setTesting] = useState(null);
    const [testResult, setTestResult] = useState({});
    const [saving, setSaving] = useState(false);

    // Sync saved token into service on mount
    useEffect(() => {
        if (mlToken) multiloginApi.setToken(mlToken);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── CF Profile helpers ──
    const saveCfProfiles = (profiles) => {
        setCfProfiles(profiles);
        // Also set legacy single fields to first profile for backward compat
        const primary = profiles[0];
        save({
            cfProfiles: profiles,
            cfAccountId: primary?.accountId || "",
            cfApiToken: primary?.apiToken || "",
        });
    };

    const addCfProfile = () => {
        setEditingProfile({ id: `cf_${Date.now()}`, name: "", accountId: "", apiToken: "" });
    };

    const saveEditingProfile = () => {
        if (!editingProfile?.name?.trim() || !editingProfile?.accountId?.trim() || !editingProfile?.apiToken?.trim()) return;
        const cleanId = editingProfile.accountId.trim();
        if (!/^[0-9a-f]{32}$/i.test(cleanId)) return;
        const updated = { ...editingProfile, accountId: cleanId };
        const exists = cfProfiles.find(p => p.id === updated.id);
        const newList = exists
            ? cfProfiles.map(p => p.id === updated.id ? updated : p)
            : [...cfProfiles, updated];
        saveCfProfiles(newList);
        setEditingProfile(null);
    };

    const removeCfProfile = (id) => {
        const newList = cfProfiles.filter(p => p.id !== id);
        saveCfProfiles(newList);
    };

    const testCfProfile = async (profile) => {
        const cleanId = profile.accountId?.trim();
        if (!/^[0-9a-f]{32}$/i.test(cleanId)) {
            setProfileTestResult(p => ({ ...p, [profile.id]: { ok: false, msg: `Account ID must be 32 hex chars (got ${cleanId?.length})` } }));
            return;
        }
        const cfBase = getCfApiBase();
        try {
            const r = await fetch(`${cfBase}/accounts/${cleanId}/pages/projects?per_page=1`, {
                headers: { Authorization: `Bearer ${profile.apiToken}` },
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                setProfileTestResult(p => ({ ...p, [profile.id]: { ok: false, msg: err.errors?.[0]?.message || `HTTP ${r.status}` } }));
            } else {
                // Also check zones
                const zr = await fetch(`${cfBase}/zones?account.id=${cleanId}&per_page=5`, {
                    headers: { Authorization: `Bearer ${profile.apiToken}` },
                });
                const zd = await zr.json().catch(() => ({}));
                const zoneCount = zd.result?.length || 0;
                setProfileTestResult(p => ({ ...p, [profile.id]: { ok: true, msg: `Pages ✓ · ${zoneCount} zones` } }));
            }
        } catch (e) {
            setProfileTestResult(p => ({ ...p, [profile.id]: { ok: false, msg: e.message } }));
        }
    };

    const testApi = async () => {
        setTesting("api");
        try {
            const r = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
                body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 10, messages: [{ role: "user", content: "OK" }] })
            });
            setTestResult(p => ({ ...p, api: r.ok ? "ok" : "fail" }));
        } catch (e) {
            console.warn("[Settings] API test failed:", e?.message || e);
            setTestResult(p => ({ ...p, api: "fail" }));
        }
        setTesting(null);
    };

    const testGitHub = async () => {
        setTesting("github");
        try {
            const owner = String(githubRepoOwner || "").trim();
            const repo = String(githubRepoName || "").trim();
            const token = String(githubToken || "").trim();
            if (!owner || !repo || !token) {
                setTestResult(p => ({ ...p, github: "fail", githubDetail: "Fill token + owner + repo" }));
                setTesting(null);
                return;
            }
            const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            });
            if (!r.ok) {
                const text = await r.text().catch(() => "");
                setTestResult(p => ({ ...p, github: "fail", githubDetail: text || `HTTP ${r.status}` }));
            } else {
                setTestResult(p => ({ ...p, github: "ok", githubDetail: `${owner}/${repo}` }));
            }
        } catch (e) {
            setTestResult(p => ({ ...p, github: "fail", githubDetail: e.message }));
        }
        setTesting(null);
    };

    const testNetlify = async () => {
        setTesting("netlify");
        try {
            const teamSlug = String(netlifyTeamSlug || "").trim();
            const url = teamSlug
                ? `https://api.netlify.com/api/v1/sites?per_page=1&account_slug=${encodeURIComponent(teamSlug)}`
                : "https://api.netlify.com/api/v1/sites?per_page=1";
            const r = await fetch(url, { headers: { Authorization: `Bearer ${netlifyToken}` } });
            setTestResult(p => ({ ...p, netlify: r.ok ? "ok" : "fail" }));
        } catch (e) {
            console.warn("[Settings] Netlify test failed:", e?.message || e);
            setTestResult(p => ({ ...p, netlify: "fail" }));
        }
        setTesting(null);
    };

    const testCf = async () => {
        setTesting("cf");
        // Validate Account ID format: must be exactly 32 hex chars
        const cleanId = cfAccountId.trim();
        if (!/^[0-9a-f]{32}$/i.test(cleanId)) {
            setTestResult(p => ({ ...p, cf: "fail", cfDetail: `Account ID must be exactly 32 hex characters (got ${cleanId.length})` }));
            setTesting(null);
            return;
        }
        const cfBase = getCfApiBase();
        try {
            // Test 1: Verify token by listing Pages projects
            const pagesRes = await fetch(`${cfBase}/accounts/${cleanId}/pages/projects?per_page=1`, {
                headers: { Authorization: `Bearer ${cfApiToken}` },
            });
            if (!pagesRes.ok) {
                const err = await pagesRes.json().catch(() => ({}));
                const msg = err.errors?.[0]?.message || `HTTP ${pagesRes.status}`;
                setTestResult(p => ({ ...p, cf: "fail", cfDetail: `Pages: ${msg}` }));
                setTesting(null);
                return;
            }
            // Test 2: Verify Workers permission
            const workersRes = await fetch(`${cfBase}/accounts/${cleanId}/workers/subdomain`, {
                headers: { Authorization: `Bearer ${cfApiToken}` },
            });
            if (!workersRes.ok) {
                setTestResult(p => ({ ...p, cf: "partial", cfDetail: "Pages OK, Workers permission missing" }));
            } else {
                const subData = await workersRes.json().catch(() => ({}));
                const sub = subData.result?.subdomain;
                setTestResult(p => ({ ...p, cf: "ok", cfDetail: sub ? `*.${sub}.workers.dev` : "All permissions OK" }));
            }
        } catch (e) { setTestResult(p => ({ ...p, cf: "fail", cfDetail: e.message })); }
        setTesting(null);
    };

    const testLc = async () => {
        setTesting("lc");
        try {
            if (!lcToken) {
                setTestResult(p => ({ ...p, lc: "fail", lcDetail: "API token is empty" }));
                setTesting(null);
                return;
            }
            const r = await api.get("/lc/teams");
            if (r && !r.error) {
                const teamCount = Array.isArray(r) ? r.length : r.data?.length || 0;
                setTestResult(p => ({ ...p, lc: "ok", lcDetail: `Connected (${teamCount} teams)` }));
            } else {
                setTestResult(p => ({ ...p, lc: "fail", lcDetail: r?.error || r?.detail || "Invalid response" }));
            }
        } catch (e) {
            console.warn("[Settings] LC test failed:", e?.message || e);
            setTestResult(p => ({ ...p, lc: "fail", lcDetail: e?.message || "Connection failed" }));
        }
        setTesting(null);
    };

    const testVoluum = async () => {
        setTesting("voluum");
        try {
            if (!voluumAccessKeyId || !voluumAccessKey) {
                setTestResult(p => ({ ...p, voluum: "fail", voluumDetail: "Fill both Access Key ID and Secret Key" }));
                setTesting(null);
                return;
            }
            // Use fetch directly to avoid api.js swallowing error body on non-200
            const { fetchVoluumSession } = await import("../services/voluum.js");
            const token = await fetchVoluumSession(voluumAccessKeyId, voluumAccessKey);
            if (token) {
                setTestResult(p => ({ ...p, voluum: "ok", voluumDetail: `Session token: ${token.slice(0, 8)}...` }));
            } else {
                setTestResult(p => ({ ...p, voluum: "fail", voluumDetail: "No token returned" }));
            }
        } catch (e) {
            console.warn("[Settings] Voluum test failed:", e?.message || e);
            setTestResult(p => ({ ...p, voluum: "fail", voluumDetail: e?.message || "Unknown error" }));
        }
        setTesting(null);
    };

    const migrateNeonToD1 = async () => {
        setMigrating(true);
        setD1MigrateResult(null);
        try {
            const sites = await loadSites();
            if (!sites || sites.length === 0) {
                setD1MigrateResult({ success: false, error: "No sites found in Neon to migrate." });
                return;
            }
            const { synced, errors } = await migrateSitesToD1(sites);
            setD1MigrateResult({ success: true, synced, errors, total: sites.length });
        } catch (e) {
            setD1MigrateResult({ success: false, error: e.message || "Migration failed" });
        } finally {
            setMigrating(false);
        }
    };

    const testD1 = async () => {
        setTesting("d1");
        let requestUrl = "";
        try {
            // Validate Account ID format
            const cleanId = d1AccountId.trim();
            if (!/^[0-9a-f]{32}$/i.test(cleanId)) {
                setD1Result({ success: false, error: `Account ID must be exactly 32 hex characters (got ${cleanId.length})` });
                setTesting(null);
                return;
            }

            // Test by listing D1 databases in the account
            const cfBase = getCfApiBase();
            requestUrl = `${cfBase}/accounts/${cleanId}/d1/database`;
            const res = await fetch(requestUrl, {
                headers: { Authorization: `Bearer ${d1ApiToken}` },
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const msg = err.errors?.[0]?.message || `HTTP ${res.status}`;
                setD1Result({ success: false, error: msg, url: requestUrl });
            } else {
                const data = await res.json();
                // Verify the specific database exists if databaseId is provided
                if (d1DatabaseId) {
                    const dbExists = data.result?.some(db => db.uuid === d1DatabaseId || db.id === d1DatabaseId);
                    if (dbExists) {
                        const dbInfo = data.result.find(db => db.uuid === d1DatabaseId || db.id === d1DatabaseId);
                        setD1Result({ success: true, database: dbInfo });
                    } else {
                        setD1Result({ success: false, error: `Database ID ${d1DatabaseId} not found in account` });
                    }
                } else {
                    setD1Result({ success: true, count: data.result?.length || 0 });
                }
            }
        } catch (e) {
            setD1Result({
                success: false,
                error: `${e.message || "Failed to fetch"}. Check API base/proxy URL and CORS/network.`,
                detail: e?.stack || null,
                url: requestUrl || null,
            });
        }
        setTesting(null);
    };

    const testMl = async () => {
        setTesting("ml");
        try {
            if (mlToken) {
                // Actually validate the token by trying to list folders
                multiloginApi.setToken(mlToken);
                const r = await multiloginApi.getFolders();
                if (r && !r.error && r.status !== 401) {
                    setTestResult(p => ({ ...p, ml: "active" }));
                } else if (r?.status === 401 || r?.error?.includes?.("401")) {
                    // Token expired — try refresh
                    const ref = await multiloginApi.refreshToken(mlToken);
                    if (ref.data?.token) {
                        setMlToken(ref.data.token);
                        setTestResult(p => ({ ...p, ml: "ok" }));
                    } else {
                        setTestResult(p => ({ ...p, ml: "expired" }));
                    }
                } else {
                    setTestResult(p => ({ ...p, ml: "fail" }));
                }
                setTesting(null);
                return;
            }
            // No token — try sign in with email/password
            if (mlEmail && mlPassword) {
                const r = await multiloginApi.signin(mlEmail, mlPassword);
                if (r?.data?.token) {
                    setMlToken(r.data.token);
                    setTestResult(p => ({ ...p, ml: "ok" }));
                } else {
                    setTestResult(p => ({ ...p, ml: "fail" }));
                }
            } else {
                setTestResult(p => ({ ...p, ml: "no-creds" }));
            }
        } catch (e) {
            console.warn("[Settings] Multilogin test failed:", e?.message || e);
            setTestResult(p => ({ ...p, ml: "fail" }));
        }
        setTesting(null);
    };

    const save = async (s) => {
        setSaving(true);
        try {
            await setSettings(s);
        } finally {
            setSaving(false);
        }
    };

    const Lbl = ({ children }) => <label className="text-[10px] text-[hsl(var(--muted-foreground))] block mb-0.5">{children}</label>;
    const SectionHeader = ({ children }) => <div className="text-[11px] font-bold uppercase tracking-[1px] text-[hsl(var(--muted-foreground))] mb-3 mt-5 pb-1.5 border-b border-[hsl(var(--border))]">{children}</div>;

    return (
        <div className="max-w-[1280px] animate-[fadeIn_.3s_ease]">
            <header className="mb-6">
                <h1 className="text-[24px] font-bold m-0 mb-1">Settings</h1>
                <p className="text-[hsl(var(--muted-foreground))] text-sm">API keys, database connections, and deployment pipeline configuration</p>
            </header>

            {/* Incomplete Settings Alert */}
            {(() => {
                const completenessCheck = detectIncompleteSettings(settings);
                if (completenessCheck.isIncomplete) {
                    return (
                        <div className="mb-6 p-4 rounded-lg border-2 bg-[rgba(239,68,68,0.05)] border-[rgba(239,68,68,0.2)]">
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">⚠️</span>
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-[hsl(var(--destructive))] mb-1">Settings Incomplete</h3>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                                        Some critical settings are missing. This may happen when Neon connection is lost.
                                    </p>
                                    <div className="text-xs bg-[rgba(0,0,0,0.05)] p-2 rounded">
                                        <div className="font-semibold mb-1">Missing:</div>
                                        <ul className="list-disc list-inside text-[hsl(var(--destructive))]">
                                            {completenessCheck.missingCritical.map(key => (
                                                <li key={key}>{key}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                                        💡 <strong>Fix:</strong> Reconnect to Neon to automatically restore all settings
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Access Visibility</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={hideRevenue}
                            onChange={e => setHideRevenue(e.target.checked)}
                            className="mt-0.5 rounded border-[hsl(var(--border))]"
                        />
                        <div>
                            <div className="text-sm font-medium">Hide revenue and profit in employee view</div>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                Masks revenue, payout, profit, and ROI across dashboards without changing the underlying data.
                            </p>
                        </div>
                    </label>
                    <Button onClick={() => save({ hideRevenue })} disabled={saving} className="text-xs self-start">
                        {saving ? "Saving..." : "💾 Save"}
                    </Button>
                </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3 mb-6">
                <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg border shadow-sm ${neonOk ? "bg-[rgba(16,185,129,0.1)] text-[hsl(var(--success))] border-[rgba(16,185,129,0.2)]" : "bg-[rgba(239,68,68,0.1)] text-[hsl(var(--destructive))] border-[rgba(239,68,68,0.2)]"}`}>
                    <span className="text-sm">{neonOk ? "●" : "○"}</span>
                    {neonOk ? "Neon DB Connected" : "Neon DB Offline"}
                </div>
                <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg border shadow-sm ${apiOk ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border-[rgba(16,185,129,0.15)]" : "bg-[rgba(100,100,100,0.1)] text-[hsl(var(--muted-foreground))] border-[rgba(100,100,100,0.15)]"}`}>
                    <span className="text-sm">{apiOk ? "●" : "○"}</span>
                    {apiOk ? "Legacy API Active" : "Legacy API Offline"}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-x-8 gap-y-2 items-start">
                {/* Column 1: Infrastructure & API Providers */}
                <div className="space-y-2">
                    <section>
                        <SectionHeader>🗄️ Infrastructure</SectionHeader>
                        <Card className="mb-4">
                            <CardHeader><CardTitle>Neon Postgres</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1">Serverless Postgres for persistent storage (settings, sites, deploys)</p>
                                <div><Lbl>Connection String (pooler)</Lbl><Inp type="password" value={neonUrl} onChange={setNeonUrl} placeholder="postgresql://user:pass@ep-xxx.us-west-2.aws.neon.tech/neondb?sslmode=require" /></div>
                                {neonOk && <div className="text-[11px] text-[hsl(var(--success))]">✓ Connected to Neon</div>}
                                <Button onClick={() => save({ neonUrl })} disabled={saving || !neonUrl} className="text-xs self-start">{saving ? "Connecting..." : "💾 Save & Connect"}</Button>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>☁️ Cloudflare D1 Database</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1">Edge SQL database for low-latency queries</p>
                                <div><Lbl>Account ID {d1AccountId && (/^[0-9a-f]{32}$/i.test(d1AccountId.trim()) ? <span className="text-[hsl(var(--success))] text-[10px]">✓ {d1AccountId.trim().length} chars</span> : <span className="text-[hsl(var(--destructive))] text-[10px]">✗ {d1AccountId.trim().length}/32 chars</span>)}</Lbl><Inp value={d1AccountId} onChange={setD1AccountId} placeholder="32-char hex account ID" /></div>
                                <div><Lbl>Database ID (UUID)</Lbl><Inp value={d1DatabaseId} onChange={setD1DatabaseId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
                                <div><Lbl>API Token</Lbl><Inp type="password" value={d1ApiToken} onChange={setD1ApiToken} placeholder="Cloudflare API Token with D1 permissions" /></div>
                                {d1Result && (
                                    <div className={`text-[11px] ${d1Result.success ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>
                                        <div>{d1Result.success ? `✓ Connected${d1Result.database ? ` to "${d1Result.database.name}"` : d1Result.count !== undefined ? ` (${d1Result.count} databases)` : ""}` : `✗ ${d1Result.error}`}</div>
                                    </div>
                                )}
                                {d1MigrateResult && (
                                    <div className={`text-[11px] ${d1MigrateResult.success ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>
                                        {d1MigrateResult.success
                                            ? `✓ Synced ${d1MigrateResult.synced}/${d1MigrateResult.total} sites to D1${d1MigrateResult.errors > 0 ? ` (${d1MigrateResult.errors} errors)` : ""}`
                                            : `✗ ${d1MigrateResult.error}`}
                                    </div>
                                )}
                                <div className="flex gap-1.5 flex-wrap">
                                    <Button variant="ghost" onClick={testD1} disabled={!d1AccountId || !d1ApiToken || testing === "d1"} className="text-xs">{testing === "d1" ? "..." : "🔑 Test"}</Button>
                                    <Button onClick={() => { const cleanId = d1AccountId.trim(); if (cleanId && !/^[0-9a-f]{32}$/i.test(cleanId)) { setD1Result({ success: false, error: `Account ID must be exactly 32 hex characters (got ${cleanId.length})` }); return; } save({ d1AccountId: cleanId, d1DatabaseId, d1ApiToken }); }} disabled={saving} className="text-xs">{saving ? "Saving..." : "💾 Save"}</Button>
                                    <Button variant="ghost" onClick={migrateNeonToD1} disabled={migrating || !neonOk} className="text-xs" title={!neonOk ? "Neon must be connected first" : "Copy all sites from Neon → D1"}>{migrating ? "⏳ Syncing..." : "🔄 Sync Neon→D1"}</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                        <SectionHeader>🤖 AI Providers</SectionHeader>
                        <Card className="mb-4">
                            <CardHeader><CardTitle>Gemini API Key <span className="text-[hsl(var(--success))] text-[11px] font-normal">⭐ For AI Generation</span></CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1">🔑 Required for AI Copy Generator — Get free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-[hsl(var(--accent))] underline">aistudio.google.com</a></p>
                                <Inp type="password" value={geminiKey} onChange={setGeminiKey} placeholder="AIza..." />
                                <Button onClick={() => save({ geminiKey })} disabled={saving} className="text-xs self-start">{saving ? "Saving..." : "💾 Save"}</Button>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>Anthropic API Key</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1">Backup provider — Currently Gemini is used for primary generation.</p>
                                <Inp type="password" value={apiKey} onChange={setApiKey} placeholder="sk-ant-..." />
                                {testResult.api && (
                                    <div className={`text-[11px] rounded px-2.5 py-1.5 ${testResult.api === "ok" ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border border-[rgba(16,185,129,0.15)]" : "bg-[rgba(239,68,68,0.06)] text-[hsl(var(--destructive))] border border-[rgba(239,68,68,0.12)]"}`}>
                                        {testResult.api === "ok" ? "✓ API key valid" : "✗ API key invalid or expired"}
                                    </div>
                                )}
                                <div className="flex gap-1.5">
                                    <Button variant="ghost" onClick={testApi} disabled={!apiKey || testing === "api"} className="text-xs">{testing === "api" ? "⏳ Testing..." : "🔑 Test"}</Button>
                                    <Button onClick={() => save({ apiKey })} disabled={saving} className="text-xs">{saving ? "Saving..." : "💾 Save"}</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>

                {/* Column 2: Deploy Targets */}
                <div className="space-y-2">
                    <section>
                        <SectionHeader>🚀 Deploy Targets</SectionHeader>
                        <Card className="mb-4">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>☁️ Cloudflare Profiles</CardTitle>
                                    <Button variant="ghost" onClick={addCfProfile} className="px-2 h-7 text-[10px]">+ Add Profile</Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-2">Multi-account support — each LP can use a different CF account for DNS & deploy</p>

                                {/* Profile List */}
                                {cfProfiles.length === 0 && !editingProfile && (
                                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] text-center py-4 border border-dashed border-[hsl(var(--border))] rounded-lg">
                                        No profiles yet. Click "+ Add Profile" to get started.
                                    </div>
                                )}

                                {cfProfiles.map(p => (
                                    <div key={p.id} className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold">{p.name}</span>
                                                <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">{p.accountId?.slice(0,8)}...</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {profileTestResult[p.id] && (
                                                    <span className={`text-[9px] ${profileTestResult[p.id].ok ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>
                                                        {profileTestResult[p.id].ok ? "●" : "○"} {profileTestResult[p.id].msg}
                                                    </span>
                                                )}
                                                <Button variant="ghost" onClick={() => testCfProfile(p)} className="px-1.5 h-6 text-[9px]">Test</Button>
                                                <Button variant="ghost" onClick={() => setEditingProfile({...p})} className="px-1.5 h-6 text-[9px]">Edit</Button>
                                                <Button variant="ghost" onClick={() => removeCfProfile(p.id)} className="px-1.5 h-6 text-[9px] text-[hsl(var(--destructive))]">×</Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Add/Edit Form */}
                                {editingProfile && (
                                    <div className="border-2 border-[hsl(var(--primary))] rounded-lg p-3 space-y-2 bg-[hsl(var(--primary))/5]">
                                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--primary))]">
                                            {cfProfiles.find(p => p.id === editingProfile.id) ? "Edit Profile" : "New Profile"}
                                        </div>
                                        <div><Lbl>Profile Name</Lbl><Inp value={editingProfile.name} onChange={v => setEditingProfile(p => ({...p, name: v}))} placeholder="e.g. MCC-Alpha, Pet Sites, Loan Sites" /></div>
                                        <div><Lbl>Account ID {editingProfile.accountId && (/^[0-9a-f]{32}$/i.test(editingProfile.accountId.trim()) ? <span className="text-[hsl(var(--success))] text-[10px]">✓ 32 chars</span> : <span className="text-[hsl(var(--destructive))] text-[10px]">✗ {editingProfile.accountId.trim().length}/32</span>)}</Lbl><Inp value={editingProfile.accountId} onChange={v => setEditingProfile(p => ({...p, accountId: v}))} placeholder="32-char hex ID" /></div>
                                        <div><Lbl>API Token</Lbl><Inp type="password" value={editingProfile.apiToken} onChange={v => setEditingProfile(p => ({...p, apiToken: v}))} placeholder="Bearer token..." /></div>
                                        <div className="flex gap-1.5 pt-1">
                                            <Button onClick={saveEditingProfile} disabled={!editingProfile.name?.trim() || !editingProfile.accountId?.trim() || !editingProfile.apiToken?.trim()} className="text-xs">💾 Save Profile</Button>
                                            <Button variant="ghost" onClick={() => setEditingProfile(null)} className="text-xs">Cancel</Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-2 gap-4">
                            <Card className="mb-4">
                                <CardHeader><CardTitle>🔺 Netlify</CardTitle></CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">Personal Access Token + Team Slug</p>
                                    <div><Lbl>Access Token</Lbl><Inp type="password" value={netlifyToken} onChange={setNetlifyToken} placeholder="nfp_..." /></div>
                                    <div><Lbl>Team Slug (Optional)</Lbl><Inp value={netlifyTeamSlug} onChange={setNetlifyTeamSlug} placeholder="my-team-123" /></div>
                                    {testResult.netlify && (
                                        <div className={`text-[11px] rounded px-2 py-1 ${testResult.netlify === "ok" ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border border-[rgba(16,185,129,0.15)]" : "bg-[rgba(239,68,68,0.06)] text-[hsl(var(--destructive))] border border-[rgba(239,68,68,0.12)]"}`}>
                                            {testResult.netlify === "ok" ? "✓ Connected" : "✗ Failed"}
                                        </div>
                                    )}
                                    <div className="flex gap-1.5 mt-2">
                                        <Button variant="ghost" onClick={testNetlify} disabled={!netlifyToken || testing === "netlify"} className="px-2 h-7 text-[10px]">{testing === "netlify" ? "⏳" : "Test"}</Button>
                                        <Button onClick={() => save({ netlifyToken, netlifyTeamSlug })} disabled={saving} className="px-2 h-7 text-[10px]">Save</Button>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="mb-4">
                                <CardHeader><CardTitle>▲ Vercel</CardTitle></CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">Deploy directly to Vercel via API</p>
                                    <div><Lbl>API Token</Lbl><Inp type="password" value={vercelToken} onChange={setVercelToken} placeholder="vercel_..." /></div>
                                    <Button onClick={() => save({ vercelToken })} disabled={saving} className="px-2 h-7 text-[10px] mt-2 self-start">Save</Button>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>🧬 Git Push Pipeline</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">Used by <strong>GitHub Actions (Astro Build)</strong> deploy target — builds Astro templates correctly via CI</p>
                                <Inp type="password" value={githubToken} onChange={setGithubToken} placeholder="GitHub Token" />
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Lbl>Repo Owner</Lbl><Inp value={githubRepoOwner} onChange={setGithubRepoOwner} placeholder="my-user" /></div>
                                    <div><Lbl>Repo Name</Lbl><Inp value={githubRepoName} onChange={setGithubRepoName} placeholder="my-sites-repo" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Lbl>Branch</Lbl><Inp value={githubRepoBranch} onChange={setGithubRepoBranch} placeholder="main" /></div>
                                    <div><Lbl>Workflow File</Lbl><Inp value={githubDeployWorkflow} onChange={setGithubDeployWorkflow} placeholder="deploy-lp.yml" /></div>
                                </div>
                                {testResult.github && (
                                    <div className={`text-[11px] rounded px-2.5 py-1.5 ${testResult.github === "ok" ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border border-[rgba(16,185,129,0.15)]" : "bg-[rgba(239,68,68,0.06)] text-[hsl(var(--destructive))] border border-[rgba(239,68,68,0.12)]"}`}>
                                        {testResult.github === "ok" ? "✓" : "✗"} {testResult.githubDetail || (testResult.github === "ok" ? "Connected" : "Failed")}
                                    </div>
                                )}
                                <div className="flex gap-1.5">
                                    <Button variant="ghost" onClick={testGitHub} disabled={!githubToken || testing === "github"} className="text-xs">{testing === "github" ? "⏳ Testing..." : "🔑 Test"}</Button>
                                    <Button onClick={() => save({ githubToken, githubRepoOwner, githubRepoName, githubRepoBranch, githubDeployWorkflow })} disabled={saving} className="text-xs">💾 Save</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>

                {/* Column 3: Automation & Services (Visible only on very wide screens or stacked) */}
                <div className="space-y-2">
                    <section>
                        <SectionHeader>🤖 Automation</SectionHeader>
                        <Card className="mb-4">
                            <CardHeader><CardTitle>Multilogin X</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">Browser automation & profile management</p>
                                <Inp type="password" value={mlToken} onChange={setMlToken} placeholder="Automation Token" />
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Lbl>Email</Lbl><Inp value={mlEmail} onChange={setMlEmail} placeholder="user@ml.com" /></div>
                                    <div><Lbl>Password</Lbl><Inp type="password" value={mlPassword} onChange={setMlPassword} placeholder="••••" /></div>
                                </div>
                                <div><Lbl>Default Folder ID</Lbl><Inp value={mlFolderId} onChange={setMlFolderId} placeholder="f12345..." /></div>
                                <div className="flex gap-1.5 mt-1">
                                    <Button variant="ghost" onClick={testMl} disabled={testing === "ml"} className="px-2 h-7 text-[10px]">Test</Button>
                                    <Button onClick={() => save({ mlToken, mlEmail, mlPassword, mlFolderId })} disabled={saving} className="px-2 h-7 text-[10px]">Save</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                        <SectionHeader>🔗 External Tracking</SectionHeader>
                        <Card className="mb-4">
                            <CardHeader><CardTitle>Voluum Tracker {testResult.voluum === "ok" ? <span className="text-[hsl(var(--success))] text-[11px] font-normal">● Connected</span> : testResult.voluum === "fail" ? <span className="text-[hsl(var(--destructive))] text-[11px] font-normal">● Failed</span> : null}</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">Generate Access Key in Voluum → Profile → Security → Access Keys</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Lbl>Access Key ID</Lbl><Inp type="password" value={voluumAccessKeyId} onChange={setVoluumAccessKeyId} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxx" /></div>
                                    <div><Lbl>Secret Access Key</Lbl><Inp type="password" value={voluumAccessKey} onChange={setVoluumAccessKey} placeholder="Secret key" /></div>
                                </div>
                                {testResult.voluum && (
                                    <div className={`text-[11px] rounded px-2.5 py-1.5 ${testResult.voluum === "ok" ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border border-[rgba(16,185,129,0.15)]" : "bg-[rgba(239,68,68,0.06)] text-[hsl(var(--destructive))] border border-[rgba(239,68,68,0.12)]"}`}>
                                        {testResult.voluum === "ok" ? "✓" : "✗"} {testResult.voluumDetail || (testResult.voluum === "ok" ? "Authentication successful" : "Authentication failed")}
                                    </div>
                                )}
                                <div className="flex gap-1.5 mt-1">
                                    <Button variant="ghost" onClick={testVoluum} disabled={testing === "voluum"} className="px-2 h-7 text-[10px]">{testing === "voluum" ? "⏳ Testing..." : "🔑 Test Connection"}</Button>
                                    <Button onClick={() => save({ voluumAccessKeyId, voluumAccessKey })} disabled={saving} className="px-2 h-7 text-[10px]">{saving ? "Saving..." : "💾 Save"}</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>🛡️ NodeMaven Proxy {testResult.nm === "ok" ? <span className="text-[hsl(var(--success))] text-[11px] font-normal">● Connected</span> : testResult.nm === "fail" ? <span className="text-[hsl(var(--destructive))] text-[11px] font-normal">● Failed</span> : null}</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">Residential proxy for Multilogin profiles — pre-flight IP quality check</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Lbl>Proxy Username</Lbl><Inp value={nmProxyUser} onChange={setNmProxyUser} placeholder="your-username" /></div>
                                    <div><Lbl>Proxy Password</Lbl><Inp type="password" value={nmProxyPassword} onChange={setNmProxyPassword} placeholder="password" /></div>
                                </div>
                                <Lbl>IPQS API Key <span className="text-[9px] opacity-60">(optional — improves fraud detection)</span></Lbl>
                                <Inp type="password" value={ipqsApiKey} onChange={setIpqsApiKey} placeholder="ipqualityscore.com API key" />
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" checked={proxyCheckEnabled} onChange={e => setProxyCheckEnabled(e.target.checked)} className="rounded border-[hsl(var(--border))]" />
                                        <span className="text-[10px]">Enable pre-flight check</span>
                                    </div>
                                    <div>
                                        <Lbl>Min Trust Score (0-100)</Lbl>
                                        <Inp type="number" value={proxyMinScore} onChange={v => setProxyMinScore(Number(v) || 70)} placeholder="70" />
                                    </div>
                                </div>
                                {testResult.nm && (
                                    <div className={`text-[11px] rounded px-2.5 py-1.5 ${testResult.nm === "ok" ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border border-[rgba(16,185,129,0.15)]" : "bg-[rgba(239,68,68,0.06)] text-[hsl(var(--destructive))] border border-[rgba(239,68,68,0.12)]"}`}>
                                        {testResult.nm === "ok" ? "✓" : "✗"} {testResult.nmDetail || (testResult.nm === "ok" ? "Proxy gateway reachable" : "Connection failed")}
                                    </div>
                                )}
                                <div className="flex gap-1.5 mt-1">
                                    <Button variant="ghost" onClick={async () => {
                                        setTesting("nm");
                                        try {
                                            const { nodemavenApi } = await import("../services/nodemaven.js");
                                            const result = await nodemavenApi.testConnection({ username: nmProxyUser, password: nmProxyPassword });
                                            setTestResult(prev => ({ ...prev, nm: result.ok ? "ok" : "fail", nmDetail: result.ok ? `Gateway OK — ${result.latencyMs}ms` : (result.error || "Failed") }));
                                        } catch (e) {
                                            setTestResult(prev => ({ ...prev, nm: "fail", nmDetail: e?.message || "Error" }));
                                        }
                                        setTesting(null);
                                    }} disabled={testing === "nm" || !nmProxyUser} className="px-2 h-7 text-[10px]">{testing === "nm" ? "⏳ Testing..." : "🔑 Test Connection"}</Button>
                                    <Button onClick={() => save({ nmProxyUser, nmProxyPassword, ipqsApiKey, proxyCheckEnabled, proxyMinScore })} disabled={saving} className="px-2 h-7 text-[10px]">{saving ? "Saving..." : "💾 Save"}</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>🔄 Proxy Providers (Fallback)</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">Backup residential proxy providers — auto-fallback when primary fails quality check</p>
                                <div>
                                    <Lbl>Primary Provider</Lbl>
                                    <Sel value={proxyPrimaryProvider} onChange={setProxyPrimaryProvider} options={[
                                        { value: "nodemaven", label: "NodeMaven" },
                                        { value: "smartproxy", label: "SmartProxy" },
                                        { value: "soax", label: "SOAX" },
                                        { value: "brightdata", label: "Bright Data" },
                                    ]} />
                                </div>
                                <div className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-2">
                                    <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">SmartProxy</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><Lbl>Username</Lbl><Inp value={spProxyUser} onChange={setSpProxyUser} placeholder="sp-username" /></div>
                                        <div><Lbl>Password</Lbl><Inp type="password" value={spProxyPassword} onChange={setSpProxyPassword} placeholder="password" /></div>
                                    </div>
                                </div>
                                <div className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-2">
                                    <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">SOAX</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><Lbl>Username</Lbl><Inp value={soaxProxyUser} onChange={setSoaxProxyUser} placeholder="soax-username" /></div>
                                        <div><Lbl>Password</Lbl><Inp type="password" value={soaxProxyPassword} onChange={setSoaxProxyPassword} placeholder="password" /></div>
                                    </div>
                                </div>
                                <div className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-2">
                                    <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Bright Data</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div><Lbl>Customer ID</Lbl><Inp value={bdCustomer} onChange={setBdCustomer} placeholder="lum-customer-xxx" /></div>
                                        <div><Lbl>Zone</Lbl><Inp value={bdZone} onChange={setBdZone} placeholder="residential" /></div>
                                        <div><Lbl>Password</Lbl><Inp type="password" value={bdPassword} onChange={setBdPassword} placeholder="password" /></div>
                                    </div>
                                </div>
                                <Button onClick={() => save({ spProxyUser, spProxyPassword, soaxProxyUser, soaxProxyPassword, bdCustomer, bdZone, bdPassword, proxyPrimaryProvider })} disabled={saving} className="px-2 h-7 text-[10px] self-start">{saving ? "Saving..." : "💾 Save Providers"}</Button>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>🔬 IP Quality APIs</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">API keys for IP quality pipeline — ASN check, fraud detection, proxy/VPN detection, timezone verification</p>
                                <div className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-2">
                                    <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">IPinfo <span className="font-normal opacity-60">— ASN, ISP, Timezone, Geo</span></div>
                                    <Inp type="password" value={ipinfoToken} onChange={setIpinfoToken} placeholder="ipinfo.io access token" />
                                </div>
                                <div className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-2">
                                    <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Scamalytics <span className="font-normal opacity-60">— Fraud Score</span></div>
                                    <Inp type="password" value={scamalyticsKey} onChange={setScamalyticsKey} placeholder="scamalytics.com API key" />
                                </div>
                                <div className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-2">
                                    <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">IP2Location <span className="font-normal opacity-60">— Proxy/VPN Detection</span></div>
                                    <Inp type="password" value={ip2locationKey} onChange={setIp2locationKey} placeholder="ip2location.io API key" />
                                </div>
                                <p className="text-[9px] text-[hsl(var(--muted-foreground))] italic">All optional — pipeline falls back to IPQS + ip-api.com when keys are missing</p>
                                <Button onClick={() => save({ ipinfoToken, scamalyticsKey, ip2locationKey })} disabled={saving} className="px-2 h-7 text-[10px] self-start">{saving ? "Saving..." : "💾 Save API Keys"}</Button>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>LendingCard {testResult.lc === "ok" ? <span className="text-[hsl(var(--success))] text-[11px] font-normal">● Connected</span> : testResult.lc === "fail" ? <span className="text-[hsl(var(--destructive))] text-[11px] font-normal">● Failed</span> : null}</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">Virtual card provider for Google Ads billing</p>
                                <Lbl>API Token</Lbl><Inp type="password" value={lcToken} onChange={setLcToken} placeholder="b2f..." />
                                {testResult.lc && (
                                    <div className={`text-[11px] rounded px-2.5 py-1.5 ${testResult.lc === "ok" ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border border-[rgba(16,185,129,0.15)]" : "bg-[rgba(239,68,68,0.06)] text-[hsl(var(--destructive))] border border-[rgba(239,68,68,0.12)]"}`}>
                                        {testResult.lc === "ok" ? "✓" : "✗"} {testResult.lcDetail || (testResult.lc === "ok" ? "Connected" : "Failed")}
                                    </div>
                                )}
                                <div className="flex gap-1.5 mt-1">
                                    <Button variant="ghost" onClick={testLc} disabled={testing === "lc"} className="px-2 h-7 text-[10px]">{testing === "lc" ? "⏳ Testing..." : "🔑 Test Connection"}</Button>
                                    <Button onClick={() => save({ lcToken })} disabled={saving} className="px-2 h-7 text-[10px]">{saving ? "Saving..." : "💾 Save"}</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                        <SectionHeader>🎨 Appearance</SectionHeader>
                        <AppearanceSection />
                    </section>

                    <section>
                        <SectionHeader>📊 Performance Stats</SectionHeader>
                        <Card className="mb-4">
                            <CardHeader><CardTitle>Project Overview</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div><div className="text-[20px] font-bold">{stats.builds}</div><div className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">Builds</div></div>
                                    <div><div className="text-[20px] font-bold text-[hsl(var(--accent))]">${stats.spend.toFixed(2)}</div><div className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">Spend</div></div>
                                    <div><div className="text-[20px] font-bold text-[hsl(var(--success))]">90+</div><div className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">Score</div></div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </div>
        </div>
    );
}
