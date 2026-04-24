import { useState, useEffect } from "react";

import { InputField as Inp, SelectField as Sel } from "./ui/input-field";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { api, getResolvedApiBase } from "../services/api";

/** Host part of Neon URL for diagnostics (password masked). */
function neonEndpointHost(conn) {
    if (!conn || typeof conn !== "string" || !conn.includes("@")) return "";
    return conn.replace(/:[^:@]+@/, ":****@").split("@")[1]?.split("/")[0] || "";
}
import { multiloginApi } from "../services/multilogin";
import { getCfApiBase } from "../utils/api-proxy";
import { detectIncompleteSettings } from "../services/account-lock";
import { migrateSitesToD1 } from "../services/d1";
import { loadSites } from "../services/neon";
import { syncCloudflareRepoSecrets, isLikelyMaskedGithubSecret } from "../utils/github-repo-secrets";
import { getAdsPowerStatus, listAdsPowerProfiles, resolveAdsPowerBaseUrl } from "../services/adspower";
import { getProxyConfigWithFallback, getProviderFallbackOrder } from "../services/proxy-providers";
import { runQualityPipeline } from "../services/ip-quality-pipeline";
import { postProxyResolveIp } from "../services/nodemaven";

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
                        <button type="button" key={p.label} onClick={() => applyPreset(p)}
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

/** Stable-width hex id hint — avoids layout jump + scroll anchoring pulling the page while typing */
function Hex32IdHint({ value }) {
    const t = String(value || "").trim();
    const len = t.length;
    const ok = /^[0-9a-f]{32}$/i.test(t);
    return (
        <span className="text-[10px] font-mono tabular-nums inline-block min-w-[4.75rem] text-left align-middle">
            {len === 0 ? (
                <span className="invisible select-none" aria-hidden>
                    00/32
                </span>
            ) : ok ? (
                <span className="text-[hsl(var(--success))]">✓ 32</span>
            ) : (
                <span className="text-[hsl(var(--destructive))]">✗ {len}/32</span>
            )}
        </span>
    );
}

