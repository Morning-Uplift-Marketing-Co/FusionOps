# lp-factory-web (FusionOps)

Landing page factory: Astro-based template system with CloudFlare Workers backend for campaign tracking, lead handling, and landing page deployment.

## Quick Start

```bash
# Install dependencies (Node ≥22 — see .nvmrc)
npm run bootstrap

# Quick sanity check anytime:
# npm run setup:check

# Copy env template: cp .env.example .env — set VITE_API_BASE / VITE_NEON_URL as needed

# Local dev (http://localhost:4321 — strictPort for Playwright E2E)
npm run dev

# Optional: deps for local apps/api-worker development
# npm run install:api-worker

# Build for production
npm run build

# Run tests
npm test                  # Unit/integration tests (Vitest)
npm run test:e2e         # E2E tests (Playwright)
npm run test:coverage    # Coverage report

# Deploy to CloudFlare Pages
npm run deploy:org
```

See **README.md** for full onboarding.

## Architecture Overview

### Frontend (Astro + React)
- **Astro v6.0.8** for static generation + React islands
- **React v19.2.0** for interactive components
- **TailwindCSS v4.2.0** for styling
- **Recharts v3.7.0** for data visualization
- Deployed to **CloudFlare Pages**: https://fusionops-web.pages.dev/
- Node.js requirement: **≥22.0.0**

### Backend: 4 CloudFlare Workers

1. **API Worker** (`lp-factory-api`)
   - URL: https://lp-factory-api.misty-feather-556e.workers.dev
   - Purpose: Campaign CRUD, landing page operations, template management
   - Database: D1 `fusionops-main-new-v2` (24 tables, 3 sites, 58 templates)
   - Size: 1.12 MB raw, 225 KB gzip
   - Startup: 25 ms

2. **CORS Proxy** (`lp-cors-proxy`)
   - URL: https://lp-cors-proxy.misty-feather-556e.workers.dev
   - Purpose: CORS-proxied requests to external APIs
   - Size: 2.31 KB

3. **Pixel Worker** (`lp-factory-pixel`)
   - URL: https://lp-factory-pixel.misty-feather-556e.workers.dev
   - Purpose: First-party tracking pixel (t.{domain}/e)
   - Database: D1 `fusionops-pixel-new-v2` (249 KB)
   - Tracks: clicks, conversions, user events

4. **Callback Worker** (`fusionops-callback-worker`)
   - URL: https://fusionops-callback-worker.misty-feather-556e.workers.dev
   - Purpose: Webhook callbacks, lead notifications
   - Database: D1 `fusionops-callback-new-v2` (65 KB)

### Databases

- **D1 (CloudFlare SQLite)**: Three production instances
  - Main: 18.5 MB (campaigns, templates, sites)
  - Pixel: 249 KB (tracking events)
  - Callback: 65 KB (lead callbacks)
- **Neon Postgres** (optional): `@neondatabase/serverless` v1.0.2 via .env.local

### External Integrations

- **MCP Servers** (.mcp.json):
  - bolt_shared: http://mcp.fusions.dev/mcp
  - context7: https://mcp.context7.com/mcp
- **GitHub Actions**: CI/CD pipeline (deploy-lp.yml)
- **Sentry**: Error tracking (@sentry/react v10.40.0)

## Development Workflow

### Prerequisites
1. Clone repository
2. `npm run bootstrap` (or `npm install`) — Node ≥22.0.0
3. Copy `.env.example` to `.env` and set `VITE_*` vars (see README). Optional: `.env.lock` for local convenience (not committed).

### Local Development
```bash
npm run dev
# Opens http://localhost:4321
# Auto-reload on file changes (HMR enabled)
```

### Code Structure
```
src/
├── components/          # React components (TemplateManager, TrackingDashboard, etc.)
├── pages/              # Astro pages (routes)
├── layouts/            # Astro layouts
├── utils/              # Utilities (template-registry, api-client, etc.)
└── styles/             # Global styles, Tailwind config

apps/
├── api-worker/         # API Worker source
├── pixel-worker/       # Pixel tracking worker
└── callback-worker/    # Callback/webhook worker

templates/              # Template files (Astro or physical copies)
scripts/                # Build scripts (inject-tracking.mjs, etc.)
```

**File size limits**: 200–400 lines typical, 800 lines max (immutability + modularity).

### Template Management (Build-Variant Approach)

**Current approach**: Templates contain hardcoded values; `build-variant.mjs` replaces them from `theme.json`.

```bash
# Generate theme.json from LP Command Center
# Run build-variant to produce final template
node scripts/build-variant.mjs <template-id> --theme <theme.json>
```

