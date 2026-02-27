import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// TrackingDashboard data embedded as JSON
const data = JSON.parse(readFileSync(join(__dirname, 'tracking-dashboard-data.json'), 'utf8'));

// Write the component
writeFileSync(
  join(__dirname, 'src', 'components', 'TrackingDashboard.jsx'),
  data.content
);
console.log('✅ TrackingDashboard.jsx written');

// Patch Sidebar - add tracking nav item
const sidebarPath = join(__dirname, 'src', 'components', 'Sidebar.jsx');
let sidebar = readFileSync(sidebarPath, 'utf8');
if (!sidebar.includes('"tracking"')) {
  sidebar = sidebar.replace(
    '{ id: "error-log", icon: "🐛", label: "Error Log" }',
    '{ id: "tracking", icon: "🔬", label: "Tracking Test" },\n        { id: "error-log", icon: "🐛", label: "Error Log" }'
  );
  writeFileSync(sidebarPath, sidebar);
  console.log('✅ Sidebar.jsx patched');
} else {
  console.log('ℹ️ Sidebar.jsx already has tracking nav');
}

// Patch App.jsx - add tracking page
const appPath = join(__dirname, 'src', 'App.jsx');
let app = readFileSync(appPath, 'utf8');

if (!app.includes('TrackingDashboard')) {
  // Add import
  app = app.replace(
    'import { AccountMap } from "./components/AccountMap";',
    'import { AccountMap } from "./components/AccountMap";\nimport { TrackingDashboard } from "./components/TrackingDashboard";'
  );
  
  // Add page routing
  app = app.replace(
    '{page === "error-log" && <ErrorLog />}',
    '{page === "tracking" && <TrackingDashboard settings={settings} sites={sites} />}\n          {page === "error-log" && <ErrorLog />}'
  );
  
  writeFileSync(appPath, app);
  console.log('✅ App.jsx patched');
} else {
  console.log('ℹ️ App.jsx already has TrackingDashboard');
}

console.log('\n🎉 Done! Restart dev server: npm run dev');
