export function validateAstroStandard(files = {}) {
  const keys = Object.keys(files || {});

  const has = (candidates) => candidates.some((p) => keys.includes(p) || keys.some((k) => k.endsWith(`/${p}`)));
  const required = {
    index: has(["src/pages/index.astro", "index.astro", "index.html"]),
    apply: has(["src/pages/apply.astro", "apply.astro", "apply.html"]),
    layout: has(["src/layouts/Layout.astro", "layouts/Layout.astro"]),
  };

  const trackingFiles = [
    "src/config/brands.ts",
    "src/config/brands.js",
    "src/lib/tracking.ts",
    "src/lib/tracking.js",
    "src/utils/track.ts",
    "src/utils/track.js",
  ];
  const hasTrackingFile = has(trackingFiles);
  const layoutKey = keys.find((k) => k.endsWith("Layout.astro"));
  const layoutContent = layoutKey ? String(files[layoutKey] || "") : "";
  const hasTrackingInLayout =
    layoutContent.includes("__trackingConfig") ||
    layoutContent.includes("gtag") ||
    layoutContent.includes("pixelUrl");
  const tracking = hasTrackingFile || hasTrackingInLayout;

  const errors = [];
  if (!required.index) errors.push("Missing index page (need src/pages/index.astro or index.html)");
  if (!required.apply) errors.push("Missing apply page (need src/pages/apply.astro or apply.html)");
  if (!required.layout) errors.push("Missing Layout.astro (need src/layouts/Layout.astro)");
  if (!tracking) errors.push("Missing tracking config/script (__trackingConfig, gtag, pixelUrl, or tracking helper file)");

  return {
    ok: errors.length === 0,
    errors,
    detected: {
      pageIndex: required.index,
      pageApply: required.apply,
      layout: required.layout,
      tracking,
    },
  };
}

