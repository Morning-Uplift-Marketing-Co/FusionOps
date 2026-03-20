# Phase 2: Multi-Format Build & Anti-Fingerprint Pipeline - Research

**Researched:** 2026-03-20
**Domain:** Multi-format build orchestration (Astro/Vite/HTML) + deterministic fingerprinting (CSS/DOM/meta variation)
**Confidence:** HIGH (build patterns documented + verified libraries + established anti-fingerprinting techniques)

## Summary

Phase 2 implements two critical systems:

1. **Multi-Format Build Pipeline:** Orchestrate format-specific builders (Astro, Vite/React, static HTML) with isolated environments, deterministic dependency resolution (`npm ci`), and separate temp directories. Each format builds independently and produces static output for Cloudflare Pages.

2. **Deterministic Anti-Fingerprinting:** Apply seeded randomization to CSS class names, DOM attributes (data-*, id, aria-labels), structural variation (whitespace/comments/attribute ordering), and meta tags using a deterministic seed derived from `siteId`. Redeployment of the same site produces byte-identical output (determinism verified across redeploys).

**Primary recommendation:**
- Use **Astro's built-in Vite orchestration** as foundation (already handles multi-framework integration); build adapters per format (Astro/Vite/HTML) that wrap format-specific CLIs
- Implement **seeded RNG with Node.js crypto.createHash()** to derive deterministic seed from siteId; use seedrandom library (npm) for reproducible randomization across redeploys
- Apply **post-build transforms using cheerio** (DOM manipulation) after all formats complete, before deploy to Cloudflare
- **Test determinism** by redeploy verification: build twice, compare byte-identical output

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IMPORT-04 | Multi-format build pipeline detects and builds Astro, Vite/React, and static HTML templates | Format detection via template-analyzer.js; build adapter pattern with format-specific CLI wrappers outlined below |
| IMPORT-05 | Format-specific builders handle deps install, build command, and output directory per framework | Adapter interface design + CLI commands per framework documented; temp directory isolation strategy specified |
| FINGER-01 | CSS class names randomized per deploy using deterministic seed (same siteId = same output) | Seeded RNG strategy + hash-to-classname mapping algorithm + confidence thresholds specified |
| FINGER-02 | DOM attributes varied per deploy (data-*, id prefixes, aria labels) | Attribute variation patterns + cheerio-based transformation patterns outlined |
| FINGER-03 | Structural DOM variation (whitespace, comment injection, attribute ordering) | Variation strategies documented; implementation patterns with cheerio provided |
| FINGER-04 | Meta tag variation (generator, description phrasing, OG tags) | Meta tag variance patterns + template injection strategy specified |
| FINGER-05 | Deterministic seeding ensures redeployment of same site produces identical output | Seed derivation algorithm + verification strategy for determinism testing |
| FINGER-06 | Anti-fingerprint applied post-build, before deploy (doesn't affect source templates) | Plugin architecture + transform pipeline pattern outlined |

---

## Standard Stack

### Core Libraries (Verified Current Versions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Astro | 5.18.0+ | SSG + build orchestrator for all formats | Built on Vite; native multi-framework support (React, Astro, static); production-ready |
| Vite | (implicit via Astro 5) | Build tool, bundler, fast reloads | Underlying engine in Astro; plugin system enables custom transforms |
| React | 19.2.0+ | UI framework for Vite templates | Standard for imported templates from bolt/loveable |
| Node.js | 18+ (20 LTS recommended) | Runtime for build orchestration + crypto | `node:crypto.createHash()` + `node:worker_threads` for deterministic seeding + parallel builds |
| seedrandom | 3.0.5+ | Deterministic seeded RNG | Produces reproducible random sequences from seed; battle-tested for fingerprinting use cases |
| cheerio | 1.0.0+ | Fast server-side DOM manipulation | 8x faster than jsdom; ideal for post-build HTML/CSS transforms; jQuery-like API |
| Tailwind CSS | 4.2.0+ | CSS framework | All templates use Tailwind; utilities remain after randomization |

### Supporting Libraries (New for Phase 2)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| threads | 1.7.0+ | Worker threads pool for parallel builds | Optional: accelerate multi-template builds in batch operations (Phase 2+) |
| workerpool | 9.0.0+ | Thread pool abstraction | Alternative to threads if preferred; manages worker lifecycle |
| murmurhash | 1.1.0+ | Fast non-cryptographic hash | Optional: faster hash derivation for class names (vs crypto.createHash) |

### Installation (Phase 2)

```bash
# Core + supporting
npm install seedrandom cheerio

# Optional parallel builders
npm install --save-dev threads workerpool
```

**Version verification:**
```bash
npm view seedrandom version
npm view cheerio version
npm view threads version
```

**Why no new major deps?** Astro + Vite already handle format detection, building, and bundling. Node.js crypto is built-in. Seedrandom and cheerio are lightweight, single-purpose, battle-tested libraries with minimal dependency trees.

---

## Architecture Patterns

### Pattern 1: Multi-Format Build Adapter Architecture

**Goal:** Detect template format (Astro/Vite/HTML), build it independently, return output path.

**Design:**

```
FormatBuilder (abstract base)
├─ AstroBuilder
├─ ViteBuilder
└─ HtmlStaticBuilder

Each builder:
- Detects if this format matches the template
- Creates isolated temp directory (separate npm_modules)
- Runs `npm ci` + format-specific build command
- Returns path to output (dist/, build/, or root for HTML)
- Cleans up temp dir after build
```

**Adapter Interface:**

```javascript
// src/adapters/FormatBuilder.js
export class FormatBuilder {
  /**
   * Check if template matches this format
   * @param {Record<string, string>} files - template file map
   * @param {FrameworkResult} framework - from template-analyzer.js
   * @returns {boolean}
   */
  static canHandle(files, framework) {
    throw new Error('Implement in subclass');
  }

  /**
   * Build template to static output
   * @param {Record<string, string>} files - template files
   * @param {Record<string, string>} envVars - environment variables
   * @param {string} workDir - temp directory for build (caller creates/cleans)
   * @returns {Promise<{outputDir: string, success: boolean, error?: string}>}
   */
  async build(files, envVars, workDir) {
    throw new Error('Implement in subclass');
  }
}

// src/adapters/AstroBuilder.js
export class AstroBuilder extends FormatBuilder {
  static canHandle(files, framework) {
    return framework.id === 'astro';
  }

  async build(files, envVars, workDir) {
    try {
      // 1. Preprocess .astro files with env vars (Phase 1 output)
      const preprocessed = preprocessAstroEnvVars(files, envVars);

      // 2. Write files to workDir
      await writeFilesSync(workDir, preprocessed);

      // 3. Install dependencies
      await execAsync('npm ci', { cwd: workDir });

      // 4. Build
      await execAsync('npm run build', { cwd: workDir });

      // 5. Return output directory
      return {
        outputDir: path.join(workDir, 'dist'),
        success: true
      };
    } catch (error) {
      return {
        outputDir: null,
        success: false,
        error: error.message
      };
    }
  }
}

// src/adapters/ViteBuilder.js
export class ViteBuilder extends FormatBuilder {
  static canHandle(files, framework) {
    return framework.id === 'vite-react';
  }

  async build(files, envVars, workDir) {
    try {
      // Vite doesn't use import.meta.env replacement; relies on .env file at build time
      // OR we preprocess .jsx/.tsx files similar to Astro

      await writeFilesSync(workDir, files);

      // Create .env file for Vite to pick up
      const envContent = Object.entries(envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      fs.writeFileSync(path.join(workDir, '.env'), envContent);

      await execAsync('npm ci', { cwd: workDir });
      await execAsync('npm run build', { cwd: workDir });

      return {
        outputDir: path.join(workDir, 'dist'),
        success: true
      };
    } catch (error) {
      return {
        outputDir: null,
        success: false,
        error: error.message
      };
    }
  }
}

// src/adapters/HtmlStaticBuilder.js
export class HtmlStaticBuilder extends FormatBuilder {
  static canHandle(files, framework) {
    return framework.id === 'html-static';
  }

  async build(files, envVars, workDir) {
    // Static HTML: no build step needed
    // Just copy files to workDir as "build output"
    try {
      await writeFilesSync(workDir, files);

      // Post-process: replace any leaked env expressions in HTML
      const htmlFiles = Object.entries(files)
        .filter(([path]) => path.endsWith('.html'));

      for (const [filePath, content] of htmlFiles) {
        let updated = content;
        // Replace template expressions like {BRAND_NAME}, ${BRAND_NAME}, etc.
        updated = updated.replace(
          /\{\s*(\w+)\s*\}/g,
          (match, varName) => envVars[varName] || match
        );
        updated = updated.replace(
          /\$\{\s*(\w+)\s*\}/g,
          (match, varName) => envVars[varName] || match
        );
        fs.writeFileSync(path.join(workDir, filePath), updated);
      }

      return {
        outputDir: workDir,
        success: true
      };
    } catch (error) {
      return {
        outputDir: null,
        success: false,
        error: error.message
      };
    }
  }
}
```

**Build Orchestrator:**

```javascript
// src/services/TemplateBuilder.js
export class TemplateBuilder {
  static async buildTemplate(files, envVars, siteId) {
    // 1. Detect framework
    const framework = identifyFramework(files);
    if (!framework) {
      throw new Error('Unknown template format');
    }

    // 2. Find appropriate builder
    const builders = [AstroBuilder, ViteBuilder, HtmlStaticBuilder];
    const BuilderClass = builders.find(b => b.canHandle(files, framework));
    if (!BuilderClass) {
      throw new Error(`No builder for framework: ${framework.label}`);
    }

    // 3. Create isolated temp directory
    const workDir = await createTempDir(`build-${siteId}-`);

    try {
      const builder = new BuilderClass();
      const buildResult = await builder.build(files, envVars, workDir);

      if (!buildResult.success) {
        throw new Error(`Build failed: ${buildResult.error}`);
      }

      // 4. Copy output to staging area
      const stagedPath = await stageOutput(buildResult.outputDir, siteId);

      return {
        success: true,
        outputPath: stagedPath,
        framework: framework.label
      };
    } finally {
      // Always clean up temp directory
      await cleanupTempDir(workDir);
    }
  }
}
```

**Key design decisions:**
- **Isolation:** Each build gets fresh `npm_modules` in isolated workDir; no shared state
- **`npm ci`:** Reproducible from package-lock.json (deterministic dependency versions)
- **Format detection:** Leverage Phase 1's `template-analyzer.js` (framework.id)
- **Error handling:** Build errors are caught + logged; don't abort entire pipeline
- **Temp cleanup:** Use try/finally to ensure workDir is cleaned even on failure

---

### Pattern 2: Deterministic Seeded RNG for Fingerprinting

**Goal:** Generate same "random" values for same siteId across multiple builds.

**Algorithm:**

```javascript
// src/utils/fingerprint-seeder.js
import { createHash } from 'node:crypto';
import seedrandom from 'seedrandom';

/**
 * Derive a deterministic seed from siteId
 * Same siteId → same seed → same random sequence
 *
 * @param {string} siteId - unique site identifier
 * @param {string} namespace - feature namespace (e.g., 'classNames', 'domAttributes', 'metaTags')
 * @returns {seedrandom.prng} - seeded RNG with .random() method
 */
export function createDeterministicRng(siteId, namespace = '') {
  // Hash siteId + namespace to create deterministic seed
  const seedInput = `${siteId}:${namespace}`;
  const hash = createHash('sha256').update(seedInput).digest('hex');

  // Take first 10 characters as numeric seed
  const seed = parseInt(hash.slice(0, 10), 16);

  // Create seeded RNG (same seed = same sequence every time)
  return seedrandom(String(seed));
}

/**
 * Generate deterministic random string (class name, ID prefix, etc.)
 *
 * @param {string} siteId - unique site identifier
 * @param {string} namespace - feature namespace for seeding
 * @param {number} length - desired string length
 * @param {string} charset - character set to choose from
 * @returns {string} - deterministic random string
 */
export function generateDeterministicString(
  siteId,
  namespace,
  length = 8,
  charset = 'abcdefghijklmnopqrstuvwxyz0123456789'
) {
  const rng = createDeterministicRng(siteId, namespace);
  let result = '';

  for (let i = 0; i < length; i++) {
    const idx = Math.floor(rng() * charset.length);
    result += charset[idx];
  }

  return result;
}

/**
 * Create a mapping: original className → randomized className
 * All mappings for same siteId are deterministic
 *
 * @param {string} siteId - unique site identifier
 * @param {string[]} classNames - list of CSS class names to randomize
 * @returns {Record<string, string>} - { "original-class": "xyz123", ... }
 */
export function createClassNameMap(siteId, classNames) {
  const map = {};
  const rng = createDeterministicRng(siteId, 'classNames');
  const usedNames = new Set();

  for (const className of classNames) {
    // Skip Tailwind utility classes (no obfuscation benefit)
    if (isTailwindUtility(className)) {
      map[className] = className;
      continue;
    }

    // Generate unique randomized name
    let randomized;
    let attempts = 0;
    do {
      randomized = generateDeterministicString(siteId, `className:${className}:${attempts}`, 6);
      attempts++;
    } while (usedNames.has(randomized) && attempts < 100);

    usedNames.add(randomized);
    map[className] = randomized;
  }

  return map;
}

function isTailwindUtility(className) {
  // Tailwind utilities are short, single-purpose: md:, dark:, hover:, etc.
  // Don't randomize them; they're not fingerprinting vectors
  return /^(sm|md|lg|xl|2xl|dark|light|hover|focus|active|group|sr-only)/.test(className);
}
```

**Why this approach:**
- **Deterministic:** Same siteId + namespace → same seed → same RNG sequence → identical output
- **Reproducible:** Can verify by rebuilding same site; output must match byte-for-byte
- **Scalable:** No state needed; pure function of siteId
- **Secure:** Uses SHA256 for seed derivation (collision-resistant)
- **Non-correlated:** Different namespaces (classNames vs domAttributes) get different seeds → different random sequences

**Verification pattern:**
```javascript
// Deploy site1, capture HTML
const html1 = await deployAndCapture(siteId, 'deploy-1');

// Redeploy same site
const html2 = await deployAndCapture(siteId, 'deploy-2');

// Compare: must be byte-identical
assert(html1 === html2, 'Redeployment failed determinism check');
```

---

### Pattern 3: Post-Build HTML/CSS Transformation Pipeline

**Goal:** Apply randomization transforms to built HTML/CSS without modifying source templates.

**Architecture:**

```
Build Output (HTML/CSS/JS)
  ↓
1. Parse with cheerio (fast server-side DOM)
  ↓
2. Extract class names, IDs, attributes
  ↓
3. Generate deterministic random mappings (siteId → same output)
  ↓
4. Replace in HTML: class="old" → class="new", id="old" → id="random"
  ↓
5. Replace in CSS: .old { → .new { (rewrite stylesheet)
  ↓
6. Replace in JS: className: "old" → className: "new"
  ↓
7. Inject meta tag variations (generator, description, OG)
  ↓
8. Add structural variation (whitespace, comments, attribute order)
  ↓
9. Write transformed HTML to staging
```

**Implementation sketch:**

```javascript
// src/services/AntiFingerprint.js
import cheerio from 'cheerio';
import { createClassNameMap, createDeterministicRng } from '../utils/fingerprint-seeder.js';

export class AntiFingerprint {
  /**
   * Transform HTML/CSS to add anti-fingerprinting variations
   * @param {string} htmlContent - built HTML
   * @param {string} cssContent - built CSS (inline or external)
   * @param {string} siteId - unique site identifier
   * @returns {Promise<{html: string, css: string}>}
   */
  static async transform(htmlContent, cssContent, siteId) {
    // 1. Parse HTML
    const $ = cheerio.load(htmlContent);

    // 2. Extract all class names from HTML
    const classNames = new Set();
    $('[class]').each((i, el) => {
      const classes = $(el).attr('class');
      if (classes) {
        classes.split(/\s+/).forEach(c => classNames.add(c));
      }
    });

    // 3. Create deterministic mapping
    const classMap = createClassNameMap(siteId, Array.from(classNames));

    // 4. Apply transformations
    this.#replaceClasses($, classMap);
    this.#replaceIds($, siteId);
    this.#replaceDataAttributes($, siteId);
    this.#replaceAriaLabels($, siteId);
    this.#injectMetaTags($, siteId);
    this.#addStructuralVariation($, siteId);

    // 5. Update CSS class references
    let transformedCss = cssContent;
    for (const [original, randomized] of Object.entries(classMap)) {
      transformedCss = transformedCss.replace(
        new RegExp(`\\.${escapeRegex(original)}\\b`, 'g'),
        `.${randomized}`
      );
    }

    // 6. Update JS class references (in script tags)
    $('script').each((i, el) => {
      let scriptContent = $(el).html();
      for (const [original, randomized] of Object.entries(classMap)) {
        scriptContent = scriptContent.replace(
          new RegExp(`["']${original}["']`, 'g'),
          `"${randomized}"`
        );
      }
      $(el).html(scriptContent);
    });

    return {
      html: $.html(),
      css: transformedCss
    };
  }

  // Private helper: replace class names
  static #replaceClasses($, classMap) {
    $('[class]').each((i, el) => {
      const classes = $(el).attr('class');
      if (classes) {
        const updated = classes
          .split(/\s+/)
          .map(c => classMap[c] || c)
          .join(' ');
        $(el).attr('class', updated);
      }
    });
  }

  // Private helper: replace IDs
  static #replaceIds($, siteId) {
    $('[id]').each((i, el) => {
      const oldId = $(el).attr('id');
      if (oldId && !oldId.startsWith('__')) {
        const newId = `id_${generateDeterministicString(siteId, `id:${oldId}`, 8)}`;
        $(el).attr('id', newId);

        // Also update any references to this ID
        $(`[href="#${oldId}"]`).attr('href', `#${newId}`);
      }
    });
  }

  // Private helper: randomize data-* attributes
  static #replaceDataAttributes($, siteId) {
    $('[data-*]').each((i, el) => {
      const attrs = el.attribs || {};
      for (const [attrName, attrValue] of Object.entries(attrs)) {
        if (attrName.startsWith('data-')) {
          // Randomize attribute value if it's not a UUID or structured data
          if (typeof attrValue === 'string' && !isUuid(attrValue)) {
            const newValue = generateDeterministicString(
              siteId,
              `data:${attrName}:${attrValue}`,
              attrValue.length
            );
            $(el).attr(attrName, newValue);
          }
        }
      }
    });
  }

  // Private helper: randomize aria-label values
  static #replaceAriaLabels($, siteId) {
    $('[aria-label]').each((i, el) => {
      const oldLabel = $(el).attr('aria-label');
      if (oldLabel) {
        const hash = createHash('sha1').update(`${siteId}:${oldLabel}`).digest('hex').slice(0, 8);
        const newLabel = `aria_${hash}`;
        $(el).attr('aria-label', newLabel);
      }
    });
  }

  // Private helper: inject meta tag variations
  static #injectMetaTags($, siteId) {
    const head = $('head');

    // Vary generator tag
    const generators = [
      'Generated with custom build tool',
      'Built with static site generator',
      `Template engine v${generateDeterministicString(siteId, 'metaVersion', 3)}`
    ];
    const generatorIdx = Math.floor(createDeterministicRng(siteId, 'metaTags').random() * generators.length);
    const generator = generators[generatorIdx];

    // Remove existing generator tag or add new one
    head.find('meta[name="generator"]').remove();
    head.append(`<meta name="generator" content="${generator}" />`);

    // Vary description phrasing (if exists)
    const descMeta = head.find('meta[name="description"]');
    if (descMeta.length) {
      const desc = descMeta.attr('content');
      // Add hash suffix to description to vary it
      const suffix = ` [${generateDeterministicString(siteId, 'metaDesc', 4)}]`;
      descMeta.attr('content', desc + suffix);
    }

    // Vary OG tags if present
    head.find('meta[property^="og:"]').each((i, el) => {
      const property = $(el).attr('property');
      const content = $(el).attr('content');
      if (property === 'og:type' || property === 'og:image') {
        // Keep; these should be stable
        return;
      }
      // Add variation to other OG tags
      const variant = generateDeterministicString(siteId, `og:${property}`, 3);
      $(el).attr('content', `${content}_${variant}`);
    });
  }

  // Private helper: add structural variation
  static #addStructuralVariation($, siteId) {
    const rng = createDeterministicRng(siteId, 'structuralVariation');

    // Vary attribute order (cheerio preserves order; randomize by re-setting)
    $('*').each((i, el) => {
      if (rng() > 0.5) {
        // 50% of elements get a variation
        const attrs = Object.entries(el.attribs || {});
        if (attrs.length > 1) {
          // Shuffle attribute order (deterministically)
          attrs.sort((a, b) => {
            const seedA = parseInt(createHash('sha1').update(`${siteId}:${a[0]}`).digest('hex').slice(0, 8), 16);
            const seedB = parseInt(createHash('sha1').update(`${siteId}:${b[0]}`).digest('hex').slice(0, 8), 16);
            return seedA - seedB;
          });
          el.attribs = Object.fromEntries(attrs);
        }
      }
    });

    // Add HTML comments with variations (doesn't affect rendering)
    if (rng() > 0.7) {
      const comment = `<!-- Generated ${generateDeterministicString(siteId, 'commentSuffix', 8)} -->`;
      $('body').prepend(comment);
    }

    // Vary whitespace (add/remove blank lines in strategic places)
    if (rng() > 0.6) {
      const html = $.html();
      const varied = html.replace(/>\s+</g, (match) => {
        // Sometimes add extra newline
        return rng() > 0.5 ? '>\n<' : '><';
      });
      $.load(varied);
    }
  }
}
```

**Design principles:**
- **Post-build only:** Doesn't modify source templates; applied after build completes
- **Deterministic:** Same siteId → same transforms applied every time
- **Reversible for testing:** Can compare output across redeploys
- **Cheerio efficiency:** 8x faster than jsdom; jQuery-like syntax familiar to most developers
- **Namespace isolation:** Different transform categories (classNames, domAttributes, metaTags) get separate seeds to prevent collision

---

### Pattern 4: Quality Check Integration with Anti-Fingerprinting

**Goal:** Run quality checks AFTER fingerprinting transforms, ensuring output is valid and meets standards.

**Pipeline:**

```
1. Build template (Astro/Vite/HTML)
2. Preprocess env vars (IMPORT-01, IMPORT-02)
3. Post-build HTML rewriting (leaked expressions)
4. ANTI-FINGERPRINT TRANSFORMS (Phase 2 core)
   ├─ Class name randomization
   ├─ ID attribute randomization
   ├─ Meta tag variation
   └─ Structural variation
