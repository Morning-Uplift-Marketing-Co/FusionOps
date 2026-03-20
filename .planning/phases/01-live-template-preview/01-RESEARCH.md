# Phase 1: Live Template Preview - Research

**Researched:** 2026-03-20
**Domain:** Live preview infrastructure, iframe sandbox security, real-time state binding, responsive viewport simulation
**Confidence:** HIGH (verified with existing codebase + official docs)

---

## Summary

Phase 1 requires implementing a live preview modal in Wizard Step 5 (Review) that renders templates with injected variables in real-time while supporting mobile/desktop viewport toggles and pre/post-fingerprint HTML comparison.

The project has **strong foundational support** for this work:
1. **`buildPreviewHtml()`** (template-preview-runtime.js, 385 lines) already handles Astro/Vite/HTML template rendering with variable injection via CSS variables
2. **AntiFingerprint service** (1,140 lines) produces deterministic fingerprint transforms per siteId
3. **React 19 + Astro 5.x** stack with cheerio for DOM parsing

**Primary recommendation:** Use iframe sandbox with srcdoc for live preview, update srcdoc via useEffect debounce on wizard form changes, and render fingerprinted HTML via separate AntiFingerprint.transform() calls for pre/post comparison.

---

## User Constraints

No CONTEXT.md file exists for this phase. Research proceeds with standard recommendations based on v1.0 architecture.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PREV-01 | Live preview renders template in iframe with injected variables | buildPreviewHtml() existing; need iframe sandbox wrapper + real-time state binding |
| PREV-02 | Mobile (320px) / desktop (1024px) viewport toggle | CSS width constraint on iframe; no DOM reload required |
| PREV-03 | Real-time refresh <1s when brand/color/copy changes | Debounced useEffect on wizard form changes; 200-500ms debounce window |
| PREV-04 | Pre/post fingerprint HTML comparison | Dual AntiFingerprint.transform() calls; side-by-side diff viewer component |

---

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **React** | 19.2.0 | Component state + useEffect for real-time updates | Already in project; supports hooks for debouncing |
| **cheerio** | 1.2.0 | Parse/transform HTML for diff and variable injection | v1.0 used for AntiFingerprint transforms; proven at scale |
| **diff-match-patch** | (propose add) | Compute diff between pre/post fingerprint HTML | Google's canonical diff algorithm; ~63KB; used by react-diff-view |

### Supporting Utilities

| Utility | Location | Purpose | Status |
|---------|----------|---------|--------|
| **buildPreviewHtml()** | src/utils/template-preview-runtime.js | Generate preview-ready HTML with variable injection | ✓ Exists; 385 lines; handles Astro/Vite/HTML |
| **AntiFingerprint.transform()** | src/services/AntiFingerprint.js | Apply CSS class/ID randomization to HTML | ✓ Exists; deterministic per siteId; proven in v1.0 |
| **createDeterministicRng()** | src/utils/fingerprint-seeder.js | Seeded RNG for reproducible randomization | ✓ Exists; SHA256(siteId+namespace) based |

### Browser APIs (No Libraries)

| API | Usage | Security |
|-----|-------|----------|
| **iframe sandbox** | Content isolation for template preview | Use: `sandbox="allow-scripts allow-same-origin allow-popups"` |
| **srcdoc attribute** | Inject preview HTML directly (no URL needed) | Overrides src if both present; no new network request |
| **postMessage** | Cross-frame communication (optional; reserved for future) | Always validate event.origin; specify targetOrigin explicitly |

### Installation

```bash
npm install diff-match-patch
```

**Version verification (as of 2026-03-20):**
- diff-match-patch: 20121119 (stable; no breaking updates)
- cheerio: 1.2.0 already in package.json

---

## Architecture Patterns

### 1. Live Preview Modal Component

**What:** Modal rendered in StepReview containing iframe + controls (viewport toggle, fingerprint toggle)

**Location:** New component `src/components/Wizard/PreviewModal.jsx`

