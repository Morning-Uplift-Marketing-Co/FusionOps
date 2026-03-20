# Phase 3: Quality Checks & Deploy Validation - Research

**Researched:** 2026-03-20
**Domain:** Pre-deploy quality validation gates (meta tags, tracking pixels, Astro leaks, Lighthouse audits)
**Confidence:** HIGH (standards documented + libraries available + proven patterns) with MEDIUM on Lighthouse API specifics (rate limits, pricing)

## Summary

Phase 3 establishes comprehensive validation gates run after Phase 2 fingerprinting, before deployment. Six critical checks (viewport meta validation, tracking pixel detection, Astro expression leak detection, Google Ads marker validation, Lighthouse 95+ enforcement, and post-fingerprint ordering) ensure deployed landing pages are production-ready.

**Primary recommendations:**
- **Viewport validation:** Simple DOM parser (cheerio) to detect `<meta name="viewport">` presence and validate `width=device-width` requirement
- **Tracking pixel detection:** Pattern matching for Voluum (`vol_pixel`, GCLID parameters) and Google conversion pixels (gtag.js script tags)
- **Astro leak detection:** Regex scanning for `import.meta.env.PUBLIC_*` and `${...env...}` expressions in final HTML
- **Google Ads validation:** Detect gtag.js script blocks, validate conversion ID format (10 digits), and check for GCLID URL parameter patterns
- **Lighthouse enforcement:** Use Lighthouse npm library locally (Node.js 18+) for offline auditing; fallback to PageSpeed API only if rate limits exhausted; enforce 95+ on all metrics
- **Pipeline ordering:** Quality checks run post-fingerprinting (`AntiFingerprint.transform()` completes first), block deploy if critical failures detected

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUAL-01 | Viewport meta tag presence validated before deploy | DOM parser strategy for viewport detection + validation rules outlined below |
| QUAL-02 | First-party pixel marker detected and validated | Pattern detection for Voluum vol_pixel + GCLID parameters documented |
| QUAL-03 | Astro expression leak detection (no raw `import.meta.env` in build output) | Regex pattern for leak detection + false positive mitigation specified |
| QUAL-04 | Google Ads conversion tracking markers validated | gtag.js detection + conversion ID format validation patterns provided |
| QUAL-05 | Lighthouse score enforcement (fail deploy if any metric < 95) | Lighthouse npm library strategy + local vs API trade-offs analyzed |
| QUAL-06 | Quality check runs after fingerprinting, blocks deploy on critical failures | Pipeline ordering + error reporting strategy documented |

---

## Standard Stack

### Core Libraries (Verified Current Versions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cheerio | 1.0.0+ | Fast server-side DOM parsing and manipulation | Parse HTML, detect meta tags, find script blocks; battle-tested, jQuery-like API, 8x faster than jsdom |
| lighthouse | 13.0.3+ (current as of March 2026) | Programmatic web performance auditing | Official Google Chrome tool; local execution avoids API rate limits; Node.js library available |
| node:crypto | built-in (Node.js 18+) | Hash generation for checksum validation | Standard library; deterministic hashing for pixel validation |
| Node.js | 18+ (20 LTS recommended) | Runtime for quality checks service | Async/await, crypto.createHash, JSON parsing |

### Supporting Libraries (Optional)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|------------|
| @google-cloud/pagespeed-insights | 5.0.0+ | Google PageSpeed API client (fallback) | If Lighthouse local execution unavailable or rate limits hit; quota: 25k queries/day, 240/min with API key |
| regexp-pattern | (utility) | Compiled regex patterns for leak detection | Pre-compile leak patterns for performance (avoid recompiling on every check) |

### Installation (Phase 3)

```bash
# Core for quality checks
npm install cheerio lighthouse

# Optional: PageSpeed fallback (install only if using API fallback)
npm install @google-cloud/pagespeed-insights

# Verify versions
npm view cheerio version
npm view lighthouse version
```

**No new major dependencies.** Node.js crypto is built-in. Cheerio is lightweight (5.2 MB). Lighthouse is 50+ MB but runs offline.

---

## Architecture Patterns

### Pattern 1: Quality Checker Service

**Goal:** Orchestrate all six validation gates, report failures, block deploy on critical issues.

**Design:**

```javascript
// src/services/quality-check/QualityChecker.js
export class QualityChecker {
  /**
   * Run all quality validation gates post-fingerprint
   * @param {string} htmlContent - Final HTML output from AntiFingerprint.transform()
   * @param {string} cssContent - Final CSS output
   * @param {Object} config - Quality check config (Lighthouse thresholds, tracking IDs, etc.)
   * @returns {Promise<{
   *   passed: boolean,
   *   criticalFailures: ValidationResult[],
   *   warnings: ValidationResult[],
   *   summary: {checks: number, passed: number, failed: number}
   * }>}
   */
  static async validatePreDeploy(htmlContent, cssContent, config) {
    const results = {
      checks: [],
      criticalFailures: [],
      warnings: [],
    };

    // Gate 1: Viewport meta tag (QUAL-01)
    const viewportResult = this.checkViewportMeta(htmlContent);
    if (!viewportResult.passed) {
      results.criticalFailures.push(viewportResult);
    } else {
      results.checks.push(viewportResult);
    }

    // Gate 2: Tracking pixel marker (QUAL-02)
    const pixelResult = this.checkTrackingPixels(htmlContent, config.trackingConfig);
    if (!pixelResult.passed && config.trackingConfig.required) {
      results.criticalFailures.push(pixelResult);
    } else {
      results.checks.push(pixelResult);
    }

    // Gate 3: Astro expression leaks (QUAL-03)
    const leakResult = this.checkAstroLeaks(htmlContent);
    if (!leakResult.passed) {
      results.criticalFailures.push(leakResult);
    } else {
      results.checks.push(leakResult);
    }

    // Gate 4: Google Ads markers (QUAL-04)
    const adResult = this.checkGoogleAdMarkers(htmlContent, config.googleAdsConfig);
    if (!adResult.passed && config.googleAdsConfig.required) {
      results.criticalFailures.push(adResult);
    } else {
      results.checks.push(adResult);
    }

    // Gate 5: Lighthouse 95+ (QUAL-05)
    const lighthouseResult = await this.checkLighthouseScores(
      htmlContent,
      config.lighthouseConfig
    );
    if (!lighthouseResult.passed) {
      results.criticalFailures.push(lighthouseResult);
    } else {
      results.checks.push(lighthouseResult);
    }

    results.passed = results.criticalFailures.length === 0;
    results.summary = {
      total: results.checks.length + results.criticalFailures.length,
      passed: results.checks.length,
      failed: results.criticalFailures.length,
    };

    return results;
  }
}
```

