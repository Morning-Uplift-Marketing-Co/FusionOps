// src/services/voluum.js

/**
 * Voluum API Service Wrapper
 * Handles authentication and fetching reports for the Dashboard.
 * 
 * Note: For production with CORS limitations, this might need to go through our api-worker.
 * But for internal/ops dashboards where CORS is relaxed or bypassed, this works directly.
 */

import { api } from "./api";

const API_BASE = "/voluum";
const DEFAULT_API_BASE = "https://lp-factory-api.misty-feather-556e.workers.dev/api";

/** Resolve the Worker API base URL (shared logic) */
function resolveApiBase() {
    const fromWindow = typeof window !== "undefined" ? window.__LP_API__ : "";
    const fromEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_API_BASE : "";
    return String(fromWindow || fromEnv || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export async function fetchVoluumSession(accessId, accessKey) {
    if (!accessId || !accessKey) {
        throw new Error("Missing Voluum credentials — set Access Key ID and Secret in Settings");
    }

    try {
        // Call directly via fetch to avoid api.js swallowing error body on non-200
        const apiBase = resolveApiBase();

        const fullUrl = `${apiBase}${API_BASE}/session`;
        console.log("[voluum] auth →", fullUrl);

        const res = await fetch(fullUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ accessId, accessKey }),
        });

        const data = await res.json().catch(() => ({}));
        const realStatus = data._status || res.status;
        console.log("[voluum] auth response:", realStatus, data);

        if (data.token) {
            return data.token;
        }

        // Voluum error details
        if (realStatus === 401) {
            throw new Error("Access Key rejected by Voluum (401). Please regenerate your Access Key in Voluum → Security → Access Keys.");
        }
        const errMsg = data.message || data.error || data.detail || `HTTP ${realStatus}`;
        throw new Error(errMsg);
    } catch (e) {
        console.error("[voluum] auth error:", e);
        throw e;
    }
}

export async function fetchVoluumReport(token, fromDate, toDate, tz = "UTC", groupBy = "campaign") {
    if (!token) throw new Error("Missing Voluum auth token");

    // Format dates to YYYY-MM-DDTHH:00:00Z format exactly
    const fromStr = formatVoluumDate(fromDate);
    const toStr = formatVoluumDate(toDate);

    // Voluum API requires explicit column params for metrics to be returned
    const columns = [
      'visits', 'clicks', 'conversions', 'revenue', 'cost', 'profit',
      'cpv', 'ctr', 'cr', 'cv', 'roi', 'epv', 'epc',
      'impressions', 'uniqueVisits'
    ];
    const colParams = columns.map(c => `columns=${c}`).join('&');
    const url = `${API_BASE}/report?from=${fromStr}&to=${toStr}&tz=${tz}&groupBy=${groupBy}&sort=cost&direction=desc&limit=1000&${colParams}`;

    try {
        // api.js doesn't allow passing custom headers easily via its wrapper methods.
        // We will call fetch directly but using the resolved API base.
        const apiBase = resolveApiBase();

        const fullUrl = `${apiBase}${url}`;

        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': token,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Voluum Report Error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (e) {
        console.error("[voluum] report fetch error:", e);
        throw e;
    }
}

/**
 * Helper to ensure Date objects become exactly YYYY-MM-DDTHH:00:00Z
 */
function formatVoluumDate(dateStr) {
    const d = new Date(dateStr);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:00:00Z`;
}

// ═══════════════════════════════════════════════════════════════
// DATA FETCHERS — for matching / merging with external sources
// ═══════════════════════════════════════════════════════════════

/**
 * Generic Voluum proxy call — reuses the same worker proxy as StepTracking
 */
async function voluumProxy(token, method, path, body) {
    const apiBase = resolveApiBase();
    const res = await fetch(`${apiBase}/voluum/proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, method: method || "GET", path, body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data._status && data._status >= 400)) {
        const status = data._status || res.status;
        throw new Error(typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : JSON.stringify(data.error || data.message || `Voluum API ${status}`));
    }
    return data;
}

/**
 * Fetch all ACTIVE campaigns with full metadata
 * Returns: [{ id, name, trackingDomain, trafficSource, status, country, ... }]
 */
