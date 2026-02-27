# FusionOps - Infrastructure Setup Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FusionOps Architecture                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   Web App       │    │  Landing Pages  │    │  Tracking Pixel │ │
│  │   (Astro)       │    │  (Astro Build)  │    │  (CF Worker)    │ │
│  │                 │    │                 │    │                 │ │
│  │  Cloudflare     │    │  Cloudflare     │    │  t.{domain}/e   │ │
│  │  Pages          │    │  Pages          │    │                 │ │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘ │
│           │                      │                      │           │
│           │                      │                      │           │
│           ▼                      ▼                      ▼           │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │  API Worker     │    │ Callback Worker │    │ Pixel Worker    │ │
│  │  (CF Worker)    │    │ (CF Worker)     │    │ (CF Worker)     │ │
│  │                 │    │                 │    │                 │ │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘ │
│           │                      │                      │           │
│           └──────────────────────┼──────────────────────┘           │
│                                  ▼                                  │
│                   ┌─────────────────────────┐                       │
│                   │                         │                       │
│                   │      D1 Databases       │                       │
│                   │   (Cloudflare SQLite)   │                       │
│                   │                         │                       │
│                   │  - lp-factory-db        │                       │
│                   │  - pixel-events         │                       │
│                   │                         │                       │
│                   └─────────────────────────┘                       │
│                                  ▼                                  │
│                   ┌─────────────────────────┐                       │
│                   │      Neon Postgres      │                       │
│                   │   (Settings + Sites)    │                       │
│                   │                         │                       │
│                   │  - settings             │                       │
│                   │  - sites                │                       │
│                   │  - deploy_history       │                       │
│                   │                         │                       │
│                   └─────────────────────────┘                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Cloudflare Setup

### 1.1 Cloudflare Account

1. **Create/Access Cloudflare Account**
   - Go to https://dash.cloudflare.com/sign-up
   - Verify email address

2. **Get Account ID**
   - Login to Cloudflare Dashboard
   - Click **Workers & Pages**
   - Account ID is in the right sidebar or URL:
     ```
     https://dash.cloudflare.com/ACCOUNT_ID/workers
     ```

### 1.2 Cloudflare D1 Databases

Create **3 D1 databases**:

| Database Name | Purpose | Binding Name |
|---------------|---------|--------------|
| `fusionops-main` | Main app data (sites, settings) | `DB` |
| `fusionops-pixel` | Analytics tracking events | `DB` |
| `fusionops-callback` | Lead callback handling | `DB` |

#### Commands to create databases:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create D1 databases
wrangler d1 create fusionops-main
wrangler d1 create fusionops-pixel
wrangler d1 create fusionops-callback
```

**Save the database IDs** from output - they look like:
```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 1.3 Run D1 Migrations

```bash
# Main database migrations
cd apps/api-worker
wrangler d1 execute fusionops-main --file=./migrations/0001_init.sql
wrangler d1 execute fusionops-main --file=./migrations/0002_deploy_history.sql
wrangler d1 execute fusionops-main --file=./migrations/0002_add_templates.sql

# Pixel worker migrations
cd ../pixel-worker
wrangler d1 execute fusionops-pixel --file=./migrations/0001_pixel_events.sql

# Callback worker migrations
cd ../worker
wrangler d1 execute fusionops-callback --file=./migrations/0001_init.sql
```

### 1.4 Update wrangler.toml Files

Replace `database_id` in each `wrangler.toml`:

**apps/api-worker/wrangler.toml:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "fusionops-main"
database_id = "YOUR_NEW_DATABASE_ID"  # Replace this
```

**apps/pixel-worker/wrangler.toml:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "fusionops-pixel"
database_id = "YOUR_NEW_DATABASE_ID"  # Replace this
```

