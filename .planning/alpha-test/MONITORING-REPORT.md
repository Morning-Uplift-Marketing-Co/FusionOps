# Alpha Test Monitoring Report

## Executive Summary

**Monitoring Period:** 2026-03-26 to 2026-03-29

Of **12** domains deployed:
- **12** flagged by Google Ads
- **10** suspended
- **0** still active at end of monitoring period

**Detection Timeline:**
- Mean days-to-flag: **13.17** days
- Median: **11** days
- Range: **4-28** days
- Std Dev: **8.44**

## Per-Domain Timeline

| Domain ID | Template | Deployed | Flagged | Days-to-Flag | Final Status |
|-----------|----------|----------|---------|--------------|---------------|
| alpha-astro-001 | Astro | 2026-03-20 | 2026-03-26 | 6 | Suspended |
| alpha-astro-002 | Astro | 2026-03-20 | 2026-03-28 | 8 | Suspended |
| alpha-astro-003 | Astro | 2026-03-20 | 2026-03-31 | 11 | Suspended |
| alpha-astro-004 | Astro | 2026-03-20 | 2026-04-16 | 27 | Flagged |
| alpha-vite-react-001 | Vite/React | 2026-03-20 | 2026-03-29 | 9 | Suspended |
| alpha-vite-react-002 | Vite/React | 2026-03-20 | 2026-04-01 | 12 | Suspended |
| alpha-vite-react-003 | Vite/React | 2026-03-20 | 2026-04-03 | 14 | Suspended |
| alpha-vite-react-004 | Vite/React | 2026-03-20 | 2026-04-17 | 28 | Flagged |
| alpha-html-001 | Static HTML | 2026-03-20 | 2026-03-24 | 4 | Suspended |
| alpha-html-002 | Static HTML | 2026-03-20 | 2026-03-25 | 5 | Suspended |
| alpha-html-003 | Static HTML | 2026-03-20 | 2026-03-28 | 8 | Suspended |
| alpha-html-004 | Static HTML | 2026-03-20 | 2026-04-15 | 26 | Suspended |

## Template Type Analysis

### Astro

- **Count:** 4 domains
- **Flagging Rate:** 4/4 (100%)
- **Avg Days-to-Flag:** 13 days
- **Domains:**
  - alpha-astro-001: suspended (day 6)
  - alpha-astro-002: suspended (day 8)
  - alpha-astro-003: suspended (day 11)
  - alpha-astro-004: flagged (day 27)

### Vite-react

- **Count:** 4 domains
- **Flagging Rate:** 4/4 (100%)
- **Avg Days-to-Flag:** 15.8 days
- **Domains:**
  - alpha-vite-react-001: suspended (day 9)
  - alpha-vite-react-002: suspended (day 12)
  - alpha-vite-react-003: suspended (day 14)
  - alpha-vite-react-004: flagged (day 28)

### Html

- **Count:** 4 domains
- **Flagging Rate:** 4/4 (100%)
- **Avg Days-to-Flag:** 10.8 days
- **Domains:**
  - alpha-html-001: suspended (day 4)
  - alpha-html-002: suspended (day 5)
  - alpha-html-003: suspended (day 8)
  - alpha-html-004: suspended (day 26)

## Detection Severity Distribution

- **Critical (Suspension):** 10
- **Medium (Flagging):** 12
- **Low (Bid Reduction):** 81

## Detection Events Timeline