**Template ID convention**: `{source}-{niche}-{number}` (e.g., `bolt-loan-01`)

**Key files**:
- `scripts/inject-tracking.mjs` — CI tracking/color/scaffold injection
- `scripts/build-variant.mjs` — Hardcoded value replacement
- `scripts/folder-to-template-json.js` — Local folder → DB upload
- `src/utils/template-registry.js` — Template loading (module + API)

**Important**: Astro scripts MUST use `is:inline` directive, or Astro will strip/bundle them.

## Testing

### Unit & Integration Tests (Vitest)
```bash
npm test                 # Run all tests
npm run test:ui        # Interactive UI
npm run test:coverage  # Generate coverage report
```

**Requirements**: 80% coverage minimum (unit + integration tests).

**Test-Driven Development workflow**:
1. Write test first (RED)
2. Run test → should FAIL
3. Write minimal implementation (GREEN)
4. Run test → should PASS
5. Refactor (IMPROVE)

### E2E Tests (Playwright)
```bash
npm run test:e2e                # Headless
npm run test:e2e:headed        # Visible browser
npm run test:e2e:debug         # Debug mode
npm run test:e2e:ui            # Interactive UI
npm run test:report            # Show report
```

**Critical flows to test**:
- Create landing page
- Deploy to CloudFlare Pages
- Verify tracking pixel fires
- Test callback webhook

## Building & Deployment

### Development Build
```bash
npm run build
npm run preview
```

### Production Deployment

**GitHub Actions** (via `.github/workflows/deploy-lp.yml`):
1. Trigger on push to `main`
2. Build Astro site
3. Inject tracking/colors via `inject-tracking.mjs`
4. Deploy Workers (Wrangler)
5. Deploy Pages (CloudFlare Pages)

**Manual deployment**:
```bash
# Deploy only workers
npm run deploy:org

# Build and preview before deploy
npm run build && npm run preview
```

**Rollback**:
```bash
# Check deployment history
wrangler deployments list --name lp-factory-api

# Rollback to previous version (if needed)
wrangler rollback --version-id <previous-version-id>
```

## API Endpoints

### API Worker
```
GET  /api/health              — Health check
GET  /api/campaigns           — List campaigns
GET  /api/campaigns/:id       — Get campaign details
POST /api/campaigns           — Create campaign
PUT  /api/campaigns/:id       — Update campaign
GET  /api/templates           — List templates
GET  /api/templates/:id       — Get template
```

### Pixel Worker
```
GET /e?campaign=ID&event=TYPE&user=UUID
    — Track event, returns 1x1 pixel GIF
```

### Callback Worker
```
POST /callback
     — Receive lead data, store in D1
```

## Code Standards

### Immutability (CRITICAL)
- NEVER mutate existing objects
- Use spread operators, object/array copying
- Return new objects from functions
- Example:
  ```js
  // WRONG: mutates original
  campaign.name = 'New Name';

  // CORRECT: returns new object
  const updated = { ...campaign, name: 'New Name' };
  ```

### Error Handling
- Handle errors explicitly at every level
- User-facing code: friendly error messages
- Server-side code: detailed error logging
- Never silently swallow errors
- Example:
  ```js
  try {
    await deployTemplate(id);
  } catch (err) {
    logger.error(`Deploy failed: ${err.message}`, { id, err });
    throw new Error('Deployment failed. Check logs.');
  }
  ```

### Input Validation
- Validate all user input at system boundaries
- Use schema-based validation (Zod, Joi, etc.)
- Fail fast with clear error messages
- Example:
  ```js
  const schema = z.object({
    name: z.string().min(3).max(100),
    url: z.string().url(),
  });
  const result = schema.parse(input);
  ```

### Naming Conventions
- camelCase for variables, functions
- PascalCase for classes, React components
- UPPER_SNAKE_CASE for constants
- Descriptive names (e.g., `fetchCampaignById`, not `getCampaign`)

### File Organization
- High cohesion, low coupling
- Extract utilities from large modules
- Organize by feature/domain (not by type)
- Typical size: 200–400 lines, max 800 lines

## Security Guidelines

### Pre-Commit Checklist
- [ ] No hardcoded secrets (API keys, tokens, passwords)
- [ ] All user inputs validated
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized HTML output)
- [ ] CSRF protection enabled
- [ ] Authentication/authorization verified
- [ ] Rate limiting on all endpoints
- [ ] Error messages don't leak sensitive data

### CloudFlare Workers Security
- Use environment bindings (D1, R2, KV) instead of hardcoded URLs
- Validate request origins for CORS
- Use Wrangler secrets for API keys: `wrangler secret put API_KEY`
- Enable Authenticated Origin Pulls for D1 access

