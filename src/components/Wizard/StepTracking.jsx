import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Field } from "../ui/field";
import { InputField as Inp, SelectField } from "../ui/input-field";
import { cn } from "../../lib/utils";
import { NETWORKS_AFF } from "../../constants";
import { fetchVoluumSession, createCampaign as createVoluumCampaign } from "../../services/voluum";
import { LS } from "../../utils";
import { getOrCreateZone, createDnsRecord } from "../../services/cloudflare-dns";

// ─── Voluum API via worker proxy ───
const VOLUUM_API = (() => {
  const fromWindow = typeof window !== "undefined" ? window.__LP_API__ : "";
  const fromEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_API_BASE : "";
  const isLocal = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  const PROD = import.meta.env?.VITE_API_BASE || "https://lp-factory-api.misty-feather-556e.workers.dev/api";
  return String(fromWindow || fromEnv || (isLocal ? "/api" : PROD)).replace(/\/+$/, "");
})();

async function voluumProxy(token, method, path, body) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${VOLUUM_API}/voluum/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, method, path, body }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data?._status && data._status >= 400) {
      throw new Error(typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : `Voluum API error ${data._status}`);
    }
    return data;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") throw new Error("Voluum API timeout (25s) — check network or try again");
    throw e;
  }
}

// ─── Campaign cache ───
let _campaignCache = null;
let _campaignCacheToken = null;

async function fetchCampaigns(token) {
  if (_campaignCache && _campaignCacheToken === token) return _campaignCache;
  const data = await voluumProxy(token, "GET", "/campaign");
  console.log("[voluum] campaign response keys:", Object.keys(data || {}), "full:", JSON.stringify(data).slice(0, 500));
  const all = data?.campaigns || data?.rows || data?.elements || [];
  console.log("[voluum] campaigns found:", all.length, "deleted:", all.filter(c => c.deleted).length);
  const rows = all.filter(c => !c.deleted)
    .map(c => ({
      id: c.id,
      name: c.namePostfix || c.name || c.id,
      fullName: c.name,
      trackingDomain: c.preferredTrackingDomain || "",
      trafficSourceName: c.trafficSource?.name || "",
      trafficSourceId: c.trafficSource?.id || "",
      directTracking: c.directTracking,
    }));
  _campaignCache = rows;
  _campaignCacheToken = token;
  return rows;
}

export function clearVoluumCache() {
  _campaignCache = null;
  _campaignCacheToken = null;
}