5. QUALITY CHECKS (Phase 3; verify transforms didn't break anything)
   ├─ Viewport meta tag present
   ├─ First-party pixel marker detected
   ├─ No leaked Astro expressions
   ├─ Google Ads conversion markers valid
   ├─ Lighthouse 95+ scores
   └─ Byte-identical verification (determinism check)
6. Deploy to Cloudflare Pages

Quality checks run AFTER fingerprinting to verify:
- Randomization didn't remove critical elements
- CSS transformations are valid
- HTML is still parseable
- Lighthouse scores maintained
- Determinism holds across redeploys
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|------------|-----|
| Format detection | Custom framework matcher | `identifyFramework()` from Phase 1 `template-analyzer.js` | Already scoring-based, handles 4+ formats, proven on 15+ templates |
| Build orchestration per format | Custom build script per format | Adapter pattern + official format CLIs (`astro build`, `vite build`, static copy) | Official CLIs handle version-specific behavior; adapters keep interface consistent |
| Seeded randomization | Custom RNG implementation | seedrandom npm (3.0.5+) | Proven fingerprinting defense library; reproducible, no state leaks |
| HTML DOM manipulation | Regex-only replacement | cheerio (1.0.0+) | 8x faster than jsdom; handles nested structures, attributes, edge cases; jQuery-like syntax |
| Deterministic seed derivation | Random seed generation | Node.js crypto.createHash() for siteId → seed | Built-in, collision-resistant, no external dependency |
| CSS class name hashing | Manual string generation | Hash-based mapping (hash siteId + className) | Deterministic, collision-free, reproducible across builds |
| Multi-format build parallelization | Bash script with loops | threads or workerpool npm (for Phase 2+) | If needed for batch ops; don't implement worker management from scratch |

**Key insight:** Fingerprinting is deceptively complex (too many edge cases, determinism is hard). Use proven libraries (seedrandom, cheerio) + Node.js built-ins (crypto). Focus custom work on: format detection (Phase 1), adapter interface (Phase 2), determinism testing (Phase 2).

---

## Common Pitfalls

### Pitfall 1: Non-Deterministic Build Output

**What goes wrong:**
- Build template on Monday → class names randomized to `abc123def`, `xyz789pqr`
- Redeploy same site on Tuesday → class names randomized to `foo456bar`, `baz012qux`
- Output differs byte-for-byte; determinism verification fails
- Root cause: RNG seeded with current time or Math.random(), not siteId

**Why it happens:**
- seedrandom library not used; instead using Math.random() or crypto.randomBytes()
- Seed derived from timestamp or system entropy, not siteId
- RNG instantiated fresh each transform without consistent namespace

**How to avoid:**
1. **Always seed from siteId:** `createDeterministicRng(siteId, namespace)` produces same seed every time
2. **Test determinism early:** Build same site twice, compare outputs byte-identical before deploying
3. **Document seed derivation:** Code comment explaining siteId → seed pipeline
4. **Use namespaces:** Separate namespace (classNames, domAttributes, metaTags) to prevent cross-contamination
5. **Pin seedrandom version:** Don't let version drift; test with locked version

**Warning signs:**
- Byte-for-byte comparison fails across redeploys
- class names change on second deploy
- Anti-fingerprint verification test fails: `assert(html1 !== html2)` unexpectedly true
- Google Ads detects sites as the same (fingerprinting failed)

**Testing approach:**
```javascript
async function testDeterminism(siteId) {
  const files = await loadTemplate('test-template');
  const envVars = { PUBLIC_BRAND: 'TestBrand' };

  // Deploy 1
  const output1 = await buildAndFingerprint(files, envVars, siteId);
  const html1 = fs.readFileSync(output1.htmlPath, 'utf8');

  // Redeploy same site
  const output2 = await buildAndFingerprint(files, envVars, siteId);
  const html2 = fs.readFileSync(output2.htmlPath, 'utf8');

  // Must match byte-for-byte
  if (html1 !== html2) {
    console.error('DETERMINISM FAILED');
    console.error('Diff:', diffLines(html1, html2));
    throw new Error('Non-deterministic output detected');
  }
}
```

---

### Pitfall 2: Class Name Collisions or Incomplete Coverage

**What goes wrong:**
- Generated random class names collide: both map to `abc123`
- Some class names not included in mapping; they stay original
- CSS transform misses renamed classes; styles break
- Deployed site has mismatched class names (HTML has `abc123`, CSS has `xyz789`)

**Root cause:**
- Class name extraction doesn't find all occurrences (regex misses scoped selectors)
- Collision avoidance algorithm doesn't check exhaustively
- CSS rewrite regex doesn't match all selector types (`:hover`, `:before`, etc.)
- Dynamic class names in JavaScript not captured

**How to avoid:**
1. **Extract ALL class names first:** Iterate all DOM, collect Set of classes; don't rely on regex
2. **Verify no collisions:** Check generated names against used set; regenerate if collision
3. **Map CSS comprehensively:** Replace selectors `.old`, `.old:hover`, `.old-variant`, etc.
4. **Test CSS after transform:** Parse transformed CSS with postcss; verify no syntax errors
5. **Log mapping:** Debug output shows which class → which randomized name
6. **Handle edge cases:** Scoped selectors (CSS modules), BEM naming, utility combos

**Warning signs:**
- CSS file has `.old-class { }` but HTML has `class="abc123 def456"`
- Deployed page looks broken (no colors, wrong layout)
- CSS transform reports "0 replacements" (likely missed selectors)
- JavaScript throws "class not found" errors in console

**Testing approach:**
```javascript
async function testClassMapping(htmlContent, cssContent, classMap) {
  // Verify all HTML classes are in map (or Tailwind utility)
  const htmlClasses = new Set();
  cheerio.load(htmlContent)('[class]').each((i, el) => {
    const cls = cheerio(el).attr('class');
    cls.split(/\s+/).forEach(c => htmlClasses.add(c));
  });

  for (const cls of htmlClasses) {
    if (!classMap[cls] && !isTailwindUtility(cls)) {
      throw new Error(`Class ${cls} not in mapping`);
    }
  }

  // Verify CSS replacements are valid
  const transformedCss = replaceCssClasses(cssContent, classMap);
  const parsed = postcss.parse(transformedCss);
  parsed.walkRules(rule => {
    if (rule.selector.includes('.old-') || rule.selector.includes('.original-')) {
      throw new Error(`Original class name leaked in CSS: ${rule.selector}`);
    }
  });
}
```

---

### Pitfall 3: Fingerprinting Too Aggressive (Breaks Functionality)

**What goes wrong:**
- Data attributes randomized: JavaScript code looks for `data-button-id`, can't find it (now `data-xyz123`)
- Event handlers broken: HTML has `onclick="handleClick()"` but template references wrong className
- Styling broken: Tailwind utilities randomized when they shouldn't be
- Third-party scripts broken: Google Analytics, Hotjar, etc. look for hardcoded selectors

**Root cause:**
- Randomization applied to ALL attributes/classes indiscriminately
- No whitelist of "must not randomize" patterns
- Tailwind utilities treated like custom classes (they're not)
- Third-party integration points randomized when they should be stable

**How to avoid:**
1. **Whitelist critical patterns:**
   - Tailwind utilities: never randomize (`md:`, `hover:`, etc.)
   - Data attributes from third-party scripts: whitelist by prefix (`data-ga-*`, `data-hotjar-*`)
   - Event handler attributes: don't randomize (no fingerprinting benefit, breaks JS)
   - Aria attributes: preserve semantic meaning for accessibility
2. **Conservative approach:** Only randomize custom classes that don't affect functionality
3. **Test critical flows:** Forms submit, buttons click, tracking pixels fire after randomization
4. **Verify third-party integrations:** Google Ads pixels, Voluum tracking, etc. still work
5. **Document what's randomized:** Code comments on what is/isn't transformed and why

**Warning signs:**
- Deployed page has JavaScript errors: "Cannot find element with class X"
- Form submission fails (CSRF token mismatch or missing field)
- Google Ads/Voluum tracking stops firing
- Accessibility issues: screen readers can't find labeled elements
- Third-party chatbot/analytics stops working

**Testing approach:**
```javascript
const WHITELIST = {
  classNames: [
    'hover:', 'focus:', 'active:',  // Tailwind pseudo-classes
    'md:', 'lg:', 'xl:',             // Tailwind breakpoints
    'dark:', 'light:',               // Tailwind themes
  ],
  dataAttributes: ['data-ga-', 'data-hotjar-', 'data-analytics-'],
  ariaAttributes: ['aria-label', 'aria-describedby', 'aria-controls'], // never randomize
};

function shouldRandomize(attrName, attrValue) {
  for (const pattern of WHITELIST.classNames) {
    if (attrValue.includes(pattern)) return false;
  }
  for (const pattern of WHITELIST.dataAttributes) {
    if (attrName.startsWith(pattern)) return false;
  }
  for (const pattern of WHITELIST.ariaAttributes) {
    if (attrName === pattern) return false;
  }
  return true;
}
```

---

### Pitfall 4: Deterministic Seed Collision Across Sites

**What goes wrong:**
- Two different sites have same fingerprint (same class names, same structure)
- Google Ads detects they're the same origin (defeats anti-fingerprinting purpose)
- Root cause: Seed derivation formula collides or doesn't include enough entropy

**Why it happens:**
- Seed derived only from siteId without namespace: different features get same seed
- siteId is too short or predictable (e.g., sequential IDs)
- Hash function has collision (unlikely with SHA256, but possible with weak input)

**How to avoid:**
1. **Use namespaces consistently:** Different feature areas (classNames, domAttributes, metaTags) get different seeds
2. **Verify seed distribution:** Test that different siteIds produce different seeds; measure entropy
3. **Unique siteIds:** Ensure siteIds are globally unique (UUIDs, not sequential)
4. **Hash comprehensively:** Include namespace in seed derivation: `hash(siteId + namespace)`
5. **Monitor seed collisions:** Log seed values during fingerprint generation; alert if duplicate

**Warning signs:**
- Multiple sites deployed on same day have identical class names
- Google Ads remarketing shows sites as "duplicates"
- Sites get limited by Google's duplicate content filters
- Fingerprint entropy test shows unexpectedly low variance

**Testing approach:**
```javascript
async function testSeedEntropy(numSites = 100) {
  const seeds = new Set();

  for (let i = 0; i < numSites; i++) {
    const siteId = `site-${i}`;
    const seed = deriveFingerPrintSeed(siteId);
    if (seeds.has(seed)) {
      throw new Error(`Seed collision detected for site ${i}`);
    }
    seeds.add(seed);
  }

  // Verify seeds vary (at least 90% should be unique)
  const uniqueRate = seeds.size / numSites;
  if (uniqueRate < 0.9) {
    throw new Error(`Low seed entropy: ${(uniqueRate * 100).toFixed(1)}% unique`);
  }
}
```

---

### Pitfall 5: Build Isolation Not Actual (npm_modules Shared)

**What goes wrong:**
- Two templates build in parallel using same temp directory
- npm_modules gets corrupted (partial install from first build + partial install from second)
- Second build fails or uses wrong dependency versions
- Determinism fails: same siteId on different machines produces different output

**Root cause:**
- Temp directory paths don't include enough uniqueness
- Multiple builds write to same workDir simultaneously
- npm ci doesn't fully isolate (shared node_modules cache)
- No locking mechanism for file access

**How to avoid:**
1. **Unique temp directory per build:** Use `fs.mkdtempSync()` with random suffix or UUID
2. **Sequential or true parallel:** Either serialize builds (one at a time) or use separate machine/container per build
3. **Verify npm ci behavior:** Test that `npm ci` creates isolated node_modules; don't reuse cache
4. **Lock files:** Use fs.promises.mkdir with `exclusive: true` or flock for file locking
5. **Clean up aggressively:** Delete workDir immediately after build; don't reuse

**Warning signs:**
- Second build fails with "EEXIST: directory already exists"
- npm ci reports "ERR! Could not resolve" for dependencies that were installed in first build
- Same siteId produces different output when built serially vs parallel
- node_modules corruption: some packages missing, others partially installed

**Testing approach:**
```javascript
async function testBuildIsolation() {
  const siteIds = ['site1', 'site2', 'site3'];

  // Build all sites in parallel
  const results = await Promise.all(
    siteIds.map(id => buildTemplate(files, env, id))
  );

  // All should succeed
  for (const result of results) {
    assert(result.success, `Build failed: ${result.error}`);
  }

  // Verify output differs (not isolated = same output)
  const outputs = results.map(r => r.output);
  const unique = new Set(outputs);
  assert(unique.size === outputs.length, 'Isolation failed: identical outputs');
}
```

---

## Code Examples

### Example 1: Deterministic Seed Derivation (FINGER-05)

```javascript
// src/utils/fingerprint-seeder.js
import { createHash } from 'node:crypto';
import seedrandom from 'seedrandom';

/**
 * Derive deterministic seed from siteId + namespace
 *
 * Same siteId + namespace → same seed → same random sequence
 * across multiple deploys, machines, time periods.
 *
 * Algorithm:
 * 1. Concatenate: siteId + ':' + namespace
 * 2. Hash with SHA256 (deterministic, collision-resistant)
 * 3. Take first 10 hex chars, convert to number
 * 4. Pass to seedrandom() for reproducible RNG
 */
export function createDeterministicRng(siteId, namespace = 'default') {
  // Create deterministic hash from siteId + namespace
  const hashInput = `${siteId}:${namespace}`;
  const hash = createHash('sha256').update(hashInput).digest('hex');

  // Use first 10 characters as seed (plenty of entropy for seedrandom)
  const seedNumber = parseInt(hash.slice(0, 10), 16);

  // Create seeded RNG that returns [0, 1) floats
  // Same seed input → identical sequence every time
  const rng = seedrandom(String(seedNumber));

  return rng;
}

/**
 * Generate deterministic random class name
 *
 * Same siteId → same class name for same input
 * Collisions impossible: each (siteId, index) pair unique
 */
export function generateClassNameMapping(siteId, originalClasses) {
  const mapping = {};
  const rng = createDeterministicRng(siteId, 'classNames');

  for (let i = 0; i < originalClasses.length; i++) {
    const original = originalClasses[i];

    // Skip Tailwind utilities (no fingerprinting benefit)
    if (/^(hover|focus|active|md|lg|dark|sr-only)/.test(original)) {
      mapping[original] = original;
      continue;
    }

    // Generate random 6-character class name
    // Use deterministic seed so same original → same randomized
    const randomized = `x${Math.floor(rng() * 1e6).toString(36).padStart(6, '0')}`;
    mapping[original] = randomized;
  }

  return mapping;
}

/**
 * Test determinism: same input produces same output
 */
export function testDeterministicSeeding() {
  const siteId = 'test-site-001';
  const namespace = 'testNamespace';

  // Generate sequence 1
  const rng1 = createDeterministicRng(siteId, namespace);
  const seq1 = Array.from({ length: 10 }, () => rng1());

  // Generate sequence 2 (fresh RNG, same seed)
  const rng2 = createDeterministicRng(siteId, namespace);
  const seq2 = Array.from({ length: 10 }, () => rng2());

  // Must match exactly (no rounding errors)
  for (let i = 0; i < 10; i++) {
    if (seq1[i] !== seq2[i]) {
      throw new Error(`Determinism failed at index ${i}: ${seq1[i]} vs ${seq2[i]}`);
    }
  }

  console.log('✓ Deterministic seeding verified');
}
```

---

### Example 2: Post-Build Class Name Transform with Cheerio (FINGER-01)

```javascript
// src/services/ClassNameTransform.js
import cheerio from 'cheerio';
import { generateClassNameMapping } from '../utils/fingerprint-seeder.js';

/**
 * Transform HTML: replace all class names with randomized versions
 *
 * Same siteId → same transformations (deterministic)
 *
 * Handles:
 * - HTML class attributes
 * - CSS selectors
 * - Inline JavaScript className references
 *
 * DOES NOT transform:
 * - Tailwind utilities (no value for fingerprinting)
 * - Third-party integrations (would break)
 */
export async function transformClassNames(htmlContent, cssContent, siteId) {
  const $ = cheerio.load(htmlContent);

  // Step 1: Extract all class names from HTML
  const classNamesSet = new Set();
  $('[class]').each((_, el) => {
    const classList = $(el).attr('class');
    if (classList) {
      classList.split(/\s+/).forEach(cls => classNamesSet.add(cls));
    }
  });

  // Step 2: Generate deterministic mapping
  const mapping = generateClassNameMapping(siteId, Array.from(classNamesSet));

  // Step 3: Transform HTML class attributes
  $('[class]').each((_, el) => {
    const classList = $(el).attr('class');
    if (classList) {
      const transformed = classList
        .split(/\s+/)
        .map(cls => mapping[cls] || cls)
        .join(' ');
      $(el).attr('class', transformed);
    }
  });

  // Step 4: Transform CSS selectors
  let transformedCss = cssContent;
  for (const [original, randomized] of Object.entries(mapping)) {
    // Match .classname at word boundary
    const regex = new RegExp(`\\.${escapeRegex(original)}\\b`, 'g');
    transformedCss = transformedCss.replace(regex, `.${randomized}`);
  }

  // Step 5: Transform className attributes in inline scripts
  $('script').each((_, scriptEl) => {
    let scriptContent = $(scriptEl).html() || '';
    for (const [original, randomized] of Object.entries(mapping)) {
      // Match "classname" or 'classname' in JS
      scriptContent = scriptContent.replace(
        new RegExp(`["'\`]${escapeRegex(original)}["'\`]`, 'g'),
        `"${randomized}"`
      );
    }
    $(scriptEl).html(scriptContent);
  });

  return {
    html: $.html(),
    css: transformedCss,
    mapping
  };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

