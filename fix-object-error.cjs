const fs = require("fs");

// === FIX 1: voluum.js — ensure error is always string ===
const vPath = "src/services/voluum.js";
let v = fs.readFileSync(vPath, "utf8");

// Fix voluumProxy error handling
v = v.replace(
  'throw new Error(data.message || data.error || `Voluum API ${data._status}`);',
  'throw new Error(typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : JSON.stringify(data.error || data.message || `Voluum API ${data._status}`));'
);

// Fix createCampaign error handling  
v = v.replace(
  'throw new Error(data?.message || data?.error || "Failed to create campaign");',
  'throw new Error(typeof data?.message === "string" ? data.message : typeof data?.error === "string" ? data.error : JSON.stringify(data?.error || data?.message || "Failed to create campaign"));'
);

fs.writeFileSync(vPath, v, "utf8");
console.log("✅ voluum.js — error messages now always string");

// === FIX 2: StepTracking.jsx — defensive createError rendering ===
const sPath = "src/components/Wizard/StepTracking.jsx";
let s = fs.readFileSync(sPath, "utf8");

// Fix setCreateError catch to always stringify
s = s.replace(
  'setCreateError(e.message || "Failed to create campaign");',
  'setCreateError(typeof e?.message === "string" ? e.message : typeof e === "string" ? e : JSON.stringify(e) || "Failed to create campaign");'
);

// Fix setError catch to always stringify  
s = s.replace(
  '.catch(e => setError(e.message || "Failed to authenticate or fetch campaigns"))',
  '.catch(e => setError(typeof e?.message === "string" ? e.message : typeof e === "string" ? e : "Failed to authenticate or fetch campaigns"))'
);

fs.writeFileSync(sPath, s, "utf8");
console.log("✅ StepTracking.jsx — error display always string");

console.log("\n🎉 [object Object] bug fixed!");
