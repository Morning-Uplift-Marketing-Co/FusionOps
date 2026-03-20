---
phase: 01-template-import-capability
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/env-preprocessor.js
  - src/utils/html-expression-replacer.js
  - src/utils/template-normalizer.js
  - src/utils/__tests__/env-preprocessor.test.js
  - src/utils/__tests__/html-expression-replacer.test.js
  - src/utils/__tests__/template-normalizer.test.js
autonomous: true
requirements:
  - IMPORT-01
  - IMPORT-02
  - IMPORT-03
must_haves:
  truths:
    - "Imported Astro templates render configured brand variables in deployed output without fallback expressions"
    - "Post-build HTML contains no leaked `import.meta.env` expressions"
    - "Imported templates have normalized directory structure (src/pages/, src/components/)"
    - "Entry point reliably resolves regardless of template source (Bolt, Loveable, etc.)"
  artifacts:
    - path: "src/utils/env-preprocessor.js"
      provides: "Astro .astro file preprocessing to inject env vars before build"
      exports: ["preprocessAstroEnvVars"]
    - path: "src/utils/html-expression-replacer.js"
      provides: "Post-build HTML scanning and leaked expression replacement"
      exports: ["replaceLeakedExpressions"]
    - path: "src/utils/template-normalizer.js"
      provides: "Template structure normalization to standard layout"
      exports: ["normalizeTemplate"]
  key_links:
    - from: "src/utils/env-preprocessor.js"
      to: "template build process"
      via: "Called before `astro build` in adapters"
      pattern: "buildAstro.*preprocessAstroEnvVars"
    - from: "src/utils/html-expression-replacer.js"
      to: "template build output"
      via: "Called after build completes on dist/index.html"
      pattern: "replaceLeakedExpressions.*html"
    - from: "src/utils/template-normalizer.js"
      to: "template import flow"
      via: "Called immediately after ZIP extraction"
      pattern: "normalizeTemplate.*files"
---

<objective>
Fix critical blocker where Astro `PUBLIC_*` environment variables are not injected at build time, causing deployed pages to show placeholder expressions instead of customized values. Establish template import foundation by normalizing directory structure and validating entry points.

Purpose: Unblock all deployed templates to use correct brand variables, conversion IDs, and tracking domains.

Output: Three utility modules for env preprocessing, HTML expression detection, and template structure normalization; full test coverage for each.
</objective>

<execution_context>
@.planning/phases/01-template-import-capability/01-RESEARCH.md
@.planning/codebase/ARCHITECTURE.md
@.planning/codebase/STRUCTURE.md
</execution_context>

<context>
# Current Issue (from RESEARCH.md)

Astro templates reference `import.meta.env.PUBLIC_SITE_NAME` but the `.env` file created by `astro-generator.jsx` is never loaded at build time. Deployed pages show expressions like `"${companyName}"` or `import.meta.env.PUBLIC_*` instead of actual values.

# Key Existing Code

From `src/utils/template-analyzer.js`:
- Framework detection via file scanning (522 lines)
- Scoring-based entry point resolution
- Package.json parsing

From `utils/astro-generator.jsx`:
- Creates `.env` file with `PUBLIC_SITE_NAME`, `PUBLIC_CONVERSION_ID`, etc.
- Current problem: `.env` bundled with template but not processed

From `astro.config.mjs`:
- Astro 5.x configuration with Vite build settings
- No custom plugins for env preprocessing

# Approach

Two-stage solution:
1. **Pre-build (Stage 1):** Replace `import.meta.env.PUBLIC_*` references with hardcoded values in .astro files before build
2. **Post-build (Stage 2):** Scan HTML output and catch any remaining leaked expressions; replace with configured values

Structure normalization happens after ZIP import, before preview generation.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create env-preprocessor utility for Stage 1 injection</name>
  <files>
    src/utils/env-preprocessor.js
    src/utils/__tests__/env-preprocessor.test.js
  </files>
  <read_first>
    - src/utils/template-analyzer.js (reference for file iteration patterns)
    - .planning/phases/01-template-import-capability/01-RESEARCH.md (Pattern 1: Multi-Level Environment Variable Injection, lines 69-145)
  </read_first>
  <action>