**When:** After `AntiFingerprint.transform()` completes, before uploading to Cloudflare Pages.

**Error handling:** Critical failures block deploy immediately with user-friendly error messages. Warnings logged but don't block.

### Pattern 2: Viewport Meta Tag Validation (QUAL-01)

**Goal:** Verify `<meta name="viewport" content="width=device-width, initial-scale=1">` is present.

**Implementation:**

```javascript
// src/services/quality-check/validators/viewport-validator.js
import { load as cheerioLoad } from 'cheerio';

export function checkViewportMeta(htmlContent) {
  const $ = cheerioLoad(htmlContent);
  const viewportMeta = $('meta[name="viewport"]');

  if (viewportMeta.length === 0) {
    return {
      id: 'QUAL-01',
      name: 'Viewport Meta Tag',
      passed: false,
      severity: 'critical',
      message: 'Missing viewport meta tag',
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>',
      details: 'Viewport meta tag is required for responsive mobile design'
    };
  }

  const content = viewportMeta.attr('content');
  if (!content || !content.includes('width=device-width')) {
    return {
      id: 'QUAL-01',
      name: 'Viewport Meta Tag',
      passed: false,
      severity: 'critical',
      message: 'Viewport meta tag missing width=device-width',
      fix: 'Update content attribute to include width=device-width',
      details: `Current: <meta name="viewport" content="${content || 'empty'}">`,
      expected: '<meta name="viewport" content="width=device-width, initial-scale=1">'
    };
  }

  // Optional: validate initial-scale
  if (!content.includes('initial-scale')) {
    return {
      id: 'QUAL-01',
      name: 'Viewport Meta Tag',
      passed: false,
      severity: 'warning',
      message: 'Viewport missing initial-scale property',
      fix: 'Add initial-scale=1 to viewport content',
      details: 'Helps prevent unintended zoom on page load'
    };
  }

  return {
    id: 'QUAL-01',
    name: 'Viewport Meta Tag',
    passed: true,
    severity: 'info',
    message: 'Viewport meta tag correctly configured',
    details: `Found: ${viewportMeta.toString()}`
  };
}
```

**Validation rules:**
- MUST have: `<meta name="viewport">`
- MUST have in content: `width=device-width`
- SHOULD have: `initial-scale=1`
- SHOULD NOT have: `user-scalable=0` (WCAG violation)

**False positive risk:** Very low — simple DOM check.

### Pattern 3: Tracking Pixel Detection (QUAL-02)

**Goal:** Detect Voluum and Google conversion tracking pixels; validate marker presence.

**Implementation:**

```javascript
// src/services/quality-check/validators/pixel-validator.js
import { load as cheerioLoad } from 'cheerio';

export function checkTrackingPixels(htmlContent, config = {}) {
  const $ = cheerioLoad(htmlContent);
  const detected = {
    voluum: false,
    google: false,
    gclid: false,
  };

  // Detect Voluum pixel: img src containing vol_pixel or conversion.gif
  $('img').each((i, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('vol_pixel') || src.includes('conversion.gif')) {
      detected.voluum = true;
    }
  });

  // Detect Google conversion tracking: gtag.js script
  $('script').each((i, el) => {
    const src = $(el).attr('src') || '';
    const content = $(el).html() || '';

    if (src.includes('googletagmanager.com') || src.includes('gtag')) {
      detected.google = true;
    }

    // Detect gtag initialization with conversion ID
    if (content.includes('gtag(\'config\'') && content.includes('G-')) {
      detected.google = true;
    }
  });

  // Detect GCLID parameter handling (URL parameter, cookie, or form hidden field)
  const html = htmlContent;
  if (html.includes('gclid') || html.includes('GCLID')) {
    detected.gclid = true;
  }

  // Determine if check passed based on config requirements
  const hasVoluum = detected.voluum;
  const hasGoogle = detected.google && detected.gclid;

  const passed =
    (config.requireVoluum ? hasVoluum : true) &&
    (config.requireGoogle ? hasGoogle : true) &&
    (hasVoluum || hasGoogle); // At least one tracking method must exist

  return {
    id: 'QUAL-02',
    name: 'Tracking Pixel Markers',
    passed,
    severity: passed ? 'info' : 'critical',
    message: passed
      ? `Tracking pixels detected: ${Object.entries(detected)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(', ')}`
      : 'No tracking pixels detected',
    details: {
      voluum: detected.voluum,
      google: detected.google,
      gclid: detected.gclid,
    },
    fix:
      !passed
        ? 'Ensure Voluum pixel or Google conversion tracking is present in final HTML'
        : undefined,
  };
}
```

**Detection patterns:**
- **Voluum:** `<img src="...vol_pixel...">` or `<img src="...conversion.gif...">`
- **Google Ads:** `<script src="https://googletagmanager.com/...">` or gtag.js initialization
- **GCLID:** URL parameter `?gclid=...` or stored in cookie/hidden field

**False positive risk:** MEDIUM — may detect pixels meant for testing. False negative risk HIGH — pixels can be injected dynamically (not detected by static analysis).

**Mitigation:** Allow dynamic pixel injection via config flag. Document that static pixel detection is verification step, not comprehensive check.

### Pattern 4: Astro Expression Leak Detection (QUAL-03)

**Goal:** Detect any remaining `import.meta.env.PUBLIC_*` or `${...env...}` expressions in final output.

**Implementation:**

```javascript
// src/services/quality-check/validators/astro-leak-validator.js

// Compiled regex patterns (avoid recompilation)
const LEAK_PATTERNS = {
  // import.meta.env.PUBLIC_* in any context
  importMetaEnv: /import\.meta\.env\.PUBLIC_\w+/g,

  // Template literals with env: ${import.meta.env.PUBLIC_*}
  templateLiteralEnv: /\$\{[^}]*import\.meta\.env\.PUBLIC_\w+[^}]*\}/g,

  // Vite env pattern: import.meta.env.VITE_*
  viteEnv: /import\.meta\.env\.VITE_\w+/g,

  // Template literal falsy checks: ${import.meta.env.PUBLIC_* || "fallback"}
  fallbackPattern: /import\.meta\.env\.PUBLIC_\w+\s*\|\|/g,
};

export function checkAstroLeaks(htmlContent) {
  const leaks = [];

  // Check HTML body + script content
  const htmlLower = htmlContent.toLowerCase();

  for (const [patternName, pattern] of Object.entries(LEAK_PATTERNS)) {
    const matches = htmlContent.match(pattern);
    if (matches) {
      leaks.push(
        ...matches.map((match) => ({
          type: patternName,
          expression: match,
          linePreview: findLineContext(htmlContent, match),
        }))
      );
    }
  }

  const passed = leaks.length === 0;

  return {
    id: 'QUAL-03',
    name: 'Astro Expression Leak Detection',
    passed,
    severity: passed ? 'info' : 'critical',
    message: passed
      ? 'No Astro import.meta.env expressions detected in output'
      : `Found ${leaks.length} Astro expression leak(s) in output`,
    details: leaks,
    fix:
      !passed
        ? 'Ensure env preprocessor (Phase 1) replaced all import.meta.env.PUBLIC_* with actual values before fingerprinting'
        : undefined,
  };
}

function findLineContext(content, expression, contextLines = 2) {
  const lines = content.split('\n');
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(expression)) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length, i + contextLines + 1);
      results.push({
        lineNumber: i + 1,
        context: lines.slice(start, end).join('\n'),
      });
    }
  }

  return results;
}
```