export function Settings({ settings, setSettings, stats, apiOk, neonOk, sitesCount = 0 }) {
    const asArray = (v) => Array.isArray(v) ? v : [];
    const [neonUrl, setNeonUrl] = useState(settings.neonUrl || import.meta.env.VITE_NEON_URL || "");
    /** Same Worker URL as production dashboard — avoids hitting a different D1 than the main site */
    const [apiBase, setApiBase] = useState(settings.apiBase || import.meta.env.VITE_API_BASE || "");
    const [apiKey, setApiKey] = useState(settings.apiKey || "");
    const [geminiKey, setGeminiKey] = useState(settings.geminiKey || "");
    const [netlifyToken, setNetlifyToken] = useState(settings.netlifyToken || "");
    const [netlifyTeamSlug, setNetlifyTeamSlug] = useState(settings.netlifyTeamSlug || "");
    const [lcToken, setLcToken] = useState(settings.lcToken || import.meta.env.VITE_LENDINGCARD_TOKEN || import.meta.env.PUBLIC_LENDINGCARD_API_TOKEN || "");
    const [mlToken, setMlToken] = useState(settings.mlToken || "");
    const [mlEmail, setMlEmail] = useState(settings.mlEmail || "");
    const [mlPassword, setMlPassword] = useState(settings.mlPassword || "");
    const [mlFolderId, setMlFolderId] = useState(settings.mlFolderId || "");

    // AdsPower Local API (paid) — https://localapi-doc-en.adspower.com/docs/Rdw7Iu
    const [adspowerApiKey, setAdspowerApiKey] = useState(settings.adspowerApiKey || "");
    const [adspowerLocalBase, setAdspowerLocalBase] = useState(settings.adspowerLocalBase || "");

    // Voluum API
    const [voluumAccessKeyId, setVoluumAccessKeyId] = useState(settings.voluumAccessKeyId || import.meta.env.VITE_VOLUUM_ACCESS_KEY_ID || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY_ID || "");
    const [voluumAccessKey, setVoluumAccessKey] = useState(settings.voluumAccessKey || import.meta.env.VITE_VOLUUM_ACCESS_KEY || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY || "");

    // Deploy credentials
    const [cfApiToken, setCfApiToken] = useState(settings.cfApiToken || import.meta.env.VITE_CF_API_TOKEN || "");
    const [cfAccountId, setCfAccountId] = useState(settings.cfAccountId || import.meta.env.VITE_CF_ACCOUNT_ID || "");
    // Optional read-only CF token used ONLY for "Test" buttons in Settings.
    // Keeps health-check requests off the deploy token's rate-limit bucket,
    // which is what burns through the 10429 (Rate limited) allowance.
    const [cfReadApiToken, setCfReadApiToken] = useState(settings.cfReadApiToken || import.meta.env.VITE_CF_READ_API_TOKEN || "");

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
    const [ghSecretsProfileId, setGhSecretsProfileId] = useState("");
    const [githubSecretsSyncing, setGithubSecretsSyncing] = useState(false);
    const [githubSecretsSyncMsg, setGithubSecretsSyncMsg] = useState("");

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
    const [spProxyHost, setSpProxyHost] = useState(settings.spProxyHost || "");
    const [spProxyHttpPort, setSpProxyHttpPort] = useState(settings.spProxyHttpPort != null ? String(settings.spProxyHttpPort) : "");
    const [spProxySocksPort, setSpProxySocksPort] = useState(settings.spProxySocksPort != null ? String(settings.spProxySocksPort) : "");
    const [soaxProxyUser, setSoaxProxyUser] = useState(settings.soaxProxyUser || "");
    const [soaxProxyPassword, setSoaxProxyPassword] = useState(settings.soaxProxyPassword || "");
    const [bdCustomer, setBdCustomer] = useState(settings.bdCustomer || "");
    const [bdZone, setBdZone] = useState(settings.bdZone || "");
    const [bdPassword, setBdPassword] = useState(settings.bdPassword || "");
    const [proxyPrimaryProvider, setProxyPrimaryProvider] = useState(settings.proxyPrimaryProvider || "nodemaven");
    /** Optional Node relay (VPS/WSL) when Cloudflare Worker returns 502 for TCP to proxy */
    const [proxyResolveRelayUrl, setProxyResolveRelayUrl] = useState(settings.proxyResolveRelayUrl || "");

    // IP Quality APIs
    const [ipinfoToken, setIpinfoToken] = useState(settings.ipinfoToken || "");
    const [scamalyticsKey, setScamalyticsKey] = useState(settings.scamalyticsKey || "");
    const [scamalyticsUsername, setScamalyticsUsername] = useState(settings.scamalyticsUsername || "");
    const [ip2locationKey, setIp2locationKey] = useState(settings.ip2locationKey || "");

    const [hideRevenue, setHideRevenue] = useState(settings.hideRevenue === true);

    useEffect(() => {
        const envB = import.meta.env.VITE_API_BASE;
        if (envB && String(envB).trim()) {
            setApiBase(String(envB).trim().replace(/\/+$/, ""));
            return;
        }
        if (typeof settings?.apiBase === "string") setApiBase(settings.apiBase);
    }, [settings?.apiBase]);

    useEffect(() => {
        const envN = import.meta.env.VITE_NEON_URL;
        if (envN && String(envN).includes("@")) {
            setNeonUrl(String(envN).trim());
            return;
        }
        if (typeof settings?.neonUrl === "string" && settings.neonUrl) setNeonUrl(settings.neonUrl);
    }, [settings?.neonUrl]);

    /** Raw `sites` row count from Worker GET /init (D1) — compare to merged in-app list when Neon is on */
    const [workerInitSiteRows, setWorkerInitSiteRows] = useState(null);
    useEffect(() => {
        let cancelled = false;
        api.get("/init")
            .then((d) => {
                if (cancelled || d?.error) return;
                setWorkerInitSiteRows(Array.isArray(d.sites) ? d.sites.length : null);
            })
            .catch(() => {
                if (!cancelled) setWorkerInitSiteRows(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

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
        const updated = {
            ...editingProfile,
            accountId: cleanId,
            // Persist optional read-only token (trimmed; empty string drops the field cleanly)
            readApiToken: String(editingProfile.readApiToken || "").trim(),
        };
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
        // Prefer the read-only token when present so Test clicks don't drain the deploy token's 10429 bucket.
        const testToken = String(profile.readApiToken || "").trim() || profile.apiToken;
        try {
            const r = await fetch(`${cfBase}/accounts/${cleanId}/pages/projects?per_page=1`, {
                headers: { Authorization: `Bearer ${testToken}` },
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                setProfileTestResult(p => ({ ...p, [profile.id]: { ok: false, msg: err.errors?.[0]?.message || `HTTP ${r.status}` } }));
            } else {
                // Also check zones
                const zr = await fetch(`${cfBase}/zones?account.id=${cleanId}&per_page=5`, {
                    headers: { Authorization: `Bearer ${testToken}` },
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

    const ghSyncProfileOptions =
        cfProfiles.length > 0
            ? [
                ...cfProfiles.map((p) => ({ value: p.id, label: p.name?.trim() || p.id })),
                { value: "__legacy__", label: "Legacy: ช่อง CF Account + Token ด้านบน" },
            ]
            : [{ value: "__legacy__", label: "Legacy: ช่อง CF Account + Token ด้านบน" }];

    const pickCfForGithubSync = () => {
        const pid = ghSecretsProfileId || cfProfiles[0]?.id || "__legacy__";
        if (pid === "__legacy__") {
            return { accountId: String(cfAccountId || "").trim(), token: String(cfApiToken || "").trim() };
        }
        const p = cfProfiles.find((x) => x.id === pid);
        if (p) return { accountId: String(p.accountId || "").trim(), token: String(p.apiToken || "").trim() };
        return { accountId: String(cfAccountId || "").trim(), token: String(cfApiToken || "").trim() };
    };

    const syncGithubCfSecrets = async () => {
        setGithubSecretsSyncMsg("");
        const owner = String(githubRepoOwner || "").trim();
        const repo = String(githubRepoName || "").trim();
        const token = String(githubToken || "").trim();
        if (isLikelyMaskedGithubSecret(token)) {
            setGithubSecretsSyncMsg("⚠ ใส่ GitHub token จริงในช่องแล้วกด Save (หรือรีโหลดหน้า) — ตัวบังตาไม่ใช้ซิงก์ได้");
            return;
        }
        if (!owner || !repo || !token) {
            setGithubSecretsSyncMsg("⚠ กรอก GitHub token + Repo owner + Repo name");
            return;
        }
        const { accountId, token: cfTok } = pickCfForGithubSync();
        if (!cfTok || !accountId) {
            setGithubSecretsSyncMsg("⚠ เลือก Cloudflare profile ที่มี Account ID + Token หรือกรอก CF ในโหมด legacy ด้านบน");
            return;
        }
        setGithubSecretsSyncing(true);
        try {
            await syncCloudflareRepoSecrets({
                token,
                owner,
                repo,
                cfApiToken: cfTok,
                cfAccountId: accountId,
            });
            setGithubSecretsSyncMsg("✓ อัปเดต CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID บน GitHub แล้ว (ทับ secret เดิมได้)");
        } catch (e) {
            setGithubSecretsSyncMsg(`✗ ${e?.message || e}`);
        } finally {
            setGithubSecretsSyncing(false);
        }
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
        // Use the read-only token for Test clicks when available — keeps this
        // off the deploy token's rate-limit bucket (prevents code 10429).
        const testToken = String(cfReadApiToken || "").trim() || cfApiToken;
        try {
            // Test 1: Verify token by listing Pages projects
            const pagesRes = await fetch(`${cfBase}/accounts/${cleanId}/pages/projects?per_page=1`, {
                headers: { Authorization: `Bearer ${testToken}` },
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
                headers: { Authorization: `Bearer ${testToken}` },
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

    const testAdsPower = async () => {
        setTesting("adspower");
        const apSettings = { adspowerApiKey, adspowerLocalBase };
        try {
            const st = await getAdsPowerStatus(apSettings);
            if (!st.ok) {
                setTestResult((p) => ({
                    ...p,
                    adspower: "fail",
                    adspowerDetail: st.error || "status failed",
                }));
                setTesting(null);
                return;
            }
            const list = await listAdsPowerProfiles(apSettings, { page: 1, limit: 5 });
            const n = list.ok ? list.profiles?.length ?? 0 : 0;
            setTestResult((p) => ({
                ...p,
                adspower: "ok",
                adspowerDetail: list.ok
                    ? `Local API OK — sample ${n} profile(s) on page 1`
                    : `Status OK — list: ${list.error || "n/a"}`,
            }));
        } catch (e) {
            console.warn("[Settings] AdsPower test failed:", e?.message || e);
            setTestResult((p) => ({
                ...p,
                adspower: "fail",
                adspowerDetail: e?.message || String(e),
            }));
        }
        setTesting(null);
    };

    const save = async (s) => {
        const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
        setSaving(true);
        try {
            await setSettings(s);
        } finally {
            setSaving(false);
            const restore = () => window.scrollTo(0, scrollY);
            restore();
            requestAnimationFrame(restore);
        }
    };

    const Lbl = ({ children }) => <span className="text-[10px] text-[hsl(var(--muted-foreground))] block mb-0.5">{children}</span>;

    const scrollToSettingsId = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const SettingsNavBtn = ({ id, children }) => (
        <button
            type="button"
            onClick={(e) => {
                e.preventDefault();
                scrollToSettingsId(id);
            }}
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-left bg-[hsl(var(--muted))]/35 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/55 hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border))]/60 transition-colors"
        >
            {children}
        </button>
    );

    const SettingsSection = ({ id, icon, title, desc, children, className = "" }) => (
        <section id={id} className={`scroll-mt-24 pt-8 first:pt-2 border-t border-[hsl(var(--border))]/80 first:border-t-0 ${className}`}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-5">
                <span className="text-2xl shrink-0 leading-none" aria-hidden>
                    {icon}
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-[hsl(var(--foreground))] m-0 tracking-tight">{title}</h2>
                    {desc ? <p className="text-[12px] text-[hsl(var(--muted-foreground))] m-0 mt-1.5 max-w-3xl leading-relaxed">{desc}</p> : null}
                </div>
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    );

    return (
        <div
            className="max-w-5xl mx-auto animate-[fadeIn_.3s_ease] px-1 sm:px-0"
            style={{ overflowAnchor: "none" }}
        >
            <header className="mb-5">
                <h1 className="text-[24px] font-bold m-0 mb-1">Settings</h1>
                <p className="text-[hsl(var(--muted-foreground))] text-sm m-0">ตั้งค่า API, ฐานข้อมูล, deploy, tracking และ automation — จัดเป็นหมวดด้านล่าง</p>
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

            <nav
                className="sticky top-12 sm:top-14 z-20 mb-8 flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]/85 backdrop-blur-md shadow-sm"
                aria-label="หมวด Settings"
            >
                <SettingsNavBtn id="settings-access">สิทธิ์ & สถานะ</SettingsNavBtn>
                <SettingsNavBtn id="settings-data">ฐานข้อมูล</SettingsNavBtn>
                <SettingsNavBtn id="settings-ai">AI</SettingsNavBtn>
                <SettingsNavBtn id="settings-deploy">Deploy</SettingsNavBtn>
                <SettingsNavBtn id="settings-tracking">Tracking</SettingsNavBtn>
                <SettingsNavBtn id="settings-browsers">เบราว์เซอร์</SettingsNavBtn>
                <SettingsNavBtn id="settings-proxy">พร็อกซี & IP</SettingsNavBtn>
                <SettingsNavBtn id="settings-ui">หน้าตา</SettingsNavBtn>
                <SettingsNavBtn id="settings-stats">สถิติ</SettingsNavBtn>
            </nav>

            <div className="pb-20">
                <SettingsSection
                    id="settings-access"
                    icon="🔐"
                    title="สิทธิ์การมองเห็น & สถานะระบบ"
                    desc="ซ่อนตัวเลขรายได้จากมุมมองพนักงาน และดูสถานะการเชื่อมต่อ Neon / Legacy API"
                >
                    <div className="flex flex-wrap gap-2">
                        <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg border shadow-sm ${neonOk ? "bg-[rgba(16,185,129,0.1)] text-[hsl(var(--success))] border-[rgba(16,185,129,0.2)]" : "bg-[rgba(239,68,68,0.1)] text-[hsl(var(--destructive))] border-[rgba(239,68,68,0.2)]"}`}>
                            <span className="text-sm">{neonOk ? "●" : "○"}</span>
                            {neonOk ? "Neon DB Connected" : "Neon DB Offline"}
                        </div>
                        <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg border shadow-sm ${apiOk ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border-[rgba(16,185,129,0.15)]" : "bg-[rgba(100,100,100,0.1)] text-[hsl(var(--muted-foreground))] border-[rgba(100,100,100,0.15)]"}`}>
                            <span className="text-sm">{apiOk ? "●" : "○"}</span>
                            {apiOk ? "Legacy API Active" : "Legacy API Offline"}
                        </div>
                    </div>
                    <Card>
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
                </SettingsSection>

                <SettingsSection
                    id="settings-data"
                    icon="🗄️"
                    title="ฐานข้อมูล"
                    desc="Neon Postgres = แหล่งหลัก (sites, settings, deploys) · Cloudflare D1 = edge SQL สำหรับ Worker"
                >
                    <Card className="mb-0 border-[hsl(var(--primary))]/25 bg-[hsl(var(--primary))]/5">
                        <CardHeader><CardTitle>🔗 API Worker (ให้ตรงกับเว็บหลัก)</CardTitle></CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1 leading-relaxed">
                                Local dev ค่าเริ่มต้นชี้ไป Worker ตัวเดียวในโค้ด — ถ้าเว็บหลักใช้ Worker / D1 อื่น จำนวนเว็บจะไม่ตรง
                                ใส่ URL ฐานของ Worker เดียวกับ production (ลงท้าย <code className="text-[10px] font-mono">/api</code>) แล้ว Save
                                · ว่าง = ใช้ <code className="text-[10px] font-mono">VITE_API_BASE</code> หรือ default
                            </p>
                            <div>
                                <span className="text-[10px] text-[hsl(var(--muted-foreground))] block mb-0.5">Worker base</span>
                                <Inp value={apiBase} onChange={setApiBase} placeholder="https://your-worker.workers.dev/api" />
                            </div>
                            <Button type="button" onClick={() => save({ apiBase: apiBase.trim() })} disabled={saving} className="text-xs self-start">
                                {saving ? "Saving..." : "💾 Save API base"}
                            </Button>
                        </CardContent>
                    </Card>
                    <Card className="mb-4 border-[hsl(var(--border))] bg-[hsl(var(--card))]/80">
                        <CardHeader><CardTitle className="text-sm">ทำไม “ฐานข้อมูล” ถึงไม่ตรงกับที่คาด</CardTitle></CardHeader>
                        <CardContent className="text-[11px] text-[hsl(var(--muted-foreground))] space-y-2 leading-relaxed">
                            <p>
                                แอปนี้ไม่ได้มีตารางเดียว: <strong className="text-[hsl(var(--foreground))]">Neon</strong> เก็บไซต์/settings หลัก
                                ส่วน <strong className="text-[hsl(var(--foreground))]">Worker (D1)</strong> มีตาราง <code className="text-[10px] font-mono">sites</code> แยก
                                — ตอน boot จะ <strong className="text-[hsl(var(--foreground))]">merge + dedupe ตามโดเมน</strong> ดังนั้นจำนวนแถวอาจไม่เท่ากับ Neon หรือ D1 ดิบ
                            </p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Template Manager เคยนับ usage จาก D1 <code className="text-[10px]">site_versions</code> — ตอนนี้การ์ดใช้รายการเดียวกับ My Sites</li>
                                <li>ถ้า <code className="text-[10px]">VITE_NEON_URL</code> ใน build มีค่า ระบบจะบังคับใช้ Neon นั้น (override ที่พิมพ์ใน Settings)</li>
                            </ul>
                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 p-2.5 font-mono text-[10px] text-[hsl(var(--foreground))] space-y-1">
                                <div className="font-sans text-[10px] text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))] pb-1.5 mb-1">
                                    <strong className="text-[hsl(var(--foreground))]">ให้ตรงเว็บหลัก:</strong> ใส่ใน repo-root <code className="text-[9px]">.env</code> ให้ครบ <code className="text-[9px]">VITE_NEON_URL</code> + <code className="text-[9px]">VITE_API_BASE</code> ชุดเดียวกับที่ build production แล้วรีสตาร์ท <code className="text-[9px]">npm run dev</code>
                                </div>
                                <div>Build มี VITE_NEON_URL: {import.meta.env.VITE_NEON_URL ? "ใช่" : "ไม่"} · VITE_API_BASE: {import.meta.env.VITE_API_BASE ? "ใช่" : "ไม่"}</div>
                                <div>Neon endpoint (จาก settings หลัง merge): {neonEndpointHost(settings?.neonUrl) || "—"}</div>
                                <div>Worker ที่เรียกจริง: {getResolvedApiBase()}</div>
                                <div>Neon: {neonOk ? "เชื่อมแล้ว" : "ไม่ได้ใช้ / ล้มเหลว"} · API /init: {apiOk ? "โหลดได้" : "ไม่ได้"}</div>
                                <div>
                                    ไซต์ในแอป (หลัง merge): <strong>{sitesCount}</strong>
                                    {workerInitSiteRows != null && (
                                        <> · แถว <code className="text-[10px]">sites</code> จาก /init (D1): <strong>{workerInitSiteRows}</strong></>
                                    )}
                                </div>
                                {neonOk && workerInitSiteRows != null && workerInitSiteRows !== sitesCount && (
                                    <div className="text-[hsl(var(--warning))] font-sans text-[11px] pt-1">
                                        ตัวเลขต่างกันปกติได้ถ้า Neon เปิดอยู่ (รายการบนจอ = Neon รวม D1 แล้วลบซ้ำโดเมน) — ถ้าคาดว่าควรเท่ากันทุกที่ ให้เช็คว่า Neon กับ Worker เป็นคนละโปรเจกต์หรือไม่
                                    </div>
                                )}
                            </div>
                            {!!import.meta.env.VITE_NEON_URL && (
                                <p className="text-[hsl(var(--warning))]">
                                    โหมด dev: <code className="text-[10px]">VITE_NEON_URL</code> ถูกฝังใน build — ถ้าไม่ใช่โปรเจกต์เดียวกับ production จะเห็นข้อมูลคนละชุดกับเว็บหลัก
                                </p>
                            )}
                        </CardContent>
                    </Card>
                    <div className="grid md:grid-cols-2 gap-4 items-start">
                        <Card className="mb-0">
                            <CardHeader><CardTitle>Neon Postgres</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1">Serverless Postgres for persistent storage (settings, sites, deploys)</p>
                                <div className="rounded-md border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-2.5 text-[11px] text-[hsl(var(--foreground))] leading-relaxed">
                                    <strong className="text-[hsl(var(--warning))]">โปรเจกต์ที่ถูก:</strong> ใน Neon Console ชื่อโปรเจกต์หลักคือ <strong>FusionOps</strong> (ข้อมูล LP จริง) — อย่าสับกับ <code className="text-[10px]">fusionops-production</code> (region อื่น) หรือ <code className="text-[10px]">lp-factory-admin</code>
                                    <br />
                                    <span className="text-[hsl(var(--muted-foreground))]">คัด connection string จาก Dashboard → โปรเจกต์ที่ถูก → Connection details เท่านั้น · ถ้ามี <code className="text-[10px]">VITE_NEON_URL</code> ใน build จะบังคับทับค่าด้านล่าง</span>
                                    <br />
                                    <span className="text-[hsl(var(--muted-foreground))]">เมื่อเชื่อมสำเร็จ แอปจะส่ง <code className="text-[10px]">neonUrl</code> ไปที่ Worker — ทุกคนที่ใช้ Worker ตัวเดียวกันจะได้ URL ชุดนั้น</span>
                                </div>
                                <div><Lbl>Connection String (pooler)</Lbl><Inp type="password" value={neonUrl} onChange={setNeonUrl} placeholder="postgresql://user:pass@ep-xxx.us-west-2.aws.neon.tech/neondb?sslmode=require" /></div>
                                {neonOk && <div className="text-[11px] text-[hsl(var(--success))]">✓ Connected to Neon</div>}
                                <Button onClick={() => save({ neonUrl })} disabled={saving || !neonUrl} className="text-xs self-start">{saving ? "Connecting..." : "💾 Save & Connect"}</Button>
                            </CardContent>
                        </Card>

                        <Card className="mb-0">
                            <CardHeader><CardTitle>☁️ Cloudflare D1 Database</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1">Edge SQL database for low-latency queries</p>
                                <div><Lbl>Account ID <Hex32IdHint value={d1AccountId} /></Lbl><Inp value={d1AccountId} onChange={setD1AccountId} placeholder="32-char hex account ID" /></div>
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
                    </div>
                </SettingsSection>

                <SettingsSection
                    id="settings-ai"
                    icon="🧠"
                    title="AI providers"
                    desc="Gemini ใช้เป็นหลักสำหรับ generate คอนเทนต์ — Anthropic เป็นช่องทางสำรอง"
                >
                    <div className="grid md:grid-cols-2 gap-4 items-start">
                        <Card className="mb-0">
                            <CardHeader><CardTitle>Gemini API Key <span className="text-[hsl(var(--success))] text-[11px] font-normal">⭐ For AI Generation</span></CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1">🔑 Required for AI Copy Generator — Get free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-[hsl(var(--accent))] underline">aistudio.google.com</a></p>
                                <Inp type="password" value={geminiKey} onChange={setGeminiKey} placeholder="AIza..." />
                                <Button onClick={() => save({ geminiKey })} disabled={saving} className="text-xs self-start">{saving ? "Saving..." : "💾 Save"}</Button>
                            </CardContent>
                        </Card>

                        <Card className="mb-0">
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
                    </div>
                </SettingsSection>

                <SettingsSection
                    id="settings-deploy"
                    icon="🚀"
                    title="Deploy targets"
                    desc="Cloudflare หลายโปรไฟล์, Netlify, Vercel และ GitHub / CI — ใช้กับ Wizard และปุ่ม deploy"
                >
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
                                        <div><Lbl>Account ID <Hex32IdHint value={editingProfile.accountId} /></Lbl><Inp value={editingProfile.accountId} onChange={v => setEditingProfile(p => ({...p, accountId: v}))} placeholder="32-char hex ID" /></div>
                                        <div><Lbl>API Token <span className="text-[9px] text-[hsl(var(--muted-foreground))]">(deploy — Pages:Edit, Workers:Edit, etc.)</span></Lbl><Inp type="password" value={editingProfile.apiToken} onChange={v => setEditingProfile(p => ({...p, apiToken: v}))} placeholder="Bearer token..." /></div>
                                        <div>
                                            <Lbl>
                                                Read-only API Token
                                                <span className="text-[9px] text-[hsl(var(--muted-foreground))]"> (optional — used only by Test buttons to avoid 10429 rate limits on the deploy token)</span>
                                            </Lbl>
                                            <Inp
                                                type="password"
                                                value={editingProfile.readApiToken || ""}
                                                onChange={v => setEditingProfile(p => ({ ...p, readApiToken: v }))}
                                                placeholder="Bearer token with Account:Read + Zone:Read (optional)"
                                            />
                                        </div>
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
                                <div className="text-[10px] leading-relaxed rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))/20] px-2.5 py-2 space-y-1">
                                    <div className="font-semibold text-[hsl(var(--foreground))]">แยกบทบาท: พนักงาน vs แอดมิน</div>
                                    <p className="text-[hsl(var(--muted-foreground))]"><strong className="text-[hsl(var(--foreground))]">พนักงาน</strong> ใส่แค่ Token + Repo ด้านล่าง — ชี้ DNS ผ่าน <strong>Cloudflare Profile</strong> ใน Wizard (ไม่ต้องเข้า GitHub Secrets)</p>
                                    <p className="text-[hsl(var(--muted-foreground))]"><strong className="text-[hsl(var(--foreground))]">แอดมิน</strong> ใช้ปุ่ม <strong className="text-[hsl(var(--foreground))]">Sync CF → GitHub Secrets</strong> ด้านล่าง (ทับ secret เดิมได้) หรือตั้งมือใน GitHub → Secrets — ใช้ <strong className="text-[hsl(var(--foreground))]">Update</strong> ไม่ใช่สร้างชื่อซ้ำ</p>
                                    <p className="text-[hsl(var(--muted-foreground))]">Deploy config ค่าเริ่มต้นจะให้ CI <strong className="text-[hsl(var(--foreground))]">ข้ามการแก้ DNS</strong> (<code className="text-[9px]">skipDnsUpsert: true</code>) เพื่อไม่พึ่ง zone ใน GitHub; ต้องการให้ CI ตั้ง CNAME เองให้ตั้ง <code className="text-[9px]">skipDnsUpsert: false</code> ในไฟล์ deploy-config</p>
                                    {githubRepoOwner?.trim() && githubRepoName?.trim() ? (
                                        <a className="text-[hsl(var(--primary))] underline-offset-2 hover:underline text-[10px] break-all" href={`https://github.com/${String(githubRepoOwner).trim()}/${String(githubRepoName).trim()}/settings/secrets/actions`} target="_blank" rel="noreferrer">เปิดหน้า Actions secrets ของ repo นี้ →</a>
                                    ) : null}
                                </div>
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
                                <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] space-y-2">
                                    <div className="text-[10px] font-semibold text-[hsl(var(--foreground))]">Sync CF → GitHub Actions secrets</div>
                                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-snug">GitHub token ต้องมีสิทธิ์ <code className="text-[8px] bg-[hsl(var(--muted))/40] px-0.5 rounded">repo</code> (classic) หรือ fine-grained: <strong>Secrets</strong> = Read/Write สำหรับ repo นี้</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                                        <div>
                                            <Lbl>แหล่ง Cloudflare</Lbl>
                                            <Sel
                                                value={ghSecretsProfileId || cfProfiles[0]?.id || "__legacy__"}
                                                onChange={setGhSecretsProfileId}
                                                options={ghSyncProfileOptions}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={syncGithubCfSecrets}
                                            disabled={githubSecretsSyncing || !githubRepoOwner?.trim() || !githubRepoName?.trim()}
                                            className="text-xs h-9"
                                        >
                                            {githubSecretsSyncing ? "⏳ กำลังซิงก์…" : "☁️ Sync CLOUDFLARE_* → GitHub"}
                                        </Button>
                                    </div>
                                    {githubSecretsSyncMsg ? (
                                        <div className={`text-[10px] rounded px-2 py-1.5 border ${githubSecretsSyncMsg.startsWith("✓") ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border-[rgba(16,185,129,0.2)]" : "bg-[rgba(239,68,68,0.06)] text-[hsl(var(--destructive))] border-[rgba(239,68,68,0.15)]"}`}>
                                            {githubSecretsSyncMsg}
                                        </div>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                </SettingsSection>

                <SettingsSection
                    id="settings-browsers"
                    icon="🖥️"
                    title="เบราว์เซอร์ & automation"
                    desc="Multilogin X (cloud) และ AdsPower (Local API บนเครื่อง) — ใช้ร่วมกับเมนู Browser Profiles"
                >
                    <div className="grid md:grid-cols-2 gap-4 items-start">
                        <Card className="mb-0">
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

                        <Card className="mb-0">
                            <CardHeader>
                                <CardTitle>
                                    AdsPower Local API
                                    {testResult.adspower === "ok" ? <span className="text-[hsl(var(--success))] text-[11px] font-normal ml-1">● OK</span> : testResult.adspower === "fail" ? <span className="text-[hsl(var(--destructive))] text-[11px] font-normal ml-1">● Failed</span> : null}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2 leading-relaxed">
                                    โปรแกรม AdsPower รัน Local API ที่พอร์ต <code className="text-[9px] bg-[hsl(var(--muted))/30] px-1 rounded">50325</code>.
                                    Dev เว้น Base URL ว่าง → proxy <code className="text-[9px] px-1 rounded bg-[hsl(var(--muted))/30]">/adspower-local</code>.
                                    ถ้าใส่ Base URL แบบ <strong>https://…</strong> (ngrok) แม้จาก <strong>localhost</strong> จะเรียกผ่าน <strong>Worker</strong> เพื่อเลี่ยง CORS.
                                    บน <strong>HTTPS</strong> (Pages) กด <strong>Save</strong> ให้ sync ไป D1
                                </p>
                                <p className="text-[9px] text-[hsl(var(--muted-foreground))]">
                                    Docs:{" "}
                                    <a className="text-[hsl(var(--primary))] underline" href="https://documenter.getpostman.com/view/45822952/2sB34hEzQH" target="_blank" rel="noreferrer">Postman</a>
                                    {" · "}
                                    <a className="text-[hsl(var(--primary))] underline" href="https://localapi-doc-en.adspower.com/docs/Rdw7Iu" target="_blank" rel="noreferrer">Official Local API</a>
                                </p>
                                <div><Lbl>API Key (ถ้าเปิด security ใน AdsPower)</Lbl><Inp type="password" value={adspowerApiKey} onChange={setAdspowerApiKey} placeholder="Bearer token จาก Automation → API" /></div>
                                <div>
                                    <Lbl>Base URL (https:// tunnel; dev ว่าง = /adspower-local)</Lbl>
                                    <Inp value={adspowerLocalBase} onChange={setAdspowerLocalBase} placeholder="https://xxx.ngrok-free.app หรือ https://adspower.yourdomain.com" />
                                </div>
                                <div className="text-[9px] text-[hsl(var(--muted-foreground))] font-mono break-all">
                                    Effective: {resolveAdsPowerBaseUrl({ adspowerLocalBase })}
                                </div>
                                {testResult.adspower && (
                                    <div className={`text-[11px] rounded px-2.5 py-1.5 ${testResult.adspower === "ok" ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border border-[rgba(16,185,129,0.15)]" : "bg-[rgba(239,68,68,0.06)] text-[hsl(var(--destructive))] border border-[rgba(239,68,68,0.12)]"}`}>
                                        {testResult.adspower === "ok" ? "✓" : "✗"} {testResult.adspowerDetail || testResult.adspower}
                                    </div>
                                )}
                                <p className="text-[9px] text-[hsl(var(--muted-foreground))] -mt-1">
                                    แดชบอร์ด HTTPS: กด <strong>Save</strong> ก่อน <strong>Test</strong> (D1). Dev + ngrok: Test ได้จากค่าในฟอร์มผ่าน Worker โดยไม่ต้อง Save
                                </p>
                                <div className="flex gap-1.5 mt-1">
                                    <Button variant="ghost" onClick={testAdsPower} disabled={testing === "adspower"} className="px-2 h-7 text-[10px]">
                                        {testing === "adspower" ? "⏳ …" : "🔑 Test (status + list)"}
                                    </Button>
                                    <Button onClick={() => save({ adspowerApiKey, adspowerLocalBase })} disabled={saving} className="px-2 h-7 text-[10px]">Save</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </SettingsSection>

                <SettingsSection
                    id="settings-tracking"
                    icon="🎯"
                    title="Tracking"
                    desc="Voluum — ดึงข้อมูลแคมเปญและ attribution (ใช้กับ Voluum Explorer ในแอป)"
                >
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
                </SettingsSection>

                <SettingsSection
                    id="settings-proxy"
                    icon="🛡️"
                    title="พร็อกซี & คุณภาพ IP"
                    desc="NodeMaven + provider สำรอง, กุญแจ IPinfo / Scamalytics / IP2Location และ LendingCard สำหรับลิงก์บัตรกับโปรไฟล์"
                >
                        <Card className="mb-4 border border-[hsl(var(--border))]/90 bg-[hsl(var(--muted))]/12">
                            <CardHeader><CardTitle className="text-sm">🔀 Proxy resolve relay</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[9px] text-[hsl(var(--muted-foreground))] m-0 leading-relaxed">
                                    ถ้า Worker ได้ <strong className="text-[hsl(var(--foreground))]">502</strong> (TCP จาก Cloudflare ไป gateway พร็อกซีไม่ได้) ให้รัน{" "}
                                    <code className="text-[hsl(var(--foreground))]">npm run proxy-relay</code> บนเครื่อง/VPS แล้วใส่ URL ด้านล่าง — แอปจะลอง relay ก่อน Worker อัตโนมัติ
                                    {" "}
                                    <strong className="text-[hsl(var(--foreground))]">หมายเหตุ:</strong> ถ้าเปิดแอปผ่าน <code className="text-[hsl(var(--foreground))]">https://</code> (เช่น Pages)
                                    เบราว์เซอร์จะบล็อกการเรียก <code className="text-[hsl(var(--foreground))]">http://127.0.0.1</code> — ต้องใช้ relay ที่เป็น{" "}
                                    <code className="text-[hsl(var(--foreground))]">https://</code> (โดเมน + TLS) หรือทดสอบจาก dev บน <code className="text-[hsl(var(--foreground))]">http://localhost</code>
                                    {" "}
                                    <strong className="text-[hsl(var(--foreground))]">Production:</strong> (1) บน <strong>Cloudflare Worker</strong> ที่ <code className="text-[hsl(var(--foreground))]">VITE_API_BASE</code> ชี้ไป — ตั้ง <code className="text-[hsl(var(--foreground))]">PROXY_RESOLVE_RELAY_URL</code> = <code className="text-[hsl(var(--foreground))]">https://…relay…</code> แล้ว deploy Worker
                                    (2) บน <strong>Cloudflare Pages</strong> (build) ใช้ <code className="text-[hsl(var(--foreground))]">VITE_PROXY_RESOLVE_RELAY</code> หรือ <code className="text-[hsl(var(--foreground))]">PROXY_RESOLVE_RELAY_URL</code> ค่าเดียวกัน แล้ว <strong>redeploy</strong> เพื่อให้เบราว์เซอร์ยิง relay ก่อน Worker
                                </p>
                                <Inp value={proxyResolveRelayUrl} onChange={setProxyResolveRelayUrl} placeholder="http://127.0.0.1:8789 (ว่าง = ใช้แค่ Worker)" />
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
                                            const result = await nodemavenApi.testConnection(
                                                { username: nmProxyUser, password: nmProxyPassword },
                                                { proxyResolveRelayUrl: proxyResolveRelayUrl.trim() }
                                            );
                                            const nmOk = result.success === true || result.ok === true;
                                            setTestResult(prev => ({
                                                ...prev,
                                                nm: nmOk ? "ok" : "fail",
                                                nmDetail: nmOk
                                                    ? `Gateway OK — exit ${result.ip || "?"}` + (result.isp ? ` · ${result.isp}` : "")
                                                    : (result.error || "Failed"),
                                            }));
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
                            <CardHeader>
                                <CardTitle>
                                    🔄 Proxy Providers (Fallback)
                                    {testResult.proxyFb === "ok" ? <span className="text-[hsl(var(--success))] text-[11px] font-normal ml-1">● OK</span> : testResult.proxyFb === "fail" ? <span className="text-[hsl(var(--destructive))] text-[11px] font-normal ml-1">● Failed</span> : null}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">Backup residential proxy providers — auto-fallback when primary fails quality check. ลำดับลอง: ตาม Primary แล้วต่อด้วย provider อื่นที่กรอกครบ</p>
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
                                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-snug m-0">ใส่ <strong className="text-[hsl(var(--foreground))]">แค่ sub-user</strong> (แอปใส่ <code className="text-[hsl(var(--foreground))]">user-</code> + geo) <strong className="text-[hsl(var(--foreground))]">หรือวาง username เต็ม</strong> จาก Generate — แบบ <code className="text-[hsl(var(--foreground))]">_area-TH_</code> ใช้ตามที่ dashboard ให้ (ไม่เติม <code className="text-[hsl(var(--foreground))]">user-</code>) · โซนเอเชียตั้ง Host/พอร์ต เช่น <code className="text-[hsl(var(--foreground))]">as.smartproxy.net:3120</code> · ดีฟอลต์ Decodo <code className="text-[hsl(var(--foreground))]">gate.decodo.com:7000</code> · เก่า <code className="text-[hsl(var(--foreground))]">gate.smartproxy.com:10001</code></p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><Lbl>Username</Lbl><Inp value={spProxyUser} onChange={setSpProxyUser} placeholder="sub-user (ไม่ต้องพิมพ์ user-)" /></div>
                                        <div><Lbl>Password</Lbl><Inp type="password" value={spProxyPassword} onChange={setSpProxyPassword} placeholder="password" /></div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="sm:col-span-1"><Lbl>Host (ว่าง = ดีฟอลต์)</Lbl><Inp value={spProxyHost} onChange={setSpProxyHost} placeholder="gate.decodo.com" /></div>
                                        <div><Lbl>HTTP port</Lbl><Inp value={spProxyHttpPort} onChange={setSpProxyHttpPort} placeholder="7000" /></div>
                                        <div><Lbl>SOCKS port</Lbl><Inp value={spProxySocksPort} onChange={setSpProxySocksPort} placeholder="7000" /></div>
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
                                {testResult.proxyFb && (
                                    <div className={`text-[11px] rounded px-2.5 py-1.5 space-y-1 ${testResult.proxyFb === "ok" ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border border-[rgba(16,185,129,0.15)]" : "bg-[rgba(239,68,68,0.06)] text-[hsl(var(--destructive))] border border-[rgba(239,68,68,0.12)]"}`}>
                                        <div>{testResult.proxyFb === "ok" ? "✓" : "✗"} {testResult.proxyFbDetail || testResult.proxyFb}</div>
                                        {testResult.proxyFbOrder && <div className="text-[10px] opacity-90 font-mono break-all">Order: {testResult.proxyFbOrder}</div>}
                                        {testResult.proxyFbProvider && <div className="text-[10px] opacity-90">Used: {testResult.proxyFbProvider}</div>}
                                        {testResult.proxyFbExitIp && <div className="text-[10px] opacity-90 font-mono">Exit IP: {testResult.proxyFbExitIp}</div>}
                                    </div>
                                )}
                                <div className="flex gap-1.5 flex-wrap">
                                    <Button
                                        variant="ghost"
                                        disabled={testing === "proxyFb"}
                                        className="px-2 h-7 text-[10px]"
                                        onClick={async () => {
                                            setTesting("proxyFb");
                                            try {
                                                const patch = {
                                                    nmProxyUser,
                                                    nmProxyPassword,
                                                    spProxyUser,
                                                    spProxyPassword,
                                                    spProxyHost: spProxyHost.trim(),
                                                    spProxyHttpPort: spProxyHttpPort.trim() ? parseInt(spProxyHttpPort, 10) : "",
                                                    spProxySocksPort: spProxySocksPort.trim() ? parseInt(spProxySocksPort, 10) : "",
                                                    soaxProxyUser,
                                                    soaxProxyPassword,
                                                    bdCustomer,
                                                    bdZone,
                                                    bdPassword,
                                                    proxyPrimaryProvider,
                                                    proxyResolveRelayUrl: proxyResolveRelayUrl.trim(),
                                                };
                                                const order = getProviderFallbackOrder(patch);
                                                const cfg = getProxyConfigWithFallback({ profileId: "settings-test" }, patch);
                                                if (cfg.error) {
                                                    setTestResult((prev) => ({
                                                        ...prev,
                                                        proxyFb: "fail",
                                                        proxyFbDetail: cfg.error,
                                                        proxyFbOrder: order.join(" → "),
                                                        proxyFbProvider: "",
                                                        proxyFbExitIp: "",
                                                    }));
                                                    return;
                                                }
                                                const pr = await postProxyResolveIp(
                                                    {
                                                        host: cfg.host,
                                                        port: cfg.port,
                                                        username: cfg.username,
                                                        password: cfg.password,
                                                        protocol: cfg.protocol,
                                                    },
                                                    patch
                                                );
                                                if (!pr.ok) {
                                                    setTestResult((prev) => ({
                                                        ...prev,
                                                        proxyFb: "fail",
                                                        proxyFbDetail: pr.error,
                                                        proxyFbOrder: order.join(" → "),
                                                        proxyFbProvider: cfg.providerName,
                                                        proxyFbExitIp: "",
                                                    }));
                                                    return;
                                                }
                                                const ipData = pr.data;
                                                const exitIp = ipData.ip || ipData.query || "";
                                                setTestResult((prev) => ({
                                                    ...prev,
                                                    proxyFb: "ok",
                                                    proxyFbDetail: exitIp ? `ทดสอบผ่านพร็อกซี — ได้ exit IP` : "ตอบ OK (ไม่มี IP ใน body)",
                                                    proxyFbOrder: order.join(" → "),
                                                    proxyFbProvider: cfg.providerName,
                                                    proxyFbExitIp: exitIp,
                                                }));
                                            } catch (e) {
                                                setTestResult((prev) => ({
                                                    ...prev,
                                                    proxyFb: "fail",
                                                    proxyFbDetail: e?.message || String(e),
                                                    proxyFbOrder: "",
                                                    proxyFbProvider: "",
                                                    proxyFbExitIp: "",
                                                }));
                                            } finally {
                                                setTesting(null);
                                            }
                                        }}
                                    >
                                        {testing === "proxyFb" ? "⏳ กำลังทดสอบ…" : "🧪 Test chain + exit IP"}
                                    </Button>
                                    <Button onClick={() => save({
                                        spProxyUser,
                                        spProxyPassword,
                                        spProxyHost: spProxyHost.trim(),
                                        spProxyHttpPort: spProxyHttpPort.trim() ? parseInt(spProxyHttpPort, 10) : "",
                                        spProxySocksPort: spProxySocksPort.trim() ? parseInt(spProxySocksPort, 10) : "",
                                        soaxProxyUser,
                                        soaxProxyPassword,
                                        bdCustomer,
                                        bdZone,
                                        bdPassword,
                                        proxyPrimaryProvider,
                                        proxyResolveRelayUrl: proxyResolveRelayUrl.trim(),
                                    })} disabled={saving} className="px-2 h-7 text-[10px]">{saving ? "Saving..." : "💾 Save Providers"}</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader>
                                <CardTitle>
                                    🔬 IP Quality APIs
                                    {testResult.ipq === "ok" ? <span className="text-[hsl(var(--success))] text-[11px] font-normal ml-1">● Pass</span> : testResult.ipq === "warn" ? <span className="text-amber-400 text-[11px] font-normal ml-1">● REJECT</span> : testResult.ipq === "fail" ? <span className="text-[hsl(var(--destructive))] text-[11px] font-normal ml-1">● Failed</span> : null}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-2">API keys for IP quality pipeline — ASN check, fraud detection, proxy/VPN detection, timezone verification. ทดสอบใช้ IP สาธารณะของคุณ (ipify) + ค่าที่กรอกในแบบฟอร์ม (ยังไม่ต้อง Save)</p>
                                <div className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-2">
                                    <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">IPinfo <span className="font-normal opacity-60">— ASN, ISP, Timezone, Geo</span></div>
                                    <Inp type="password" value={ipinfoToken} onChange={setIpinfoToken} placeholder="ipinfo.io access token" />
                                </div>
                                <div className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-2">
                                    <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Scamalytics <span className="font-normal opacity-60">— Fraud Score</span></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Inp type="password" value={scamalyticsKey} onChange={setScamalyticsKey} placeholder="API Key (a30b2f...)" />
                                        <Inp value={scamalyticsUsername} onChange={setScamalyticsUsername} placeholder="e.g. 69b454433fb5e" />
                                    </div>
                                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] m-0 mt-1 leading-relaxed">
                                        *สำหรับ V3 API ให้ใส่ ID (เช่น <code className="text-[hsl(var(--foreground))]">69b454...</code>) ลงในช่องขวา เพื่อแก้ปัญหา 404
                                    </p>
                                </div>
                                <div className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-2">
                                    <div className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">IP2Location <span className="font-normal opacity-60">— Proxy/VPN Detection</span></div>
                                    <Inp type="password" value={ip2locationKey} onChange={setIp2locationKey} placeholder="ip2location.io API key" />
                                </div>
                                <p className="text-[9px] text-[hsl(var(--muted-foreground))] italic">All optional — pipeline falls back to IPQS (จากการ์ด NodeMaven ด้านบน) + ip-api.com when keys are missing</p>
                                {testResult.ipq && (
                                    <div
                                        className={`text-[11px] rounded px-2.5 py-1.5 space-y-1 ${
                                            testResult.ipq === "ok"
                                                ? "bg-[rgba(16,185,129,0.08)] text-[hsl(var(--success))] border border-[rgba(16,185,129,0.15)]"
                                                : testResult.ipq === "warn"
                                                  ? "bg-amber-500/10 text-amber-200 border border-amber-500/20"
                                                  : "bg-[rgba(239,68,68,0.06)] text-[hsl(var(--destructive))] border border-[rgba(239,68,68,0.12)]"
                                        }`}
                                    >
                                        <div className="font-medium">{testResult.ipqDetail}</div>
                                        {Array.isArray(testResult.ipqSteps) && testResult.ipqSteps.length > 0 && (
                                            <ul className="text-[10px] font-mono space-y-0.5 list-disc list-inside opacity-95 m-0 pl-0.5">
                                                {testResult.ipqSteps.map((line, i) => (
                                                    <li key={i} className="break-all">
                                                        {line}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                                <div className="flex gap-1.5 flex-wrap">
                                    <Button
                                        variant="ghost"
                                        disabled={testing === "ipq"}
                                        className="px-2 h-7 text-[10px]"
                                        onClick={async () => {
                                            setTesting("ipq");
                                            try {
                                                let testIp = "1.1.1.1";
                                                try {
                                                    const ir = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
                                                    if (ir.ok) {
                                                        const ij = await ir.json();
                                                        if (ij.ip) testIp = ij.ip;
                                                    }
                                                } catch {
                                                    /* use fallback IP */
                                                }
                                                const patch = { ipinfoToken, scamalyticsKey, scamalyticsUsername, ip2locationKey, ipqsApiKey };
                                                const res = await runQualityPipeline(testIp, {}, {}, patch);
                                                const stepLines = (res.steps || []).map((s) => {
                                                    const label = s.label || s.name;
                                                    if (s.skipped) return `${label}: skipped`;
                                                    const mark = s.passed ? "✓" : "✗";
                                                    let extra = "";
                                                    if (s.name === "asn") extra = ` (${s.source || "?"})${s.asn ? ` ${s.asn}` : ""}${s.country ? ` ${s.country}` : ""}`;
                                                    if (s.name === "fraud") extra = ` fraud=${s.fraudScore ?? "—"} (${s.source || "?"})`;
                                                    if (s.name === "proxy_vpn") extra = ` (${s.source || "?"}) proxy=${s.isProxy ? "Y" : "n"} vpn=${s.isVpn ? "Y" : "n"}`;
                                                    if (s.name === "latency") extra = s.latencyMs != null ? ` ${s.latencyMs}ms` : "";
                                                    if (s.name === "timezone_geo") extra = s.skipped ? "" : ` countryMatch=${s.countryMatch} tzMatch=${s.timezoneMatch}`;
                                                    return `${mark} ${label}${extra}`;
                                                });
                                                setTestResult((prev) => ({
                                                    ...prev,
                                                    ipq: res.verdict === "APPROVE" ? "ok" : "warn",
                                                    ipqDetail: `IP ${testIp} · score ${res.score} · ${res.verdict}`,
                                                    ipqSteps: stepLines,
                                                }));
                                            } catch (e) {
                                                setTestResult((prev) => ({
                                                    ...prev,
                                                    ipq: "fail",
                                                    ipqDetail: e?.message || String(e),
                                                    ipqSteps: [],
                                                }));
                                            } finally {
                                                setTesting(null);
                                            }
                                        }}
                                    >
                                        {testing === "ipq" ? "⏳ กำลังรัน pipeline…" : "🧪 Run pipeline test"}
                                    </Button>
                                    <Button onClick={() => save({ ipinfoToken, scamalyticsKey, scamalyticsUsername, ip2locationKey })} disabled={saving} className="px-2 h-7 text-[10px]">{saving ? "Saving..." : "💾 Save API Keys"}</Button>
                                </div>
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
                </SettingsSection>

                <SettingsSection id="settings-ui" icon="🎨" title="หน้าตาแอป" desc="สีธีมและ accent — เก็บในเบราว์เซอร์">
                    <AppearanceSection />
                </SettingsSection>

                <SettingsSection id="settings-stats" icon="📊" title="สถิติโปรเจกต์" desc="ภาพรวมจาก session ปัจจุบัน">
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
                </SettingsSection>
            </div>
        </div>
    );
}
