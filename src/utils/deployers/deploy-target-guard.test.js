import { describe, expect, it, vi } from "vitest";
import {
  resolveDeployTargetForSite,
  siteRequiresGithubActionsBuild,
} from "./deploy-target-guard.js";

vi.mock("../template-router.js", () => ({
  resolveTemplateId: (site) => site?.templateId || "classic",
  isModuleTemplate: (id) => id === "pet-care-loans",
  getCustomTemplatesCache: () => null,
}));

describe("siteRequiresGithubActionsBuild", () => {
  it("requires CI for pet-loans-evergreencare slug", () => {
    expect(siteRequiresGithubActionsBuild({ templateId: "pet-loans-evergreencare" })).toBe(true);
  });

  it("allows module templates for direct upload", () => {
    expect(siteRequiresGithubActionsBuild({ templateId: "pet-care-loans" })).toBe(false);
  });
});

describe("resolveDeployTargetForSite", () => {
  it("redirects cf-pages to github-actions for astro templates", () => {
    const r = resolveDeployTargetForSite(
      { templateId: "pet-loans-evergreencare" },
      "cf-pages"
    );
    expect(r.target).toBe("github-actions");
    expect(r.redirected).toBe(true);
  });
});