**Leak patterns:**
- `import.meta.env.PUBLIC_*` (any occurrence)
- `import.meta.env.VITE_*` (Vite-specific)
- `${...import.meta.env...}` (template literal)
- `import.meta.env.PUBLIC_* || "fallback"` (with fallback)

**False positive risk:** LOW — regex is straightforward. False negative risk MEDIUM — only detects static patterns, not dynamically constructed expressions.

**Why this matters:** Leaked env expressions mean env vars weren't preprocessed (Phase 1 step) or fingerprinting corrupted the replacement. Deploy should fail.

### Pattern 5: Google Ads Tracking Validation (QUAL-04)

**Goal:** Validate Google Ads conversion tracking setup (gtag.js present, conversion ID format correct, GCLID parameter present).

**Implementation:**

```javascript
// src/services/quality-check/validators/google-ads-validator.js
import { load as cheerioLoad } from 'cheerio';

const CONVERSION_ID_PATTERN = /G-[A-Z0-9]{10,}/; // G-XXXXXXXXXX format
const GCLID_PATTERN = /[?&]gclid=[A-Za-z0-9_-]+/;

export function checkGoogleAdMarkers(htmlContent, config = {}) {
  const $ = cheerioLoad(htmlContent);
  const findings = {
    gtagScriptPresent: false,
    conversionIdValid: false,
    gclIdPresent: false,
    gtag: null,
  };

  // Find gtag.js script
  let gtagScript = null;
  $('script').each((i, el) => {
    const src = $(el).attr('src') || '';
    const content = $(el).html() || '';

    // Check for gtag.js script tag
    if (
      src.includes('googletagmanager.com') &&
      src.includes('gtag')
    ) {
      findings.gtagScriptPresent = true;
      gtagScript = { type: 'script-tag', src };
      findings.gtag = gtagScript;
    }

    // Check for inline gtag() configuration
    if (
      content.includes("gtag('config'") ||
      content.includes('gtag(\'event\'')
    ) {
      findings.gtagScriptPresent = true;

      // Extract conversion ID from gtag config
      const match = content.match(CONVERSION_ID_PATTERN);
      if (match) {
        findings.conversionIdValid = true;
        if (!gtagScript) {
          gtagScript = { type: 'inline-config', id: match[0] };
        }
      }
    }
  });

  // Check for GCLID in URL or form
  const gclIdMatch = htmlContent.match(GCLID_PATTERN);
  if (gclIdMatch) {
    findings.gclIdPresent = true;
  }

  // Alternative: check for GCLID parameter in forms
  const gclIdInput = $('input[name="gclid"], input[name="GCLID"]');
  if (gclIdInput.length > 0) {
    findings.gclIdPresent = true;
  }

  const passed =
    findings.gtagScriptPresent &&
    findings.conversionIdValid &&
    findings.gclIdPresent;

  return {
    id: 'QUAL-04',
    name: 'Google Ads Tracking Markers',
    passed,
    severity: passed ? 'info' : 'critical',
    message: passed
      ? 'Google Ads conversion tracking properly configured'
      : 'Google Ads tracking incomplete',
    details: findings,
    checklist: {
      '✓ gtag.js script present': findings.gtagScriptPresent,
      '✓ Conversion ID valid format (G-*)': findings.conversionIdValid,
      '✓ GCLID parameter detected': findings.gclIdPresent,
    },
    fix:
      !passed
        ? `Missing: ${[
            !findings.gtagScriptPresent && 'gtag.js script tag',
            !findings.conversionIdValid && 'valid conversion ID (G-XXXXXXXXXX format)',
            !findings.gclIdPresent && 'GCLID parameter in URL or hidden input',
          ]
            .filter(Boolean)
            .join(', ')}`
        : undefined,
  };
}
```

**Validation rules:**
- MUST have: `<script src="https://www.googletagmanager.com/gtag/js?id=G-..."></script>`
- MUST have: `gtag('config', 'G-XXXXXXXXXX')`
- MUST have: GCLID parameter (`?gclid=...`) or hidden form field
- Format: Conversion ID must match `G-[A-Z0-9]{10,}`

**False positive risk:** MEDIUM — may detect unrelated gtag scripts. Validate actual conversion ID present.

### Pattern 6: Lighthouse 95+ Enforcement (QUAL-05)

**Goal:** Run Lighthouse audit locally; enforce 95+ on all metrics (Performance, Accessibility, Best Practices, SEO).

**Implementation:**

```javascript
// src/services/quality-check/validators/lighthouse-validator.js
import lighthouse from 'lighthouse';
import ChromeLauncher from 'chrome-launcher';

export async function checkLighthouseScores(htmlContent, config = {}) {
  const {
    thresholds = { performance: 95, accessibility: 95, best_practices: 95, seo: 95 },
    timeout = 120000, // 2 minutes max
    onlyMetrics = null, // Test only specific metrics to save time
  } = config;

  try {
    // Strategy 1: Local Lighthouse execution
    const result = await runLighthouseLocal(htmlContent, { timeout, onlyMetrics });

    if (!result.success) {
      // Fallback to PageSpeed API if local fails (MEDIUM confidence)
      return await fallbackToPageSpeedAPI(htmlContent, config);
    }

    const { scores, details } = result;

    // Check threshold compliance
    const failures = [];
    for (const [metric, threshold] of Object.entries(thresholds)) {
      if (scores[metric] < threshold) {
        failures.push({
          metric,
          score: scores[metric],
          threshold,
          gap: threshold - scores[metric],
        });
      }
    }

    const passed = failures.length === 0;

    return {
      id: 'QUAL-05',
      name: 'Lighthouse 95+ Enforcement',
      passed,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `All metrics meet 95+ threshold: ${JSON.stringify(scores)}`
        : `${failures.length} metric(s) below 95 threshold`,
      details: {
        scores,
        failures,
        lighthouse_version: details.lighthouseVersion,
      },
      fix:
        !passed
          ? `Improve metrics: ${failures.map((f) => `${f.metric} (${f.score}/100)`).join(', ')}`
          : undefined,
    };
  } catch (error) {
    // If Lighthouse fails, surface error but don't block deploy (advisory)
    return {
      id: 'QUAL-05',
      name: 'Lighthouse 95+ Enforcement',
      passed: false,
      severity: 'warning', // Changed to warning if Lighthouse unavailable
      message: `Lighthouse audit failed: ${error.message}`,
      details: { error: error.toString() },
      fix: 'Check Lighthouse service availability; deploy may proceed with manual verification',
    };
  }
}

async function runLighthouseLocal(htmlContent, options = {}) {
  let chrome;
  try {
    // Spawn Chrome instance
    chrome = await ChromeLauncher.launch({ chromeFlags: ['--headless'] });

    // Run Lighthouse against localhost:9222 or temp server
    const result = await lighthouse(`http://localhost:9222`, {
      port: chrome.port,
      onlyCategories: options.onlyMetrics || [
        'performance',
        'accessibility',
        'best-practices',
        'seo',
      ],
      timeout: options.timeout || 120000,
    });

    const scores = {};
    for (const [category, data] of Object.entries(result.lhr.categories)) {
      scores[category] = Math.round(data.score * 100);
    }

    return {
      success: true,
      scores,
      details: {
        lighthouseVersion: result.lhr.lighthouseVersion,
        fetchTime: result.lhr.fetchTime,
      },
    };
  } catch (error) {
    console.error('Local Lighthouse failed:', error.message);
    return { success: false, error };
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }
}