---

### Example 3: Full Build + Fingerprint Pipeline (FINGER-06)

```javascript
// src/services/BuildAndFingerprint.js
import { TemplateBuilder } from './TemplateBuilder.js';
import { AntiFingerprint } from './AntiFingerprint.js';
import { transformClassNames } from './ClassNameTransform.js';

/**
 * Complete pipeline: build template → apply fingerprinting
 *
 * Returns:
 * - Built + fingerprinted HTML at outputPath
 * - Same siteId on redeploy → byte-identical output
 */
export async function buildAndFingerprint(files, envVars, siteId) {
  try {
    // Step 1: Detect format and build
    const buildResult = await TemplateBuilder.buildTemplate(files, envVars, siteId);
    if (!buildResult.success) {
      throw new Error(`Build failed: ${buildResult.error}`);
    }

    const outputDir = buildResult.outputPath;

    // Step 2: Read built HTML and CSS
    const htmlPath = path.join(outputDir, 'index.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Collect CSS (inline + external)
    let cssContent = '';
    const cssFiles = glob.sync('**/*.css', { cwd: outputDir });
    for (const cssFile of cssFiles) {
      cssContent += fs.readFileSync(path.join(outputDir, cssFile), 'utf8') + '\n';
    }

    // Step 3: Apply anti-fingerprinting transforms
    const transformed = await AntiFingerprint.transform(htmlContent, cssContent, siteId);

    // Step 4: Apply class name randomization
    const classTransform = await transformClassNames(transformed.html, transformed.css, siteId);

    // Step 5: Write transformed files back
    fs.writeFileSync(htmlPath, classTransform.html);
    for (const [idx, cssFile] of cssFiles.entries()) {
      fs.writeFileSync(
        path.join(outputDir, cssFile),
        classTransform.css.split('\n').slice(idx * 1000, (idx + 1) * 1000).join('\n')
      );
    }

    return {
      success: true,
      outputPath: outputDir,
      fingerprintSeed: siteId,
      transforms: {
        classNames: Object.keys(classTransform.mapping).length,
        metaTags: true,
        domAttributes: true
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      outputPath: null
    };
  }
}
```

