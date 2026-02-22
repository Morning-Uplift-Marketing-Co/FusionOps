# LP Factory V2 - Codebase Documentation Index

**Last Updated:** 2026-02-16
**Project Version:** v2.1.0
**Framework:** Astro + React (Islands Architecture)

## Architecture Overview

LP Factory V2 is a landing page generator for PPC/affiliate loan offers. It combines an Astro frontend with a Cloudflare Workers backend, supporting multiple deployment targets.

```
                    ┌─────────────────────────────────────────┐
                    │           LP Factory V2                  │
                    └─────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌────────────────┐        ┌────────────────┐        ┌────────────────┐
│   Frontend     │        │    Backend     │        │  Deployers     │
│   (Astro)      │        │  (CF Worker)   │        │  (Multi-target)│
├────────────────┤        ├────────────────┤        ├────────────────┤
│ React Islands  │◄──────►│   D1 Database  │        │  CF Pages      │
│ - App.jsx      │        │   API Routes   │        │  Netlify       │
│ - Components/  │        │   Proxy API    │        │  Vercel        │
│ - Pages/       │        └────────────────┘        │  CF Workers    │
└────────────────┘                                 │  S3+CloudFront │
                                                   │  VPS (SSH)     │
                                                   └────────────────┘
         │                                                   │
         │                                                   │
         ▼                                                   ▼
┌────────────────┐                                ┌────────────────┐
│   Services     │                                │   External     │
│ - API Client   │                                │   Integrations │
│ - Neon DB      │                                ├────────────────┤
│ - Multilogin X │                                │ LeadingCards   │
│ - Cloudflare   │                                │ Multilogin X   │
│ - Registrar    │                                │ Cloudflare     │
└────────────────┘                                │ Namecheap      │
                                                  │ Neon Postgres  │
                                                  └────────────────┘
```

## Codebase Structure

```
ppc-claude-web/
├── apps/
│   └── api-worker/          # Cloudflare Workers backend
│       └── src/
│           └── worker.js    # Main worker with D1 binding
│
├── docs/                    # Documentation
│   ├── CODEMAPS/           # This directory
│   │   ├── INDEX.md        # Architecture overview (this file)
│   │   ├── frontend.md     # React components & pages
│   │   ├── backend.md      # Worker API & D1 database
│   │   ├── data.md         # Data models & schemas
│   │   └── integrations.md # External service APIs
│   └── examples/           # Usage examples
│
├── src/
│   ├── App.jsx             # Main React application
│   ├── AppRoot.jsx         # React StrictMode wrapper
│   ├── components/         # React island components
│   │   ├── Dashboard.jsx   # Landing page with metrics
│   │   ├── Sites.jsx       # Site management & deployment
│   │   ├── Wizard.jsx      # LP creation wizard (6 steps)
│   │   ├── VariantStudio.jsx # AI variant generation
│   │   ├── OpsCenter.jsx   # Operations management
│   │   ├── Settings.jsx    # API key configuration
│   │   ├── DeployHistory.jsx # Deployment log viewer
│   │   ├── Atoms.jsx       # Reusable UI components
│   │   └── OpsCenter/      # Ops sub-components
│   │       └── deploy/     # Deployment UI
│   │
│   ├── pages/              # Astro pages
│   │   ├── index.astro     # Main entry point
│   │   └── docs/           # Documentation pages
│   │
│   ├── layouts/            # Astro layouts
│   │   └── Layout.astro    # Base layout wrapper
│   │
│   ├── services/           # API clients
│   │   ├── api.js          # Legacy API wrapper
│   │   ├── neon.js         # Neon Postgres client
│   │   ├── leadingCards.js # LeadingCards API
│   │   ├── multilogin.js   # Multilogin X API
│   │   ├── registrar.js    # Domain registrar API
│   │   ├── cloudflare-dns.js # Cloudflare DNS API
│   │   └── cloudflare-zone.js # Cloudflare Zones API
│   │
│   ├── utils/              # Utility functions
│   │   ├── deployers/      # Deployment modules
│   │   │   ├── index.js    # Deploy orchestrator
│   │   │   ├── cf-pages.js # Cloudflare Pages deployer
│   │   │   ├── netlify.js  # Netlify deployer
│   │   │   ├── cf-workers.js # CF Workers Sites deployer
│   │   │   ├── s3-cloudfront.js # AWS S3 deployer
│   │   │   └── vps-ssh.js  # SSH/VPS deployer
│   │   ├── lp-generator.js # Static HTML generator
│   │   ├── astro-generator.js # Astro project generator
│   │   ├── api-proxy.js    # API proxy utilities
│   │   ├── risk-engine.js  # Correlation risk detection
│   │   └── gtm-exporter.js # GTM container export
│   │
│   └── constants/
│       └── index.js        # App constants & configuration
│
├── .reports/               # Generated reports
│   └── codemap-diff.txt    # Codebase change tracking
│
└── package.json            # Dependencies
```

## Key Technologies

| Area | Technology | Version |
|------|-----------|---------|
| Framework | Astro | 5.x |
| UI Library | React | 19.x |
| Runtime | Cloudflare Workers | Latest |
| Database (Primary) | Neon Postgres | @neondatabase/serverless |
| Database (Legacy) | Cloudflare D1 | SQLite-compatible |
| Deployment | Multi-target | CF Pages, Netlify, Vercel, AWS, VPS |

## Quick Navigation

- **Frontend Components** - See [frontend.md](frontend.md)
- **Backend API** - See [backend.md](backend.md)
- **Data Models** - See [data.md](data.md)
- **External Integrations** - See [integrations.md](integrations.md)

## Recent Changes (v2.1.0)

- PageSpeed optimizations and meta tag improvements
- Changelog UI added
- Multilogin X API integration
- Ops Center deployment dashboard
- DNS record management
