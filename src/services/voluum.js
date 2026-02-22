// src/services/voluum.js

/**
 * Voluum API Service Wrapper
 * Handles authentication and fetching reports for the Dashboard.
 * 
 * Note: For production with CORS limitations, this might need to go through our api-worker.
 * But for internal/ops dashboards where CORS is relaxed or bypassed, this works directly.
 */

const API_BASE = "https://api.voluum.com";

export async function fetchVoluumSession(accessId, accessKey) {
    if (!accessId || !accessKey) {
        throw new Error("Missing Voluum credentials");
    }

    try {
        const response = await fetch(`${API_BASE}/auth/access/session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ accessId, accessKey })
        });

        if (!response.ok) {
            throw new Error(`Voluum Auth Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.token; // cwauth-token
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

    const url = `${API_BASE}/report?from=${fromStr}&to=${toStr}&tz=${tz}&groupBy=${groupBy}`;

    try {
        const response = await fetch(url, {
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
        rows: reportData.rows || [] // Raw row detail by 'groupBy' parameter
    };
}
