# FusionOps - Implementation Plan

## Project Overview

**FusionOps** is a landing page deployment platform for lead generation campaigns. It automates the creation, deployment, and tracking of high-converting landing pages across multiple platforms (Cloudflare Pages, Vercel, Netlify).

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Astro 5 + React 19 + Tailwind CSS 4 |
| Backend | Cloudflare Workers (D1 Database) |
| Deployment | GitHub Actions (multi-platform) |
| Tracking | Custom First-Party Pixel + Voluum + Google Ads (gtag.js) |
| Testing | Vitest + Playwright |

---

## Phase 1: Foundation Setup (Week 1)

### 1.1 Repository Setup
- [x] Initialize new Git repository
- [x] Clean git history
- [ ] Push to `git@github.com:Morning-Uplift-Marketing-Co/FusionOps.git`
- [ ] Set up GitHub branch protection rules
- [ ] Configure GitHub Actions secrets

### 1.2 GitHub Secrets Configuration
| Secret | Purpose | Source |
|--------|---------|--------|
| `CLOUDFLARE_API_TOKEN` | Deploy to CF Pages/Workers | Cloudflare Dashboard |
| `CLOUDFLARE_ACCOUNT_ID` | CF account identification | Cloudflare Dashboard |
| `VERCEL_TOKEN` | Deploy to Vercel (optional) | Vercel Settings |
| `VERCEL_ORG_ID` | Vercel organization | `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Vercel project | `.vercel/project.json` |
| `NETLIFY_AUTH_TOKEN` | Deploy to Netlify (optional) | Netlify Settings |
| `NETLIFY_SITE_ID` | Netlify site | Netlify Settings |

### 1.3 Development Environment
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test
npm run test:e2e
```

---

## Phase 2: Core Application Structure (Week 1-2)

### 2.1 Monorepo Structure
```
fusionops/
├── apps/
│   ├── lander/           # Astro landing page builder
│   ├── api-worker/       # Main API endpoint
│   ├── cf-proxy/         # CORS proxy worker
│   ├── worker/           # Callback handler
│   └── pixel-worker/     # Analytics tracking pixel
├── packages/
│   └── lp-template-generator/  # Template generation library
├── src/
│   ├── pages/            # Web app pages
│   ├── components/       # React components
│   ├── lib/              # Utilities
│   └── services/         # API clients
├── templates/            # Landing page templates
├── .github/workflows/    # CI/CD
└── docs/                 # Documentation
```

### 2.2 Key Components to Build
- [ ] **Wizard Flow** - Multi-step landing page builder
- [ ] **Template Registry** - Manage landing page templates
- [ ] **Deployment Manager** - Handle multi-platform deploys
- [ ] **OpsCenter** - Dashboard for monitoring

---

## Phase 3: Landing Page Templates (Week 2-3)

### 3.1 Template Categories
| Category | Templates | Status |
|----------|-----------|--------|
| PDL (Payday Loans) | `pdl-loans-v3` | Existing |
| Installment Loans | `installment-loans-v1` | Existing |
| ScratchPay Bridge | `scratchpay-bridge` | Existing |
| Elastic Credits | `elastic-credits-v4` | Existing |
| Simple LP | `simple-lp` | Existing |

### 3.2 Template System Features
- [ ] Dynamic color/theme customization
- [ ] Form field mapping
- [ ] Tracking pixel injection
- [ ] Multi-language support (future)

---

## Phase 4: Deployment Infrastructure (Week 3-4)

### 4.1 GitHub Actions Workflows
```yaml
Workflows:
├── ci.yml              # Run tests on push
├── deploy-web.yml      # Deploy web app
├── deploy-sites.yml    # Deploy landing pages
├── deploy-domain.yml   # Single domain deploy (survival mode)
└── security.yml        # Security scanning
```

### 4.2 Deployment Targets
| Platform | Purpose | Status |
|----------|---------|--------|
| Cloudflare Pages | Primary web app | Configured |
| Vercel | Backup/alternative | Optional |
| Netlify | Backup/alternative | Optional |
| Cloudflare Workers | API/Backend | Configured |

