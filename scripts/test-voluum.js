

async function testVoluumConnection() {
    const apiKey = process.env.VOLUUM_API_KEY;
    if (!apiKey) {
        console.error("VOLUUM_API_KEY is not set in .env.local");
        process.exit(1);
    }

    // Split the API Key into accessId and accessKey
    const parts = apiKey.split(':');
    if (parts.length !== 2) {
        console.error("VOLUUM_API_KEY is not in the expected format 'accessId:accessKey'");
        process.exit(1);
    }

    const [accessId, accessKey] = parts;

    console.log("Testing Voluum API Connection...");
    console.log(`Access ID: ${accessId}`);

    try {
        // 1. Authenticate to get a session token
        console.log("Authenticating...");
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                accessId,
                accessKey
            })
        });

        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            throw new Error(`Authentication failed with status ${authResponse.status}: ${errorText}`);
        }

        const authData = await authResponse.json();
        console.log("✅ Authentication successful!");
        console.log(`Token expires: ${authData.expirationTimestamp}`);

        const token = authData.token;

        // 2. Test a simple authenticated request, e.g., getting campaigns
        console.log("\nFetching campaigns to verify token access...");
        const campaignResponse = await fetch('https://api.voluum.com/campaign', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'cwauth-token': token
            }
        });

        if (!campaignResponse.ok) {
            const errorText = await campaignResponse.text();
            throw new Error(`Failed to fetch campaigns with status ${campaignResponse.status}: ${errorText}`);
        }

        const campaignData = await campaignResponse.json();
        console.log(`✅ Successfully fetched campaigns. Found ${campaignData.campaigns ? campaignData.campaigns.length : 0} campaigns.`);

        console.log("\n🎉 Voluum API connection test passed!");

    } catch (error) {
        console.error("❌ Voluum API Error:", error.message);
        process.exit(1);
    }
}

testVoluumConnection();
