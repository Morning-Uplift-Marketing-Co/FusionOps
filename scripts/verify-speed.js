
import fs from 'fs';
import path from 'path';

const lpGeneratorPath = 'src/utils/lp-generator.js';
const content = fs.readFileSync(lpGeneratorPath, 'utf8');

console.log("--- Verifying lp-generator.js Optimizations ---");

const checks = [
    {
        name: "Font Preconnect Hints",
        pass: content.includes('preconnect') && content.includes('fonts.gstatic.com')
    },
    {
        name: "Non-blocking CSS (media=print)",
        pass: content.includes('media="print"') && content.includes('this.media=\'all\'')
    },
    {
        name: "Minified CSS Block",
        pass: content.includes('.hero{padding:80px 0 40px;') || content.includes('*{margin:0;padding:0')
    },
    {
        name: "Minified JS Block",
        pass: content.includes('Slider a11y') && !content.includes('  // Slider a11y')
    }
];

console.log("\nVerification Results:");
let allPass = true;
checks.forEach(c => {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`);
    if (!c.pass) allPass = false;
});

if (allPass) {
    console.log("\nAll internal verification checks passed!");
    process.exit(0);
} else {
    console.log("\nSome verification checks failed.");
    process.exit(1);
}

