# Requirements: LP Factory — Template Pipeline & Anti-Fingerprint

**Defined:** 2026-03-20
**Core Value:** Import any template, inject variables correctly, deploy to Cloudflare with unique fingerprint — every time

## v1 Requirements

### Template Import & Variable Injection

- [ ] **IMPORT-01**: Imported Astro templates receive `PUBLIC_*` env vars at build time (no fallback values in output)
- [ ] **IMPORT-02**: Post-build HTML rewriting replaces any leaked `import.meta.env` expressions with configured values
- [ ] **IMPORT-03**: Template structure normalized after import (detect entry point, validate package.json, fix paths)
- [ ] **IMPORT-04**: Multi-format build pipeline detects and builds Astro, Vite/React, and static HTML templates
- [ ] **IMPORT-05**: Format-specific builders handle deps install, build command, and output directory per framework

### Capability Detection & Wizard

- [ ] **CAPAB-01**: Auto-detect template capabilities by scanning source (calculator, forms, tracking, color themes, sections)
- [ ] **CAPAB-02**: `.lp-manifest.json` schema allows templates to explicitly declare supported capabilities
- [ ] **CAPAB-03**: Wizard dynamically shows/hides steps based on detected + manifest capabilities
- [ ] **CAPAB-04**: Wizard gracefully degrades when template lacks a feature (skip step, show warning, don't break)
- [ ] **CAPAB-05**: CapabilityResolver merges auto-detect + manifest with confidence scoring

### Anti-Fingerprint

- [ ] **FINGER-01**: CSS class names randomized per deploy using deterministic seed (same siteId = same output)
- [ ] **FINGER-02**: DOM attributes varied per deploy (data-*, id prefixes, aria labels)
- [ ] **FINGER-03**: Structural DOM variation (whitespace, comment injection, attribute ordering)
- [ ] **FINGER-04**: Meta tag variation (generator, description phrasing, OG tags)
- [ ] **FINGER-05**: Deterministic seeding ensures redeployment of same site produces identical output
- [ ] **FINGER-06**: Anti-fingerprint applied post-build, before deploy (doesn't affect source templates)

### Quality & Deploy

- [ ] **QUAL-01**: Viewport meta tag presence validated before deploy
- [ ] **QUAL-02**: First-party pixel marker detected and validated
- [ ] **QUAL-03**: Astro expression leak detection (no raw `import.meta.env` in build output)
- [ ] **QUAL-04**: Google Ads conversion tracking markers validated
- [ ] **QUAL-05**: Lighthouse score enforcement (fail deploy if any metric < 95)
- [ ] **QUAL-06**: Quality check runs after fingerprinting, blocks deploy on critical failures

### Template Preview

- [ ] **PREV-01**: Live preview renders template in iframe with injected variables
- [ ] **PREV-02**: Mobile/desktop viewport toggle in preview modal
- [ ] **PREV-03**: Real-time variable preview (change brand name → preview updates)
- [ ] **PREV-04**: Preview shows both pre-fingerprint and post-fingerprint versions

## v2 Requirements

### Extended Anti-Detection

- **DETECT-01**: Domain registrant variation strategy (different registrars, WHOIS privacy)
- **DETECT-02**: Redirect chain diversification per domain
- **DETECT-03**: Behavioral pattern variation (conversion funnel timing, pixel fire delays)

### Batch Operations

- **BATCH-01**: Deploy multiple templates/domains in one operation
- **BATCH-02**: Bulk quality check across all live domains

### Next.js Support

- **NEXT-01**: Next.js template format support via @cloudflare/next-on-pages adapter

### Template Marketplace

- **MARKET-01**: Browse and import templates from curated registry

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile app | Web dashboard sufficient for single operator |
| Multi-deployer (Vercel, S3) | Cloudflare-only simplifies pipeline |
| Real-time collaboration | Single operator tool |
| Template editor (visual) | Templates come from bolt/loveable, not built in-app |
| A/B testing framework | Out of scope for v1, focus on deployment pipeline |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| IMPORT-01 | Phase 1 | Complete ✓ |
| IMPORT-02 | Phase 1 | Complete ✓ |
| IMPORT-03 | Phase 1 | Complete ✓ |
| IMPORT-04 | Phase 2 | Pending |
| IMPORT-05 | Phase 2 | Pending |
| CAPAB-01 | Phase 1 | Complete ✓ |
| CAPAB-02 | Phase 1 | Complete ✓ |
| CAPAB-03 | Phase 1 | Complete ✓ |
| CAPAB-04 | Phase 1 | Complete ✓ |
| CAPAB-05 | Phase 1 | Complete ✓ |
| FINGER-01 | Phase 2 | Pending |
| FINGER-02 | Phase 2 | Pending |
| FINGER-03 | Phase 2 | Pending |
| FINGER-04 | Phase 2 | Pending |
| FINGER-05 | Phase 2 | Pending |
| FINGER-06 | Phase 2 | Pending |
| QUAL-01 | Phase 3 | Pending |
| QUAL-02 | Phase 3 | Pending |
| QUAL-03 | Phase 3 | Pending |
| QUAL-04 | Phase 3 | Pending |
| QUAL-05 | Phase 3 | Pending |
| QUAL-06 | Phase 3 | Pending |
| PREV-01 | Phase 4 | Pending |
| PREV-02 | Phase 4 | Pending |
| PREV-03 | Phase 4 | Pending |
| PREV-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

✓ **100% Coverage Achieved**

---

*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after roadmap creation*
