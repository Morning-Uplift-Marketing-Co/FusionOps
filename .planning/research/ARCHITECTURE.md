# Architecture Patterns: Template Pipeline

**Domain:** Landing Page Factory — Multi-format template build pipeline with anti-fingerprint post-processing

**Researched:** 2026-03-20

**Confidence:** HIGH (existing code analysis + industry patterns)

---

## Executive Summary

The LP Factory template pipeline must handle three distinct template formats (Astro, Vite+React, Static HTML), detect their capabilities automatically, build them to static files for Cloudflare Pages, and apply anti-fingerprint post-processing to ensure each deployed site appears unique to Google Ads.

Current codebase has strong foundations:
- **Template analyzer** (3 detection layers: framework signals, dependency scanning, entry point resolution)
- **Preview runtime** (builds self-contained preview HTML with dependency injection)
- **Deployer abstraction** (pluggable deploy targets)
- **Adapter pattern** (template capability declarations)

The pipeline must evolve from linear (single format) to **parallel multi-stage** architecture where format-specific build logic (npm install → build → transform) runs in isolation, then anti-fingerprinting applies post-build at the HTML/CSS layer.

---

## Recommended Architecture

### 3-Stage Pipeline (Sequential, Format-Agnostic)

```
┌─────────────────────────────────────────────────────────┐
│ INPUT: Template files + Site config                      │
└────────────┬────────────────────────────────────────────┘
             │
     ┌───────▼────────────────────────────┐
     │ STAGE 1: Detect & Resolve           │
     │ - Identify format (framework)        │
     │ - Resolve entry point                │
     │ - Extract capabilities manifest      │
     │ - Validate dependencies              │
     └────────────┬────────────────────────┘
                  │
     ┌───────────▼─────────────────────────────┐
     │ STAGE 2: Build (Format-Specific)        │
     │ ┌────────────┬──────────┬──────────────┐ │
     │ │ Astro      │ Vite     │ Static HTML  │ │
     │ │ Build      │ Build    │ (no-op)      │ │
     │ │ dist/      │ dist/    │ as-is        │ │
     │ └────────────┴──────────┴──────────────┘ │
     └────────────┬────────────────────────────┘
                  │
     ┌───────────▼──────────────────────────────┐
     │ STAGE 3: Post-Process & Inject          │
     │ - Inject tracking pixels                 │
     │ - Transform HTML (anti-fingerprint)      │
     │ - Inject CSS variables (theming)         │
     │ - Quality checks & fixes                 │
     └────────────┬─────────────────────────────┘
                  │
     ┌───────────▼──────────────────────────────┐
     │ OUTPUT: Static files ready for CF Pages  │
     └───────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Inputs | Outputs | Notes |
|-----------|---------------|--------|---------|-------|
| **TemplateAnalyzer** | Detect framework, dependencies, entry point, capabilities | File map { path: content } | FrameworkResult, DependencyInfo[], EntryResult, CapabilityManifest | Pure functions, no side effects, scoring-based detection |
| **CapabilityResolver** | Match wizard steps to template features; resolve auto-detect + manifest override | Template files + manifest override | Enabled steps, available features | NEW: Determines if template supports calculator, reordering, etc. |
| **FormatBuilder** | Execute format-specific build logic | Files + framework detection | Built HTML/CSS files | Astro: npm build; Vite: npm build; HTML: passthrough |
| **PreviewGenerator** | Create live preview without build step | Template files + site config | Self-contained HTML for iframe srcDoc | Uses analyzer deps + CDN injection; unbuilt formats show placeholder |
| **HtmlTransformer** | Apply tracking injection, anti-fingerprinting, quality fixes | Built HTML + site config | Transformed HTML + warnings | POST-BUILD layer; non-destructive mutations |
| **FingerprintObfuscator** | Randomize class names, spacing, DOM structure per deploy | HTML + seed | Unique but deterministic per domain | NEW: Per-site fingerprint generation |
| **QualityChecker** | Validate tracking markers, viewport, Google Ads setup, Lighthouse | HTML | { valid, warnings[], errors[] } | Flags issues for preview feedback |
| **CloudflareDeployer** | Upload files to CF Pages + DNS config | Static files + deploy config | Deployment result + URL | Existing; no changes needed |

### Data Flow

**Wizard → Deploy Path:**

```
StepTemplate Selection
     ↓
