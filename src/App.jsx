import React, { useState, useEffect } from "react";
import { api } from "./services/api";
import * as db from "./services/neon";
import { THEME as T, WIZARD_DEFAULTS } from "./constants";
import { uid, now, LS } from "./utils";
import { refreshCustomTemplates } from "./utils/template-router";

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
import { TemplateEditor } from "./components/TemplateEditor";
import { TemplateGeneratorModal } from "./components/TemplateGenerator";
import { ErrorLog, logError } from "./components/ErrorLog";

// Neon connection string — stored in settings or hardcoded for now
const NEON_URL = import.meta.env.PUBLIC_NEON_URL || "";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [sites, setSites] = useState([]);
  const [ops, setOps] = useState({ domains: [], accounts: [], cfAccounts: [], registrarAccounts: [], profiles: [], payments: [], logs: [], risks: [] });
  const [settings, setSettings] = useState(() => LS.get("settings") || {});
  const [stats, setStats] = useState({ builds: 0, spend: 0 });
  const [toast, setToast] = useState(null);
  const [wizData, setWizData] = useState(null);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [deploys, setDeploys] = useState([]);
  const [registry, setRegistry] = useState([]);
  const [templateGenOpen, setTemplateGenOpen] = useState(false);
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
    bootApp();

    // Set up visibility handler for Neon reconnection
    const cleanupVisibility = db.setupVisibilityHandler();

    return () => {
      cleanupVisibility?.();
    };
  }, []);

  async function bootApp() {
    const localSettings = LS.get("settings") || {};

    // 1. Try Neon first (primary data store)
    const neonConnStr = NEON_URL || localSettings.neonUrl || "";
    let neonReady = false;

    // Only attempt Neon if the URL looks like a real connection string
    if (neonConnStr && neonConnStr.includes("@") && !neonConnStr.includes("ep-xxx")) {
      try {
        const initialized = db.initNeon(neonConnStr);
        if (initialized) {
          const pong = await db.ping();
          if (pong) {
            neonReady = true;
            setNeonOk(true);

            // Load from Neon
            const [neonSettings, neonSites, neonDeploys] = await Promise.all([
              db.loadSettings(),
              db.loadSites(),
              db.loadDeploys(),
            ]);

            // Merge: localStorage wins over Neon (user's most recent saves)
            // then Neon fills in anything not in localStorage
            if (neonSettings && Object.keys(neonSettings).length > 0) {
              const merged = { ...neonSettings, ...localSettings };
              setSettings(merged);
              LS.set("settings", merged);
            }

            // Sites from Neon
            if (neonSites && neonSites.length > 0) {
              // Migrate: add templateId to old sites that don't have it
              const migratedSites = neonSites.map(s => ({
                ...s,
                templateId: s.templateId || "classic"
              }));
              setSites(migratedSites);
            } else {
              // First time: sync localStorage sites to Neon
              const localSites = LS.get("sites") || [];
              if (localSites.length > 0) {
                setSites(localSites);
                db.syncFromLocal(localSettings, localSites, []);
              }
            }

            // Deploys from Neon
            if (neonDeploys && neonDeploys.length > 0) {
              setDeploys(neonDeploys);
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
        if (data.ops) {
          setOps({
            ...data.ops,
            cfAccounts: data.cfAccounts || [],
            registrarAccounts: data.registrarAccounts || [],
          });
        }

        // When Neon is not ready, use API as full fallback for app data
        if (!neonReady) {
          if (data.sites) setSites(data.sites);
          if (data.settings) {
            // localStorage wins — user's local saves are most recent
            const merged = { ...data.settings, ...localSettings };
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
      // API unreachable — keep Neon/localStorage state
      console.warn("[App] API unreachable, using local state:", e?.message || e);
    }

    setLoading(false);
  }

  const recoverNeonConnection = async () => {
    const localSettings = LS.get("settings") || {};
    const neonConnStr = NEON_URL || localSettings.neonUrl || "";

    if (neonConnStr && neonConnStr.includes("@") && !neonConnStr.includes("ep-xxx")) {
      const reconnected = db.forceReconnect();
      if (reconnected) {
        const pong = await db.ping();
        setNeonOk(pong);
        if (pong) {
          const [neonSettings, neonSites, neonDeploys] = await Promise.all([
            db.loadSettings(),
            db.loadSites(),
            db.loadDeploys(),
          ]);

          if (neonSettings) {
            const merged = { ...neonSettings, ...localSettings };
            setSettings(merged);
            LS.set("settings", merged);
          }

          if (neonSites?.length > 0) {
            setSites(neonSites);
          }

          if (neonDeploys?.length > 0) {
            setDeploys(neonDeploys);
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

  const startCreate = (existingSite = null) => {
    // Guard: reject MouseEvent or non-plain-object arguments (e.g. from onClick handlers)
    const isValidSite = existingSite && typeof existingSite === "object" && !(existingSite instanceof Event) && !existingSite.nativeEvent && existingSite.id;
    if (isValidSite) {
      // Edit mode: keep original ID for update/redeploy
      setWizData({ ...WIZARD_DEFAULTS, ...existingSite, _editMode: true });
    } else {
      setWizData({ ...WIZARD_DEFAULTS });
    }
    setPage("create");
  };

  // Keep only plain serializable site fields — drops React event/DOM properties
  const SITE_FIELDS = new Set(["id","brand","domain","tagline","email","templateId","loanType","amountMin","amountMax","aprMin","aprMax","colorId","fontId","layout","radius","trustBadgeStyle","trustBadgeIconTone","h1","h1span","badge","cta","sub","conversionId","formStartLabel","formSubmitLabel","aid","network","redirectUrl","voluumId","voluumDomain","lang","faviconDataUrl","ogImageDataUrl","formEmbed","status","createdAt","updatedAt","cost"]);
  const sanitizeSite = (obj) => Object.fromEntries(
    Object.entries(obj).filter(([k, v]) => SITE_FIELDS.has(k) && typeof v !== "function")
  );

  const addSite = async (site) => {
    if (site._editMode) {
      // Update existing site (redeploy)
      const { _editMode, ...rawData } = site;
      const siteData = sanitizeSite(rawData);
      setSites(p => p.map(s => s.id === siteData.id ? { ...s, ...siteData, updatedAt: now() } : s));

      if (neonOk) db.saveSite(siteData).catch(() => { });
      else if (apiOk) api.put(`/sites/${siteData.id}`, siteData).catch(() => { });

      notify(`${siteData.brand} updated!`);
    } else {
      // New site
      const cleanSite = sanitizeSite(site);
      setSites(p => [cleanSite, ...p]);
      setStats(p => ({ builds: p.builds + 1, spend: +(p.spend + (cleanSite.cost || 0)).toFixed(3) }));

      // Wait for save to complete before navigating
      if (neonOk) await db.saveSite(cleanSite).catch(() => { });
      else if (apiOk) await api.post("/sites", cleanSite).catch(() => { });

      notify(`${cleanSite.brand} created!`);
    }
    setPage("sites");
  };

  const updateSite = async (site) => {
    const updatedSite = sanitizeSite({ ...site, updatedAt: now() });
    setSites(p => p.map(s => s.id === site.id ? updatedSite : s));

    if (neonOk) await db.saveSite(updatedSite).catch(() => { });
    else if (apiOk) await api.put(`/sites/${site.id}`, updatedSite).catch(() => { });
  };

  // Quick fix function to update templateId
  const updateSiteTemplate = async (siteId, newTemplateId) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return false;

    const updatedSite = { ...site, templateId: newTemplateId, updatedAt: now() };
    setSites(p => p.map(s => s.id === siteId ? updatedSite : s));

    if (neonOk) {
      const success = await db.saveSite(updatedSite);
      if (success) {
        // Force refresh from database to ensure UI sync
        const freshSites = await db.loadSites();
        if (freshSites) {
          setSites(freshSites);
        }
        notify(`Template updated to ${newTemplateId}!`);
        return true;
      }
    }
    return false;
  };

  // Force refresh sites from database
  const refreshSitesFromDB = async () => {
    if (neonOk) {
      const freshSites = await db.loadSites();
      if (freshSites) {
        setSites(freshSites);
        console.log("[App] Sites refreshed from database");
        // Debug: show templateId for PlainGreenLoans2026
        const targetSite = freshSites.find(s => s.id === "d28533");
        if (targetSite) {
          console.log("[App] PlainGreenLoans2026 templateId in DB:", targetSite.templateId);
        }
        return true;
      }
    }
    return false;
  };

  // Force update templateId with debug
  const forceUpdateTemplate = async (siteId, newTemplateId) => {
    console.log(`[App] Force updating ${siteId} to ${newTemplateId}`);

    if (neonOk) {
      // Get current site data
      const currentSites = await db.loadSites();
      const currentSite = currentSites?.find(s => s.id === siteId);

      if (currentSite) {
        console.log("[App] Current site data:", {
          id: currentSite.id,
          templateId: currentSite.templateId,
          brand: currentSite.brand
        });

        // Update with new templateId
        const updatedSite = { ...currentSite, templateId: newTemplateId, updatedAt: now() };
        const success = await db.saveSite(updatedSite);

        if (success) {
          console.log(`[App] ✅ Template updated to ${newTemplateId}`);

          // Verify the update
          const verifySites = await db.loadSites();
          const verifySite = verifySites?.find(s => s.id === siteId);
          console.log("[App] Verification - templateId now:", verifySite?.templateId);

          // Refresh UI
          setSites(verifySites || []);
          notify(`Template force updated to ${newTemplateId}!`);
          return true;
        }
      }
    }
    return false;
  };

  const delSite = (id) => {
    // Find the site before deleting (to match domain in ops)
    const site = sites.find(s => s.id === id);

    setSites(p => p.filter(s => s.id !== id));

    if (neonOk) db.deleteSite(id).catch(() => { });
    else if (apiOk) api.del(`/sites/${id}`).catch(() => { });

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

  const updSite = async (id, updates) => {
    let updatedSite = null;
    setSites(prev => prev.map(site => {
      if (site.id !== id) return site;
      updatedSite = { ...site, ...updates };
      return updatedSite;
    }));

    if (!updatedSite) return;

    if (neonOk) {
      await db.saveSite(updatedSite).catch(() => { });
    } else if (apiOk) {
      await api.put(`/sites/${id}`, updates).catch(() => { });
    }

    notify("Site updated");
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
      api.post(endpoint, apiPayload).catch(() => { });
    }
  };

  const opsDel = (coll, id) => {
    const stateKey = toOpsStateKey(coll);
    const item = (ops[stateKey] || []).find(i => i.id === id);
    setOps(p => ({
      ...p, [stateKey]: (p[stateKey] || []).filter(i => i.id !== id),
      logs: [{ id: uid(), msg: `Deleted: ${item?.label || item?.domain || id}`, ts: now() }, ...p.logs].slice(0, 200),
    }));
    const endpoint = toOpsEndpoint(coll, id);
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
      return api.put(endpoint, apiPayload);
    }
    return Promise.resolve({ success: true, skipped: true });
  };

  const handleSaveSettings = async (s) => {
    // Use functional update to avoid stale closure
    let next;
    setSettings(prev => {
      next = { ...prev, ...s };
      return next;
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
          return;
        }
      } else {
        // Try connection recovery if initial init fails
        const recovered = await recoverNeonConnection();
        if (recovered) {
          return;
        }
      }
      notify("Neon connection failed", "danger");
      return;
    }

    // Save to Neon (primary) or API (fallback)
    if (neonOk) {
      const ok = await db.saveSettings(s);
      if (ok) { notify("Saved!"); }
      else { notify("Saved locally — Neon sync failed", "warning"); }
    } else if (apiOk) {
      try {
        const res = await api.post("/settings", s);
        if (res && !res.error) { notify("Saved!"); }
        else { notify("Saved locally — API sync failed", "warning"); }
      } catch (e) {
        console.warn("[App] Settings save failed:", e?.message || e);
        notify("Saved locally — API unreachable", "warning");
      }
    } else {
      // No backend connected — still show success since localStorage save worked
      notify("Saved locally ✓", "success");
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12, animation: "pulse 1.5s infinite" }}>⚡</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>LP Factory V2</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>Loading...</div>

        {/* Safety bypass if boot hangs */}
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setLoading(false)}
            style={{ background: "none", border: `1px solid ${T.border}`, color: T.muted, padding: "6px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}
          >
            Skip Loading (Bypass Hang)
          </button>
        </div>
      </div>
    </div>
  );

  const ml = sideCollapsed ? 64 : 220;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <Sidebar page={page} setPage={setPage} siteCount={sites.length} startCreate={startCreate} startTemplateGen={() => setTemplateGenOpen(true)}
        collapsed={sideCollapsed} toggle={() => setSideCollapsed(p => !p)} />

      <main style={{ flex: 1, marginLeft: ml, minHeight: "100vh", transition: "margin .2s" }}>
        <TopBar stats={stats} settings={settings} deploys={deploys} apiOk={apiOk} neonOk={neonOk} onReconnectNeon={recoverNeonConnection} />
        <div style={{ padding: "24px 28px" }}>
          {page === "dashboard" && <Dashboard sites={sites} stats={stats} ops={ops} setPage={setPage} startCreate={startCreate} settings={settings} apiOk={apiOk} neonOk={neonOk} />}
          {page === "sites" && <Sites sites={sites} del={delSite} notify={notify} startCreate={startCreate} settings={settings} addDeploy={addDeploy} ops={ops} updateSite={updateSite} />}
          {page === "template-editor" && <TemplateEditor notify={notify} />}
          {page === "create" && wizData && <Wizard config={wizData} setConfig={setWizData} addSite={addSite} setPage={setPage} settings={settings} notify={notify} />}
          {page === "variant" && <VariantStudio notify={notify} sites={sites} addSite={addSite} registry={registry} setRegistry={setRegistry} apiOk={apiOk} />}
          {page === "ops" && <OpsCenter data={ops} add={opsAdd} del={opsDel} upd={opsUpd} settings={settings} />}
          {page === "deploys" && <DeployHistory deploys={deploys} />}
          {page === "error-log" && <ErrorLog />}
          {page === "settings" && <Settings settings={settings} setSettings={handleSaveSettings} stats={stats} apiOk={apiOk} neonOk={neonOk} />}
        </div>
      </main>

      {/* Template Generator Modal */}
      <TemplateGeneratorModal
        open={templateGenOpen}
        onClose={() => setTemplateGenOpen(false)}
        onSave={async (templateData) => {
          try {
            // Save template to database via API
            const response = await api.post('/templates', {
              templateId: templateData.newFolderId,
              name: templateData.templateName,
              description: templateData.templateDescription,
              category: templateData.category || 'general',
              badge: templateData.badge || 'New',
              sourceCode: templateData.generatedCode,
              files: templateData.generatedFiles || {},
            });

            if (response.error) {
              notify(`Error saving template: ${response.error}`, 'error');
            } else {
              notify(`Template "${templateData.templateName}" saved successfully!`, 'success');
              // Refresh templates cache so it appears in the selector
              refreshCustomTemplates();
              // Dispatch event for any listening components
              window.dispatchEvent(new CustomEvent(TEMPLATE_REFRESH_EVENT, { detail: templateData.newFolderId }));
              console.log("Template saved:", response);
            }
          } catch (e) {
            notify(`Failed to save template: ${e.message}`, 'error');
            console.error("Template save error:", e);
          }
        }}
        templates={[]} // Pass available templates if needed
      />

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
