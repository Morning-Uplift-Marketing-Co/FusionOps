// Auto-copy script: run with node to copy TrackingDashboard.jsx
import { readFileSync, writeFileSync } from 'fs';
const src = process.argv[2] || 'TrackingDashboard-source.jsx'; 
const dst = 'src/components/TrackingDashboard.jsx';
writeFileSync(dst, readFileSync(src));
console.log(`Copied ${src} → ${dst}`);
