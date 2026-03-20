# External Integrations

**Analysis Date:** 2026-03-20

## APIs & External Services

**Proxy Management:**
- Multilogin X - Browser profile management and automation
  - Remote API: `https://api.multilogin.com`
  - Local Launcher: `https://launcher.mlx.yt:45001`
  - SDK/Client: Direct HTTP integration (`src/services/multilogin.js`)
  - Credentials: MLX API key stored in settings

- NodeMaven - Residential proxy provider
  - Gateway: `gate.nodemaven.com` (HTTP ports 8080–9080, SOCKS5 ports 1080–2080)
  - Sticky sessions up to 24h, geo-targeting, IP rotation
  - Credentials: username/password in settings (`src/services/nodemaven.js`)

**Domain Management:**
- Internet.bs - Domain registrar API
  - API Base: `https://api.internet.bs`
  - Operations: domain check, registration, nameserver updates, listing, balance query
  - Via Worker proxy: `/api/automation/registrar/` endpoints
  - Implementation: `src/services/registrar.js`

**DNS & Infrastructure:**
- Cloudflare DNS - DNS record management
  - API Base: `https://api.cloudflare.com/client/v4`
  - Operations: Zone management, DNS records, Workers routes
  - Auth: Cloudflare API token (`VITE_CF_API_TOKEN`)
  - Implementation: `src/services/cloudflare-dns.js`, `src/services/cloudflare-zone.js`

**Analytics & Tracking:**
- Voluum - Traffic tracking and analytics platform
  - API: Via Worker proxy at `/voluum` endpoints
  - Operations: Session authentication, report generation (visits, clicks, conversions, ROI)
  - Auth: Access Key ID + Secret credentials stored in settings
  - Implementation: `src/services/voluum.js`

**IP & Fraud Detection:**
- IPQualityScore (IPQS) - IP fraud scoring and blacklist checking
  - Used in proxy preflight validation (`src/services/proxy-checker.js`)
  - Detects proxy hosting, datacenter IPs, fraud scores

- ip-api.com - Basic IP geolocation and proxy detection
  - Free tier: 45 requests/min (no auth key required)
  - Returns: country, region, city, ISP, proxy/hosting flags
  - Implementation: `src/services/proxy-checker.js`

- IPinfo.io - ASN and geolocation data
  - Auth: API token in settings (`ipinfoToken`)
  - Used in IP quality pipeline for ASN verification (`src/services/ip-quality-pipeline.js`)

- Scamalytics - Fraud reputation scoring
  - Auth: API key in settings (`scamalyticsKey`)
  - Used in IP quality pipeline for fraud detection (`src/services/ip-quality-pipeline.js`)

- IP2Location.io - IP type detection (residential vs datacenter vs VPN)
  - Auth: API key in settings (`ip2locationKey`)
  - Used in IP quality pipeline (`src/services/ip-quality-pipeline.js`)

## Data Storage

**Databases:**
- Neon (PostgreSQL) - Primary serverless database
  - Client: `@neondatabase/serverless` HTTP driver
  - Connection: Environment variable for connection string
  - Tables:
    - `settings` - Key-value configuration store
    - `sites` - Landing page deployment records
    - `deploy_history` - Deployment history with timestamps
    - `cf_accounts` - Cloudflare account credentials
    - `registrar_accounts` - Domain registrar credentials (Internet.bs, etc.)
    - `daily_spend` - Daily spend tracking and ROI calculations
    - `lendingcard_transactions` - Financial transaction history
  - Implementation: `src/services/neon.js`

- Cloudflare D1 - Distributed SQLite database (optional)
  - API: REST API integration via Cloudflare API
  - Used for edge-side queries
  - Credentials: Account ID, Database ID, API token
  - Implementation: `src/services/d1.js`

**File Storage:**
- Local filesystem (template files, ZIP packaging)
  - ZIP creation via `jszip` for template distribution
  - No cloud file storage detected

**Caching:**
- None explicitly configured (Astro/Vite default caching)

## Authentication & Identity

**Auth Provider:**
- Custom authentication system (self-hosted)
  - Implementation: `src/services/auth.js`
  - Method: PBKDF2 password hashing (Web Crypto API, 100k iterations)
  - Session storage: localStorage with `lpf2-session` key
  - Session TTL: 365 days (1 year, long-lived sessions)
  - User data stored in Neon PostgreSQL

**External Integrations:**
- Cloudflare API authentication via bearer token
- Multilogin X authentication via API key
- NodeMaven proxy auth via username/password
- Internet.bs registrar auth via API credentials
- Voluum auth via Access Key ID + Secret

## Monitoring & Observability

**Error Tracking:**
- Sentry - Error and performance monitoring
  - DSN: Environment variable (`PUBLIC_SENTRY_DSN` or `VITE_SENTRY_DSN`)
  - Initialization: `src/services/sentry.js`
  - Configuration:
    - Traces sample rate: 20% production, 100% development
    - Session Replay: 10% production, 0% development
    - Error replay: 100% on error
    - Ignores: ResizeObserver errors, chunk loading failures
    - Breadcrumb masking: Token values masked in URLs
    - Context: App state, component, action tracking

**Logs:**
- Console logging throughout services
- Breadcrumb tracking via Sentry for user actions
- Error context capture with component and action tags

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers - API and automation endpoints
  - Primary API: `https://lp-factory-api.misty-feather-556e.workers.dev`
- Netlify - Potential static hosting (referenced in `astro.config.mjs`)

**CI Pipeline:**
- GitHub Actions (GitHub integration detected, build environment checks)
- Environment: `CI` env variable for CI detection
- Wrangler CLI for Cloudflare Workers deployment

## Environment Configuration

**Required env vars:**
- `VITE_API_BASE` - API server URL (defaults to Cloudflare Worker)
- `VITE_CF_API_TOKEN` or `CF_API_TOKEN` - Cloudflare API authentication
- `VITE_NEON_CONNECTION_STRING` - Neon database connection string
- `VITE_SENTRY_DSN` or `PUBLIC_SENTRY_DSN` - Sentry error tracking

**Optional env vars (user-configurable in Settings):**
- `d1AccountId`, `d1DatabaseId`, `d1ApiToken` - Cloudflare D1
- `nmProxyUser`, `nmProxyPassword` - NodeMaven proxy
- `ipinfoToken` - IPinfo.io API key
- `scamalyticsKey` - Scamalytics API key
- `ip2locationKey` - IP2Location API key
- Multilogin API key
- Voluum Access Key ID + Secret

**Secrets location:**
- `.env` and `.env.lock` files (local development)
- `.env.production` (production build variables)
- Environment variables in deployment platform (Cloudflare, Netlify)
- LocalStorage under `lpf2-settings` key (user-provided credentials)

## Webhooks & Callbacks

**Incoming:**
- None explicitly detected

**Outgoing:**
- Cloudflare Workers routes for automation callbacks
- Potential registrar webhooks (Internet.bs domain events)

## Request Routing & Proxying

**API Proxy Layer:**
- Custom proxy implementation in Worker handles:
  - Cloudflare API calls (prevents CORS issues)
  - Registrar automation endpoints
  - Voluum API routing
  - Multilogin integration
  - IP quality check APIs

**Dev Server Proxy:**
- Vite dev server proxies `/api` to `VITE_API_BASE` (configured in `astro.config.mjs`)
- CORS headers and CSP configured for local development

---

*Integration audit: 2026-03-20*
