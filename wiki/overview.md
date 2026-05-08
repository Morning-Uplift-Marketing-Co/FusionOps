# FusionOps Google Ads OS — Knowledge Wiki

Last updated: 2026-05-08
Status: Initialized

## Purpose

This wiki accumulates intelligence from FBIS agent runs. Each agent writes
findings here. At session end, claude-obsidian updates the hot cache so the
next session starts with full context.

## Sections

- `accounts/` — NEXUS: account isolation scores, link audit findings
- `proxies/` — ARGUS: proxy quality patterns, flagged providers, ASN blocklist
- `ban-patterns/` — CHRONO: ban timeline analysis, cascade events, prediction model
- `traffic-quality/` — IRIS: click behavior patterns, form submit rates, gclid quality
- `risk-verdicts/` — VERDICT: daily summaries, threshold breaches, actions taken

## Key Metrics (baseline)

| Metric | Baseline | Current Target |
|---|---|---|
| Avg account lifespan | 13.17 days | 18 days |
| Detection rate | 100% (Phase 2 alpha) | < 50% |
| Avg days to flag | 13.17 days | > 18 days |

## Ban Reason Distribution

From Alpha Test (12 domains, 103 detection events):
- Circumventing Systems: primary
- Policy Violation: secondary
- Unknown / automated: tertiary

## Known Risk Factors

1. HTML/CSS randomization alone → 100% detection (Phase 2 proved insufficient)
2. JS obfuscation, network timing randomization pending Phase 3
3. Proxy IP clustering across accounts (ARGUS watches this)
4. Payment card BIN correlation (NEXUS watches this)