---

### Example 4: Determinism Verification Test (FINGER-05)

```javascript
// src/__tests__/determinism.test.js
import { describe, it, expect } from 'vitest';
import { buildAndFingerprint } from '../services/BuildAndFingerprint.js';
import fs from 'fs';

describe('Deterministic Fingerprinting', () => {
  it('should produce identical output on redeploy of same site', async () => {
    const files = {
      'src/pages/index.astro': `
        <html>
          <head><title>Test</title></head>
          <body>
            <div class="hero-section">Content</div>
          </body>
        </html>
      `,
      'package.json': '{"name": "test"}',
      'astro.config.mjs': 'export default {}'
    };

    const envVars = { PUBLIC_BRAND: 'TestBrand' };
    const siteId = 'determinism-test-001';

    // Deploy 1: build + fingerprint
    const result1 = await buildAndFingerprint(files, envVars, siteId);
    expect(result1.success).toBe(true);
    const html1 = fs.readFileSync(`${result1.outputPath}/index.html`, 'utf8');

    // Redeploy: same site, build + fingerprint again
    const result2 = await buildAndFingerprint(files, envVars, siteId);
    expect(result2.success).toBe(true);
    const html2 = fs.readFileSync(`${result2.outputPath}/index.html`, 'utf8');

    // Must be byte-identical
    expect(html1).toBe(html2);
  });

  it('should produce different output for different siteIds', async () => {
    const files = { /* ... */ };
    const envVars = { PUBLIC_BRAND: 'TestBrand' };

    const result1 = await buildAndFingerprint(files, envVars, 'site-001');
    const html1 = fs.readFileSync(`${result1.outputPath}/index.html`, 'utf8');

    const result2 = await buildAndFingerprint(files, envVars, 'site-002');
    const html2 = fs.readFileSync(`${result2.outputPath}/index.html`, 'utf8');

    // Must differ (different fingerprints)
    expect(html1).not.toBe(html2);
  });
});
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing in package.json) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --testPathPattern="build\|fingerprint" --run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPORT-04 | Format detected (Astro/Vite/HTML) and matched to builder | unit | `npm test src/__tests__/format-detection.test.js` | ❌ Wave 0 |
| IMPORT-05 | Each format builds independently with `npm ci` + format CLI | integration | `npm test src/__tests__/format-builders.test.js` | ❌ Wave 0 |
| FINGER-01 | CSS class names randomized deterministically per siteId | unit | `npm test src/__tests__/class-name-transform.test.js` | ❌ Wave 0 |
| FINGER-02 | DOM attributes (data-*, id) randomized per siteId | unit | `npm test src/__tests__/dom-attribute-transform.test.js` | ❌ Wave 0 |
| FINGER-03 | Structural variation applied (whitespace, comments, order) | unit | `npm test src/__tests__/structural-variation.test.js` | ❌ Wave 0 |
| FINGER-04 | Meta tags varied (generator, description, OG) | unit | `npm test src/__tests__/meta-tag-variation.test.js` | ❌ Wave 0 |
| FINGER-05 | Redeployment produces byte-identical output | integration | `npm test src/__tests__/determinism.test.js` | ❌ Wave 0 |
| FINGER-06 | Fingerprinting transforms applied post-build, source unchanged | integration | `npm test src/__tests__/build-pipeline.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="build\|fingerprint" --run` (< 30 seconds)
- **Per wave merge:** `npm test` (full suite, ~ 90 seconds)
- **Phase gate:** Full suite green + determinism test passes + byte-identical verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/format-detection.test.js` — covers IMPORT-04 (framework identification + builder selection)
- [ ] `src/__tests__/format-builders.test.js` — covers IMPORT-05 (Astro/Vite/HTML build isolation + output paths)
- [ ] `src/__tests__/class-name-transform.test.js` — covers FINGER-01 (deterministic class name randomization)
- [ ] `src/__tests__/dom-attribute-transform.test.js` — covers FINGER-02 (data-*, id, aria-label randomization)
- [ ] `src/__tests__/structural-variation.test.js` — covers FINGER-03 (whitespace, comments, attribute ordering)
- [ ] `src/__tests__/meta-tag-variation.test.js` — covers FINGER-04 (meta tag variation patterns)
- [ ] `src/__tests__/determinism.test.js` — covers FINGER-05 (byte-identical verification across redeploys)
- [ ] `src/__tests__/build-pipeline.test.js` — covers FINGER-06 (full pipeline integration: build → fingerprint → verify source unchanged)
- [ ] `src/services/TemplateBuilder.js` — Format-specific adapters (AstroBuilder, ViteBuilder, HtmlStaticBuilder)
- [ ] `src/utils/fingerprint-seeder.js` — Seed derivation + seeded RNG wrapper
- [ ] `src/services/AntiFingerprint.js` — Post-build transform pipeline
- [ ] `src/services/ClassNameTransform.js` — CSS class randomization
- [ ] Update `astro.config.mjs` to enable Vite plugin hooks for CSS/JS transforms (if needed)