export async function fetchCampaigns(token, { activeOnly = true } = {}) {
    const data = await voluumProxy(token, "GET", "/campaign");
    let rows = data?.campaigns || data?.rows || [];
    if (activeOnly) rows = rows.filter(c => !c.deleted);
    return rows.map(c => ({
        id: c.id,
        name: c.namePostfix || c.name || c.id,
        fullName: c.name,
        status: c.status,
        trackingDomain: c.preferredTrackingDomain || "",
        trafficSourceName: c.trafficSource?.name || "",
        trafficSourceId: c.trafficSource?.id || "",
        country: c.country || "",
        directTracking: c.directTracking,
        costModel: c.costModel || "",
        createdAt: c.createdDate || "",
    }));
}

/**
 * Fetch all workspaces
 * Returns: [{ id, name }]
 */
export async function fetchWorkspaces(token) {
    const data = await voluumProxy(token, "GET", "/workspace");
    return (data?.workspaces || data?.rows || []).map(w => ({
        id: w.id,
        name: w.name || w.id,
    }));
}

/**
 * Create a new Voluum campaign with lander + offer + direct tracking
 * @param {string} token
 * @param {object} campaignData  { name, trafficSourceId, country, costModel, costValue, domain, trackingDomain, aid }
 */
export async function createCampaign(token, campaignData) {
    // trafficSource is required — use provided ID or fetch first available
    let trafficSourceId = campaignData.trafficSourceId;
    let workspaceId;
    if (!trafficSourceId) {
        try {
            const sources = await fetchTrafficSources(token);
            if (sources?.length > 0) {
                trafficSourceId = sources[0].id;
                workspaceId = sources[0].workspace?.id;
            } else {
                throw new Error("No traffic sources in Voluum. Create one in Voluum panel first (Traffic Sources → + New).");
            }
        } catch (e) {
            throw new Error(e.message || "Failed to fetch traffic sources");
        }
    } else {
        // Get workspace from traffic source
        try {
            const sources = await fetchTrafficSources(token);
            const source = sources.find(s => s.id === trafficSourceId);
            workspaceId = source?.workspace?.id;
        } catch (e) {
            // Continue without workspace - will use default
        }
    }

    const domain = campaignData.domain || "example.com";
    const country = campaignData.country || "US";
    const campaignName = campaignData.name || "New Campaign";

    // Step 1: Create lander
    const landerBody = {
        namePostfix: `[Master] ${domain}`,
        url: `https://${domain}`,
        country: { code: country },
        numberOfOffers: 1,
    };
    if (workspaceId) {
        landerBody.workspace = { id: workspaceId };
    }
    const landerData = await voluumProxy(token, "POST", "/lander", landerBody);
    if (!landerData?.id) {
        const errDetail = landerData?.errors?.map(e => `${e.field}: ${e.message}`).join("; ") ||
            landerData?.message || landerData?.error || "Failed to create lander";
        throw new Error(errDetail);
    }
    const landerId = landerData.id;

    // Step 2: Create offer
    const offerBody = {
        namePostfix: `[Master] ${domain}`,
        url: `https://${domain}/apply?clickid={clickid}`,
        country: { code: country },
        payout: { type: "AUTO", geoPayouts: [] },
        conversionTrackingMethod: "S2S_POSTBACK_URL",
    };
    if (workspaceId) {
        offerBody.workspace = { id: workspaceId };
    }
    const offerData = await voluumProxy(token, "POST", "/offer", offerBody);
    if (!offerData?.id) {
        const errDetail = offerData?.errors?.map(e => `${e.field}: ${e.message}`).join("; ") ||
            offerData?.message || offerData?.error || "Failed to create offer";
        throw new Error(errDetail);
    }
    const offerId = offerData.id;

    // Step 3: Create campaign with direct tracking + inline path
    const campaignBody = {
        namePostfix: campaignName,
        country: { code: country },
        costModel: {
            type: campaignData.costModel || "CPC",
            value: Number(campaignData.costValue) || 0,
        },
        trafficSource: { id: trafficSourceId },
        directTracking: true,
        directTrackingLanderId: landerId,
        redirectTarget: {
            inlineFlow: {
                name: `${country} - inline path`,
                countries: [{ code: country }],
                defaultPaths: [
                    {
                        name: "New path",
                        active: true,
                        weight: 100,
                        landers: [
                            {
                                weight: 100,
                                lander: { id: landerId },
                                sublanders: [],
                            },
                        ],
                        offers: [
                            {
                                weight: 100,
                                offer: { id: offerId },
                            },
                        ],
                        offerRedirectMode: "REGULAR",
                        realtimeRoutingApiState: "DISABLED",
                    },
                ],
                defaultOfferRedirectMode: "REGULAR",
            },
        },
    };
    if (workspaceId) {
        campaignBody.workspace = { id: workspaceId };
        campaignBody.redirectTarget.inlineFlow.workspace = { id: workspaceId };
    }

    const campaignResponseData = await voluumProxy(token, "POST", "/campaign", campaignBody);
    if (campaignResponseData?.id) {
        const trackingDomain = campaignResponseData.preferredTrackingDomain || `link.${domain}`;
        return {
            id: campaignResponseData.id,
            name: campaignResponseData.name || campaignResponseData.namePostfix || campaignResponseData.id,
            trackingDomain: trackingDomain,
            status: campaignResponseData.status || "ACTIVE",
            url: campaignResponseData.url || `https://${domain}`,
            landerId: landerId,
            offerId: offerId,
            landerTrackingUrl: campaignResponseData.url || `https://${domain}`,
            clickUrl: trackingDomain ? `https://${trackingDomain}/click` : `https://link.${domain}/click`,
        };
    }
    // Surface Voluum field-level validation errors
    const errDetail = campaignResponseData?.errors?.map(e => `${e.field}: ${e.message}`).join("; ") ||
        campaignResponseData?.message || campaignResponseData?.error ||
        JSON.stringify(campaignResponseData || "Failed to create campaign");
    throw new Error(errDetail);
}

