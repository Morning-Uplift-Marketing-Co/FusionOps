/**
 * Single source of truth: keys allowed on site objects when persisting (Neon, API, D1)
 * and when sanitizing Wizard payloads (see App.jsx sanitizeSite).
 *
 * Deploy pipeline: github-actions.js maps Wizard fields → deploy-configs/{domain}.json;
 * deploy-lp.yml then writes PUBLIC_* env vars from that JSON (voluumId, voluumDomain, …).
 * Optional deploy keys: cfZoneId (32-char hex), skipDnsUpsert (bool, default true in github-actions), cfPagesProject.
 *
 * Wizard Voluum labels vs deploy JSON:
 *   voluumCampaignId   → voluumId
 *   voluumTrackingDomain → voluumDomain (normalized host)
 *   voluumClickUrl     → voluumClickUrl
 *   gtagId / conversionId → conversionId in JSON
 */

export const SITE_FIELD_KEYS = Object.freeze([
  "id",
  "brand",
  "domain",
  "tagline",
  "email",
  "templateId",
  "loanType",
  "amountMin",
  "amountMax",
  "aprMin",
  "aprMax",
  "colorId",
  "fontId",
  "layout",
  "radius",
  "trustBadgeStyle",
  "trustBadgeIconTone",
  "h1",
  "h1span",
  "title2",
  "cta",
  "sub",
  "metaTitle",
  "metaDesc",
  "conversionId",
  "gtagId",
  "gtagFormStartLabel",
  "gtagFormSubmitLabel",
  "formStartLabel",
  "formSubmitLabel",
  "aid",
  "network",
  "redirectUrl",
  "voluumId",
  "voluumDomain",
  "voluumCampaignId",
  "voluumCampaignName",
  "voluumTrackingDomain",
  "voluumClickUrl",
  "voluumLanderTrackingUrl",
  "voluumLanderId",
  "voluumOfferId",
  "voluumLanderScript",
  "voluumCfCname",
  "voluumAcmName",
  "voluumAcmValue",
  "trackingMode",
  "phone",
  "address",
  "lang",
  "faviconDataUrl",
  "ogImageDataUrl",
  "formEmbed",
  "cfProfileId",
  "cfAccountId",
  "cfZoneId",
  "skipDnsUpsert",
  "cfPagesProject",
  "internetbsAccountId",
  "domainProvider",
  "domainProviderAccountId",
  "status",
  "createdAt",
  "updatedAt",
  "cost",
  "reviews",
  /** When false, LP build sets PUBLIC_SHOW_REVIEWS=false — templates should not show review cards (compliance / A-B). */
  "showReviews",
  "trustBadges",
  "deployTarget",
  "deployOnBuild",
]);

/** @type {ReadonlySet<string>} */
export const SITE_FIELDS = new Set(SITE_FIELD_KEYS);
