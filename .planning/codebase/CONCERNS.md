# Codebase Concerns

**Analysis Date:** 2026-03-22

## Tech Debt

**Monolithic UI modules:**
- Issue: Several React modules exceed 1k lines and mix routing, API calls, and presentation, increasing merge conflict risk and slowing refactors.
- Files: `src/components/OpsCenter.jsx` (~3085 lines), `src/utils/astro-generator.jsx` (~2647 lines), `src/utils/lp-generator.js` (~1151 lines), `src/components/ProfileManager.jsx` (~1077 lines), `src/App.jsx` (~1064 lines), `src/utils/template-router.js` (~1017 lines), `src/components/Wizard/StepTracking.jsx` (~1004 lines), `src/components/Settings.jsx` (~963 lines), `src/components/Sites.jsx` (~915 lines)
- Impact: Harder onboarding, higher bug rate when touching flows, limited unit-test surface without splitting.
- Fix approach: Extract sub-features into colocated folders (e.g. `OpsCenter/` with hooks + presentational pieces), shared hooks for API calls, and thin route/container components.

**Duplicate component trees:**
- Issue: The same filenames exist under `src/components/` and a root-level `components/` directory (e.g. `ChangelogViewer.jsx` in both). Edits can land in the wrong tree and diverge.
- Files: `src/components/ChangelogViewer.jsx`, `components/ChangelogViewer.jsx` (and similar duplication patterns elsewhere)
- Impact: Stale UI, inconsistent fixes, confusing imports for contributors.
- Fix approach: Pick a single canonical path (`src/components/`), delete or re-export from the other, add lint/import rules to block the duplicate root.

**Hardcoded production API base:**
- Issue: `resolveApiBase()` falls back to a fixed Cloudflare Workers URL when `window.__LP_API__` and `VITE_API_BASE` are unset.
- Files: `src/services/api.js`
- Impact: Wrong environment targeting if misconfigured; harder to swap staging/canary without code changes.
- Fix approach: Require explicit `PUBLIC_` / build-time API base for production builds; fail fast in CI when unset.

**Hardcoded org in deploy helper:**
- Issue: `scripts/deploy-org.js` embeds a fixed GitHub org string for repo creation.
- Files: `scripts/deploy-org.js`
- Impact: Script is not reusable; wrong org if copied to another project.
- Fix approach: Read org from `process.env` or CLI args with validation.

**Unused dependency:**
- Issue: The `install` package is listed in `package.json` dependencies but has no imports in the repo.
- Files: `package.json`
- Impact: Larger install surface and potential confusion; `install` is a known typo-squat style package name in the ecosystem.
- Fix approach: Remove after confirming no transitive requirement; run install and tests.

**E2E fixture stubs:**
- Issue: Playwright fixtures reference future auth flows with TODO comments.
- Files: `tests/e2e/fixtures/fixtures.ts`
- Impact: Auth-gated journeys may be skipped or manually patched.
- Fix approach: Implement login/logout helpers when auth exists, or document explicit `@skip` reasons.

**Template generator placeholders:**
- Issue: `StepTemplateFromDir.jsx` contains TODOs for customization and extra assets.
- Files: `src/components/TemplateGenerator/steps/StepTemplateFromDir.jsx`
- Impact: Incomplete guidance for operators extending templates.
- Fix approach: Replace TODOs with concrete extension points or docs links.

## Known Bugs

**Not enumerated:** No separate bug tracker was consulted; triage should use issue tracker and failing tests.

## Security Considerations

**Server-side logging of pixel payloads:**
- Risk: `POST` handler parses JSON and logs the body; production logs may capture PII or click identifiers.
- Files: `src/pages/e.ts`
- Current mitigation: Errors swallowed; returns `204` without echoing body to client.
- Recommendations: Redact or sample logs; gate verbose logging behind `import.meta.env.DEV`; consider structured logging with field allowlists.

**Client-only CSRF token:**
- Risk: `getCsrfToken()` stores a random token in `sessionStorage` and sends `X-CSRF-Token` on mutations; effectiveness depends on the Workers API validating it.
- Files: `src/services/api.js`
- Current mitigation: Token sent only for same-origin targets (per URL origin check).
- Recommendations: Confirm server-side CSRF/session binding; document contract in API docs.

**Dynamic code execution in template preview:**
- Risk: `Function(...)` parses array literals extracted from uploaded/custom template files for Astro preview.
- Files: `src/utils/template-router.js` (array scope parsing)
- Current mitigation: Scoped to array literal text; failures ignored.
- Recommendations: Treat custom templates as untrusted input in multi-tenant scenarios; sandbox or restrict upload sources; add tests for malicious literals.