/**
 * Fetch all traffic sources
 * Returns: [{ id, name, postbackUrl, ... }]
 */
export async function createTrafficSource(token, name = "Google Ads") {
    const body = {
        name,
        postbackUrl: "",
        pixelRedirectUrl: "",
    };
    const data = await voluumProxy(token, "POST", "/traffic-source", body);
    if (data?.id) return { id: data.id, name: data.name || name };
    throw new Error(data?.message || data?.error || "Failed to create traffic source");
}

export async function fetchTrafficSources(token) {
    const data = await voluumProxy(token, "GET", "/traffic-source");
    return (data?.trafficSources || data?.rows || []).map(ts => ({
        id: ts.id,
        name: ts.namePostfix || ts.name || ts.id,
        postbackUrl: ts.postbackUrl || "",
        status: ts.status || "ACTIVE",
    }));
}

/**
 * Fetch all offers
 * Returns: [{ id, name, url, payoutMode, payout, ... }]
 */
export async function fetchOffers(token) {
    const data = await voluumProxy(token, "GET", "/offer");
    return (data?.offers || data?.rows || []).map(o => ({
        id: o.id,
        name: o.namePostfix || o.name || o.id,
        url: o.url || "",
        payoutMode: o.payoutMode || "",
        payout: o.payout || 0,
        status: o.status || "ACTIVE",
        country: o.country || "",
    }));
}

/**
 * Fetch conversions log — individual conversion events
 * Great for matching click-level data with LeadsGate/ZeroParallel
 *
 * @param {string} token
 * @param {Date|string} from
 * @param {Date|string} to
 * @param {object} opts  { campaignId, limit, offset }
 * Returns: [{ clickId, conversionId, campaignId, offerId, revenue, cost, payout, visitTimestamp, conversionTimestamp, ... }]
 */
