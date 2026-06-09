# Tracking Snippet References

## 2026-06-09

- Removed auto-generated banner comments from the injected tracking blocks in `scripts/inject-tracking.mjs`.
- Added deterministic per-domain whitespace variation seeded from the site domain using FNV-1a so the injected block spacing is stable per brand.
- Left the tracking script order and runtime behavior unchanged.
