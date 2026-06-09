/**
 * Astro / build-required templates must deploy via GitHub Actions (CI Astro build).
 * Direct CF Pages / Netlify upload uses in-browser preview HTML — JSX leaks to production.
 */

import { getCustomTemplatesCache, resolveTemplateId } from "../template-registry.js";
import { DEFAULT_TEMPLATE_ID, isModuleTemplate } from "../template-router.js";
import { identifyFramework } from "../template-analyzer.js";

const CI_ONLY_TEMPLATE_PREFIXES = [
  "pet-loans-",
  "bolt-",
  "tpl-",
  "orange-",
  "pastel-",
  "goldrush-",
  "bluerush-",
  "greenrush-",
  "bear-",
  "installment-",
];

const DIRECT_UPLOAD_TARGETS = new Set(["cf-pages", "netlify", "vercel", "cf-workers"]);

/**
 * @param {object} site
 * @returns {boolean}
 */
export function siteRequiresGithubActionsBuild(site) {
  const templateId = resolveTemplateId(site?.templateId || DEFAULT_TEMPLATE_ID);

  if (isModuleTemplate(templateId) || templateId === "classic") {
    return false;
  }

  const cache = getCustomTemplatesCache();
  if (cache) {
    const custom = cache.find((t) => t.id === templateId || t.dbId === templateId);
    if (custom?.files && Object.keys(custom.files).length > 0) {
      const fw = identifyFramework(custom.files);
      if (fw.id === "astro" || fw.buildRequired) return true;
      if (fw.id === "html-static") return false;
    }
  }

  const slug = String(templateId || "").toLowerCase();
  return CI_ONLY_TEMPLATE_PREFIXES.some((prefix) => slug.startsWith(prefix));
}

/**
 * @param {object} site
 * @param {string} requestedTarget
 * @returns {{ target: string, redirected: boolean, reason?: string }}
 */
export function resolveDeployTargetForSite(site, requestedTarget) {
  const wants = String(requestedTarget || "github-actions").trim();
  if (!siteRequiresGithubActionsBuild(site)) {
    return { target: wants, redirected: false };
  }
  if (!DIRECT_UPLOAD_TARGETS.has(wants)) {
    return { target: wants, redirected: false };
  }
  return {
    target: "github-actions",
    redirected: true,
    reason:
      "Astro templates need GitHub Actions (full CI build). Direct Cloudflare Pages upload serves broken preview HTML with visible {jsx} code.",
  };
}
