# Requirements: LP Factory v1.3 Template Reliability

**Defined:** 2026-03-22
**Core Value:** Import any template, inject variables, deploy to Cloudflare with unique fingerprint -- every time, without manual fixing.

## v1.3 Requirements

### Color

- [ ] **CLR-01**: Template displays default colors (ocean palette) immediately in local dev and preview without CI injection
- [ ] **CLR-02**: TEMPLATE-PROMPT.md instructs AI to include default HSL values instead of "LEAVE EMPTY"

### Tracking

- [ ] **TRK-01**: Voluum dtpCallback injects and fires correctly (reads VOLUUMDOMAIN from env)
- [ ] **TRK-02**: GCLID/clickid captured to sessionStorage and passed through to apply page
- [ ] **TRK-03**: First-party pixel (fpPixel) injects and fires pageview + events on deployed site

### Apply Page

- [ ] **APPLY-01**: apply.astro scaffolded by pipeline with LeadsGate form and clickid passthrough

### Local Testing

- [ ] **TEST-01**: Local inject script (`npm run inject`) replicates CI pipeline locally -- injects colors, tracking, pixel, and apply page
- [ ] **TEST-02**: Template validator checks and reports color/tracking/pixel/apply/clickid readiness before deploy

## Future Requirements

### Performance

- **PERF-01**: Build pipeline stress test at 50+ concurrent
- **PERF-02**: Build queue if memory >90%

## Out of Scope

| Feature | Reason |
|---------|--------|
| Anti-fingerprinting changes | v1.2 complete, working in production |
| New color palettes | 8 palettes sufficient, add later if needed |
| Vite/React template support fixes | Astro-only focus for now |
| Template marketplace | Deferred to v2 |
| Build-variant approach (theme.json) | Deferred -- injection approach works, refactor later |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLR-01 | TBD | Pending |
| CLR-02 | TBD | Pending |
| TRK-01 | TBD | Pending |
| TRK-02 | TBD | Pending |
| TRK-03 | TBD | Pending |
| APPLY-01 | TBD | Pending |
| TEST-01 | TBD | Pending |
| TEST-02 | TBD | Pending |

**Coverage:**
- v1.3 requirements: 8 total
- Mapped to phases: 0
- Unmapped: 8

---
*Requirements defined: 2026-03-22*