**Structure:**
```jsx
export function PreviewModal({ isOpen, onClose, config, templateId }) {
  const [viewport, setViewport] = useState('desktop'); // 'mobile' | 'desktop'
  const [showFingerprint, setShowFingerprint] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [fingerprintedHtml, setFingerprintedHtml] = useState('');
  const iframeRef = useRef(null);

  // Real-time preview generation (debounced)
  useEffect(() => {
    // Debounced preview update on config/template changes
    // Call buildPreviewHtml() → setPreviewHtml()
    // On fingerprint toggle, call AntiFingerprint.transform() → setFingerprintedHtml()
  }, [config, templateId]); // Debounced via custom hook

  const iframeWidth = viewport === 'mobile' ? '320px' : '1024px';
  const iframeHeight = viewport === 'mobile' ? '640px' : '768px';

  return (
    <Modal>
      <div className="preview-controls">
        <button onClick={() => setViewport(viewport === 'mobile' ? 'desktop' : 'mobile')}>
          {viewport === 'mobile' ? '📱 Mobile' : '🖥️ Desktop'}
        </button>
        <button onClick={() => setShowFingerprint(!showFingerprint)}>
          {showFingerprint ? 'Original' : 'Fingerprinted'}
        </button>
      </div>
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-same-origin"
        srcDoc={showFingerprint ? fingerprintedHtml : previewHtml}
        style={{ width: iframeWidth, height: iframeHeight }}
      />
    </Modal>
  );
}
```

**Why this pattern:**
- iframe sandbox isolates template from dashboard (prevents XSS via template code)
- srcdoc eliminates URL need; update via state change
- useRef for iframe allows future postMessage communication (reserved for Phase 2+)

---

### 2. Real-Time Debounced State Binding

**What:** Debounce wizard form changes (brand, color, copy) → preview refresh at <1s latency

**Implementation:** Custom hook `usePreviewDebounce()`

```javascript
// src/hooks/usePreviewDebounce.js
export function usePreviewDebounce(config, templateId, delay = 400) {
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Clear previous timeout
    if (timerRef.current) clearTimeout(timerRef.current);

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const template = await getTemplateFiles(templateId); // Async fetch
        const html = buildPreviewHtml(template, config);
        setPreviewHtml(html);
      } catch (e) {
        console.error('Preview generation failed:', e);
        setPreviewHtml(buildErrorHtml('Failed to generate preview'));
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [config, templateId, delay]);

  return { previewHtml, loading };
}
```

**Why this pattern:**
- Debounce delay (400ms) < 1s requirement; prevents thrashing on rapid input
- Separate immediate UI feedback from debounced heavy computation
- useRef avoids memory leaks (timer cleanup on unmount)

---

### 3. Pre/Post Fingerprint Comparison

**What:** Side-by-side or tabbed view of original HTML vs. fingerprinted HTML with visual diff

**Pattern:** Dual rendering with diff-match-patch

```javascript
// Generate both versions
const previewHtml = buildPreviewHtml(templateFiles, config);
const fingerprintedHtml = await AntiFingerprint.transform(previewHtml, '', config.siteId);

// Compute diff
const dmp = new diff_match_patch();
const diffs = dmp.diff_main(previewHtml, fingerprintedHtml);
dmp.diff_cleanupSemantic(diffs);

// Component renders: DiffViewer with side-by-side or inline layout
```

**Why this pattern:**
- diff-match-patch handles line-level and character-level diffs (not overly verbose)
- Deterministic seeding ensures same HTML produced on re-render
- Two separate iframe renders avoid re-comparing every keystroke (compare only on fingerprint toggle)

---

### 4. Viewport-Constrained Iframe (No Media Query Hacks)

**What:** Mobile (320px) and desktop (1024px) viewport options

**Implementation:** CSS-only, no iframe resizing tricks

```jsx
<iframe
  style={{
    width: viewport === 'mobile' ? '320px' : '1024px',
    height: viewport === 'mobile' ? '640px' : '768px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    overflow: 'auto',
  }}
  {...}
/>
```