StepDesign (Colors, fonts, layout options)
     ↓
StepTracking (Pixel ID, conversion ID, form config)
     ↓
StepReview (Build preview, show file tree)
     ↓ [User clicks Deploy]
     ↓
TemplateAnalyzer.analyzeTemplate(files)
     ├─ identifyFramework()      → format detection
     ├─ detectDependencies()     → Tailwind, Lucide, fonts
     ├─ resolveEntryPoint()      → which file to render
     └─ extractCapabilities()    → NEW: auto-detect features
     ↓
CapabilityResolver.resolveFeatures(analysis, manifestOverride?)
     ├─ Map wizard steps to template capabilities
     ├─ Enable/disable dynamic form sections
     └─ Return { supportsSectionReorder, supportsCalculator, ... }
     ↓
FormatBuilder.build(files, framework, siteConfig)
     ├─ Astro:  npm install → astro build → dist/
     ├─ Vite:   npm install → vite build → dist/
     └─ HTML:   passthrough (already built)
     ↓
HtmlTransformer.transform(builtHtml, siteConfig)
     ├─ Inject tracking stubs (__pixel function)
     ├─ Inject Google Ads conversion script
     ├─ Apply theming CSS variables (override)
     ├─ Rewrite form action URLs if needed
     └─ Apply quality checks
     ↓
FingerprintObfuscator.randomize(transformedHtml, siteId)
     ├─ Generate seed from siteId
     ├─ Randomize class names (css-in-js style)
     ├─ Randomize DOM spacing/structure
     ├─ Rename CSS variables to unique names
     └─ Return { html, cssMap } for consistency across redeployments
     ↓
QualityChecker.validate(finalHtml)
     ├─ Check pixel marker present
     ├─ Check viewport meta tag
     ├─ Check Google Ads script (if conversionId set)
     ├─ Check no Astro expression leaks
     └─ Return warnings for preview feedback
     ↓
CloudflareDeployer.deploy(files, manifest)
     └─ Upload static files → CF Pages, configure DNS