### D1 Security
- Parameterized queries (prevent SQL injection)
- Row-level access control via Worker logic
- Never expose D1 credentials in client code
- Use D1 binding in wrangler.toml (not connection string)

### Data Privacy
- User tracking data (pixels, events) stored in separate D1 instance
- GDPR compliance: log retention policy
- Sensitive data (payment info) encrypted at rest

## Available Agents

See `~/.claude/rules/common/agents.md`. Key agents for this project:

| Agent | Use Case |
|-------|----------|
| **code-reviewer** | After writing code, check for security/quality issues |
| **tdd-guide** | New features: write tests first, then implementation |
| **security-reviewer** | Pre-commit security analysis |
| **build-error-resolver** | Fix build/compilation errors |
| **e2e-runner** | E2E testing for critical workflows |
| **planner** | Complex features, architectural decisions |

## npm Scripts Reference

```bash
npm run dev                    # Start local dev server
npm run build                  # Build for production
npm run preview               # Preview production build
npm run check                 # Type check (astro check)
npm run lint                  # Lint code (eslint)
npm run test                  # Unit/integration tests
npm run test:ui              # Test UI
npm run test:coverage        # Coverage report
npm run test:e2e             # E2E tests
npm run test:e2e:headed      # E2E with visible browser
npm run test:e2e:debug       # E2E debug mode
npm run test:report          # Show E2E report
npm run deploy:org           # Deploy to CloudFlare
npm run pack-template        # Pack template for distribution
npm run convert-template     # Convert template format
npm run inject:index-html-tracking  # Inject tracking into HTML
```

## Common Development Tasks

### Create a New Landing Page
1. Design in template system or import existing template
2. Configure tracking pixels
3. Set campaign metadata in API Worker
4. Deploy via GitHub Actions or `npm run deploy:org`

### Add Tracking to Template
```bash
# Edit template with tracking placeholders
# Run inject-tracking.mjs (automatic in CI)
node scripts/inject-tracking.mjs <template-id> --output dist/
```

### Deploy Worker Update
```bash
# Edit worker source (apps/api-worker/src/*)
npm run build
npm run deploy:org
```

### Test Tracking Pixel
1. Deploy landing page
2. Open browser DevTools → Network tab
3. Trigger event on page (click, form submit)
4. Verify GET request to pixel worker with event data
5. Check D1 `fusionops-pixel-new-v2` for new row

## Troubleshooting

### Build Fails
```bash
npm run lint                   # Check for linting errors
npm run check                  # Type check
npm run build 2>&1 | head -20  # See first errors
```

**Common issues**:
- Missing `.env.local` — copy from `.env.example`
- Astro scripts without `is:inline` — directive missing
- JSON.stringify() escaping quotes — use `.join("\n")` instead
- Node version < 22 — upgrade Node

### Deployment Fails
```bash
# Check wrangler auth
wrangler whoami

# Check D1 bindings
wrangler d1 info fusionops-main-new-v2

# View worker logs
wrangler tail lp-factory-api
```

### Tests Fail
```bash
npm test -- --reporter=verbose  # Detailed output
npm run test:coverage           # See coverage gaps
```

**Common issues**:
- Mocks not isolated between tests — use `beforeEach()` cleanup
- Database state from previous tests — clear D1 test DB
- Async race conditions — use `await` in test setup

### Template Upload Issues
```bash
# Validate template structure
node scripts/validate-template-tracking.mjs <template-id>

# Upload with verbose output
node scripts/folder-to-template-json.js <path> --upload --verbose
```

## Performance Optimization

### Frontend Bundle
- Astro strips unused JS by default
- React components lazy-load via `<Suspense>`
- TailwindCSS purges unused styles (automatic)
- Monitor: `npm run build` output shows bundle size

### Worker Performance
- API Worker: 25ms startup target (current: 25ms ✓)
- Pixel Worker: 14ms startup target (current: 14ms ✓)
- Use D1 indexes for frequently queried columns
- Cache campaign metadata in Worker KV (optional)

### Database Queries
- Use parameterized queries (prevents SQL injection + enables caching)
- Create indexes on `campaign_id`, `user_id`, `event_type`
- Archive old events to reduce D1 size

## References

- **Astro**: https://docs.astro.build
- **React**: https://react.dev
- **TailwindCSS**: https://tailwindcss.com
- **CloudFlare**: https://developers.cloudflare.com
- **Vitest**: https://vitest.dev
- **Playwright**: https://playwright.dev
- **Global Rules**: `~/.claude/rules/common/`
- **Project Memory**: `memory/MEMORY.md` (architectural decisions, issues)

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
