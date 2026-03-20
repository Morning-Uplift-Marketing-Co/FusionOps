# Concerns

## Tech Debt

### Dual Directory Structure (HIGH)
Files duplicated between root-level (`components/`, `services/`, `utils/`) and `src/` directories. The root-level versions appear to be legacy mirrors. Risk of edits diverging between the two.
- `components/TemplateGenerator/` ↔ `src/components/TemplateGenerator/`
- `services/api.js` ↔ `src/services/api.js`
- `utils/template-router.js` ↔ `src/utils/template-router.js`

### Monolithic App.jsx (HIGH)
`App.jsx` is ~800+ lines with all state management, side effects, and routing logic in one component. Contains 15+ `useState` calls and complex initialization logic.

### No State Management Library (MEDIUM)
All app state lifted to `App.jsx` and passed as props. This creates prop drilling and makes state updates hard to trace. No context providers or state library used.

### Accumulated Artifacts (LOW)
Multiple debug/log/screenshot files at root level: `astro_check*.txt`, `deploy_output*.txt`, `*.jpg` screenshots, `*.log` files, `tmp_check.html`. Should be gitignored or cleaned.

### Debug Console.log Pollution (MEDIUM)
~209 `console.log` calls across 51 files. Should be cleaned up or replaced with structured logging.

### Deprecated Backup Files (LOW)

Files like `DeploySection_OLD.jsx.bak` still in the codebase. Should be removed.

## Security Concerns

### LocalStorage Token Storage (MEDIUM)
JWT tokens and settings stored in `localStorage` — vulnerable to XSS. The `LS` utility wrapper doesn't encrypt sensitive data.

### Client-Side CSRF (LOW)
CSRF token is generated client-side via `crypto.randomUUID()` and stored in `sessionStorage`. This is a partial CSRF implementation — server-side validation status unclear.

### Environment Files in Repo (HIGH)
`.env`, `.env.local`, `.env.lock` present in working directory. `.env` and `.env.local` should be gitignored — verify they aren't committed.

### `unsafe-inline` and `unsafe-eval` in CSP (MEDIUM)
Content Security Policy in `astro.config.mjs` allows `'unsafe-inline'` and `'unsafe-eval'` for scripts — weakens XSS protection.

## Performance Concerns

### Synchronous Template Loading (MEDIUM)
Template registry and custom templates loaded synchronously during app boot. Large template collections could slow initial load.

### No Code Splitting (MEDIUM)
All components imported eagerly in `App.jsx`. No `React.lazy()` or dynamic imports for page-level code splitting. Entire app bundle loaded upfront.

### Large Bundle Dependencies (LOW)
`recharts` (SpendDashboard) and `jszip` (template import) are heavy dependencies loaded regardless of whether user visits those features.

## Fragile Areas

### Blank Mode Template Bug (CRITICAL)

Blank mode template generation saves empty files and no template ID. Documented in `docs/gen-template-verification-report.md`.

### Template Router Hardcoding (HIGH)

`utils/template-router.js` (~900 lines) maps template IDs to implementations with brittle regex parsing. Adding new templates requires code changes rather than configuration.

### Oversized OpsCenter Component (HIGH)

OpsCenter component is 1000+ lines — should be decomposed into smaller focused components.

### Deploy Config as JSON Files (MEDIUM)
Deploy configurations stored as individual JSON files in `deploy-configs/`. No validation schema enforcement at runtime. Manual file management.

### Multi-Database Sync (HIGH)
Uses both Neon (PostgreSQL) and Cloudflare D1 (SQLite). No clear sync mechanism between them. Data consistency between the two databases is a risk.

### Worker CORS Handling (MEDIUM)
CORS headers manually managed in each worker (`apps/worker/src/index.ts`). Inconsistent CORS handling across different workers possible.

## Missing Features

### Error Reporting (MEDIUM)
Sentry is included as dependency but integration appears selective. No structured error reporting pipeline from Workers.

### Rate Limiting (HIGH)
No visible rate limiting on API endpoints or Worker routes. Callbacks and tracking endpoints could be abused.

### Monitoring/Observability (MEDIUM)
No structured logging, metrics, or alerting beyond basic `console.error`. Health endpoint exists but no uptime monitoring configured.

### Database Migrations (MEDIUM)
Migration scripts exist (`scripts/migrate-neon.js`, `scripts/migrate-d1.js`) but no migration versioning system or rollback capability visible.

## Test Gaps

### Worker Tests (HIGH)
`apps/worker/` and `apps/api-worker/` have no test configuration or test files. Backend logic is untested.

### Service Layer Tests (HIGH)
`services/` directory (API client, Cloudflare DNS, Neon DB, Voluum) has no dedicated tests. These are critical integration points.

### Component Tests (MEDIUM)
No component-level tests for React components. Only utility functions have tests.

### Template Adapter Tests (MEDIUM)
`src/adapters/` TypeScript interfaces have no tests verifying adapter implementations conform to the interface.
