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
