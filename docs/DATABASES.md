# Databases & accounts (FusionOps)

Quick reference for **what stores data**, **how the dashboard connects**, and **what “บัญชี / accounts” mean in `.env`**.

## Big picture

```text
Browser (Astro/React)
    │
    ├─► VITE_API_BASE  →  Cloudflare Worker (lp-factory-api)  →  D1: main + pixel (bindings)
    │
    └─► VITE_NEON_URL  →  Neon Postgres (optional, @neondatabase/serverless from the client)
```

You **do not** get a traditional “SQL connection string” for **D1** in the repo — Workers use **Wrangler bindings** (`DB`, `PIXEL_DB`). Only **Neon** uses a URL in local `.env`.

---

## 1. Neon PostgreSQL (optional)

| Item | Detail |
|------|--------|
| **Env var** | `VITE_NEON_URL` (root `.env`) |
| **Purpose** | Dashboard features that read/write via `@neondatabase/serverless` (e.g. settings / lock flows — see `src/App.jsx`, `src/services/account-lock.js`, `Settings.jsx`). |
| **Public exposure** | Name is **`VITE_*`** → value is **bundled into the client**. Use a Neon role/URL your team accepts as non-secret for an **internal** tool, or leave unset and rely on Worker-only data paths. |
| **Parity with production** | To match live dashboard data, use the **same** `VITE_NEON_URL` + `VITE_API_BASE` as production build (see hints in Settings UI). |

Get the URL from **Neon Dashboard** → project → **Connection details** (pooler recommended).

---

## 2. Cloudflare D1 (SQLite at the edge)

Used **only inside Workers**, bound by name in `wrangler.toml`. No raw D1 URL in `.env` for local apps.

| Database name | Typical Worker | Binding (API Worker) | Role |
|---------------|----------------|-------------------------|------|
| `fusionops-main-new-v2` | `apps/api-worker` | `DB` | Main app: sites, templates, settings, campaigns, etc. |
| `fusionops-pixel-new-v2` | `apps/api-worker` + `apps/pixel-worker` | `PIXEL_DB` (API), `DB` (pixel) | Pixel / event storage |
| `fusionops-callback-new-v2` | `apps/worker` (callback) | `DB` | Lead / callback webhooks |

**Developer workflow**

- **UI only:** set `VITE_API_BASE` to the team Worker URL (ends with `/api`). You use **remote** D1 through the API — no local DB setup.
- **Hack API Worker locally:** `cd apps/api-worker`, `npm run install:api-worker`, `wrangler login`, `wrangler dev`. Wrangler uses the **`database_id`** / preview IDs in `wrangler.toml` — your Cloudflare user must have access to that account.

**CLI (advanced):** `wrangler d1 execute …` against the same `database_name` if you have Wrangler auth (see Cloudflare docs).

---

## 3. Cloudflare & integration “accounts” (not D1)

These are **API keys / IDs** for dashboards and deploys — not SQL databases.

| Env (examples) | Purpose |
|----------------|---------|
| `VITE_CF_ACCOUNT_ID`, `VITE_CF_API_TOKEN` | Cloudflare account API from browser flows (deploy/DNS-style features). Still **`VITE_*`** → treat as **public** in the bundle. |
| `VITE_VOLUUM_*` | Voluum API |
| `VITE_LENDINGCARD_TOKEN` | LeadingCards |

**CI/CD:** GitHub Actions often uses repo secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (see `.github/workflows/deploy-lp.yml`) — separate from your local `.env`.

---

## 4. R2 (files, not relational)

API Worker may use **R2** for template thumbnails (`THUMBS` binding in `apps/api-worker/wrangler.toml`). Same idea: **binding in Worker**, not a URL in `.env` for the Astro app.

---

## 5. Checklist for a new machine

1. **Minimal UI against prod-like API:** `.env` with `VITE_API_BASE` (and optional `VITE_NEON_URL` if you need Neon parity).
2. **Local Worker + D1:** Wrangler authenticated to the **team Cloudflare account**; run `wrangler dev` under `apps/api-worker`.
3. **Never commit** `.env`, connection strings, or Wrangler tokens.

For install steps, see [GETTING-STARTED.md](./GETTING-STARTED.md) and [README.md](../README.md).
