async function fetchVoluumReport() {
    const apiKey = process.env.VOLUUM_API_KEY;
    if (!apiKey) {
        console.error("VOLUUM_API_KEY is not set in environment or .env.local");
        process.exit(1);
    }

    const parts = apiKey.split(':');
    const [accessId, accessKey] = parts;

    console.log("Authenticating for Report...");

    try {
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ accessId, accessKey })
        });

        if (!authResponse.ok) throw new Error("Authentication failed");

        const authData = await authResponse.json();
        const token = authData.token;

        console.log("\nFetching report data...");

        // Format precisely as YYYY-MM-DDTHH:mm:ssZ
        const pad = (n) => n < 10 ? '0' + n : n;
        const formatDate = (dateObj) => {
            return dateObj.getUTCFullYear() + '-' +
                pad(dateObj.getUTCMonth() + 1) + '-' +
                pad(dateObj.getUTCDate()) + 'T' +
                pad(dateObj.getUTCHours()) + ':00:00Z';
        };

        const today = new Date();
        const to = formatDate(today);

        const fromObj = new Date();
        fromObj.setDate(fromObj.getDate() - 7);
        const from = formatDate(fromObj);

        // Voluum report requires groupBy. Common groups: campaign, offer, lander, device, etc.
        const groupBy = 'campaign';

        // https://api.voluum.com/report?from=2024-01-01T00:00:00Z&to=2024-01-07T00:00:00Z&tz=UTC&groupBy=campaign
        const reportEndpoint = `https://api.voluum.com/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&tz=UTC&groupBy=${groupBy}`;
        console.log(`Endpoint: ${reportEndpoint}`);

        const reportResponse = await fetch(reportEndpoint, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'cwauth-token': token
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            throw new Error(`Failed to fetch report with status ${reportResponse.status}: ${errorText}`);
        }

        const reportData = await reportResponse.json();
        console.log(`\n✅ Successfully fetched report from Voluum.`);
        console.log(`Total Rows: ${reportData.totalRows}`);

        // Print out summary totals
        if (reportData.totals) {
            console.log(`\n📊 Dashboard Totals (Last 7 Days):`);
            console.log(`- Visits: ${reportData.totals.visits}`);
            console.log(`- Clicks: ${reportData.totals.clicks}`);
            console.log(`- Conversions: ${reportData.totals.conversions}`);
            console.log(`- Revenue: $${(reportData.totals.revenue || 0).toFixed(2)}`);
            console.log(`- Cost: $${(reportData.totals.cost || 0).toFixed(2)}`);
            console.log(`- Profit: $${(reportData.totals.profit || 0).toFixed(2)}`);
            console.log(`- ROI: ${(reportData.totals.roi || 0).toFixed(2)}%`);
        }

        // Print top 3 campaigns
        if (reportData.rows && reportData.rows.length > 0) {
            console.log(`\n🏆 Top Campaigns (by visits):`);
            const topRows = reportData.rows.slice(0, 3);
            topRows.forEach((row, idx) => {
                console.log(`${idx + 1}. ${row.campaignName || row.campaignId} | Visits: ${row.visits} | Clicks: ${row.clicks} | Conversions: ${row.conversions}`);
            });
        }

    } catch (error) {
        console.error("❌ Voluum Report Error:", error.message);
        process.exit(1);
    }
}

fetchVoluumReport();
