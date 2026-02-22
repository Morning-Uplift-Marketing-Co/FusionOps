# External Integrations Codemap

**Last Updated:** 2026-02-16

## Overview

LP Factory V2 integrates with multiple external services for deployment, DNS, payment cards, browser profiles, and domain management.

```
┌─────────────────────────────────────────────────────────────┐
│                   Integration Layer                         │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Deploy     │  │   Services   │  │    Infrastructure│
├──────────────┤  ├──────────────┤  ├──────────────┤
│ Cloudflare   │  │ LeadingCards │  │  Neon DB     │
│   Pages      │  │ Multilogin X │  │  CF D1       │
│ Netlify      │  │ Cloudflare   │  │  Cloudflare  │
│ Vercel       │  │   DNS API    │  │  AWS S3      │
│ CF Workers   │  │ Registrar    │  │  VPS         │
│ AWS S3+CF    │  │   APIs       │  │              │
│ VPS SSH      │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Deployment Integrations

### 1. Cloudflare Pages (P1 - Primary)

**File:** `src/utils/deployers/cf-pages.js`

**API Endpoints Used:**
- `GET /accounts/{account_id}/pages/projects` - List projects
- `POST /accounts/{account_id}/pages/projects` - Create project
- `GET /accounts/{account_id}/pages/projects/{name}/upload-token` - Get JWT
- `POST /pages/assets/check-missing` - Check file hashes
- `POST /pages/assets/upload` - Upload files
- `POST /pages/assets/upsert-hashes` - Register hashes
- `POST /accounts/{account_id}/pages/projects/{name}/deployments` - Deploy

**Required Credentials:**
- `cfApiToken` - Bearer token with Pages + Workers edit permissions
- `cfAccountId` - 32-character hex account ID

**Flow:**
1. Ensure project exists
2. Compute MD5 hashes of files
3. Get upload JWT
4. Check missing hashes
5. Upload missing files (base64)
6. Register hashes
7. Create deployment with manifest
8. Update DNS records

### 2. Netlify (P2 - Backup)

**File:** `src/utils/deployers/netlify.js`

**API Endpoints Used:**
- `POST /api/v1/sites` - Create site
- `GET /api/v1/sites?name={slug}` - Find existing
- `POST /api/v1/sites/{site_id}/deploys` - Create deploy
- `PUT /api/v1/deploys/{deploy_id}/files/{name}` - Upload file

**Required Credentials:**
- `netlifyToken` - Personal access token

**Flow:**
1. Create or find site
2. Compute SHA-1 hash
3. Create deploy with file digest
4. Upload file if required

### 3. Cloudflare Workers Sites (P4)

**File:** `src/utils/deployers/cf-workers.js`

**Required Credentials:** (shared with CF Pages)
- `cfApiToken`
- `cfAccountId`

### 4. Vercel (P3)

**File:** `src/utils/deployers/vercel.js`

**Required Credentials:**
- `vercelToken` - Vercel API token

### 5. AWS S3 + CloudFront (P5)

**File:** `src/utils/deployers/s3-cloudfront.js`

**Required Credentials:**
- `awsAccessKey`
- `awsSecretKey`
- `awsRegion`
- `s3Bucket`
- `cloudfrontDistId` (optional)

### 6. VPS via SSH (P6)

**File:** `src/utils/deployers/vps-ssh.js`

**Required Credentials:**
- `vpsHost`
- `vpsPort`
- `vpsUser`
- `vpsPath`
- `vpsAuthMethod` - 'key' or 'password'
- `vpsKey` or password
- `vpsWorkerUrl` - Worker proxy for SSH

## Service Integrations

### LeadingCards API

**File:** `src/services/leadingCards.js`

**Purpose:** Virtual card management for ad account funding

**API Endpoints:**
```
GET  /lc/cards              - List cards
POST /lc/cards              - Create card
PUT  /lc/cards/{uuid}/block - Block card
PUT  /lc/cards/{uuid}/activate - Activate card
PUT  /lc/cards/{uuid}/change_limit - Change limit
GET  /lc/bins               - List BINs
GET  /lc/billing            - List billing addresses
POST /lc/billing            - Create billing address
GET  /lc/tags               - List tags
GET  /lc/transactions       - List transactions
GET  /lc/teams              - List teams
```

**Required Settings:**
- `lcToken` - API token
- `lcTeamUuid` - Team UUID (optional for team members)
- `defaultBinUuid` - Default BIN for card issuance
- `defaultBillingUuid` - Default billing address

### Multilogin X API

**File:** `src/services/multilogin.js`

**Purpose:** Browser profile management for ad account isolation

**Two API Layers:**
1. **Remote API** - `https://api.multilogin.com`
   - Authentication (signin, refresh, automation token)
   - Profile CRUD
   - Folder management