export async function fetchConversions(token, from, to, opts = {}) {
    const fromStr = formatVoluumDate(from);
    const toStr = formatVoluumDate(to);
    const limit = opts.limit || 1000;
    const offset = opts.offset || 0;

    const columns = [
        'visits', 'clicks', 'conversions', 'revenue', 'cost', 'profit',
        'cpv', 'ctr', 'cr', 'cv', 'roi', 'epv', 'epc'
    ];
    const colParams = columns.map(c => `columns=${c}`).join('&');

    let path = `/report/conversions?from=${fromStr}&to=${toStr}&tz=UTC&limit=${limit}&offset=${offset}&${colParams}`;
    if (opts.campaignId) path += `&filter=campaign-id:${opts.campaignId}`;

    const data = await voluumProxy(token, "GET", path);
    return {
        rows: (data?.rows || []).map(r => ({
            clickId: r.clickId || r.externalId || "",
            conversionId: r.conversionId || "",
            campaignId: r.campaignId || "",
            campaignName: r.campaignName || "",
            offerId: r.offerId || "",
            offerName: r.offerName || "",
            revenue: r.revenue || 0,
            cost: r.cost || 0,
            payout: r.payout || 0,
            visitTimestamp: r.visitTimestamp || "",
            conversionTimestamp: r.conversionTimestamp || "",
            country: r.country || "",
            externalId: r.externalId || "",
            customVariable1: r.customVariable1 || "",
            customVariable2: r.customVariable2 || "",
            customVariable3: r.customVariable3 || "",
            transactionId: r.transactionId || "",
        })),
        totalRows: data?.totalRows || 0,
        hasMore: (data?.totalRows || 0) > offset + limit,
    };
}

/**
 * Fetch report grouped by custom dimension
 * groupBy options: campaign, day, month, country, device, os, browser,
 *                  traffic-source, offer, lander, connection-type, isp
 *
 * @param {string} token
 * @param {Date|string} from
 * @param {Date|string} to
 * @param {string} groupBy
 * @param {object} opts  { campaignId, sort, direction, limit }
 */
export async function fetchGroupedReport(token, from, to, groupBy = "campaign", opts = {}) {
    const fromStr = formatVoluumDate(from);
    const toStr = formatVoluumDate(to);
    const sort = opts.sort || "cost";
    const direction = opts.direction || "desc";
    const limit = opts.limit || 1000;

    const columns = [
        'visits', 'clicks', 'conversions', 'revenue', 'cost', 'profit',
        'cpv', 'ctr', 'cr', 'cv', 'roi', 'epv', 'epc',
        'impressions', 'uniqueVisits'
    ];
    const colParams = columns.map(c => `columns=${c}`).join('&');

    let path = `/report?from=${fromStr}&to=${toStr}&tz=UTC&groupBy=${groupBy}&sort=${sort}&direction=${direction}&limit=${limit}&${colParams}`;
    if (opts.campaignId) path += `&filter=campaign-id:${opts.campaignId}`;

    const data = await voluumProxy(token, "GET", path);
    return data;
}

/**
 * Fetch click log — raw click-level data for deep matching
 * Use sparingly — can be large
 *
 * @param {string} token
 * @param {Date|string} from
 * @param {Date|string} to
 * @param {object} opts  { campaignId, limit, offset }
 */
export async function fetchClicks(token, from, to, opts = {}) {
    const fromStr = formatVoluumDate(from);
    const toStr = formatVoluumDate(to);
    const limit = opts.limit || 500;
    const offset = opts.offset || 0;

    let path = `/report/clicks?from=${fromStr}&to=${toStr}&tz=UTC&limit=${limit}&offset=${offset}`;
    if (opts.campaignId) path += `&filter=campaign-id:${opts.campaignId}`;

    const data = await voluumProxy(token, "GET", path);
    return {
        rows: (data?.rows || []).map(r => ({
            clickId: r.clickId || "",
            visitTimestamp: r.visitTimestamp || "",
            campaignId: r.campaignId || "",
            campaignName: r.campaignName || "",
            trafficSourceName: r.trafficSourceName || "",
            country: r.country || "",
            device: r.device || "",
            os: r.os || "",
            browser: r.browser || "",
            ip: r.ip || "",
            isp: r.isp || "",
            cost: r.cost || 0,
            externalId: r.externalId || "",
            customVariable1: r.customVariable1 || "",
            customVariable2: r.customVariable2 || "",
            customVariable3: r.customVariable3 || "",
        })),
        totalRows: data?.totalRows || 0,
        hasMore: (data?.totalRows || 0) > offset + limit,
    };
}

/**
 * High-level: Authenticate + fetch all data needed for matching
 * One-call convenience for dashboards & reconciliation
 *
 * @param {string} accessId
 * @param {string} accessKey
 * @param {Date|string} from
 * @param {Date|string} to
 * @param {object} opts  { includeConversions, includeClicks, campaignId }
 */
