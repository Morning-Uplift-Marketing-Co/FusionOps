# FBIS Wiki — Context Vault

**F**raud and **B**an **I**ntelligence **S**ystem — knowledge base for Hermes agents.

## Purpose

This wiki stores accumulated intelligence for the five Hermes agents:

| Agent | Role |
|-------|------|
| **Argus** | Account health monitor — scans lifecycle stage + risk scores |
| **Nexus** | Cross-account correlation — flags shared proxies, cards, domains |
| **Iris** | Traffic quality — analyzes pixel events for bot/fraud signals |
| **Chrono** | Spend anomaly detection — flags budget overruns vs. lifecycle rules |
| **Verdict** | Risk aggregator — synthesizes signals into ban probability |

## Directory Structure

```
wiki/
├── accounts/          # Per-account notes (created by Verdict)
├── proxies/           # Known proxy IP assessments
├── ban-patterns/      # Documented ban patterns with playbooks
├── traffic-quality/   # Campaign traffic quality notes
├── risk-verdicts/     # Historical risk verdicts per account
└── overview.md        # This file
```

## Lifecycle Stages

| Stage | Meaning | Spend Limit |
|-------|---------|-------------|
| `active` | Normal operation | $500/day |
| `warming` | New account under observation | $100/day |
| `flagged` | Risk signals detected | $50/day |
| `suspended` | Manually suspended | $0 |
| `banned` | Platform ban confirmed | $0 |

## Risk Score Scale

- **0.0 – 0.3**: Clean — no action needed
- **0.3 – 0.6**: Monitor — increase scan frequency
- **0.6 – 0.7**: Caution — review manually
- **0.7 – 0.85**: High risk — alert + reduce spend
- **0.85 – 1.0**: Critical — suspend immediately

## API Endpoints (via fbis-mcp-server)

All tools proxy to `GET|POST /api/analysis/*` on the FusionOps API Worker.

See `apps/fbis-mcp-server/tools/` for the full tool list.
