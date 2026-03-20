# Comparison: Key Architecture Decisions

**Context:** LP Factory template pipeline architecture decisions
**Date:** 2026-03-20

---

## Decision 1: Anti-Fingerprint Timing (Pre-Build vs Post-Build)

### Question
Where should anti-fingerprinting apply: during template source transformation (pre-build) or after build output (post-build HTML transform)?

### Quick Comparison

| Criterion | Pre-Build | Post-Build |
|-----------|-----------|-----------|
| **Determinism** | Hard (depends on source format) | Easy (HTML is standardized) |
| **Scope** | Class names, component names, variable names | HTML output (class, style, spacing) |
| **Caching** | Breaks caching (every site gets unique source) | Preserves caching (build once, transform many) |
| **Deployment speed** | Slower (rebuild per site) | Faster (build once, transform many) |
| **Auditing** | Can't trace back to source template | Clear diff shows what changed |
| **CSS overlap** | Template + transform both modify styles | Transform only; template unchanged |
| **Confidence** | Medium (format-specific) | High (all formats produce HTML) |

### Recommendation: **Post-Build HTML Transform**

**Why:**

1. **Single source of truth for building** — All formats (Astro, Vite, HTML) build once to static HTML. No need to fork source logic per template type.

2. **Determinism is easier** — HTML structure is standardized across all formats. Seeding randomization on siteId produces identical output every redeployment.

3. **Caching multiplier** — Build once, deploy to 50 different domains with different randomized fingerprints. Single build artifact covers all sites.

4. **Non-destructive transforms** — Preserve built output for auditing. QA can see "original built file" vs "with fingerprinting applied" by diffing.

5. **Matches current architecture** — `HtmlTransformer` already exists and works non-destructively. Fingerprinting is an additional layer in the same stage.

**Example workflow:**

```
template-files/ → [Astro Build] → dist/index.html (built, consistent, cached)
                                     ↓
                              [HtmlTransformer] → inject tracking, theming
                                     ↓
                              [FingerprintObfuscator] → randomize class names per siteId
                                     ↓
                              [QualityChecker] → validate
                                     ↓
                              [CloudflareDeployer] → upload to CF Pages

template-files/ (same) → [Astro Build] → (same dist/index.html, reused)
                                     ↓
                              [HtmlTransformer] → inject tracking, theming (different site config)
                                     ↓
                              [FingerprintObfuscator] → randomize class names per different siteId
                                     ↓
                              [Deploy]
```

**Choose pre-build only if:** Sites will never be redeployed or updated with new designs (unlikely).

---

## Decision 2: Capability Detection Strategy (Auto-Detect vs Manual Manifest)

### Question
How should the system determine what features a template supports (calculator, section reordering, form customization)? Auto-detect from template code, explicit manifest, or both?

### Quick Comparison

| Criterion | Auto-Detect Only | Manifest Only | Auto-Detect + Manifest |
|-----------|------------------|---------------|----------------------|
| **Setup friction** | None (automatic) | High (edit JSON) | Medium (auto with override) |
| **Accuracy** | Medium (heuristics) | High (explicit) | High (explicit wins) |
| **Flexibility** | Low (detector must know all patterns) | High (can declare anything) | High (defaults + override) |
| **Staleness** | Risk (code changes, detection lags) | Risk (manifest not updated) | Medium (manifest override path) |
| **User control** | None | Full | Full |
| **Import UX** | One-click (just upload ZIP) | Requires JSON edit | One-click + optional edit |
| **Maintenance** | High (detector is code) | Low (data-driven) | Medium (both channels) |
| **Repurposing** | Hard (template locked to its features) | Easy (edit manifest to disable features) | Easy (override before deploy) |

### Recommendation: **Auto-Detect + Manifest (Dual-Layer)**

**Why:**

1. **Bootstrap without friction** — User imports Loveable ZIP → auto-detect runs → wizard steps are enabled/disabled automatically. No manual JSON editing required.

2. **User override path exists** — If auto-detect is wrong or user wants a simpler template variant:
   ```
   templates/inbox-zero-clone/.lp-manifest.json
   {
     "id": "inbox-zero-clone",
     "capabilities": {
       "supportsCalculator": false,
       "supportsSectionReorder": false,
       "supportsFormCustomization": true
     }
   }
   ```

