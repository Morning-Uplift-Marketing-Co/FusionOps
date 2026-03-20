# Copilot Workspace Instructions

## 1. Purpose
- This file defines local AI assistant conventions for the `ppc-claude-web-V1` workspace.
- Keep it lightweight and actionable for cross-team usage with GitHub Copilot and Claude-style agents.

## 2. Core repository commands
- `npm install` (or `npm ci` in CI)
- `npm run dev` (Astro dev server)
- `npm run build` (Astro production build)
- `npm run preview` (local production preview)
- `npm run check` (Astro type/diagnostics checks)
- `npm run lint` (ESLint)
- `npm test` (Vitest unit tests)
- `npm run test:coverage` (Vitest coverage)
- `npm run test:e2e` (Playwright integration tests)
- `npm run test:e2e:headed` (headed E2E)
- `npm run test:e2e:debug` (debug E2E)

## 3. Architecture & area boundaries
- Astro project with React components in `components/`, `apps/`, and `src/`.
- Template management and deployment scripts in `scripts/`, `deploy-configs/`, and top-level `*.mjs` utilities.
- API paths and cloud edge workers in `apps/api-worker/`, `apps/worker/`, `apps/cf-proxy/`, etc.
- DB integration via Neon and D1: see `neon-db-ids`, `d1-db-ids`, plus `@neondatabase/serverless` dependency.

## 4. Style and conventions
- Source is ES module (`type: module` in package.json).
- Strict TypeScript is enabled via `tsconfig.json` (treat as enforced in TypeScript locations).
- UI code uses Tailwind + Astro + React + recharts + radix.
- No barrel exports; import directly from source path.
- Prefer component composition, minimal abstraction until stable (team pattern from existing template code).
- Comments for intent/why only; avoid describing obvious behavior.

## 5. Tests
- Unit: `tests/` and component-specific `*.test.ts` (inside `apps/` where relevant).
- E2E: `tests/e2e`, `playwright.config.ts`, `npm run test:e2e`.
- New features should include regression tests and, when appropriate, one or more E2E flows.

## 6. CI / release flow
- `npm run lint` and `npm run test` are required before PR.
- `npm run build` should pass for deploy branches.
- `npm run release` (standard-version) for changelog/version bumps where requested.

## 7. Common pitfalls
- Keep `.env` values in `.env.local` not committed; this repository has existing env templates in root.
- Do not run long `dev`/`build` in automated text-mode debug unless requested.
- Some scripts mutate deploy state (e.g., `create-and-deploy.mjs`, `real-deploy.mjs`); confirm with reviewer before running.

## 8. Agent usage guidelines
- For code changes, run tests first and describe the failure clearly before implementing.
- For feature requests, include target behavior + API or UX example + relevant path (e.g., `components/VariantStudio.jsx`).
- For maintenance tasks, prefer atomic PRs with 1 change area (lint, bugfix, refactor, tests).

## 9. Prompt samples
- "Update the homepage dashboard graphs to show last 30 days in `components/Dashboard.jsx`; include Vitest and Playwright tests."  
- "Refactor `services` API wrapper to use centralized error handling and add `tests/services/*.test.ts`."
- "Add feature flag support for `templates` endpoints in `apps/api-worker`."

## 10. Next agent customization ideas
- Agent: `create-hook` for `prettier` on save in this repo with `.vscode/settings.json` policy.
- Agent: `create-instruction` for deploy script safety checks and `confirm-deploy-branches` lock.
- Agent: `create-skill` for E2E pattern template generation from existing `playwright.config.ts` and `tests/e2e` usage.
