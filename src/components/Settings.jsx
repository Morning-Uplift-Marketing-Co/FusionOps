import React, { useState, useEffect } from "react";
import { THEME as T } from "../constants";
import { InputField as Inp, SelectField as Sel } from "./ui/input-field";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { api } from "../services/api";
import { multiloginApi } from "../services/multilogin";
import { getCfApiBase } from "../utils/api-proxy";

export function Settings({ settings, setSettings, stats, apiOk, neonOk }) {
    const [neonUrl, setNeonUrl] = useState(settings.neonUrl || import.meta.env.VITE_NEON_URL || "");
    const [apiKey, setApiKey] = useState(settings.apiKey || "");
    const [geminiKey, setGeminiKey] = useState(settings.geminiKey || "");
    const [netlifyToken, setNetlifyToken] = useState(settings.netlifyToken || "");
    const [netlifyTeamSlug, setNetlifyTeamSlug] = useState(settings.netlifyTeamSlug || "");
    const [lcToken, setLcToken] = useState(settings.lcToken || import.meta.env.VITE_LENDINGCARD_TOKEN || import.meta.env.PUBLIC_LENDINGCARD_API_TOKEN || "");
    const [lcTeamUuid, setLcTeamUuid] = useState(settings.lcTeamUuid || "");
    const [defaultBinUuid, setDefaultBinUuid] = useState(settings.defaultBinUuid || "");
    const [defaultBillingUuid, setDefaultBillingUuid] = useState(settings.defaultBillingUuid || "");
    const [mlToken, setMlToken] = useState(settings.mlToken || "");
    const [mlEmail, setMlEmail] = useState(settings.mlEmail || "");
    const [mlPassword, setMlPassword] = useState(settings.mlPassword || "");
    const [mlFolderId, setMlFolderId] = useState(settings.mlFolderId || "");
    const [defaultProxyProvider, setDefaultProxyProvider] = useState(settings.defaultProxyProvider || "multilogin");

    // Voluum API
    const [voluumAccessKeyId, setVoluumAccessKeyId] = useState(settings.voluumAccessKeyId || import.meta.env.VITE_VOLUUM_ACCESS_KEY_ID || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY_ID || "");
    const [voluumAccessKey, setVoluumAccessKey] = useState(settings.voluumAccessKey || import.meta.env.VITE_VOLUUM_ACCESS_KEY || import.meta.env.PUBLIC_VOLUUM_ACCESS_KEY || "");

    // Deploy credentials
    const [cfApiToken, setCfApiToken] = useState(settings.cfApiToken || import.meta.env.VITE_CF_API_TOKEN || "");
    const [cfAccountId, setCfAccountId] = useState(settings.cfAccountId || import.meta.env.VITE_CF_ACCOUNT_ID || "");
    const [awsAccessKey, setAwsAccessKey] = useState(settings.awsAccessKey || "");
    const [awsSecretKey, setAwsSecretKey] = useState(settings.awsSecretKey || "");
    const [awsRegion, setAwsRegion] = useState(settings.awsRegion || "us-east-1");
    const [s3Bucket, setS3Bucket] = useState(settings.s3Bucket || "");
    const [cloudfrontDistId, setCloudfrontDistId] = useState(settings.cloudfrontDistId || "");
    const [vpsHost, setVpsHost] = useState(settings.vpsHost || "");
    const [vpsPort, setVpsPort] = useState(settings.vpsPort || "22");
    const [vpsUser, setVpsUser] = useState(settings.vpsUser || "");
    const [vpsPath, setVpsPath] = useState(settings.vpsPath || "");
    const [vpsAuthMethod, setVpsAuthMethod] = useState(settings.vpsAuthMethod || "key");
    const [vpsKey, setVpsKey] = useState(settings.vpsKey || "");
    const [vpsWorkerUrl, setVpsWorkerUrl] = useState(settings.vpsWorkerUrl || "");
    // Vercel deploy token
    const [vercelToken, setVercelToken] = useState(settings.vercelToken || "");
    // Git push pipeline settings
    const [githubToken, setGithubToken] = useState(settings.githubToken || "");
    const [githubRepoOwner, setGithubRepoOwner] = useState(settings.githubRepoOwner || "");
    const [githubRepoName, setGithubRepoName] = useState(settings.githubRepoName || "");
    const [githubRepoBranch, setGithubRepoBranch] = useState(settings.githubRepoBranch || "main");
    const [githubDeployWorkflow, setGithubDeployWorkflow] = useState(settings.githubDeployWorkflow || "deploy-sites.yml");
    const [netlifyTarget, setNetlifyTarget] = useState(settings.netlifyTarget || "");
    const [cfPagesTarget, setCfPagesTarget] = useState(settings.cfPagesTarget || "");
    // D1 Database credentials
    const [d1AccountId, setD1AccountId] = useState(settings.d1AccountId || "");
    const [d1DatabaseId, setD1DatabaseId] = useState(settings.d1DatabaseId || "");
    const [d1ApiToken, setD1ApiToken] = useState(settings.d1ApiToken || "");
    const [d1Result, setD1Result] = useState(null);

    const [generatingToken, setGeneratingToken] = useState(false);
    const [testing, setTesting] = useState(null);
    const [testResult, setTestResult] = useState({});
    const [folders, setFolders] = useState(null);
    const [launcherOk, setLauncherOk] = useState(null);
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [saving, setSaving] = useState(false);

    // Sync saved token into service on mount
    useEffect(() => {
        if (mlToken) multiloginApi.setToken(mlToken);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    const testAws = async () => {
        setTesting("aws");
        try {
            // Simple S3 ListObjects to verify credentials
            const r = await fetch(`https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/?list-type=2&max-keys=1`);
            // This will likely fail due to CORS, so we just check if the bucket exists
            setTestResult(p => ({ ...p, aws: r.status !== 0 ? "ok" : "fail" }));
        } catch (e) {
            // CORS error usually means the bucket exists
            console.warn("[Settings] AWS test failed (likely CORS):", e?.message || e);
            setTestResult(p => ({ ...p, aws: "cors" }));
        }
        setTesting(null);
    };

    const testLc = async () => {
        setTesting("lc");
        try {
            const r = await api.get("/lc/teams");
            if (r && !r.error) {
                setTestResult(p => ({ ...p, lc: "ok" }));
            } else {
                setTestResult(p => ({ ...p, lc: "fail" }));
            }
        } catch (e) {
            console.warn("[Settings] LC test failed:", e?.message || e);
            setTestResult(p => ({ ...p, lc: "fail" }));
        }
        setTesting(null);
    };

    const testVoluum = async () => {
        setTesting("voluum");
        try {
            const r = await api.post('/voluum/session', { accessId: voluumAccessKeyId, accessKey: voluumAccessKey });
            if (r && r.token) {
                setTestResult(p => ({ ...p, voluum: "ok" }));
            } else {
                setTestResult(p => ({ ...p, voluum: "fail" }));
            }
        } catch (e) {
            console.warn("[Settings] Voluum test failed:", e?.message || e);
            setTestResult(p => ({ ...p, voluum: "fail" }));
        }
        setTesting(null);
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
                if (r && !r.error) {
                    setTestResult(p => ({ ...p, ml: "active" }));
                } else if (r?.status === 401) {
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

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-2 items-start">
                {/* Column 1: Core Config & External Services */}
                <div className="space-y-2">
                    <section>
                        <SectionHeader>🗄️ Database</SectionHeader>
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
                                        {!d1Result.success && d1Result.url && <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))] font-mono break-all">URL: {d1Result.url}</div>}
                                        {!d1Result.success && d1Result.detail && <div className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))] font-mono break-all">Detail: {d1Result.detail}</div>}
                                    </div>
                                )}
                                <div className="flex gap-1.5">
                                    <Button variant="ghost" onClick={testD1} disabled={!d1AccountId || !d1ApiToken || testing === "d1"} className="text-xs">{testing === "d1" ? "..." : "🔑 Test"}</Button>
                                    <Button onClick={() => { const cleanId = d1AccountId.trim(); if (cleanId && !/^[0-9a-f]{32}$/i.test(cleanId)) { setD1Result({ success: false, error: `Account ID must be exactly 32 hex characters (got ${cleanId.length})` }); return; } save({ d1AccountId: cleanId, d1DatabaseId, d1ApiToken }); }} disabled={saving} className="text-xs">{saving ? "Saving..." : "💾 Save"}</Button>
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
                                {settings.apiKey && <div className="text-[11px] text-[hsl(var(--success))]">✓ Configured</div>}
                                <div className="flex gap-1.5">
                                    <Button variant="ghost" onClick={testApi} disabled={!apiKey || testing === "api"} className="text-xs">{testing === "api" ? "..." : "🔑 Test"}</Button>
                                    <Button onClick={() => save({ apiKey })} disabled={saving} className="text-xs">{saving ? "Saving..." : "💾 Save"}</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                        <SectionHeader>🔗 External Services</SectionHeader>
                        <Card className="mb-4">
                            <CardHeader><CardTitle>Voluum Tracker</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1">For fetching campaign spend and ROI metrics</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Lbl>Access Key ID</Lbl>
                                        <Inp type="password" value={voluumAccessKeyId} onChange={setVoluumAccessKeyId} placeholder="xxxx-xxxx-xxxx-xxxx" />
                                    </div>
                                    <div>
                                        <Lbl>Access Key</Lbl>
                                        <Inp type="password" value={voluumAccessKey} onChange={setVoluumAccessKey} placeholder="xxxx-xxxx-xxxx-xxxx" />
                                    </div>
                                </div>
                                {testResult.voluum && <div className={`text-[11px] ${testResult.voluum === "ok" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>{testResult.voluum === "ok" ? "✓ Connected" : "✗ Failed"}</div>}
                                <div className="flex gap-1.5">
                                    <Button variant="ghost" onClick={testVoluum} disabled={!voluumAccessKeyId || !voluumAccessKey || testing === "voluum"} className="text-xs">{testing === "voluum" ? "..." : "🔑 Test"}</Button>
                                    <Button onClick={() => save({ voluumAccessKeyId, voluumAccessKey })} disabled={saving} className="text-xs">{saving ? "Saving..." : "💾 Save"}</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>LeadingCards API</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1">For automated card management</p>
                                <div><Lbl>Token</Lbl><Inp type="password" value={lcToken} onChange={setLcToken} placeholder="b2f..." /></div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Lbl>Team UUID</Lbl><Inp value={lcTeamUuid} onChange={setLcTeamUuid} placeholder="Optional" /></div>
                                    <div><Lbl>BIN UUID</Lbl><Inp value={defaultBinUuid} onChange={setDefaultBinUuid} placeholder="Issuance BIN" /></div>
                                </div>
                                {testResult.lc && <div className={`text-[11px] ${testResult.lc === "ok" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>{testResult.lc === "ok" ? "✓ Connected" : "✗ Failed"}</div>}
                                <div className="flex gap-1.5">
                                    <Button variant="ghost" onClick={testLc} disabled={!lcToken || testing === "lc"} className="text-xs">{testing === "lc" ? "..." : "🔑 Test"}</Button>
                                    <Button onClick={() => save({ lcToken, lcTeamUuid, defaultBinUuid, defaultBillingUuid })} disabled={saving} className="text-xs">{saving ? "Saving..." : "💾 Save"}</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>📊 Build Stats</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div><div className="text-[22px] font-bold">{stats.builds}</div><div className="text-[10px] text-[hsl(var(--muted-foreground))]">Builds</div></div>
                                    <div><div className="text-[22px] font-bold text-[hsl(var(--accent))]">${stats.spend.toFixed(3)}</div><div className="text-[10px] text-[hsl(var(--muted-foreground))]">Spend</div></div>
                                    <div><div className="text-[22px] font-bold text-[hsl(var(--success))]">90+</div><div className="text-[10px] text-[hsl(var(--muted-foreground))]">PageSpeed</div></div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>

                {/* Column 2: Deploy Targets & Pipeline */}
                <div className="space-y-2">
                    <section>
                        <SectionHeader>🚀 Deploy Targets</SectionHeader>
                        <Card className="mb-4">
                            <CardHeader><CardTitle>☁️ Cloudflare</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1">Primary Edge platform (Pages & Workers)</p>
                                <div><Lbl>API Token</Lbl><Inp type="password" value={cfApiToken} onChange={setCfApiToken} placeholder="Bearer token..." /></div>
                                <div><Lbl>Account ID {cfAccountId && (/^[0-9a-f]{32}$/i.test(cfAccountId.trim()) ? <span className="text-[hsl(var(--success))] text-[10px]">✓ {cfAccountId.trim().length} chars</span> : <span className="text-[hsl(var(--destructive))] text-[10px]">✗ {cfAccountId.trim().length}/32 chars</span>)}</Lbl><Inp value={cfAccountId} onChange={setCfAccountId} placeholder="32-char hex ID" /></div>
                                {testResult.cf && (<div className={`text-[11px] ${testResult.cf === "ok" ? "text-[hsl(var(--success))]" : testResult.cf === "partial" ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--destructive))]"}`}>{testResult.cf === "ok" ? "✓ Pages + Workers OK" : testResult.cf === "partial" ? "⚠ Partial — " : "✗ Failed — "}{testResult.cfDetail && <span className="font-mono text-[10px]">{testResult.cfDetail}</span>}</div>)}
                                <div className="flex gap-1.5">
                                    <Button variant="ghost" onClick={testCf} disabled={!cfApiToken || !cfAccountId || testing === "cf"} className="text-xs">{testing === "cf" ? "..." : "🔑 Test"}</Button>
                                    <Button onClick={() => { const cleanId = cfAccountId.trim(); if (cleanId && !/^[0-9a-f]{32}$/i.test(cleanId)) { setTestResult(p => ({ ...p, cf: "fail", cfDetail: `Account ID must be exactly 32 hex characters (got ${cleanId.length})` })); return; } save({ cfApiToken, cfAccountId: cleanId }); }} disabled={saving} className="text-xs">{saving ? "Saving..." : "💾 Save"}</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="mb-4">
                                <CardHeader><CardTitle>🔺 Netlify</CardTitle></CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    <Inp type="password" value={netlifyToken} onChange={setNetlifyToken} placeholder="nfp_..." />
                                    {settings.netlifyToken && <div className="text-[11px] text-[hsl(var(--success))]">✓ Configured</div>}
                                    <div className="flex gap-1.5 mt-2">
                                        <Button variant="ghost" onClick={testNetlify} disabled={!netlifyToken || testing === "netlify"} className="px-2 h-7 text-[10px]">Test</Button>
                                        <Button onClick={() => save({ netlifyToken, netlifyTeamSlug })} disabled={saving} className="px-2 h-7 text-[10px]">{saving ? "..." : "Save"}</Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="mb-4">
                                <CardHeader><CardTitle>▲ Vercel</CardTitle></CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    <Inp type="password" value={vercelToken} onChange={setVercelToken} placeholder="vercel_..." />
                                    {settings.vercelToken && <div className="text-[11px] text-[hsl(var(--success))]">✓ Configured</div>}
                                    <Button onClick={() => save({ vercelToken })} disabled={saving} className="px-2 h-7 text-[10px] mt-2 self-start">{saving ? "..." : "Save"}</Button>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>🪣 AWS S3 + CloudFront</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Lbl>Access Key ID</Lbl><Inp type="password" value={awsAccessKey} onChange={setAwsAccessKey} placeholder="AKIA..." /></div>
                                    <div><Lbl>Secret Key</Lbl><Inp type="password" value={awsSecretKey} onChange={setAwsSecretKey} placeholder="••••" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Lbl>Region</Lbl><Inp value={awsRegion} onChange={setAwsRegion} placeholder="us-east-1" /></div>
                                    <div><Lbl>Bucket</Lbl><Inp value={s3Bucket} onChange={setS3Bucket} placeholder="my-lp-bucket" /></div>
                                </div>
                                {testResult.aws && <div className={`text-[11px] ${testResult.aws === "fail" ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--success))]"}`}>{testResult.aws === "ok" ? "✓ Accessible" : testResult.aws === "cors" ? "⚠ CORS limited" : "✗ Failed"}</div>}
                                <div className="flex gap-1.5">
                                    <Button variant="ghost" onClick={testAws} disabled={!s3Bucket || testing === "aws"} className="text-xs">🔑 Test</Button>
                                    <Button onClick={() => save({ awsAccessKey, awsSecretKey, awsRegion, s3Bucket, cloudfrontDistId })} disabled={saving} className="text-xs">{saving ? "Saving..." : "💾 Save"}</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>🖥️ VPS (SSH/rsync)</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <div className="grid gap-2" style={{ gridTemplateColumns: "2fr 1fr" }}>
                                    <div><Lbl>Host</Lbl><Inp value={vpsHost} onChange={setVpsHost} placeholder="123.45.67.89" /></div>
                                    <div><Lbl>Port</Lbl><Inp value={vpsPort} onChange={setVpsPort} placeholder="22" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Lbl>Username</Lbl><Inp value={vpsUser} onChange={setVpsUser} placeholder="deploy" /></div>
                                    <div><Lbl>Path</Lbl><Inp value={vpsPath} onChange={setVpsPath} placeholder="/var/www/html/" /></div>
                                </div>
                                <Button onClick={() => save({ vpsHost, vpsPort, vpsUser, vpsPath, vpsAuthMethod, vpsKey, vpsWorkerUrl })} disabled={saving} className="text-xs self-start">{saving ? "Saving..." : "💾 Save VPS Config"}</Button>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader><CardTitle>🧬 Git Push Pipeline</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] -mt-2 mb-1">Commit artifacts to GitHub for CI/CD</p>
                                <Inp type="password" value={githubToken} onChange={setGithubToken} placeholder="GitHub Token (ghp_...)" />
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Lbl>Repo Owner</Lbl><Inp value={githubRepoOwner} onChange={setGithubRepoOwner} placeholder="user" /></div>
                                    <div><Lbl>Repo Name</Lbl><Inp value={githubRepoName} onChange={setGithubRepoName} placeholder="repo" /></div>
                                </div>
                                {testResult.github && (<div className={`text-[11px] ${testResult.github === "ok" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`}>{testResult.github === "ok" ? "✓ Repo accessible" : "✗ Check failed"}</div>)}
                                <div className="flex gap-1.5">
                                    <Button variant="ghost" onClick={testGitHub} disabled={!githubToken || testing === "github"} className="text-xs">🔑 Test</Button>
                                    <Button onClick={() => save({ githubToken, githubRepoOwner, githubRepoName, githubRepoBranch, githubDeployWorkflow, netlifyTarget, cfPagesTarget })} disabled={saving} className="text-xs">💾 Save</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                        <SectionHeader>🤖 Multilogin X</SectionHeader>
                        <Card className="mb-4">
                            <CardHeader><CardTitle>Automation</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <Inp type="password" value={mlToken} onChange={setMlToken} placeholder="Automation Token" />
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Lbl>Email</Lbl><Inp value={mlEmail} onChange={setMlEmail} placeholder="user@ml.com" /></div>
                                    <div><Lbl>Password</Lbl><Inp type="password" value={mlPassword} onChange={setMlPassword} placeholder="••••" /></div>
                                </div>
                                <div className="flex gap-1.5 items-center">
                                    <div className="flex-1"><Lbl>Folder ID</Lbl><Inp value={mlFolderId} onChange={setMlFolderId} placeholder="ID..." /></div>
                                    <Button variant="ghost" onClick={async () => { setLoadingFolders(true); try { if (mlToken) multiloginApi.setToken(mlToken); const res = await multiloginApi.getFolders(); const fdata = res.data?.folders || res.data || []; setFolders(Array.isArray(fdata) ? fdata : []); } catch (e) { setFolders([]); } setLoadingFolders(false); }} disabled={loadingFolders || !mlToken} className="h-9 self-end px-2 text-[10px]">📂 Browse</Button>
                                </div>
                                {testResult.ml && <div className={`text-[11px] ${["fail", "expired"].includes(testResult.ml) ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--success))]"}`}>{testResult.ml === "ok" ? "✓ Token acquired" : testResult.ml === "active" ? "✓ Token Valid" : "✗ Error"}</div>}
                                <div className="flex gap-1.5 flex-wrap mt-1">
                                    <Button variant="ghost" onClick={testMl} disabled={testing === "ml"} className="px-2 h-7 text-[10px]">Test</Button>
                                    <Button onClick={() => save({ mlToken, mlEmail, mlPassword, mlFolderId, defaultProxyProvider })} disabled={saving} className="px-2 h-7 text-[10px]">Save</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </div>
        </div>
    );
}