3. **Two-phase workflow** — Auto-detect fills gaps; explicit manifest is the final authority. Clear precedence.

4. **Resilient to changes** — Template code changes? Auto-detect might miss it. But manifest provides override. Template removed from source? Manifest is local copy.

5. **Matches current adapter pattern** — `src/adapters/template-adapter.ts` already defines capabilities interface. Manifest is just a data file backing it.

**Heuristics for auto-detect:**

```typescript
function autoDetectCapabilities(files: Record<string, string>) {
  return {
    supportsCalculator:
      hasString(files, 'calc') || hasString(files, 'Math.') ||
      hasComponent(files, 'Calculator', 'Calc'),

    supportsSectionReorder:
      hasString(files, 'reorder') || hasString(files, 'drag') ||
      hasImport(files, 'react-beautiful-dnd|sortable'),

    supportsFormCustomization:
      !hasString(files, 'form') || // no hardcoded form
      hasComponent(files, 'Form', 'FormField'),

    requiredSections: extractRequiredSections(files)
  };
}
```

**Schema for `.lp-manifest.json`:**

```json
{
  "id": "template-id",
  "name": "Human Readable Name",
  "description": "What this template is for",
  "capabilities": {
    "supportsCalculator": false,
    "supportsSectionReorder": true,
    "supportsFormCustomization": true,
    "requiredSections": ["hero", "cta"],
    "customFields": {
      "headerImage": "URL to header background",
      "accentColor": "CSS color override"
    }
  },
  "dependencies": {
    "runtime": ["Tailwind CSS", "Google Fonts (Inter)"],
    "buildTime": ["Astro", "Node 20+"]
  }
}
```

**Choose manifest-only if:** Users frequently repurpose templates (same template, disabled features). Then manifest becomes primary, auto-detect is optional fallback.

**Choose auto-detect-only if:** All templates are single-purpose, never reused differently. Then manifest overhead is wasted.

---

## Decision 3: Preview Architecture (iframe + srcDoc vs SSR Rendering)

### Question
How should template previews render in the wizard before deploy? Live in an iframe with CDN injection, or server-side render?

### Quick Comparison