export async function fetchAllVoluumData(accessId, accessKey, from, to, opts = {}) {
    const token = await fetchVoluumSession(accessId, accessKey);

    const activeOnly = opts.activeOnly !== false; // default true
    const [campaignReport, dailyReport, campaigns] = await Promise.all([
        fetchGroupedReport(token, from, to, "campaign"),
        fetchGroupedReport(token, from, to, "day"),
        fetchCampaigns(token, { activeOnly }),
    ]);

    const result = {
        token,
        campaigns,
        campaignReport: extractMetrics(campaignReport),
        dailyReport: extractMetrics(dailyReport),
        dailyRows: (dailyReport?.rows || []).map(row => {
            const ds = row.day || row.id || row.name || "";
            return {
                date: ds,
                dateShort: ds.length >= 10 ? ds.slice(0, 10) : ds,
                visits: row.visits || 0,
                clicks: row.clicks || 0,
                conversions: row.conversions || 0,
                revenue: row.revenue || 0,
                cost: row.cost || 0,
                profit: row.profit || 0,
                roi: row.roi || 0,
            };
        }),
    };

    // Optional: conversion-level data for click-level matching
    if (opts.includeConversions) {
        result.conversions = await fetchConversions(token, from, to, {
            campaignId: opts.campaignId,
            limit: opts.conversionLimit || 5000,
        });
    }

    // Optional: click-level data (heavy — use with caution)
    if (opts.includeClicks) {
        result.clicks = await fetchClicks(token, from, to, {
            campaignId: opts.campaignId,
            limit: opts.clickLimit || 1000,
        });
    }

    return result;
}


// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Extracts key metrics from a Voluum report payload
 * Returns { visits, clicks, conversions, revenue, cost, profit, roi, rows }
 */
export function extractMetrics(reportData) {
    if (!reportData || !reportData.totals) {
        return { visits: 0, clicks: 0, conversions: 0, revenue: 0, cost: 0, profit: 0, roi: 0, rows: [] };
    }

    const t = reportData.totals;
    return {
        visits: t.visits || 0,
        clicks: t.clicks || 0,
        conversions: t.conversions || 0,
        revenue: t.revenue || 0,
        cost: t.cost || 0,
        profit: t.profit || 0,
        roi: t.roi || 0,
        rows: reportData.rows || []
    };
}

/**
 * Match Voluum conversions with LeadsGate/ZeroParallel data by clickId
 * Returns merged rows with data from both sources
 *
 * @param {Array} voluumConversions - from fetchConversions().rows
 * @param {Array} affiliateData - array of { clickId, leadId, status, payout, ... }
 * @param {string} matchKey - key to match on (default: 'clickId')
 */
export function matchConversions(voluumConversions, affiliateData, matchKey = 'clickId') {
    const affiliateMap = new Map();
    affiliateData.forEach(row => {
        const key = row[matchKey] || row.externalId || "";
        if (key) affiliateMap.set(key, row);
    });

    return voluumConversions.map(vc => {
        const vcKey = vc[matchKey] || vc.externalId || "";
        const affiliate = affiliateMap.get(vcKey);
        return {
            ...vc,
            _matched: !!affiliate,
            _affiliate: affiliate || null,
        };
    });
}

/**
 * Reconcile Voluum campaign totals vs affiliate network totals
 * Returns per-campaign discrepancy report
 *
 * @param {Array} voluumRows - campaignReport.rows from extractMetrics
 * @param {object} affiliateTotals - { campaignId: { conversions, revenue } }
 */
export function reconcileCampaigns(voluumRows, affiliateTotals) {
    return voluumRows.map(vr => {
        const id = vr.campaignId || vr.id || vr.name;
        const aff = affiliateTotals[id] || { conversions: 0, revenue: 0 };
        const convDiff = (vr.conversions || 0) - (aff.conversions || 0);
        const revDiff = (vr.revenue || 0) - (aff.revenue || 0);
        return {
            campaignId: id,
            campaignName: vr.campaignName || vr.name || id,
            voluum: { conversions: vr.conversions || 0, revenue: vr.revenue || 0, cost: vr.cost || 0 },
            affiliate: aff,
            diff: { conversions: convDiff, revenue: +revDiff.toFixed(2) },
            match: convDiff === 0 && Math.abs(revDiff) < 0.01,
        };
    });
}
