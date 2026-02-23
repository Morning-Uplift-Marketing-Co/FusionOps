# FusionOps - Web Deployment & GitHub Actions Setup

## Current Status

### ✅ Completed
- D1 Databases created (3 databases)
- Migrations run successfully
- Cloudflare Workers deployed (4 workers)

### ⏳ Remaining
- Web App deployment to Cloudflare Pages
- GitHub Actions CI/CD setup
- Environment configuration

---

## Part 1: Cloudflare Pages Setup

### Option A: Create Project via Dashboard (Recommended)

1. **Go to Cloudflare Dashboard**
   - URL: https://dash.cloudflare.com/ef771cfd6197dedb36bb3cea22ecf4fc/pages

2. **Create New Project**
   - Click "Create a project"
   - Select "Upload assets" (NOT Connect to Git)
   - Project name: `fusionops-web`
   - Click "Create project"

3. **Deploy via CLI**
   ```bash
   cd /f/AI_Workspace/beta-project/ppc-claude-web-V1
   npx -y wrangler@latest pages deploy dist --project-name=fusionops-web --commit-dirty=true
   ```

### Option B: Deploy to Alternative Platforms

#### Vercel
```bash
npm install -g vercel
vercel --prod
```

#### Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

---

## Part 2: GitHub Actions Configuration

### 2.1 Required GitHub Secrets

Go to: https://github.com/Morning-Uplift-Marketing-Co/FusionOps/settings/secrets/actions

| Secret Name | Value | Description |
|--------------|-------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | `ef771cfd6197dedb36bb3cea22ecf4fc` | Your Cloudflare Account ID |
| `CLOUDFLARE_API_TOKEN` | *(create from dashboard)* | API Token with Workers/D1/Pages edit permissions |

### 2.2 Create Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Template: "Edit Cloudflare Workers"
4. Permissions:
   - Account - Cloudflare Pages - Edit
   - Account - Workers Scripts - Edit
   - Account - D1 - Edit
5. Click "Continue to summary" → "Create Token"
6. Copy the token

---

## Part 3: Update GitHub Actions Workflow

### 3.1 Main Deploy Workflow

Create/Update `.github/workflows/deploy-web.yml`:

```yaml
name: Deploy Web Application

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=fusionops-web
```

### 3.2 Workers Deploy Workflow

Create/Update `.github/workflows/deploy-workers.yml`:

```yaml
name: Deploy Workers

on:
  push:
    paths:
      - 'apps/api-worker/**'
      - 'apps/pixel-worker/**'
      - 'apps/worker/**'
      - 'apps/cf-proxy/**'
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-api-worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
          working-directory: apps/api-worker

  deploy-pixel-worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
          working-directory: apps/pixel-worker

  deploy-callback-worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
          working-directory: apps/worker

  deploy-cf-proxy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
          working-directory: apps/cf-proxy
```

---

## Part 4: Environment Variables

### 4.1 Local Development (.env.local)

```env
# Neon Database
NEON_DATABASE_URL=postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=ef771cfd6197dedb36bb3cea22ecf4fc
CLOUDFLARE_API_TOKEN=your_token_here
```

### 4.2 Production Environment

For production, these should be in GitHub Secrets, not committed to git.

---

## Part 5: Custom Domain Configuration

### 5.1 Worker Routes

For production, add custom domain routes to `wrangler.toml` files:

**Pixel Worker** (apps/pixel-worker/wrangler.toml):
```toml
[[routes]]
pattern = "t.yourdomain.com/*"
zone_name = "yourdomain.com"

[[routes]]
pattern = "t.anotherdomain.com/*"
zone_name = "anotherdomain.com"
```

**Callback Worker** (apps/worker/wrangler.toml):
```toml
[[routes]]
pattern = "api.yourdomain.com/*"
zone_name = "yourdomain.com"
```

### 5.2 DNS Records

For each custom domain, add DNS records:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| A | `t` | Cloudflare IP | Proxied |
| A | `api` | Cloudflare IP | Proxied |

---

## Part 6: Verification Checklist

After deployment, verify:

- [ ] Web app loads at `https://fusionops-web.pages.dev`
- [ ] Workers respond at their `.workers.dev` URLs
- [ ] D1 databases are accessible from workers
- [ ] GitHub Actions runs successfully on push
- [ ] Custom domains work (if configured)

---

## Part 7: Troubleshooting

### Common Issues

**Issue:** "Project not found" when deploying to Pages
- **Solution:** Create project via Dashboard first

**Issue:** "binding DB must have a database that already exists"
- **Solution:** Ensure D1 database ID matches in wrangler.toml

**Issue:** Workers deployed but database errors
- **Solution:** Run migrations with `--remote` flag

---

## Quick Start Commands

```bash
# Build web app
npm run build

# Deploy to Cloudflare Pages (after project created)
npx -y wrangler@latest pages deploy dist --project-name=fusionops-web

# Deploy all workers
node scripts/deploy-all.js --workers-only

# Test locally
npm run dev
```

---

## Next Steps

1. Create Cloudflare Pages project (Dashboard)
2. Add GitHub Secrets
3. Push code to trigger GitHub Actions
4. Configure custom domains (optional)
5. Monitor deployments

---

*Last Updated: 2026-02-23*
*Status: Ready for deployment*