Create `src/utils/env-preprocessor.js` with function `preprocessAstroEnvVars(files, envVars)`:

Input:
- `files`: Object with keys = file paths (e.g., "src/pages/index.astro"), values = file content (string)
- `envVars`: Object with keys = env var names (e.g., "PUBLIC_BRAND"), values = string values

Output:
- New object with same structure; only .astro files modified

Regex patterns to handle (in order of priority):
1. `import.meta.env.PUBLIC_X || 'fallback'` → `'actual-value'` (with or without fallback)
2. `import.meta.env.PUBLIC_X` (no fallback) → `'actual-value'`
3. `${import.meta.env.PUBLIC_X}` (template literal) → `${actual-value}`

Special cases:
- If env var not found, use fallback if present, else empty string
- Escape quotes in values (replace `'` with `\'`)
- Escape newlines (`\n`)
- Handle all quote types: single, double, backtick
- Only process .astro files; skip all other file types

Export as named export: `export function preprocessAstroEnvVars(files, envVars) { ... }`

Test file `src/utils/__tests__/env-preprocessor.test.js`:
- Use vitest (already in package.json)
- 5+ test cases covering:
  1. Replace `import.meta.env.PUBLIC_VAR || 'fallback'` with actual value
  2. Replace `import.meta.env.PUBLIC_VAR` (no fallback) with actual value
  3. Use fallback if env var not present
  4. Leave non-.astro files untouched
  5. Handle escaped quotes and newlines in values
  6. Empty files unchanged

Each test uses `expect().toBe()` for exact string matching.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/env-preprocessor.test.js --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
- All 5+ test cases pass
- Test file is well-isolated; uses only input/output (no file I/O)
- env-preprocessor.js exports named function `preprocessAstroEnvVars`
- Function handles quote escaping correctly (values with `'` are escaped)
- Function only processes files ending in `.astro`
- Function returns new object without mutating input
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Create html-expression-replacer utility for Stage 2 post-build cleanup</name>
  <files>
    src/utils/html-expression-replacer.js
    src/utils/__tests__/html-expression-replacer.test.js
  </files>
  <read_first>
    - .planning/phases/01-template-import-capability/01-RESEARCH.md (Pattern 1, lines 111-145)
    - src/utils/env-preprocessor.js (for reference on escaping logic)
  </read_first>
  <action>
Create `src/utils/html-expression-replacer.js` with function `replaceLeakedExpressions(html, envVars)`:

Input:
- `html`: Built HTML output (string) that may contain leaked expressions
- `envVars`: Object with keys = env var names, values = string values

Output:
- HTML string with leaked expressions replaced

Regex patterns to detect and replace (in order):
1. `import.meta.env.PUBLIC_VAR || 'fallback'` anywhere in HTML (script tags, text nodes, attributes)
2. `import.meta.env.PUBLIC_VAR` (standalone, no fallback)
3. `${import.meta.env.PUBLIC_VAR}` (template literal form in script)
4. `${import.meta.env.PUBLIC_VAR || 'fallback'}` (template literal with fallback)

Replacement logic:
- If env var exists, use its value
- If env var missing but fallback present, use fallback
- If neither, use empty string
- Quote the value appropriately (if inside `${}`, no quotes; if standalone, use quotes)

Special cases:
- Handle values that contain quotes, newlines, special chars (escape as needed)
- Don't modify HTML structure; only replace text content in expressions
- Patterns can appear in script tags, inline styles, attributes

Export as named export: `export function replaceLeakedExpressions(html, envVars) { ... }`

Test file `src/utils/__tests__/html-expression-replacer.test.js`:
- 5+ test cases:
  1. Replace leaked `import.meta.env.PUBLIC_VAR` in script tag
  2. Replace in template literal `${import.meta.env.PUBLIC_VAR}`
  3. Replace with fallback when env var missing
  4. Leave non-matching text unchanged
  5. Handle multiple occurrences in same HTML
  6. Preserve surrounding HTML structure

