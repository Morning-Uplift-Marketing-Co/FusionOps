import { useState, useEffect } from "react";
import { api } from "./services/api";
import * as db from "./services/neon";
import { saveSiteToD1, deleteSiteFromD1 } from "./services/d1";
import { THEME as T, WIZARD_DEFAULTS } from "./constants";
import { uid, now, LS } from "./utils";
import { refreshCustomTemplates } from "./utils/template-router";
import { setSentryContext, addBreadcrumb } from "./services/sentry";
import { sanitizeSettings, validateSettingsAccount, autoRecoverSettings, detectIncompleteSettings } from "./services/account-lock";

// Custom event for template refresh
const TEMPLATE_REFRESH_EVENT = 'lp-template-refresh';

// Component Imports
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Toast } from "./components/ui/toast";
import { Dashboard } from "./components/Dashboard";
import { Sites } from "./components/Sites";
import { Wizard } from "./components/Wizard";
import { VariantStudio } from "./components/VariantStudio";
import { OpsCenter } from "./components/OpsCenter";
import { Settings } from "./components/Settings";
import { DeployHistory } from "./components/DeployHistory";
import { TemplateGeneratorModal } from "./components/TemplateGenerator";
import { ErrorLog, logError } from "./components/ErrorLog";
import { SpendDashboard } from "./components/SpendDashboard";
import { AccountMap } from "./components/AccountMap";
import { TrackingDashboard } from "./components/TrackingDashboard";
import { RealtimeEventsDashboard } from "./components/RealtimeEventsDashboard";
import { VoluumExplorer } from "./components/VoluumExplorer";
import { AccountVerificationBanner } from "./components/ui/AccountVerificationBanner";
import { ApiHealthCheck } from "./components/ApiHealthCheck";
import { TemplateManager } from "./components/TemplateManager";

// Neon connection string — stored in settings or hardcoded for now
const NEON_URL = import.meta.env.VITE_NEON_URL || "";

async function pushAstroTemplateToGitHub({ token, owner, repo, templateId, files }) {
  const base = `https://api.github.com/repos/${owner}/${repo}/contents`;
  const branch = 'main';
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const encode = (str) => {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  };

  const pushFile = async ([filePath, content], retried = false) => {
    const url = `${base}/templates/${templateId}/${filePath}`;
    let sha;
    // 404 expected for new files — fetch SHA only for existing files
    const ex = await fetch(`${url}?ref=${branch}`, { headers }).catch(() => null);
    if (ex?.ok) sha = (await ex.json().catch(() => ({}))).sha;

    const body = {
      message: `feat: import template ${templateId} — ${filePath}`,
      content: encode(content),
      branch,
      ...(sha ? { sha } : {}),
    };
    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      // 409 = stale SHA (concurrent push or race) — retry once with fresh SHA
      if (res.status === 409 && !retried) {
        await new Promise(r => setTimeout(r, 300));
        return pushFile([filePath, content], true);
      }
      const err = await res.text().catch(() => '');
      throw new Error(`Failed to push ${filePath}: ${res.status} ${err.slice(0, 200)}`);
    }
  };

  // Push files sequentially to avoid GitHub 409 race conditions
  const entries = Object.entries(files);
  for (const entry of entries) {
    await pushFile(entry);
  }
}

// ── ENV FALLBACK DEFAULTS ──────────────────────────────────────────
// When localStorage is cleared, these env vars act as seed defaults
// so the app can self-heal without manual re-entry.
// IMPORTANT: Never seed secret/API token values from VITE_* here.
// VITE variables are bundled client-side and must be treated as public.
const ENV_DEFAULTS = {
  cfAccountId:       import.meta.env.VITE_CF_ACCOUNT_ID       || "",
  neonUrl:           NEON_URL,
};