| Criterion | iframe + srcDoc | Server-Side Render (SSR) | Build-Based (Vite warning) |
|-----------|-----------------|-------------------------|-------------------------|
| **Latency** | <100ms (no build) | 30–60s (npm build) | 30–60s (npm build) |
| **Supported formats** | HTML, Astro (inlined) | All (Astro, Vite, Next) | N/A (not live) |
| **User interactivity** | Limited (JS event handlers may fail) | Full (JS works as deployed) | None (placeholder only) |
| **Accuracy** | Medium (CSS may differ, JS doesn't run) | High (matches deployed output) | Low (static placeholder) |
| **Server load** | None (client-side) | High (build per preview) | None |
| **Caching** | Possible (template once, preview many) | Hard (preview per config change) | N/A |
| **Failure recovery** | CSS-only issues visible | Build errors block preview | Shows friendly warning |
| **Dependency handling** | Manual (CDN injection for Tailwind/Lucide) | Automatic (npm build resolves) | Manual (list dependencies) |

### Recommendation: **Hybrid Approach (iframe for HTML/Astro, Placeholder for Vite)**

**Why:**

1. **Matches capability matrix** — Some templates CAN preview (HTML, Astro), others CAN'T (Vite requires build). Framework.buildRequired flag guides the choice.

2. **Fast feedback for most templates** — 80% of landing page templates are Astro or static HTML. They get live preview instantly. Vite templates (20%) show a friendly placeholder + build time estimate.

3. **Non-blocking UX** — User fills out wizard steps (Product, Brand, Copy) while template imports. By the time they reach StepReview, preview is ready.

4. **Cost-efficient** — iframe previews cost nothing (client-side). SSR would require build workers for every preview change, scaling cost with users.

5. **Matches current preview-runtime** — Code already exists: `template-preview-runtime.js` does HTML extraction, dependency injection, CSS variable injection for iframe srcDoc.

**Fallback for Vite:**

```jsx
function PreviewComponent({ template, site, framework }) {
  if (framework.id === 'vite-react') {
    return (
      <PlaceholderPreview
        framework={framework.label}
        message="Vite/React templates require a build step."
        buildTime="~45 seconds"
        hint="Preview will look similar but interactive features may differ."
      />
    );
  }

  // HTML or Astro — render in iframe
  const previewHtml = buildPreviewHtml(template.files, site, framework);
  return <iframe srcDoc={previewHtml} />;
}
```

**Dependency injection for iframe (CDN):**

```javascript
// If template uses Tailwind but no CDN link
if (deps.tailwindcss && !html.includes('cdn.tailwindcss.com')) {
  inject: `<script src="https://cdn.tailwindcss.com"></script>`
}

// If template uses Lucide React components (HTML static)
if (deps.lucide && framework.id === 'html-static') {
  inject: `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>`
}
```

**Choose pure SSR if:** Users need pixel-perfect preview before deploy AND are willing to wait 30–60s for every preview change. (Unlikely for a fast-paced PPC tool.)

**Choose pure iframe if:** You only support Astro/HTML templates (then no Vite complication). Current codebase only imports Astro + HTML, so this is viable.

---

## Decision 4: Build Pipeline Errors (Fail Fast vs Graceful Degradation)

### Question
When a build fails (npm install fails, astro build crashes, etc.), should the system fail loudly (block deploy) or gracefully degrade (show warning, proceed with best guess)?

### Quick Comparison

| Criterion | Fail Fast | Graceful Degradation |
|-----------|-----------|---------------------|
| **User impact** | Blocked from deploying (clear error) | May deploy broken site (silent failure) |
| **Debugging** | Error messages guide fix | User must detective unknown issues |
| **Recovery** | User fixes source template, re-import | User sees broken site, has to redeploy |
| **PPC context** | Broken site = wasted ad spend (bad) | Better to prevent deploy | |
| **Frequency** | Rare (templates usually importable) | Common (quality issues in AI-generated code) |

### Recommendation: **Fail Fast with Clear Error Messages**

**Why:**

1. **PPC campaigns are expensive** — A deployed broken site burns ad budget. Better to block and ask the user to fix the template.

2. **Errors are usually fixable** — Missing dependencies, build command failed, etc. User can re-import or edit `.lp-manifest.json` to disable features.

3. **Clear path forward** — Error message shows: "Astro build failed. Did you run `npm install`? Try: 1) Re-upload template 2) Edit .lp-manifest.json to disable features 3) Use a different template."

4. **Quality gates** — `QualityChecker` validates the output. If something slips through (no pixel marker, Astro syntax leak), it's caught before deploy.

5. **Prevents support burden** — Silent failures lead to support tickets ("Why is my site blank?"). Explicit errors let users self-serve.

**Error handling pattern:**

```typescript
async function buildPipeline(files, site) {
  const analysis = analyzeTemplate(files);
  if (analysis.errors.length > 0) {
    throw new Error(`Template analysis failed: ${analysis.errors.join('; ')}`);
  }

  const built = await FormatBuilder.build(files, analysis.framework);
  if (!built.success) {
    throw new Error(`Build failed: ${built.error}\n\nTry: 1) Check package.json 2) Re-upload template 3) Use different template`);
  }

  const transformed = HtmlTransformer.transform(built.html, site);
  const obfuscated = FingerprintObfuscator.randomize(transformed, site.id);
  const quality = QualityChecker.validate(obfuscated);

  if (quality.errors.length > 0) {
    throw new Error(`Quality check failed: ${quality.errors.join('; ')}`);
  }

  return obfuscated;
}
```

**Display in UI:**

```jsx
{error && (
  <Alert severity="error" title="Build Failed">
    <pre>{error.message}</pre>
    <p>Suggested fixes:</p>
    <ul>
      <li>Re-upload the template ZIP file</li>
      <li>Choose a different template</li>
      <li>Edit .lp-manifest.json if present</li>
    </ul>
  </Alert>
)}
```

**Choose graceful degradation only if:** You control all templates (internal only). Then you can tolerate partial features disabled silently.

---

## Decision 5: Manifest Storage Location (.lp-manifest.json vs database)

