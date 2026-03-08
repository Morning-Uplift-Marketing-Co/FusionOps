# Landing Page Templates

**Last Updated**: 2026-03-09
**Backup Location**: `F:\SaaS\ppc-templates-backup.zip` (329 MB)

---

## 🎯 Production Templates

### 1. **pet-orange-white** ✅ PRODUCTION

**Status**: Active in production
**Framework**: Astro + React
**LeadsGate**: ✅ Fully integrated
**Tracking**: ✅ fpPixel + Voluum

**Live Sites**:
- `scratchpaypet.tech` (lp-scratchpaypet-tech)
- `joracreditz.com` (lp-jora-creditz-main)

**Features**:
- ✅ LeadsGate form integration (template: "fresh")
- ✅ First-party pixel tracking
- ✅ Voluum dtpCallback integration
- ✅ Mobile-optimized design
- ✅ ZIP code capture
- ✅ Full event tracking (pv, form_start, form_submit, lg_*)

**Deploy Pattern**:
```bash
# Build with env vars from deploy-configs/{domain}.json
npm run build
npx wrangler pages deploy dist/ --project-name=lp-{slug}
```

---

### 2. **template-001** ⚠️ TEST/DEVELOPMENT

**Status**: Test template
**Framework**: Astro + React
**LeadsGate**: ✅ Integrated
**Tracking**: ✅ fpPixel + Voluum

**Purpose**: 
- Testing new features
- Template development
- A/B testing experiments

**Features**:
- Similar structure to pet-orange-white
- Used for testing before production deployment
- Can be customized for specific campaigns

---

### 3. **blank-template** 📦 STARTER

**Status**: Empty starter template
**Purpose**: Base template for creating new landing pages

---

## 🗑️ Deleted Templates (Backed up)

The following templates were removed on 2026-03-09:
- PDL_Loans_V3
- astro-test002
- bear-loan-astro
- elastic-credits-v3
- elastic-credits-v4
- installment-bear
- installment-loans-101
- pdl_new_01
- pet_loans_v1
- pro-lp-v1
- pro-lp-v1.backup
- project
- test-astro-001

**Backup**: All deleted templates are preserved in `F:\SaaS\ppc-templates-backup.zip`

---

## 📋 Template Requirements

### Minimum Requirements for Production:
1. ✅ LeadsGate integration with whitelisted template name
2. ✅ First-party pixel tracking (fpPixel)
3. ✅ Voluum tracking (optional but recommended)
4. ✅ Mobile-responsive design
5. ✅ ZIP code capture form
6. ✅ GTM/dataLayer events
7. ✅ CORS-compliant
8. ✅ Fast load time (<2s)

### LeadsGate Template Whitelist:
```javascript
["wallet-lines", "neo", "elvis-us", "zen", "fresh", "acdc", "confi", "freddo"]
```

**Recommended**: Use `"fresh"` (current default)

---

## 🚀 Deployment Checklist

When deploying a new site:
- [ ] Create `deploy-configs/{domain}.json`
- [ ] Set `aid` (LeadsGate affiliate ID)
- [ ] Set `voluumDomain` = `link.{domain}`
- [ ] Set `voluumClickUrl` = `https://link.{domain}/click`
- [ ] Set `cfApiToken` and `cfAccountId` to `""` (use GitHub secrets)
- [ ] Choose template in config
- [ ] Push to GitHub → CI auto-deploys
- [ ] Verify deployment at Cloudflare Pages
- [ ] Test tracking endpoints
- [ ] Verify LeadsGate form loads

---

## 📊 Template Comparison

| Feature | pet-orange-white | template-001 | blank-template |
|---------|-----------------|--------------|----------------|
| Production Ready | ✅ Yes | ⚠️ Test Only | ❌ No |
| LeadsGate | ✅ Yes | ✅ Yes | ❌ No |
| Tracking | ✅ Full | ✅ Full | ❌ No |
| Live Sites | 2+ | 0 | 0 |
| Design | Pet Loans | Generic | Empty |
| Customizable | ✅ Yes | ✅ Yes | ✅ Yes |

---

## 🔧 Development Notes

### Creating a New Template:
1. Copy `pet-orange-white` or `template-001`
2. Update branding/colors in template
3. Test locally with `npm run dev`
4. Create deploy config
5. Deploy to test domain first
6. Verify all tracking works
7. Deploy to production

### Template Structure:
```
template-name/
├── src/
│   ├── pages/
│   │   ├── index.astro       # Landing page
│   │   └── apply.astro       # LeadsGate form page
│   ├── components/           # React components
│   ├── layouts/
│   │   └── BaseLayout.astro  # fpPixel + Voluum scripts
│   └── styles/
├── public/                   # Static assets
├── astro.config.mjs
└── package.json
```

---

## 📝 Notes

- All templates use Astro SSG (Static Site Generation)
- React components used only for interactive elements
- First-party tracking via `t.{domain}/e` endpoint
- LeadsGate forms loaded from `apikeep.com`
- Voluum tracking via `dtpCallback.js`

---

**For questions or issues, refer to**:
- Main README.md
- DEPLOYMENT_SUMMARY.md
- System memories (LeadsGate integration rules)