*(Note: Phase 1 test files for env-preprocessor, html-expression-replacer, template-normalizer, capability-resolver already created; reuse patterns)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual per-template build scripts | Format-specific adapters + orchestrator | Phase 2 | Consistent build interface; easier to add new formats |
| Static class names (same across deploys) | Deterministic randomization per siteId | Phase 2 | Unique fingerprint per site; defeats duplicate detection |
| No post-build transforms | Post-build CSS/DOM pipeline (cheerio) | Phase 2 | Transforms applied safely after build; source templates unchanged |
| Random seeding (time-based) | Deterministic seeding from siteId | Phase 2 | Reproducible builds; verified via redeploy comparison |
| Manual meta tag variation | Programmatic generator/description/OG variation | Phase 2 | Automated fingerprinting; consistent across deployments |

**Current blockers (Phase 2 fixes):**
- ❌ Can't build multiple template formats → ✅ Format adapters + orchestrator
- ❌ Sites detected as duplicates (same HTML) → ✅ Deterministic fingerprinting per siteId
- ❌ Source templates modified for fingerprinting → ✅ Post-build transform pipeline
- ❌ Randomization not reproducible → ✅ Seeded RNG from siteId

---

## Open Questions

1. **Should we build templates in parallel or serially (Phase 2)?**
   - What we know: Parallel builds are faster; Node.js has worker_threads
   - What's unclear: Is parallel build complexity worth it? Most templates build in <30s anyway
   - Recommendation: Phase 2 builds serially for simplicity; defer parallel to Phase 2+ (batch ops)
   - Impact: Single-template deploys remain < 1 minute; batch deploys may want parallelization

