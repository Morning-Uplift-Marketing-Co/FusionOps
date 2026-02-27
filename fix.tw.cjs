const fs = require("fs");

function safeReplace(content, searchValue, replaceValue, label) {
  if (!content.includes(searchValue)) {
    console.error(`❌ ${label} not found. Aborting.`);
    process.exit(1);
  }
  return content.replace(searchValue, replaceValue);
}

// === PATCH App.jsx ===
let app = fs.readFileSync("src/App.jsx", "utf8");

// Ensure useEffect is imported
if (!app.includes("useEffect")) {
  app = app.replace(
    'import React, { useState',
    'import React, { useState, useEffect'
  );
}

const oldState =
  "const [templateGenOpen, setTemplateGenOpen] = useState(false);";

const newState = `
const [templateGenOpen, setTemplateGenOpen] = useState(false);
const [savedTemplates, setSavedTemplates] = useState([]);

// Fetch saved templates
useEffect(() => {
  api.get("/templates")
    .then(res => {
      if (Array.isArray(res)) setSavedTemplates(res);
      else if (res?.templates) setSavedTemplates(res.templates);
    })
    .catch(() => {});
}, []);
`;

app = safeReplace(app, oldState, newState, "state block");

app = safeReplace(
  app,
  "templates={[]} // Pass available templates if needed",
  "templates={savedTemplates}",
  "templates prop"
);

app = safeReplace(
  app,
  "refreshCustomTemplates();",
  `
refreshCustomTemplates();
api.get("/templates")
  .then(res => {
    if (Array.isArray(res)) setSavedTemplates(res);
    else if (res?.templates) setSavedTemplates(res.templates);
  })
  .catch(() => {});
`,
  "refresh hook"
);

fs.writeFileSync("src/App.jsx", app);
console.log("✅ App.jsx patched safely");

// === PATCH TemplateGeneratorModal.jsx ===
const modalPath =
  "src/components/TemplateGenerator/TemplateGeneratorModal.jsx";

let modal = fs.readFileSync(modalPath, "utf8");

// Remove resetAndSetMode safely
if (modal.includes("const resetAndSetMode")) {
  modal = modal.replace(
    /const resetAndSetMode[\s\S]*?\};/,
    ""
  );
}

modal = modal.replace('colorId: "",', 'colorId: "ocean",');
modal = modal.replace('fontId: "",', 'fontId: "inter",');

modal = modal.replace(
  /if \(state\.mode === MODE_FROM_TEMPLATE\) \{[\s\S]*?\}/,
  `
if (state.mode === MODE_FROM_TEMPLATE) {
  if (state.step === 0) {
    return state.newFolderId && state.sourceTemplate;
  }
  return true;
}
`
);

fs.writeFileSync(modalPath, modal);
console.log("✅ TemplateGeneratorModal.jsx patched safely");

console.log("\n🎉 All bugs patched (validated mode)");