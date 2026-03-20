# Conventions

## Language & Runtime

- **Primary language:** JavaScript (ES Modules) with selective TypeScript
- **Module system:** ESM (`"type": "module"` in package.json)
- **React version:** 19.x (functional components, hooks only)
- **Node runtime:** Used for scripts; Cloudflare Workers for backend

## Code Style

### Component Patterns
- Functional components with hooks (`useState`, `useEffect`)
- Named exports preferred: `export function Dashboard() {}`
- Props destructured in function signature
- JSX files use `.jsx` extension, TypeScript uses `.tsx`

### State Management
- Local state via `useState` in `App.jsx` (lifted state pattern)
- No external state library (no Redux, Zustand, etc.)
- Settings persisted to `localStorage` via `LS` utility wrapper
- Global state passed as props through component tree

### Import Organization
```javascript
// 1. React imports
import { useState, useEffect } from "react";
// 2. Service imports
import { api } from "./services/api";
import * as db from "./services/neon";
// 3. Constants
import { THEME as T, WIZARD_DEFAULTS } from "./constants";
// 4. Utilities
import { uid, now, LS } from "./utils";
// 5. Component imports
import { Sidebar } from "./components/Sidebar";
```

## Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `Dashboard.jsx`, `SpendDashboard.jsx` |
| Services | camelCase/kebab-case | `api.js`, `cloudflare-dns.js` |
| Utilities | kebab-case | `template-router.js`, `risk-engine.js` |
| Constants | UPPER_SNAKE_CASE | `LOAN_TYPES`, `APP_VERSION`, `WIZARD_DEFAULTS` |
| CSS classes | Tailwind utility classes | `className="flex items-center gap-2"` |
| Env vars | VITE_ prefix (client) | `VITE_API_BASE`, `VITE_NEON_URL` |
| Worker bindings | UPPER_SNAKE_CASE | `DB`, `NEON_URL`, `VOLUUM_ACCESS_ID` |

## Error Handling

- Global error capture via `window.addEventListener("error")` and `unhandledrejection` in `App.jsx`
- Errors logged to `ErrorLog` component via `logError()` function
- API client (`services/api.js`) wraps all requests with try/catch, returns `{ ok, data, error }` envelope
- Silent fallbacks common in non-critical paths (e.g., template loading)
- Sentry integration available (`@sentry/react`) but usage is selective

## API Response Pattern

```javascript
// services/api.js request() returns:
{ ok: true, data: responseJson }
// or
{ ok: false, error: "Error message", status: 404 }
```

## Security Patterns

- **CSRF:** Client-generated token stored in `sessionStorage`, sent with mutation requests
- **Account Lock:** `services/account-lock.js` prevents accidental Cloudflare account switching
- **Auth:** JWT tokens stored in localStorage, sent as `Authorization: Bearer` header
- **CSP headers:** Configured in `astro.config.mjs` for dev server
- **Input sanitization:** `sanitizeSettings()` on app initialization

## UI Framework

- **Tailwind CSS v4** via Vite plugin (`@tailwindcss/vite`)
- **Radix UI** primitives for accessible components (`@radix-ui/react-tabs`, `@radix-ui/react-slot`)
- **Lucide React** for icons
- **Recharts** for data visualization (SpendDashboard)
- **class-variance-authority (CVA)** for component variants
- **tailwind-merge + clsx** via `cn()` utility in `lib/utils.ts`

## Configuration

- Environment variables loaded from `.env`, `.env.local`, `.env.lock`
- `.env.lock` contains forced overrides (loaded in `astro.config.mjs`)
- Vite path aliases: `@` → `src/templates/astrodeck-main/src`, `#lp-template-generator` → `packages/lp-template-generator/src`
- Dev server runs on port 4323 with API proxy to Workers