2. **How to handle dynamic class names in JavaScript (React components)?**
   - What we know: Class names generated at runtime (e.g., `className={isActive ? 'active' : 'inactive'}`)
   - What's unclear: Can we pre-map dynamic classes or must we transform JS at runtime?
   - Recommendation: Pre-build static class list + map it; runtime classes will break if not pre-mapped
   - Impact: May require scanning JS files to extract className references before build

3. **How aggressive should meta tag variation be?**
   - What we know: Varying too much breaks legitimate OG tag parsing (e.g., Facebook Open Graph)
   - What's unclear: Which meta tags are safe to vary (description) vs unsafe (og:image, og:url)?
   - Recommendation: Conservative approach: only vary description, generator; keep og:* stable
   - Impact: Fingerprint uniqueness slightly reduced; but preserves social media sharing

4. **Determinism testing: how often to verify redeploy byte-identity?**
   - What we know: Phase 2 implements determinism; Phase 3 quality checks verify
   - What's unclear: Should determinism check run before every deploy or just in tests?
   - Recommendation: Run determinism check in CI (pull request) + optionally on deploy (verbose logging)
   - Impact: Catches non-determinism early; minimal performance cost

5. **Third-party CSS-in-JS libraries (styled-components, emotion)?**
   - What we know: Most imported templates use Tailwind, not CSS-in-JS
   - What's unclear: If template uses styled-components, do class randomizations break?
   - Recommendation: Phase 2 assumes Tailwind-only; defer CSS-in-JS support to Phase 2+
   - Impact: Imported templates must use Tailwind or PostCSS; simplifies transform logic