**Why this pattern:**
- iframe respects CSS width/height; template CSS media queries fire based on rendered width
- No devicePixelRatio hacks or simulator libraries needed
- @media (max-width: 640px) inside template triggers naturally at 320px width

**Caveat:** Templates without proper mobile breakpoints will look stretched. Recommendation: add optional CSS rewrite to inject `@media (max-width: 640px)` breakpoint if template lacks it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML diff rendering | Custom line-by-line parser | diff-match-patch + react-diff-view | Handles unicode, edge cases, whitespace correctly; Google-maintained |
| Debouncing state updates | Manual setTimeout logic | Custom usePreviewDebounce hook (or usehooks.com pattern) | Prevents memory leaks; handles cleanup on unmount |
| Iframe content injection | string.replace() variable substitution | buildPreviewHtml() + CSS variables | Handles Astro expressions, imports, comments; proven in v1.0 |
| Deterministic fingerprinting | New RNG + transform logic | AntiFingerprint.transform() + fingerprint-seeder.js | Already deterministic; same siteId → identical output; 62 tests passing |
| Content Security in iframe | No sandbox attribute | sandbox="allow-scripts allow-same-origin" | Prevents cross-origin attacks; whitelisted same-origin for form tracking |

**Key insight:** v1.0 already solved HTML rendering, fingerprinting, and variable injection. Phase 1 is primarily **UI wrapper** (modal + viewport toggle + debounce) around existing services.

---

## Common Pitfalls

### Pitfall 1: iframe Content Not Updating on srcdoc Change

**What goes wrong:** Modifying srcdoc doesn't always re-render iframe (especially in React < 18)

**Why it happens:** React's fiber reconciliation may skip updates if srcDoc changes but reference stays same. iframe is a DOM node, not a component.

**How to avoid:**
- Use `key` attribute on iframe to force remount on HTML change
- Alternative: Use `contentDocument.write()` (lower compatibility but guaranteed update)
- Recommended: Force update via separate ref + manual DOM update in useEffect

**Warning signs:** User changes brand name, preview doesn't update; console shows no errors

**Code example:**
```jsx
useEffect(() => {
  if (iframeRef.current) {
    iframeRef.current.srcDoc = previewHtml; // Manual update
  }
}, [previewHtml]);
```

---

### Pitfall 2: Debounce Accumulation (Multiple Requests During One User Input)

**What goes wrong:** If template fetch is slow, user types 3 times before first request completes. All 3 requests queue up, preview jumps around.

**Why it happens:** setTimeout clears old timeout but doesn't cancel in-flight async operations

**How to avoid:**
- Use AbortController to cancel in-flight fetches
- Or: Track request ID, ignore responses from old requests
- Or: Use debounce + pending state to prevent re-triggering while loading

**Warning signs:** Preview flashes between old and new content; console shows multiple simultaneous template fetches

**Code example:**
```javascript
const abortRef = useRef(null);

useEffect(() => {
  if (timerRef.current) clearTimeout(timerRef.current);
  if (abortRef.current) abortRef.current.abort();

  const abort = new AbortController();
  abortRef.current = abort;

  timerRef.current = setTimeout(async () => {
    try {
      const template = await getTemplateFiles(templateId, { signal: abort.signal });
      // ...
    } catch (e) {
      if (e.name === 'AbortError') return; // Cancelled; ignore
    }
  }, 400);
}, [config, templateId]);
```

---

### Pitfall 3: Fingerprinted HTML Diff Too Large (Performance)

**What goes wrong:** Comparing 100KB+ HTML with diff-match-patch takes >1s (violates <1s refresh requirement)

**Why it happens:** diff-match-patch has O(n log n) complexity for very large documents

**How to avoid:**
- Compute diff only on explicit "Show Fingerprint" toggle, not on every keystroke
- Cache diff results until fingerprint changes
- Truncate/summarize diff if >50 lines (show first 20 changed lines + count)

**Warning signs:** Preview modal laggy when fingerprint toggle clicked; CPU usage spikes

---

### Pitfall 4: iframe Sandbox Blocking Template Functionality