// ─── Component ───
export function StepTracking({ c, u }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newCamp, setNewCamp] = useState({ name: "", country: "US", costModel: "CPC", costValue: 0, trafficSourceId: "" });
  const [trafficSources, setTrafficSources] = useState([]);
  const fetchedRef = useRef(false);

  // DNS provisioning state
  const [dnsProvisioning, setDnsProvisioning] = useState(false);
  const [dnsResult, setDnsResult] = useState(null); // { success, message } or null

  const mode = c.trackingMode || "minimal";
  const isVoluum = mode === "voluum";

  // ─── Voluum credentials from settings (stored in localStorage by Settings page) ───
  const getCredentials = useCallback(() => {
    try {
      // Use LS utility (reads from lpf2:{host}:settings — same as App.jsx)
      const s = LS.get("settings") || {};
      const accessId = s.voluumAccessKeyId || "";
      const accessKey = s.voluumAccessKey || "";
      if (accessId && accessKey) return { accessId, accessKey };
    } catch { /* noop */ }
    // Fallback: env vars
    return {
      accessId: import.meta.env?.VITE_VOLUUM_ACCESS_KEY_ID || "",
      accessKey: import.meta.env?.VITE_VOLUUM_ACCESS_KEY || "",
    };
  }, []);

  // ─── Fetch campaigns when Voluum mode enabled ───
  useEffect(() => {
    if (!isVoluum) return;
    if (fetchedRef.current && campaigns.length > 0) return;

    const { accessId, accessKey } = getCredentials();
    if (!accessId || !accessKey) {
      setError("Voluum credentials not found. Add Access Key ID + Secret in Settings → Voluum.");
      return;
    }

    setLoading(true);
    setError("");

    // Authenticate first, then fetch campaigns
    fetchVoluumSession(accessId, accessKey)
      .then(async token => {
        const camps = await fetchCampaigns(token);
        // Also fetch traffic sources for create form
        try {
          const tsData = await voluumProxy(token, "GET", "/traffic-source");
          const tsList = tsData?.trafficSources || tsData?.rows || [];
          console.log("[voluum] traffic sources:", tsList.length, Object.keys(tsData || {}));
          setTrafficSources(tsList.map(ts => ({ id: ts.id, name: ts.name })));
        } catch (_e) { /* non-critical */ }
        return camps;
      })
      .then(rows => {
        setCampaigns(rows);
        fetchedRef.current = true;
      })
      .catch(e => setError(typeof e?.message === "string" ? e.message : typeof e === "string" ? e : "Failed to authenticate or fetch campaigns"))
      .finally(() => setLoading(false));
  }, [isVoluum, getCredentials, campaigns.length]);

  // ─── Mode switch handler ───
  const handleModeSwitch = (newMode) => {
    u("trackingMode", newMode);
    if (newMode === "minimal") {
      u("voluumCampaignId", "");
      u("voluumCampaignName", "");
      u("voluumTrackingDomain", "");
    }
  };

  // ─── Create campaign handler ───
  const handleCreateCampaign = async () => {
    setCreating(true);
    setCreateError("");
    try {
      const { accessId, accessKey } = getCredentials();
      if (!accessId || !accessKey) throw new Error("Voluum credentials not found");
      const token = await fetchVoluumSession(accessId, accessKey);
      const created = await createVoluumCampaign(token, newCamp);
      // Add to campaign list and auto-select
      setCampaigns(prev => [{ ...created, trafficSourceName: "" }, ...prev]);
      u("voluumCampaignId", created.id);
      u("voluumCampaignName", created.name);
      u("voluumTrackingDomain", created.trackingDomain || (c.domain ? `trk.${c.domain}` : ""));
      setShowCreate(false);
      setNewCamp({ name: "", country: "US", costModel: "CPC", costValue: 0, trafficSourceId: "" });
      clearVoluumCache();
    } catch (e) {
      setCreateError(typeof e?.message === "string" ? e.message : typeof e === "string" ? e : JSON.stringify(e) || "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  // ─── Campaign select handler ───
  const handleCampaignSelect = (campaignId) => {
    const camp = campaigns.find(c => c.id === campaignId);
    u("voluumCampaignId", campaignId);
    u("voluumCampaignName", camp?.name || "");
    u("voluumTrackingDomain", camp?.trackingDomain || (c.domain ? `trk.${c.domain}` : ""));
  };

  return (
    <>
      {/* Header */}
      <div className="text-center mb-5">
        <div className="text-2xl">📡</div>
        <h2 className="text-[17px] font-bold">Tracking & Conversion</h2>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
          AW-only gtag + First-party pixel{isVoluum ? " + Voluum stack" : ""}
        </p>
      </div>

      {/* ═══ 1. Tracking Mode ═══ */}
      <Card className="mb-3.5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <span>🎯</span> Tracking Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2.5">
            {/* Minimal */}
            <button
              type="button"
              onClick={() => handleModeSwitch("minimal")}
              className={cn(
                "rounded-lg border-2 p-3.5 text-left transition-all cursor-pointer",
                mode === "minimal"
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/8]"
                  : "border-[hsl(var(--border))] bg-transparent hover:border-[hsl(var(--border))]/80"
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm">⚡</span>
                <span className="text-[12px] font-semibold">Minimal Stack</span>
              </div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                AW-only gtag + First-party pixel. No Voluum.
              </p>
            </button>

            {/* Voluum */}
            <button
              type="button"
              onClick={() => handleModeSwitch("voluum")}
              className={cn(
                "rounded-lg border-2 p-3.5 text-left transition-all cursor-pointer",
                mode === "voluum"
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/8]"
                  : "border-[hsl(var(--border))] bg-transparent hover:border-[hsl(var(--border))]/80"
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm">🔗</span>
                <span className="text-[12px] font-semibold">Voluum Stack</span>
              </div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                AW gtag + Pixel + Voluum DTP + click tracking.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ 2. Voluum Campaign (conditional) ═══ */}
      {isVoluum && (
        <Card className="mb-3.5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <span>🎯</span> Voluum Campaign
              </CardTitle>
              {c.voluumCampaignId ? (
                <Badge variant="success">🟢 Connected</Badge>
              ) : (
                <Badge variant="danger">🔴 Not selected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-[hsl(var(--destructive))/8] border border-[hsl(var(--destructive))/30] rounded-lg px-3 py-2.5 mb-3">
                <p className="text-[11px] text-[hsl(var(--destructive))]">{error}</p>
              </div>
            )}

            <Field label="Campaign" req>
              {loading ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="h-3.5 w-3.5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Loading campaigns...</span>
                </div>
              ) : (
                <SelectField
                  value={c.voluumCampaignId || ""}
                  onChange={handleCampaignSelect}
                  options={[
                    { value: "", label: "— Select campaign —" },
                    ...campaigns.map(cp => ({
                      value: cp.id,
                      label: `${cp.name}${cp.trafficSourceName ? ` (${cp.trafficSourceName})` : ""}`,
                    })),
                  ]}
                />
              )}
            </Field>

            {c.voluumCampaignId && (
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 mt-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Tracking Domain</span>
                  <span className="text-[11px] font-mono text-[hsl(var(--foreground))]">{c.voluumTrackingDomain || (c.domain ? `trk.${c.domain}` : "—")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Campaign ID</span>
                  <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">{c.voluumCampaignId?.slice(0, 12)}...</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">DTP Script</span>
                  <Badge variant="success">Auto-generated</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Click ID</span>
                  <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">clickid (hardcoded)</span>
                </div>
                <div className="pt-1">
                  <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1.5">Postback URL</span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[9px] font-mono bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded px-2 py-1.5 text-purple-400 break-all cursor-pointer" onClick={() => navigator.clipboard?.writeText(`https://${c.voluumTrackingDomain || (c.domain ? `trk.${c.domain}` : 'TRACKING_DOMAIN')}/postback?cid={click_id}&payout={price}`)}>
                      https://{c.voluumTrackingDomain || (c.domain ? `trk.${c.domain}` : 'TRACKING_DOMAIN')}/postback?cid={'{click_id}'}&payout={'{price}'}
                    </code>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Tracking Domain DNS Provisioning ─── */}
            {c.voluumCampaignId && c.domain && (
              <div className="mt-3 rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))/15] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🌐</span>
                    <span className="text-[12px] font-semibold">Tracking Domain DNS</span>
                  </div>
                  {c._trkDnsProvisioned && <Badge variant="success">✅ Provisioned</Badge>}
                </div>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                  Paste the CNAME values from Voluum → Settings → Domains → Custom Domain Setup.
                  This will auto-create the DNS records in Cloudflare.
                </p>

                {/* CloudFront CNAME */}
                <Field label="CloudFront CNAME target" help={`trk.${c.domain} → this value`}>
                  <Inp
                    value={c.voluumCfCname || ""}
                    onChange={v => u("voluumCfCname", v.trim())}
                    placeholder="dyewkdxvpdi17.cloudfront.net"
                  />
                </Field>

                {/* ACM Certificate CNAME */}
                <Field label="Certificate CNAME name" help="Long _acb2ed... record name">
                  <Inp
                    value={c.voluumAcmName || ""}
                    onChange={v => u("voluumAcmName", v.trim())}
                    placeholder="_acb2ed6d0f898953d094985dbd802f40.trk.scratchpaypet.tech"
                  />
                </Field>
                <Field label="Certificate CNAME value" help="Long _f37b35... ACM validation value">
                  <Inp
                    value={c.voluumAcmValue || ""}
                    onChange={v => u("voluumAcmValue", v.trim())}
                    placeholder="_f37b35a7a6817cbb0aa20a7d1a...acm-validations.aws"
                  />
                </Field>

                {dnsResult && (
                  <div className={`text-[10px] px-2.5 py-2 rounded-lg border ${
                    dnsResult.success
                      ? "bg-[hsl(var(--success))/8] border-[hsl(var(--success))/30] text-[hsl(var(--success))]"
                      : "bg-[hsl(var(--destructive))/8] border-[hsl(var(--destructive))/30] text-[hsl(var(--destructive))]"
                  }`}>
                    {dnsResult.message}
                  </div>
                )}

                <button
                  type="button"
                  disabled={dnsProvisioning || !c.voluumCfCname}
                  onClick={async () => {
                    setDnsProvisioning(true);
                    setDnsResult(null);
                    try {
                      const s = LS.get("settings") || {};
                      // Resolve CF credentials from profile or global
                      const cfProfiles = Array.isArray(s.cfProfiles) ? s.cfProfiles : [];
                      const cfProfile = cfProfiles.find(p => p.id === c.cfProfileId);
                      const cfAccountId = cfProfile?.accountId || s.cfAccountId;
                      const cfApiToken = cfProfile?.apiToken || s.cfApiToken;
                      if (!cfAccountId || !cfApiToken) throw new Error("Cloudflare credentials not found — configure in Settings");

                      const zone = await getOrCreateZone(c.domain, cfAccountId, cfApiToken);
                      if (!zone.success || !zone.zoneId) throw new Error(zone.error || "Failed to get zone");

                      const results = [];
                      const trkSub = (c.voluumTrackingDomain || `trk.${c.domain}`).split(".")[0];

                      // 1. Tracking CNAME: trk.domain → CloudFront
                      const r1 = await createDnsRecord({
                        zoneId: zone.zoneId, cfAccountId, cfApiToken,
                        type: "CNAME", name: `${trkSub}.${c.domain}`,
                        content: c.voluumCfCname, proxied: false,
                      });
                      results.push(r1.success ? `✅ ${trkSub} CNAME → ${c.voluumCfCname.slice(0, 30)}...` : `❌ ${trkSub} CNAME: ${r1.error}`);

                      // 2. ACM Certificate CNAME (if provided)
                      if (c.voluumAcmName && c.voluumAcmValue) {
                        const r2 = await createDnsRecord({
                          zoneId: zone.zoneId, cfAccountId, cfApiToken,
                          type: "CNAME", name: c.voluumAcmName,
                          content: c.voluumAcmValue, proxied: false,
                        });
                        results.push(r2.success ? `✅ ACM cert CNAME created` : `❌ ACM CNAME: ${r2.error}`);
                      }

                      const allOk = results.every(r => r.startsWith("✅"));
                      if (allOk) u("_trkDnsProvisioned", true);
                      setDnsResult({ success: allOk, message: results.join("\n") });
                    } catch (e) {
                      setDnsResult({ success: false, message: e.message || "DNS provisioning failed" });
                    } finally {
                      setDnsProvisioning(false);
                    }
                  }}
                  className="w-full px-3 py-2 text-[11px] rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold cursor-pointer disabled:opacity-40 border-none"
                >
                  {dnsProvisioning ? "⏳ Provisioning DNS..." : "🌐 Provision Tracking Domain DNS"}
                </button>
              </div>
            )}

            {!error && !loading && campaigns.length === 0 && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                No active campaigns found. Create one below, or check Settings → Voluum.
              </p>
            )}

            <div className="mt-2.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => { clearVoluumCache(); fetchedRef.current = false; setCampaigns([]); }}
                className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                🔄 Refresh campaigns
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="text-[10px] text-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer bg-transparent border-none p-0 font-semibold"
              >
                ➕ Create new campaign
              </button>
            </div>

            {/* ─── Inline Create Campaign ─── */}
            {showCreate && (
              <div className="mt-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3.5 space-y-3">
                <div className="text-[12px] font-semibold">Create Voluum Campaign</div>
                <Field label="Traffic Source" req>
                  {trafficSources.length > 0 ? (
                    <SelectField
                      value={newCamp.trafficSourceId}
                      onChange={v => setNewCamp(p => ({...p, trafficSourceId: v}))}
                      options={[
                        { value: "", label: "— Select traffic source —" },
                        ...trafficSources.map(ts => ({ value: ts.id, label: ts.name })),
                      ]}
                    />
                  ) : (
                    <p className="text-[10px] text-[hsl(var(--destructive))]">No traffic sources found. Create one in Voluum → Traffic Sources first.</p>
                  )}
                </Field>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Campaign Name" req>
                    <Inp value={newCamp.name} onChange={v => setNewCamp(p => ({...p, name: v}))} placeholder="US-Loan-BearLoan" />
                  </Field>
                  <Field label="Country">
                    <Inp value={newCamp.country} onChange={v => setNewCamp(p => ({...p, country: v.toUpperCase()}))} placeholder="US" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Cost Model">
                    <SelectField
                      value={newCamp.costModel}
                      onChange={v => setNewCamp(p => ({...p, costModel: v}))}
                      options={[
                        { value: "CPC", label: "CPC" },
                        { value: "CPV", label: "CPV" },
                        { value: "CPA", label: "CPA" },
                        { value: "RevShare", label: "RevShare" },
                        { value: "Manual", label: "Manual" },
                      ]}
                    />
                  </Field>
                  <Field label="Cost Value">
                    <Inp type="number" value={newCamp.costValue} onChange={v => setNewCamp(p => ({...p, costValue: parseFloat(v) || 0}))} placeholder="0.00" />
                  </Field>
                </div>
                {createError && (
                  <div className="text-[10px] text-[hsl(var(--destructive))]">{createError}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setShowCreate(false); setCreateError(""); }}
                    className="px-3 py-1.5 text-[10px] rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] cursor-pointer bg-transparent text-[hsl(var(--muted-foreground))]">
                    Cancel
                  </button>
                  <button type="button" disabled={creating || !newCamp.name.trim() || !newCamp.trafficSourceId} onClick={handleCreateCampaign}
                    className="px-3 py-1.5 text-[10px] rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold cursor-pointer disabled:opacity-40 border-none">
                    {creating ? "Creating..." : "Create & Select"}
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ 3. Google Ads (always visible) ═══ */}
      <Card className="mb-3.5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <span>📊</span> Google Ads Conversion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Conversion ID" req help="AW-only gtag.js — no GTM, no GA4">
            <Inp value={c.gtagId || c.conversionId || ""} onChange={v => { u("gtagId", v); u("conversionId", v); }} placeholder="AW-123456789" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="form_start Label" help="Secondary conversion">
              <Inp value={c.gtagFormStartLabel || c.formStartLabel || ""} onChange={v => { u("gtagFormStartLabel", v); u("formStartLabel", v); }} placeholder="AbCdEfGhIjK" />
            </Field>
            <Field label="form_submit Label" help="Primary conversion">
              <Inp value={c.gtagFormSubmitLabel || c.formSubmitLabel || ""} onChange={v => { u("gtagFormSubmitLabel", v); u("formSubmitLabel", v); }} placeholder="XyZaBcDeFgH" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ═══ 4. First-Party Pixel (auto, no config) ═══ */}
      <Card className="mb-3.5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span>🔒</span> First-Party Pixel
            </CardTitle>
            <Badge variant="success">Auto</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
            Sends events to <code className="text-[10px] font-mono bg-[hsl(var(--muted))/30] px-1 py-0.5 rounded">t.{"{domain}"}/e</code> via
            sendBeacon. No setup needed — auto-configured at build time.
          </p>
        </CardContent>
      </Card>

      {/* ═══ 5. Affiliate Form ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <span>📝</span> Affiliate Form
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Affiliate Network">
            <div className="flex gap-1.5 flex-wrap">
              {NETWORKS_AFF.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => u("network", n)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-semibold border-2 cursor-pointer transition-all",
                    c.network === n
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/15] text-[hsl(var(--foreground))]"
                      : "border-[hsl(var(--border))] bg-transparent text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))]/80"
                  )}
                >{n}</button>
              ))}
            </div>
          </Field>

          {/* LeadsGate: AID only */}
          {(c.network || "LeadsGate") === "LeadsGate" && (
            <>
              <Field label="LeadsGate AID" help="Auto-generates form embed with tracking callbacks">
                <Inp value={c.aid || ""} onChange={v => u("aid", v)} placeholder="14881" />
              </Field>
              {c.aid?.trim() && (
                <div className="flex items-center gap-1.5 -mt-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
                  <span className="text-[10px] text-[hsl(var(--success))]">
                    Auto-embed with onFormLoad, onStepChange, onSubmit, onSuccess callbacks
                  </span>
                </div>
              )}
            </>
          )}

          {/* Other networks: manual redirect + embed */}
          {(c.network || "LeadsGate") !== "LeadsGate" && (
            <>
              <Field label="Offer / Redirect URL" req help="Where users go after CTA click">
                <Inp value={c.redirectUrl || ""} onChange={v => u("redirectUrl", v)} placeholder="https://offers.network.com/click?pid=1234&oid=5678" />
              </Field>
              <Field label="Form Embed Code" help="Raw embed code — paste script + container div from your network">
                <textarea
                  value={c.formEmbed || ""}
                  onChange={e => u("formEmbed", e.target.value)}
                  placeholder={'<script src="https://forms.network.com/embed/1234"></script>\n<div id="form-container"></div>'}
                  rows={3}
                  className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-[10px] font-mono text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]/50 resize-y"
                />
              </Field>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Validation helper (export for Wizard.jsx) ───
export function validateTracking(config) {
  const errors = [];
  const mode = config.trackingMode || "minimal";
  const gtagId = config.gtagId || config.conversionId || "";

  if (!gtagId.trim()) {
    errors.push("Google Ads Conversion ID is required");
  }

  if (mode === "voluum") {
    if (!config.voluumCampaignId) errors.push("Voluum campaign must be selected");
    // tracking domain is optional — new campaigns won't have one yet
    // if (!config.voluumTrackingDomain) errors.push("Voluum tracking domain is required");
  }

  return { valid: errors.length === 0, errors };
}
