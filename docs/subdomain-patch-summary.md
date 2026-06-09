# Pixel Subdomain Patch Summary

Changed files:

- `.github/workflows/deploy-lp.yml`
  - Added `pixelSubdomain` parsing with a backward-compatible default of `t`.
  - Wrote `PUBLIC_PIXELSUBDOMAIN` and `VITE_PIXEL_SUBDOMAIN` into the generated `.env`.
  - Updated pixel DNS provisioning, Workers route provisioning, and pixel verification to use the configured subdomain instead of hardcoded `t`.

- `scripts/inject-tracking.mjs`
  - Added support for reading the pixel subdomain from env/config.
  - Injected `window.__PIXEL_SUBDOMAIN__` for Astro, Vite, and static HTML builds.
  - Updated the first-party pixel beacon URL to build `https://<pixelSubdomain>.<domain>/e` instead of `https://t.<domain>/e`.

- `apps/api-worker/src/handlers/pixel-tracking.js`
  - Updated the host-to-domain normalization so the worker no longer assumes the leftmost label is literally `t`.
  - Left `/e` and `/v` path matching unchanged.

Risk note:

- Existing pixel handler route matching is still path-based (`/e` and `/v`), so the functional routing contract did not change.
- The only routing-sensitive change is host provisioning: custom pixel subdomains must remain a single DNS label so the worker can strip the first label and recover the apex domain correctly.
- Backward compatibility is preserved because configs without `pixelSubdomain` still default to `t`.

## Auto-assigned pixel subdomains

- When a deploy config sets `pixelSubdomain`, the workflow still uses that explicit value after the same normalization rules as before.
- When `pixelSubdomain` is missing or blank, the deploy workflow now derives a stable subdomain from the bare domain name instead of defaulting to `t`.
- The auto pool is `['go', 'px', 'track', 'm', 'r', 's', 'c']`, which intentionally excludes `t` so auto-assigned brands are visibly varied.
- The derived value is deterministic: the workflow hashes the bare domain and uses the hash index to pick one entry from the pool, so the same domain always resolves to the same auto subdomain across redeploys.
- This means existing live brands currently on `t.` will migrate on their next deploy to their deterministic auto-assigned subdomain, and the workflow's DNS upsert, Workers route upsert, and endpoint verification steps will move them over in the same deploy.
