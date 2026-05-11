# Getting started (first-time)

Use this alongside the root **README.md** for troubleshooting.

## Databases & `.env` “accounts”

FusionOps mixes **Neon** (optional URL in `.env`), **Cloudflare D1** (via Worker only), and **integration keys** (Voluum, CF API, etc.). Read **[docs/DATABASES.md](DATABASES.md)** before pasting connection strings.

## Checklist

1. **Node ≥ 22** — `node -v` should show v22.x (see `.nvmrc`).
2. **Install** — `npm run bootstrap` (runs `npm install` + setup check).
3. **Env** — `cp .env.example .env` (or `Copy-Item` on Windows) and set at least `VITE_API_BASE` if you are not using defaults from `astro.config.mjs`.
4. **Run** — `npm run dev` → [http://localhost:4321](http://localhost:4321).

Optional: `npm run install:api-worker` before running Wrangler for `apps/api-worker` locally.

## Verify installation

```bash
npm run setup:check
```

Exits with an error only if Node is too old. Other lines are hints (missing `.env`, missing Worker `node_modules`).

## Troubleshooting

### Port 4321 already in use

Astro uses `strictPort: true`. Stop the other process or temporarily change the port in `astro.config.mjs` (remember Playwright E2E expects **4321**).

### `/api` calls fail or 401

The dev server proxies `/api` to the host derived from `VITE_API_BASE` (must end with `/api`).

### Wrong Node version

Use `nvm install 22 && nvm use` / `fnm use` / install from [nodejs.org](https://nodejs.org) LTS if 22+ is available.

### Local API Worker

```bash
cd apps/api-worker
npm run dev
```

Point `VITE_API_BASE` at the Wrangler URL (including `/api`) while testing.