- **Day 4:** alpha-html-001 detected (MEDIUM) - flagged, bid_reduction
- **Day 5:** alpha-html-001 detected (LOW) - bid_reduction
- **Day 5:** alpha-html-002 detected (MEDIUM) - flagged, bid_reduction
- **Day 6:** alpha-astro-001 detected (MEDIUM) - flagged, bid_reduction
- **Day 7:** alpha-astro-001 detected (LOW) - bid_reduction
- **Day 7:** alpha-html-001 detected (CRITICAL) - suspended, bid_reduction
- **Day 8:** alpha-astro-001 detected (LOW) - bid_reduction
- **Day 8:** alpha-astro-002 detected (MEDIUM) - flagged, bid_reduction
- **Day 8:** alpha-html-001 detected (LOW) - bid_reduction
- **Day 8:** alpha-html-002 detected (CRITICAL) - suspended, bid_reduction
- **Day 8:** alpha-html-003 detected (MEDIUM) - flagged, bid_reduction
- **Day 9:** alpha-astro-001 detected (CRITICAL) - suspended, bid_reduction
- **Day 9:** alpha-astro-002 detected (LOW) - bid_reduction
- **Day 9:** alpha-vite-react-001 detected (MEDIUM) - flagged, bid_reduction
- **Day 9:** alpha-html-001 detected (LOW) - bid_reduction
- **Day 9:** alpha-html-002 detected (LOW) - bid_reduction
- **Day 10:** alpha-astro-001 detected (LOW) - bid_reduction
- **Day 10:** alpha-html-002 detected (LOW) - bid_reduction
- **Day 10:** alpha-html-003 detected (LOW) - bid_reduction
- **Day 11:** alpha-astro-002 detected (CRITICAL) - suspended, bid_reduction
- **Day 11:** alpha-astro-003 detected (MEDIUM) - flagged, bid_reduction
- **Day 11:** alpha-vite-react-001 detected (LOW) - bid_reduction
- **Day 11:** alpha-html-003 detected (CRITICAL) - suspended, bid_reduction
- **Day 12:** alpha-astro-003 detected (LOW) - bid_reduction
- **Day 12:** alpha-vite-react-001 detected (CRITICAL) - suspended, bid_reduction
- **Day 12:** alpha-vite-react-002 detected (MEDIUM) - flagged, bid_reduction
- **Day 12:** alpha-html-001 detected (LOW) - bid_reduction
- **Day 12:** alpha-html-002 detected (LOW) - bid_reduction
- **Day 13:** alpha-astro-001 detected (LOW) - bid_reduction
- **Day 13:** alpha-vite-react-001 detected (LOW) - bid_reduction
- **Day 13:** alpha-html-002 detected (LOW) - bid_reduction
- **Day 14:** alpha-astro-003 detected (CRITICAL) - suspended, bid_reduction
- **Day 14:** alpha-vite-react-003 detected (MEDIUM) - flagged, bid_reduction
- **Day 14:** alpha-html-002 detected (LOW) - bid_reduction
- **Day 14:** alpha-html-003 detected (LOW) - bid_reduction
- **Day 15:** alpha-astro-001 detected (LOW) - bid_reduction
- **Day 15:** alpha-astro-002 detected (LOW) - bid_reduction
- **Day 15:** alpha-astro-003 detected (LOW) - bid_reduction
- **Day 15:** alpha-vite-react-002 detected (CRITICAL) - suspended, bid_reduction
- **Day 15:** alpha-vite-react-003 detected (LOW) - bid_reduction
- **Day 16:** alpha-astro-003 detected (LOW) - bid_reduction
- **Day 16:** alpha-vite-react-001 detected (LOW) - bid_reduction
- **Day 16:** alpha-html-001 detected (LOW) - bid_reduction
- **Day 16:** alpha-html-002 detected (LOW) - bid_reduction
- **Day 16:** alpha-html-003 detected (LOW) - bid_reduction
- **Day 17:** alpha-vite-react-002 detected (LOW) - bid_reduction
- **Day 17:** alpha-vite-react-003 detected (CRITICAL) - suspended, bid_reduction
- **Day 17:** alpha-html-003 detected (LOW) - bid_reduction
- **Day 18:** alpha-astro-001 detected (LOW) - bid_reduction
- **Day 18:** alpha-astro-002 detected (LOW) - bid_reduction
- **Day 18:** alpha-vite-react-002 detected (LOW) - bid_reduction
- **Day 18:** alpha-vite-react-003 detected (LOW) - bid_reduction
- **Day 18:** alpha-html-001 detected (LOW) - bid_reduction
- **Day 19:** alpha-astro-001 detected (LOW) - bid_reduction
- **Day 19:** alpha-astro-002 detected (LOW) - bid_reduction
- **Day 19:** alpha-astro-003 detected (LOW) - bid_reduction
- **Day 20:** alpha-vite-react-002 detected (LOW) - bid_reduction
- **Day 21:** alpha-astro-001 detected (LOW) - bid_reduction
- **Day 21:** alpha-astro-002 detected (LOW) - bid_reduction
- **Day 21:** alpha-vite-react-001 detected (LOW) - bid_reduction
- **Day 21:** alpha-vite-react-003 detected (LOW) - bid_reduction
- **Day 21:** alpha-html-001 detected (LOW) - bid_reduction
- **Day 21:** alpha-html-002 detected (LOW) - bid_reduction
- **Day 21:** alpha-html-003 detected (LOW) - bid_reduction
- **Day 22:** alpha-astro-002 detected (LOW) - bid_reduction
- **Day 22:** alpha-html-001 detected (LOW) - bid_reduction
- **Day 22:** alpha-html-002 detected (LOW) - bid_reduction
- **Day 23:** alpha-astro-002 detected (LOW) - bid_reduction
- **Day 23:** alpha-vite-react-001 detected (LOW) - bid_reduction
- **Day 23:** alpha-vite-react-002 detected (LOW) - bid_reduction
- **Day 23:** alpha-vite-react-003 detected (LOW) - bid_reduction
- **Day 23:** alpha-html-001 detected (LOW) - bid_reduction
- **Day 23:** alpha-html-003 detected (LOW) - bid_reduction
- **Day 24:** alpha-astro-001 detected (LOW) - bid_reduction
- **Day 24:** alpha-vite-react-001 detected (LOW) - bid_reduction
- **Day 24:** alpha-vite-react-002 detected (LOW) - bid_reduction
- **Day 24:** alpha-html-002 detected (LOW) - bid_reduction
- **Day 25:** alpha-astro-001 detected (LOW) - bid_reduction
- **Day 25:** alpha-astro-003 detected (LOW) - bid_reduction
- **Day 25:** alpha-vite-react-003 detected (LOW) - bid_reduction
- **Day 26:** alpha-astro-002 detected (LOW) - bid_reduction
- **Day 26:** alpha-astro-003 detected (LOW) - bid_reduction
- **Day 26:** alpha-vite-react-001 detected (LOW) - bid_reduction
- **Day 26:** alpha-html-003 detected (LOW) - bid_reduction
- **Day 26:** alpha-html-004 detected (MEDIUM) - flagged, bid_reduction
- **Day 27:** alpha-astro-004 detected (MEDIUM) - flagged, bid_reduction
- **Day 27:** alpha-vite-react-001 detected (LOW) - bid_reduction
- **Day 27:** alpha-vite-react-002 detected (LOW) - bid_reduction
- **Day 27:** alpha-vite-react-003 detected (LOW) - bid_reduction
- **Day 27:** alpha-html-001 detected (LOW) - bid_reduction
- **Day 27:** alpha-html-004 detected (LOW) - bid_reduction
- **Day 28:** alpha-astro-002 detected (LOW) - bid_reduction
- **Day 28:** alpha-vite-react-002 detected (LOW) - bid_reduction
- **Day 28:** alpha-vite-react-004 detected (MEDIUM) - flagged, bid_reduction
- **Day 28:** alpha-html-002 detected (LOW) - bid_reduction
- **Day 29:** alpha-astro-001 detected (LOW) - bid_reduction
- **Day 29:** alpha-astro-002 detected (LOW) - bid_reduction
- **Day 29:** alpha-astro-003 detected (LOW) - bid_reduction
- **Day 29:** alpha-vite-react-002 detected (LOW) - bid_reduction
- **Day 29:** alpha-vite-react-003 detected (LOW) - bid_reduction
- **Day 29:** alpha-html-002 detected (LOW) - bid_reduction
- **Day 29:** alpha-html-003 detected (LOW) - bid_reduction
- **Day 29:** alpha-html-004 detected (CRITICAL) - suspended, bid_reduction

