---
phase: 01-template-import-capability
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/manifest-loader.js
  - src/utils/capability-detector.js
  - src/utils/capability-resolver.js
  - src/utils/__tests__/manifest-loader.test.js
  - src/utils/__tests__/capability-detector.test.js
  - src/utils/__tests__/capability-resolver.test.js
autonomous: true
requirements:
  - CAPAB-01
  - CAPAB-02
  - CAPAB-05
must_haves:
  truths:
    - "Auto-detection identifies template capabilities with confidence scoring (>60% accuracy acceptable)"
    - "Manifest files (.lp-manifest.json) load and validate successfully"
    - "CapabilityResolver merges manifest + auto-detect + user override with clear confidence levels"
    - "Wizard can query resolved capabilities to determine which steps to show/hide"
  artifacts:
    - path: "src/utils/manifest-loader.js"
      provides: "Load and validate .lp-manifest.json from template files"
      exports: ["loadAndValidateManifest"]
    - path: "src/utils/capability-detector.js"
      provides: "Auto-detect template capabilities via signal scoring"
      exports: ["autoDetectCapabilities", "scoreSignals"]
    - path: "src/utils/capability-resolver.js"
      provides: "Merge manifest + auto-detect + user override into final capabilities"
      exports: ["resolveCapabilities"]
  key_links:
    - from: "src/utils/manifest-loader.js"
      to: "src/utils/capability-resolver.js"
      via: "Manifest passed to resolver as second argument"
      pattern: "resolveCapabilities.*manifest"
    - from: "src/utils/capability-detector.js"
      to: "src/utils/capability-resolver.js"
      via: "Called as fallback if no manifest"
      pattern: "autoDetectCapabilities.*files"
    - from: "src/utils/capability-resolver.js"
      to: "Wizard components (Plan 03)"
      via: "Wizard calls resolveCapabilities to get capability list"
      pattern: "getEnabledSteps.*capabilities"
---

<objective>
Establish multi-level capability detection framework: (1) Load and validate manifest files, (2) Auto-detect capabilities via pattern scoring, (3) Merge manifest + auto-detect + user override with confidence tracking.

Purpose: Enable wizard to dynamically adapt steps based on what each template actually supports.

Output: Three utility modules for manifest loading, capability detection, and capability resolution; full test coverage showing detection accuracy on diverse templates.
</objective>

<execution_context>
@.planning/phases/01-template-import-capability/01-RESEARCH.md
@.planning/codebase/ARCHITECTURE.md
@src/utils/template-analyzer.js
</execution_context>

<context>
# Multi-Level Detection Strategy (from RESEARCH.md)

**Level 1: Manifest (Highest confidence = 1.0)**
- If `.lp-manifest.json` exists and is valid, use it exclusively
- Template author declares capabilities explicitly
- Cost: Requires manifest maintenance

**Level 2: Auto-Detect (Medium confidence = 0.6–0.95)**
- Scan template source for feature patterns
- Example signals: Calculator detection via component names, Math functions, range inputs
- Uses weighted scoring: total matched weight / total possible weight
- Conservative threshold: confidence >= 0.65 to enable feature

**Level 3: User Override (User confidence = 1.0)**
- After auto-detection, user can correct false positives/negatives via wizard checkbox
- Store override; ignore auto-detect for future deploys of same template

# Manifest Schema (from RESEARCH.md, lines 151-212)

Key fields:
- `id`, `name`, `version`, `entry`
- `capabilities`: object with keys like `supportsCalculator`, each with `value` (bool), `confidence` (number), `reason` (string)
- `requiredSections`, `variables`, `estimatedBuildTime`, `estimatedPreviewTime`, `notes`

# Capability Signals (from RESEARCH.md, lines 254-260)

Examples for calculator:
- Component named "Calculator" (weight: 0.35)
- `<input type="range">` found (weight: 0.25)
- Math functions: Math.min, max, pow, sqrt (weight: 0.20)
- Variable names like amountMin, loanAmount (weight: 0.10)

# Key Existing Code

From `src/utils/template-analyzer.js`:
- Framework detection (Astro, Vite, HTML)
- File iteration and pattern matching helpers
- Package.json parsing

Use this as reference for file scanning patterns.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create manifest-loader for .lp-manifest.json parsing and validation</name>
  <files>
    src/utils/manifest-loader.js
    src/utils/__tests__/manifest-loader.test.js
  </files>
  <read_first>
    - .planning/phases/01-template-import-capability/01-RESEARCH.md (Pattern 2: Capability-Aware Template Manifest, lines 147-236)
    - src/utils/template-analyzer.js (reference for file finding patterns)
  </read_first>
  <action>
Create `src/utils/manifest-loader.js` with function `loadAndValidateManifest(files)`:

Input:
- `files`: Object with file paths as keys (from ZIP extraction or template directory)

Output:
- Object: `{ manifest: null | {...}, valid: true | false, error: null | string }`

Logic:
1. Find `.lp-manifest.json` in files (search all paths, use case-insensitive)
2. If not found, return `{ manifest: null, valid: true, error: null }` (valid to not have manifest)
3. If found, parse JSON:
   - If parse error, return `{ manifest: null, valid: false, error: "Invalid JSON: ..." }`