2. **Local Launcher** - `https://launcher.mlx.yt:45001`
   - Start/stop profiles
   - Quick profiles
   - Active profile list

**API Endpoints (Remote):**
```
POST /user/signin                    - Sign in with email + MD5(password)
POST /user/refresh-token             - Refresh expired token
GET  /workspace/automation_token     - Generate long-lived token
POST /profile/search                 - List profiles
POST /profile/create                 - Create profile
PATCH /profile/update                - Update profile
DELETE /profile/delete               - Delete profiles
POST /profile/clone                  - Clone profile
POST /profile/metas                  - Get profile metadata
GET  /folder                         - List folders
```

**API Endpoints (Local Launcher):**
```
GET  /api/v1/version                 - Check if launcher is running
GET  /api/v2/profile/f/{folder}/p/{id}/start - Start profile
GET  /api/v1/profile/stop/p/{id}     - Stop profile
GET  /api/v1/profile/active          - List active profiles
POST /api/v2/profile/quick           - Start quick profile
```

**Required Settings:**
- `mlToken` - Automation token (recommended, lasts 30 days)
- OR `mlEmail` + `mlPassword` - For signin
- `mlFolderId` - Default folder for profiles

**Security:**
- Passwords are hashed using MD5 per MLX specification
- Token auto-refreshes 5 minutes before 30-min expiry

### Cloudflare DNS API

**File:** `src/services/cloudflare-dns.js`

**Purpose:** DNS record management for custom domains

**API Endpoints:**
```
GET  /zones                         - List zones
GET  /zones/{id}/dns_records        - List DNS records
POST /zones/{id}/dns_records        - Create DNS record
PATCH /zones/{id}/dns_records/{id}  - Update DNS record
DELETE /zones/{id}/dns_records/{id} - Delete DNS record
```

**Record Types Supported:**
A, AAAA, CNAME, TXT, MX, NS, SRV, CAA

**DNS Templates:**
- landing-page
- email-google (Google Workspace)
- wordpress
- saas
- cdn-static
- dkim-email
- cloudflare-pages
- netlify
- vercel

### Cloudflare Zones API

**File:** `src/services/cloudflare-zone.js`

**Purpose:** Zone (domain) management

### Registrar API

**File:** `src/services/registrar.js`

**Purpose:** Domain registrar integration (Namecheap, GoDaddy, etc.)

**Supported Registrars:**
- Namecheap
- GoDaddy
- Cloudflare
- Porkbun
- Other

## Infrastructure Integrations

### Neon Postgres

**File:** `src/services/neon.js`

**Purpose:** Primary serverless PostgreSQL database

**Driver:** `@neondatabase/serverless` - HTTP-based, works in browsers

**Tables:**
- `settings` - Key-value configuration
- `sites` - Landing page configurations
- `deploy_history` - Deployment records

**Connection Pattern:**
```javascript
import { neon } from '@neondatabase/serverless';
const sql = neon(connectionString);
const rows = await sql`SELECT * FROM sites`;
```

**Features:**
- Auto-reconnection
- Connection pooling via pooler URL
- Browser-compatible (no TCP)

### Cloudflare D1

**Purpose:** Legacy SQLite-compatible database (worker-bound)

**Binding:** `DB` in Cloudflare Workers

**Accessed via:** Worker API endpoints

## AI Integrations

### Anthropic Claude

**Purpose:** Copy generation for landing pages

**Endpoint:** `POST /api/ai/generate-copy`

**Model:** claude-sonnet-4-20250514

**Input:**
```javascript
{
  brand: string,
  loanType: string,
  amountMin: number,
  amountMax: number,
  lang: 'English' | 'Spanish' | 'German' | 'French' | 'Italian'
}
```

**Output:**
```javascript
{
  h1: string,
  badge: string,
  cta: string,
  sub: string,
  tagline: string
}
```

### Gemini

**Purpose:** Asset generation (logos, hero images)

**Endpoint:** `POST /api/ai/generate-assets`

**Input:**
```javascript
{
  brand: string,
  type: 'logo' | 'hero'
}
```

**Output:**
```javascript
{
  url: string
}
```

## Settings Management

All credentials are stored in:
1. Neon Postgres (primary)
2. Cloudflare D1 (legacy)
3. localStorage (fallback)

**Settings Page:** `src/components/Settings.jsx`

**Test Functions:**
- `testApi()` - Anthropic API connectivity
- `testCf()` - Cloudflare API + account validation
- `testNetlify()` - Netlify token validation
- `testAws()` - S3 bucket accessibility
- `testLc()` - LeadingCards API
- `testMl()` - Multilogin X authentication

## Related Files

- `src/components/Settings.jsx` - Configuration UI
- `src/utils/api-proxy.js` - API proxy utilities
- `src/services/api.js` - Legacy API client
- `src/services/neon.js` - Neon DB client