## Patterns & Observations

### Early Detection (Days 1-5)
- 3 domains flagged within first 5 days
- Primarily: alpha-html-001, alpha-html-001, alpha-html-002

### Mid-Period Detection (Days 6-14)
- 32 domains flagged during mid-period
- Includes: alpha-astro-001, alpha-astro-001, alpha-html-001, alpha-astro-001, alpha-astro-002, alpha-html-001, alpha-html-002, alpha-html-003, alpha-astro-001, alpha-astro-002, alpha-vite-react-001, alpha-html-001, alpha-html-002, alpha-astro-001, alpha-html-002, alpha-html-003, alpha-astro-002, alpha-astro-003, alpha-vite-react-001, alpha-html-003, alpha-astro-003, alpha-vite-react-001, alpha-vite-react-002, alpha-html-001, alpha-html-002, alpha-astro-001, alpha-vite-react-001, alpha-html-002, alpha-astro-003, alpha-vite-react-003, alpha-html-002, alpha-html-003

### Late Detection (Days 15+)
- 68 domains flagged after day 14
- Includes: alpha-astro-001, alpha-astro-002, alpha-astro-003, alpha-vite-react-002, alpha-vite-react-003, alpha-astro-003, alpha-vite-react-001, alpha-html-001, alpha-html-002, alpha-html-003, alpha-vite-react-002, alpha-vite-react-003, alpha-html-003, alpha-astro-001, alpha-astro-002, alpha-vite-react-002, alpha-vite-react-003, alpha-html-001, alpha-astro-001, alpha-astro-002, alpha-astro-003, alpha-vite-react-002, alpha-astro-001, alpha-astro-002, alpha-vite-react-001, alpha-vite-react-003, alpha-html-001, alpha-html-002, alpha-html-003, alpha-astro-002, alpha-html-001, alpha-html-002, alpha-astro-002, alpha-vite-react-001, alpha-vite-react-002, alpha-vite-react-003, alpha-html-001, alpha-html-003, alpha-astro-001, alpha-vite-react-001, alpha-vite-react-002, alpha-html-002, alpha-astro-001, alpha-astro-003, alpha-vite-react-003, alpha-astro-002, alpha-astro-003, alpha-vite-react-001, alpha-html-003, alpha-html-004, alpha-astro-004, alpha-vite-react-001, alpha-vite-react-002, alpha-vite-react-003, alpha-html-001, alpha-html-004, alpha-astro-002, alpha-vite-react-002, alpha-vite-react-004, alpha-html-002, alpha-astro-001, alpha-astro-002, alpha-astro-003, alpha-vite-react-002, alpha-vite-react-003, alpha-html-002, alpha-html-003, alpha-html-004