async function fallbackToPageSpeedAPI(htmlContent, config = {}) {
  // Low confidence fallback — only if local Lighthouse unavailable
  try {
    const { PageSpeedInsights } = await import('@google-cloud/pagespeed-insights');
    const client = new PageSpeedInsights({ apiKey: process.env.GOOGLE_API_KEY });

    const response = await client.runPagespeed({
      url: config.testUrl || 'http://localhost:3000', // Must provide test URL
      strategy: 'mobile', // or 'desktop'
    });

    // Map PageSpeed scores to Lighthouse format
    const scores = {
      performance: response.lighthouseResult.categories.performance.score * 100,
      accessibility: response.lighthouseResult.categories.accessibility.score * 100,
      best_practices: response.lighthouseResult.categories['best-practices'].score * 100,
      seo: response.lighthouseResult.categories.seo.score * 100,
    };

    return {
      id: 'QUAL-05',
      name: 'Lighthouse 95+ Enforcement (PageSpeed API)',
      passed: Object.values(scores).every((s) => s >= 95),
      severity: 'info',
      details: { scores, source: 'PageSpeed API' },
    };
  } catch (error) {
    return {
      id: 'QUAL-05',
      name: 'Lighthouse 95+ Enforcement',
      passed: false,
      severity: 'warning',
      message: 'Lighthouse audit unavailable (local + API fallback failed)',
      details: { error: error.message },
    };
  }
}
```

**Lighthouse strategy:**
1. **Preferred:** Local Node.js execution (offline, no rate limits, fast)
2. **Fallback:** PageSpeed Insights API (rate limited: 25k/day, 240/min with API key)
3. **Advisory:** If both unavailable, log warning but don't block deploy

**Thresholds:** All metrics (Performance, Accessibility, Best Practices, SEO) must be >= 95. Any metric < 95 blocks deploy.

**False positive risk:** MEDIUM — Lighthouse can be environment-sensitive (CPU, memory, network throttling). Run consistently to get reliable results.

**Performance note:** Lighthouse audit takes 30-60 seconds per page. Run in parallel for batch operations.

### Pattern 7: Quality Checker Pipeline Integration (QUAL-06)

**Goal:** Integrate quality checks into build pipeline post-fingerprinting, block deploy on critical failures.

**Implementation:**

```javascript
// src/services/build/TemplateBuilder.js (Phase 2 integration point)

export class TemplateBuilder {
  async buildTemplate(files, config) {
    // Step 1: Detect format
    const framework = identifyFramework(files);

    // Step 2: Build per format
    const builder = selectBuilder(framework);
    const buildResult = await builder.build(files, config.envVars);
    if (!buildResult.success) {
      throw new Error(`Build failed: ${buildResult.error}`);
    }

    // Step 3: Read built HTML + CSS
    const htmlContent = fs.readFileSync(
      path.join(buildResult.outputDir, 'index.html'),
      'utf-8'
    );
    const cssContent = /* read from dist/ or inline styles */;

    // Step 4: Apply anti-fingerprinting
    const { html, css } = await AntiFingerprint.transform(
      htmlContent,
      cssContent,
      config.siteId
    );

    // ============ NEW: Phase 3 Quality Checks ============
    // Step 5: Run post-fingerprint quality checks
    const qualityConfig = {
      trackingConfig: {
        require: config.requireTracking || true,
        trackingPixels: config.trackingPixels, // ['voluum', 'google']
      },
      googleAdsConfig: {
        required: config.requireGoogleAds || false,
        conversionId: config.googleConversionId,
      },
      lighthouseConfig: {
        thresholds: config.lighthouseThresholds || {
          performance: 95,
          accessibility: 95,
          best_practices: 95,
          seo: 95,
        },
        timeout: 120000,
      },
    };

    const qualityResults = await QualityChecker.validatePreDeploy(
      html,
      css,
      qualityConfig
    );

    // Step 6: Report results
    if (!qualityResults.passed) {
      const failures = qualityResults.criticalFailures
        .map((f) => `${f.id}: ${f.message}`)
        .join('\n');
      throw new Error(
        `Quality validation failed:\n${failures}\n\nDeploy blocked. Fix issues and rebuild.`
      );
    }

    // Step 7: Warnings (log but don't block)
    if (qualityResults.warnings.length > 0) {
      console.warn('Quality check warnings:');
      qualityResults.warnings.forEach((w) => {
        console.warn(`  ${w.id}: ${w.message}`);
      });
    }

    // Step 8: Success — return validated HTML for deploy
    return {
      success: true,
      html,
      css,
      qualityResults,
      deployReady: true,
    };
  }
}
```

**Pipeline order:**
```
Template Files
      ↓
Format Detection (Phase 2)
      ↓
Build (Astro/Vite/HTML) (Phase 2)
      ↓
Anti-Fingerprinting (Phase 2)
      ↓
Quality Checks ← START (Phase 3)
├─ Viewport validation
├─ Pixel detection
├─ Astro leak detection
├─ Google Ads validation
└─ Lighthouse 95+
      ↓
Critical failures? → Block & Report (Phase 3)
      ↓
