# LP Factory — Production Infrastructure

Mobile-first, compliance-safe, revenue-truth loan landing page factory.

## Architecture

```
apps/
├── lander/           # Astro static site (landing pages)
│   ├── src/
│   │   ├── pages/         # Astro page routes
│   │   ├── templates/     # Reusable LP templates
│   │   │   └── core/      # Default loan LP template
│   │   ├── components/    # Astro components (no hydration)
│   │   │   ├── ZipInput.astro
│   │   │   ├── AmountSlider.astro
│   │   │   ├── CTAButton.astro
│   │   │   └── ComplianceBlock.astro
│   │   ├── layouts/       # Base layouts
│   │   ├── lib/           # Client-side tracking (sessionStorage only)
│   │   └── styles/        # Tailwind + design tokens
│   ├── public/fonts/      # Self-hosted fonts (woff2)
│   ├── astro.config.mjs
│   └── package.json
│
├── worker/           # Cloudflare Worker (callback engine)
│   ├── src/
│   │   ├── index.ts           # Router + beacon handler
│   │   ├── types.ts           # TypeScript types
│   │   ├── handlers/
│   │   │   └── callback.ts    # LeadsGate callback processor
│   │   └── lib/
│   │       ├── validation.ts  # Token + payload validation
│   │       ├── dedup.ts       # SHA-256 deduplication
│   │       └── voluum.ts      # Voluum S2S conversion API
│   ├── migrations/
│   │   └── 0001_init.sql      # D1 schema
│   ├── wrangler.toml
│   └── package.json
│
└── README.md         # This file

scripts/
└── deploy.sh         # Build + deploy automation
```

## Global Rules

| Rule | Enforcement |
|------|-------------|
| No React/Vue hydration | Astro static output only |
| No GA4, no GTM | Zero analytics libraries |
| No PII stored on LP | sessionStorage only, no cookies |
| soldLead = single source of truth | Worker only processes soldLead for conversions |
| Dedup: `sha256(click_id + ":" + lead_id)` | Web Crypto API in Worker |
| Retry-safe Worker | Dedup checked before insert, insert after upload |
| Multi-account isolation | D1 accounts table, per-account tokens |
| Lighthouse mobile >= 96 | Static HTML, no blocking JS, self-hosted fonts |
| No business logic in lander | All logic in Worker |

## Quick Start

### 1. Prerequisites

- Node.js >= 20
- Wrangler CLI (`npm i -g wrangler`)
- Cloudflare account with D1 access

### 2. Create D1 Database

```bash
wrangler d1 create lp-factory-db
```

Copy the `database_id` into `apps/worker/wrangler.toml`.

### 3. Run Migrations

```bash
cd apps/worker
npm install
npm run migrate:remote
```

### 4. Seed an Account

```sql
INSERT INTO accounts (account_id, callback_token, voluum_api_key, domains)
VALUES ('acct_001', 'your-secret-token-here', 'your-voluum-key', '["yourdomain.com"]');
```

Run via: `wrangler d1 execute lp-factory-db --remote --command="<SQL>"`

### 5. Deploy Worker

```bash
cd apps/worker
npm run deploy
```

### 6. Build & Deploy Lander

```bash
cd apps/lander
cp .env.example .env
# Edit .env with your values
npm install
npm run build
npx wrangler pages deploy dist/ --project-name=lp-factory-lander
```

### 7. Full Automated Deploy

```bash
export CLOUDFLARE_ACCOUNT_ID=your-id
export CLOUDFLARE_API_TOKEN=your-token
chmod +x scripts/deploy.sh
./scripts/deploy.sh production all
```

## Callback Flow

```
LeadsGate → POST /callback/:account_id/leadsgate
              │
              ├── Validate X-Callback-Token
              ├── Validate payload + timestamp (≤24h)
              ├── Log raw payload → D1 lead_callbacks
              │
              ├── type != soldLead → return 200
              │
              ├── Generate dedup_key = sha256(click_id:lead_id)
              ├── Check D1 dedup_keys
              │   └── exists → return 200 (deduplicated)
              │
              ├── Upload to Voluum S2S
              │   ├── Success:
              │   │   ├── INSERT dedup_keys
              │   │   ├── INSERT conversion_uploads (status=success)
              │   │   └── return 200
              │   │
              │   └── Failure:
              │       ├── INSERT conversion_uploads (status=failed)
              │       └── return 500 (LeadsGate will retry)
```

## Multi-Account Isolation

- Each account has a unique `account_id` and `callback_token` in D1
- Worker route includes account_id: `/callback/:account_id/leadsgate`
- No shared tokens between accounts
- Each domain maps to an account via the `domains` JSON column
- Dedup keys are scoped to `(dedup_key, account_id)` composite key

## Environment Variables

### Lander (.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `SITE_URL` | Canonical site URL | Yes |
| `PUBLIC_SITE_NAME` | Display name for the site | Yes |
| `PUBLIC_COMPANY_NAME` | Legal entity name for compliance | Yes |
| `PUBLIC_ACCOUNT_ID` | Account identifier for tracking | Yes |
| `PUBLIC_TRACK_URL` | Worker beacon endpoint URL | Yes |
| `PUBLIC_VOLUUM_DOMAIN` | Voluum tracking domain | Yes |
| `PUBLIC_LEADSGATE_FORM_ID` | LeadsGate embed form ID | Yes |

### Worker (wrangler.toml / secrets)

| Variable | Description | Where |
|----------|-------------|-------|
| `ENVIRONMENT` | `production` or `staging` | `wrangler.toml [vars]` |
| `DB` | D1 database binding | `wrangler.toml [[d1_databases]]` |

### Deploy Script

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | API token with Workers + Pages + D1 permissions |
| `PAGES_PROJECT_NAME` | Cloudflare Pages project name (default: `lp-factory-lander`) |

## Adding a New Template

1. Create `apps/lander/src/templates/your-template/index.astro`
2. Create `apps/lander/src/pages/your-template/index.astro` that imports from the template
3. Deploy — the new template is available at `/your-template/`

## Adding a New Account

1. Generate a secure callback token: `openssl rand -hex 32`
2. Insert into D1:
   ```sql
   INSERT INTO accounts (account_id, callback_token, voluum_api_key, domains)
   VALUES ('acct_new', 'generated-token', 'voluum-key', '["newdomain.com"]');
   ```
3. Configure LeadsGate to POST to: `https://api.yourdomain.com/callback/acct_new/leadsgate`
4. Set the `X-Callback-Token` header in LeadsGate to the generated token

## Performance Budget

| Metric | Target |
|--------|--------|
| Lighthouse Mobile | >= 96 |
| Custom JS | < 15kb |
| FCP | < 1.5s |
| LCP | < 2.5s |
| CLS | < 0.1 |
| Blocking JS | 0 scripts |
| Analytics libs | None |
| Animation libs | None |
| Fonts | Self-hosted woff2 only |
| Images | WebP only |
