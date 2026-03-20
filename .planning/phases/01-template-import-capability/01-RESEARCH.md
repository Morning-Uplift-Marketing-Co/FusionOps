# Phase 1: Template Import Fix & Capability Detection - Research

**Researched:** 2026-03-20
**Domain:** Template import pipeline + capability detection framework for dynamic wizard adaptation
**Confidence:** HIGH (existing codebase analysis + documented issues + architectural patterns)

## Summary

Phase 1 addresses two interrelated blockers in the landing page factory:

1. **Critical bug:** Astro `PUBLIC_*` environment variables created in `.env` are never injected at build time, causing deployed pages to show placeholder expressions instead of customized values (brand name, conversion IDs, tracking domains).

2. **Foundation gap:** Imported templates (from Bolt.new, Loveable) have unpredictable structures and capabilities. The wizard currently assumes all templates support the same features (calculators, section reordering, form customization), creating mismatches between what the wizard offers and what the template actually supports.

**Primary recommendation:** Implement two-phase solution: (1) Fix env var injection via preprocessing + post-build rewriting, (2) Build capability detection framework with auto-detect + manifest override pattern.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IMPORT-01 | Imported Astro templates receive `PUBLIC_*` env vars at build time (no fallback values in output) | Env preprocessing strategy + Cloudflare build context integration documented below |
| IMPORT-02 | Post-build HTML rewriting replaces any leaked `import.meta.env` expressions with configured values | HTML transformer component with regex/DOM parser strategy outlined |
| IMPORT-03 | Template structure normalized after import (detect entry point, validate package.json, fix paths) | Entry point resolution + structure normalization patterns from template-analyzer.js |
| CAPAB-01 | Auto-detect template capabilities by scanning source (calculator, forms, tracking, color themes, sections) | Scoring-based detection extension strategy; sample patterns identified |
| CAPAB-02 | `.lp-manifest.json` schema allows templates to explicitly declare supported capabilities | Schema design + manifest loader implementation approach specified |
| CAPAB-03 | Wizard dynamically shows/hides steps based on detected + manifest capabilities | CapabilityResolver component bridges detection + manifest; wizard step mapping pattern |
| CAPAB-04 | Wizard gracefully degrades when template lacks a feature (skip step, show warning, don't break) | Conservative defaults strategy + preview validation approach |
| CAPAB-05 | CapabilityResolver merges auto-detect + manifest with confidence scoring | Multi-level resolution strategy with confidence thresholds outlined |

---

## Standard Stack

### Core Libraries (Verified Current Versions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Astro | 5.18.0+ | SSG framework, template compilation, build orchestration | Primary template format; handles multi-format static output generation |
| React | 19.2.0+ | UI components, dashboard, wizard, preview modal | Dashboard and wizard UI; integrates seamlessly with Astro |
| Vite | (implicit via Astro 5) | Build tool, development server, plugin system | Astro uses Vite internally; enables custom plugins for future anti-fingerprinting |
| Tailwind CSS | 4.2.0+ | Utility CSS framework | All templates standardized on Tailwind; works with CDN injection for preview |
| Node.js | 18+ (20 LTS recommended) | Runtime for build scripts, CLI tools | Required for `npm ci`, async/await, crypto.subtle (future fingerprinting) |
| jszip | 3.10.1+ | ZIP file parsing for template imports | Handles template import from user uploads; file map abstraction layer |

### Supporting Libraries (No Changes Needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|------------|
| dotenv | 17.3.1+ | Environment variable loading | Local dev; `.env` file management in generated projects |
| @neondatabase/serverless | 1.0.2+ | PostgreSQL queries from Workers | Database operations (site config, site lookup) |
| @sentry/react | 10.40.0+ | Error tracking, performance monitoring | Production error reporting (minimal for Phase 1) |
| tailwind-merge | 3.5.0+ | Merge Tailwind class names | Dynamic class composition in components |

### Installation (Phase 1)

**No new dependencies required.** All tools already in package.json. Verify:

```bash
npm list astro react vite tailwindcss jszip dotenv
# Confirm: astro ^5.2.0, react ^19, vite (implicit), tailwindcss ^4.0, jszip 3.10.1+
```

---

## Architecture Patterns

### Pattern 1: Multi-Level Environment Variable Injection

**Goal:** Ensure Astro `import.meta.env.PUBLIC_*` references are replaced with actual values at deploy time.

**Current State:**
- `astro-generator.jsx` creates `.env` file with `PUBLIC_SITE_NAME`, `PUBLIC_CONVERSION_ID`, etc.
- `.env` is bundled with template files but never read by Astro build process
- Deployed pages show expressions like `import.meta.env.PUBLIC_SITE_NAME || ""` instead of actual values

**Recommended Approach (Two-Stage):**

#### Stage 1: Pre-Build Preprocessing
Before running `astro build`, scan `.astro` files and replace env references with hardcoded values:

```javascript
// src/utils/astro-preprocessor.js
export function preprocessAstroTemplate(files, envVars) {
  const processed = { ...files };

  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith('.astro')) continue;

    // Replace: import.meta.env.PUBLIC_VAR → 'actual-value'
    let updated = content.replace(
      /import\.meta\.env\.PUBLIC_(\w+)(?:\s*\|\|\s*['"]([^'"]*)['"'])?/g,
      (match, varName, fallback) => {
        const value = envVars[`PUBLIC_${varName}`] || fallback || '';
        return `'${escapeString(value)}'`;
      }
    );

    processed[path] = updated;
  }

  return processed;
}
```

**When:** Immediately after template files are extracted but before `astro build` runs.

**Where:** In `FormatBuilder.buildAstro()` adapter (Phase 2) or in deploy script before build.

#### Stage 2: Post-Build HTML Rewriting
After build, scan HTML output and replace any remaining leaked expressions:

```javascript
// src/utils/html-expression-replacer.js
export function replaceLeakedExpressions(html, envVars) {
  let result = html;

  // Catch: import.meta.env.PUBLIC_* expressions in script content
  result = result.replace(
    /import\.meta\.env\.PUBLIC_(\w+)(?:\s*\|\|\s*['"]([^'"]*)['"'])?/g,
    (match, varName, fallback) => {
      const value = envVars[`PUBLIC_${varName}`] || fallback || '';
      return `'${escapeString(value)}'`;
    }
  );

  // Catch: Unquoted template literals ${import.meta.env.PUBLIC_*}
  result = result.replace(
    /\$\{import\.meta\.env\.PUBLIC_(\w+)(?:\s*\|\|\s*['"]([^'"]*)['"'])?\}/g,
    (match, varName, fallback) => {
      const value = envVars[`PUBLIC_${varName}`] || fallback || '';
      return `${value}`;
    }
  );

  return result;
}
```

**When:** After format-specific build completes (Astro, Vite, static HTML).

**Why Two-Stage:** Vite/React templates may also use env vars in JavaScript; post-build catch ensures all cases are covered regardless of framework.

**Detection:** Quality checks verify no `import.meta.env` expressions remain in final HTML (IMPORT-02 requirement).

### Pattern 2: Capability-Aware Template Manifest

**Goal:** Establish explicit contract between template (what features it supports) and wizard (what options to show).

**Schema Design:**

```json
{
  "id": "inbox-zero-clone",
  "name": "Inbox Zero Landing Page",
  "version": "1.0.0",
  "entry": "src/pages/index.astro",
  "capabilities": {
    "supportsCalculator": {
      "autoDetected": false,
      "value": false,
      "confidence": 1.0,
      "reason": "No calculator component in source"
    },
    "supportsSectionReorder": {
      "autoDetected": false,
      "value": false,
      "confidence": 1.0,
      "reason": "Layout is fixed-structure with hardcoded sections"
    },
    "supportsFormCustomization": {
      "autoDetected": true,
      "value": true,
      "confidence": 0.85,
      "reason": "Found <form> element with input fields"
    },
    "supportsCustomColors": {
      "autoDetected": true,
      "value": true,
      "confidence": 0.90,
      "reason": "CSS custom properties detected in styles"
    },
    "supportsImageUpload": {
      "autoDetected": false,
      "value": false,
      "confidence": 1.0,
      "reason": "No image upload component found"
    }
  },
  "requiredSections": ["hero", "form", "footer"],
  "variables": {
    "brand": {
      "type": "text",
      "label": "Brand Name",
      "required": true,
      "default": "Your Company"
    },
    "h1": {
      "type": "textarea",
      "label": "Headline",
      "required": true,
      "default": "Your Headline Here"
    },
    "primaryColor": {
      "type": "color",
      "label": "Primary Color",
      "required": false,
      "default": "#3b82f6"
    }
  }
}
```

**Location:** `.lp-manifest.json` in template root (same level as `package.json`/`astro.config.mjs`).

**Loader:**

```javascript
// src/utils/manifest-loader.js
export function loadManifest(files) {
  const raw = findFileContent(files, '.lp-manifest.json');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    validateManifestSchema(parsed); // Strict validation
    return parsed;
  } catch (e) {
    console.error('Invalid manifest:', e);
    return null;
  }
}
```

**Priority:** Manifest always wins over auto-detection. If manifest exists, use it exclusively (auto-detect is fallback only).

### Pattern 3: Multi-Level Capability Detection

**Goal:** Balance confidence: auto-detect for unknown templates, manifest for known ones, user override for edge cases.

**Detection Strategy:**

#### Level 1: Template Manifest (Highest Confidence)
- If `.lp-manifest.json` exists and is valid, use it exclusively
- Confidence: 1.0 (explicit declaration)
- Cost: Requires template author to maintain manifest

#### Level 2: Code Inspection (Medium Confidence)
- Scan template source for feature patterns
- Extend existing `template-analyzer.js` with capability signals
- Example signals for calculator detection:
  ```javascript
  const calculatorSignals = [
    { test: (files) => hasComponentNamed(files, 'Calculator'), weight: 0.35 },
    { test: (files) => findInFiles(files, /range|slider|input.*type.*number/i), weight: 0.25 },
    { test: (files) => findInFiles(files, /Math\.(min|max|pow|sqrt)/), weight: 0.20 },
    { test: (files) => findInFiles(files, /\$\{.*amount.*\}/), weight: 0.15 },
    { test: (files) => findInFiles(files, /amountMin|amountMax|loanAmount/i), weight: 0.10 },
  ];
  ```
- Confidence: 0.60–0.95 depending on signal strength
- Cost: No manifest maintenance required

#### Level 3: User Override (User Confidence)
- After auto-detection, allow user to correct false positives/negatives
- UI: Checkbox in Step 2 of wizard: "Does this template support [feature]?"
- Store override in deploy config; ignore auto-detect for future deploys of same template
- Confidence: 1.0 (user explicitly confirmed)
- Cost: One-time per template

**CapabilityResolver Implementation:**

```javascript
// src/utils/capability-resolver.js
export function resolveCapabilities(files, manifest, userOverride = {}) {
  let capabilities = {};

  // Start with manifest or auto-detect
  if (manifest?.capabilities) {
    capabilities = manifest.capabilities;
  } else {
    capabilities = autoDetectCapabilities(files);
  }

  // Apply user overrides
  for (const [key, value] of Object.entries(userOverride)) {
    if (capabilities[key]) {
      capabilities[key].value = value;
      capabilities[key].autoDetected = false;
      capabilities[key].confidence = 1.0;
    }
  }

  return capabilities;
}

function autoDetectCapabilities(files) {
  return {
    supportsCalculator: scoreCapability(files, calculatorSignals),
    supportsSectionReorder: scoreCapability(files, reorderSignals),
    supportsFormCustomization: scoreCapability(files, formSignals),
    supportsCustomColors: scoreCapability(files, colorSignals),
    supportsImageUpload: scoreCapability(files, imageSignals),
  };
}

function scoreCapability(files, signals) {
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const signal of signals) {
    totalWeight += signal.weight;
    if (signal.test(files)) {
      matchedWeight += signal.weight;
    }
  }

  const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;

  return {
    value: confidence >= 0.65, // Conservative threshold
    confidence,
    autoDetected: true,
    reason: `Auto-detected with ${(confidence * 100).toFixed(0)}% confidence`
  };
}
```

**Decision:** Use manifest if available; fall back to auto-detect with confidence score; allow user override.

### Pattern 4: Template Structure Normalization

**Goal:** Ensure imported templates have predictable, standard directory structure.

**Normalization Steps:**

After importing template ZIP, run:

```javascript
// src/utils/template-normalizer.js
export async function normalizeTemplate(files) {
  const normalized = { ...files };

  // Step 1: Move files to standard locations
  // If src/ doesn't exist, move pages/ → src/pages/, components/ → src/components/
  if (!hasDirectory(normalized, 'src')) {
    const moved = {};
    for (const [path, content] of Object.entries(normalized)) {
      if (path.startsWith('pages/')) {
        moved[`src/${path}`] = content;
      } else if (path.startsWith('components/')) {
        moved[`src/${path}`] = content;
      } else {
        moved[path] = content;
      }
    }
    Object.assign(normalized, moved);
    // Remove old paths
    for (const path of Object.keys(normalized)) {
      if (!path.startsWith('src') && (path.startsWith('pages/') || path.startsWith('components/'))) {
        delete normalized[path];
      }
    }
  }

  // Step 2: Ensure required config files exist
  if (!normalized['astro.config.mjs'] && normalized['package.json']?.includes('astro')) {
    normalized['astro.config.mjs'] = generateDefaultAstroConfig();
  }
  if (!normalized['tsconfig.json']) {
    normalized['tsconfig.json'] = generateDefaultTsconfig();
  }

  // Step 3: Fix relative import paths if needed
  // (only if structure was moved; validate with astro check)

  return normalized;
}
```

**Validation:** After normalization, run `astro check` (or equivalent) to verify structure is valid.

**When:** Immediately after ZIP import, before preview generation.

### Pattern 5: Wizard Step Mapping to Capabilities

**Goal:** Enable/disable wizard steps based on what template actually supports.

**Current Wizard Steps:**
1. Step 1 — Template Selection (required)
2. Step 2 — Product/Type (conditional: only if template supports type selector)
3. Step 3 — Brand (colors, fonts, company name) (required; always shown)
4. Step 4 — Copy (h1, subheading, CTA) (required; always shown)
5. Step 5 — Design (section reorder, calculator settings) (conditional: based on capabilities)
6. Step 6 — Tracking (conversion pixel, form action) (required; always shown)
7. Step 7 — Review (preview, deploy) (required; always shown)

**Mapping Logic:**

```javascript
// src/components/Wizard/step-mapper.js
export function getEnabledSteps(capabilities) {
  return {
    templateSelection: true,
    productType: capabilities.supportsFormCustomization?.value || false,
    brand: true,
    copy: true,
    design: {
      sectionReorder: capabilities.supportsSectionReorder?.value || false,
      calculator: capabilities.supportsCalculator?.value || false,
      colorOverride: capabilities.supportsCustomColors?.value || true, // Default true
    },
    tracking: true,
    review: true,
  };
}

export function renderWizardSteps(enabledSteps, template) {
  return [
    { id: 'template', Component: StepTemplate, required: true },
    { id: 'product', Component: StepProductType, required: false, hidden: !enabledSteps.productType },
    { id: 'brand', Component: StepBrand, required: true },
    { id: 'copy', Component: StepCopy, required: true },
    { id: 'design', Component: StepDesign, required: false, fields: enabledSteps.design },
    { id: 'tracking', Component: StepTracking, required: true },
    { id: 'review', Component: StepReview, required: true },
  ];
}
```

**UI Pattern:** Hidden steps are skipped in wizard navigation; warnings show if template lacks detected features.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|------------|-----|
| Template format detection | Custom format checker | `template-analyzer.js` (existing) | Already battle-tested on 15+ imported templates; scoring-based, handles ambiguity |
| ZIP file parsing | Manual file extraction | jszip library (3.10.1+) | Handles edge cases (compression, encoding); battle-tested; integrates with wizard import UI |
| Astro build orchestration | Custom build script | Astro CLI (`astro build`) + adapters | Official tool handles version-specific behavior; integrates with astro.config.mjs |
| HTML/CSS parsing for post-build rewriting | Regex-only string replacement | DOM parser (cheerio/jsdom) for complex cases | Regex works for simple replacements but fails on nested structures, attributes, edge cases |
| Environment variable injection | Manual string templating | Preprocessing (code transformation) + post-build rewriting | Targeted, predictable, handles Astro-specific syntax |
| Template preview rendering | Build-and-serve preview | iframe srcDoc injection (existing template-preview-runtime.js) | Avoids build step bottleneck; CDN injection for dependencies; unbuilt templates show placeholder |
| Dependency detection | Hardcoded lib list | Pattern-based scanning + `package.json` inspection | Handles unknown/new libraries; extensible; works with any template |

**Key insight:** Astro and template import systems are complex; use existing libraries and official tools. Focus custom work on: capability detection (domain-specific), environment variable handling (Astro-specific), and wizard integration (UI-specific).

---

## Common Pitfalls

### Pitfall 1: Astro `import.meta.env.PUBLIC_*` Not Injected at Build Time

**What goes wrong:**
Astro templates reference `import.meta.env.PUBLIC_SITE_NAME` (or fallback: `import.meta.env.PUBLIC_SITE_NAME || "default"`). The `.env` file is created with values, but Astro build doesn't read `.env` files automatically — it only injects variables if they're in the Node process environment during build.

Result: Deployed pages show expressions like `"${companyName}"` or `import.meta.env.PUBLIC_*` instead of actual values.

**Root cause:**
- `.env` files are for local dev, not build-time injection
- Astro build process must have variables in `process.env` at compile time
- Imported templates don't have a setup step that loads `.env` before build

**How to avoid:**
1. **Preprocess .astro files** before build: Replace all `import.meta.env.PUBLIC_X` with hardcoded values using regex
2. **Verify with quality checks** after build: Scan HTML for leaked `import.meta.env` expressions
3. **Test locally first:** Generate a test template, build it, inspect output HTML for actual values (not expressions)
4. **Document in template manifest:** Declare which `PUBLIC_*` variables the template needs (e.g., `PUBLIC_CONVERSION_ID`, `PUBLIC_BRAND`)

**Warning signs:**
- Deployed page source shows `import.meta.env.PUBLIC_CONVERSION_ID` expressions
- Voluum pixel doesn't fire (domain undefined)
- Google Ads conversion tracking incomplete (conversion ID unset)
- Quality checks report "Astro expression leak" in final HTML

---

### Pitfall 2: Capability Detection False Positives/Negatives

**What goes wrong:**
Auto-detection incorrectly identifies features:
- **False positive:** Template appears to have a calculator because it has `<input type="range">` (actually just a styling demo)
  - → Wizard shows "Configure calculator" step
  - → User configures rates, min/max amounts
  - → Deployed page ignores config, shows hardcoded placeholder calculator
- **False negative:** Template has calculator but detection misses it
  - → Wizard skips "Calculator" step
  - → User can't customize calculator settings
  - → Deployed calculator uses wrong interest rates, amounts

**Root cause:**
- Scoring-based detection is probabilistic, not deterministic
- Pattern matching can't reliably distinguish intent (e.g., `<input>` could be calculator or form field)
- Template structure variance (component names, file organization) makes pattern matching fragile
- Confidence scores are heuristic; no validation step

**How to avoid:**
1. **Manifest is source of truth:** Require explicit `.lp-manifest.json` for known templates
2. **Conservative auto-detect:** If detection confidence < 0.7, disable the feature by default
3. **User override step:** Add Step 2 checkbox in wizard: "I know this template supports: [feature list]"
4. **Preview validation:** When user configures a feature, preview it immediately; show warning if preview looks wrong
5. **Start simple:** Phase 1 detects only high-confidence features; leave edge cases to Phase 2

**Warning signs:**
- User reports "I set custom colors but they didn't apply"
- Wizard shows "Calculator settings" but deployed template has no calculator
- Template detection shows confidence < 0.6 for key capabilities

**Testing approach:**
- Test detector on 10+ sample templates (Bolt, Loveable, v0)
- Manually verify each capability (calculator, colors, sections)
- Measure false positive rate (acceptable: <5%)
- Document override cases in manifest

---

### Pitfall 3: Imported Template Structure Breaks Assumptions

**What goes wrong:**
Imported templates have inconsistent directory structure:
- Bolt.new exports: `src/pages/index.astro`, `src/components/`, `astro.config.mjs`
- Loveable exports: `pages/index.astro` (no src/), `components/`, `package.json` only
- v0 exports: `index.html` at root, `components/` at root

When wizard assumes `src/pages/index.astro`, it fails for Loveable (which has `pages/index.astro`).

Result: Preview can't find entry point, build fails with "module not found" errors.

**Root cause:**
- Different template generators use different conventions
- No normalization step after import
- Entry point resolver stops at first match instead of ranking all candidates

**How to avoid:**
1. **Normalize after import:** Move files to standard structure (`src/pages/`, `src/components/`)
2. **All-candidates entry resolution:** Find all possible entry points, rank by confidence, return best match
3. **Validate structure:** Run `astro check` or equivalent after normalization; reject if validation fails
4. **Test on diverse templates:** Ensure import/normalize/build pipeline works for Bolt, Loveable, v0, manual HTML

**Warning signs:**
- Preview shows "No entry point found" despite HTML files in template
- Build fails: "Cannot find module" for relative imports
- Same template works when imported via Bolt but fails via Loveable

**Detection:**
- Template analyzer logs all entry point candidates + scores
- Quality checks verify structure is valid before saving template

---

### Pitfall 4: Manifest Not Found or Outdated

**What goes wrong:**
Manifest file exists but is missing from imported ZIP, or manifest is outdated (template changed, manifest didn't).

Result: Wizard shows wrong steps; capabilities are inaccurate.

**How to avoid:**
1. **Detect manifest early:** Load manifest immediately after import; log if missing
2. **Store manifest in DB:** Save `.lp-manifest.json` alongside template files; don't rely on re-importing it
3. **Allow user override:** UI option to re-generate capability manifest from template source
4. **Validate manifest schema:** Reject malformed manifests; show error to user

**Warning signs:**
- Manifest file is 0 bytes or missing from imported template
- Manifest created date is older than template source files
- User can't override auto-detected capabilities

---

## Code Examples

### Example 1: Env Var Preprocessing (IMPORT-01)

```javascript
// src/utils/env-preprocessor.js
/**
 * Replace Astro import.meta.env references with hardcoded values
 * Handles both with and without fallback:
 *   import.meta.env.PUBLIC_X || "fallback"
 *   import.meta.env.PUBLIC_X
 */
export function preprocessAstroEnvVars(files, envVars) {
  const processed = { ...files };

  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith('.astro')) continue;

    let updated = content;

    // Pattern: import.meta.env.PUBLIC_VAR || 'fallback'
    // Replacement: 'actual-value'
    updated = updated.replace(
      /import\.meta\.env\.(PUBLIC_\w+)\s*\|\|\s*(['"`])([^'">`]*)\2/g,
      (match, varName, quote, fallback) => {
        const value = envVars[varName] || fallback || '';
        return `${quote}${escapeString(value)}${quote}`;
      }
    );

    // Pattern: import.meta.env.PUBLIC_VAR (no fallback)
    // Replacement: 'value-or-empty'
    updated = updated.replace(
      /import\.meta\.env\.(PUBLIC_\w+)(?!\s*\|\|)/g,
      (match, varName) => {
        const value = envVars[varName] || '';
        return `'${escapeString(value)}'`;
      }
    );

    processed[path] = updated;
  }

  return processed;
}