Deploy to Cloudflare Pages
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|------------|-----|
| HTML parsing + meta tag detection | Custom regex for meta tags | cheerio (DOM parser) | Handles edge cases (whitespace, attributes order, nested structures); jQuery-like API; faster than jsdom |
| Lighthouse audits | Custom performance metrics | lighthouse npm package | Official Google tool; maintained, reliable; supports offline execution; no dependencies on external APIs |
| GCLID/conversion ID validation | Manual string parsing | Regex pattern + cheerio | GCLID format is complex; regex handles edge cases; cheerio finds elements reliably |
| Tracking pixel detection | Pattern matching from scratch | Pattern library + cheerio | Voluum and Google pixels follow known patterns; pre-compiled regex avoids recompilation cost |
| Astro expression leak detection | Custom string search | Pre-compiled regex patterns | Astro syntax variations require comprehensive patterns; compiled regex faster for repeated checks |
| API rate limit fallback | Custom retry logic | PageSpeed API + documentation | Google's documented rate limits (25k/day, 240/min); use API key to authenticate and maximize quota |

**Key insight:** Quality checks are verification, not construction. Use battle-tested tools (cheerio, lighthouse) to detect issues, not custom parsing logic.

---

## Common Pitfalls

### Pitfall 1: Lighthouse Execution Timeout or Environment Sensitivity

**What goes wrong:**
Lighthouse audit hangs (> 60 seconds) or fails to launch Chrome, blocking deploy indefinitely. Or audit runs in dev environment (no throttling) and reports inflated scores (100) that fail in production (< 95).

**Root cause:**
- Chrome instance not spawned correctly or port conflict
- Network throttling disabled (dev mode vs production mode)
- CPU/memory pressure on build server causing audit slowdown
- Undocumented dependencies (Chrome not installed, Xvfb for headless)

**How to avoid:**
1. **Set timeout:** `lighthouse({ timeout: 120000 })` — max 2 minutes, fail gracefully after
2. **Validate Chrome available:** Check `which chromium` or use `chrome-launcher` to manage lifecycle
3. **Use production settings:** Enable network throttling (`slow-4g`, `4x CPU slowdown`) to match real-world conditions
4. **Skip on CI/CD if unavailable:** Log warning but continue if Lighthouse fails (fallback to PageSpeed API or advisory-only)
5. **Cache results:** Don't re-audit identical HTML; cache Lighthouse results keyed by HTML hash

**Warning signs:**
- Lighthouse audit takes > 90 seconds
- Deploy workflow timeout (> 5 minutes total)
- Scores differ between local and CI/CD runs
- Chrome crashes or hangs in logs

**Testing approach:**
- Run Lighthouse locally on sample template; measure execution time
- Test CI/CD environment (GitHub Actions, Cloudflare Pages build context) for Chrome availability
- Verify throttling is enabled: Check Lighthouse output for `network throttling: slow-4g`

---

### Pitfall 2: Tracking Pixel False Negatives (Static Detection Misses Dynamic Pixels)

**What goes wrong:**
Quality check passes (no Voluum pixel found), but tracking pixel is injected dynamically at runtime via JavaScript. Deploy appears valid but analytics don't fire.

**Root cause:**
- Quality checker only scans static HTML; doesn't execute JavaScript
- Pixels injected via document.createElement() or jQuery append() during page load
- Third-party pixel loaders (Segment, Google Tag Manager) defer actual pixel injection

**How to avoid:**
1. **Document limitation:** Quality checks validate *static* pixels only, not runtime-injected ones
2. **Fallback detection:** If no static pixel found, check for GTM containers or Segment script (indirect tracking)
3. **Allow config override:** Let user declare "I'll inject pixel via GTM" to skip static detection
4. **Runtime validation:** In preview, manually verify pixel fires (network tab in DevTools)
5. **Log warning:** If pixel detection uncertain, log "QUAL-02: Pixel detection inconclusive; manually verify in production"

**Warning signs:**
- QA reports: "Pixel config looks right in code but doesn't fire in browser"
- Lighthouse audit passes but Voluum dashboard shows no conversions
- Pixel detection passes but analytics missing in live traffic

**Testing approach:**
- Test with GTM-injected pixel (indirect); verify quality checker handles gracefully
- Test with dynamically-created pixel element; verify false negative detected and logged
- Manually verify pixel fires in preview (open DevTools Network tab, convert)

---

### Pitfall 3: Astro Expression Leak Detection Too Strict

**What goes wrong:**
Quality check fails for false positives:
- Comment containing `import.meta.env` text (documentation comment)
- JavaScript code in a tutorial/example block that mentions env syntax
- Legitimate Vite env reference in a non-public context

**Root cause:**
- Regex pattern too broad, matches comments and non-executable code
- No distinction between executable JavaScript and HTML comments/content
- Pattern includes false positives like variable names containing "env"

**How to avoid:**
1. **Exclude comments:** Filter out HTML/CSS comments before scanning
2. **Executable context only:** Only check `<script>` tag contents and inline event handlers, skip content/text nodes
3. **Whitelist known patterns:** Allow `import.meta.env.DEV`, `import.meta.env.PROD` (safe, built-in Astro vars)
4. **Limit to PUBLIC_*:** Only flag `PUBLIC_*` vars as leaks; private env vars don't leak to frontend
5. **Log context:** If leak detected, show line number + surrounding context to user for verification

**Warning signs:**
- Quality check fails on template that works in preview
- Error message points to HTML comment or example code, not actual leak
- Regex matches "import.meta.env" in a string literal or variable name

**Testing approach:**
- Test with Astro template containing inline comments about env vars
- Test with code example block mentioning env syntax
- Test with legitimate `import.meta.env.DEV` and `PROD` (should pass)
- Test with mixed PUBLIC_ and non-PUBLIC_ env vars

---

### Pitfall 4: Viewport Validation Too Strict on Format Variations

**What goes wrong:**
Quality check fails because viewport format is non-standard:
- `<meta name="viewport" content="width=device-width, initial-scale=1.0">` (includes .0)
- `<meta name="viewport" content="width=device-width;initial-scale=1">` (semicolon instead of comma)
- `<meta name="viewport" content="initial-scale=1, width=device-width">` (reversed order)
- `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">` (extra properties)

All are functionally equivalent, but regex might reject valid variations.

**Root cause:**
- Validation regex too strict (exact string match vs semantic check)
- Multiple valid formats not documented
- No allowlist for known browser-compatible variations

**How to avoid:**
1. **Semantic validation:** Check for presence of `width=device-width`, not exact format
2. **Ignore whitespace:** Normalize spaces/commas before validation
3. **Accept common variations:**
   - `initial-scale=1`, `initial-scale=1.0` (both valid)
   - Comma or semicolon separators
   - Property order irrelevant
4. **Warn on edge cases:** Allow `maximum-scale < 3` but warn (WCAG violation)
5. **Test across browsers:** Verify accepted viewport formats work on mobile Safari, Chrome, Firefox

