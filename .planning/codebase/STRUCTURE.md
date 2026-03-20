# Structure

## Directory Layout

```
ppc-claude-web-V1/
├── apps/                        # Cloudflare Workers (backend)
│   ├── api-worker/              #   Main REST API worker
│   ├── worker/                  #   Callback/tracking engine (TypeScript)
│   │   └── src/
│   │       ├── handlers/        #     Route handlers (callback.ts)
│   │       ├── lib/             #     Shared libs (dedup, validation, voluum)
│   │       ├── index.ts         #     Worker entry point
│   │       └── types.ts         #     TypeScript types
│   ├── pixel-worker/            #   First-party tracking pixel
│   ├── cf-proxy/                #   Cloudflare API CORS proxy
│   └── lander/                  #   Standalone lander builder
├── src/                         # Primary source (canonical)
│   ├── components/              #   React components
│   │   ├── OpsCenter/           #     Operations center (deploy, DNS)
│   │   ├── spend/               #     Spend tracking tabs
│   │   ├── TemplateGenerator/   #     Template creation wizard
│   │   ├── ui/                  #     Shared UI primitives (Radix-based)
│   │   └── Wizard/              #     LP creation wizard
│   ├── services/                #   Domain service clients
│   ├── utils/                   #   Utility functions
│   │   ├── deployers/           #     Multi-target deployers
│   │   └── __tests__/           #     Unit tests
│   ├── adapters/                #   Template adapter interfaces (TypeScript)
│   ├── templates/               #   Astro-based LP templates
│   └── lib/                     #   Shared utilities (utils.ts for cn())
├── components/                  # Legacy component mirror (root level)
├── services/                    # Legacy service mirror (root level)
├── utils/                       # Legacy utility mirror (root level)
├── constants/                   # App constants (THEME, WIZARD_DEFAULTS)
├── pages/                       # Astro pages (index.astro, docs/)
├── layouts/                     # Astro layouts (Layout.astro)
├── templates/                   # Imported/external templates
├── deploy-configs/              # Per-domain deploy JSON configs
├── scripts/                     # CLI scripts (deploy, migrate, setup)
├── schemas/                     # JSON schemas (deploy-manifest)
├── styles/                      # Global CSS/Tailwind styles
├── public/                      # Static assets
├── tests/                       # Test suites
│   ├── e2e/                     #   Playwright E2E tests
│   ├── unit/                    #   Vitest unit tests
│   ├── fixtures/                #   Test fixtures
│   └── pages/                   #   Page object models
├── packages/                    # Internal packages
│   └── lp-template-generator/   #   Template generator package
├── files/                       # Generated files (themes, etc.)
├── docs/                        # Documentation (Astro docs page)
├── App.jsx                      # Main SPA component
├── AppRoot.jsx                  # React root wrapper
├── astro.config.mjs             # Astro configuration
├── vitest.config.ts             # Vitest test configuration
├── playwright.config.ts         # Playwright E2E config
└── package.json                 # Root package (lp-factory-web)
```

## Key Locations

| What | Where |
|------|-------|
| Main app component | `App.jsx` (root) |
| React components | `src/components/` |
| UI primitives | `src/components/ui/` |
| Service clients | `src/services/` |
| Utility functions | `src/utils/` |
| Template system | `src/utils/template-router.js`, `src/utils/template-registry.js` |
| Deployers | `src/utils/deployers/` |
| LP templates | `src/templates/` |
| External templates | `templates/` |
| Backend workers | `apps/` |
| Deploy configs | `deploy-configs/` |
| Scripts | `scripts/` |
| Unit tests | `src/utils/__tests__/`, `tests/unit/` |
| E2E tests | `tests/e2e/` |
| Constants | `constants/index.js` |
| Env config | `.env`, `.env.local`, `.env.lock`, `.env.production` |

## Naming Conventions

- **Components:** PascalCase files, named exports (`Dashboard.jsx` → `export function Dashboard`)
- **Services:** camelCase files (`api.js`, `neon.js`, `cloudflare-dns.js`)
- **Utils:** kebab-case files (`template-router.js`, `risk-engine.js`)
- **Workers:** kebab-case directories (`api-worker/`, `pixel-worker/`)
- **Templates:** kebab-case or snake_case directories (`PDL_Loans_V3/`, `pet_loans_v1/`)
- **Tests:** `*.test.js` or `*.spec.js` suffix
- **Deploy configs:** domain-name JSON files (`scratchpayeasy.com.json`)

## Dual Directory Issue

The project has files duplicated between root-level and `src/` directories:
- `components/` ↔ `src/components/`
- `services/` ↔ `src/services/`
- `utils/` ↔ `src/utils/`

The `src/` versions are canonical. Root-level versions appear to be legacy mirrors that may be out of sync. New code should go in `src/`.

## Configuration Files

| File | Purpose |
|------|---------|
| `astro.config.mjs` | Astro + Vite config, proxy setup, aliases |
| `vitest.config.ts` | Test runner config (happy-dom, v8 coverage) |
| `playwright.config.ts` | E2E test config |
| `eslint.config.js` | ESLint flat config |
| `tsconfig.json` | TypeScript config |
| `.versionrc.json` | standard-version release config |
| `wrangler.toml` | Cloudflare Workers config (per worker in `apps/`) |
| `.mcp.json` | MCP server configuration |
