# Architecture

## Pattern

**Monorepo with Astro SSG frontend + Cloudflare Workers backend + dual databases (Neon PostgreSQL + Cloudflare D1)**

The application is a Landing Page Factory (LP Factory) — an internal tool for creating, managing, and deploying PPC landing pages at scale. It combines a dashboard web app with automated deployment pipelines.

## Layers

### 1. Frontend (Astro + React SPA)
- **Entry:** `pages/index.astro` renders `AppRoot.jsx` → `App.jsx`
- **SPA Navigation:** Client-side page state via `useState("dashboard")` in `App.jsx`
- **Pages/Views:** Dashboard, Sites, Wizard, VariantStudio, OpsCenter, Settings, SpendDashboard, AccountMap, TemplateEditor, TemplateRegistry, ErrorLog, DeployHistory
- **UI Components:** `components/ui/` — Radix-based primitives (button, card, tabs, input, toast, badge, table)

### 2. Services Layer
- **Client-side services:** `services/api.js` — HTTP client with CSRF, auth tokens, error handling
- **Domain services:** `services/neon.js`, `services/d1.js`, `services/cloudflare-dns.js`, `services/cloudflare-zone.js`, `services/registrar.js`, `services/voluum.js`, `services/multilogin.js`, `services/leadingCards.js`, `services/lendingcard.js`
- **Account security:** `services/account-lock.js` — enforces locked Cloudflare account settings

### 3. Backend Workers (Cloudflare Workers)
- **API Worker:** `apps/api-worker/` — main REST API (`worker.js`)
- **Callback Worker:** `apps/worker/` — FusionOps callback engine (LeadsGate callbacks, beacon tracking, pixel endpoint)
- **Pixel Worker:** `apps/pixel-worker/` — first-party tracking pixel
- **CF Proxy:** `apps/cf-proxy/` — Cloudflare API proxy for CORS bypass

### 4. Utilities & Generators
- **Template system:** `utils/template-router.js`, `utils/template-registry.js`, `utils/template-analyzer.js`
- **LP Generator:** `utils/lp-generator.js`, `utils/astro-generator.jsx`
- **Deployers:** `utils/deployers/` — multi-target deploy (Vercel, S3+CloudFront, VPS SSH, git-push)
- **Risk engine:** `utils/risk-engine.js`
- **Image generation:** `utils/image-gen.js`

### 5. Templates
- **Source templates:** `src/templates/` — Astro-based LP templates (PDL_Loans_V3, pet_loans_v1, template_green_01, astrodeck-loan, lander-core, etc.)
- **Imported templates:** `templates/` — external/bolt templates (inbox-zero-clone, loans-usa-*, bolt-tmp-*)
- **Template adapters:** `src/adapters/` — TypeScript adapter interfaces for template runtime

## Data Flow

### Dashboard Boot
1. `App.jsx` initializes → reads settings from localStorage → `sanitizeSettings()`
2. Checks API health → `api.request("/api/health")`
3. Loads sites from Neon DB → `db.listSites()`
4. Loads deploy configs from filesystem → `deploy-configs/*.json`
5. Loads template registry → `refreshCustomTemplates()`

### Landing Page Creation (Wizard Flow)
1. User fills Wizard steps: Product → Brand → Copy → Design → Tracking → Review
2. Wizard generates LP config → `template-utils.js`
3. Template code generated → `generateTemplateCode.js`
4. Deploy to target → `deployers/*.js` (Cloudflare Pages, Vercel, S3, VPS)
5. DNS configured → `cloudflare-dns.js`
6. Tracking pixels injected → pixel-worker

### Callback/Tracking Flow
1. LP sends beacon → `apps/worker` `/track` or `/e` endpoint
2. Worker deduplicates → `lib/dedup.ts`
3. Validates payload → `lib/validation.ts`
4. Posts to Voluum → `lib/voluum.ts`
5. Stores in D1 database

## Entry Points

| Entry Point | File | Purpose |
|------------|------|---------|
| Web App | `pages/index.astro` → `App.jsx` | Main SPA dashboard |
| API Worker | `apps/api-worker/worker.js` | REST API endpoints |
| Callback Worker | `apps/worker/src/index.ts` | Tracking & callbacks |
| Pixel Worker | `apps/pixel-worker/` | First-party pixel |
| CF Proxy | `apps/cf-proxy/worker.js` | Cloudflare API proxy |
| Deploy Scripts | `scripts/deploy-all.js` | Batch deployment |
| DB Migrations | `scripts/migrate-neon.js`, `scripts/migrate-d1.js` | Database migrations |

## Key Abstractions

- **Template Adapter:** `src/adapters/template-adapter.ts` — standard interface for all LP templates
- **Template Router:** `utils/template-router.js` — routes template IDs to implementations
- **Account Lock:** `services/account-lock.js` — prevents accidental account switching
- **API Client:** `services/api.js` — centralized HTTP client with auth, CSRF, error handling
- **Deploy Manifest:** `schemas/deploy-manifest.schema.json` — standardized deploy configuration