4. Validate required fields:
   - `id` (string, non-empty): required
   - `name` (string, non-empty): required
   - `version` (string): required
   - `entry` (string): required (entry point like "src/pages/index.astro")
   - `capabilities` (object): must exist and be non-empty
5. Validate capabilities structure:
   - Each capability key (e.g., "supportsCalculator") must have:
     - `value` (boolean): required
     - `confidence` (number 0-1): required
     - `reason` (string): optional but recommended
   - If any capability missing value or confidence, return error
6. Optional but recommended fields: `requiredSections`, `variables`, `estimatedBuildTime`, `notes`

Export as named export: `export function loadAndValidateManifest(files) { ... }`

Validation error messages should be specific (e.g., "Capability 'supportsCalculator' missing 'value' field").

Test file `src/utils/__tests__/manifest-loader.test.js`:
- 6+ test cases:
  1. Valid manifest loads successfully
  2. Missing .lp-manifest.json returns null with valid=true (optional)
  3. Malformed JSON returns error
  4. Missing required field (e.g., "id") returns error
  5. Invalid capability structure (missing value or confidence) returns error
  6. Valid manifest with all fields loads correctly
  7. Case-insensitive file finding (.lp-manifest.json vs .lp-Manifest.json)

Each test should use exact assertion of manifest structure or error message.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/manifest-loader.test.js --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
- All 6+ test cases pass
- Function correctly finds .lp-manifest.json in files
- Function validates all required fields (id, name, version, entry, capabilities)
- Function validates capability structure (value + confidence required)
- Function returns clear error messages for validation failures
- Function handles missing manifest gracefully (returns null, not error)
- Function does not throw; all errors handled in return object
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Create capability-detector for auto-detection via pattern scoring</name>
  <files>
    src/utils/capability-detector.js
    src/utils/__tests__/capability-detector.test.js
  </files>
  <read_first>
    - .planning/phases/01-template-import-capability/01-RESEARCH.md (Pattern 3: Multi-Level Capability Detection, lines 238-327)
    - .planning/phases/01-template-import-capability/01-RESEARCH.md (Example 3: CapabilityResolver, lines 803-834 for signal definitions)
    - src/utils/template-analyzer.js (for file scanning helper patterns)
  </read_first>
  <action>
Create `src/utils/capability-detector.js` with functions:

**`autoDetectCapabilities(files)`**
Input: files object (same as manifest-loader)
Output: Object with capabilities and confidence scores
```javascript
{
  supportsCalculator: { value: true, confidence: 0.85, reason: "..." },
  supportsSectionReorder: { value: false, confidence: 0.40, reason: "..." },
  supportsFormCustomization: { value: true, confidence: 0.75, reason: "..." },
  supportsCustomColors: { value: true, confidence: 0.90, reason: "..." },
  supportsImageUpload: { value: false, confidence: 0.30, reason: "..." }
}
```

**`scoreSignals(files, signals)`** (helper)
Input:
- files: template files
- signals: array of { test: fn, weight: number, description: string }

Output: `{ confidence: 0-1, evidence: [string] }`

Logic for `autoDetectCapabilities`:
1. Define signal sets for each capability (see Example 3 in RESEARCH.md lines 803-820)
2. For each capability, call `scoreSignals` with its signal array
3. Calculate confidence: (sum of matched signal weights) / (sum of total signal weights)
4. If confidence >= 0.65, enable feature; else disable
5. Build reason from evidence (matched signals)

Signal definitions (translate from RESEARCH.md):

**supportsCalculator signals:**
- Component named "Calculator" (weight: 0.35)
- Regex: `/input.*type.*range/i` (weight: 0.25)
- Regex: `/Math\.(min|max|pow|sqrt)/` (weight: 0.20)
- Regex: `/amountMin|amountMax|loanAmount/i` (weight: 0.15)

**supportsSectionReorder signals:**
- More than 3 `<section>` tags (weight: 0.35)
- Regex: `/\[...sections\]/` dynamic spreading (weight: 0.30)
- No regex match for "hardcoded layout" (weight: 0.20)

**supportsCustomColors signals:**
- Regex: `/--color-|--primary|--accent/` CSS variables (weight: 0.35)
- Component with color prop (weight: 0.30)
- Regex: `/hsl\(|rgb\(|#[0-9a-f]{6}/i` color values (weight: 0.20)

**supportsFormCustomization signals:**
- `<form>` tag present (weight: 0.40)
- Input fields present (weight: 0.30)
- Form handler function (weight: 0.20)

**supportsImageUpload signals:**
- Regex: `/image.*upload|file.*input/i` (weight: 0.40)
- Component named "Upload" or "ImageUpload" (weight: 0.30)
- Regex: `/FormData|enctype.*multipart/` (weight: 0.20)

Export as named exports: `export function autoDetectCapabilities(files) { ... }` and `export function scoreSignals(files, signals) { ... }`