```

---

## Key Patterns

### 1. Multi-Stage Detection (Incremental Confidence)

**Why:** Imported templates from bolt.new/loveable have unpredictable structures. Multi-layer detection is more robust than single-pass heuristics.

**Pattern:**

```typescript
export function identifyFramework(files: Record<string, string>) {
  const signals = [
    { name: 'astro', weight: 0.35, test: (keys) => keys.includes('astro.config.mjs') },
    { name: 'astro', weight: 0.30, test: (keys) => keys.some(k => k.match(/src\/pages.*\.astro/)) },
    // ... more signals, each weighted
  ];

  // Score each framework, winner is best match
  // Result includes confidence (0–1) so UI can warn if low
  return { id: 'vite-react', confidence: 0.82, evidence: [...], buildRequired: true };
}
```

**When:** Every new template import; optional re-detection when manifest is updated.

**Example:** Loveable exports sometimes lack `astro.config.mjs` but have `src/pages/*.astro` + `package.json` with `astro` dep → confidence 0.65, still high enough to proceed.

### 2. Pluggable Format Builders (Strategy Pattern)

**Why:** Each format (Astro, Vite, HTML) has different build steps; centralizing format logic prevents hardcoding framework-specific code in the main pipeline.

**Pattern:**

```typescript
interface FormatBuilder {
  format: 'astro' | 'vite-react' | 'html-static';
  canBuild(files, framework): boolean;
  build(files, siteConfig, workDir): Promise<builtFiles>;
  validate(files): { valid: boolean, errors[] };
}

// Usage:
const builders = [new AstroBuild(), new ViteBuild(), new HtmlBuild()];
const builder = builders.find(b => b.canBuild(files, detected));
const built = await builder.build(files, site, '/tmp/build-xxx');
```

**When:** Build stage (STAGE 2).

**Example:** Astro build runs `npm install` + `astro build`; Vite runs `npm install` + `vite build`; HTML does nothing and returns input as-is.

### 3. Capability-Aware Manifest (Feature Detection + Override)

**Why:** Auto-detection can be wrong (confidence < 1). Templates should declare what they support; auto-detect fills in the gaps.

**Pattern:**

```typescript
interface TemplateCapabilities {
  supportsCalculator: boolean;
  supportsSectionReorder: boolean;
  supportsFormCustomization: boolean;
  requiredSections?: string[];
  autoDetected?: boolean;  // true if inferred, false if explicit
  confidence?: number;     // 0–1, omitted if explicit
}

// File: templates/inbox-zero-clone/.lp-manifest.json
{
  "id": "inbox-zero-clone",
  "capabilities": {
    "supportsCalculator": false,
    "supportsSectionReorder": false,
    "supportsFormCustomization": false
  }
}
```

**When:** During import (set auto-detect values); optionally overridable by user before deployment.

**Location:** `.lp-manifest.json` in template root (same level as package.json/astro.config.mjs).

**Example:** Loveable loan calculator template imports, auto-detect finds calculator logic, user can edit manifest to disable it if they want a simpler variant.

### 4. Non-Destructive Post-Build Transformation

**Why:** Preserve the built output structure for caching + auditing; inject tracking/theming via CSS variables and tag insertion, not regex replacement.

**Pattern:**

```typescript
export function transformHtml(html: string, siteConfig: any) {
  const injections = [];

  // Add tracking stubs
  injections.push(`<script>window.__pixel = ${pixelFunction}</script>`);

  // Add theming CSS variables (cascade, not replacement)
  injections.push(`<style>:root { --primary: ${color}; ... }</style>`);

  // Inject into </head> not the body
  return html.replace('</head>', injections.join('\n') + '</head>');
}
```

**When:** After build, before fingerprinting (STAGE 3.1).

**Why not string replacement?** Preserves template intent; avoids breaking custom CSS that references variables; allows preview to show correct theming without rebuilding.

### 5. Per-Site Deterministic Fingerprinting

**Why:** Google Ads detects template fingerprints (same HTML across domains). Randomizing per site breaks detection. Determinism ensures consistency across redeployments of the same domain.

**Pattern:**

```typescript
export function randomizeFingerprint(html: string, siteId: string) {
  // Use siteId as seed for deterministic randomization
  const rng = seededRandom(siteId);
  const classMap = new Map(); // className → randomized

  // Randomize all class names
  return html.replace(/class="([^"]+)"/g, (match, classes) => {
    return 'class="' + classes
      .split(' ')
      .map(c => classMap.get(c) || (classMap.set(c, randomToken(rng)), classMap.get(c)))
      .join(' ') + '"';
  })
  .replace(/class=([''])([^'"]+)\1/g, ...) // single quotes
  .replace(/\s+/g, ' ')                   // randomize spacing
  .replace(/:root\s*\{/, () => {          // rename CSS vars
    return ':root { ' + generateRandomCssVarOverrides(rng);
  });
}
```

**When:** After quality checks (STAGE 3.3).

**Determinism check:** Randomizing the same siteId twice produces identical output (verified by tests).

### 6. Template Preview Without Build (iframe + srcDoc)

**Why:** Users want to see preview before deploy; building every time is slow. Live preview for HTML/Astro, placeholder for Vite.

**Pattern:**

```typescript
export function buildPreviewHtml(files, siteConfig, framework) {
  if (framework.buildRequired && framework.id === 'vite-react') {
    // Can't render Vite without build; show placeholder
    return buildPlaceholderHtml(framework.label);
  }

  // Extract HTML from entry point
  let html = extractRawHtml(files, entry, framework);

  // If Astro, strip frontmatter + inline components
  if (entry.type === 'astro') {
    html = stripAstroFrontmatter(html);
    html = inlineAstroComponents(html, files);
  }

  // Inject dependencies (Tailwind CDN, Lucide UMD, fonts)
  const deps = detectDependencies(files);
  const headInjections = buildDependencyInjections(deps, files);

  // Inject CSS variable overrides (theming)
  headInjections.push(buildCssVariableOverride(siteConfig, colors));

  // Return complete self-contained HTML for srcDoc
  return html.replace('</head>', headInjections.join('\n') + '</head>');
}
```

**When:** StepReview (before user clicks deploy) + optionally StepDesign if theme changes.

**Output:** Single HTML string for `<iframe srcDoc={previewHtml} />`.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Regex-Based String Replacement for Configuration

**What goes wrong:** Hardcoding `site.brand` replacement as `${site.brand}` breaks when templates use Astro `import.meta.env.PUBLIC_BRAND` or CSS variables.

**Instead:** Use CSS variables for theming (cascade), environment variables for Astro, and dependency injection for form endpoints.

**Prevention:** Review imported templates for variable syntax; prefer CSS custom properties over string replacement.

### Anti-Pattern 2: Single-Stage Linear Build

**What goes wrong:** Treating all formats the same (all require `npm build`) fails on HTML-static and causes unnecessary rebuilds for preview.

**Instead:** Stage-based pipeline with format-specific builders; detect once, build intelligently based on framework type.

**Prevention:** Use `framework.buildRequired` flag to decide if `npm install && npm build` is needed.

### Anti-Pattern 3: Building Once, Deploying Many Times with Same Output

**What goes wrong:** Fingerprint detection by Google Ads catches identical sites even with different domains.

**Instead:** Apply deterministic randomization **per deploy**, seeded by siteId for consistency across redeployments.

**Prevention:** Randomization happens AFTER build, not before; siteId → seed → consistent output for that site forever.

### Anti-Pattern 4: Capability Detection Only at Import Time

**What goes wrong:** Manifest stale if template files change; user can't override auto-detected capabilities without re-importing.

**Instead:** Auto-detect + manifest as two separate phases; user can edit manifest after import, before deploy.

**Prevention:** Store manifest in `.lp-manifest.json`, load it alongside template files, allow editing in wizard without re-import.

### Anti-Pattern 5: Unvalidated Post-Build Transforms

**What goes wrong:** Injecting tracking without checking if pixel function is defined; CSS variables without checking if they're declared; results in broken sites.

**Instead:** Quality checks before deployment; warnings in preview if issues detected.

**Prevention:** `QualityChecker.validate(html)` runs after all transforms; flags missing markers, deprecated syntax, breaking changes.

---

## Scalability Considerations

| Concern | At 10 sites | At 100 sites | At 1000 sites |
|---------|------------|------------|-------------|
| **Build time per template** | 30–60s (npm install) | Same (cached locally) | Same (build workers) |
| **Storage per deployed site** | 500KB–2MB (static files) | 500MB–2GB (100 sites) | 500MB–2GB (capped by Cloudflare Pages free tier) |
| **Fingerprint uniqueness** | All sites visibly different | Random variance masks patterns | Deterministic seeding needed to avoid collisions |
| **Template registry size** | 10–20 templates | 50+ templates (lazy load registry) | Paginate/search templates |
| **Preview rendering** | Live preview on every change | Debounce preview rebuild (500ms) | Cache preview for unchanged templates |
| **Deploy latency** | 5–10s per site | Parallel deployer + batch API | Batch upload to CF Pages |

---

## Build Order Dependencies

1. **TemplateAnalyzer** (first) — Depends only on file structure, no framework setup
2. **CapabilityResolver** (concurrent with builder setup) — Depends on TemplateAnalyzer
3. **FormatBuilder** (concurrent per format) — Depends on framework detection
4. **PreviewGenerator** (concurrent, optional) — Depends on TemplateAnalyzer (can run before build)
5. **HtmlTransformer** (depends on FormatBuilder) — Needs built HTML
6. **FingerprintObfuscator** (depends on HtmlTransformer) — Needs final HTML
7. **QualityChecker** (depends on Obfuscator) — Last validation step
8. **CloudflareDeployer** (depends on QualityChecker) — Final upload

**Critical path:** Analyzer → Builder → Transformer → Obfuscator → QualityChecker → Deployer (~60s total)

**Optional (parallel):** PreviewGenerator can run while builder executes

---

## Component Interaction Diagram

```
┌──────────────────────┐
│   Wizard (React)     │
│  Site Configuration  │
└──────────┬───────────┘
           │
    ┌──────▼──────────────────────────────────┐
    │  StepTemplate Selection                  │
    │  ├─ User imports ZIP or selects built-in │
    │  └─ onTemplateLoaded(files)              │
    └──────┬───────────────────────────────────┘
           │ files: Record<string, string>
           │
    ┌──────▼──────────────────────┐
    │  TemplateAnalyzer           │
    │  analyzeTemplate(files)     │
    │  ↓ Returns analysis         │
    └──────┬───────────────────────┘
           │ FrameworkResult, dependencies, entry, capabilities
           │
    ┌──────┴──────┬──────────┬───────────────────────┐
    │             │          │                       │
    │ [Preview]   │[Manifest]│ [Build Decision]      │
    ▼             │          ▼                       ▼
┌───────┐        │    ┌──────────────────┐   ┌──────────────┐
│Preview│        └──▶ │Capability        │   │FormatBuilder │
│Gen    │            │Resolver          │   │.build()      │
│(fast) │            │.resolveFeatures()│   │ if needed    │
└───────┘            └────────┬─────────┘   └────┬─────────┘
                              │                   │
                              │ enabled[]         │ builtFiles
                              │                   │
                         ┌────┴───────────────────▼──────────────────┐
                         │  HtmlTransformer.transform()              │
                         │  ├─ Inject tracking stubs                 │
                         │  ├─ Inject Google Ads conversion script   │
                         │  ├─ Apply theming CSS variables           │
                         │  └─ Rewrite form endpoints                │
                         └────┬──────────────────────────────────────┘
                              │ transformedHtml
                              │
                         ┌────▼──────────────────────────────────────┐
                         │  FingerprintObfuscator.randomize()        │
                         │  ├─ Seed from siteId                      │
                         │  ├─ Randomize class names                 │
                         │  ├─ Randomize spacing                     │
                         │  └─ Rename CSS variables                  │
                         └────┬──────────────────────────────────────┘
                              │ fingerprintedHtml
                              │
                         ┌────▼───────────────────────────────────┐
                         │  QualityChecker.validate()             │
                         │  ├─ Check pixel marker                 │
                         │  ├─ Check viewport meta                │
                         │  ├─ Check Google Ads script            │
                         │  └─ Check no Astro leaks               │
                         └────┬────────────────────────────────────┘
                              │ { valid, warnings[], errors[] }
                              │
                    [Display in StepReview]
                              │ [User confirms]
                              ▼
                    ┌──────────────────────────┐
                    │ CloudflareDeployer       │
                    │ .deploy(files, manifest) │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │ Cloudflare Pages + DNS   │
                    │ Live Site                │
                    └──────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Capability Detection (Foundations)
- Implement `.lp-manifest.json` schema
- Add `CapabilityResolver` to map template features to wizard steps
- Auto-detect capabilities in analyzer (calculator, reordering, form customization)
- Enable/disable wizard steps dynamically based on detected features
- Tests: Verify auto-detect on sample Astro, Vite, HTML templates

### Phase 2: Multi-Format Build Pipeline
- Refactor current builder into strategy pattern (AstroBuild, ViteBuild, HtmlBuild)
- Add format detection to choose correct builder
- Implement `FormatBuilder` interface with shared error handling
- Add build timeout + output validation
- Tests: Build each format, verify output is valid static HTML

### Phase 3: Anti-Fingerprint Post-Processing
- Implement `FingerprintObfuscator` with seeded randomization
- Randomize class names, CSS variables, spacing
- Ensure determinism (same siteId → same output)
- Add fingerprint diff tool to compare before/after
- Tests: Verify determinism, verify Google Ads can't detect template origin

### Phase 4: Quality Checks & Validation
- Implement `QualityChecker` with rules for pixel markers, viewport, Google Ads
- Add Lighthouse 95+ validation (defer to Phase 5 if perf issues)
- Add warnings to preview for low-confidence detections
- Tests: Run quality checks on sample deployed sites

### Phase 5: Preview Rendering Optimization (Optional)
- Implement `PreviewGenerator` for live preview without build
- Add Astro component inlining for astro-preview
- Add CDN injection for Tailwind/Lucide
- Cache preview for unchanged templates
- Tests: Verify preview matches built output for static parts

---

## Sources & References

**Codebase:**
- `src/utils/template-analyzer.js` — Framework detection, dependency scanning (HIGH confidence)
- `src/utils/template-preview-runtime.js` — Preview HTML generation, dependency injection
- `src/adapters/template-adapter.ts` — Capability interface definition
- `utils/deployers/cf-pages.js` — Cloudflare Pages deploy implementation
- `src/components/Wizard/StepTemplate.jsx` — Template selection UI

**Patterns:**
- Multi-stage detection: Signal-based scoring avoids false positives
- Pluggable builders: Strategy pattern isolates format-specific logic
- Capability manifest: Explicit override + auto-detect provides flexibility
- Post-build transforms: Non-destructive injection preserves built output integrity
- Deterministic fingerprinting: Seeded RNG ensures consistency per domain

**Known Constraints:**
- No Next.js support (deferred to v2)
- Cloudflare Pages only (no Vercel/S3/VPS in this phase)
- Vite templates require build step (no live preview)
- 50+ live domains is the growth target (performance optimization secondary)