Each test uses exact string matching with `expect().toContain()` or `expect().toBe()`.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/html-expression-replacer.test.js --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
- All 5+ test cases pass
- Function correctly replaces all 4 regex patterns
- Function handles fallback values correctly
- Surrounding HTML preserved (only expressions replaced)
- Multiple replacements in same HTML all executed
- Function returns new string without mutating input
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Create template-normalizer for structure standardization</name>
  <files>
    src/utils/template-normalizer.js
    src/utils/__tests__/template-normalizer.test.js
  </files>
  <read_first>
    - .planning/phases/01-template-import-capability/01-RESEARCH.md (Pattern 4: Template Structure Normalization, lines 332-384)
    - src/utils/template-analyzer.js (for reference on file structure patterns)
  </read_first>
  <action>
Create `src/utils/template-normalizer.js` with function `normalizeTemplate(files)`:

Input:
- `files`: Object with file paths as keys, content as values (output from ZIP extraction)

Output:
- Normalized object with standard structure

Normalization steps (execute in order):

**Step 1: Ensure src/ directory exists**
- If no files start with `src/`, move files:
  - `pages/*` → `src/pages/*`
  - `components/*` → `src/components/*`
  - Leave all other files in root
- Remove old paths (cleanup)

**Step 2: Ensure required config files exist**
- If no `astro.config.mjs` but package.json contains "astro", create default astro.config.mjs:
  ```javascript
  export default {
    integrations: [],
    output: 'static',
  };
  ```
- If no `tsconfig.json`, create default:
  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "moduleResolution": "bundler",
      "module": "ESNext",
      "jsx": "react-jsx"
    }
  }
  ```

**Step 3: Detect and normalize entry point**
- Use template-analyzer.js logic (or call it) to find entry point
- Store entry point as normalized path (e.g., `src/pages/index.astro`)
- Return entry point in result

Export as named export: `export async function normalizeTemplate(files) { ... }`

Returns object with structure:
```javascript
{
  files: { /* normalized files */ },
  entryPoint: "src/pages/index.astro",
  changes: ["moved pages/ to src/pages/", "created astro.config.mjs"]
}
```

Test file `src/utils/__tests__/template-normalizer.test.js`:
- 5+ test cases:
  1. Move pages/ to src/pages/ if src/ missing
  2. Move components/ to src/components/ if src/ missing
  3. Create astro.config.mjs if missing and Astro in package.json
  4. Create tsconfig.json if missing
  5. Leave already-normalized structure unchanged
  6. Detect entry point correctly after normalization

Each test uses exact file path and content assertions.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/template-normalizer.test.js --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
- All 5+ test cases pass
- Function correctly moves pages/ and components/ to src/
- Function creates astro.config.mjs with valid JavaScript
- Function creates tsconfig.json with valid JSON
- Function preserves already-normalized structures
- Function returns object with `files`, `entryPoint`, and `changes` fields
- Function does not mutate input; returns new object
  </acceptance_criteria>
</task>

</tasks>

<verification>
After all tasks complete:
1. Run full test suite: `npx vitest run src/utils/__tests__/ --reporter=verbose` (should show all 15+ tests passing)
2. Verify no console.error or warnings in test output
3. Verify each module is importable: Create quick test that imports all 3 modules and calls each function
4. Verify no hardcoded paths or environment-specific logic
</verification>

<success_criteria>
- All 3 modules created with full test coverage (5+ tests each)
- env-preprocessor correctly handles .astro file preprocessing
- html-expression-replacer handles post-build HTML scanning
- template-normalizer standardizes directory structure and config files
- All test files are isolated (no file I/O, no external dependencies)
- Modules are composable (can be used separately or together in a pipeline)
- No mutations; all functions return new objects/strings
</success_criteria>

<output>
Create `.planning/phases/01-template-import-capability/01-PLAN-SUMMARY.md` with:
- Modules created: env-preprocessor.js, html-expression-replacer.js, template-normalizer.js
- Test coverage: 15+ unit tests passing
- Key functions exported: preprocessAstroEnvVars, replaceLeakedExpressions, normalizeTemplate
- Test command for verification
- Implementation notes (e.g., "All functions are pure; no side effects")
- Next plan dependency: Plan 02 (Capability detection framework)
</output>