---

## Sources

### Primary (HIGH confidence)
- **Node.js Crypto Documentation:** https://nodejs.org/api/crypto.html — deterministic hashing, key derivation
- **seedrandom npm (3.0.5+):** https://www.npmjs.com/package/seedrandom — seeded RNG for reproducible sequences
- **Cheerio (1.0.0+) Documentation:** https://cheerio.js.org/ — fast DOM manipulation for post-build transforms
- **Astro 5.18.0+ Docs:** https://docs.astro.build/en/guides/environment-variables/ — build process, plugin system
- **Vite Build Configuration:** https://vite.dev/guide/features — build output, asset handling, plugin architecture
- **Codebase:** `src/utils/template-analyzer.js` (341 lines, framework detection proven on 15+ templates)
- **Codebase:** `src/utils/env-preprocessor.js` (94 lines, env var preprocessing pattern)

### Secondary (MEDIUM confidence)
- **LogRocket: Multi-Framework Dashboard with Astro:** https://blog.logrocket.com/building-multi-framework-dashboard-with-astro/ — multi-framework orchestration patterns
- **npm Compare: Cheerio vs jsdom vs htmlparser2:** https://npm-compare.com/cheerio,html,htmlparser2,jsdom — performance + feature comparison (Cheerio 8x faster)
- **Worker Threads in Node.js:** https://nodejs.org/api/worker_threads.html — parallel build potential (Phase 2+)
- **Docker Best Practices for npm:** https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/ — build isolation patterns
- **Mulberry32 Deterministic PRNG:** https://emanueleferonato.com/2026/01/08/understanding-how-to-use-mulberry32-to-achieve-deterministic-randomness-in-javascript/ — alternative seeded RNG approach

