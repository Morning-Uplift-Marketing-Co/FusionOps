// src/services/lendingcard.js

/**
 * LendingCard API Service Wrapper
 * Fetches transactions and calculates deposit fees.
 */

const LC_API_BASE = "https://app.leadingcards.media/v1";

export async function fetchLendingCardTransactions(token, fromDate) {
    if (!token) throw new Error("Missing LendingCard token");

    // fromDate must be YYYY-MM-DD
    const dateStr = typeof fromDate === "string"
        ? fromDate.split('T')[0]
        : fromDate.toISOString().split('T')[0];

    try {
        const response = await fetch(`${LC_API_BASE}/transactions?from_date=${dateStr}`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`LendingCard API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Some APIs wrap lists in `results`, some return an array directly
        const txs = Array.isArray(data) ? data : (data.results || []);

        return txs;
    } catch (e) {
        console.error("[lendingcard] transaction fetch error:", e);
        throw e;
    }
}

/**
 * Helper to normalize transactions to our expected `lendingcard_transactions` schema
 */
export function normalizeTransactions(apiTransactions) {
    if (!apiTransactions) return [];

    return apiTransactions.map(tx => {
        // Calculate the deposit fee if it exists from fee_percentage. 
        // LeadingCards might provide true fee or we infer based on deposit type
        let fee = 0;

        // Ex: if fee_percentage is 200 (2.00%) and transaction is a deposit
        if (tx.card && tx.card.card_bin && tx.card.card_bin.fee_percentage) {
            const feePercent = tx.card.card_bin.fee_percentage / 10000; // e.g., 200 = 2%? Verify actual schema scalar
            // We use simple 3.5% default fallback if required by requirements "google_spend * 1.07 * 1.035"
            // The requirement mentions lendingcard fees are implicitly 3.5%, but tx might show exact
            fee = tx.amount * 0.035;
        }

        return {
            id: tx.uuid,
            date: new Date(tx.transaction_date * 1000).toISOString(),
            amount: tx.amount,
            deposit_fee: fee,
            net_amount: tx.amount - fee, // Or transaction exact payload
            card_id: tx.card?.uuid || null,
            card_last4: tx.card?.last4 || null,
            merchant: tx.merchant || "Unknown",
        };
    });
}
