// Load via --env-file=.env.local in CLI

async function testLendingCardAPI() {
    // 1. Get Token (Assume user added it or we ask them)
    const token = process.env.LENDINGCARD_API_TOKEN;

    if (!token) {
        console.error("❌ Missing LENDINGCARD_API_TOKEN in .env.local");
        console.info("Please add it to test the API.");
        return;
    }

    console.log(`🔑 Using Token: ${token.substring(0, 5)}...`);

    // 2. Format a date (e.g. 1st of current month)
    const date = new Date();
    date.setDate(1);
    const fromDate = date.toISOString().split('T')[0];

    console.log(`📅 Fetching transactions from: ${fromDate}`);

    try {
        // 3. Make the API Call
        const response = await fetch(`https://app.leadingcards.media/v1/transactions?from_date=${fromDate}`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}\n${await response.text()}`);
        }

        const data = await response.json();

        console.log(`✅ Success! Fetched ${data.length || (data.results && data.results.length) || 0} transactions.`);

        // Print first transaction as sample
        if (data.results && data.results.length > 0) {
            console.log("📄 Sample Transaction Data:");
            console.log(JSON.stringify(data.results[0], null, 2));
        } else if (Array.isArray(data) && data.length > 0) {
            console.log("📄 Sample Transaction Data:");
            console.log(JSON.stringify(data[0], null, 2));
        } else {
            console.log("ℹ️ No transactions found for this period.");
        }

    } catch (error) {
        console.error("❌ Failed to fetch from LendingCard API:", error.message);
    }
}

testLendingCardAPI();
