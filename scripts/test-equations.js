// test-equations.js

function calculateTrueCost(googleSpend) {
    // True Cost = google_spend * 1.07 (VAT) * 1.035 (LC Fee)
    const vatMultiplier = 1.07;
    const lcFeeMultiplier = 1.035;

    // In our requirement:
    // "True Cost = google_spend * 1.07 * 1.035"
    return googleSpend * vatMultiplier * lcFeeMultiplier;
}

function calculateTrueROI(revenue, trueCost) {
    // True ROI = ((revenue - trueCost) / trueCost) * 100
    if (trueCost === 0) return 0;
    return ((revenue - trueCost) / trueCost) * 100;
}

// Case 1
const spend1 = 1000;
const rev1 = 2000;
const tc1 = calculateTrueCost(spend1);
const roi1 = calculateTrueROI(rev1, tc1);

console.log(`--- Test Case 1 ---`);
console.log(`Google Spend: $${spend1}`);
console.log(`True Cost:   $${tc1.toFixed(2)}`);
console.log(`Revenue:     $${rev1}`);
console.log(`True ROI:    ${roi1.toFixed(2)}%`);

// Case 2
const spend2 = 450;
const rev2 = 1000;
const tc2 = calculateTrueCost(spend2);
const roi2 = calculateTrueROI(rev2, tc2);

console.log(`\n--- Test Case 2 ---`);
console.log(`Google Spend: $${spend2}`);
console.log(`True Cost:   $${tc2.toFixed(2)}`);
console.log(`Revenue:     $${rev2}`);
console.log(`True ROI:    ${roi2.toFixed(2)}%`);