### Question
Where should template capability manifests live: in the template directory (`.lp-manifest.json`), in a database table, or both?

### Quick Comparison

| Criterion | File-Based (.lp-manifest.json) | Database | Both (File Primary) |
|-----------|--------------------------------|----------|-------------------|
| **Portability** | High (manifest travels with template) | Low (tied to DB instance) | High (manifest is source of truth) |
| **Editing** | Text editor or UI form | Admin panel | UI form writes to file + DB |
| **Versioning** | Git-trackable (if in repo) | Query history (if audit logging) | Git-trackable + queryable |
| **Import UX** | One-click (ZIP contains manifest) | Requires DB insert | One-click (file-based, DB syncs) |
| **Sync complexity** | None (file is authority) | Potential drift (file vs DB) | Medium (one-way file→DB sync) |
| **Scale** | Good (files on S3/local) | Good (indexed DB queries) | Requires careful sync |
| **Backup/Restore** | Files are backup | Export DB, lose local changes | Both → total backup |

### Recommendation: **File-Based Primary (.lp-manifest.json in template root)**

**Why:**

1. **Template is self-describing** — All metadata should live with the template. Someone grabs the template directory years later, manifest is there.

2. **Version control friendly** — Commit manifest to git alongside template. History of capability changes is visible in commits.

3. **Import simplicity** — User uploads template ZIP → extract → find `.lp-manifest.json` → load capabilities. No DB round-trip.

4. **Editing is straightforward** — User can edit JSON in UI form, which writes to file in template storage (S3, local disk, DB blob field).

5. **Sync is one-directional** — File is source of truth. If database version conflicts, file wins. No Byzantine fault scenarios.

**File structure:**

```
templates/
├── inbox-zero-clone/
│   ├── package.json
│   ├── astro.config.mjs
│   ├── .lp-manifest.json    ← Add this
│   ├── src/
│   │   └── pages/
│   │       └── index.astro
│   └── README.md
```

**Loading logic:**

```typescript
async function loadTemplate(templateId) {
  const files = await storage.getTemplateFiles(templateId);

  // Parse manifest if present
  let manifest = null;
  if (files['.lp-manifest.json']) {
    try {
      manifest = JSON.parse(files['.lp-manifest.json']);
    } catch (e) {
      console.warn(`Invalid manifest for ${templateId}:`, e);
    }
  }

  // Auto-detect capabilities
  const analysis = analyzeTemplate(files);

  // Merge: explicit manifest overrides auto-detect
  const capabilities = {
    ...analysis.capabilities,
    ...(manifest?.capabilities || {})
  };

  return { files, manifest, capabilities, analysis };
}
```

**Sync to database (if desired for querying):**

```typescript
// Optional: sync capabilities to DB for indexing/filtering
function syncManifestToDb(templateId, manifest, analysis) {
  return db.update('templates', templateId, {
    capabilities: manifest?.capabilities || analysis.capabilities,
    manifestVersion: manifest?.version || '1.0',
    autoDetected: !manifest, // flag for UI display
  });
}
```

**Choose database-only if:** You need real-time querying of 1000s of templates with complex filters (unlikely at current scale).

**Choose file + database if:** You want fast searching + full-text indexing. Then manifest lives in file, but queryable copy lives in DB.

---

## Summary: Recommended Decisions

| Decision | Choice | Confidence | Rationale |
|----------|--------|------------|-----------|
| Anti-fingerprint timing | **Post-Build** | HIGH | Faster, simpler, cacheable, matches current architecture |
| Capability detection | **Auto-Detect + Manifest** | HIGH | Frictionless import + user override path |
| Preview architecture | **iframe for HTML/Astro, Placeholder for Vite** | HIGH | Fast UX for most templates, graceful for build-required ones |
| Build errors | **Fail Fast** | HIGH | Prevents broken PPC deployments; clear error guidance |
| Manifest storage | **File-Based (.lp-manifest.json)** | HIGH | Portable, version-controllable, syncs with template |

**Implementation priority:** Capability + Manifest (Phase 1) → Multi-Format Build (Phase 2) → Anti-Fingerprint (Phase 3) → Quality Checks (Phase 4).
