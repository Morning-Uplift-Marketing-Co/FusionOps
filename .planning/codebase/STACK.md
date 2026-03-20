# Technology Stack

**Analysis Date:** 2026-03-20

## Languages

**Primary:**
- JavaScript/JSX - React components, frontend application logic
- TypeScript - Configuration files, type definitions (optional)

**Secondary:**
- TOML - Wrangler configuration

## Runtime

**Environment:**
- Node.js (implied from package.json, npm scripts)

**Package Manager:**
- npm - primary package manager
- Lockfile: Not specified in package.json (presumed package-lock.json or similar)

## Frameworks

**Core:**
- Astro 5.18.0 - Full-stack web framework, integrates React and Tailwind
- React 19.2.0 - UI library for interactive components
- React DOM 19.2.0 - React rendering into DOM

**Build/Dev:**
- @tailwindcss/vite 4.2.0 - Tailwind CSS v4 Vite integration
- Tailwind CSS 4.2.0 - Utility-first CSS framework
- Vite (implicit, via Astro) - Modern build tool and dev server

**Testing:**
- Vitest 4.0.18 - Fast unit test runner (Vite-native)
- @playwright/test 1.58.2 - E2E testing framework
- @testing-library/react 16.3.2 - React testing utilities
- @testing-library/jest-dom 6.9.1 - DOM assertions
- @testing-library/user-event 14.6.1 - User interaction simulation
- happy-dom 20.6.2 - Lightweight DOM implementation for tests
- jsdom 28.1.0 - Alternative DOM environment

**Linting/Format:**
- ESLint 9.39.1 - Code linting
- @eslint/js 9.39.1 - ESLint core rules
- eslint-plugin-react-hooks 7.0.1 - React hooks linting
- eslint-plugin-react-refresh 0.4.24 - Vite React refresh plugin linting
- globals 16.5.0 - Global variable definitions

## Key Dependencies

**Critical:**
- @neondatabase/serverless 1.0.2 - HTTP driver for Neon Postgres (used in `src/services/neon.js`)
- @sentry/react 10.40.0 - Error tracking and monitoring
- wrangler 4.67.0 - Cloudflare Workers CLI (deployment)

**UI/Rendering:**
- @astrojs/react 4.4.2 - React integration for Astro
- @radix-ui/react-slot 1.2.4 - Radix UI composition primitive
- @radix-ui/react-tabs 1.1.13 - Accessible tab component
- lucide-react 0.575.0 - Icon library
- recharts 3.7.0 - Chart and graph library
- class-variance-authority 0.7.1 - Variant management utility
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.5.0 - Merge Tailwind classes

**Utilities:**
- jszip 3.10.1 - ZIP file creation/reading (template packing)
- node-fetch 3.3.2 - Fetch API for Node.js environments
- dotenv 17.3.1 - Environment variable loading
- install 0.13.0 - Package installation utility

**Release Management:**
- standard-version 9.5.0 - Semantic versioning and changelog generation

## Configuration

**Environment:**
- Environment variables loaded via `dotenv` from `.env`, `.env.local`, `.env.lock`
- Astro uses standard `import.meta.env` for Vite env variables
- Both `VITE_*` (client-side) and `PUBLIC_*` (Astro public) prefixes supported
- Wrangler config file: `.wrangler/` directory

**Build:**
- Configuration files:
  - `astro.config.mjs` - Astro configuration, Vite setup, resolve aliases
  - `tsconfig.json` - TypeScript configuration (strict mode, React JSX)
  - `vitest.config.ts` - Vitest setup with happy-dom environment
  - `playwright.config.ts` - E2E test configuration (Chrome, Firefox, WebKit, mobile)
  - `eslint.config.js` - ESLint rules for JS/JSX

**Development Server:**
- Port: 4323 (configured in `astro.config.mjs`)
- Hot module reload: Enabled (Astro default)
- CORS headers and CSP configured in dev server

## Platform Requirements

**Development:**
- Node.js (version unspecified, typically 18+)
- npm or compatible package manager
- Optional: Chrome Dev for E2E testing (configurable via `CHROME_DEV_PATH`)

**Production:**
- Cloudflare Workers (primary deployment target)
- Neon PostgreSQL database (remote serverless Postgres)
- API base: `https://lp-factory-api.misty-feather-556e.workers.dev` (Cloudflare Worker URL)

---

*Stack analysis: 2026-03-20*