**Warning signs:**
- Template works fine in preview but quality check fails on viewport validation
- Error message says "viewport malformed" but mobile rendering is correct
- Same viewport format works in one template, fails in another

**Testing approach:**
- Test 5+ common viewport format variations
- Test with extra properties (maximum-scale, user-scalable)
- Test with missing initial-scale (warning, not error)
- Compare against MDN / WHATWG specifications

---

### Pitfall 5: Lighthouse Rate Limit Exhaustion at Scale

**What goes wrong:**
At 50+ daily deployments, PageSpeed API rate limits are hit (25k/day = ~174 requests/hour). Quality checks start failing with HTTP 429 after ~30 deployments.

**Root cause:**
- Assuming API quota is infinite
- No rate limit handling or request throttling
- No local fallback; all audits go to API
- Multiple simultaneous Lighthouse requests without queuing

**How to avoid:**
1. **Use local Lighthouse first:** 99% of cases; no rate limits, offline execution
2. **Implement API fallback:** Only use PageSpeed API if local execution unavailable
3. **Track API quota:** Log API calls; alert when approaching limit (> 90% used)
4. **Implement request queuing:** Queue Lighthouse requests if > 10 concurrent; process serially
5. **Cache results:** Hash HTML content; reuse Lighthouse results for identical builds (24-hour cache)
6. **Prioritize critical metrics:** If time-pressed, audit only Performance metric (fastest check) instead of all categories

**Warning signs:**
- Deploy fails with "HTTP 429 Too Many Requests" from PageSpeed API
- Lighthouse checks start failing after 30-40 daily deployments
- API quota warning in logs but no action taken

**Testing approach:**
- Benchmark Lighthouse local execution time (should be < 60 seconds)
- Test API fallback: disable local Chrome, verify API is used
- Load test: simulate 50+ concurrent deployments, verify no rate limit hits
- Verify caching: build identical template twice, check second audit uses cache

---

## Code Examples

### Example 1: Complete Quality Checker Integration

```javascript
// src/services/quality-check/index.js
import { QualityChecker } from './QualityChecker.js';
import { checkViewportMeta } from './validators/viewport-validator.js';
import { checkTrackingPixels } from './validators/pixel-validator.js';
import { checkAstroLeaks } from './validators/astro-leak-validator.js';
import { checkGoogleAdMarkers } from './validators/google-ads-validator.js';
import { checkLighthouseScores } from './validators/lighthouse-validator.js';

// Export all validators
export {
  QualityChecker,
  checkViewportMeta,
  checkTrackingPixels,
  checkAstroLeaks,
  checkGoogleAdMarkers,
  checkLighthouseScores,
};

// Export convenience function for build pipeline
export async function validateBeforeDeploy(htmlContent, cssContent, config) {
  return QualityChecker.validatePreDeploy(htmlContent, cssContent, config);
}
```

**Usage in build pipeline:**

```javascript
// src/services/build/TemplateBuilder.js
import { validateBeforeDeploy } from '../quality-check/index.js';

export class TemplateBuilder {
  async buildTemplate(files, config) {
    // ... build steps ...
    const { html, css } = await AntiFingerprint.transform(...);

    // Run quality checks
    const qualityConfig = {
      trackingConfig: { require: true },
      googleAdsConfig: { required: config.requireGoogleAds },
      lighthouseConfig: { thresholds: { performance: 95, accessibility: 95 } },
    };

    const results = await validateBeforeDeploy(html, css, qualityConfig);

    if (!results.passed) {
      const failures = results.criticalFailures
        .map((f) => `${f.id}: ${f.message}`)
        .join('\n');
      throw new Error(`Quality validation failed:\n${failures}`);
    }

    return { html, css, qualityResults: results };
  }
}
```

---

### Example 2: Viewport Validation Test

```javascript
// src/services/quality-check/__tests__/viewport-validator.test.js
import { checkViewportMeta } from '../validators/viewport-validator.js';

describe('Viewport Validator (QUAL-01)', () => {
  it('should pass when viewport meta tag is correctly configured', () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>Test</body>
      </html>
    `;

    const result = checkViewportMeta(html);
    expect(result.passed).toBe(true);
    expect(result.id).toBe('QUAL-01');
  });

  it('should fail when viewport meta tag is missing', () => {
    const html = `<html><head><title>Test</title></head><body>Test</body></html>`;
    const result = checkViewportMeta(html);

    expect(result.passed).toBe(false);
    expect(result.message).toContain('Missing viewport meta tag');
    expect(result.severity).toBe('critical');
  });

  it('should fail when viewport lacks width=device-width', () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="initial-scale=1">
        </head>
        <body>Test</body>
      </html>
    `;

    const result = checkViewportMeta(html);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('width=device-width');
  });

  it('should warn when viewport missing initial-scale', () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body>Test</body>
      </html>
    `;

    const result = checkViewportMeta(html);
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('initial-scale');
  });
});
```

---

### Example 3: Astro Leak Detection Test

```javascript
// src/services/quality-check/__tests__/astro-leak-validator.test.js
import { checkAstroLeaks } from '../validators/astro-leak-validator.js';

describe('Astro Leak Validator (QUAL-03)', () => {
  it('should pass when no Astro env expressions in HTML', () => {
    const html = `
      <html>
        <head><title>Safe</title></head>
        <body>
          <p>Brand: MyCompany</p>
          <script>const color = '#FF0000';</script>
        </body>
      </html>
    `;

    const result = checkAstroLeaks(html);
    expect(result.passed).toBe(true);
  });

  it('should fail when import.meta.env.PUBLIC_* detected', () => {
    const html = `
      <html>
        <body>
          <script>
            const brand = import.meta.env.PUBLIC_BRAND || "Default";
          </script>
        </body>
      </html>
    `;

    const result = checkAstroLeaks(html);
    expect(result.passed).toBe(false);
    expect(result.details.length).toBeGreaterThan(0);
    expect(result.details[0].expression).toContain('import.meta.env.PUBLIC_BRAND');
  });

  it('should fail when template literal ${} contains env expression', () => {
    const html = `
      <html>
        <body>
          <script>
            const url = \`https://example.com/\${import.meta.env.PUBLIC_DOMAIN}\`;
          </script>
        </body>
      </html>
    `;

    const result = checkAstroLeaks(html);
    expect(result.passed).toBe(false);
  });

  it('should ignore import.meta.env.DEV and PROD (safe built-in vars)', () => {
    const html = `
      <html>
        <body>
          <script>
            if (import.meta.env.DEV) console.log('Debug mode');
            if (import.meta.env.PROD) console.log('Production');
          </script>
        </body>
      </html>
    `;

    const result = checkAstroLeaks(html);
    expect(result.passed).toBe(true);
  });

  it('should exclude env mentions in HTML comments', () => {
    const html = `
      <html>
        <body>
          <!-- TODO: replace import.meta.env.PUBLIC_KEY here -->
          <p>Safe content</p>
        </body>
      </html>
    `;

    const result = checkAstroLeaks(html);
    // Depending on implementation, comments should be excluded
    // expect(result.passed).toBe(true);
  });
});
```

---

### Example 4: Lighthouse Integration Test

```javascript
// src/services/quality-check/__tests__/lighthouse-validator.test.js
import { checkLighthouseScores } from '../validators/lighthouse-validator.js';