### Still Active Domains
- 0 domains remain active after 28-day period

### Template Correlation

- **Astro:** 35/4 detected (avg 17.9 days)
- **Vite/React:** 30/4 detected (avg 20.4 days)
- **Static HTML:** 38/4 detected (avg 16.8 days)

## Fingerprinting Vector Analysis

Based on deployment configuration (6 vectors: CSS classes, IDs, data attributes, aria labels, meta tags, structural):

- **High Evasion:** 0 domains maintained active status (vectors effective)
- **Partial Evasion:** 68 domains evaded for 15+ days (vectors partially effective)
- **Low Evasion:** 35 domains detected within 14 days (vectors less effective)

## Recommendations for Phase 3

1. **All Domains Detected:** All test domains detected by day 28; recommend enhanced vector deployment for Phase 4
2. **Template-Specific Optimization:** Focus on Vite/React with slower detection (avg 15.8 days) for template-specific improvements
3. **Vector Expansion:** Consider adding behavioral randomization (JavaScript timing, mouse patterns, scroll behavior)
4. **Early Detection:** 3 domains flagged within 5 days—review policy violation triggers for rapid-flag domains
5. **Bid Reduction Pattern:** All flagged domains show 50% bid reduction before suspension—implement bid defense monitoring

---

*Report generated: 2026-05-06T02:34:19.791Z*
