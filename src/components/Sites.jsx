import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { THEME as T, COLORS } from "../constants";
import { LS, uid, now, hsl } from "../utils";
import { makeThemeJson, htmlToZip, astroProjectToZip } from "../utils/lp-generator";
import { generateHtmlByTemplate, generateAstroProjectByTemplate, generateApplyPageByTemplate, generateDeployAssetsByTemplate } from "../utils/template-router";

import { deployTo, DEPLOY_TARGETS, getAvailableTargets, checkDeployStatus, deleteProject } from "../utils/deployers";
import { buildLanderTrackingUrl } from "../services/voluum";
import { InputField as Inp } from "./ui/input-field";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

export function Sites({ sites, del, notify, startCreate, startDuplicate, addSite, settings, addDeploy, ops, updateSite, auditLog, auditEvents, proxies }) {
    const [search, setSearch] = useState("");
    const [groupBy, setGroupBy] = useState("google-ads");
    const [onlyIssues, setOnlyIssues] = useState(false);
    const [quickFilter, setQuickFilter] = useState(() => {
        const stored = LS.get("sitesQuickFilter");
        const allowed = ["all", "deployed", "banned", "warming", "no-domain", "not-deployed"];
        return allowed.includes(stored) ? stored : "all";
    });
    const [sortBy, setSortBy] = useState(() => {
        const stored = LS.get("sitesSortBy");
        const allowed = ["issues-first", "latest", "brand"];
        return allowed.includes(stored) ? stored : "issues-first";
    });
    const [deploying, setDeploying] = useState(null); // { siteId, target }
    const [editingPolicySite, setEditingPolicySite] = useState(null);
    const [bulkDeleting, setBulkDeleting] = useState(false);
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
    const availableTargets = getAvailableTargets(settings);
    const [isDark, setIsDark] = useState(() => LS.get("sitesDarkMode") === true);
    const [healthResults, setHealthResults] = useState({});
    const [checkingHealth, setCheckingHealth] = useState({});
    const [cloneSource, setCloneSource] = useState(null);
    const [openAuditSiteId, setOpenAuditSiteId] = useState(null);
    const [localAuditCache, setLocalAuditCache] = useState({});
    const [loadingAuditId, setLoadingAuditId] = useState(null);
    const [logEventModal, setLogEventModal] = useState(null);

    // Sync fresh auditEvents from parent into localAuditCache when panel is open
    useEffect(() => {
        if (openAuditSiteId && auditEvents?.[openAuditSiteId]?.length > 0) {
            setLocalAuditCache(p => ({ ...p, [openAuditSiteId]: auditEvents[openAuditSiteId] }));
        }
    }, [auditEvents, openAuditSiteId]);

    const normalizeDomain = (value) => String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .split(":")[0];

    const cfAccountsById = useMemo(() => {
        const map = {};
        (ops?.cfAccounts || []).forEach((account) => {
            const keys = [account.id, account.accountId, account.account_id].filter(Boolean);
            keys.forEach((key) => {
                map[String(key)] = account;
            });
        });
        return map;
    }, [ops?.cfAccounts]);

    const domainsByName = useMemo(() => {
        const map = {};
        (ops?.domains || []).forEach((domain) => {
            const normalized = normalizeDomain(domain.domain || domain.hostname || "");
            if (normalized) map[normalized] = domain;
        });
        return map;
    }, [ops?.domains]);

    useEffect(() => { LS.set("deployUrls", deployUrls); }, [deployUrls]);
    useEffect(() => { LS.set("sitesQuickFilter", quickFilter); }, [quickFilter]);
    useEffect(() => { LS.set("sitesSortBy", sortBy); }, [sortBy]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e) => {
            if (deployRef.current && !deployRef.current.contains(e.target)) setOpenDeploy(null);
            if (downloadRef.current && !downloadRef.current.contains(e.target)) setOpenDownload(null);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleBulkDelete = async () => {
        if (!confirm(`⚠️ DANGER ZONE!\n\nThis will PERMANENTLY delete:\n• All ${sites.length} projects from dashboard\n• All deployed sites from Netlify, Cloudflare Pages, etc.\n• All deployment records\n\nThis action CANNOT be undone!\n\nType "DELETE ALL" to confirm:`)) {
            const confirmation = prompt("Type 'DELETE ALL' to proceed:");
            if (confirmation !== "DELETE ALL") {
                notify("Bulk delete cancelled", "warning");
                return;
            }
        }

        setBulkDeleting(true);
        const results = { success: [], failed: [] };

        try {
            // Delete from deployment platforms first
            for (const site of sites) {
                const deployedTargets = getDeployedTargets(site.id);

                for (const target of deployedTargets) {
                    try {
                        const result = await deleteProject(target.target, site, settings);
                        if (result.success) {
                            results.success.push(`${site.brand} (${target.target})`);
                        } else {
                            results.failed.push(`${site.brand} (${target.target}): ${result.error}`);
                        }
                    } catch (error) {
                        results.failed.push(`${site.brand} (${target.target}): ${error.message}`);
                    }
                }
            }

            // Clear all deploy URLs
            setDeployUrls({});
            LS.set("deployUrls", {});

            // Delete all sites from dashboard
            for (const site of sites) {
                del(site.id);
            }

            // Show results
            if (results.success.length > 0) {
                notify(`✅ Deleted ${results.success.length} projects:\n${results.success.join("\n")}`);
            }
            if (results.failed.length > 0) {
                notify(`⚠️ Failed to delete ${results.failed.length} projects:\n${results.failed.join("\n")}`, "warning");
            }

        } catch (error) {
            notify(`Bulk delete failed: ${error.message}`, "danger");
        } finally {
            setBulkDeleting(false);
        }
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

    const handlePolicyChange = (site, status) => {
        updateSite({ ...site, policyStatus: status });
        setEditingPolicySite(null);
        notify(`Updated policy for ${site.brand} to ${status}`);
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
            // For Git Push Pipeline, use Astro project files
            // For other targets, use HTML
            let content;
            if (false && target === "git-push-astro-source") {
                // Reserved: Astro source deploy (requires astro build in CI)
                console.log("[Sites] Using git-push target, calling generateAstroProjectByTemplate");
                const astroFiles = generateAstroProjectByTemplate(site);
                const applyHtml = generateApplyPageByTemplate(site);
                content = { ...astroFiles, "apply.html": applyHtml };
                console.log("[Sites] Generated astro files count:", Object.keys(content).length);
            } else {
                // Deploy edge compatible asset maps
                console.log("[Sites] Using non-git-push target, calling generateDeployAssetsByTemplate");
                const assets = generateDeployAssetsByTemplate(site);
                const applyHtml = generateApplyPageByTemplate(site);

                // If assets is a string (legacy behavior from single-file html router)
                if (typeof assets === "string") {
                    content = {
                        "index.html": assets,
                        "apply.html": applyHtml
                    };
                } else {
                    content = { ...assets, "apply.html": applyHtml };
                }
                console.log("[Sites] Generated content keys:", Object.keys(content));
            }

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

    const copyToClipboard = async (text, successMessage) => {
        if (!text) return;
        try {
            await navigator.clipboard?.writeText(text);
            notify(successMessage || "Copied to clipboard");
        } catch (e) {
            notify(`Copy failed: ${e.message}`, "danger");
        }
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

    const formatAgo = (ts) => {
        if (!ts) return "never";
        const date = new Date(ts);
        if (Number.isNaN(date.getTime())) return "unknown";
        const diffMs = Date.now() - date.getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
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

    const getGoogleAdsAccountLabel = (site) => {
        return site.googleAdsAccountName
            || site.googleAdsAccountLabel
            || site.googleAdsCustomerId
            || site.googleAdsAccountId
            || site.adsAccountName
            || site.adsAccountId
            || "Unassigned Ads";
    };

    const getCloudflareAccountLabel = (site) => {
        const siteDomain = normalizeDomain(site.domain);
        const linkedDomain = siteDomain ? domainsByName[siteDomain] : null;
        const linkedCfAccountId = linkedDomain?.cfAccountId || linkedDomain?.cf_account_id || "";
        const linkedCfAccount = linkedCfAccountId ? cfAccountsById[String(linkedCfAccountId)] : null;

        return site.cloudflareAccountName
            || site.cloudflareAccountId
            || site.cfAccountName
            || site.cfAccountId
            || linkedCfAccount?.label
            || linkedCfAccount?.email
            || linkedCfAccountId
            || linkedDomain?.zoneId
            || site.cfZoneId
            || "Unassigned CF";
    };

    const getPolicyStatus = (site) => {
        const raw = String(
            site.policyStatus
            || site.complianceStatus
            || site.reviewStatus
            || site.accountStatus
            || ""
        ).toLowerCase();

        if (raw.includes("ban")) return "Banned";
        if (raw.includes("limit") || raw.includes("risk")) return "Limited";
        if (raw.includes("warm")) return "Warming";
        if (raw.includes("clean") || raw.includes("active") || raw.includes("ok")) return "Clean";
        if (site.warmupStartedAt) return "Warming";
        return "Unknown";
    };

    const getPolicyTone = (status) => {
        if (status === "Banned") return { label: "Policy: Banned", color: T.danger };
        if (status === "Limited") return { label: "Policy: Limited", color: T.warning };
        if (status === "Warming") return { label: "Policy: Warming", color: "#f59e0b" };
        if (status === "Clean") return { label: "Policy: Clean", color: T.success };
        return { label: "Policy: Unknown", color: T.dim };
    };

    const truncateLabel = (value, max = 24) => {
        if (!value) return "-";
        return value.length > max ? `${value.slice(0, max - 1)}…` : value;
    };

    const checkSiteHealth = async (siteId, domain, gtagId) => {
        if (!domain) return;
        setCheckingHealth(p => ({ ...p, [siteId]: true }));
        let online = 'offline', ssl = 'unknown';
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 8000);
            await fetch(`https://${domain}`, { mode: 'no-cors', method: 'HEAD', signal: ctrl.signal });
            clearTimeout(t);
            online = 'online'; ssl = 'valid';
        } catch (e) {
            if (e.name === 'AbortError') {
                online = 'timeout'; ssl = 'unknown';
            } else {
                // Try HTTP to distinguish SSL issue vs full offline
                try {
                    const ctrl2 = new AbortController();
                    const t2 = setTimeout(() => ctrl2.abort(), 5000);
                    await fetch(`http://${domain}`, { mode: 'no-cors', method: 'HEAD', signal: ctrl2.signal });
                    clearTimeout(t2);
                    online = 'online'; ssl = 'invalid';
                } catch { online = 'offline'; }
            }
        }
        const tracking = !gtagId ? 'not_configured'
            : /^(G|AW|UA)-[\w-]+$/.test(gtagId) ? 'configured'
            : 'invalid';
        const result = { online, ssl, tracking, gtagId, checkedAt: Date.now() };
        setHealthResults(p => ({ ...p, [siteId]: result }));
        setCheckingHealth(p => { const n = { ...p }; delete n[siteId]; return n; });
        if (auditLog) {
            auditLog(
                siteId, 'health_check',
                `Health: ${online === 'online' ? 'Online' : online === 'timeout' ? 'Timeout' : 'Offline'} · SSL: ${ssl} · Track: ${tracking}`,
                '',
                { online, ssl, tracking, gtagId },
                online !== 'online' ? 'warning' : 'info'
            );
            // Update local audit cache
            setLocalAuditCache(p => ({
                ...p,
                [siteId]: [{ id: Date.now().toString(36), eventType: 'health_check', severity: online !== 'online' ? 'warning' : 'info',
                    title: `Health: ${online} · SSL: ${ssl} · Track: ${tracking}`, detail: '', meta: { online, ssl, tracking }, ts: new Date().toISOString() },
                    ...(p[siteId] || [])].slice(0, 200)
            }));
        }
    };

    const checkAllHealth = () => {
        sites.filter(s => s.domain).forEach(s => checkSiteHealth(s.id, s.domain, s.gtagId));
    };

    const loadSiteAudit = async (siteId) => {
        // Use in-memory from parent first
        const parentEvents = auditEvents?.[siteId];
        if (parentEvents?.length > 0) {
            setLocalAuditCache(p => ({ ...p, [siteId]: parentEvents }));
            return;
        }
        // LS fallback
        const lsEvents = LS.get(`audit:${siteId}`) || [];
        if (lsEvents.length > 0) {
            setLocalAuditCache(p => ({ ...p, [siteId]: lsEvents }));
            return;
        }
        // Lazy-load from Neon
        setLoadingAuditId(siteId);
        try {
            const { loadAuditEvents } = await import('../services/neon.js');
            const events = await loadAuditEvents(siteId, 50);
            if (events?.length > 0) setLocalAuditCache(p => ({ ...p, [siteId]: events }));
        } catch (_) {}
        setLoadingAuditId(null);
    };

    const toggleAuditPanel = (siteId) => {
        if (openAuditSiteId === siteId) {
            setOpenAuditSiteId(null);
        } else {
            setOpenAuditSiteId(siteId);
            loadSiteAudit(siteId);
        }
    };

    const hasIssue = (site) => {
        const deployedCount = getDeployedTargets(site.id).length;
        const policyStatus = getPolicyStatus(site);
        return !site.domain || deployedCount === 0 || policyStatus === "Banned" || policyStatus === "Limited";
    };

    const matchesQuickFilter = (site) => {
        const policyStatus = getPolicyStatus(site);
        const deployedCount = getDeployedTargets(site.id).length;

        if (quickFilter === "deployed") return deployedCount > 0;
        if (quickFilter === "banned") return policyStatus === "Banned";
        if (quickFilter === "warming") return policyStatus === "Warming";
        if (quickFilter === "no-domain") return !site.domain;
        if (quickFilter === "not-deployed") return deployedCount === 0;
        return true;
    };

    const getSortableTs = (site) => {
        const latestDeploy = getLatestDeploy(site.id);
        const deployTs = latestDeploy?.ts ? new Date(latestDeploy.ts).getTime() : NaN;
        if (!Number.isNaN(deployTs)) return deployTs;

        const updateTs = site.updatedAt || site._updatedAt || site._createdAt || site.createdAt;
        const parsed = updateTs ? new Date(updateTs).getTime() : NaN;
        return Number.isNaN(parsed) ? 0 : parsed;
    };

    const sortGroupSites = (siteA, siteB) => {
        if (sortBy === "latest") return getSortableTs(siteB) - getSortableTs(siteA);
        if (sortBy === "brand") return (siteA.brand || "").localeCompare(siteB.brand || "");

        const aIssue = hasIssue(siteA) ? 1 : 0;
        const bIssue = hasIssue(siteB) ? 1 : 0;
        if (bIssue !== aIssue) return bIssue - aIssue;

        return getSortableTs(siteB) - getSortableTs(siteA);
    };

    const applyQuickScope = (mode) => {
        if (mode === "issues") {
            setOnlyIssues(true);
            setQuickFilter("all");
            return;
        }

        setOnlyIssues(false);
        setQuickFilter(mode);
    };

    const isQuickScopeActive = (mode) => {
        if (mode === "issues") return onlyIssues;
        if (mode === "all") return quickFilter === "all" && !onlyIssues;
        return quickFilter === mode && !onlyIssues;
    };

    const getGroupBadgeButtonStyle = (mode) => {
        const active = isQuickScopeActive(mode);
        return {
            background: active ? `${T.primary}22` : "transparent",
            border: `1px solid ${active ? `${T.primary}66` : "transparent"}`,
            borderRadius: 999,
            padding: "1px 3px",
            cursor: "pointer",
        };
    };

    const getScopeHelpText = (mode) => {
        if (mode === "issues") return "Show issue-only sites in current search scope";
        if (mode === "deployed") return "Show sites that already have deployments";
        if (mode === "not-deployed") return "Show sites that have no deployments yet";
        if (mode === "warming") return "Show warming policy status sites";
        if (mode === "banned") return "Show banned policy status sites";
        return "Show all sites in current search scope";
    };

    const baseScopedSites = sites.filter((site) => {
        const keyword = `${site.brand || ""}${site.domain || ""}`.toLowerCase();
        const matchesSearch = keyword.includes(search.toLowerCase());
        return matchesSearch && (!onlyIssues || hasIssue(site));
    });

    const quickFilterCounts = useMemo(() => {
        const counts = {
            all: baseScopedSites.length,
            deployed: 0,
            banned: 0,
            warming: 0,
            "no-domain": 0,
            "not-deployed": 0,
        };

        baseScopedSites.forEach((site) => {
            const policyStatus = getPolicyStatus(site);
            const deployedCount = getDeployedTargets(site.id).length;
            if (deployedCount > 0) counts.deployed += 1;
            if (policyStatus === "Banned") counts.banned += 1;
            if (policyStatus === "Warming") counts.warming += 1;
            if (!site.domain) counts["no-domain"] += 1;
            if (deployedCount === 0) counts["not-deployed"] += 1;
        });

        return counts;
    }, [baseScopedSites]);

    const filteredSites = baseScopedSites.filter((site) => {
        return matchesQuickFilter(site);
    });

    const groupedSites = useMemo(() => {
        const buckets = {};

        filteredSites.forEach((site) => {
            const policyStatus = getPolicyStatus(site);
            const deployedCount = getDeployedTargets(site.id).length;
            const issue = !site.domain || deployedCount === 0 || policyStatus === "Banned" || policyStatus === "Limited";

            let key = "All Sites";
            if (groupBy === "google-ads") key = getGoogleAdsAccountLabel(site);
            if (groupBy === "cloudflare") key = getCloudflareAccountLabel(site);
            if (groupBy === "status") key = policyStatus;
            if (groupBy === "template") key = getTemplateLabel(site.templateId || "classic");

            if (!buckets[key]) {
                buckets[key] = {
                    key,
                    label: key,
                    sites: [],
                    deployed: 0,
                    notDeployed: 0,
                    issue: 0,
                    banned: 0,
                    warming: 0,
                };
            }

            buckets[key].sites.push(site);
            if (deployedCount > 0) buckets[key].deployed += 1;
            if (deployedCount === 0) buckets[key].notDeployed += 1;
            if (issue) buckets[key].issue += 1;
            if (policyStatus === "Banned") buckets[key].banned += 1;
            if (policyStatus === "Warming") buckets[key].warming += 1;
        });

        return Object.values(buckets)
            .map((group) => ({
                ...group,
                sites: group.sites.sort(sortGroupSites),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [filteredSites, groupBy, sortBy]);

    // Persist dark mode preference
    useEffect(() => { LS.set("sitesDarkMode", isDark); }, [isDark]);

    // Theme tokens
    const dk = isDark;
    const bg      = dk ? "#09090b" : "#f4f4f5";
    const surface = dk ? "#18181b" : "#ffffff";
    const surfaceHover = dk ? "#27272a" : "#f9f9f9";
    const border  = dk ? "#27272a" : "#e4e4e7";
    const borderFaint = dk ? "#1c1c1f" : "#f0f0f0";
    const text    = dk ? "#fafafa" : "#09090b";
    const textSub = dk ? "#a1a1aa" : "#52525b";
    const textFaint = dk ? "#52525b" : "#a1a1aa";
    const accent  = "#ea580c";
    const accentDk = "#f97316";
    const accentColor = dk ? accentDk : accent;

    // ── shadcn-style button helper ──
    const b = (variant = "default", size = "default") => {
        const base = {
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", outline: "none",
            transition: "opacity .15s, background .15s",
            borderRadius: 6, fontWeight: 500, border: "none",
            ...(size === "xs" ? { height: 26, padding: "0 8px",  fontSize: 11 } :
                size === "sm" ? { height: 32, padding: "0 12px", fontSize: 13 } :
                size === "lg" ? { height: 40, padding: "0 24px", fontSize: 14 } :
                                { height: 36, padding: "0 16px", fontSize: 14 }),
        };
        if (variant === "default")     return { ...base, background: dk ? "#fafafa" : "#18181b", color: dk ? "#09090b" : "#fafafa" };
        if (variant === "secondary")   return { ...base, background: dk ? "#27272a" : "#f4f4f5", color: dk ? "#e4e4e7" : "#18181b" };
        if (variant === "outline")     return { ...base, background: "transparent", border: `1px solid ${border}`, color: text };
        if (variant === "ghost")       return { ...base, background: "transparent", color: textSub };
        if (variant === "orange")      return { ...base, background: accentColor, color: "#fff" };
        if (variant === "destructive") return { ...base, background: "#dc2626", color: "#fff" };
        if (variant === "destOutline") return { ...base, background: "transparent", border: "1px solid #fca5a5", color: "#dc2626" };
        return base;
    };

    return (
        <div style={{ margin: "-24px -28px", padding: "32px 36px", background: bg, minHeight: "calc(100vh - 48px)", transition: "background .2s, color .2s", fontFamily: "'Inter', sans-serif" }}>

            {/* ── Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: text, letterSpacing: "-0.02em" }}>My Sites</h1>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: textSub }}>
                        {sites.length} landing {sites.length === 1 ? "page" : "pages"} · manage & deploy
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={checkAllHealth} style={b("outline", "sm")} title="Check online status, SSL & tracking for all sites">
                        ↻ Health Check
                    </button>
                    <button onClick={() => setIsDark(!isDark)} style={b("outline", "sm")}>
                        {isDark ? "☀ Light" : "☽ Dark"}
                    </button>
                    {sites.length > 0 && (
                        <button onClick={handleBulkDelete} disabled={bulkDeleting} style={{ ...b("destOutline", "sm"), opacity: bulkDeleting ? 0.5 : 1 }}>
                            {bulkDeleting ? "Deleting…" : "Delete All"}
                        </button>
                    )}
                    <button onClick={startCreate} style={b("default")}>
                        + Create LP
                    </button>
                </div>
            </div>

            {/* ── Stats ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
                {[
                    { label: "Total Sites",     value: sites.length,                                                                                   accent: "#6366f1" },
                    { label: "Deployed",        value: Object.keys(deployUrls).filter(k => Object.keys(deployUrls[k]||{}).length > 0).length,          accent: "#22c55e" },
                    { label: "Need Attention",  value: sites.filter(s => !s.domain || getDeployedTargets(s.id).length === 0).length,                   accent: "#f59e0b" },
                    { label: "Deploying Now",   value: deploying ? 1 : 0,                                                                              accent: accentColor },
                ].map((stat, i) => (
                    <div key={i} style={{ background: surface, borderTop: `1px solid ${border}`, borderRight: `1px solid ${border}`, borderBottom: `1px solid ${border}`, borderLeft: `3px solid ${stat.accent}`, borderRadius: 12, padding: "16px 20px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: textFaint, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{stat.label}</div>
                        <div style={{ fontSize: 30, fontWeight: 700, color: text, lineHeight: 1 }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* ── Toolbar ── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <div style={{ position: "relative" }}>
                    <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: textFaint }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites…"
                        style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, width: 210, fontSize: 13, borderRadius: 8, outline: "none", background: surface, border: `1px solid ${border}`, color: text }} />
                </div>
                <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
                    style={{ padding: "8px 10px", fontSize: 12, borderRadius: 8, cursor: "pointer", background: surface, border: `1px solid ${border}`, color: textSub, outline: "none" }}>
                    <option value="google-ads">Group: Google Ads</option>
                    <option value="cloudflare">Group: Cloudflare</option>
                    <option value="status">Group: Policy Status</option>
                    <option value="template">Group: Template</option>
                    <option value="none">No grouping</option>
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    style={{ padding: "8px 10px", fontSize: 12, borderRadius: 8, cursor: "pointer", background: surface, border: `1px solid ${border}`, color: textSub, outline: "none" }}>
                    <option value="issues-first">Sort: Issues first</option>
                    <option value="latest">Sort: Latest</option>
                    <option value="brand">Sort: A – Z</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: textSub, cursor: "pointer" }}>
                    <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} style={{ accentColor: accentColor }} />
                    Only issues
                </label>
            </div>

            {/* ── Quick filter chips ── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 28 }}>
                {[
                    { id: "all",          label: "All" },
                    { id: "deployed",     label: "Deployed",     on: { bg: dk?"#14532d30":"#f0fdf4", text:"#16a34a", border:"#86efac" } },
                    { id: "not-deployed", label: "Not Deployed" },
                    { id: "banned",       label: "Banned",       on: { bg: dk?"#450a0a30":"#fef2f2", text:"#dc2626", border:"#fca5a5" } },
                    { id: "warming",      label: "Warming",      on: { bg: dk?"#451a0330":"#fffbeb", text:"#d97706", border:"#fde68a" } },
                    { id: "no-domain",    label: "No Domain" },
                ].map(chip => {
                    const active = quickFilter === chip.id;
                    const on = chip.on || { bg: dk?"#431a0030":"#fff7ed", text: accentColor, border:"#fdba74" };
                    return (
                        <button key={chip.id} onClick={() => setQuickFilter(chip.id)}
                            style={{
                                ...b("outline", "sm"),
                                borderRadius: 999, fontWeight: active ? 600 : 400,
                                background: active ? on.bg : "transparent",
                                borderColor: active ? on.border : border,
                                color: active ? on.text : textSub,
                            }}>
                            {chip.label} ({quickFilterCounts[chip.id] || 0})
                        </button>
                    );
                })}
            </div>

            {/* ── Empty state ── */}
            {filteredSites.length === 0 ? (
                <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: "80px 32px", textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🏗</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: text, marginBottom: 4 }}>No sites yet</div>
                    <div style={{ fontSize: 13, color: textFaint }}>Create your first landing page to get started</div>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                    {groupedSites.map(group => (
                        <div key={group.key}>
                            {/* Group header */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{group.label}</span>
                                <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, background: dk?"#27272a":"#f0f0f0", color: textSub, fontWeight: 600 }}>{group.sites.length}</span>
                                <div style={{ flex: 1, height: 1, background: border }} />
                                <div style={{ display: "flex", gap: 5 }}>
                                    {group.deployed > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: dk?"#14532d30":"#f0fdf4", color: "#16a34a", border: "1px solid #86efac" }}>{group.deployed} live</span>}
                                    {group.issue > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: dk?"#451a0330":"#fffbeb", color: "#d97706", border: "1px solid #fde68a" }}>{group.issue} issue{group.issue!==1?"s":""}</span>}
                                    {group.banned > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: dk?"#450a0a30":"#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}>{group.banned} banned</span>}
                                </div>
                            </div>

                            {/* Site cards */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                                {group.sites.map(s => {
                                    const co = COLORS.find(x => x.id === s.colorId);
                                    const deployed = getDeployedTargets(s.id);
                                    const isDeploying = deploying?.siteId === s.id;
                                    const latestUpdate = s.updatedAt || s._updatedAt || s._createdAt || s.createdAt;
                                    const templateLabel = getTemplateLabel(s.templateId || "classic");
                                    const latestDeploy = getLatestDeploy(s.id);
                                    const policyStatus = getPolicyStatus(s);
                                    const googleAdsLabel = getGoogleAdsAccountLabel(s);
                                    const cloudflareLabel = getCloudflareAccountLabel(s);
                                    const landerTrackingUrl = s.voluumLanderTrackingUrl || buildLanderTrackingUrl({
                                        domain: s.domain,
                                        campaignId: s.voluumCampaignId || s.voluumId || "",
                                        landerId: s.voluumLanderId || "",
                                    });
                                    const avatarBg = co ? hsl(...co.p) : accentColor;

                                    const deployBadge = deployed.length > 0
                                        ? { text: `● ${deployed.length} live`, bg: dk?"#14532d30":"#f0fdf4", color: "#16a34a", border: "#86efac" }
                                        : { text: "○ Not deployed", bg: dk?"#27272a":surface, color: textFaint, border: border };

                                    const policyBadge =
                                        policyStatus === "Banned"  ? { bg: dk?"#450a0a30":"#fef2f2",  color:"#dc2626", border:"#fca5a5" } :
                                        policyStatus === "Limited" ? { bg: dk?"#431a0030":"#fff7ed",  color: accentColor, border:"#fdba74" } :
                                        policyStatus === "Warming" ? { bg: dk?"#451a0330":"#fffbeb",  color:"#d97706", border:"#fde68a" } :
                                        policyStatus === "Clean"   ? { bg: dk?"#14532d30":"#f0fdf4",  color:"#16a34a", border:"#86efac" } :
                                        { bg: dk?"#27272a":surface, color: textFaint, border };

                                    return (
                                        <div key={s.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden" }}>
                                            {/* Card top: identity + status */}
                                            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 20px 14px" }}>
                                                {/* Avatar */}
                                                <div style={{ width: 44, height: 44, borderRadius: 11, background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                                                    {s.brand?.[0]?.toUpperCase()}
                                                </div>
                                                {/* Name & domain */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 15, fontWeight: 700, color: text }}>{s.brand}</div>
                                                    <div style={{ fontSize: 12, color: s.domain ? textSub : "#f59e0b", marginTop: 2 }}>
                                                        {s.domain || "⚠ No domain set"}
                                                    </div>
                                                </div>
                                                {/* Status badges + delete */}
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: deployBadge.bg, color: deployBadge.color, border: `1px solid ${deployBadge.border}` }}>
                                                            {deployBadge.text}
                                                        </span>
                                                        <span onClick={e => { e.stopPropagation(); setEditingPolicySite(editingPolicySite === s.id ? null : s.id); }}
                                                            style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, cursor: "pointer", background: policyBadge.bg, color: policyBadge.color, border: `1px solid ${policyBadge.border}` }}
                                                            title="Click to change">
                                                            {policyStatus} ✏
                                                        </span>
                                                        <button onClick={() => handleDelete(s)} style={b("destOutline", "xs")}>
                                                            Delete
                                                        </button>
                                                    </div>
                                                    {/* Policy editor dropdown */}
                                                    {editingPolicySite === s.id && (
                                                        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.15)", padding: "4px", zIndex: 100, minWidth: 140 }}>
                                                            <div style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px 6px", color: textFaint, letterSpacing: "0.07em", textTransform: "uppercase" }}>Policy Status</div>
                                                            {["Warming","Limited","Banned","Unknown"].map(st => (
                                                                <button key={st} onClick={() => handlePolicyChange(s, st)}
                                                                    style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 12px", fontSize: 12, background: "transparent", border: "none", color: text, cursor: "pointer", borderRadius: 6 }}>
                                                                    {st}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Info row */}
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 20px", padding: "0 20px 14px 78px", fontSize: 12, color: textFaint }}>
                                                <span>Template: <b style={{ color: textSub, fontWeight: 500 }}>{templateLabel}</b></span>
                                                <span>CF: <b style={{ color: textSub, fontWeight: 500 }}>{truncateLabel(cloudflareLabel, 26)}</b></span>
                                                <span>Ads: <b style={{ color: textSub, fontWeight: 500 }}>{truncateLabel(googleAdsLabel, 26)}</b></span>
                                                <span>Updated <b style={{ color: textSub, fontWeight: 500 }}>{formatAgo(latestUpdate)}</b></span>
                                                <span>
                                                    Live:{" "}
                                                    {latestDeploy?.url
                                                        ? <a href={latestDeploy.url} target="_blank" rel="noreferrer" style={{ color: accentColor, textDecoration: "none", fontWeight: 500 }}>{latestDeploy.url}</a>
                                                        : <span style={{ color: textFaint }}>Not deployed yet</span>}
                                                </span>
                                            </div>

                                            {/* Health row */}
                                            {(healthResults[s.id] || checkingHealth[s.id]) && s.domain && (() => {
                                                const h = healthResults[s.id];
                                                const checking = !!checkingHealth[s.id];
                                                const onlineColor = !h ? textFaint : h.online === 'online' ? "#16a34a" : h.online === 'timeout' ? "#f59e0b" : "#dc2626";
                                                const onlineLabel = !h ? '' : h.online === 'online' ? '● Online' : h.online === 'timeout' ? '◌ Timeout' : '● Offline';
                                                const sslColor = !h ? textFaint : h.ssl === 'valid' ? "#16a34a" : h.ssl === 'invalid' ? "#dc2626" : textFaint;
                                                const sslLabel = !h ? '' : h.ssl === 'valid' ? '🔒 SSL OK' : h.ssl === 'invalid' ? '⚠ SSL issue' : '';
                                                const trackColor = !h ? textFaint : h.tracking === 'configured' ? "#16a34a" : h.tracking === 'not_configured' ? "#f59e0b" : "#dc2626";
                                                const trackLabel = !h ? '' : h.tracking === 'configured' ? `✓ gtag: ${h.gtagId}` : h.tracking === 'not_configured' ? '✗ No gtag set' : '⚠ gtag invalid';
                                                const checkedAgo = h ? Math.round((Date.now() - h.checkedAt) / 1000) : 0;
                                                const agoStr = checkedAgo < 60 ? `${checkedAgo}s ago` : `${Math.round(checkedAgo / 60)}m ago`;
                                                return (
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", padding: "6px 20px 10px 78px", fontSize: 11, alignItems: "center" }}>
                                                        {checking ? (
                                                            <span style={{ color: textFaint }}>⏳ Checking…</span>
                                                        ) : <>
                                                            <span style={{ fontWeight: 600, color: onlineColor }}>{onlineLabel}</span>
                                                            {sslLabel && <span style={{ color: sslColor }}>{sslLabel}</span>}
                                                            <span style={{ color: trackColor }}>{trackLabel}</span>
                                                            {h.tracking === 'configured' && (
                                                                <a href={`https://tagassistant.google.com/#/?source=TAG_MANAGER&url=https://${s.domain}`} target="_blank" rel="noreferrer"
                                                                    style={{ color: accentColor, textDecoration: "none", fontSize: 10 }}>Test ↗</a>
                                                            )}
                                                            <span style={{ color: textFaint, opacity: 0.6, marginLeft: "auto" }}>checked {agoStr}</span>
                                                        </>}
                                                        <button onClick={() => checkSiteHealth(s.id, s.domain, s.gtagId)} disabled={checking}
                                                            style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, border: `1px solid ${border}`, background: "transparent", color: textFaint, cursor: "pointer", opacity: checking ? 0.4 : 1 }}>
                                                            ↻
                                                        </button>
                                                    </div>
                                                );
                                            })()}

                                            {/* Deploy status */}
                                            <DeployStatusChecker site={s} deployedTargets={deployed} settings={settings} isDark={isDark} surfaceAlt={dk?"#111113":"#f9f9f9"} borderColor={border} textFaint={textFaint} textSub={textSub} />

                                            {/* Action buttons */}
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "12px 20px 16px 78px", borderTop: `1px solid ${borderFaint}` }}>
                                                {s.domain && (
                                                    <ActionBtn onClick={() => checkSiteHealth(s.id, s.domain, s.gtagId)} disabled={!!checkingHealth[s.id]} isDark={isDark} title="Check online status, SSL & tracking">
                                                        {checkingHealth[s.id] ? "Checking…" : "↻ Health"}
                                                    </ActionBtn>
                                                )}
                                                {!!landerTrackingUrl && <>
                                                    <ActionBtn onClick={() => window.open(landerTrackingUrl,"_blank","noopener,noreferrer")} isDark={isDark}>Open Test</ActionBtn>
                                                    <ActionBtn onClick={() => copyToClipboard(landerTrackingUrl,`Copied URL for ${s.brand}`)} isDark={isDark}>Copy Ads URL</ActionBtn>
                                                </>}
                                                <ActionBtn onClick={() => startCreate(s)} isDark={isDark}>Edit & Redeploy</ActionBtn>
                                                {startDuplicate && <ActionBtn onClick={() => startDuplicate(s)} isDark={isDark}>Duplicate</ActionBtn>}
                                                {addSite && <ActionBtn onClick={() => setCloneSource(s)} isDark={isDark} variant="outline" title="Clone this site and change domain, account & color without opening the full wizard">⟳ Clone & Rotate</ActionBtn>}
                                                {auditLog && <ActionBtn onClick={() => setLogEventModal(s)} isDark={isDark} title="Add manual audit entry">+ Log</ActionBtn>}

                                                {/* Download */}
                                                <div style={{ position: "relative" }} ref={openDownload === s.id ? downloadRef : null}>
                                                    <ActionBtn onClick={() => setOpenDownload(openDownload===s.id?null:s.id)} isDark={isDark}>Download ▾</ActionBtn>
                                                    {openDownload === s.id && (
                                                        <div style={{ position:"absolute", top:"100%", left:0, marginTop:4, background:surface, border:`1px solid ${border}`, borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,.15)", zIndex:100, minWidth:220, padding:4 }}>
                                                            <DropdownItem icon="🚀" label="Astro Project (ZIP)" desc="Full source, buildable" isDark={isDark} textColor={text} mutedColor={textFaint} hoverBg={surfaceHover} onClick={() => { setOpenDownload(null); downloadAstroZip(s); }} />
                                                            <DropdownItem icon="📄" label="Static HTML (ZIP)" desc="Single index.html" isDark={isDark} textColor={text} mutedColor={textFaint} hoverBg={surfaceHover} onClick={() => { setOpenDownload(null); downloadHtmlZip(s); }} />
                                                            <DropdownItem icon="📝" label="Apply Page (HTML)" desc="Form embed page" isDark={isDark} textColor={text} mutedColor={textFaint} hoverBg={surfaceHover} onClick={() => { setOpenDownload(null); downloadApplyPage(s); }} />
                                                            <DropdownItem icon="🎨" label="Theme JSON" desc="Design tokens export" isDark={isDark} textColor={text} mutedColor={textFaint} hoverBg={surfaceHover} onClick={() => { setOpenDownload(null); exportJson(s); }} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Deploy */}
                                                <div style={{ position: "relative" }} ref={openDeploy === s.id ? deployRef : null}>
                                                    <button onClick={() => setOpenDeploy(openDeploy===s.id?null:s.id)} disabled={isDeploying}
                                                        style={{ ...b("orange", "sm"), opacity: isDeploying ? 0.6 : 1, cursor: isDeploying ? "wait" : "pointer" }}>
                                                        {isDeploying ? "Deploying…" : "Deploy ▾"}
                                                    </button>
                                                    {openDeploy === s.id && !isDeploying && (
                                                        <div style={{ position:"absolute", top:"100%", left:0, marginTop:4, background:surface, border:`1px solid ${border}`, borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,.15)", zIndex:100, minWidth:220, padding:4 }}>
                                                            {availableTargets.map(t => (
                                                                <DropdownItem key={t.id} icon={t.icon} label={t.label} desc={t.configured ? t.description : "⚠ Not configured"}
                                                                    disabled={!t.configured} active={!!deployUrls[s.id]?.[t.id]}
                                                                    isDark={isDark} textColor={text} mutedColor={textFaint} hoverBg={surfaceHover}
                                                                    onClick={() => t.configured && handleDeploy(s, t.id)} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Activity toggle */}
                                            {auditLog && (
                                                <button onClick={() => toggleAuditPanel(s.id)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 20px 5px 78px', width: '100%', background: 'transparent', border: 'none', borderTop: `1px solid ${borderFaint}`, fontSize: 11, color: textFaint, cursor: 'pointer', textAlign: 'left' }}>
                                                    <span>{openAuditSiteId === s.id ? '▲' : '▼'}</span>
                                                    <span>Activity</span>
                                                    {(localAuditCache[s.id]?.length > 0 || auditEvents?.[s.id]?.length > 0) && (
                                                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: dk ? '#27272a' : '#f4f4f5', color: textSub }}>
                                                            {(localAuditCache[s.id] || auditEvents?.[s.id] || []).length}
                                                        </span>
                                                    )}
                                                    {loadingAuditId === s.id && <span style={{ opacity: 0.5 }}>loading…</span>}
                                                </button>
                                            )}

                                            {/* Activity panel */}
                                            {openAuditSiteId === s.id && (
                                                <SiteAuditPanel
                                                    events={localAuditCache[s.id] || auditEvents?.[s.id] || []}
                                                    isDark={dk}
                                                    border={border}
                                                    borderFaint={borderFaint}
                                                    textFaint={textFaint}
                                                    textSub={textSub}
                                                    text={text}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Clone & Rotate modal */}
            {cloneSource && addSite && createPortal(
                <CloneRotateModal
                    source={cloneSource}
                    isDark={isDark}
                    ops={ops}
                    colors={COLORS}
                    onClose={() => setCloneSource(null)}
                    onClone={(newSite) => {
                        addSite(newSite);
                        setCloneSource(null);
                        notify(`${newSite.brand} cloned from ${cloneSource.brand}!`);
                    }}
                />,
                document.body
            )}

            {/* Log Event modal */}
            {logEventModal && auditLog && createPortal(
                <LogEventModal
                    site={logEventModal}
                    isDark={isDark}
                    onClose={() => setLogEventModal(null)}
                    onSubmit={auditLog}
                />,
                document.body
            )}

            {/* Preview modal */}
            {preview && createPortal(
                <div onClick={e => { if (e.target===e.currentTarget) setPreview(null); }}
                    style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", zIndex:10000, display:"flex", flexDirection:"column", padding:24 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, alignItems:"center" }}>
                        <div style={{ color:"#fff", fontWeight:700 }}>Preview: {preview.brand}</div>
                        <button onClick={() => setPreview(null)} style={{ padding:"6px 14px", background:"#dc2626", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}>Close</button>
                    </div>
                    <iframe title="preview" style={{ flex:1, background:"#fff", borderRadius:12, border:"none" }} srcDoc={generateHtmlByTemplate(preview)} />
                </div>,
                document.body
            )}
        </div>
    );
}

function ActionBtn({ onClick, variant = "secondary", isDark: dk2, children, disabled, title }) {
    const style = {
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        height: 32, padding: "0 12px", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13, fontWeight: 500, fontFamily: "inherit", whiteSpace: "nowrap",
        transition: "opacity .15s, background .15s", outline: "none",
        opacity: disabled ? 0.5 : 1,
        ...(variant === "secondary"  ? { background: dk2 ? "#27272a" : "#f4f4f5", border: "none",                        color: dk2 ? "#e4e4e7" : "#18181b" } :
            variant === "outline"    ? { background: "transparent",               border: `1px solid ${dk2?"#3f3f46":"#e4e4e7"}`, color: dk2 ? "#e4e4e7" : "#18181b" } :
            variant === "ghost"      ? { background: "transparent",               border: "none",                        color: dk2 ? "#a1a1aa" : "#71717a" } :
            variant === "orange"     ? { background: "#ea580c",                   border: "none",                        color: "#fff" } :
            variant === "default"    ? { background: dk2 ? "#fafafa" : "#18181b", border: "none",                        color: dk2 ? "#09090b" : "#fafafa" } :
                                       { background: dk2 ? "#27272a" : "#f4f4f5", border: "none",                        color: dk2 ? "#e4e4e7" : "#18181b" }),
    };
    return <button onClick={onClick} disabled={disabled} title={title} style={style}>{children}</button>;
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

function DeployStatusChecker({ site, deployedTargets, settings, isDark, surfaceAlt, borderColor, textFaint, textSub }) {
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

    const sa = surfaceAlt || "#f9f9f9";
    const bc = borderColor || "#e4e4e7";
    const tf = textFaint || "#a1a1aa";
    return (
        <div style={{ margin: "0 20px 0 78px", padding: "8px 10px", background: sa, border: `1px solid ${bc}`, borderRadius: 8, marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: tf, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Deploy Status
                    {lastChecked && <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.7 }}>· {lastChecked.toLocaleTimeString()}</span>}
                </span>
                <button onClick={checkAll} disabled={loading}
                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, border: `1px solid ${bc}`, background: "transparent", color: tf, cursor: "pointer", opacity: loading ? 0.5 : 1 }}>
                    {loading ? "Checking…" : "Check"}
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

function DropdownItem({ icon, label, desc, onClick, disabled, active, textColor, mutedColor, hoverBg }) {
    const [hovered, setHovered] = useState(false);
    const tc = textColor || "#09090b";
    const mc = mutedColor || "#a1a1aa";
    const hb = hoverBg || "#f4f4f5";
    return (
        <button onClick={disabled ? undefined : onClick}
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"8px 10px",
                background: hovered && !disabled ? hb : "transparent",
                border:"none", borderRadius:6, cursor: disabled?"not-allowed":"pointer",
                textAlign:"left", color: disabled ? mc : tc, opacity: disabled ? 0.5 : 1, transition:"background .15s" }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, display:"flex", alignItems:"center", gap:4 }}>
                    {label}
                    {active && <span style={{ fontSize: 9, color:"#16a34a", fontWeight:700 }}>● LIVE</span>}
                </div>
                {desc && <div style={{ fontSize: 10, color: mc, marginTop: 1 }}>{desc}</div>}
            </div>
        </button>
    );
}

/* ─── Clone & Rotate Modal ─── */
function CloneRotateModal({ source, onClose, onClone, isDark, ops, colors }) {
    const dk = isDark;
    const surface  = dk ? "#18181b" : "#ffffff";
    const bg       = dk ? "#09090b" : "#f9fafb";
    const border   = dk ? "#27272a" : "#e4e4e7";
    const text     = dk ? "#fafafa" : "#09090b";
    const textSub  = dk ? "#a1a1aa" : "#52525b";
    const accent   = "#ea580c";

    // Collect unique Google Ads account names from ops
    const adsAccounts = [...new Set([
        ...(ops?.accounts  || []).map(a => a.name || a.label || a.googleAdsAccountName).filter(Boolean),
        ...(ops?.profiles  || []).map(p => p.googleAdsAccountName || p.adsAccountName).filter(Boolean),
    ])].filter(Boolean);

    const cfAccounts = ops?.cfAccounts || [];

    // Default: next color in list, same account, empty domain/brand
    const nextColor = colors.find(c => c.id !== source.colorId)?.id || colors[0].id;
    const [form, setForm] = useState({
        brand:                  (source.brand || '') + ' 2',
        domain:                 '',
        colorId:                nextColor,
        googleAdsAccountName:   source.googleAdsAccountName || '',
        cfAccountId:            source.cfAccountId || '',
        cloudflareAccountName:  source.cloudflareAccountName || '',
    });
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = (e) => {
        e.preventDefault();
        const {
            id, domain, brand, email, phone, address,
            voluumCampaignId, voluumCampaignName, voluumClickUrl,
            voluumTrackingDomain, voluumLanderTrackingUrl, voluumLanderId,
            voluumOfferId, voluumLanderScript, voluumCfCname, voluumAcmName, voluumAcmValue,
            status, createdAt, updatedAt, cost, _editMode,
            ...portable
        } = source;
        onClone({
            ...portable,
            id: uid(),
            brand: form.brand.trim(),
            domain: form.domain.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0],
            colorId: form.colorId,
            googleAdsAccountName: form.googleAdsAccountName,
            cloudflareAccountName: form.cloudflareAccountName || portable.cloudflareAccountName,
            cfAccountId: form.cfAccountId || portable.cfAccountId,
            createdAt: now(),
            updatedAt: now(),
            _editMode: false,
        });
    };

    const inputStyle = {
        width: "100%", padding: "8px 12px", borderRadius: 8,
        border: `1px solid ${border}`, background: bg, color: text,
        fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    };
    const labelStyle = { display: "flex", flexDirection: "column", gap: 5 };
    const labelTextStyle = { fontSize: 12, fontWeight: 600, color: textSub };

    return (
        <div onClick={e => e.target === e.currentTarget && onClose()}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <form onSubmit={handleSubmit}
                style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: "28px 28px 24px", width: "100%", maxWidth: 460, boxShadow: "0 24px 48px rgba(0,0,0,.35)", fontFamily: "inherit" }}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: text, letterSpacing: "-0.01em" }}>⟳ Clone & Rotate</div>
                        <div style={{ fontSize: 12, color: textSub, marginTop: 3 }}>
                            Cloning from <b style={{ color: text }}>{source.brand}</b> · keeps template, headline & settings
                        </div>
                    </div>
                    <button type="button" onClick={onClose}
                        style={{ background: "none", border: "none", color: textSub, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 2 }}>✕</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Brand + Domain side by side */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <label style={labelStyle}>
                            <span style={labelTextStyle}>Brand Name</span>
                            <input value={form.brand} onChange={e => set('brand', e.target.value)} required style={inputStyle} placeholder="e.g. SwiftCash 2" />
                        </label>
                        <label style={labelStyle}>
                            <span style={labelTextStyle}>New Domain <span style={{ color: accent }}>*</span></span>
                            <input value={form.domain} onChange={e => set('domain', e.target.value)} required style={inputStyle} placeholder="e.g. newdomain.com" />
                        </label>
                    </div>

                    {/* Color picker */}
                    <div style={labelStyle}>
                        <span style={labelTextStyle}>Color Theme</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "6px 0" }}>
                            {colors.map(c => {
                                const swatch = `hsl(${c.p[0]}, ${c.p[1]}%, ${c.p[2]}%)`;
                                const selected = form.colorId === c.id;
                                const isSource = source.colorId === c.id;
                                return (
                                    <button key={c.id} type="button" onClick={() => set('colorId', c.id)} title={c.name + (isSource ? ' (current)' : '')}
                                        style={{ width: 32, height: 32, borderRadius: 9, background: swatch, cursor: "pointer", position: "relative",
                                            border: selected ? `2.5px solid ${accent}` : `2px solid transparent`,
                                            outline: selected ? `2px solid ${accent}44` : "none",
                                            opacity: isSource && !selected ? 0.4 : 1 }}>
                                        {isSource && !selected && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✓</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ fontSize: 11, color: textSub }}>
                            {colors.find(c => c.id === form.colorId)?.name}
                            {source.colorId === form.colorId && <span style={{ color: "#f59e0b", marginLeft: 6 }}>⚠ same as source</span>}
                        </div>
                    </div>

                    {/* Google Ads Account */}
                    <label style={labelStyle}>
                        <span style={labelTextStyle}>Google Ads Account <span style={{ color: textSub, fontWeight: 400 }}>(rotate to different account)</span></span>
                        {adsAccounts.length > 0 ? (
                            <select value={form.googleAdsAccountName} onChange={e => set('googleAdsAccountName', e.target.value)}
                                style={{ ...inputStyle, appearance: "none" }}>
                                <option value="">— keep same ({source.googleAdsAccountName || 'Unassigned'}) —</option>
                                {adsAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        ) : (
                            <input value={form.googleAdsAccountName} onChange={e => set('googleAdsAccountName', e.target.value)}
                                style={inputStyle} placeholder={source.googleAdsAccountName || 'Google Ads account name'} />
                        )}
                    </label>

                    {/* CF Account — only show if accounts are configured */}
                    {cfAccounts.length > 0 && (
                        <label style={labelStyle}>
                            <span style={labelTextStyle}>Cloudflare Account</span>
                            <select value={form.cfAccountId} onChange={e => set('cfAccountId', e.target.value)}
                                style={{ ...inputStyle, appearance: "none" }}>
                                <option value="">— keep same —</option>
                                {cfAccounts.map(a => {
                                    const id = a.id || a.accountId || a.account_id;
                                    const label = a.label || a.email || id;
                                    return <option key={id} value={id}>{label}</option>;
                                })}
                            </select>
                        </label>
                    )}
                </div>

                {/* Footer */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24, paddingTop: 20, borderTop: `1px solid ${border}` }}>
                    <button type="button" onClick={onClose}
                        style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                        Cancel
                    </button>
                    <button type="submit"
                        style={{ padding: "8px 22px", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Clone & Create →
                    </button>
                </div>
            </form>
        </div>
    );
}

// ─── Site Audit Panel ───────────────────────────────────────────────────────

const AUDIT_META = {
    site_created:   { icon: '🆕', color: '#16a34a' },
    site_cloned:    { icon: '⟳',  color: '#3b82f6' },
    site_deployed:  { icon: '🚀', color: '#3b82f6' },
    policy_changed: { icon: '⚠',  color: '#f59e0b' },
    domain_changed: { icon: '🌐', color: '#8b5cf6' },
    health_check:   { icon: '❤',  color: '#64748b' },
    proxy_assigned: { icon: '🔗', color: '#0ea5e9' },
    note_added:     { icon: '📝', color: '#6b7280' },
    ad_disapproved: { icon: '🚫', color: '#dc2626' },
    account_warned: { icon: '⚡', color: '#f59e0b' },
    account_banned: { icon: '🔴', color: '#dc2626' },
};

function SiteAuditPanel({ events, isDark, border, borderFaint, textFaint, textSub, text }) {
    const [showAll, setShowAll] = React.useState(false);
    const shown = showAll ? events : events.slice(0, 5);
    const bg = isDark ? '#0d0d10' : '#f9f9fb';

    if (events.length === 0) {
        return (
            <div style={{ padding: '10px 20px 10px 78px', fontSize: 11, color: textFaint, background: bg }}>
                No activity recorded yet
            </div>
        );
    }

    const relativeTime = (ts) => {
        if (!ts) return '';
        const diff = Date.now() - new Date(ts).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    };

    return (
        <div style={{ borderTop: `1px solid ${border}`, background: bg }}>
            {shown.map(ev => {
                const evType = ev.eventType || ev.event_type || '';
                const m = AUDIT_META[evType] || { icon: '•', color: textFaint };
                const sevColor = ev.severity === 'critical' ? '#dc2626'
                               : ev.severity === 'warning'  ? '#f59e0b'
                               : m.color;
                return (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 20px', borderBottom: `1px solid ${borderFaint}`, fontSize: 11 }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: `${sevColor}18`, color: sevColor, flexShrink: 0, marginTop: 1 }}>
                            {m.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: text, fontWeight: 500 }}>{ev.title}</div>
                            {ev.detail && <div style={{ color: textFaint, marginTop: 2, fontSize: 10 }}>{ev.detail}</div>}
                        </div>
                        <span style={{ color: textFaint, fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {relativeTime(ev.ts)}
                        </span>
                    </div>
                );
            })}
            {events.length > 5 && (
                <button onClick={() => setShowAll(p => !p)}
                    style={{ width: '100%', padding: '6px', background: 'transparent', border: 'none', fontSize: 10, color: textFaint, cursor: 'pointer' }}>
                    {showAll ? '▲ Show less' : `▼ Show all ${events.length} events`}
                </button>
            )}
        </div>
    );
}

// ─── Log Event Modal ────────────────────────────────────────────────────────

const LOG_EVENT_TYPES = [
    { value: 'note_added',     label: '📝 Note / General' },
    { value: 'ad_disapproved', label: '🚫 Ad Disapproved' },
    { value: 'account_warned', label: '⚡ Account Warned' },
    { value: 'account_banned', label: '🔴 Account Banned' },
    { value: 'policy_changed', label: '⚠ Policy Change' },
    { value: 'domain_changed', label: '🌐 Domain Changed' },
    { value: 'proxy_assigned', label: '🔗 Proxy Assigned' },
];

function LogEventModal({ site, isDark, onClose, onSubmit }) {
    const [eventType, setEventType] = useState('note_added');
    const [title, setTitle] = useState('');
    const [detail, setDetail] = useState('');
    const [severity, setSeverity] = useState('info');
    const [campaignId, setCampaignId] = useState('');
    const [reason, setReason] = useState('');

    const dk = isDark;
    const bg = dk ? '#18181b' : '#ffffff';
    const surface = dk ? '#09090b' : '#f4f4f5';
    const border = dk ? '#3f3f46' : '#e4e4e7';
    const text = dk ? '#fafafa' : '#09090b';
    const textSub = dk ? '#a1a1aa' : '#71717a';
    const accent = '#ea580c';
    const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${border}`, background: surface, color: text, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
    const labelStyle = { display: 'flex', flexDirection: 'column', gap: 4 };
    const labelTextStyle = { fontSize: 11, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em' };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const meta = {};
        if (campaignId) meta.campaignId = campaignId;
        if (reason) meta.reason = reason;
        onSubmit(site.id, eventType, title.trim(), detail.trim(), meta, severity);
        onClose();
    };

    const needsExtra = eventType === 'ad_disapproved' || eventType === 'account_warned' || eventType === 'account_banned';

    return (
        <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <form onSubmit={handleSubmit}
                style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 460, boxShadow: '0 24px 48px rgba(0,0,0,.35)', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: text }}>+ Log Event: {site.brand}</div>
                    <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: textSub, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 2 }}>✕</button>
                </div>

                <label style={labelStyle}>
                    <span style={labelTextStyle}>Event Type</span>
                    <select value={eventType} onChange={e => setEventType(e.target.value)} style={inputStyle}>
                        {LOG_EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </label>

                <label style={labelStyle}>
                    <span style={labelTextStyle}>Title <span style={{ color: accent }}>*</span></span>
                    <input value={title} onChange={e => setTitle(e.target.value)} required style={inputStyle} placeholder="Short description of what happened" />
                </label>

                <label style={labelStyle}>
                    <span style={labelTextStyle}>Detail (optional)</span>
                    <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="More context, URLs, notes…" />
                </label>

                {needsExtra && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <label style={labelStyle}>
                            <span style={labelTextStyle}>Campaign ID</span>
                            <input value={campaignId} onChange={e => setCampaignId(e.target.value)} style={inputStyle} placeholder="e.g. 12345678" />
                        </label>
                        <label style={labelStyle}>
                            <span style={labelTextStyle}>Reason</span>
                            <input value={reason} onChange={e => setReason(e.target.value)} style={inputStyle} placeholder="e.g. Circumventing systems" />
                        </label>
                    </div>
                )}

                <label style={labelStyle}>
                    <span style={labelTextStyle}>Severity</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[['info','🔵 Info'],['warning','🟡 Warning'],['critical','🔴 Critical']].map(([v, l]) => (
                            <button key={v} type="button" onClick={() => setSeverity(v)}
                                style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: `1px solid ${severity === v ? accent : border}`, background: severity === v ? `${accent}18` : 'transparent', color: severity === v ? accent : textSub, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {l}
                            </button>
                        ))}
                    </div>
                </label>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button type="button" onClick={onClose}
                        style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancel
                    </button>
                    <button type="submit"
                        style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Save Event →
                    </button>
                </div>
            </form>
        </div>
    );
}