**Markdown rendered to HTML:**
- Risk: `ChangelogViewer` uses `dangerouslySetInnerHTML` after a regex-based markdown transform.
- Files: `src/components/ChangelogViewer.jsx`
- Current mitigation: Source is bundled `CHANGELOG.md` from the repo (trusted at build time).
- Recommendations: If the source ever becomes user-editable or fetched remotely, switch to a hardened markdown pipeline (sanitize HTML).

**Deploy script token use:**
- Risk: `scripts/deploy-org.js` uses `GITHUB_TOKEN` from the environment for org API calls.
- Files: `scripts/deploy-org.js`
- Current mitigation: Token not committed; standard env usage.
- Recommendations: Never log token; use least-privilege PAT/scopes; rotate if leaked.

## Performance Bottlenecks

**Large client bundles / hot paths:**
- Problem: Very large JSX utilities may increase parse/hydration cost and slow edits.
- Files: `src/components/OpsCenter.jsx`, `src/utils/astro-generator.jsx`, `src/utils/template-router.js`
- Cause: Single-module responsibility growth without code-splitting.
- Improvement path: Lazy-load tabs/sections (`React.lazy`), split generators, memoize heavy child trees.

**Template router preview pipeline:**
- Problem: Multiple fallback paths (module generator, Astro preview, regex transforms) can run in sequence on failure.
- Files: `src/utils/template-router.js`
- Cause: Defensive fallbacks and logging on failure paths.
- Improvement path: Short-circuit when format is known; cache preview HTML per template version.

## Fragile Areas

**Template routing and preview (`template-router`):**
- Files: `src/utils/template-router.js`
- Why fragile: Combines regex transforms, optional `new Function` parsing, and framework detection; small input changes can break preview parity with real Astro builds.
- Safe modification: Add golden-file tests for representative templates; avoid broad regex edits without fixtures.
- Test coverage: Partially covered by `src/__tests__` and build pipeline tests; large JSX surface in OpsCenter remains mostly E2E (`tests/e2e/ops-center/`).

**Module template ID list:**
- Problem: `MODULE_TEMPLATE_IDS` is a hand-maintained array; drift when adding templates causes wrong code paths.
- Files: `src/utils/template-router.js`
- Safe modification: Generate from `packages/lp-template-generator` manifest or a single registry module.
- Test coverage: Add unit test that every exported template id is listed.

**Deploy and site generation flows:**
- Files: `src/components/Sites.jsx` (verbose `console.log` debug blocks), `src/utils/deployers/*`
- Why fragile: Many branches (git-push vs other targets); failures surface late in deploy.
- Safe modification: Centralize deploy orchestration in a small service module with typed results; reduce console noise in production builds.

## Scaling Limits

**Single default API host:**
- Current capacity: One production Workers hostname in client fallback.
- Limit: No client-side load balancing or regional routing.
- Scaling path: DNS/API gateway, env-specific bases, health-aware client selection.

**Neon serverless usage:**
- Files: `src/services/neon.js`, `src/services/profile-linker.js`
- Limit: Connection limits and latency for bursty UI operations.
- Scaling path: Pool tuning (where applicable), batching writes, moving heavy work to background jobs.

## Dependencies at Risk

**`install` (npm package):**
- Risk: Unused direct dependency; name is commonly mistaken for npm CLI behavior.
- Impact: Noise in audits and supply-chain review surface.
- Migration plan: Remove from `package.json` after verification.

## Missing Critical Features

**Authenticated E2E flows:**
- Problem: Fixtures note missing login/logout; protected flows may lack automation.
- Blocks: Full regression coverage for multi-user scenarios.
- Files: `tests/e2e/fixtures/fixtures.ts`

## Test Coverage Gaps

**Excluded generated templates in coverage:**
- What's not tested: `src/templates/**` is excluded from Vitest coverage (`vitest.config.ts`).
- Files: `vitest.config.ts`, large trees under `src/templates/`
- Risk: Generated or copied landers can drift without unit signal.
- Priority: Medium (mitigated by E2E and manual QA for some flows).

**Very large components with sparse unit tests:**
- What's not tested: Deep branches in `OpsCenter.jsx` and `astro-generator.jsx` relative to file size.
- Files: `src/components/OpsCenter.jsx`, `src/utils/astro-generator.jsx`
- Risk: Regressions in rarely used tabs/actions.
- Priority: High for revenue-critical paths; Medium elsewhere.

**Pixel API route:**
- What's not tested: `src/pages/e.ts` has no dedicated test for POST body handling or logging behavior.
- Files: `src/pages/e.ts`
- Risk: Logging or parsing changes break analytics silently.
- Priority: Low–Medium depending on compliance requirements.

---

*Concerns audit: 2026-03-22*
