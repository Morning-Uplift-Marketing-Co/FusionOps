# Dead Code Analysis Report

**Date:** 2026-02-16
**Tool:** knip@5.83.1
**Project:** lp-factory-web v2.1.0

---

## Executive Summary

This report categorizes findings from dead code analysis into three risk levels:

- **SAFE** - Confirmed unused, safe to delete
- **CAUTION** - Used in non-standard ways (default exports), verify before deleting
- **DANGER** - Part of core functionality, DO NOT REMOVE

---

## 1. SAFE - Confirmed Unused (Can Be Deleted)

### 1.1 Git Worktrees (Safe to Ignore)
These files are in `.claude/worktrees/` which are git worktree directories. They are not part of the main codebase and should be excluded from analysis.

**Files:** ~133 files in `.claude/worktrees/` directories

**Action:** Exclude from analysis via knip config

### 1.2 Unused Constants

File: `src/constants/index.js`

| Export | Line | Status | Notes |
|--------|------|--------|-------|
| `STATUSES` | 47 | SAFE | Not used anywhere |
| `SECTION_ORDERS` | 58 | SAFE | Not used anywhere |
| `COMPLIANCE_VARIANTS` | 66 | SAFE | Not used anywhere |

### 1.3 Unused Utility Functions

File: `src/utils/index.js`

| Export | Line | Status | Notes |
|--------|------|--------|-------|
| `similarity` | 28 | SAFE | Only used internally by `maxSim` |
| `maxSim` | 39 | SAFE | Not used anywhere |
| `pick` | 45 | SAFE | Not used anywhere |

**Note:** `similarity` is only called by `maxSim`, which itself is unused. Both can be removed.

---

## 2. CAUTION - Used via Default Exports (Review Before Deleting)

### 2.1 Service Modules (Default Export Pattern)

These modules use **default exports** which knip cannot properly track. The exports ARE being used, but through default imports.

| File | Exported As | Used In | Status |
|------|-------------|---------|--------|
| `src/services/registrar.js` | `registrarApi` (default) | `OpsCenter.jsx` | KEEP |
| `src/services/cloudflare-dns.js` | `cloudflareDns` (default) | `OpsCenter.jsx`, `deploy/*` | KEEP |
| `src/services/cloudflare-zone.js` | `cloudflareZone` (default) | `deploy/DnsSection.jsx` | KEEP |

**All functions in these files are re-exported via default export and ARE in use.**

### 2.2 React Components (Named + Default Exports)

These components have duplicate exports (named + default). Only the **named export** should be kept.

| File | Named Export | Default Export | Action |
|------|--------------|----------------|--------|
| `src/components/OpsCenter/deploy/DeployTab.jsx` | `DeployTab` | `default` | Remove default export |
| `src/components/OpsCenter/deploy/DeployDashboard.jsx` | `DeployDashboard` | `default` | Remove default export |
| `src/components/OpsCenter/deploy/DeployHistory.jsx` | `DeployHistory` | `default` | Remove default export |
| `src/components/OpsCenter/deploy/DeploySection.jsx` | `DeploySection` | `default` | Remove default export |
| `src/components/OpsCenter/deploy/QuickActionsPanel.jsx` | `QuickActionsPanel` | `default` | Remove default export |
| `src/components/OpsCenter/deploy/DnsSection.jsx` | `DnsSection` | `default` | Remove default export |
| `src/components/OpsCenter/deploy/DnsRecordModal.jsx` | `DnsRecordModal` | `default` | Remove default export |

### 2.3 GTM Exporter

File: `src/utils/gtm-exporter.js`

| Export | Status | Notes |
|--------|--------|-------|
| `generateGtmJson` | USED | Called in same file at line 82 |

**Status:** Actually used, knip missed the internal call. KEEP.

---

## 3. DANGER - Core Functionality (DO NOT REMOVE)

### 3.1 Neon Database Service
- File: `src/services/neon.js`
- Export: `isNeonReady`
- **Status:** Used in App.jsx, KEEP

### 3.2 Deployers
- Files in `src/utils/deployers/`
- Functions: `saveDeploymentRecord`, `clearDeploymentHistory`, `getAllDeployConfigs`
- **Status:** Core deployment logic, KEEP

---

## 4. Applications Subdirectories

The `apps/` directory contains standalone applications that are deployed independently:

| App | Purpose | Deploy Target | Status |
|-----|---------|---------------|--------|
| `apps/lander` | Astro landing page generator | Vercel/Netlify | ACTIVE |
| `apps/worker` | Cloudflare Worker (Voluum callback) | Cloudflare Workers | ACTIVE |
| `apps/cf-proxy` | Cloudflare proxy worker | Cloudflare Workers | ACTIVE |
| `apps/api-worker` | API worker for automation | Cloudflare Workers | ACTIVE |

These are **separate deployment targets** and not "dead code". They should be excluded from main project analysis.

---

## 5. Recommended Actions

### Immediate Cleanup (SAFE)

1. **Remove unused constants from `src/constants/index.js`:**
   ```javascript
   // Remove these lines:
   export const STATUSES = ["active", "paused", "suspended", "setup", "expired"];
   export const SECTION_ORDERS = [...];
   export const COMPLIANCE_VARIANTS = [...];
   ```

2. **Remove unused functions from `src/utils/index.js`:**
   ```javascript
   // Remove these lines:
   export function similarity(a, b) { ... }
   export function maxSim(v, all) { ... }
   export const pick = ...;
   ```

### Refactoring (CAUTION)

3. **Remove duplicate default exports from React components:**
   - For each component in `src/components/OpsCenter/deploy/`, remove the `export default` line
   - Keep the named export (e.g., `export function DeployTab`)

### Configuration

4. **Create `knip.json` to exclude worktrees and apps:**
   ```json
   {
     "entry": ["src/App.jsx", "src/main.jsx"],
     "project": ["src/**/*.{js,jsx,ts,tsx}"],
     "ignore": [
       ".claude/worktrees/**",
       "apps/**",
       ".reports/**"
     ],
     "ignoreExports": [
       "**/*.config.{js,mjs}",
       "**/migrations/**"
     ]
   }
   ```

---

## 6. Estimated Impact

| Category | Count | Lines | Notes |
|----------|-------|-------|-------|
| Unused constants | 3 | ~30 | All safe to remove |
| Unused utilities | 3 | ~40 | All safe to remove |
| Duplicate exports | 7 | 7 | One line per file |
| **Total** | **13** | **~77** | Low risk |

---

## 7. Files NOT Safe to Remove (Knip False Positives)

The following were flagged by knip but are **actively used**:

- `src/services/neon.js` - `isNeonReady` used in App.jsx
- `src/services/registrar.js` - Default export used in OpsCenter.jsx
- `src/services/cloudflare-dns.js` - Default export used throughout
- `src/services/cloudflare-zone.js` - Default export used in DnsSection.jsx
- `src/utils/gtm-exporter.js` - `generateGtmJson` called internally
- All deployer functions - Core deployment logic
- All `apps/` subdirectories - Separate deployment targets

---

## 8. Next Steps

1. Review this report
2. Create backup branch: `git checkout -b backup-before-cleanup`
3. Remove SAFE items (section 5.1-5.2)
4. Fix duplicate exports (section 5.3)
5. Create knip.json config (section 5.4)
6. Run tests: `npm run build && npm test`
7. Commit changes with detailed message
8. Update DELETION_LOG.md (if exists)

---

## Appendix: Knip Output (Raw)

Total unused files found: 133 (mostly in .claude/worktrees/)
Total unused exports: 41 (many false positives due to default exports)
Duplicate exports: 7 (all are named+default in React components)