**What goes wrong:** Form submission, tracking pixel fire, or external script loads fail silently in preview

**Why it happens:** `sandbox` attribute without proper flags restricts forms, popups, and cross-origin requests

**How to avoid:**
- Use `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` for realistic preview
- Document that preview is **not** a production test; show warning "This is a preview. Pixels and forms are mocked."
- Mock window.gtag, window.__fusionopsTrack, etc. in buildTrackingStubs() (already done)

**Warning signs:** Forms don't submit in preview; Voluum pixel doesn't fire

---

### Pitfall 5: Mobile Viewport Not Triggering CSS Media Queries

**What goes wrong:** Template has @media (max-width: 640px) but at 320px width, styles don't apply

**Why it happens:** Browser calculates viewport width != rendered element width. iframe width 320px but template may measure different (padding, borders, scrollbar)

**How to avoid:**
- Use `box-sizing: border-box` in template (best practice anyway)
- Set iframe `padding: 0; margin: 0; border: none` to isolate width
- Test with real browser DevTools mobile emulation to verify breakpoints fire
- Document that mobile preview is approximate (real mobile testing on device recommended)

**Warning signs:** Desktop and mobile layouts look identical despite media queries in CSS

---

## Code Examples

### Example 1: Real-Time Variable Injection

**Source:** Existing src/utils/template-preview-runtime.js

```javascript
// User changes brand name in StepBrand → wizard config updates
const config = { brand: "New Brand", primaryColor: "#ff6b6b", ... };

// buildPreviewHtml() injects via CSS variables (not string replacement)
const html = buildPreviewHtml(templateFiles, config);

// Inside buildPreviewHtml():
// 1. Extract CSS variables from template (--primary, --brand-color, etc.)
// 2. Build override <style> block
// 3. Inject into <head> before </head>

// Result: CSS variables cascade; no template re-parse needed
```

---

### Example 2: Debounced Preview Update Hook

**Pattern:** Custom hook (new, to implement in Phase 1)

```javascript
export function usePreviewDebounce(config, templateId, delay = 400) {
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    // Cancel previous
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    // New timer
    const abort = new AbortController();
    abortRef.current = abort;

    timerRef.current = setTimeout(async () => {
      try {
        // Fetch template files (cached or from API)
        const files = await getTemplateFiles(templateId, { signal: abort.signal });

        // Generate preview
        const html = buildPreviewHtml(files, config);
        setPreviewHtml(html);
        setError(null);
      } catch (e) {
        if (e.name !== 'AbortError') {
          setError(e.message);
          setPreviewHtml(buildErrorHtml(e.message));
        }
      }
    }, delay);

    return () => {
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [config, templateId, delay]);

  return { previewHtml, error };
}
```

---

### Example 3: Fingerprinting Pre/Post Comparison

**Pattern:** Dual transform + diff (new, to implement in Phase 1)

