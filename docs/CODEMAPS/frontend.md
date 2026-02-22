# Frontend Codemap

**Last Updated:** 2026-02-16
**Framework:** Astro 5.x + React 19.x (Islands Architecture)
**Entry Point:** `src/AppRoot.jsx` -> `src/App.jsx`

## React Architecture

The app uses Astro's Islands Architecture where the shell is server-rendered Astro and interactive components are React islands.

```
┌─────────────────────────────────────────────────────────────┐
│                     Astro Shell                             │
│                   (src/pages/index.astro)                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   React Island Root                         │
│                   (src/AppRoot.jsx)                         │
│                    └─ ErrorBoundary                         │
│                        └─ App.jsx                           │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Sidebar    │  │   TopBar     │  │  Main View   │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ Navigation   │  │ Stats/Health │  │ Page Router  │
│ - Dashboard  │  │ - Builds     │  │ - Dashboard  │
│ - Sites      │  │ - Spend      │  │ - Sites      │
│ - Create     │  │ - Deploys    │  │ - Wizard     │
│ - Variant    │  │ - DB Status  │  │ - Variant    │
│ - Ops        │  └──────────────┘  │ - Ops        │
│ - Deploys    │                    │ - Deploys    │
│ - Settings   │                    │ - Settings   │
└──────────────┘                    └──────────────┘
```

## Components Directory

### Core Application Components

| Component | Purpose | Props | State |
|-----------|---------|-------|-------|
| `App.jsx` | Main app container | N/A | page, sites, ops, settings, stats, deploys |
| `Dashboard.jsx` | Landing overview | sites, stats, ops, setPage | - |
| `Sites.jsx` | Site management & deployment | sites, del, notify, addDeploy | search, deploying, deployUrls, preview |
| `Wizard.jsx` | LP creation (6-step wizard) | config, setConfig, addSite, setPage | step, building, validationErrors |
| `VariantStudio.jsx` | AI variant generation | notify, sites, addSite, registry | v, batch, previews, assets |
| `OpsCenter.jsx` | Operations management | data, add, del, upd, settings | Multi-tab operations UI |
| `Settings.jsx` | Configuration | settings, setSettings, stats | All credential states |
| `DeployHistory.jsx` | Deployment log viewer | deploys | - |

### Reusable UI Components (`Atoms.jsx`)

| Component | Purpose | Props |
|-----------|---------|-------|
| `Card` | Styled container | children, style |
| `Inp` | Input field | value, onChange, style |
| `Sel` | Select dropdown | value, onChange, options |
| `Btn` | Button with variants | children, variant, onClick |
| `MockPhone` | Phone preview frame | children, style |
| `Field` | Form field wrapper | label, req, help, children |
| `Dot` | Status indicator | c (color), label |
| `Badge` | Small badge | color, children |
| `Toast` | Notification popup | msg, type |

### OpsCenter Sub-Components (`components/OpsCenter/deploy/`)

| Component | Purpose |
|-----------|---------|
| `DeployTab.jsx` | Main deployment tab container |
| `QuickActionsPanel.jsx` | Quick action buttons |
| `DnsSection.jsx` | DNS management section |
| `DnsRecordModal.jsx` | DNS record CRUD modal |
| `DeploySection.jsx` | Deployment controls |
| `DeployHistory.jsx` | Deployment history table |
| `DeployDashboard.jsx` | Deployment statistics |

## Wizard Flow (6-Step LP Creation)

```
┌─────────────────────────────────────────────────────────────┐
│                        Wizard State Machine                  │
└─────────────────────────────────────────────────────────────┘

Step 1: Brand Info
  - brand (required)
  - domain (required)
  - tagline
  - email
            │
            ▼
Step 2: Loan Product
  - loanType (required)
  - amountMin, amountMax (validation: min < max)
  - aprMin, aprMax (validation: min < max)
            │
            ▼
Step 3: Design
  - colorId (required) - from COLORS array
  - fontId - from FONTS array
  - layout - hero-left, hero-center, hero-full
  - radius - sharp, subtle, rounded, pill
            │
            ▼
Step 4: Copy & CTA
  - Quick-Start Templates (COPY_SETS)
  - AI Generate (Anthropic API)
  - h1, badge, cta, sub
  - lang (auto-translate)
            │
            ▼
Step 5: Tracking & Ads
  - gtmId
  - conversionId, conversionLabel
  - voluumId, voluumDomain
  - network (NETWORKS_AFF)
  - redirectUrl (required if no embed)
  - formEmbed
            │
            ▼
Step 6: Review & Build
  - Configuration summary
  - Astro project file tree preview
  - Build (creates site with AI copy if needed)
```

## Page Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `pages/index.astro` | Main app shell |
| `/docs` | `pages/docs/index.astro` | Documentation page |

## Data Flow

### App Initialization
```
bootApp()
  ├─ Try Neon DB (primary)
  │   ├─ initNeon(connection string)
  │   ├─ ping()
  │   ├─ loadSettings()
  │   ├─ loadSites()
  │   └─ loadDeploys()
  │
  ├─ Fallback to Legacy API
  │   └─ api.get("/init")
  │
  └─ localStorage (last resort)
```

### Site Creation
```
Wizard.handleBuild()
  ├─ AI copy generation (if needed)
  ├─ Create site object
  ├─ App.addSite()
  │   ├─ Update local state
  │   ├─ db.saveSite() (if Neon)
  │   ├─ api.post("/sites") (if legacy)
  │   └─ notify()
  └─ Navigate to Sites page
```

### Site Deployment
```
Sites.handleDeploy()
  ├─ generateLP(site) -> HTML
  ├─ deployTo(target, html, site, settings)
  │   ├─ Create deployment record
  │   ├─ Call target deployer
  │   ├─ Update DNS (if configured)
  │   └─ Save to history
  └─ Update deployUrls state
```

## Styling

The app uses inline styles with theme constants from `constants/index.js`:

```javascript
THEME = {
  bg: "#0b0d14",
  card: "#12141e",
  text: "#e2e8f0",
  primary: "#6366f1",
  grad: "linear-gradient(135deg,#6366f1,#a855f7)",
  // ... more tokens
}
```

## Related Files

- `src/constants/index.js` - Theme constants, loan types, color schemes, fonts
- `src/utils/index.js` - Helper functions (uid, now, hsl)
- `src/utils/lp-generator.js` - Static HTML generation
- `src/utils/astro-generator.js` - Astro project scaffolding