### 4.3 Cloudflare D1 Database Migrations
```sql
-- Database: lp-factory-db
migrations/
├── 0001_init.sql           # Main schema
├── 0002_deploy_history.sql # Deployment tracking
└── 0003_templates.sql      # Template registry

-- Database: ppc-gen-claude (pixel tracking)
migrations/
└── 0001_pixel_events.sql   # Analytics events
```

---

## Phase 5: Tracking & Analytics (Week 4)

### 5.1 Conversion Actions
| Action | Type | Trigger | Method |
|--------|------|---------|--------|
| `form_start` | Secondary | Amount/ZIP interact | gtag.js |
| `form_submit` | Primary | Form submission | gtag.js |
| `sold_lead` | Primary | Lead approval | Voluum s2s |

### 5.2 Tracking Implementation
```javascript
// Form embed code template
var _lg_form_init_ = {
    aid: "ACCOUNT_ID",
    template: "TEMPLATE_NAME",
    click_id: getUrlParam('clickid'),

    onFormLoad: function() {
        gtag('event', 'conversion', { send_to: 'AW-XXX/form_start' });
        pixel('fl');
    },

    onSubmit: function() {
        gtag('event', 'conversion', { send_to: 'AW-XXX/form_submit' });
        pixel('fs', { clickid });
    }
};
```

### 5.3 Custom Pixel Events
- `page_view` - Page loaded
- `form_load` - Form initialized
- `step_change` - Multi-step progression
- `form_submit` - Form submitted
- `success` - Lead generated
- `scroll_25/50/75/100` - Scroll depth
- `time_on_page_30s/60s` - Engagement time
- `amount_selected` - Loan amount chosen
- `zip_entered` - ZIP code entered

---

## Phase 6: Testing & Quality Assurance (Week 5)

### 6.1 Test Coverage
| Test Type | Tool | Target |
|-----------|------|--------|
| Unit | Vitest | 80%+ coverage |
| Integration | Vitest | API endpoints |
| E2E | Playwright | Critical flows |

### 6.2 Critical Test Scenarios
- [ ] Wizard complete flow (create → preview → deploy)
- [ ] Template selection and customization
- [ ] Form submission with tracking
- [ ] Multi-platform deployment
- [ ] Pixel tracking verification

---

## Phase 7: Production Launch (Week 6)

### 7.1 Pre-Launch Checklist
- [ ] All GitHub secrets configured
- [ ] D1 databases migrated (production)
- [ ] DNS records configured
- [ ] SSL certificates valid
- [ ] Monitoring/alerting set up
- [ ] Backup procedures documented

### 7.2 Launch Steps
1. Deploy to staging environment
2. Run full E2E test suite
3. Deploy production workers
4. Deploy web application
5. Verify all tracking pixels
6. Monitor first 24 hours

---

## Phase 8: Post-Launch Optimization (Ongoing)

### 8.1 Monitoring Metrics
- Deployment success rate
- Page load times
- Conversion rates
- Error rates
- API response times

### 8.2 Future Enhancements
- [ ] A/B testing framework
- [ ] Multi-language templates
- [ ] Advanced analytics dashboard
- [ ] Template marketplace
- [ ] Custom domain automation

---

## Immediate Actions (Today)

1. **Push to GitHub**
   ```bash
   cd /f/AI_Workspace/beta-project/ppc-claude-web-V1
   git push -u origin main
   ```

2. **Create GitHub repo** (if not exists)
   - Visit https://github.com/new
   - Name: `FusionOps`
   - Organization: `Morning-Uplift-Marketing-Co`

3. **Configure GitHub Secrets**
   - Add Cloudflare credentials
   - Add optional Vercel/Netlify tokens

4. **Run first deployment**
   ```bash
   # Trigger workflow manually from GitHub Actions
   # Or push to main to auto-deploy
   ```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| API key exposure | HIGH | Use GitHub Secrets, rotate regularly |
| D1 data loss | MEDIUM | Regular backups, migration scripts |
| Deployment failure | MEDIUM | Rollback procedures, staging env |
| Tracking breaks | HIGH | Test pixels before launch |

---

## Success Criteria

- [x] Clean Git history
- [ ] All tests passing
- [ ] Successful deployment to production
- [ ] Tracking pixels firing correctly
- [ ] First landing page deployed and converting

---

*Last Updated: 2025-02-22*
*Status: Phase 1 Complete - Ready to push to GitHub*