export default function App() {
  const asArray = (value) => Array.isArray(value) ? value : [];

  const [page, setPage] = useState("dashboard");
  const [sites, setSites] = useState([]);
  const [ops, setOps] = useState({ domains: [], accounts: [], cfAccounts: [], registrarAccounts: [], profiles: [], payments: [], logs: [], risks: [] });
  const [settings, setSettings] = useState(() => {
    // CRITICAL: Enforce locked account on initialization to prevent fallback
    const rawLocal = LS.get("settings") || {};
    // Seed from ENV_DEFAULTS when localStorage is empty (e.g. after clear cookies)
    const envSeed = Object.fromEntries(
      Object.entries(ENV_DEFAULTS).filter(([, v]) => v)
    );
    const localSettings = { ...envSeed, ...rawLocal };
    const sanitized = sanitizeSettings(localSettings);
    LS.set("settings", sanitized);
    return sanitized;
  });
  const [accountMismatch, setAccountMismatch] = useState(null);
  const [showAccountBanner, setShowAccountBanner] = useState(false);
  const [stats, setStats] = useState({ builds: 0, spend: 0 });
  const [toast, setToast] = useState(null);
  const [wizData, setWizData] = useState(null);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [deploys, setDeploys] = useState([]);
  const [registry, setRegistry] = useState([]);
  
const [templateGenOpen, setTemplateGenOpen] = useState(false);
const [savedTemplates, setSavedTemplates] = useState([]);

// Fetch saved templates
useEffect(() => {
  api.get("/templates")
    .then(res => {
      if (Array.isArray(res)) setSavedTemplates(res);
      else if (res?.templates) setSavedTemplates(res.templates);
    })
    .catch(() => {});
}, []);

  const [loading, setLoading] = useState(true);
  const [apiOk, setApiOk] = useState(false);
  const [neonOk, setNeonOk] = useState(false);

  // Global error capture — feeds into Error Log tab
  useEffect(() => {
    const onError = (event) => {
      logError(event.error || new Error(event.message || "Unknown error"), {
        severity: "error",
        source: event.filename,
        line: event.lineno,
        col: event.colno,
      });
    };
    const onUnhandled = (event) => {
      const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      logError(err, { severity: "error", type: "unhandledrejection" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  useEffect(() => {
    // Safety: force-show app after 5s even if boot hasn't finished
    const bootTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.warn('[boot] Timeout reached — showing app with partial data');
        return false;
      });
    }, 5000);

    bootApp().finally(() => clearTimeout(bootTimeout));

    // Set up visibility handler for Neon reconnection
    const cleanupVisibility = db.setupVisibilityHandler();

    return () => {
      cleanupVisibility?.();
    };
  }, []);

  // Proactively connect to Neon if URL is provided/discovered later
  useEffect(() => {
    if (!neonOk && settings.neonUrl && settings.neonUrl.includes("@")) {
      recoverNeonConnection();
    }
  }, [settings.neonUrl, neonOk]);

  // CRITICAL: Account Validation Effect - Runs on every settings change
  useEffect(() => {
    if (settings?.cfAccountId) {
      const validation = validateSettingsAccount(settings);
      if (!validation.valid) {
        console.error('[CRITICAL] Account validation failed:', validation);
        setAccountMismatch(validation);
        setShowAccountBanner(true);

        // If critical legacy account detected, auto-fix immediately
        if (validation.errors.some(e => e.critical)) {
          console.warn('[CRITICAL] Auto-fixing critical account mismatch...');
          const sanitized = sanitizeSettings(settings);
          if (JSON.stringify(sanitized) !== JSON.stringify(settings)) {
            setSettings(sanitized);
            LS.set("settings", sanitized);
            setShowAccountBanner(false);
          }
        }
      } else {
        setAccountMismatch(null);
        setShowAccountBanner(false);
      }
    }
  }, [settings]);

  // CRITICAL: Sync sites to ops.domains whenever sites change
  // This ensures DeploySection always has access to current sites
  useEffect(() => {
    if (sites && sites.length > 0) {
      setOps(prev => {
        // Only update if domains actually changed
        if (JSON.stringify(prev.domains) !== JSON.stringify(sites)) {
          return { ...prev, domains: sites };
        }
        return prev;
      });
    }
  }, [sites]);

  // CRITICAL: Sync Cloudflare profiles from settings to ops.cfAccounts
  // This ensures DeploySection, DnsSection, OpsCenter can see all CF accounts
  useEffect(() => {
    const profiles = asArray(settings?.cfProfiles);
    // Build accounts from profiles
    const profileAccounts = profiles.map(p => ({
      id: p.id,
      accountId: p.accountId,
      account_id: p.accountId,
      apiKey: p.apiToken,
      api_key: p.apiToken,
      label: p.name,
      name: p.name,
    }));

    // Legacy fallback: if no profiles but single account exists
    if (profileAccounts.length === 0 && settings?.cfAccountId && settings?.cfApiToken) {
      profileAccounts.push({
        id: settings.cfAccountId,
        accountId: settings.cfAccountId,
        account_id: settings.cfAccountId,
        apiKey: settings.cfApiToken,
        api_key: settings.cfApiToken,
        label: "Default",
        name: settings.cfAccountId?.slice(0, 8) + '...',
      });
    }

    setOps(prev => {
      // Merge: keep manually-added OpsCenter accounts, add/update profile-sourced ones
      const manualAccounts = asArray(prev.cfAccounts).filter(a =>
        !profileAccounts.some(p => p.accountId === a.accountId || p.accountId === a.account_id)
      );
      const merged = [...profileAccounts, ...manualAccounts];
      // Only update if changed
      const prevIds = asArray(prev.cfAccounts).map(a => a.id).sort().join(',');
      const newIds = merged.map(a => a.id).sort().join(',');
      if (prevIds === newIds) return prev;
      console.log('[App] Syncing cfProfiles → ops.cfAccounts:', merged.length, 'accounts');
      return { ...prev, cfAccounts: merged };
    });
  }, [settings?.cfProfiles, settings?.cfAccountId, settings?.cfApiToken]);

  async function bootApp() {
    const rawLocal = LS.get("settings") || {};
    // Seed with ENV_DEFAULTS so cleared localStorage auto-heals from .env
    const envSeed = Object.fromEntries(
      Object.entries(ENV_DEFAULTS).filter(([, v]) => v) // only non-empty
    );
    const localSettings = { ...envSeed, ...rawLocal };

    // 1. Try Neon first (primary data store)
    const neonConnStr = NEON_URL || localSettings.neonUrl || "";
    let neonReady = false;

    // Only attempt Neon if the URL looks like a real connection string
    if (neonConnStr && neonConnStr.includes("@")) {
      try {
        const initialized = db.initNeon(neonConnStr);
        if (initialized) {
          const pong = await db.ping();
          if (pong) {
            neonReady = true;
            setNeonOk(true);

            // *** CRITICAL: Push neonUrl to D1 so other devices can recover it via /api/init ***
            // This runs in the background and doesn't block the rest of boot.
            api.post("/settings", { neonUrl: neonConnStr }).catch(() => { });

            // Load from Neon
            const [neonSettings, neonSites, neonDeploys, neonRegistrarAccounts, neonCfAccounts] = await Promise.all([
              db.loadSettings(),
              db.loadSites(),
              db.loadDeploys(),
              db.loadRegistrarAccounts(),
              db.loadCfAccounts(),
            ]);

            if (neonSettings && Object.keys(neonSettings).length > 0) {
              // CRITICAL: Auto-recover ALL settings from Neon
              console.log('[boot] 🔄 Neon connected! Auto-recovering settings...');

              // Use auto-recovery to merge and sanitize
              const recovered = autoRecoverSettings(neonSettings, localSettings);

              // Apply recovered settings
              setSettings(prev => {
                const merged = { ...prev, ...recovered };
                LS.set("settings", merged);
                console.log('[boot] ✅ Settings recovered from Neon:', Object.keys(merged).filter(k =>
                  k !== 'cfApiToken' // Don't log token
                ));
                return merged;
              });
            }

            // Sites from Neon
            if (neonSites && neonSites.length > 0) {
              const migratedSites = neonSites.map(s => ({
                ...s,
                templateId: s.templateId || "classic"
              }));
              setSites(migratedSites);

              // CRITICAL: Sync sites to ops.domains for DeploySection
              setOps(prev => ({
                ...prev,
                domains: migratedSites
              }));
            } else {
              // Only sync if Neon is totally empty
              const localSites = LS.get("sites") || [];
              if (localSites.length > 0) {
                setSites(localSites);

                // CRITICAL: Sync sites to ops.domains for DeploySection
                setOps(prev => ({
                  ...prev,
                  domains: localSites
                }));

                db.syncFromLocal(localSettings, localSites, []);
              }
            }
            // Deploys from Neon
            if (neonDeploys && neonDeploys.length > 0) {
              setDeploys(neonDeploys);
            }

            // Registrar accounts from Neon (used when API/D1 is unavailable)
            if (Array.isArray(neonRegistrarAccounts) && neonRegistrarAccounts.length > 0) {
              setOps(prev => ({
                ...prev,
                registrarAccounts: neonRegistrarAccounts,
              }));
            }
            if (Array.isArray(neonCfAccounts) && neonCfAccounts.length > 0) {
              setOps(prev => ({
                ...prev,
                cfAccounts: neonCfAccounts,
              }));
            }

            // Stats
            const siteList = neonSites?.length ? neonSites : [];
            setStats({
              builds: siteList.length,
              spend: +(siteList.reduce((a, s) => a + (s.cost || 0), 0)).toFixed(3),
            });
          }
        }
      } catch (e) {
        console.warn("[boot] Neon init failed:", e.message);
      }
    }

    // 2. Load legacy API data (Ops data always lives in API/D1)
    try {
      const data = await api.get("/init");
      if (!data.error) {
        // Always hydrate Ops center from API when reachable
        // Some deployments may omit or partially populate `ops`, so merge defensively.
        // CRITICAL: Don't overwrite domains that were already synced from sites
        setOps((prev) => {
          const nextOps = (data && typeof data.ops === "object" && data.ops) ? data.ops : {};
          return {
            ...prev,
            ...nextOps,
            // CRITICAL: Prefer already-synced domains over empty API data
            domains: asArray(nextOps.domains).length > 0 ? asArray(nextOps.domains) : asArray(prev.domains),
            accounts: asArray(nextOps.accounts).length > 0 ? asArray(nextOps.accounts) : asArray(prev.accounts),
            profiles: asArray(nextOps.profiles).length > 0 ? asArray(nextOps.profiles) : asArray(prev.profiles),
            payments: asArray(nextOps.payments).length > 0 ? asArray(nextOps.payments) : asArray(prev.payments),
            logs: asArray(nextOps.logs).length > 0 ? asArray(nextOps.logs) : asArray(prev.logs),
            risks: asArray(nextOps.risks).length > 0 ? asArray(nextOps.risks) : asArray(prev.risks),
            deployments: asArray(nextOps.deployments).length > 0 ? asArray(nextOps.deployments) : asArray(prev.deployments),
            cfAccounts: asArray(data.cfAccounts).length > 0 ? asArray(data.cfAccounts) : asArray(prev.cfAccounts),
            registrarAccounts: asArray(data.registrarAccounts).length > 0 ? asArray(data.registrarAccounts) : asArray(prev.registrarAccounts),
          };
        });

        // Keep Neon copy in sync for API account settings (fallback when API is unavailable).
        if (neonReady) {
          if (Array.isArray(data.registrarAccounts) && data.registrarAccounts.length > 0) {
            Promise.all(data.registrarAccounts.map((acc) => db.saveRegistrarAccount(acc))).catch(() => { });
          }
          if (Array.isArray(data.cfAccounts) && data.cfAccounts.length > 0) {
            Promise.all(data.cfAccounts.map((acc) => db.saveCfAccount(acc))).catch(() => { });
          }
        }

        // When Neon is not ready, check if API has a Neon URL we can use
        if (!neonReady) {
          const apiNeonUrl = data.settings?.neonUrl;
          if (apiNeonUrl && apiNeonUrl.includes("@")) {
            console.log("[boot] Re-trying Neon with URL from API...");
            const initialized = db.initNeon(apiNeonUrl);
            if (initialized && await db.ping()) {
              console.log("[boot] Neon connected via API settings!");
              setNeonOk(true);
              neonReady = true;

              // Load full data from Neon now that it's connected
              const [ns, nsi, nde, nra, nca] = await Promise.all([
                db.loadSettings(),
                db.loadSites(),
                db.loadDeploys(),
                db.loadRegistrarAccounts(),
                db.loadCfAccounts(),
              ]);
              if (ns) {
                const m = { ...localSettings, ...data.settings, ...ns };
                setSettings(m);
                LS.set("settings", m);
              }
              if (nsi?.length) setSites(nsi);
              if (nde?.length) setDeploys(nde);
              if (Array.isArray(nra) && nra.length > 0) {
                setOps(prev => ({ ...prev, registrarAccounts: nra }));
              }
              if (Array.isArray(nca) && nca.length > 0) {
                setOps(prev => ({ ...prev, cfAccounts: nca }));
              }
            }
          }
        }

        // Final fallback/merge if Neon still not ready
        if (!neonReady) {
          if (Array.isArray(data.sites)) setSites(data.sites);
          if (data.settings) {
            const merged = { ...localSettings, ...data.settings };
            setSettings(merged);
            LS.set("settings", merged);
          }
          if (data.stats) setStats(data.stats);
          if (data.deploys) setDeploys(data.deploys);
          if (data.variants) setRegistry(data.variants);
        }

        setApiOk(true);
      }
    } catch (e) {
      console.warn("[App] API unreachable, using local state:", e?.message || e);
    }

    // Report boot status to Sentry
    setSentryContext({ neonOk: neonReady, apiOk, settingsKeys: Object.keys(LS.get("settings") || {}) });
    addBreadcrumb("boot", `Boot complete — Neon:${neonReady} API:${apiOk}`);

    setLoading(false);
  }

  const recoverNeonConnection = async () => {
    const rawLocal = LS.get("settings") || {};
    const envSeed = Object.fromEntries(
      Object.entries(ENV_DEFAULTS).filter(([, v]) => v)
    );
    const localSettings = { ...envSeed, ...rawLocal };
    const neonConnStr = NEON_URL || localSettings.neonUrl || "";

    if (neonConnStr && neonConnStr.includes("@")) {
      const reconnected = db.forceReconnect();
      if (reconnected) {
        const pong = await db.ping();
        setNeonOk(pong);
        if (pong) {
          const [neonSettings, neonSites, neonDeploys, neonRegistrarAccounts, neonCfAccounts] = await Promise.all([
            db.loadSettings(),
            db.loadSites(),
            db.loadDeploys(),
            db.loadRegistrarAccounts(),
            db.loadCfAccounts(),
          ]);

          if (neonSettings) {
            // Auto-recover ALL settings from Neon
            console.log('[Neon Recovery] 🔄 Auto-recovering settings...');
            const recovered = autoRecoverSettings(neonSettings, localSettings);

            // Check for incomplete settings
            const completenessCheck = detectIncompleteSettings(recovered);
            if (completenessCheck.isIncomplete) {
              console.warn('[Neon Recovery] ⚠️ Settings may be incomplete:', completenessCheck.missingCritical);
            }

            setSettings(recovered);
            LS.set("settings", recovered);
            console.log('[Neon Recovery] ✅ Settings recovered');
          }

          if (neonSites?.length > 0) {
            setSites(neonSites);
          }

          if (neonDeploys?.length > 0) {
            setDeploys(neonDeploys);
          }

          if (Array.isArray(neonRegistrarAccounts) && neonRegistrarAccounts.length > 0) {
            setOps(prev => ({ ...prev, registrarAccounts: neonRegistrarAccounts }));
          }
          if (Array.isArray(neonCfAccounts) && neonCfAccounts.length > 0) {
            setOps(prev => ({ ...prev, cfAccounts: neonCfAccounts }));
          }

          notify("Neon connection restored!");
          return true;
        }
      }
    }
    return false;
  };

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const startDuplicate = (sourceSite) => {
    if (!sourceSite || typeof sourceSite !== 'object' || !sourceSite.id) return;
    const { _editMode, id, domain, brand, email, phone, address,
      voluumCampaignId, voluumCampaignName, voluumClickUrl,
      voluumTrackingDomain, voluumLanderTrackingUrl, voluumLanderId, voluumOfferId, voluumLanderScript,
      voluumCfCname, voluumAcmName, voluumAcmValue,
      status, createdAt, updatedAt, cost,
      ...portable } = sourceSite;
    setWizData({
      ...WIZARD_DEFAULTS,
      ...portable,
      domain: '',
      brand: '',
      email: '',
      phone: '',
      address: '',
      voluumCampaignId: '',
      voluumCampaignName: '',
      voluumClickUrl: '',
      voluumTrackingDomain: '',
      voluumLanderTrackingUrl: '',
      voluumLanderId: '',
      voluumOfferId: '',
      voluumLanderScript: '',
      voluumCfCname: '',
      voluumAcmName: '',
      voluumAcmValue: '',
      redirectUrl: '',
      _editMode: false,
    });
    setPage('create');
  };

  const startCreate = async (existingSite = null) => {
    // Guard: reject MouseEvent or non-plain-object arguments (e.g. from onClick handlers)
    const isValidSite = existingSite && typeof existingSite === "object" && !(existingSite instanceof Event) && !existingSite.nativeEvent && existingSite.id;
    if (isValidSite) {
      // Edit mode: restore Voluum/tracking fields from deploy config on GitHub
      // (these were lost before SITE_FIELDS fix — fetch to recover them)
      let recovered = {};
      try {
        const token = (settings.githubToken || '').trim();
        const owner = (settings.githubRepoOwner || '').trim();
        const repo  = (settings.githubRepoName  || '').trim();
        const domain = (existingSite.domain || existingSite.brand || '').replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
        if (token && owner && repo && domain) {
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/deploy-configs/${domain}.json?ref=main`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
          });
          if (res.ok) {
            const data = await res.json();
            const decoded = atob(data.content.replace(/\n/g, ''));
            const cfg = JSON.parse(decoded);
            // Map deploy config keys back to Wizard field names
            recovered = {
              trackingMode:        existingSite.trackingMode        || (cfg.voluumId ? 'voluum' : 'minimal'),
              voluumCampaignId:    existingSite.voluumCampaignId    || cfg.voluumId        || '',
              voluumTrackingDomain:existingSite.voluumTrackingDomain|| cfg.voluumDomain    || '',
              voluumClickUrl:      existingSite.voluumClickUrl      || cfg.voluumClickUrl  || '',
              voluumLanderTrackingUrl: existingSite.voluumLanderTrackingUrl || '',
              voluumLanderId:      existingSite.voluumLanderId      || '',
              voluumOfferId:       existingSite.voluumOfferId       || '',
              gtagId:              existingSite.gtagId              || cfg.conversionId    || '',
              conversionId:        existingSite.conversionId        || cfg.conversionId    || '',
              aid:                 existingSite.aid                 || cfg.aid             || '',
              voluumCfCname:       existingSite.voluumCfCname       || cfg.voluumCfCname   || '',
              voluumAcmName:       existingSite.voluumAcmName       || cfg.voluumAcmName   || '',
              voluumAcmValue:      existingSite.voluumAcmValue      || cfg.voluumAcmValue  || '',
              voluumLanderScript:  existingSite.voluumLanderScript  || cfg.voluumLanderScript || '',
            };
          }
        }
      } catch (_) { /* silently ignore — use existing data */ }

      setWizData({ ...WIZARD_DEFAULTS, ...existingSite, ...recovered, _editMode: true });
    } else {
      const defaultTemplateId = settings?.defaultTemplateId || WIZARD_DEFAULTS.templateId;
      setWizData({ ...WIZARD_DEFAULTS, templateId: defaultTemplateId });
    }
    setPage("create");
  };

  // Keep only plain serializable site fields — drops React event/DOM properties
  const SITE_FIELDS = new Set(["id", "brand", "domain", "tagline", "email", "templateId", "loanType", "amountMin", "amountMax", "aprMin", "aprMax", "colorId", "fontId", "layout", "radius", "trustBadgeStyle", "trustBadgeIconTone", "h1", "h1span", "badge", "cta", "sub", "metaTitle", "metaDesc", "conversionId", "gtagId", "gtagFormStartLabel", "gtagFormSubmitLabel", "formStartLabel", "formSubmitLabel", "aid", "network", "redirectUrl", "voluumId", "voluumDomain", "voluumCampaignId", "voluumCampaignName", "voluumTrackingDomain", "voluumClickUrl", "voluumLanderTrackingUrl", "voluumLanderId", "voluumOfferId", "voluumLanderScript", "voluumCfCname", "voluumAcmName", "voluumAcmValue", "trackingMode", "phone", "address", "lang", "faviconDataUrl", "ogImageDataUrl", "formEmbed", "cfProfileId", "cfAccountId", "internetbsAccountId", "domainProvider", "domainProviderAccountId", "status", "createdAt", "updatedAt", "cost", "reviews", "trustBadges", "deployTarget", "deployOnBuild"]);
  const sanitizeSite = (obj) => Object.fromEntries(
    Object.entries(obj).filter(([k, v]) => SITE_FIELDS.has(k) && typeof v !== "function")
  );

  const addSite = async (site) => {
    if (site._editMode) {
      // Update existing site (redeploy)
      const { _editMode, ...rawData } = site;
      const siteData = sanitizeSite(rawData);
      setSites(p => p.map(s => s.id === siteData.id ? { ...s, ...siteData, updatedAt: now() } : s));

      if (neonOk) db.saveSite(siteData).catch(() => {});
      else if (apiOk) api.put(`/sites/${siteData.id}`, siteData).catch(() => {});
      saveSiteToD1(siteData).catch(() => {}); // D1 backup — fire and forget

      notify(`${siteData.brand} updated!`);
    } else {
      // New site — await Neon (primary), D1 is fire-and-forget
      const cleanSite = sanitizeSite(site);
      setSites(p => [cleanSite, ...p]);
      setStats(p => ({ builds: p.builds + 1, spend: +(p.spend + (cleanSite.cost || 0)).toFixed(3) }));

      if (neonOk) await db.saveSite(cleanSite).catch(() => {});
      else if (apiOk) await api.post("/sites", cleanSite).catch(() => {});
      saveSiteToD1(cleanSite).catch(() => {}); // D1 backup — fire and forget

      notify(`${cleanSite.brand} created!`);
    }
    setPage("sites");
  };

  const updateSite = async (site) => {
    const updatedSite = sanitizeSite({ ...site, updatedAt: now() });
    setSites(p => p.map(s => s.id === site.id ? updatedSite : s));

    if (neonOk) await db.saveSite(updatedSite).catch(() => {});
    else if (apiOk) await api.put(`/sites/${site.id}`, updatedSite).catch(() => {});
    saveSiteToD1(updatedSite).catch(() => {}); // D1 backup — fire and forget
  };

  const delSite = (id) => {
    // Find the site before deleting (to match domain in ops)
    const site = sites.find(s => s.id === id);

    setSites(p => p.filter(s => s.id !== id));

    if (neonOk) db.deleteSite(id).catch(() => {});
    else if (apiOk) api.del(`/sites/${id}`).catch(() => {});
    deleteSiteFromD1(id).catch(() => {}); // D1 backup — fire and forget

    // Also remove matching domain from OpsCenter
    if (site) {
      const matchingDomain = (ops.domains || []).find(d =>
        d.id === id || d.domain === site.domain || d.siteId === id
      );
      if (matchingDomain) {
        opsDel("domains", matchingDomain.id);
      }
    }

    notify("Deleted", "danger");
  };

  const addDeploy = (d) => {
    setDeploys(p => [d, ...p].slice(0, 100));

    if (neonOk) db.saveDeploy(d).catch(() => { });
    else if (apiOk) api.post("/deploys", d).catch(() => { });
  };

  const toOpsStateKey = (coll) => {
    if (coll === "cf-accounts") return "cfAccounts";
    if (coll === "registrar-accounts") return "registrarAccounts";
    return coll;
  };

  const toOpsApiPayload = (coll, item) => {
    if (!item || typeof item !== "object") return item;

    if (coll === "cf-accounts") {
      return {
        ...item,
        apiKey: item.apiKey || item.api_key || "",
        apiToken: item.apiToken || item.api_token || "",
        accountId: item.accountId || item.account_id || "",
      };
    }

    if (coll === "registrar-accounts") {
      return {
        ...item,
        apiKey: item.apiKey || item.api_key || "",
        secretKey: item.secretKey || item.secret_key || "",
      };
    }

    return item;
  };

  const toOpsEndpoint = (coll, id = null) => {
    if (coll === "cf-accounts") {
      return id ? `/cf-accounts/${id}` : "/cf-accounts";
    }
    if (coll === "registrar-accounts") {
      return id ? `/registrar-accounts/${id}` : "/registrar-accounts";
    }
    return id ? `/ops/${coll}/${id}` : `/ops/${coll}`;
  };

  const opsAdd = (coll, item, opts = {}) => {
    const stateKey = toOpsStateKey(coll);
    const apiPayload = toOpsApiPayload(coll, item);
    setOps(p => ({
      ...p,
      [stateKey]: [item, ...(p[stateKey] || [])],
      logs: [{ id: uid(), msg: `Added ${coll.slice(0, -1)}: ${item.label || item.domain || item.name || item.id}`, ts: now() }, ...p.logs].slice(0, 200),
    }));
    if (opts.persist !== false) {
      const endpoint = toOpsEndpoint(coll);
      if (coll === "cf-accounts" && neonOk) {
        db.saveCfAccount(item).catch(() => { });
      }
      if (coll === "registrar-accounts" && neonOk) {
        db.saveRegistrarAccount(item).catch(() => { });
      }
      return api.post(endpoint, apiPayload).then((res) => {
        if (res?.error) {
          throw new Error(res.detail || res.error || "Failed to save");
        }
        return res;
      });
    }
    return Promise.resolve({ success: true, skipped: true });
  };

  const opsDel = (coll, id) => {
    const stateKey = toOpsStateKey(coll);
    const item = (ops[stateKey] || []).find(i => i.id === id);
    setOps(p => ({
      ...p, [stateKey]: (p[stateKey] || []).filter(i => i.id !== id),
      logs: [{ id: uid(), msg: `Deleted: ${item?.label || item?.domain || id}`, ts: now() }, ...p.logs].slice(0, 200),
    }));
    const endpoint = toOpsEndpoint(coll, id);
    if (coll === "cf-accounts" && neonOk) {
      db.deleteCfAccount(id).catch(() => { });
    }
    if (coll === "registrar-accounts" && neonOk) {
      db.deleteRegistrarAccount(id).catch(() => { });
    }
    api.del(endpoint).catch(() => { });
  };

  const opsUpd = (coll, id, u, opts = {}) => {
    const stateKey = toOpsStateKey(coll);
    const apiPayload = toOpsApiPayload(coll, u);
    setOps(p => ({
      ...p,
      [stateKey]: (p[stateKey] || []).map(i => i.id === id ? { ...i, ...u } : i),
      logs: [{ id: uid(), msg: `Updated ${coll.slice(0, -1)}: ${id}`, ts: now() }, ...p.logs].slice(0, 200),
    }));
    // Persist to API
    if (opts.persist !== false) {
      const endpoint = toOpsEndpoint(coll, id);
      if (coll === "cf-accounts" && neonOk) {
        const existing = (ops[stateKey] || []).find((i) => i.id === id) || {};
        db.saveCfAccount({ ...existing, ...u, id }).catch(() => { });
      }
      if (coll === "registrar-accounts" && neonOk) {
        const existing = (ops[stateKey] || []).find((i) => i.id === id) || {};
        db.saveRegistrarAccount({ ...existing, ...u, id }).catch(() => { });
      }
      return api.put(endpoint, apiPayload);
    }
    return Promise.resolve({ success: true, skipped: true });
  };

  const handleSaveSettings = async (s) => {
    addBreadcrumb("settings", "Save settings", { keys: Object.keys(s) });
    // Use functional update to avoid stale closure
    setSettings(prev => {
      const merged = { ...(prev || {}), ...s };
      return merged;
    });
    // Always persist to localStorage immediately
    // Read fresh from state in case other saves happened
    const fresh = { ...(LS.get("settings") || {}), ...s };
    LS.set("settings", fresh);

    // If neonUrl changed, re-init Neon
    if (s.neonUrl) {
      const ok = db.initNeon(s.neonUrl);
      if (ok) {
        const pong = await db.ping();
        setNeonOk(pong);
        if (pong) {
          notify("Neon connected!");
          db.syncFromLocal(fresh, sites, deploys);
        }
      } else {
        // Try connection recovery if initial init fails
        await recoverNeonConnection();
      }
    }

    // Save to Neon AND D1 (dual-write) — Worker reads from D1, so always sync both
    const neonSave = neonOk ? db.saveSettings(s) : Promise.resolve(false);
    const apiSave = apiOk
      ? api.post("/settings", s).catch((e) => { console.warn("[App] D1 settings sync failed:", e?.message || e); return { error: true }; })
      : Promise.resolve(null);

    const [neonResult, apiResult] = await Promise.all([neonSave, apiSave]);

    if (neonResult || (apiResult && !apiResult.error)) {
      notify("Saved!");
    } else if (!neonOk && !apiOk) {
      // No backend — localStorage only
      notify("Saved locally ✓", "success");
    } else {
      notify("Saved locally — sync warning", "warning");
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'Inter','DM Sans',system-ui,sans-serif", background: T.bg || '#0a0a0a' }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12, animation: "pulse 1.5s infinite" }}>⚡</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>FusionOps V2</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
          Connecting... {neonOk ? '✅ Neon' : '⏳ Neon'} | {apiOk ? '✅ API' : '⏳ API'}
        </div>
        <div style={{ fontSize: 10, color: T.dim, marginTop: 8 }}>Auto-skip in 5s</div>

        {/* Safety bypass if boot hangs */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setLoading(false)}
            style={{ background: "none", border: `1px solid ${T.border}`, color: T.muted, padding: "6px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}
          >
            Skip Loading
          </button>
        </div>
      </div>
    </div>
  );

  const ml = sideCollapsed ? 64 : 220;

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter','DM Sans',system-ui,sans-serif" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* CRITICAL: Account Verification Banner - Shows on account mismatch */}
      <AccountVerificationBanner
        settings={settings}
        onSettingsFixed={() => {
          setPage("settings");
          setShowAccountBanner(false);
        }}
        onDismiss={() => setShowAccountBanner(false)}
      />

      <Sidebar page={page} setPage={setPage} siteCount={sites.length} startCreate={startCreate} startTemplateGen={() => setTemplateGenOpen(true)}
        collapsed={sideCollapsed} toggle={() => setSideCollapsed(p => !p)} />

      <main style={{ flex: 1, marginLeft: ml, minHeight: "100vh", transition: "margin .2s" }}>
        <TopBar stats={stats} settings={settings} deploys={deploys} apiOk={apiOk} neonOk={neonOk} onReconnectNeon={recoverNeonConnection} />
        <div style={{ padding: "24px 28px" }}>
          {page === "dashboard" && <Dashboard sites={sites} stats={stats} ops={ops} setPage={setPage} startCreate={startCreate} settings={settings} apiOk={apiOk} neonOk={neonOk} />}
          {page === "spend" && <SpendDashboard apiOk={apiOk} neonOk={neonOk} settings={settings} />}
          {page === "voluum" && <VoluumExplorer settings={settings} />}
          {page === "account-map" && <AccountMap apiOk={apiOk} neonOk={neonOk} ops={ops} settings={settings} />}
          {page === "sites" && <Sites sites={sites} del={delSite} notify={notify} startCreate={startCreate} startDuplicate={startDuplicate} settings={settings} addDeploy={addDeploy} ops={ops} updateSite={updateSite} />}
          {page === "create" && wizData && <Wizard config={wizData} setConfig={setWizData} addSite={addSite} addDeploy={addDeploy} setPage={setPage} settings={settings} notify={notify} cfAccounts={ops.cfAccounts} registrarAccounts={ops.registrarAccounts} />}
          {page === "variant" && <VariantStudio notify={notify} sites={sites} addSite={addSite} registry={registry} setRegistry={setRegistry} apiOk={apiOk} />}
          {page === "ops" && <OpsCenter data={ops} add={opsAdd} del={opsDel} upd={opsUpd} settings={settings} />}
          {page === "deploys" && <DeployHistory deploys={deploys} />}
          {page === "tracking" && <TrackingDashboard settings={settings} sites={sites} />}
          {page === "realtime-events" && <RealtimeEventsDashboard sites={sites} />}
          {page === "template-manager" && (
            <TemplateManager
              sites={sites}
              notify={notify}
              onDefaultTemplateChange={(templateId) => {
                setSettings((prev) => {
                  const next = { ...(prev || {}), defaultTemplateId: templateId };
                  LS.set("settings", next);
                  return next;
                });
              }}
            />
          )}
          {page === "error-log" && <ErrorLog />}
          {page === "api-health" && <ApiHealthCheck />}
          {page === "settings" && <Settings settings={settings} setSettings={handleSaveSettings} stats={stats} apiOk={apiOk} neonOk={neonOk} />}
        </div>
      </main>

      {/* Template Generator Modal */}
      <TemplateGeneratorModal
        open={templateGenOpen}
        onClose={() => setTemplateGenOpen(false)}
        onSave={async (templateData, setStatus) => {
          const st = (msg) => setStatus && setStatus({ step: 'saving', message: msg });

          // 1. Save to DB
          st('Saving template to database...');
          const _rawId = (templateData.newFolderId || templateData.templateName || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
          const safeTemplateId = _rawId.length >= 2 ? _rawId : `tpl-${Date.now().toString(36)}`;
          const templatePayload = {
            name: templateData.templateName,
            description: templateData.templateDescription,
            category: templateData.category || 'general',
            badge: templateData.badge || 'New',
            format: templateData.templateFormat || null,
            sourceCode: templateData.generatedCode,
            files: templateData.generatedFiles || {},
          };
          let response = await api.post('/templates', { templateId: safeTemplateId, ...templatePayload });
          if (response.error === 'Template ID already exists') {
            st('Template exists — updating existing record...');
            const allTpls = await api.get('/templates').catch(() => null);
            const tplList = Array.isArray(allTpls) ? allTpls : (allTpls?.templates || []);
            const existingTpl = tplList.find(t => (t.template_id || t.templateId) === safeTemplateId);
            if (existingTpl) {
              response = await api.put(`/templates/${existingTpl.id}`, { ...templatePayload, createVersion: true, note: 'Updated via import' });
            } else {
              const fallbackId = `${safeTemplateId}-${Date.now().toString(36)}`;
              response = await api.post('/templates', { templateId: fallbackId, ...templatePayload });
            }
          }

          if (response.error) {
            const detail = response.detail ? (typeof response.detail === 'string' ? response.detail : JSON.stringify(response.detail)) : '';
            throw new Error(`${response.error}${detail ? ' — ' + detail : ''}`);
          }

          notify(`Template "${templateData.templateName}" saved!`, 'success');

          // 2. Push to GitHub if Astro project
          const files = templateData.generatedFiles;
          const isAstro = templateData.templateFormat === 'astro' || (files && Object.keys(files).some(f => f.endsWith('.astro')));
          const ghToken = settings?.githubToken;
          const ghOwner = settings?.githubRepoOwner;
          const ghRepo = settings?.githubRepoName;
          const templateId = templateData.newFolderId;

          if (isAstro && files && Object.keys(files).length > 0 && ghToken && ghOwner && ghRepo && templateId) {
            st(`Pushing ${Object.keys(files).length} files to GitHub (templates/${templateId}/)...`);
            await pushAstroTemplateToGitHub({ token: ghToken, owner: ghOwner, repo: ghRepo, templateId, files });
          }

          // 3. Refresh cache
          st('Refreshing template list...');
          setTimeout(async () => {
            refreshCustomTemplates();
            const res = await api.get("/templates").catch(() => null);
            if (Array.isArray(res)) setSavedTemplates(res);
            else if (res?.templates) setSavedTemplates(res.templates);
            window.dispatchEvent(new CustomEvent('lp-template-refresh', { detail: templateId }));
          }, 400);
        }}
        templates={savedTemplates}
      />

      {/* CRITICAL: Account Validation Effect - Runs on every settings change */}
      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        input:focus,select:focus,textarea:focus{outline:none;border-color:${T.borderFocus}!important;box-shadow:0 0 0 3px ${T.primaryGlow}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        
        /* Performance-optimized form controls */
        .form-input:focus {
          border-color: ${T.primary} !important;
          box-shadow: 0 0 0 3px ${T.primary}22 !important;
        }
        
        .form-select:focus {
          border-color: ${T.primary} !important;
        }
        
        .btn:not(.btn-disabled):hover {
          transform: translateY(-1px);
        }
        
        .btn:not(.btn-disabled) {
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