describe('Lighthouse Validator (QUAL-05)', () => {
  it('should pass when all metrics >= 95', async () => {
    // Mock Lighthouse to return scores >= 95
    jest.mock('lighthouse', () => ({
      __esModule: true,
      default: jest.fn().mockResolvedValue({
        lhr: {
          lighthouseVersion: '13.0.3',
          categories: {
            performance: { score: 0.98 }, // 98/100
            accessibility: { score: 0.96 }, // 96/100
            'best-practices': { score: 0.97 }, // 97/100
            seo: { score: 0.95 }, // 95/100
          },
        },
      }),
    }));

    const result = await checkLighthouseScores('<html>...</html>', {
      thresholds: {
        performance: 95,
        accessibility: 95,
        best_practices: 95,
        seo: 95,
      },
    });

    expect(result.passed).toBe(true);
  });

  it('should fail when any metric < 95', async () => {
    // Mock Lighthouse with one low metric
    jest.mock('lighthouse', () => ({
      __esModule: true,
      default: jest.fn().mockResolvedValue({
        lhr: {
          lighthouseVersion: '13.0.3',
          categories: {
            performance: { score: 0.92 }, // 92/100 — FAIL
            accessibility: { score: 0.96 },
            'best-practices': { score: 0.97 },
            seo: { score: 0.95 },
          },
        },
      }),
    }));

    const result = await checkLighthouseScores('<html>...</html>', {
      thresholds: { performance: 95 },
    });

    expect(result.passed).toBe(false);
    expect(result.details.failures).toContainEqual(
      expect.objectContaining({
        metric: 'performance',
        score: 92,
        threshold: 95,
      })
    );
  });

  it('should fallback to PageSpeed API if local execution fails', async () => {
    // Mock local Lighthouse to fail
    jest.mock('lighthouse', () => ({
      __esModule: true,
      default: jest.fn().mockRejectedValue(new Error('Chrome not found')),
    }));

    // Mock PageSpeed API success
    jest.mock('@google-cloud/pagespeed-insights', () => ({
      PageSpeedInsights: jest.fn().mockImplementation(() => ({
        runPagespeed: jest.fn().mockResolvedValue({
          lighthouseResult: {
            categories: {
              performance: { score: 0.96 },
              accessibility: { score: 0.95 },
              'best-practices': { score: 0.97 },
              seo: { score: 0.96 },
            },
          },
        }),
      })),
    }));

    const result = await checkLighthouseScores('<html>...</html>', {
      testUrl: 'http://localhost:3000',
      thresholds: { performance: 95 },
    });

    expect(result.details.source).toBe('PageSpeed API');
  });
});
```

---

## Reference Architecture

```
Phase 2 Output (Built HTML + CSS)
         ↓
   Anti-Fingerprinting
   (AntiFingerprint.transform)
         ↓
   Final HTML (fingerprinted)
         ↓
   ┌─────────────────────────────────┐
   │  Phase 3: Quality Checks        │
   ├─────────────────────────────────┤
   │                                 │
   │  Gate 1: Viewport Meta Tag      │
   │  ├─ Parse HTML with cheerio     │
   │  ├─ Find meta[name="viewport"]  │
   │  └─ Validate width=device-width │
   │                                 │
   │  Gate 2: Tracking Pixels        │
   │  ├─ Detect Voluum (vol_pixel)   │
   │  ├─ Detect Google (gtag.js)     │
   │  └─ Verify GCLID present        │
   │                                 │
   │  Gate 3: Astro Leak Detection   │
   │  ├─ Regex: import.meta.env.*    │
   │  ├─ Regex: ${...env...}         │
   │  └─ Fail if leaks found         │
   │                                 │
   │  Gate 4: Google Ads Validation  │
   │  ├─ Find gtag.js script         │
   │  ├─ Validate conversion ID      │
   │  └─ Check GCLID parameter       │
   │                                 │
   │  Gate 5: Lighthouse 95+         │
   │  ├─ Spawn Chrome locally        │
   │  ├─ Run audit                   │
   │  └─ All metrics >= 95?          │
   │                                 │
   └─────────────────────────────────┘
         ↓
   Critical failures?
   ├─ YES: Block deploy, report errors
   └─ NO: Deploy to Cloudflare Pages
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing in package.json) |
| Config file | `jest.config.cjs` |
| Quick run command | `npm test -- --testPathPattern="quality-check" --maxWorkers=2` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01 | Viewport meta tag validation (presence + format) | unit | `npm test src/services/quality-check/__tests__/viewport-validator.test.js` | ❌ Wave 0 |
| QUAL-02 | Tracking pixel detection (Voluum + Google) | unit | `npm test src/services/quality-check/__tests__/pixel-validator.test.js` | ❌ Wave 0 |
| QUAL-03 | Astro expression leak detection | unit | `npm test src/services/quality-check/__tests__/astro-leak-validator.test.js` | ❌ Wave 0 |
| QUAL-04 | Google Ads marker validation (gtag + conversion ID + GCLID) | unit | `npm test src/services/quality-check/__tests__/google-ads-validator.test.js` | ❌ Wave 0 |
| QUAL-05 | Lighthouse 95+ enforcement (local + API fallback) | integration | `npm test src/services/quality-check/__tests__/lighthouse-validator.test.js` | ❌ Wave 0 |
| QUAL-06 | Quality check integration into build pipeline (post-fingerprint ordering) | integration | `npm test src/services/build/__tests__/quality-check-integration.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="quality-check" --maxWorkers=2` (~30 seconds)
- **Per wave merge:** `npm test` (full suite, ~90 seconds with Lighthouse tests)
- **Phase gate:** Full suite green + manual verification of Lighthouse 95+ threshold before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/services/quality-check/validators/viewport-validator.js` — QUAL-01 viewport validation
- [ ] `src/services/quality-check/validators/pixel-validator.js` — QUAL-02 tracking pixel detection
- [ ] `src/services/quality-check/validators/astro-leak-validator.js` — QUAL-03 Astro leak detection
- [ ] `src/services/quality-check/validators/google-ads-validator.js` — QUAL-04 Google Ads validation
- [ ] `src/services/quality-check/validators/lighthouse-validator.js` — QUAL-05 Lighthouse enforcement
- [ ] `src/services/quality-check/QualityChecker.js` — Orchestrator (QUAL-06)
- [ ] Test suite for all validators (unit tests)
- [ ] Integration test: Full build → fingerprint → quality check pipeline (QUAL-06)
- [ ] Mock Lighthouse for tests (avoid real Chrome launch in CI/CD)
- [ ] Framework config: Jest configured for service tests; npm test script ready

---

## State of the Art

| Aspect | Old Approach | Current Approach (Phase 3) | Impact |
|--------|--------------|---------------------------|--------|
| Deploy validation | Manual QA checklist | Automated 6-gate pipeline | Consistent, fast validation |
| Viewport verification | "Assume responsive" | Detect + validate meta tag | Catches mobile breakage early |
| Tracking pixel validation | "Hope pixel fires" | Static pattern detection + runtime warning | Catches missing pixels pre-deploy |
| Astro expression leaks | Post-deploy discovery | Pre-deploy regex scanning | Prevents bad deploys |
| Lighthouse audits | Manual Lighthouse runs | Automated local + API fallback | 95+ enforced on all deploys |
| Deploy blocking | Optional (advisory warnings) | Critical failures block immediately | Production safety |

**Phase 3 impact:** Shifts from manual QA to automated validation gates. Every deploy verified before going live.

---

## Open Questions

1. **Lighthouse API rate limits at scale?**
   - What we know: 25k/day quota, 240/min with API key
   - What's unclear: Will 50+ daily deployments exceed quota? When to switch to advisory-only mode?
   - Recommendation: Monitor API usage; implement local Lighthouse first (avoid API); use API only for fallback
   - Impact: Local Lighthouse removes rate limit concern; API is backup only

2. **False negative tolerance for tracking pixel detection?**
   - What we know: Static HTML analysis can't detect dynamically-injected pixels
   - What's unclear: What % false negative rate is acceptable? How to handle GTM-injected pixels?
   - Recommendation: Document limitation (static only); allow config flag to skip for GTM users; log inconclusive results
   - Impact: Early Phase 3 may have more warnings; iterative improvement with real deployments

3. **Lighthouse timeout strategy for slow builds?**
   - What we know: Audit takes 30-60 seconds locally
   - What's unclear: What's acceptable timeout? Should we skip Lighthouse on time pressure?
   - Recommendation: 120s timeout; fallback to warning-only if exceeded; allow skip via config `skipLighthouse: true`
   - Impact: Deploy won't block on timeout; log advisory message

4. **GCLID detection completeness?**
   - What we know: Detect GCLID in URL or form fields
   - What's unclear: What if GCLID is injected dynamically or passed server-side?
   - Recommendation: Accept URL parameter + form field patterns; document as "best effort" detection
   - Impact: May have false negatives for complex GCLID flows; acceptable for Phase 3

5. **Viewport validation strictness?**
   - What we know: Need `width=device-width` at minimum
   - What's unclear: How strict on format variations? Accept `user-scalable=0`?
   - Recommendation: Semantic check (width=device-width present), not exact format; warn on user-scalable=0 (WCAG issue)
   - Impact: Fewer false positives; accepts common variations

---

## Sources

### Primary (HIGH confidence)
- **npm lighthouse:** [lighthouse - npm](https://www.npmjs.com/package/lighthouse) — Package version 13.0.3 (current March 2026)
- **Google Lighthouse CLI:** [Lighthouse | Chrome for Developers](https://developer.chrome.com/docs/lighthouse/overview/) — Official Google tool documentation
- **cheerio:** [cheerio - npm](https://www.npmjs.com/package/cheerio) — DOM parser library, battle-tested
- **MDN Viewport Meta:** [Viewport meta tag - MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag) — Standard reference
- **Astro Environment Variables:** [Using environment variables - Astro Docs](https://docs.astro.build/en/guides/environment-variables/) — Official Astro docs
- **Google Ads Conversion Tracking:** [How Google Ads tracks website conversions - Google Ads Help](https://support.google.com/google-ads/answer/7521212?hl=en) — Official Google Ads documentation

### Secondary (MEDIUM confidence)
- **PageSpeed Insights API:** [PageSpeed Insights API: Discover Web Performance Insights](https://www.debugbear.com/blog/pagespeed-insights-api) — Rate limits and API strategy documented
- **Voluum Tracking Pixel:** [Track Conversions Using a Conversion Tracking Pixel - Voluum Documentation](https://doc.voluum.com/en/conversion_tracking_pixel.html) — Official Voluum docs
- **GCLID Format & Validation:** [Set up offline conversions using Google Click ID (GCLID)](https://support.google.com/google-ads/answer/7012522?hl=en) — Official Google Ads documentation
- **Core Web Vitals 2026:** [Core Web Vitals report - Search Console Help](https://support.google.com/webmasters/answer/9205520?hl=en) — Google Search Console documentation

### Tertiary (LOW confidence, needs validation)
- **Lighthouse execution in CI/CD:** Training data (May 2025) suggests Chrome availability may vary in Cloudflare Pages build environment — needs testing in Phase 3 planning
- **API rate limit exhaustion:** Research suggests ~174 requests/hour possible within 25k/day quota — needs validation under 50+ daily deployment load

---

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — Tools verified current; cheerio battle-tested; Lighthouse official Google tool
- **Validation rules:** HIGH — Standards documented (MDN, Google Ads, Astro); patterns well-understood
- **Pitfalls:** MEDIUM-HIGH — Documented from training data + engineering judgment; some need Phase 3 validation
- **Lighthouse API specifics:** MEDIUM — Rate limits documented by Google; local execution removes API dependency; fallback strategy mitigates concerns

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days; may need refresh if Lighthouse 14.x released or PageSpeed API quota changes)
**Review cadence:** Check if Lighthouse major version released; validate API rate limits under Phase 3 production load

---

## Next Steps (For Planner)

1. **Validate local Lighthouse in Cloudflare Pages:** Test if Chrome is available in CF Pages build environment; may need to disable or use API fallback
2. **Design Voluum integration:** Clarify tracking domain format and pixel URL patterns used in actual campaigns
3. **Configure Lighthouse thresholds:** Confirm 95+ threshold is correct; decide on per-metric vs overall score enforcement
4. **Plan API credentials:** Set up Google API key for PageSpeed fallback; document in deployment docs
5. **Create test fixtures:** Sample HTML templates with/without each quality gate (viewport, pixels, leaks, Lighthouse scores)
6. **Design error reporting:** User-friendly error messages for each QUAL-XX failure; remediation steps
7. **Batch operations planning:** Consider parallel quality checks for multiple domains (Phase 3.1+)