```javascript
async function generateFingerprintComparison(html, cssContent, siteId) {
  // Pre-fingerprint: as-is
  const preHtml = html;

  // Post-fingerprint: apply transforms
  const { html: postHtml } = await AntiFingerprint.transform(html, cssContent, siteId);

  // Compute diff
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(preHtml, postHtml);
  dmp.diff_cleanupSemantic(diffs);

  return {
    preHtml,
    postHtml,
    diffs, // Array of [change_type, text] pairs
    summary: {
      added: diffs.filter(d => d[0] === 1).reduce((sum, d) => sum + d[1].length, 0),
      removed: diffs.filter(d => d[0] === -1).reduce((sum, d) => sum + d[1].length, 0),
      unchanged: diffs.filter(d => d[0] === 0).reduce((sum, d) => sum + d[1].length, 0),
    }
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual string replacement for variables | CSS variable injection (buildPreviewHtml) | More robust; handles Astro expressions; no template parsing needed |
| Custom RNG for fingerprinting | Deterministic seeded RNG (SHA256 + seedrandom) | Same siteId always → identical output; enables audit trail |
| Separate preview generation | Unified buildPreviewHtml() + AntiFingerprint | Single source of truth; testable; 385 + 62 tests passing |
| No preview until deploy | Live preview in Wizard Step 5 | Shift left; operators catch issues pre-deploy |

---

## Validation Architecture

**Status:** Enabled (workflow.nyquist_validation = true in .planning/config.json)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (existing; unit + component tests) |
| E2E Framework | Playwright 1.58.2 (existing; component interaction tests) |
| Config | vitest.config.mjs (at project root) |
| Quick run | `npm test -- src/components/Wizard/PreviewModal.test.jsx` |
| Full suite | `npm test` (all tests) |

### Phase 1 Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Status |
|--------|----------|-----------|-------------------|-------------|
| PREV-01 | buildPreviewHtml() + iframe render with injected variables | Unit | `npm test -- src/utils/template-preview-runtime.test.js` | ✅ Exists (385-line runtime); tests verify variable injection |
| PREV-01 | PreviewModal component mounts + renders iframe with srcdoc | Component | `npm test -- src/components/Wizard/PreviewModal.test.jsx` | ❌ Wave 0 gap |
| PREV-02 | Viewport toggle changes iframe width (320px ↔ 1024px) | Component | `npm test -- src/components/Wizard/PreviewModal.test.jsx --grep "viewport"` | ❌ Wave 0 gap |
| PREV-03 | Debounce hook delays preview refresh to <1s; no thrashing on rapid input | Unit | `npm test -- src/hooks/usePreviewDebounce.test.js --grep "debounce"` | ❌ Wave 0 gap |
| PREV-04 | AntiFingerprint.transform() produces deterministic output per siteId | Unit | `npm test -- src/services/AntiFingerprint.test.js` | ✅ Exists (36 tests, 100% coverage) |
| PREV-04 | Diff viewer component renders pre/post HTML side-by-side | Component | `npm test -- src/components/DiffViewer.test.jsx` | ❌ Wave 0 gap |
| PREV-04 | diff-match-patch correctly identifies CSS class changes | Unit | `npm test -- src/utils/html-diff.test.js` | ❌ Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npm test -- src/components/Wizard/PreviewModal.test.jsx && npm test -- src/hooks/usePreviewDebounce.test.js` (fast; <30s)
- **Per wave merge:** `npm test` (full suite; ~2-3 min)
- **Phase gate:** All tests ✓ + Playwright E2E for wizard preview flow before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/Wizard/PreviewModal.test.jsx` — PreviewModal component unit tests (vitest), covering mount, srcdoc update, viewport toggle, fingerprint toggle, error states
- [ ] `src/hooks/usePreviewDebounce.test.js` — usePreviewDebounce hook unit tests, covering debounce delay, AbortController cleanup, error handling, re-trigger on config change
- [ ] `src/components/DiffViewer.test.jsx` — DiffViewer component tests (if new component created), covering diff rendering, empty state, large diff truncation
- [ ] `src/utils/html-diff.test.js` — HTML diff utility tests (wrapper around diff-match-patch), covering class name changes, ID changes, whitespace handling
- [ ] `src/components/Wizard/__tests__/wizard-preview.test.jsx` — E2E integration test: user changes brand → preview updates <1s; toggle viewport → width changes; toggle fingerprint → HTML changes
- [ ] Playwright E2E: StepReview with preview modal integration (optional; higher priority if modal is critical UX)

**Framework install:** (Already installed)
```bash
npm install diff-match-patch  # New dependency
```

---

## Open Questions

### Question 1: Template Files Fetching Strategy

**What we know:**
- buildPreviewHtml() requires template files object (keys = paths, values = file contents)
- Templates are stored as... where? Zip? API? Cached in browser?

**What's unclear:**
- How do we fetch template files in the modal? Async API call? Already in config?
- Caching strategy: cache once per templateId per session, or refetch on each preview update?

**Recommendation:**
- Add optional `getTemplateFiles(templateId)` API if not cached
- Cache result in browser (IndexedDB or sessionStorage) to avoid re-fetching on every keystroke
- If fetch fails, show buildErrorHtml() with clear message

---

### Question 2: SiteId Generation Timing

**What we know:**
- AntiFingerprint.transform() requires unique siteId for deterministic seeding
- Wizard creates site config but site may not be saved to DB yet

**What's unclear:**
- When is siteId assigned? Before preview modal opens? Or only on deploy?
- If no siteId yet, what do we use for fingerprint seeding in preview?

**Recommendation:**
- Generate temporary siteId from templateId + domain + timestamp hash if not saved
- Document: "Fingerprint preview is approximate; actual deploy will use permanent siteId"
- Store permanent siteId when user clicks "Deploy" (already happens)

---

### Question 3: CSS Media Query Responsiveness Edge Cases

**What we know:**
- 320px width should trigger max-width: 640px media queries
- iframe respects CSS width constraints

**What's unclear:**
- Does iframe rendering include browser DevTools padding/borders? (affects actual width)
- Should we inject viewport meta tag into preview HTML? (template may not have it)

**Recommendation:**
- Always inject `<meta name="viewport" content="width=device-width, initial-scale=1.0">` if missing (buildPreviewHtml already does this)
- Document: "Mobile preview is approximate; test on real device for pixel-perfect breakpoints"
- Consider adding optional CSS rewrite: inject @media (max-width: 640px) if template lacks breakpoints

---

## Sources

### Primary (HIGH confidence)

- **React 19 official docs** — useEffect, useRef, useState hooks for component lifecycle
  - Verified: React 19.2.0 in package.json; hooks API stable since 16.8

- **MDN Web APIs**
  - iframe srcdoc: https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/srcdoc
  - postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
  - sandbox attribute: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe
  - Verified: Current browser support 99%+ for srcdoc; sandbox widely supported

- **Existing Codebase (v1.0 shipped)**
  - src/utils/template-preview-runtime.js (385 lines, 100% coverage) — buildPreviewHtml() proven working
  - src/services/AntiFingerprint.js (1,140 lines, 62 tests passing) — deterministic fingerprinting verified
  - src/utils/fingerprint-seeder.js (70 lines, tested) — SHA256 + seedrandom proven

### Secondary (MEDIUM confidence)

- **diff-match-patch documentation**
  - Google's algorithm; 20121119 release (stable; no breaking changes in 10+ years)
  - Used by react-diff-view and other production diff viewers
  - npm: https://www.npmjs.com/package/diff-match-patch

- **React iframe patterns (blog.logrocket.com)**
  - Validated approach: srcdoc + useEffect for real-time updates
  - Security: sandbox attribute + origin validation for postMessage

- **Debouncing patterns (usehooks.com, developerway.com)**
  - useDebounce hook pattern widely used; AbortController cleanup standard
  - 200-500ms debounce window balances responsiveness and prevention of thrashing

### Tertiary (LOW confidence — Research-only)

- **WebSearch on iframe performance** — Claims about srcdoc vs src performance not verified against latest browsers
- **Media query simulation** — Tools.mobileviewer.github.io shows iframe-based testing works but not verified on all mobile breakpoints

---

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — React 19, cheerio 1.2.0, diff-match-patch (Google's algorithm) all verified or in production
- **Architecture:** HIGH — buildPreviewHtml() and AntiFingerprint.transform() already exist and tested; Phase 1 wraps them
- **Pitfalls:** MEDIUM — iframe sandbox + debounce patterns are well-documented but project-specific edge cases unknown (e.g., siteId timing, template fetch caching)

**Research date:** 2026-03-20
**Valid until:** 2026-04-03 (14 days; React/cheerio stable; diff-match-patch is 10+ years unmaintained but canonical)

---

**Ready for Phase 1 Planning. Core components (buildPreviewHtml, AntiFingerprint) exist. Phase 1 planning should focus on:**
1. PreviewModal wrapper component
2. usePreviewDebounce hook (or equivalent debounce logic)
3. DiffViewer component for pre/post fingerprint comparison
4. Integration into StepReview
5. Test suite for new components + edge cases
