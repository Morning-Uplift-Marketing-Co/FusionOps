# Backend Codemap

**Last Updated:** 2026-02-16
**Runtime:** Cloudflare Workers
**Entry Point:** `apps/api-worker/src/worker.js`
**Database:** Cloudflare D1 (SQLite-compatible) + Neon Postgres (fallback)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Worker                          │
│                  (apps/api-worker/src/worker.js)            │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  API Routes  │  │ D1 Database  │  │ External APIs│
├──────────────┤  ├──────────────┤  ├──────────────┤
│ GET  /init   │  │ settings     │  │ LeadingCards │
│ POST /sites  │  │ sites        │  │ Multilogin X │
│ PUT   /sites │  │ deploy_history│ │ Cloudflare   │
│ GET/POST /lc │  │ accounts     │  │ Registrar    │
│ POST /ai/*   │  │ payments     │  │ Neon         │
│ /ops/*       │  │ domains      │  └──────────────┘
└──────────────┘  │ cf_accounts  │
                  │ registrar    │
                  └──────────────┘
```

## API Endpoints

### Initialization & Config

| Method | Route | Purpose | Response |
|--------|-------|---------|----------|
| GET | `/api/init` | Bootstrap app data | `{ sites, ops, settings, stats, deploys, variants }` |
| POST | `/api/settings` | Save settings | `{ success }` |
| GET | `/api/settings` | Load settings | `{ settings }` |

### Sites Management

| Method | Route | Purpose | Response |
|--------|-------|---------|----------|
| GET | `/api/sites` | List all sites | `[{ id, brand, domain, ... }]` |
| POST | `/api/sites` | Create site | `{ id, ... }` |
| PUT | `/api/sites/:id` | Update site | `{ success }` |
| DELETE | `/api/sites/:id` | Delete site | `{ success }` |

### Operations (Multi-Resource)

| Method | Route | Purpose | Response |
|--------|-------|---------|----------|
| GET | `/api/ops/:collection` | List resources | `[{ id, label, ... }]` |
| POST | `/api/ops/:collection` | Create resource | `{ id, ... }` |
| PUT | `/api/ops/:collection/:id` | Update resource | `{ success }` |
| DELETE | `/api/ops/:collection/:id` | Delete resource | `{ success }` |

**Collections:** `domains`, `accounts`, `payments`, `logs`, `risks`

### LeadingCards Integration

| Method | Route | Purpose | Response |
|--------|-------|---------|----------|
| GET | `/api/lc/cards` | List cards | `[{ uuid, last4, status, ... }]` |
| POST | `/api/lc/cards` | Create card | `{ uuid, ... }` |
| PUT | `/api/lc/cards/:uuid/block` | Block card | `{ success }` |
| PUT | `/api/lc/cards/:uuid/activate` | Activate card | `{ success }` |
| PUT | `/api/lc/cards/:uuid/change_limit` | Change limit | `{ success }` |
| GET | `/api/lc/bins` | List BINs | `[{ id, name, ... }]` |
| GET | `/api/lc/billing` | List billing addresses | `[{ id, ... }]` |
| GET | `/api/lc/teams` | List teams | `[{ team_id, name }]` |
| GET | `/api/lc/transactions` | List transactions | `[{ amount, ... }]` |

### Cloudflare Accounts

| Method | Route | Purpose | Response |
|--------|-------|---------|----------|
| GET | `/api/cf-accounts` | List CF accounts | `[{ id, label, accountId }]` |
| POST | `/api/cf-accounts` | Add CF account | `{ id, ... }` |
| DELETE | `/api/cf-accounts/:id` | Remove CF account | `{ success }` |

### AI Endpoints

| Method | Route | Purpose | Response |
|--------|-------|---------|----------|
| POST | `/api/ai/generate-copy` | Generate AI copy | `{ h1, badge, cta, sub, tagline }` |
| POST | `/api/ai/generate-assets` | Generate assets | `{ url }` |

### Deployment Operations

| Method | Route | Purpose | Response |
|--------|-------|---------|----------|
| GET | `/api/ops/deployments` | List deployments | `[{ id, domain, target, url, status }]` |
| POST | `/api/ops/deployments` | Create deployment record | `{ id }` |
| PATCH | `/api/ops/deployments/:id` | Update deployment | `{ success }` |
| GET | `/api/ops/deploy-configs` | Get deploy configs | `{ [target]: config }` |
| POST | `/api/ops/deploy-configs` | Save deploy config | `{ success }` |

## Database Schema (D1)

### Settings Table
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Sites Table
```sql
CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Deploy History Table
```sql
CREATE TABLE deploy_history (
  id TEXT PRIMARY KEY,
  site_id TEXT,
  target TEXT,
  url TEXT,
  status TEXT,
  brand TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Accounts Table
```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  email TEXT,
  payment_id TEXT,
  budget REAL,
  status TEXT DEFAULT 'active',
  card_uuid TEXT,
  card_last4 TEXT,
  card_status TEXT,
  profile_id TEXT,
  proxy_ip TEXT,
  monthly_spend REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Payments Table
```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  card_uuid TEXT,
  card_last4 TEXT,
  card_status TEXT DEFAULT 'active',
  billing_id TEXT,
  bin_id TEXT,
  limit_value REAL,
  spend REAL DEFAULT 0,
  team_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Domains Table
```sql
CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  registrar TEXT,
  status TEXT DEFAULT 'active',
  auto_renew BOOLEAN DEFAULT 0,
  expires_at TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security

### CORS Headers
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};
```

### SQL Injection Protection
- Column whitelists for PUT endpoints
- Prepared statements via D1 API
- Input validation on all endpoints

## Error Responses

All endpoints return consistent error format:
```javascript
{
  error: "Error message",
  detail: "Additional context"
}
```

## External Service Dependencies

| Service | Purpose | Env Keys |
|---------|---------|----------|
| Neon Postgres | Primary database | `NEON_URL` |
| LeadingCards | Card management | `LC_TOKEN`, `LC_TEAM_UUID` |
| Multilogin X | Browser profiles | `ML_TOKEN` |
| Cloudflare | DNS/Deployment | `CF_API_TOKEN`, `CF_ACCOUNT_ID` |
| Anthropic | AI copy generation | `ANTHROPIC_API_KEY` |
| Gemini | AI assets | `GEMINI_API_KEY` |

## Worker Configuration

```toml
# wrangler.toml
name = "lp-factory-api"
main = "src/worker.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "ppc-gen-claude"
database_id = "local"

[vars]
ENVIRONMENT = "production"
```

## Related Files

- `src/services/neon.js` - Neon Postgres client (browser-compatible)
- `src/services/api.js` - API client wrapper
- `src/services/leadingCards.js` - LeadingCards API client
- `src/services/multilogin.js` - Multilogin X API client