Test file `src/utils/__tests__/capability-detector.test.js`:
- 6+ test cases:
  1. Detect calculator with high confidence (multiple signals present)
  2. Detect calculator with low confidence (single weak signal)
  3. No calculator when signals absent
  4. Detect custom colors from CSS variables
  5. Detect form customization from <form> tag
  6. Score calculation correct (weighted sum / total weights)
  7. Confidence threshold: >= 0.65 enables, < 0.65 disables feature
  8. Reason string includes matched signal descriptions

Each test uses sample file sets (small fixtures) and exact confidence assertions.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/capability-detector.test.js --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
- All 6+ test cases pass
- All 5 capability types detected correctly
- Confidence scores calculated as (matched weights) / (total weights)
- Threshold of 0.65 correctly enables/disables features
- Reason strings include matched signal descriptions
- Helper function scoreSignals isolated and testable
- No dependencies on external files or I/O
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Create capability-resolver to merge manifest + auto-detect + override</name>
  <files>
    src/utils/capability-resolver.js
    src/utils/__tests__/capability-resolver.test.js
  </files>
  <read_first>
    - .planning/phases/01-template-import-capability/01-RESEARCH.md (Example 3: CapabilityResolver, lines 773–853)
    - src/utils/manifest-loader.js (created in Task 1)
    - src/utils/capability-detector.js (created in Task 2)
  </read_first>
  <action>
Create `src/utils/capability-resolver.js` with function `resolveCapabilities(files, manifest, userOverride)`:

Input:
- `files`: Template files object
- `manifest`: Output from loadAndValidateManifest (null if not present)
- `userOverride`: Object with keys = capability names, values = boolean (e.g., `{ supportsCalculator: false }`)

Output:
- Object with same structure as autoDetectCapabilities output

Logic (three-level resolution):
1. **Level 1 - Manifest (if present and valid)**
   - If manifest exists, use manifest.capabilities exclusively
   - Skip auto-detect
2. **Level 2 - Auto-Detect (if no manifest)**
   - Call autoDetectCapabilities(files)
   - Use returned capabilities
3. **Level 3 - User Override (merge after Level 1 or 2)**
   - For each key in userOverride:
     - Update capabilities[key].value = userOverride[key]
     - Set capabilities[key].confidence = 1.0
     - Set capabilities[key].reason = "User-overridden in wizard"

Export as named export: `export function resolveCapabilities(files, manifest, userOverride = {}) { ... }`

Example return:
```javascript
{
  supportsCalculator: {
    value: true,
    confidence: 1.0,
    reason: "Explicit: User-declared in manifest"
  },
  supportsSectionReorder: {
    value: false,
    confidence: 0.40,
    reason: "Auto-detected: Found 2 sections (threshold: 3)"
  },
  ...
}
```

Test file `src/utils/__tests__/capability-resolver.test.js`:
- 6+ test cases:
  1. Use manifest exclusively if present (ignore auto-detect)
  2. Use auto-detect if manifest missing
  3. Apply user override to manifest capabilities
  4. Apply user override to auto-detected capabilities
  5. User override sets confidence to 1.0
  6. User override reason is "User-overridden in wizard"
  7. All capabilities present in output (no missing keys)
  8. Priority: Manifest > User > Auto-detect

Each test should verify exact capability values and confidence scores.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/capability-resolver.test.js --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
- All 6+ test cases pass
- Manifest capabilities used exclusively if present
- Auto-detect used as fallback if no manifest
- User overrides applied correctly to both manifest and auto-detect paths
- Confidence set to 1.0 for user overrides
- Reason string updated for overrides
- All 5 capability types present in output
- Function is pure; no side effects
  </acceptance_criteria>
</task>

</tasks>

<verification>
After all tasks complete:
1. Run full test suite: `npx vitest run src/utils/__tests__/ --reporter=verbose` (should show all 18+ tests passing)
2. Verify imports work: Create test that imports all 3 modules and calls each function with sample data
3. Verify capability scores are realistic:
   - Test with actual template sample files (from `src/templates/` directory)
   - Verify detected capabilities match visual inspection of template code
4. Verify error handling: All validation errors return structured error objects, never throw
</verification>

<success_criteria>
- All 3 modules created with full test coverage (6+ tests each)
- manifest-loader correctly finds and validates .lp-manifest.json
- capability-detector auto-detects 5 capability types with confidence scoring
- capability-resolver merges all 3 sources (manifest, auto-detect, override) with correct priority
- All test files are isolated and fast (<1s total)
- Modules are composable; can be used in pipeline or separately
- Confidence threshold of 0.65 applied consistently
- No mutations; all functions return new objects
</success_criteria>

<output>
Create `.planning/phases/01-template-import-capability/02-PLAN-SUMMARY.md` with:
- Modules created: manifest-loader.js, capability-detector.js, capability-resolver.js
- Test coverage: 18+ unit tests passing
- Key functions exported: loadAndValidateManifest, autoDetectCapabilities, scoreSignals, resolveCapabilities
- Test command for verification
- Capability types detected: supportsCalculator, supportsSectionReorder, supportsCustomColors, supportsFormCustomization, supportsImageUpload
- Confidence threshold: 0.65
- Next plan dependency: Plan 03 (Wizard integration)
</output>