**apps/worker/wrangler.toml:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "fusionops-callback"
database_id = "YOUR_NEW_DATABASE_ID"  # Replace this
```

### 1.5 Deploy Cloudflare Workers

```bash
# Deploy all workers
cd apps/api-worker    && wrangler deploy
cd apps/cf-proxy      && wrangler deploy
cd apps/pixel-worker  && wrangler deploy
cd apps/worker        && wrangler deploy
```

---

## Part 2: Neon Postgres Setup

### 2.1 Create Neon Project

1. **Go to Neon Console**
   - Visit https://console.neon.tech/signup
   - Sign up/login (GitHub/Google/Email)

2. **Create New Project**
   - Click **"Create a project"**
   - Project name: `fusionops-main`
   - Region: Choose closest to your users (e.g., `AWS us-east-1`)
   - PostgreSQL version: `16` (default)

3. **Get Connection String**
   - Go to project dashboard
   - Find **Connection Details**
   - Copy the connection string:
     ```
     postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require
     ```

### 2.2 Create Neon Tables

Run these SQL commands in Neon SQL Editor (https://console.neon.tech/sql):

```sql
-- Settings table (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites table (landing page configurations)
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deploy history table
CREATE TABLE IF NOT EXISTS deploy_history (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES sites(id),
  target TEXT NOT NULL,  -- 'cloudflare', 'vercel', 'netlify'
  url TEXT,
  status TEXT DEFAULT 'pending',  -- 'pending', 'success', 'failed'
  brand TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deploy_history_site_id ON deploy_history(site_id);
CREATE INDEX IF NOT EXISTS idx_deploy_history_created_at ON deploy_history(created_at DESC);
```

### 2.3 Configure Neon Connection in App

Add Neon connection string to GitHub Secrets:

| Secret Name | Value |
|-------------|-------|
| `NEON_DATABASE_URL` | `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require` |

---

## Part 3: GitHub Secrets Configuration

### 3.1 Cloudflare Secrets

| Secret | Value | How to Get |
|--------|-------|------------|
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID | Dashboard → Workers & Pages → URL |
| `CLOUDFLARE_API_TOKEN` | API token | Create at https://dash.cloudflare.com/profile/api-tokens |

**Create Cloudflare API Token:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Use **"Edit Cloudflare Workers"** template
4. Permissions:
   - Account - Cloudflare Pages - Edit
   - Account - Workers Scripts - Edit
   - Account - D1 - Edit
5. Click **"Continue to summary"** → **"Create Token"**
6. Copy the token

### 3.2 Neon Secrets

| Secret | Value |
|--------|-------|
| `NEON_DATABASE_URL` | Your Neon connection string |

### 3.3 Optional Vercel Secrets

| Secret | Value | How to Get |
|--------|-------|------------|
| `VERCEL_TOKEN` | API token | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Org ID | `.vercel/project.json` after linking |
| `VERCEL_PROJECT_ID` | Project ID | `.vercel/project.json` after linking |

### 3.4 Optional Netlify Secrets

| Secret | Value | How to Get |
|--------|-------|------------|
| `NETLIFY_AUTH_TOKEN` | Personal token | https://app.netlify.com/user/applications |
| `NETLIFY_SITE_ID` | Site ID | Netlify Site Settings → Site details |

---

## Part 4: Cloudflare Pages Setup

### 4.1 Create Pages Project (Web App)

1. **Go to Cloudflare Pages**
   - Dashboard → Workers & Pages → Create application → Pages

2. **Connect to GitHub**
   - Select `FusionOps` repository
   - Build settings:
     - Build command: `npm run build`
     - Build output directory: `dist`
     - Root directory: `/`

3. **Environment Variables**
   - Add `NEON_DATABASE_URL` (if needed in build)

### 4.2 Custom Domain (Optional)

1. **Add Custom Domain**
   - Pages project → Custom domains → Add domain
   - Enter your domain (e.g., `app.fusionops.com`)

2. **Update DNS**
   - Cloudflare will automatically add DNS records

---

## Part 5: Worker Routes Configuration

### 5.1 Pixel Worker Routes

For tracking pixel, add routes to each landing page domain:

**In `apps/pixel-worker/wrangler.toml`:**
```toml
[[routes]]
pattern = "t.yourdomain1.com/*"
zone_name = "yourdomain1.com"

[[routes]]
pattern = "t.yourdomain2.com/*"
zone_name = "yourdomain2.com"
```

### 5.2 Callback Worker Routes

**In `apps/worker/wrangler.toml`:**
```toml
[[routes]]
pattern = "api.yourdomain1.com/*"
zone_name = "yourdomain1.com"
```

---

## Part 6: Verification Checklist

After setup, verify each component:

### 6.1 Cloudflare Workers
```bash
# List workers
wrangler deployments list

# Check worker logs
wrangler tail
```

### 6.2 D1 Databases
```bash
# Query main database
wrangler d1 execute fusionops-main --command="SELECT * FROM sites LIMIT 5"

# Query pixel database
wrangler d1 execute fusionops-pixel --command="SELECT COUNT(*) as count FROM pixel_events"
```

### 6.3 Neon Database
Run in Neon SQL Editor:
```sql
-- Test connection
SELECT NOW();

-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

### 6.4 Web App
- Visit deployed URL
- Check all pages load
- Test Settings page (Neon connection)
- Test Deploy flow

---

## Part 7: DNS Configuration

### 7.1 Required DNS Records

For each landing page domain:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | Cloudflare IP | Proxied |
| A | `www` | Cloudflare IP | Proxied |
| A | `t` | Cloudflare IP | Proxied (pixel subdomain) |
| A | `api` | Worker route | Proxied (callback) |

### 7.2 Cloudflare IP Addresses
```
A Records can point to any Cloudflare IP:
- 172.66.x.x
- 162.159.x.x
- Or use CNAME to your Pages project
```

---

## Part 8: Security Best Practices

### 8.1 Secrets Management
- [ ] Never commit secrets to git
- [ ] Use GitHub Secrets for all sensitive data
- [ ] Rotate API tokens quarterly
- [ ] Use separate tokens for dev/prod

### 8.2 Worker Security
- [ ] Limit worker permissions (token scopes)
- [ ] Enable rate limiting on public endpoints
- [ ] Use CORS for API worker
- [ ] Validate all input in workers

### 8.3 Database Security
- [ ] Enable SSL for all connections
- [ ] Use prepared statements (D1/Neon handle this)
- [ ] Implement row-level security where needed
- [ ] Regular backups (Neon auto-backups enabled)

---

## Part 9: Monitoring & Logging

### 9.1 Cloudflare Analytics
- Dashboard → Workers & Pages → Your worker → Analytics
- Monitor: requests, errors, CPU time, memory

### 9.2 Neon Monitoring
- Dashboard → Your project → Metrics
- Monitor: storage, connections, compute time

### 9.3 Error Tracking (Optional)
Consider adding:
- Sentry for error tracking
- Logpush for Cloudflare logs to external storage

---

## Quick Start Commands

```bash
# 1. Install dependencies
npm install

# 2. Login to services
wrangler login

# 3. Create D1 databases
wrangler d1 create fusionops-main
wrangler d1 create fusionops-pixel
wrangler d1 create fusionops-callback

# 4. Run migrations (update IDs in wrangler.toml first)
cd apps/api-worker && wrangler d1 execute fusionops-main --file=./migrations/0001_init.sql

# 5. Deploy workers
cd apps/api-worker && wrangler deploy
cd apps/pixel-worker && wrangler deploy
cd apps/worker && wrangler deploy

# 6. Build and deploy web app
npm run build
# Or use GitHub Actions for automatic deployment
```

---

## Environment Variables Reference

| Variable | Where Used | Required |
|----------|-----------|----------|
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions, wrangler | Yes |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions, wrangler | Yes |
| `NEON_DATABASE_URL` | Web app, API worker | Yes |
| `VERCEL_TOKEN` | GitHub Actions (Vercel deploy) | No |
| `VERCEL_ORG_ID` | GitHub Actions (Vercel deploy) | No |
| `VERCEL_PROJECT_ID` | GitHub Actions (Vercel deploy) | No |
| `NETLIFY_AUTH_TOKEN` | GitHub Actions (Netlify deploy) | No |
| `NETLIFY_SITE_ID` | GitHub Actions (Netlify deploy) | No |

---

*Last Updated: 2025-02-22*
*Status: Ready for implementation*
