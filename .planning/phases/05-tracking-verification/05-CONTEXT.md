# Phase 5: Tracking Verification - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Voluum tracking, clickid persistence, and first-party pixel all inject and fire correctly across subdomains. Implementation includes automated verification via Puppeteer to confirm actual network requests fire in the browser after build.

</domain>

<decisions>
## Implementation Decisions

### Injection Methodology
- **D-01:** Keep `inject-tracking.mjs` as the primary injection tool to maintain flexibility across Astro, Vite, and plain HTML templates.
- **D-02:** Injection remains a "post-build" or "pre-deploy" step that performs direct string-based manipulation on layout/index files.

### Persistence (clickid & GCLID)
- **D-03:** Use First-party Cookies instead of `sessionStorage` for storing the `clickid` and `gclid`.
- **D-04:** Cookie TTL set to 30 days to support cross-subdomain persistence (e.g., from `promo.site.com` to `apply.site.com`).

### Verification & Automated Testing
- **D-05:** Implement an automated verification system using Puppeteer.
- **D-06:** The system must check for actual network requests (beacons) sent to the pixel endpoint (`t.*.com/e`) and to Voluum during page load.

### Order of Injection
- **D-07:** Voluum (`dtpCallback`) must always be the first script in the `<head>` tag to maximize tracking accuracy.

### the agent's Discretion
- Exact JavaScript implementation of the cookie setter/getter in `inject-tracking.mjs`.
- Logic for handling multiple clickid variants in the URL params.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tracking Injection
- `scripts/inject-tracking.mjs` -- Current injection logic for Voluum and Pixel snippets.
- `packages/lp-template-generator/src/shared/unified-tracking.js` -- Shared tracking constants and logic.

### Verification
- `scripts/validate-template-tracking.mjs` -- Existing tracking validator (needs expansion for Puppeteer).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `inject-tracking.mjs`: `VOLUUM_HEAD_SNIPPET`, `GCLID_CAPTURE_SNIPPET`, `PIXEL_BODY_SNIPPET`
- `inject-tracking.mjs`: `injectIntoAstro`, `injectIntoHtmlOrVite` logic

### Established Patterns
- First-party tracking sent to `t.{hostname}/e` via `Image` beacons.
- Environment variables (`PUBLIC_*`) processed by Astro and Vite at build time.

### Integration Points
- `apply.astro`: Source for the leads form which needs to read the cookie value.

</code_context>

<specifics>
## Specific Ideas

- **Cross-subdomain support**: The cookie must be set on the root domain (e.g., `.domain.com`) to be visible on all subdomains.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 05-tracking-verification*
*Context gathered: 2026-03-22*