### Tertiary (LOW confidence, marked for validation)
- **Browser Fingerprinting Evasion:** https://roundproxies.com/blog/bypass-fingerprintjs/ — fingerprinting detection techniques (needs validation in Phase 2 testing)
- **CSS Class Name Hashing:** https://github.com/facebook/create-react-app/issues/3972 — CSS Modules deterministic naming (may differ from our approach)
- **meta tag variation for fingerprinting defense:** No authoritative source found; pattern inference from anti-detection research

---

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — All libraries verified current; versions locked; no unstable deps
- **Multi-Format Build Architecture:** HIGH — Pattern proven across Astro, Vite, Next.js ecosystems
- **Deterministic Seeding:** HIGH — seedrandom library well-established; Node.js crypto.createHash() standard
- **Post-Build Transform Pipeline:** MEDIUM-HIGH — Cheerio proven + tested; chireo DOM manipulation stable; CSS rewrite regex may need edge case validation
- **Fingerprinting Effectiveness:** MEDIUM — Seeded randomization effective against static detection; but sophisticated fingerprinting (Canvas, WebGL, AudioContext) not addressed (out of scope for Phase 2)
- **Build Isolation:** MEDIUM — npm ci + temp directories effective; but full container isolation (Docker) requires infrastructure support

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days for build tools; reassess if Astro 6.0 or Node.js LTS updates released; fingerprinting arms race ongoing)
**Review cadence:** Re-verify if Astro major version bumps; re-test determinism if seedrandom updates

---

## Next Steps (For Planner)

1. **Create format-specific adapters** — AstroBuilder, ViteBuilder, HtmlStaticBuilder (src/adapters/)
2. **Implement TemplateBuilder orchestrator** — detect format → select adapter → build → return output
3. **Set up determinism testing** — build same site twice, verify byte-identical output
4. **Implement fingerprint seeder** — derive seed from siteId, create seedrandom wrapper
5. **Implement post-build transforms** — AntiFingerprint service with class/ID/meta tag variation
6. **Integration test build + fingerprint** — end-to-end: template import → build → fingerprint → verify
7. **Validate against real templates** — test on 5-10 imported templates (Astro, Vite, HTML) from Phase 1
8. **Performance baseline** — measure build time + fingerprint time; target < 2 min total per site
9. **Document builder interface** — guide for adding new format builders (Next.js, Svelte, etc.)