function escapeString(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}
```

**Usage in build adapter:**
```javascript
// src/adapters/build-astro.js
export async function buildAstro(files, envVars, workDir) {
  // 1. Preprocess .astro files
  const preprocessed = preprocessAstroEnvVars(files, envVars);

  // 2. Write to temp directory
  await writeFilesSync(workDir, preprocessed);

  // 3. Install + build
  await execSync('npm ci', { cwd: workDir });
  await execSync('npm run build', { cwd: workDir });

  // 4. Return path to dist/
  return path.join(workDir, 'dist');
}
```

**Test:**
```javascript
test('preprocesses import.meta.env.PUBLIC_* with fallback', () => {
  const files = {
    'src/pages/index.astro':
      'const name = import.meta.env.PUBLIC_BRAND || "MyBrand";'
  };
  const env = { PUBLIC_BRAND: 'LoanCorp' };
  const result = preprocessAstroEnvVars(files, env);
  expect(result['src/pages/index.astro']).toContain("const name = 'LoanCorp';");
});
```

---

### Example 2: Capability Manifest Schema & Loader (CAPAB-02)

```json
{
  "id": "template-id",
  "name": "Template Display Name",
  "version": "1.0.0",
  "entry": "src/pages/index.astro",
  "description": "Brief template description",
  "capabilities": {
    "supportsCalculator": {
      "value": true,
      "confidence": 1.0,
      "reason": "Explicit: User-declared in manifest"
    },
    "supportsSectionReorder": {
      "value": false,
      "confidence": 1.0,
      "reason": "Layout is fixed with hardcoded sections"
    },
    "supportsFormCustomization": {
      "value": true,
      "confidence": 1.0,
      "reason": "Form fields are configurable via props"
    },
    "supportsCustomColors": {
      "value": true,
      "confidence": 1.0,
      "reason": "Uses CSS custom properties for theming"
    },
    "supportsImageUpload": {
      "value": false,
      "confidence": 1.0,
      "reason": "Images are hardcoded; no upload component"
    }
  },
  "requiredSections": ["hero", "form", "footer"],
  "variables": {
    "brand": {
      "type": "text",
      "label": "Brand Name",
      "required": true,
      "example": "LoanCorp"
    },
    "h1": {
      "type": "textarea",
      "label": "Headline",
      "required": true,
      "example": "Get a Personal Loan Today"
    },
    "primaryColor": {
      "type": "color",
      "label": "Primary Brand Color",
      "required": false,
      "example": "#3b82f6"
    }
  },
  "estimatedBuildTime": 45,
  "estimatedPreviewTime": 3,
  "notes": "This template includes a mortgage calculator. Customize amounts in Design step."
}
```

**Loader with validation:**
```javascript
// src/utils/manifest-loader.js
export function loadAndValidateManifest(files) {
  const raw = findFileContent(files, '.lp-manifest.json');
  if (!raw) return { manifest: null, valid: true };

  try {
    const parsed = JSON.parse(raw);

    // Validate required fields
    if (!parsed.id || !parsed.name) {
      return {
        manifest: null,
        valid: false,
        error: 'Manifest must have "id" and "name" fields'
      };
    }

    // Validate capabilities object
    if (!parsed.capabilities || typeof parsed.capabilities !== 'object') {
      return {
        manifest: null,
        valid: false,
        error: 'Manifest must have "capabilities" object'
      };
    }

    // Validate each capability has value + confidence
    for (const [key, cap] of Object.entries(parsed.capabilities)) {
      if (typeof cap.value !== 'boolean' || typeof cap.confidence !== 'number') {
        return {
          manifest: null,
          valid: false,
          error: `Capability "${key}" must have boolean "value" and numeric "confidence"`
        };
      }
    }

    return { manifest: parsed, valid: true };
  } catch (e) {
    return {
      manifest: null,
      valid: false,
      error: `Invalid JSON in manifest: ${e.message}`
    };
  }
}
```

---

### Example 3: CapabilityResolver (CAPAB-05)

```javascript
// src/utils/capability-resolver.js
export function resolveCapabilities(files, manifest, userOverride = {}) {
  let capabilities = {};

  // Level 1: Manifest (if available and valid)
  if (manifest?.capabilities) {
    capabilities = manifest.capabilities;
  } else {
    // Level 2: Auto-detect
    capabilities = autoDetectCapabilities(files);
  }

  // Level 3: User override (merges into capabilities)
  for (const [key, userValue] of Object.entries(userOverride)) {
    if (capabilities[key]) {
      capabilities[key] = {
        ...capabilities[key],
        value: userValue,
        confidence: 1.0,
        reason: 'User-overridden in wizard'
      };
    }
  }

  return capabilities;
}

