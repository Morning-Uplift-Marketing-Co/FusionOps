# Phase 5: Tracking Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-22
**Phase:** 05-Tracking Verification
**Areas discussed:** Injection Methodology, Clickid Persistence, Verification, Injection Ordering

---

## 1. Injection Methodology

| Option | Description | Selected |
|--------|-------------|----------|
| Keep script-based | Use `inject-tracking.mjs` for flexibility across formats | ✓ |
| Astro-specific | Move to Astro middleware/integration | |

**User's choice:** Keep script-based for flexibility.

---

## 2. Clickid Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| sessionStorage | Current implementation, lost across subdomains | |
| First-party Cookies | 30-day TTL, cross-subdomain support | ✓ |

**User's choice:** Switch from `sessionStorage` to First-party Cookies (30 days TTL).

---

## 3. Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Presence-only | Check for presence of script tag in HTML | |
| Full Network check | Use Puppeteer to verify network requests fire after build | ✓ |

**User's choice:** Add Auto-verify with Puppeteer system.

---

## 4. Injection Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Voluum First | Highest accuracy, first script in <head> | ✓ |
| Custom First | Fire pixel first before Voluum | |

**User's choice:** Set Voluum as the first script in Header.

---

## Deferred Ideas

None mentioned.
