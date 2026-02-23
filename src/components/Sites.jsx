import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { THEME as T } from "../constants";
import { LS, uid, now } from "../utils";
import { makeThemeJson, htmlToZip, astroProjectToZip } from "../utils/lp-generator";
import { generateHtmlByTemplate, generateAstroProjectByTemplate, generateApplyPageByTemplate } from "../utils/template-router";
import { multiloginApi } from "../services/multilogin";

import { deployTo, DEPLOY_TARGETS, getAvailableTargets, checkDeployStatus } from "../utils/deployers";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export function Sites({ sites, del, notify, startCreate, settings, addDeploy, updateSite }) {
    // Phase 1: เปลี่ยนเฉพาะ “หน้าตา” ของหน้า My Sites ให้เป็นตาราง (Table)
    // โดย “ไม่แตะ” data fetching / routing / handler หลัก (deploy, download, delete, edit, preview)
    const [deploying, setDeploying] = useState(null); // { siteId, target }
    const [expanded, setExpanded] = useState({});
    const [openActions, setOpenActions] = useState(null); // siteId for actions dropdown
    const [deployUrls, setDeployUrls] = useState(() => {
        const stored = LS.get("deployUrls") || {};
        // Migrate legacy flat deployUrls to per-target format
        const migrated = {};
        for (const [key, val] of Object.entries(stored)) {
            if (typeof val === "string") {
                migrated[key] = { netlify: val };
            } else if (val && typeof val === "object") {
                migrated[key] = val;
            }
        }
        return migrated;
    });
    const [preview, setPreview] = useState(null);
    const [openDeploy, setOpenDeploy] = useState(null); // siteId for open deploy dropdown
    const [openDownload, setOpenDownload] = useState(null); // siteId for open download dropdown
    const deployRef = useRef(null);
    const downloadRef = useRef(null);
    const actionsRef = useRef(null);
    const availableTargets = getAvailableTargets(settings);

    useEffect(() => { LS.set("deployUrls", deployUrls); }, [deployUrls]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e) => {
            if (deployRef.current && !deployRef.current.contains(e.target)) setOpenDeploy(null);
            if (downloadRef.current && !downloadRef.current.contains(e.target)) setOpenDownload(null);
            if (actionsRef.current && !actionsRef.current.contains(e.target)) setOpenActions(null);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const openLinkedProfile = async (site, profileId, folderId) => {
        // เปิดโปรไฟล์ผ่าน Multilogin Launcher (ต้องมี folderId)
        // 🇹🇭 สำคัญ: การ “เปิดโปรไฟล์จริง” ต้องมี Launcher ทำงานอยู่เสมอ
        // ถ้า Launcher ไม่ออนไลน์ จะขึ้น error ทันที เราเลยทำ preflight check เพื่อให้ UX ชัดเจน
        const fid = folderId || site.multiloginFolderId || settings?.mlFolderId;
        if (!fid) {
            notify("Multilogin Folder ID missing. Set it in Settings (mlFolderId).", "warning");
            return;
        }

        try {
            const launcher = await multiloginApi.checkLauncher();
            if (launcher?.error) {
                notify("Multilogin Launcher is offline. Please open Multilogin X and enable Launcher API.", "warning");
                return;
            }
            const r = await multiloginApi.startProfile(profileId, fid, {});
            if (r?.error) {
                const detail = r?.detail ? ` — ${String(r.detail).slice(0, 220)}` : "";
                const status = r?.status ? ` (HTTP ${r.status})` : "";
                notify(`Open profile failed${status}: ${r.error}${detail}`, "danger");
                return;
            }
            notify(`Opened profile: ${site.brand || profileId}`);
        } catch (e) {
            notify(`Open profile error: ${e.message}`, "danger");
        }
    };

    const linkAndOpenProfile = async (site, profile) => {
        // reserved
    };

    const toggleExpand = (id) => {
        setExpanded(prev => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    const handleDelete = (site) => {
        if (!confirm(`Delete "${site.brand}"?\nThis will also remove all deploy records.`)) return;
        // Remove deploy URLs for this site
        setDeployUrls(p => {
            const updated = { ...p };
            delete updated[site.id];
            return updated;
        });
        // Delete the site
        del(site.id);
        notify(`Deleted ${site.brand}`);
    };

     const handleDeploy = async (site, target) => {
         setOpenDeploy(null);
         setDeploying({ siteId: site.id, target });

         // Comprehensive debug logging
         console.log("=== DEPLOY DEBUG START ===");
         console.log("[Sites] Deploying site:", {
             id: site.id,
             brand: site.brand,
             templateId: site.templateId,
             target: target
         });

         try {
             // Single-file HTML deploy
             console.log("[Sites] Using non-git-push target, calling generateHtmlByTemplate");
             const mainHtml = generateHtmlByTemplate(site);
             const applyHtml = generateApplyPageByTemplate(site);
             const content = {
                 "index.html": mainHtml,
                 "apply.html": applyHtml
             };
             console.log("[Sites] Generated content keys:", Object.keys(content));

             console.log("[Sites] Calling deployTo with target:", target);
             const result = await deployTo(target, content, site, settings);
             console.log("[Sites] Deploy result:", {
                 success: result.success,
                 url: result.url,
                 error: result.error
             });
             if (result.success) {
                 setDeployUrls(p => ({
                     ...p,
                     [site.id]: { ...(p[site.id] || {}), [target]: result.url },
                 }));
                 if (addDeploy) {
                     addDeploy({
                         id: uid(), siteId: site.id, brand: site.brand,
                         url: result.url, ts: now(), type: "deploy", target,
                     });
                 }
                 if (result.queued) {
                     notify(`Queued ${DEPLOY_TARGETS.find(t => t.id === target)?.label}. CI is running: ${result.url}`);
                 } else {
                     notify(`Deployed to ${DEPLOY_TARGETS.find(t => t.id === target)?.label}! ${result.url}`);
                 }
             } else {
                 notify(`Deploy failed: ${result.error}`, "danger");
             }
         } catch (e) {
             notify(`Error: ${e.message}`, "danger");
         }
         setDeploying(null);
     };

     const downloadAstroZip = async (site) => {
         try {
             const files = generateAstroProjectByTemplate(site);
             const blob = await astroProjectToZip(files);
             const a = document.createElement("a");
             a.href = URL.createObjectURL(blob);
             a.download = `${site.brand.toLowerCase().replace(/\s+/g, "-")}-astro.zip`;
             a.click();
             URL.revokeObjectURL(a.href);
             notify("Downloaded Astro project ZIP");
         } catch (e) {
             notify(`ZIP error: ${e.message}`, "danger");
         }
     };

     const downloadHtmlZip = async (site) => {
         const html = generateHtmlByTemplate(site);
         const blob = await htmlToZip(html);
         const a = document.createElement("a");
         a.href = URL.createObjectURL(blob);
         a.download = `${site.brand.toLowerCase().replace(/\s+/g, "-")}-lp.zip`;
         a.click();
         URL.revokeObjectURL(a.href);
         notify("Downloaded static HTML ZIP");
     };

     const downloadApplyPage = (site) => {
         const applyHtml = generateApplyPageByTemplate(site);
         const blob = new Blob([applyHtml], { type: 'text/html' });
         const a = document.createElement('a');
         a.href = URL.createObjectURL(blob);
         a.download = `apply-${site.id}.html`;
         a.click();
         URL.revokeObjectURL(a.href);
         notify(`Downloaded apply-${site.id}.html`);
     };

     const exportJson = (site) => {
         const json = makeThemeJson(site);
         const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
         const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
         a.download = `theme-${site.id}.json`; a.click(); URL.revokeObjectURL(a.href);
         notify(`Downloaded theme-${site.id}.json`);
     };

     const getDeployedTargets = (siteId) => {
         const urls = deployUrls[siteId];
         if (!urls) return [];

         // Legacy storage: direct URL string
         if (typeof urls === "string") {
             return [{ target: "legacy", url: urls }];
         }

         if (typeof urls !== "object") return [];

         return Object.entries(urls)
             .map(([target, value]) => {
                 if (!value) return null;
                 if (typeof value === "string") return { target, url: value };
                 if (typeof value === "object" && typeof value.url === "string") {
                     return { target, url: value.url, ts: value.ts || value.updatedAt || value.createdAt };
                 }
                 return null;
             })
             .filter(Boolean);
     };

     const getLatestDeploy = (siteId) => {
         const targets = getDeployedTargets(siteId);
         if (targets.length === 0) return null;

         const withTs = targets.filter((t) => t?.ts && !Number.isNaN(new Date(t.ts).getTime()));
         if (withTs.length > 0) {
             return withTs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0];
         }

         return targets[targets.length - 1];
     };

     const getTemplateLabel = (templateId) => {
         const map = {
             classic: "Classic",
             "pdl-loansv1": "PDL Loans V1",
             "astrodeck-loan": "Astrodeck",
             "lander-core": "Lander Core",
         };
         return map[templateId] || templateId || "Classic";
     };

    const getSiteHealth = (site, deployedCount) => {
        if (!site.domain) return { label: "No Domain", color: T.warning };
        if (deployedCount === 0) return { label: "Not Deployed", color: T.dim };
        return { label: "Live", color: T.success };
    };

    return (
        <div className="animate-[fadeIn_.3s_ease]">
            <div className="flex justify-between items-center mb-5">
                <div>
                    <h1 className="text-[22px] font-bold m-0">My Sites</h1>
                    <p className="text-[hsl(var(--muted-foreground))] text-xs mt-0.5">Manage & deploy your loan landing pages</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={startCreate}>➕ Create LP</Button>
                </div>
            </div>

            {sites.length === 0 ? (
                <Card className="text-center p-12">
                    <div className="text-4xl mb-2">🏗️</div>
                    <div className="text-[15px] font-semibold">No sites yet</div>
                    <div className="text-[hsl(var(--muted-foreground))] text-xs mt-1">Create your first loan LP</div>
                </Card>
            ) : (
                <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[44px] px-2"> </TableHead>
                                <TableHead className="px-3">LP</TableHead>
                                <TableHead className="px-3">Template</TableHead>
                                <TableHead className="px-3">Domain</TableHead>
                                <TableHead className="px-3">Status</TableHead>
                                <TableHead className="px-3 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sites.map((site) => {
                                const deployed = getDeployedTargets(site.id);
                                const health = getSiteHealth(site, deployed.length);
                                const isDeploying = deploying?.siteId === site.id;
                                const templateLabel = getTemplateLabel(site.templateId || "classic");

                                return (
                                    <React.Fragment key={site.id}>
                                        <TableRow>
                                            <TableCell className="px-2 py-2 align-top">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpand(site.id)}
                                                    className="h-8 w-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]/40 text-xs"
                                                    aria-label={expanded[site.id] ? "Collapse" : "Expand"}
                                                >
                                                    {expanded[site.id] ? "▾" : "▸"}
                                                </button>
                                            </TableCell>

                                            <TableCell className="px-3 py-2 align-top">
                                                <div className="font-semibold leading-5">{site.brand || "Untitled"}</div>
                                            </TableCell>

                                            <TableCell className="px-3 py-2 align-top">
                                                <Badge variant="default" className="text-[10px]">{templateLabel}</Badge>
                                            </TableCell>

                                            <TableCell className="px-3 py-2 align-top">
                                                <div className="text-xs text-[hsl(var(--muted-foreground))]">{site.domain || "—"}</div>
                                            </TableCell>

                                            <TableCell className="px-3 py-2 align-top">
                                                <span
                                                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                                                    style={{
                                                        borderColor: `${health.color}44`,
                                                        background: `${health.color}11`,
                                                        color: health.color,
                                                    }}
                                                >
                                                    {health.label}
                                                </span>
                                            </TableCell>

                                            <TableCell className="px-3 py-2 align-top">
                                                <div className="flex justify-end gap-2">
                                                    <div>
                                                        {site.multiloginProfileId ? (
                                                            <Button
                                                                onClick={() => openLinkedProfile(site, site.multiloginProfileId)}
                                                                className="h-8 px-3 text-[11px]"
                                                            >
                                                                Open Profile
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                disabled
                                                                variant="secondary"
                                                                className="h-8 px-3 text-[11px]"
                                                                title="No Multilogin profile linked to this site"
                                                            >
                                                                Open Profile
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className="relative" ref={openActions === site.id ? actionsRef : null}>
                                                        <Button
                                                            variant="ghost"
                                                            onClick={() => setOpenActions(openActions === site.id ? null : site.id)}
                                                            className="h-8 px-2 text-[11px]"
                                                            aria-label="Actions"
                                                        >
                                                            ▾
                                                        </Button>
                                                        {openActions === site.id && (
                                                            <div style={dropdownActionsStyle}>
                                                                <DropdownItem icon="👁" label="Preview" desc="Open quick preview" onClick={() => { setOpenActions(null); setPreview(site); }} />
                                                                <DropdownItem icon="✏️" label="Edit" desc="Edit & redeploy" onClick={() => { setOpenActions(null); startCreate(site); }} />
                                                                <div className="relative" ref={openDownload === site.id ? downloadRef : null}>
                                                                    <DropdownItem icon="📥" label="Download" desc="Export files" onClick={() => setOpenDownload(openDownload === site.id ? null : site.id)} />
                                                                    {openDownload === site.id && (
                                                                        <div style={dropdownSubmenuStyle}>
                                                                            <DropdownItem icon="🚀" label="Astro Project (ZIP)" desc="Full source, buildable" onClick={() => { setOpenDownload(null); setOpenActions(null); downloadAstroZip(site); }} />
                                                                            <DropdownItem icon="📄" label="Static HTML (ZIP)" desc="Single index.html" onClick={() => { setOpenDownload(null); setOpenActions(null); downloadHtmlZip(site); }} />
                                                                            <DropdownItem icon="📝" label="Apply Page (HTML)" desc="Form embed page" onClick={() => { setOpenDownload(null); setOpenActions(null); downloadApplyPage(site); }} />
                                                                            <DropdownItem icon="🎨" label="Theme JSON" desc="Design tokens export" onClick={() => { setOpenDownload(null); setOpenActions(null); exportJson(site); }} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="my-1 border-t border-[hsl(var(--border))]" />
                                                                <DropdownItem tone="danger" icon="🗑️" label="Delete" desc="Remove from dashboard" onClick={() => { setOpenActions(null); handleDelete(site); }} />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="relative" ref={openDeploy === site.id ? deployRef : null}>
                                                        <Button
                                                            onClick={() => setOpenDeploy(openDeploy === site.id ? null : site.id)}
                                                            disabled={isDeploying}
                                                            className="h-8 px-3 text-[11px]"
                                                        >
                                                            {isDeploying ? "Deploying…" : "Deploy"}
                                                        </Button>
                                                        {openDeploy === site.id && !isDeploying && (
                                                            <div style={dropdownDeployStyle}>
                                                                {(() => {
                                                                    const configured = availableTargets.filter(t => t.configured);
                                                                    const unconfigured = availableTargets.filter(t => !t.configured);
                                                                    return (
                                                                        <>
                                                                            {configured.map(t => (
                                                                                <DropdownItem
                                                                                    key={t.id}
                                                                                    icon={t.icon}
                                                                                    label={t.label}
                                                                                    desc={t.description}
                                                                                    disabled={false}
                                                                                    active={!!deployUrls[site.id]?.[t.id]}
                                                                                    onClick={() => handleDeploy(site, t.id)}
                                                                                />
                                                                            ))}
                                                                            {configured.length > 0 && unconfigured.length > 0 && (
                                                                                <div className="my-1 border-t border-[hsl(var(--border))]" />
                                                                            )}
                                                                            {unconfigured.map(t => (
                                                                                <DropdownItem
                                                                                    key={t.id}
                                                                                    icon={t.icon}
                                                                                    label={t.label}
                                                                                    desc="⚠ Not configured"
                                                                                    disabled
                                                                                    active={false}
                                                                                />
                                                                            ))}
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>

                                        {expanded[site.id] && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="px-3 py-3 bg-[hsl(var(--muted))]/20">
                                                    <ExpandPanel
                                                        site={site}
                                                        deployedTargets={deployed}
                                                        settings={settings}
                                                        getLatestDeploy={getLatestDeploy}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {preview && createPortal(
                <div onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}
                    className="fixed inset-0 bg-black/85 z-[10000] flex flex-col p-6 animate-[fadeIn_.2s_ease]">
                    <div className="flex justify-between mb-3">
                        <div className="text-white font-bold">Preview: {preview.brand}</div>
                        <Button variant="destructive" onClick={() => setPreview(null)} className="px-3 py-1 h-auto text-xs">Close</Button>
                    </div>
                    <iframe title="preview" className="flex-1 bg-white rounded-xl border-none" srcDoc={generateHtmlByTemplate(preview)} />
                </div>,
                document.body
            )}
        </div>
    );
}

function ExpandPanel({ site, deployedTargets, settings, getLatestDeploy }) {
    // 🇹🇭 ExpandPanel แสดงข้อมูลเพิ่มเติมแบบ “Minimal”
    // จุดประสงค์คือทำให้ row หลัก compact แต่ยังเข้าถึงรายละเอียดได้ใน 1 คลิก
    const latestDeploy = getLatestDeploy(site.id);
    const updatedAt = site.updatedAt || site._updatedAt || site._createdAt || site.createdAt;

    return (
        <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Template</div>
                <div className="font-medium">{site.templateId || "classic"}</div>
            </div>

            <div className="space-y-1">
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Build Status</div>
                <div className="font-medium">—</div>
            </div>

            <div className="space-y-1">
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Deploy Status</div>
                <div>
                    <DeployStatusChecker site={site} deployedTargets={deployedTargets} settings={settings} />
                </div>
            </div>

            <div className="space-y-1">
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Live URL</div>
                {latestDeploy?.url ? (
                    <a
                        href={latestDeploy.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[hsl(var(--accent))] no-underline break-all"
                    >
                        {latestDeploy.url}
                    </a>
                ) : (
                    <div className="font-medium">—</div>
                )}
            </div>

            <div className="space-y-1 col-span-2">
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Last Error</div>
                <div className="font-medium">—</div>
            </div>

            <div className="space-y-1 col-span-2">
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Updated</div>
                <div className="font-medium">{updatedAt ? String(updatedAt) : "—"}</div>
            </div>
        </div>
    );
}

/* ─── Deploy Status Checker Component ─── */

const STATUS_META = {
    live: { icon: "✅", label: "Live", color: "#22c55e" },
    building: { icon: "🔄", label: "Building", color: "#f59e0b" },
    pending: { icon: "⏳", label: "Pending", color: "#94a3b8" },
    failed: { icon: "❌", label: "Failed", color: "#ef4444" },
    unknown: { icon: "❓", label: "Unknown", color: "#94a3b8" },
    no_deploys: { icon: "📭", label: "No deploys", color: "#94a3b8" },
};

function DeployStatusChecker({ site, deployedTargets, settings }) {
    const [statuses, setStatuses] = useState({});
    const [loading, setLoading] = useState(false);
    const [lastChecked, setLastChecked] = useState(null);

    const checkAll = async () => {
        if (!deployedTargets.length) return;
        setLoading(true);
        const results = {};
        await Promise.all(
            deployedTargets.map(async ({ target }) => {
                try {
                    const res = await checkDeployStatus(target, site, settings);
                    results[target] = res;
                } catch (e) {
                    results[target] = { success: false, error: e.message };
                }
            })
        );
        setStatuses(results);
        setLastChecked(new Date());
        setLoading(false);
    };

    if (!deployedTargets.length) return null;

    return (
        <div className="mt-2 border border-[hsl(var(--border))] rounded-lg p-2 bg-[hsl(var(--muted))/20]">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">
                    Deploy Status
                    {lastChecked && (
                        <span className="ml-1.5 font-normal opacity-60">
                            checked {lastChecked.toLocaleTimeString()}
                        </span>
                    )}
                </span>
                <button
                    onClick={checkAll}
                    disabled={loading}
                    className="text-[9px] px-2 py-0.5 rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))/10] transition-colors disabled:opacity-50"
                >
                    {loading ? "Checking…" : "🔄 Check"}
                </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {deployedTargets.map(({ target, url }) => {
                    const t = DEPLOY_TARGETS.find(d => d.id === target);
                    const s = statuses[target];
                    const meta = s?.status ? (STATUS_META[s.status] || STATUS_META.unknown) : null;
                    return (
                        <a
                            key={target}
                            href={s?.url || url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border no-underline transition-colors"
                            style={{
                                borderColor: meta ? `${meta.color}44` : "hsl(var(--border))",
                                background: meta ? `${meta.color}11` : "transparent",
                                color: meta ? meta.color : "hsl(var(--muted-foreground))",
                            }}
                            title={s?.error || s?.url || url}
                        >
                            <span>{t?.icon || "🚀"}</span>
                            <span className="font-medium">{t?.label || target}</span>
                            {meta && <span>{meta.icon} {meta.label}</span>}
                            {!meta && <span className="opacity-50">—</span>}
                        </a>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Dropdown Styles & Components ─── */

const dropdownBaseStyle = {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 6,
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    boxShadow: "0 12px 30px rgba(0,0,0,.12)",
    zIndex: 100,
    padding: 6,
    animation: "fadeIn .14s ease",
};

const dropdownDeployStyle = {
    ...dropdownBaseStyle,
    minWidth: 280,
};

const dropdownActionsStyle = {
    ...dropdownBaseStyle,
    left: "auto",
    right: 0,
    minWidth: 240,
};

const dropdownProfileStyle = {
    ...dropdownBaseStyle,
    minWidth: 320,
};

const dropdownSubmenuStyle = {
    ...dropdownBaseStyle,
    top: 0,
    left: "auto",
    right: "100%",
    marginTop: 0,
    minWidth: 260,
};

function DropdownItem({ icon, label, desc, onClick, disabled, active, tone }) {
    const [hovered, setHovered] = useState(false);
    const isDanger = tone === "danger";
    const canClick = !disabled && typeof onClick === "function";

    const baseBg = hovered && canClick
        ? (isDanger ? "rgba(239,68,68,.10)" : "hsl(var(--muted))")
        : "transparent";

    const baseColor = disabled
        ? "hsl(var(--muted-foreground))"
        : isDanger
            ? "#ef4444"
            : "hsl(var(--foreground))";

    return (
        <button
            type="button"
            onClick={canClick ? onClick : undefined}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            aria-disabled={disabled ? "true" : "false"}
            style={{
                height: 36,
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 10px",
                background: baseBg,
                border: "none",
                borderRadius: 10,
                cursor: canClick ? "pointer" : "not-allowed",
                textAlign: "left",
                color: baseColor,
                opacity: disabled ? 0.55 : 1,
                transition: "background .14s ease, color .14s ease",
            }}
        >
            <span style={{ width: 16, fontSize: 14, lineHeight: "16px", flexShrink: 0, textAlign: "center" }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                    {active && (
                        <span style={{
                            marginLeft: "auto",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#16a34a",
                            background: "rgba(34,197,94,.12)",
                            border: "1px solid rgba(34,197,94,.25)",
                            padding: "2px 8px",
                            borderRadius: 999,
                        }}>LIVE</span>
                    )}
                </div>
                {desc && (
                    <div style={{
                        fontSize: 10,
                        marginTop: 1,
                        color: disabled ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground))",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}>{desc}</div>
                )}
            </div>
        </button>
    );
}