function autoDetectCapabilities(files) {
  const SIGNALS = {
    supportsCalculator: [
      { test: (f) => hasComponentNamed(f, 'Calculator'), weight: 0.40, desc: 'Calculator component' },
      { test: (f) => findInFiles(f, /input.*type.*range/i), weight: 0.25, desc: 'Range input' },
      { test: (f) => findInFiles(f, /Math\.(min|max|pow)/), weight: 0.20, desc: 'Math calculations' },
      { test: (f) => findInFiles(f, /amountMin|amountMax|loanAmount/i), weight: 0.15 }
    ],
    supportsSectionReorder: [
      { test: (f) => countMatches(f, /<section/i) > 3, weight: 0.35, desc: 'Multiple sections' },
      { test: (f) => findInFiles(f, /\[...sections\]/), weight: 0.30, desc: 'Dynamic section spreading' },
      { test: (f) => !findInFiles(f, /hardcoded.*layout/i), weight: 0.20 }
    ],
    supportsCustomColors: [
      { test: (f) => findInFiles(f, /--color-|--primary|--accent/), weight: 0.35, desc: 'CSS variables' },
      { test: (f) => hasComponentWithColorProp(f), weight: 0.30, desc: 'Color props in components' },
      { test: (f) => findInFiles(f, /hsl\(|rgb\(|#[0-9a-f]{6}/i), weight: 0.20 }
    ]
  };

  const result = {};
  for (const [capName, signals] of Object.entries(SIGNALS)) {
    const score = scoreSignals(files, signals);
    result[capName] = {
      value: score.confidence >= 0.65,
      confidence: score.confidence,
      reason: `Auto-detected: ${score.evidence.join(', ')}`
    };
  }

  return result;
}

function scoreSignals(files, signals) {
  let totalWeight = 0;
  let matchedWeight = 0;
  const evidence = [];

  for (const signal of signals) {
    totalWeight += signal.weight;
    if (signal.test(files)) {
      matchedWeight += signal.weight;
      evidence.push(signal.desc);
    }
  }

  return {
    confidence: totalWeight > 0 ? matchedWeight / totalWeight : 0,
    evidence
  };
}
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing in package.json) |
| Config file | `jest.config.cjs` |
| Quick run command | `npm test -- --testPathPattern="import\|capability" --maxWorkers=2` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPORT-01 | Astro `PUBLIC_*` env vars injected | unit | `npm test src/utils/__tests__/env-preprocessor.test.js` | ❌ Wave 0 |
| IMPORT-02 | Post-build HTML rewriting removes leaked expressions | unit | `npm test src/utils/__tests__/html-expression-replacer.test.js` | ❌ Wave 0 |
| IMPORT-03 | Template structure normalized after import | unit | `npm test src/utils/__tests__/template-normalizer.test.js` | ❌ Wave 0 |
| CAPAB-01 | Auto-detect capabilities on sample templates | unit | `npm test src/utils/__tests__/capability-detector.test.js` | ✅ (template-analyzer.test.js exists) |
| CAPAB-02 | Manifest loads and validates correctly | unit | `npm test src/utils/__tests__/manifest-loader.test.js` | ❌ Wave 0 |
| CAPAB-03 | Wizard steps enable/disable based on capabilities | integration | `npm test src/components/Wizard/__tests__/step-mapper.test.js` | ❌ Wave 0 |
| CAPAB-04 | Preview gracefully handles missing features | integration | `npm test src/components/__tests__/StepReview.test.js` | ❌ Wave 0 |
| CAPAB-05 | CapabilityResolver merges manifest + auto-detect + override | unit | `npm test src/utils/__tests__/capability-resolver.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="import\|capability" --maxWorkers=2` (~15 seconds)
- **Per wave merge:** `npm test` (full suite, ~60 seconds)
- **Phase gate:** Full suite green + no console.error warnings before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/__tests__/env-preprocessor.test.js` — covers IMPORT-01 (env preprocessing)
- [ ] `src/utils/__tests__/html-expression-replacer.test.js` — covers IMPORT-02 (post-build HTML rewriting)
- [ ] `src/utils/__tests__/template-normalizer.test.js` — covers IMPORT-03 (structure normalization)
- [ ] `src/utils/__tests__/manifest-loader.test.js` — covers CAPAB-02 (manifest loading/validation)
- [ ] `src/utils/__tests__/capability-resolver.test.js` — covers CAPAB-05 (capability resolution)
- [ ] `src/components/Wizard/__tests__/step-mapper.test.js` — covers CAPAB-03 (wizard step mapping)
- [ ] `src/components/__tests__/StepReview.test.js` — covers CAPAB-04 (graceful degradation in preview)
- [ ] `src/__tests__/integration/template-import-flow.test.js` — end-to-end: import → analyze → manifest load → wizard steps
- [ ] Framework config: Jest is installed; tsconfig has test settings; npm test script configured

*(Note: template-analyzer.test.js exists but needs expansion for capability detection signals)*

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual env var injection per template | Pre-process .astro files + post-build rewriting | Automated, reliable, no manual per-template setup |
| Wizard assumes all templates same | Capability-aware wizard with manifest | Adapts to template features; improves UX |
| Single entry point detection | Multi-candidate scoring + normalization | Handles diverse template structures |
| No template structure validation | Post-import normalization + astro check | Catches issues early; predictable structure |

**Current blockers (Phase 1 fixes):**
- ❌ Astro `import.meta.env` leaks in deployed HTML → ✅ Preprocessing + post-build rewriting
- ❌ Wizard shows irrelevant steps for unsupported features → ✅ Capability detection + manifest
- ❌ Imported templates have inconsistent structure → ✅ Normalization + validation

---

## Open Questions

1. **Cloudflare Pages build environment for env vars?**
   - What we know: Cloudflare Pages runs `npm install && npm run build` in a build container
   - What's unclear: Can we pass custom `PUBLIC_*` env vars via `wrangler.toml` or GitHub Actions secrets?
   - Recommendation: Test in Phase 1 planning stage; may require custom build script or integration hook
   - Impact: If CF Pages can't inject env vars, we must use preprocessing approach exclusively

2. **Manifest adoption timeline?**
   - What we know: Phase 1 supports optional manifests; auto-detect is fallback
   - What's unclear: Should we require manifests for known templates or make them optional?
   - Recommendation: Phase 1: optional (reduce friction); Phase 2: request manifests for top 5 templates
   - Impact: Early Phase 1 will have lower accuracy; improves over time as manifests are created

3. **False negative tolerance?**
   - What we know: Capability detection has confidence scores; defaults to conservative (confidence < 0.65 disables feature)
   - What's unclear: What's acceptable false negative rate? (missing a real feature)
   - Recommendation: <10% false negative rate acceptable; user can override in wizard
   - Impact: Some templates won't auto-detect features; users can override manually

4. **Multi-framework entry point priority?**
   - What we know: Astro has `src/pages/index.astro`, Vite has `src/main.tsx`, HTML has `index.html`
   - What's unclear: If template has multiple entry points (e.g., both `index.html` and `index.astro`), which wins?
   - Recommendation: Detect framework first; then use framework-specific entry point priority
   - Impact: Ensures correct entry point for mixed-format templates

---

## Sources

### Primary (HIGH confidence)
- Context7: Astro 5.x documentation (build process, env var injection mechanisms)
- Official docs: [Astro Environment Variables](https://docs.astro.build/en/guides/environment-variables/)
- Codebase: `src/utils/template-analyzer.js` (522 lines, framework detection patterns; verified on 15+ templates)
- Codebase: `src/utils/template-preview-runtime.js` (385 lines, dependency injection patterns)
- Codebase: `utils/astro-generator.jsx` (env var generation; .env file creation)
- Codebase: `.planning/codebase/CONCERNS.md` (Astro expression leak documented as blocker)

### Secondary (MEDIUM confidence)
- Research docs: `.planning/research/STACK.md` (technology stack analysis)
- Research docs: `.planning/research/PITFALLS.md` (env var injection pitfall #1, extensively documented)
- Research docs: `.planning/research/FEATURES.md` (capability detection patterns)
- Research docs: `.planning/research/ARCHITECTURE.md` (template pipeline architecture)

### Tertiary (LOW confidence, needs validation)
- Training data: Astro 4.x env var patterns (may differ from 5.x; needs verification)
- Assumption: Cloudflare Pages supports custom env vars (needs testing in Phase 1)

---

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — All tools verified current in package.json; versions locked
- **Architecture Patterns:** HIGH — Based on existing codebase (template-analyzer.js, astro-generator.jsx); empirically proven
- **Pitfalls:** HIGH — Documented in CONCERNS.md with evidence; Astro expression leak confirmed
- **Implementation approach:** MEDIUM-HIGH — Strategy sound; execution details (Cloudflare env vars timing) needs Phase 1 validation

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days; Astro releases may bring changes; Cloudflare Pages API updates)
**Review cadence:** Re-check if Astro 6.0 released or Phase 1 planning surface new constraints

---

## Next Steps (For Planner)

1. **Validate Cloudflare Pages env var injection** — Test whether custom `PUBLIC_*` vars can be passed at build time via GitHub Actions secrets or wrangler.toml
2. **Design test data** — Sample imported templates (Bolt, Loveable, v0) for testing import → analyze → manifest → wizard flow
3. **Schema design review** — Finalize `.lp-manifest.json` schema; get buy-in before Phase 1 implementation
4. **Create test infrastructure** — Set up Jest test files for env preprocessor, HTML rewriter, manifest loader
5. **Plan backwards compatibility** — Ensure Phase 1 changes don't break existing ~15 module-based templates

